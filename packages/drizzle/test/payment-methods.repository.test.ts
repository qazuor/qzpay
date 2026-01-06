/**
 * Payment Methods Repository Integration Tests
 *
 * Tests the payment methods repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayPaymentMethodsRepository } from '../src/repositories/payment-methods.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayPaymentMethodsRepository', () => {
    let repository: QZPayPaymentMethodsRepository;
    let customersRepository: QZPayCustomersRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayPaymentMethodsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        const customer = await customersRepository.create({
            externalId: 'ext-pm-customer',
            email: 'pm-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('create', () => {
        it('should create a new payment method', async () => {
            const input = {
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe123',
                type: 'card',
                lastFour: '4242',
                brand: 'visa',
                expMonth: 12,
                expYear: 2030,
                isDefault: false,
                livemode: true
            };

            const pm = await repository.create(input);

            expect(pm.id).toBeDefined();
            expect(pm.customerId).toBe(testCustomerId);
            expect(pm.type).toBe('card');
            expect(pm.lastFour).toBe('4242');
            expect(pm.brand).toBe('visa');
            expect(pm.expMonth).toBe(12);
            expect(pm.expYear).toBe(2030);
        });

        it('should create bank account payment method', async () => {
            const pm = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'ba_stripe123',
                type: 'bank_account',
                livemode: true
            });

            expect(pm.type).toBe('bank_account');
            expect(pm.lastFour).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find payment method by ID', async () => {
            const created = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_find123',
                type: 'card',
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });

        it('should not find soft-deleted payment method', async () => {
            const created = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_deleted',
                type: 'card',
                livemode: true
            });

            await repository.softDelete(created.id);
            const found = await repository.findById(created.id);

            expect(found).toBeNull();
        });
    });

    describe('findByProviderPaymentMethodId', () => {
        it('should find by provider payment method ID', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_unique123',
                type: 'card',
                livemode: true
            });

            const found = await repository.findByProviderPaymentMethodId('pm_unique123');

            expect(found).not.toBeNull();
            expect(found?.providerPaymentMethodId).toBe('pm_unique123');
        });
    });

    describe('findByCustomerId', () => {
        it('should find payment methods by customer ID with pagination', async () => {
            for (let i = 1; i <= 5; i++) {
                await repository.create({
                    customerId: testCustomerId,
                    provider: 'stripe',
                    providerPaymentMethodId: `pm_cust_${i}`,
                    type: 'card',
                    livemode: true
                });
            }

            const result = await repository.findByCustomerId(testCustomerId, { limit: 3, offset: 0 });

            expect(result.data).toHaveLength(3);
            expect(result.total).toBe(5);
        });
    });

    describe('findDefaultByCustomerId', () => {
        it('should find default payment method', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_not_default',
                type: 'card',
                isDefault: false,
                livemode: true
            });
            const defaultPm = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_default',
                type: 'card',
                isDefault: true,
                livemode: true
            });

            const found = await repository.findDefaultByCustomerId(testCustomerId);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(defaultPm.id);
        });

        it('should return null when no default exists', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_no_default',
                type: 'card',
                isDefault: false,
                livemode: true
            });

            const found = await repository.findDefaultByCustomerId(testCustomerId);

            expect(found).toBeNull();
        });
    });

    describe('setDefault', () => {
        it('should set payment method as default', async () => {
            const pm1 = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_set1',
                type: 'card',
                isDefault: true,
                livemode: true
            });
            const pm2 = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_set2',
                type: 'card',
                isDefault: false,
                livemode: true
            });

            await repository.setDefault(testCustomerId, pm2.id);

            const updated1 = await repository.findById(pm1.id);
            const updated2 = await repository.findById(pm2.id);

            expect(updated1?.isDefault).toBe(false);
            expect(updated2?.isDefault).toBe(true);
        });
    });

    describe('unsetDefault', () => {
        it('should unset all defaults for customer', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_unset1',
                type: 'card',
                isDefault: true,
                livemode: true
            });

            await repository.unsetDefault(testCustomerId);

            const defaultPm = await repository.findDefaultByCustomerId(testCustomerId);
            expect(defaultPm).toBeNull();
        });
    });

    describe('findExpiringSoon', () => {
        it('should find cards expiring within specified months', async () => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            // Card expiring soon (next month)
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_expiring_soon',
                type: 'card',
                expMonth: currentMonth === 12 ? 1 : currentMonth + 1,
                expYear: currentMonth === 12 ? currentYear + 1 : currentYear,
                livemode: true
            });

            // Card not expiring soon (next year)
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_not_expiring',
                type: 'card',
                expMonth: currentMonth,
                expYear: currentYear + 2,
                livemode: true
            });

            const expiring = await repository.findExpiringSoon(3, true);

            expect(expiring.length).toBeGreaterThanOrEqual(1);
            expect(expiring.some((pm) => pm.providerPaymentMethodId === 'pm_expiring_soon')).toBe(true);
        });
    });

    describe('findExpired', () => {
        it('should find expired cards', async () => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const _currentMonth = now.getMonth() + 1;

            // Expired card
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_expired',
                type: 'card',
                expMonth: 1,
                expYear: currentYear - 1,
                livemode: true
            });

            // Valid card
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_valid',
                type: 'card',
                expMonth: 12,
                expYear: currentYear + 2,
                livemode: true
            });

            const expired = await repository.findExpired(true);

            expect(expired).toHaveLength(1);
            expect(expired[0].providerPaymentMethodId).toBe('pm_expired');
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_search1',
                type: 'card',
                livemode: true
            });
            await repository.create({
                customerId: testCustomerId,
                provider: 'mercadopago',
                providerPaymentMethodId: 'pm_search2',
                type: 'bank_account',
                livemode: true
            });
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_search3',
                type: 'card',
                livemode: false
            });
        });

        it('should search by provider', async () => {
            const stripeResult = await repository.search({ provider: 'stripe' });
            const mpResult = await repository.search({ provider: 'mercadopago' });

            expect(stripeResult.data).toHaveLength(2);
            expect(mpResult.data).toHaveLength(1);
        });

        it('should search by type', async () => {
            const cardResult = await repository.search({ type: 'card' });
            const bankResult = await repository.search({ type: 'bank_account' });

            expect(cardResult.data).toHaveLength(2);
            expect(bankResult.data).toHaveLength(1);
        });

        it('should search by livemode', async () => {
            const liveResult = await repository.search({ livemode: true });
            const testResult = await repository.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should search by customer ID', async () => {
            const result = await repository.search({ customerId: testCustomerId });
            expect(result.total).toBe(3);
        });
    });

    describe('update', () => {
        it('should update payment method fields', async () => {
            const created = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_update1',
                type: 'card',
                livemode: true
            });

            const updated = await repository.update(created.id, {
                billingDetails: { name: 'John Doe' }
            });

            expect(updated.billingDetails).toEqual({ name: 'John Doe' });
        });
    });

    describe('softDelete', () => {
        it('should soft delete payment method', async () => {
            const created = await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_delete1',
                type: 'card',
                livemode: true
            });

            await repository.softDelete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw when deleting non-existent payment method', async () => {
            await expect(repository.softDelete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('deleteByCustomerId', () => {
        it('should soft delete all payment methods for customer', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_custdel1',
                type: 'card',
                livemode: true
            });
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_custdel2',
                type: 'card',
                livemode: true
            });

            const deletedCount = await repository.deleteByCustomerId(testCustomerId);

            expect(deletedCount).toBe(2);

            const remaining = await repository.findByCustomerId(testCustomerId);
            expect(remaining.data).toHaveLength(0);
        });
    });

    describe('countByCustomerId', () => {
        it('should count payment methods for customer', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_count1',
                type: 'card',
                livemode: true
            });
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_count2',
                type: 'card',
                livemode: true
            });

            const count = await repository.countByCustomerId(testCustomerId);

            expect(count).toBe(2);
        });
    });

    describe('hasValidPaymentMethod', () => {
        it('should return true when valid card exists', async () => {
            const now = new Date();
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_valid_check',
                type: 'card',
                expMonth: 12,
                expYear: now.getFullYear() + 2,
                livemode: true
            });

            const hasValid = await repository.hasValidPaymentMethod(testCustomerId);

            expect(hasValid).toBe(true);
        });

        it('should return false when only expired cards exist', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_expired_check',
                type: 'card',
                expMonth: 1,
                expYear: 2020,
                livemode: true
            });

            const hasValid = await repository.hasValidPaymentMethod(testCustomerId);

            expect(hasValid).toBe(false);
        });

        it('should return true for non-card payment methods', async () => {
            await repository.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'ba_valid',
                type: 'bank_account',
                livemode: true
            });

            const hasValid = await repository.hasValidPaymentMethod(testCustomerId);

            expect(hasValid).toBe(true);
        });
    });
});
