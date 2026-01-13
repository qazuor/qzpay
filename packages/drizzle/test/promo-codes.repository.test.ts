/**
 * Promo Codes Repository Integration Tests
 *
 * Tests the promo codes repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayPromoCodesRepository } from '../src/repositories/promo-codes.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayPromoCodesRepository', () => {
    let repository: QZPayPromoCodesRepository;
    let customersRepository: QZPayCustomersRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayPromoCodesRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        const customer = await customersRepository.create({
            externalId: 'ext-promo-customer',
            email: 'promo-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('create', () => {
        it('should create a percentage promo code', async () => {
            const input = {
                code: 'SAVE20',
                type: 'percentage',
                value: 20,
                active: true,
                livemode: true
            };

            const promo = await repository.create(input);

            expect(promo.id).toBeDefined();
            expect(promo.code).toBe('SAVE20');
            expect(promo.type).toBe('percentage');
            expect(promo.value).toBe(20);
            expect(promo.active).toBe(true);
        });

        it('should create a fixed amount promo code', async () => {
            const promo = await repository.create({
                code: 'FLAT10',
                type: 'fixed_amount',
                value: 1000,
                active: true,
                livemode: true
            });

            expect(promo.type).toBe('fixed_amount');
            expect(promo.value).toBe(1000);
        });

        it('should create promo code with limits', async () => {
            const promo = await repository.create({
                code: 'LIMITED',
                type: 'percentage',
                value: 50,
                maxUses: 100,
                maxPerCustomer: 1,
                active: true,
                livemode: true
            });

            expect(promo.maxUses).toBe(100);
            expect(promo.maxPerCustomer).toBe(1);
        });

        it('should create promo code with date restrictions', async () => {
            const startsAt = new Date();
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);

            const promo = await repository.create({
                code: 'TIMED',
                type: 'percentage',
                value: 15,
                startsAt,
                expiresAt,
                active: true,
                livemode: true
            });

            expect(promo.startsAt).toBeInstanceOf(Date);
            expect(promo.expiresAt).toBeInstanceOf(Date);
        });
    });

    describe('findById', () => {
        it('should find promo code by ID', async () => {
            const created = await repository.create({
                code: 'FINDME',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.code).toBe('FINDME');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByCode', () => {
        it('should find promo code by code string', async () => {
            await repository.create({
                code: 'UNIQUE123',
                type: 'percentage',
                value: 25,
                active: true,
                livemode: true
            });

            const found = await repository.findByCode('UNIQUE123', true);

            expect(found).not.toBeNull();
            expect(found?.code).toBe('UNIQUE123');
        });

        it('should find by code case-insensitively', async () => {
            await repository.create({
                code: 'UPPERCASE',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const found = await repository.findByCode('uppercase', true);

            expect(found).not.toBeNull();
        });

        it('should distinguish between livemode', async () => {
            // Promo codes have unique constraint on code, so we use different codes
            // and verify that findByCode filters by livemode
            await repository.create({
                code: 'LIVETEST',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            await repository.create({
                code: 'TESTMODE',
                type: 'percentage',
                value: 20,
                active: true,
                livemode: false
            });

            // When searching for LIVETEST in testmode, it should return null
            const notFoundInTestMode = await repository.findByCode('LIVETEST', false);
            // When searching for TESTMODE in livemode, it should return null
            const notFoundInLiveMode = await repository.findByCode('TESTMODE', true);

            // Each should only be found in its respective mode
            const liveFound = await repository.findByCode('LIVETEST', true);
            const testFound = await repository.findByCode('TESTMODE', false);

            expect(notFoundInTestMode).toBeNull();
            expect(notFoundInLiveMode).toBeNull();
            expect(liveFound?.value).toBe(10);
            expect(testFound?.value).toBe(20);
        });
    });

    describe('findActive', () => {
        it('should find active promo codes', async () => {
            await repository.create({
                code: 'ACTIVE1',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            await repository.create({
                code: 'INACTIVE1',
                type: 'percentage',
                value: 20,
                active: false,
                livemode: true
            });

            const active = await repository.findActive(true);

            expect(active).toHaveLength(1);
            expect(active[0].code).toBe('ACTIVE1');
        });

        it('should exclude expired codes', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await repository.create({
                code: 'EXPIRED1',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: yesterday,
                livemode: true
            });

            const active = await repository.findActive(true);

            expect(active).toHaveLength(0);
        });

        it('should exclude not-yet-valid codes', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                code: 'FUTURE1',
                type: 'percentage',
                value: 10,
                active: true,
                startsAt: tomorrow,
                livemode: true
            });

            const active = await repository.findActive(true);

            expect(active).toHaveLength(0);
        });
    });

    describe('isValid', () => {
        it('should return true for valid promo code', async () => {
            await repository.create({
                code: 'VALID',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const valid = await repository.isValid('VALID', undefined, true);

            expect(valid).toBe(true);
        });

        it('should return false for inactive code', async () => {
            await repository.create({
                code: 'NOTACTIVE',
                type: 'percentage',
                value: 10,
                active: false,
                livemode: true
            });

            const valid = await repository.isValid('NOTACTIVE', undefined, true);

            expect(valid).toBe(false);
        });

        it('should return false for expired code', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await repository.create({
                code: 'EXPIREDCHECK',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: yesterday,
                livemode: true
            });

            const valid = await repository.isValid('EXPIREDCHECK', undefined, true);

            expect(valid).toBe(false);
        });

        it('should return false for non-existent code', async () => {
            const valid = await repository.isValid('DOESNOTEXIST', undefined, true);

            expect(valid).toBe(false);
        });
    });

    describe('validateAndGet', () => {
        it('should return valid promo code with details', async () => {
            await repository.create({
                code: 'VALIDATEME',
                type: 'percentage',
                value: 30,
                active: true,
                livemode: true
            });

            const result = await repository.validateAndGet('VALIDATEME', undefined, true);

            expect(result.valid).toBe(true);
            expect(result.promoCode).toBeDefined();
            expect(result.promoCode?.value).toBe(30);
        });

        it('should return error for invalid code', async () => {
            const result = await repository.validateAndGet('NONEXISTENT', undefined, true);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code not found');
        });

        it('should return error for expired code', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await repository.create({
                code: 'EXPIREDVAL',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: yesterday,
                livemode: true
            });

            const result = await repository.validateAndGet('EXPIREDVAL', undefined, true);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code has expired');
        });

        it('should return error for new customers only code when customer exists', async () => {
            const promo = await repository.create({
                code: 'NEWONLY',
                type: 'percentage',
                value: 50,
                active: true,
                newCustomersOnly: true,
                livemode: true
            });

            // Record usage for this customer
            await repository.recordUsage({
                promoCodeId: promo.id,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD'
            });

            const result = await repository.validateAndGet('NEWONLY', testCustomerId, true);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is only valid for new customers');
        });
    });

    describe('update', () => {
        it('should update promo code fields', async () => {
            const created = await repository.create({
                code: 'UPDATEME',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const updated = await repository.update(created.id, {
                value: 25,
                maxUses: 50
            });

            expect(updated.value).toBe(25);
            expect(updated.maxUses).toBe(50);
        });
    });

    describe('incrementUsage', () => {
        it('should increment usage count', async () => {
            const created = await repository.create({
                code: 'INCREMENT',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const updated = await repository.incrementUsage(created.id);

            expect(updated.usedCount).toBe(1);
        });
    });

    describe('deactivate', () => {
        it('should deactivate promo code', async () => {
            const created = await repository.create({
                code: 'DEACTIVATE',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const deactivated = await repository.deactivate(created.id);

            expect(deactivated.active).toBe(false);
        });
    });

    describe('findExpiredActive', () => {
        it('should find expired but still active codes', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await repository.create({
                code: 'EXPIREDACTIVE',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: yesterday,
                livemode: true
            });

            const expired = await repository.findExpiredActive(true);

            expect(expired).toHaveLength(1);
            expect(expired[0].code).toBe('EXPIREDACTIVE');
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                code: 'SEARCH1',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            await repository.create({
                code: 'SEARCH2',
                type: 'fixed_amount',
                value: 500,
                active: true,
                livemode: true
            });
            await repository.create({
                code: 'SEARCH3',
                type: 'percentage',
                value: 20,
                active: false,
                livemode: true
            });
        });

        it('should search by active status', async () => {
            const activeResult = await repository.search({ active: true });
            const inactiveResult = await repository.search({ active: false });

            expect(activeResult.data).toHaveLength(2);
            expect(inactiveResult.data).toHaveLength(1);
        });

        it('should search by type', async () => {
            const percentageResult = await repository.search({ type: 'percentage' });
            const fixedResult = await repository.search({ type: 'fixed_amount' });

            expect(percentageResult.data).toHaveLength(2);
            expect(fixedResult.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            const page1 = await repository.search({ limit: 2, offset: 0 });
            const page2 = await repository.search({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(1);
        });
    });

    describe('Promo Code Usage', () => {
        let testPromoId: string;

        beforeEach(async () => {
            const promo = await repository.create({
                code: 'USAGETEST',
                type: 'percentage',
                value: 25,
                active: true,
                livemode: true
            });
            testPromoId = promo.id;
        });

        it('should record promo code usage', async () => {
            const usage = await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 2500,
                currency: 'USD'
            });

            expect(usage.id).toBeDefined();
            expect(usage.discountAmount).toBe(2500);

            // Should also increment usage count
            const promo = await repository.findById(testPromoId);
            expect(promo?.usedCount).toBe(1);
        });

        it('should find usage by promo code ID', async () => {
            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD'
            });

            const usage = await repository.findUsageByPromoCodeId(testPromoId);

            expect(usage).toHaveLength(1);
            expect(usage[0].customerId).toBe(testCustomerId);
        });

        it('should find usage by customer ID', async () => {
            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 1500,
                currency: 'USD'
            });

            const usage = await repository.findUsageByCustomerId(testCustomerId);

            expect(usage).toHaveLength(1);
            expect(usage[0].promoCodeId).toBe(testPromoId);
        });

        it('should check if customer has used code', async () => {
            expect(await repository.hasCustomerUsedCode(testPromoId, testCustomerId)).toBe(false);

            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD'
            });

            expect(await repository.hasCustomerUsedCode(testPromoId, testCustomerId)).toBe(true);
        });

        it('should get usage count', async () => {
            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD'
            });

            // Create another customer for second usage
            const customer2 = await customersRepository.create({
                externalId: 'ext-promo-customer2',
                email: 'promo-test2@example.com',
                livemode: true
            });

            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: customer2.id,
                discountAmount: 2000,
                currency: 'USD'
            });

            const count = await repository.getUsageCount(testPromoId);

            expect(count).toBe(2);
        });

        it('should get total discount given', async () => {
            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD'
            });

            const customer2 = await customersRepository.create({
                externalId: 'ext-promo-customer3',
                email: 'promo-test3@example.com',
                livemode: true
            });

            await repository.recordUsage({
                promoCodeId: testPromoId,
                customerId: customer2.id,
                discountAmount: 2500,
                currency: 'USD'
            });

            const total = await repository.getTotalDiscountGiven(testPromoId);

            expect(total).toBe(3500);
        });
    });
});
