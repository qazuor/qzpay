/**
 * Promo Code Flow E2E Tests
 *
 * Tests complete promo code flows from creation through redemption
 * and tracking against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayInvoicesRepository } from '../../src/repositories/invoices.repository.js';
import { QZPayPromoCodesRepository } from '../../src/repositories/promo-codes.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Promo Code Flow E2E', () => {
    let promoCodesRepo: QZPayPromoCodesRepository;
    let customersRepo: QZPayCustomersRepository;
    let invoicesRepo: QZPayInvoicesRepository;

    let testCustomerId: string;
    let newCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        promoCodesRepo = new QZPayPromoCodesRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
        invoicesRepo = new QZPayInvoicesRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create test customers
        const existingCustomer = await customersRepo.create({
            externalId: 'ext-promo-customer',
            email: 'existing@example.com',
            name: 'Existing Customer',
            livemode: true
        });
        testCustomerId = existingCustomer.id;

        const newCustomer = await customersRepo.create({
            externalId: 'ext-new-customer',
            email: 'new@example.com',
            name: 'New Customer',
            livemode: true
        });
        newCustomerId = newCustomer.id;
    });

    describe('Promo Code Creation', () => {
        it('should create a percentage discount code', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'SAVE20',
                type: 'percentage',
                value: 20, // 20% discount
                active: true,
                livemode: true
            });

            expect(promoCode.code).toBe('SAVE20');
            expect(promoCode.type).toBe('percentage');
            expect(promoCode.value).toBe(20);
            expect(promoCode.active).toBe(true);
        });

        it('should create a fixed amount discount code', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'FLAT10',
                type: 'fixed_amount',
                value: 1000, // $10
                active: true,
                livemode: true
            });

            expect(promoCode.code).toBe('FLAT10');
            expect(promoCode.type).toBe('fixed_amount');
            expect(promoCode.value).toBe(1000);
        });

        it('should create a code with usage limits', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'LIMITED100',
                type: 'percentage',
                value: 15,
                maxUses: 100,
                active: true,
                livemode: true
            });

            expect(promoCode.maxUses).toBe(100);
            expect(promoCode.usedCount).toBe(0);
        });

        it('should create a time-limited code', async () => {
            const startsAt = new Date();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            const promoCode = await promoCodesRepo.create({
                code: 'HOLIDAY2024',
                type: 'percentage',
                value: 25,
                startsAt,
                expiresAt,
                active: true,
                livemode: true
            });

            expect(promoCode.startsAt).not.toBeNull();
            expect(promoCode.expiresAt).not.toBeNull();
        });

        it('should create a new customers only code', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'WELCOME',
                type: 'percentage',
                value: 30,
                newCustomersOnly: true,
                active: true,
                livemode: true
            });

            expect(promoCode.newCustomersOnly).toBe(true);
        });
    });

    describe('Promo Code Validation', () => {
        beforeEach(async () => {
            // Create various promo codes for testing
            await promoCodesRepo.create({
                code: 'VALID',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            await promoCodesRepo.create({
                code: 'INACTIVE',
                type: 'percentage',
                value: 10,
                active: false,
                livemode: true
            });

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            await promoCodesRepo.create({
                code: 'EXPIRED',
                type: 'percentage',
                value: 10,
                expiresAt: yesterday,
                active: true,
                livemode: true
            });

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            await promoCodesRepo.create({
                code: 'NOTYET',
                type: 'percentage',
                value: 10,
                startsAt: tomorrow,
                active: true,
                livemode: true
            });

            await promoCodesRepo.create({
                code: 'MAXED',
                type: 'percentage',
                value: 10,
                maxUses: 1,
                usedCount: 1,
                active: true,
                livemode: true
            });
        });

        it('should validate a valid promo code', async () => {
            const isValid = await promoCodesRepo.isValid('VALID');
            expect(isValid).toBe(true);
        });

        it('should reject non-existent code', async () => {
            const isValid = await promoCodesRepo.isValid('NONEXISTENT');
            expect(isValid).toBe(false);
        });

        it('should reject inactive code', async () => {
            const isValid = await promoCodesRepo.isValid('INACTIVE');
            expect(isValid).toBe(false);
        });

        it('should reject expired code', async () => {
            const isValid = await promoCodesRepo.isValid('EXPIRED');
            expect(isValid).toBe(false);
        });

        it('should reject not-yet-valid code', async () => {
            const isValid = await promoCodesRepo.isValid('NOTYET');
            expect(isValid).toBe(false);
        });

        it('should reject maxed out code', async () => {
            const isValid = await promoCodesRepo.isValid('MAXED');
            expect(isValid).toBe(false);
        });

        it('should provide detailed validation with error messages', async () => {
            const expiredResult = await promoCodesRepo.validateAndGet('EXPIRED');
            expect(expiredResult.valid).toBe(false);
            expect(expiredResult.error).toBe('Promo code has expired');

            const inactiveResult = await promoCodesRepo.validateAndGet('INACTIVE');
            expect(inactiveResult.valid).toBe(false);
            expect(inactiveResult.error).toBe('Promo code is not active');

            const validResult = await promoCodesRepo.validateAndGet('VALID');
            expect(validResult.valid).toBe(true);
            expect(validResult.promoCode).toBeDefined();
        });
    });

    describe('New Customer Only Codes', () => {
        let newCustomerOnlyCode: Awaited<ReturnType<typeof promoCodesRepo.create>>;

        beforeEach(async () => {
            newCustomerOnlyCode = await promoCodesRepo.create({
                code: 'NEWONLY',
                type: 'percentage',
                value: 50,
                newCustomersOnly: true,
                active: true,
                livemode: true
            });
        });

        it('should allow new customer to use code', async () => {
            // New customer has no usage history
            const isValid = await promoCodesRepo.isValid('NEWONLY', newCustomerId);
            expect(isValid).toBe(true);
        });

        it('should reject existing customer who used any promo code', async () => {
            // Record a usage for the existing customer
            await promoCodesRepo.recordUsage({
                promoCodeId: newCustomerOnlyCode.id,
                customerId: testCustomerId,
                subscriptionId: null,
                discountAmount: 5000,
                currency: 'USD',
                livemode: true
            });

            const isValid = await promoCodesRepo.isValid('NEWONLY', testCustomerId);
            expect(isValid).toBe(false);
        });
    });

    describe('Promo Code Redemption Flow', () => {
        it('should complete full promo code redemption', async () => {
            // Step 1: Create promo code
            const promoCode = await promoCodesRepo.create({
                code: 'REDEEM20',
                type: 'percentage',
                value: 20,
                active: true,
                livemode: true
            });

            // Step 2: Validate code
            const validation = await promoCodesRepo.validateAndGet('REDEEM20');
            expect(validation.valid).toBe(true);

            // Step 3: Calculate discount for invoice
            const invoiceSubtotal = 10000; // $100
            const promoValue = promoCode.value ?? 0;
            const discountAmount = Math.floor((invoiceSubtotal * promoValue) / 100);
            expect(discountAmount).toBe(2000); // $20 discount

            // Step 4: Create invoice with discount
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-PROMO-001',
                status: 'open',
                currency: 'USD',
                subtotal: invoiceSubtotal,
                discount: discountAmount,
                total: invoiceSubtotal - discountAmount,
                amountPaid: 0,
                livemode: true
            });

            expect(invoice.discount).toBe(2000);
            expect(invoice.total).toBe(8000);

            // Step 5: Record promo code usage
            const usage = await promoCodesRepo.recordUsage({
                promoCodeId: promoCode.id,
                customerId: testCustomerId,
                discountAmount,
                currency: 'USD',
                livemode: true
            });

            expect(usage.discountAmount).toBe(2000);

            // Step 6: Verify usage count incremented
            const updatedCode = await promoCodesRepo.findById(promoCode.id);
            expect(updatedCode?.usedCount).toBe(1);
        });

        it('should handle fixed amount discount', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'FLAT25',
                type: 'fixed_amount',
                value: 2500, // $25
                active: true,
                livemode: true
            });

            const invoiceSubtotal = 10000;
            const discountAmount = promoCode.value ?? 0;

            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-FLAT-001',
                status: 'open',
                currency: 'USD',
                subtotal: invoiceSubtotal,
                discount: discountAmount,
                total: invoiceSubtotal - discountAmount,
                amountPaid: 0,
                livemode: true
            });

            expect(invoice.discount).toBe(2500);
            expect(invoice.total).toBe(7500);
        });
    });

    describe('Usage Tracking', () => {
        let promoCodeId: string;

        beforeEach(async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'TRACKME',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            promoCodeId = promoCode.id;
        });

        it('should track multiple usages', async () => {
            // Create 3 usages
            for (let i = 1; i <= 3; i++) {
                await promoCodesRepo.recordUsage({
                    promoCodeId,
                    customerId: testCustomerId,
                    discountAmount: 1000 * i,
                    currency: 'USD',
                    livemode: true
                });
            }

            const usages = await promoCodesRepo.findUsageByPromoCodeId(promoCodeId);
            expect(usages).toHaveLength(3);

            const usageCount = await promoCodesRepo.getUsageCount(promoCodeId);
            expect(usageCount).toBe(3);
        });

        it('should calculate total discount given', async () => {
            await promoCodesRepo.recordUsage({
                promoCodeId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD',
                livemode: true
            });
            await promoCodesRepo.recordUsage({
                promoCodeId,
                customerId: newCustomerId,
                discountAmount: 2500,
                currency: 'USD',
                livemode: true
            });

            const totalDiscount = await promoCodesRepo.getTotalDiscountGiven(promoCodeId);
            expect(totalDiscount).toBe(3500);
        });

        it('should check if customer has used specific code', async () => {
            await promoCodesRepo.recordUsage({
                promoCodeId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD',
                livemode: true
            });

            const hasUsed = await promoCodesRepo.hasCustomerUsedCode(promoCodeId, testCustomerId);
            const hasNotUsed = await promoCodesRepo.hasCustomerUsedCode(promoCodeId, newCustomerId);

            expect(hasUsed).toBe(true);
            expect(hasNotUsed).toBe(false);
        });

        it('should find usage by customer', async () => {
            await promoCodesRepo.recordUsage({
                promoCodeId,
                customerId: testCustomerId,
                discountAmount: 1000,
                currency: 'USD',
                livemode: true
            });

            const usages = await promoCodesRepo.findUsageByCustomerId(testCustomerId);
            expect(usages).toHaveLength(1);
            expect(usages[0].customerId).toBe(testCustomerId);
        });
    });

    describe('Promo Code Lifecycle', () => {
        it('should deactivate promo code', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'DEACTIVATE',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });

            const deactivated = await promoCodesRepo.deactivate(promoCode.id);
            expect(deactivated.active).toBe(false);

            // Verify no longer valid
            const isValid = await promoCodesRepo.isValid('DEACTIVATE');
            expect(isValid).toBe(false);
        });

        it('should find expired but still active codes', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await promoCodesRepo.create({
                code: 'SHOULDBEINACTIVE',
                type: 'percentage',
                value: 10,
                expiresAt: yesterday,
                active: true, // Still marked active but expired
                livemode: true
            });

            const expiredActive = await promoCodesRepo.findExpiredActive(true);
            expect(expiredActive).toHaveLength(1);
            expect(expiredActive[0].code).toBe('SHOULDBEINACTIVE');
        });

        it('should find only active codes', async () => {
            await promoCodesRepo.create({
                code: 'ACTIVE1',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            await promoCodesRepo.create({
                code: 'ACTIVE2',
                type: 'percentage',
                value: 20,
                active: true,
                livemode: true
            });
            await promoCodesRepo.create({
                code: 'INACTIVE1',
                type: 'percentage',
                value: 30,
                active: false,
                livemode: true
            });

            const activeCodes = await promoCodesRepo.findActive(true);
            expect(activeCodes).toHaveLength(2);
        });
    });

    describe('Search and Filtering', () => {
        beforeEach(async () => {
            await promoCodesRepo.create({
                code: 'PERCENT10',
                type: 'percentage',
                value: 10,
                active: true,
                livemode: true
            });
            await promoCodesRepo.create({
                code: 'PERCENT20',
                type: 'percentage',
                value: 20,
                active: false,
                livemode: true
            });
            await promoCodesRepo.create({
                code: 'FIXED10',
                type: 'fixed_amount',
                value: 1000,
                active: true,
                livemode: false
            });
        });

        it('should search by type', async () => {
            const percentResult = await promoCodesRepo.search({ type: 'percentage' });
            const fixedResult = await promoCodesRepo.search({ type: 'fixed_amount' });

            expect(percentResult.data).toHaveLength(2);
            expect(fixedResult.data).toHaveLength(1);
        });

        it('should search by active status', async () => {
            const activeResult = await promoCodesRepo.search({ active: true });
            const inactiveResult = await promoCodesRepo.search({ active: false });

            expect(activeResult.data).toHaveLength(2);
            expect(inactiveResult.data).toHaveLength(1);
        });

        it('should search by livemode', async () => {
            const liveResult = await promoCodesRepo.search({ livemode: true });
            const testResult = await promoCodesRepo.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should find by code (case insensitive)', async () => {
            const found = await promoCodesRepo.findByCode('percent10');
            expect(found).not.toBeNull();
            expect(found?.code).toBe('PERCENT10');
        });
    });

    describe('Usage Limit Enforcement', () => {
        it('should enforce maximum uses limit', async () => {
            const promoCode = await promoCodesRepo.create({
                code: 'LIMITED5',
                type: 'percentage',
                value: 10,
                maxUses: 5,
                active: true,
                livemode: true
            });

            // Use the code 5 times
            for (let i = 0; i < 5; i++) {
                const isValid = await promoCodesRepo.isValid('LIMITED5');
                expect(isValid).toBe(true);

                await promoCodesRepo.recordUsage({
                    promoCodeId: promoCode.id,
                    customerId: testCustomerId,
                    discountAmount: 100,
                    currency: 'USD',
                    livemode: true
                });
            }

            // 6th attempt should fail
            const isStillValid = await promoCodesRepo.isValid('LIMITED5');
            expect(isStillValid).toBe(false);

            const validation = await promoCodesRepo.validateAndGet('LIMITED5');
            expect(validation.error).toBe('Promo code has reached maximum uses');
        });
    });
});
