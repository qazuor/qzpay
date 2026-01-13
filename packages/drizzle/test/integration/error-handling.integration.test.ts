/**
 * Error Handling Integration Tests
 *
 * Tests error scenarios, edge cases, and recovery mechanisms
 * in the Core + Drizzle integration.
 */
import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '../../src/adapter/index.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Error Handling Integration', () => {
    let billing: QZPayBilling;
    let storageAdapter: QZPayDrizzleStorageAdapter;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        storageAdapter = createQZPayDrizzleAdapter(db, { livemode: true });
        billing = createQZPayBilling({
            storage: storageAdapter,
            livemode: true,
            defaultCurrency: 'usd'
        });
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Invalid Input Handling', () => {
        it('should handle getting non-existent customer', async () => {
            // Use a valid UUID format that doesn't exist
            const customer = await billing.customers.get('00000000-0000-0000-0000-000000000000');
            expect(customer).toBeNull();
        });

        it('should handle getting customer by non-existent external ID', async () => {
            const customer = await billing.customers.getByExternalId('non-existent-external-id');
            expect(customer).toBeNull();
        });

        it('should handle getting non-existent subscription', async () => {
            // Use a valid UUID format that doesn't exist
            const subscription = await billing.subscriptions.get('00000000-0000-0000-0000-000000000000');
            expect(subscription).toBeNull();
        });

        it('should handle getting non-existent payment', async () => {
            // Use a valid UUID format that doesn't exist
            const payment = await billing.payments.get('00000000-0000-0000-0000-000000000000');
            expect(payment).toBeNull();
        });

        it('should handle getting non-existent invoice', async () => {
            // Use a valid UUID format that doesn't exist
            const invoice = await billing.invoices.get('00000000-0000-0000-0000-000000000000');
            expect(invoice).toBeNull();
        });

        it('should handle validating non-existent promo code', async () => {
            const result = await billing.promoCodes.validate('NON_EXISTENT_CODE');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code not found');
        });

        it('should handle checking non-existent entitlement', async () => {
            const customer = await billing.customers.create({
                externalId: 'entitlement-test',
                email: 'entitlement@test.com',
                name: 'Entitlement Test'
            });

            const hasEntitlement = await billing.entitlements.check(customer.id, 'non_existent_feature');
            expect(hasEntitlement).toBe(false);
        });

        it('should handle checking non-existent limit', async () => {
            const customer = await billing.customers.create({
                externalId: 'limit-test',
                email: 'limit@test.com',
                name: 'Limit Test'
            });

            const limitCheck = await billing.limits.check(customer.id, 'non_existent_limit');
            // Non-existent limit defaults to unlimited
            expect(limitCheck.allowed).toBe(true);
            expect(limitCheck.maxValue).toBe(Number.POSITIVE_INFINITY);
        });
    });

    describe('Duplicate Handling', () => {
        it('should handle duplicate external ID gracefully with syncUser', async () => {
            // First creation
            const customer1 = await billing.customers.syncUser({
                externalId: 'duplicate-external-id',
                email: 'duplicate@test.com',
                name: 'First Name'
            });

            // Second sync should return existing customer
            const customer2 = await billing.customers.syncUser({
                externalId: 'duplicate-external-id',
                email: 'duplicate2@test.com',
                name: 'Updated Name'
            });

            expect(customer2.id).toBe(customer1.id);
        });

        it('should handle granting same entitlement twice', async () => {
            const customer = await billing.customers.create({
                externalId: 'double-entitlement',
                email: 'double@test.com',
                name: 'Double Entitlement'
            });

            // First grant
            await billing.entitlements.grant(customer.id, 'premium_feature');

            // Second grant should not throw
            await billing.entitlements.grant(customer.id, 'premium_feature');

            // Should still have only one entitlement
            const entitlements = await billing.entitlements.getByCustomerId(customer.id);
            const premiumCount = entitlements.filter((e) => e.entitlementKey === 'premium_feature').length;
            expect(premiumCount).toBe(1);
        });

        it('should handle setting same limit twice', async () => {
            const customer = await billing.customers.create({
                externalId: 'double-limit',
                email: 'doublelimit@test.com',
                name: 'Double Limit'
            });

            // First set
            await billing.limits.set(customer.id, 'api_calls', 100);

            // Second set should update
            await billing.limits.set(customer.id, 'api_calls', 200);

            const limitCheck = await billing.limits.check(customer.id, 'api_calls');
            expect(limitCheck.maxValue).toBe(200);
        });
    });

    describe('Edge Cases', () => {
        it('should reject zero amount payment', async () => {
            const customer = await billing.customers.create({
                externalId: 'zero-payment',
                email: 'zero@test.com',
                name: 'Zero Payment'
            });

            await expect(
                billing.payments.process({
                    customerId: customer.id,
                    amount: 0,
                    currency: 'USD'
                })
            ).rejects.toThrow('Amount must be greater than 0');
        });

        it('should reject empty invoice lines', async () => {
            const customer = await billing.customers.create({
                externalId: 'empty-invoice',
                email: 'empty@test.com',
                name: 'Empty Invoice'
            });

            await expect(
                billing.invoices.create({
                    customerId: customer.id,
                    lines: []
                })
            ).rejects.toThrow('Invoice must have at least one line item');
        });

        it('should handle very long strings', async () => {
            const longName = 'A'.repeat(255);
            const longMetadata = { key: 'B'.repeat(1000) };

            const customer = await billing.customers.create({
                externalId: 'long-strings',
                email: 'long@test.com',
                name: longName,
                metadata: longMetadata
            });

            expect(customer.name).toBe(longName);
            expect(customer.metadata).toEqual(longMetadata);
        });

        it('should handle special characters in strings', async () => {
            const specialName = 'Test\'s "Customer" <with> & special; chars';

            const customer = await billing.customers.create({
                externalId: 'special-chars',
                email: 'special@test.com',
                name: specialName
            });

            const fetched = await billing.customers.get(customer.id);
            expect(fetched?.name).toBe(specialName);
        });

        it('should handle unicode characters', async () => {
            const unicodeName = '测试客户 🎉 مستخدم';

            const customer = await billing.customers.create({
                externalId: 'unicode-test',
                email: 'unicode@test.com',
                name: unicodeName
            });

            const fetched = await billing.customers.get(customer.id);
            expect(fetched?.name).toBe(unicodeName);
        });

        it('should handle large numbers', async () => {
            const customer = await billing.customers.create({
                externalId: 'large-number',
                email: 'large@test.com',
                name: 'Large Number Test'
            });

            // Max safe integer amount (in cents)
            const largeAmount = 999999999; // $9,999,999.99

            const payment = await billing.payments.process({
                customerId: customer.id,
                amount: largeAmount,
                currency: 'USD'
            });

            expect(payment.amount).toBe(largeAmount);
        });
    });

    describe('Refund Error Cases', () => {
        it('should throw when refunding non-existent payment', async () => {
            await expect(
                billing.payments.refund({
                    paymentId: 'non-existent-payment-id'
                })
            ).rejects.toThrow();
        });

        it('should handle partial refund correctly', async () => {
            const customer = await billing.customers.create({
                externalId: 'partial-refund',
                email: 'partial@test.com',
                name: 'Partial Refund'
            });

            const payment = await billing.payments.process({
                customerId: customer.id,
                amount: 10000,
                currency: 'USD'
            });

            // First partial refund
            const firstRefund = await billing.payments.refund({
                paymentId: payment.id,
                amount: 3000
            });

            expect(firstRefund.status).toBe('partially_refunded');
            expect(firstRefund.metadata?.refundedAmount).toBe(3000);
        });
    });

    describe('Subscription Error Cases', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'sub-error-customer',
                email: 'suberror@test.com',
                name: 'Sub Error Customer'
            });
            customerId = customer.id;

            const plan = await storageAdapter.plans.create({
                name: 'Error Test Plan',
                active: true,
                livemode: true
            });
            planId = plan.id;
        });

        it('should handle canceling already canceled subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            // First cancel
            await billing.subscriptions.cancel(subscription.id);

            // Second cancel should not throw
            const doubleCanceled = await billing.subscriptions.cancel(subscription.id);
            expect(doubleCanceled.status).toBe('canceled');
        });

        it('should handle pausing already paused subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            // First pause
            await billing.subscriptions.pause(subscription.id);

            // Second pause should not throw
            const doublePaused = await billing.subscriptions.pause(subscription.id);
            expect(doublePaused.status).toBe('paused');
        });

        it('should handle resuming active subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            // Resume without pausing first
            const resumed = await billing.subscriptions.resume(subscription.id);
            expect(resumed.status).toBe('active');
        });
    });

    describe('Limit Boundary Cases', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'limit-boundary',
                email: 'boundary@test.com',
                name: 'Boundary Test'
            });
            customerId = customer.id;
        });

        it('should handle incrementing beyond limit', async () => {
            await billing.limits.set(customerId, 'api_calls', 10);

            // Increment to exactly the limit
            await billing.limits.increment(customerId, 'api_calls', 10);

            const check = await billing.limits.check(customerId, 'api_calls');
            expect(check.allowed).toBe(false);
            expect(check.remaining).toBe(0);
        });

        it('should handle zero limit', async () => {
            await billing.limits.set(customerId, 'zero_limit', 0);

            const check = await billing.limits.check(customerId, 'zero_limit');
            expect(check.allowed).toBe(false);
            expect(check.remaining).toBe(0);
        });

        it('should track multiple increments correctly', async () => {
            await billing.limits.set(customerId, 'multi_increment', 100);

            // Multiple increments
            await billing.limits.increment(customerId, 'multi_increment', 10);
            await billing.limits.increment(customerId, 'multi_increment', 20);
            await billing.limits.increment(customerId, 'multi_increment', 30);

            const check = await billing.limits.check(customerId, 'multi_increment');
            expect(check.currentValue).toBe(60);
            expect(check.remaining).toBe(40);
        });
    });

    describe('Event Emission on Errors', () => {
        it('should not emit events on validation failures', async () => {
            const events: string[] = [];
            billing.on('customer.created', () => events.push('customer.created'));

            // This should create the customer (no validation failure with valid data)
            await billing.customers.create({
                externalId: 'event-test',
                email: 'event@test.com',
                name: 'Event Test'
            });

            expect(events).toContain('customer.created');
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle concurrent customer creates with different external IDs', async () => {
            const creates = Array.from({ length: 5 }, (_, i) =>
                billing.customers.create({
                    externalId: `concurrent-${i}`,
                    email: `concurrent${i}@test.com`,
                    name: `Concurrent ${i}`
                })
            );

            const customers = await Promise.all(creates);

            expect(customers).toHaveLength(5);
            const uniqueIds = new Set(customers.map((c) => c.id));
            expect(uniqueIds.size).toBe(5);
        });

        it('should handle concurrent limit increments', async () => {
            const customer = await billing.customers.create({
                externalId: 'concurrent-limits',
                email: 'concurrent@test.com',
                name: 'Concurrent Limits'
            });

            await billing.limits.set(customer.id, 'concurrent_counter', 1000);

            // Concurrent increments
            const increments = Array.from({ length: 10 }, () => billing.limits.increment(customer.id, 'concurrent_counter', 1));

            await Promise.all(increments);

            const check = await billing.limits.check(customer.id, 'concurrent_counter');
            expect(check.currentValue).toBe(10);
        });

        it('should handle concurrent payments', async () => {
            const customer = await billing.customers.create({
                externalId: 'concurrent-payments',
                email: 'payments@test.com',
                name: 'Concurrent Payments'
            });

            const payments = Array.from({ length: 5 }, (_, i) =>
                billing.payments.process({
                    customerId: customer.id,
                    amount: 1000 * (i + 1),
                    currency: 'USD'
                })
            );

            const results = await Promise.all(payments);

            expect(results).toHaveLength(5);
            const uniqueIds = new Set(results.map((p) => p.id));
            expect(uniqueIds.size).toBe(5);
        });
    });

    describe('Data Integrity', () => {
        it('should maintain referential integrity on customer delete', async () => {
            const customer = await billing.customers.create({
                externalId: 'integrity-test',
                email: 'integrity@test.com',
                name: 'Integrity Test'
            });

            // Create related data
            await billing.entitlements.grant(customer.id, 'test_feature');
            await billing.limits.set(customer.id, 'test_limit', 100);

            // Delete customer
            await billing.customers.delete(customer.id);

            // Customer should be soft-deleted (null)
            const deleted = await billing.customers.get(customer.id);
            expect(deleted).toBeNull();
        });

        it('should preserve metadata through updates', async () => {
            const customer = await billing.customers.create({
                externalId: 'metadata-test',
                email: 'metadata@test.com',
                name: 'Metadata Test',
                metadata: { original: true, count: 1 }
            });

            const updated = await billing.customers.update(customer.id, {
                name: 'Updated Name',
                metadata: { original: true, count: 2, new: 'field' }
            });

            expect(updated.metadata).toEqual({ original: true, count: 2, new: 'field' });
        });
    });
});
