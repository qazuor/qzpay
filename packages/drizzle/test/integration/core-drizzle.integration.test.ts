/**
 * Core + Drizzle Integration Tests
 *
 * Tests the complete integration between @qazuor/qzpay-core and @qazuor/qzpay-drizzle
 * using a real PostgreSQL database (via Testcontainers).
 *
 * These tests verify that the QZPayBilling API works correctly with the
 * DrizzleStorageAdapter without any mocks.
 */
import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '../../src/adapter/index.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Core + Drizzle Integration', () => {
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

    describe('Customer Lifecycle', () => {
        it('should create, read, update, and delete a customer', async () => {
            // Create
            const customer = await billing.customers.create({
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test User',
                metadata: { source: 'integration-test' }
            });

            expect(customer.id).toBeDefined();
            expect(customer.externalId).toBe('user_123');
            expect(customer.email).toBe('test@example.com');

            // Read
            const fetched = await billing.customers.get(customer.id);
            expect(fetched).not.toBeNull();
            expect(fetched?.id).toBe(customer.id);

            // Read by external ID
            const byExternal = await billing.customers.getByExternalId('user_123');
            expect(byExternal).not.toBeNull();
            expect(byExternal?.id).toBe(customer.id);

            // Update
            const updated = await billing.customers.update(customer.id, {
                name: 'Updated User',
                metadata: { source: 'integration-test', updated: true }
            });
            expect(updated.name).toBe('Updated User');

            // Delete
            await billing.customers.delete(customer.id);
            const deleted = await billing.customers.get(customer.id);
            expect(deleted).toBeNull();
        });

        it('should sync user (create or update)', async () => {
            // First sync creates
            const customer1 = await billing.customers.syncUser({
                externalId: 'sync_user_1',
                email: 'sync@example.com',
                name: 'Sync User'
            });
            expect(customer1.id).toBeDefined();

            // Second sync with same externalId should return existing
            const customer2 = await billing.customers.syncUser({
                externalId: 'sync_user_1',
                email: 'sync@example.com',
                name: 'Sync User Updated'
            });
            expect(customer2.id).toBe(customer1.id);
        });

        it('should list customers with pagination', async () => {
            // Create multiple customers
            for (let i = 0; i < 5; i++) {
                await billing.customers.create({
                    externalId: `list_user_${i}`,
                    email: `user${i}@example.com`,
                    name: `User ${i}`
                });
            }

            const page1 = await billing.customers.list({ limit: 2 });
            expect(page1.data).toHaveLength(2);
            expect(page1.total).toBe(5);
            expect(page1.hasMore).toBe(true);

            const page2 = await billing.customers.list({ limit: 2, offset: 2 });
            expect(page2.data).toHaveLength(2);
        });
    });

    describe('Subscription Lifecycle', () => {
        let customerId: string;
        let planId: string;
        let _priceId: string;

        beforeEach(async () => {
            // Create customer
            const customer = await billing.customers.create({
                externalId: 'sub_customer',
                email: 'subscription@example.com',
                name: 'Subscription Customer'
            });
            customerId = customer.id;

            // Create plan
            const plan = await storageAdapter.plans.create({
                name: 'Pro Plan',
                description: 'Professional features',
                active: true,
                features: ['feature1', 'feature2'],
                entitlements: ['pro_features'],
                limits: { api_calls: 1000 },
                livemode: true
            });
            planId = plan.id;

            // Create price
            const price = await storageAdapter.prices.create({
                planId: plan.id,
                currency: 'usd',
                unitAmount: 2999,
                billingInterval: 'month',
                active: true,
                livemode: true
            });
            _priceId = price.id;
        });

        it('should create a subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            expect(subscription.id).toBeDefined();
            expect(subscription.customerId).toBe(customerId);
            expect(subscription.planId).toBe(planId);
            expect(subscription.status).toBe('active');
        });

        it('should create a subscription with trial', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId,
                trialDays: 14
            });

            expect(subscription.status).toBe('trialing');
            expect(subscription.trialEnd).not.toBeNull();
        });

        it('should get subscription by ID', async () => {
            const created = await billing.subscriptions.create({
                customerId,
                planId
            });

            const fetched = await billing.subscriptions.get(created.id);
            expect(fetched).not.toBeNull();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get subscriptions by customer ID', async () => {
            await billing.subscriptions.create({ customerId, planId });

            const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
            expect(subscriptions).toHaveLength(1);
            expect(subscriptions[0].customerId).toBe(customerId);
        });

        it('should cancel a subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            const canceled = await billing.subscriptions.cancel(subscription.id);
            expect(canceled.status).toBe('canceled');
        });

        it('should cancel subscription at period end', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            const canceled = await billing.subscriptions.cancel(subscription.id, {
                cancelAtPeriodEnd: true
            });
            // When canceling at period end, subscription stays active
            expect(canceled.status).toBe('active');
            // The cancellation request time is recorded in canceledAt
            expect(canceled.canceledAt).not.toBeNull();
        });

        it('should pause and resume a subscription', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            const paused = await billing.subscriptions.pause(subscription.id);
            expect(paused.status).toBe('paused');

            const resumed = await billing.subscriptions.resume(subscription.id);
            expect(resumed.status).toBe('active');
        });
    });

    describe('Payment Flow', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'payment_customer',
                email: 'payment@example.com',
                name: 'Payment Customer'
            });
            customerId = customer.id;
        });

        it('should process a payment', async () => {
            const payment = await billing.payments.process({
                customerId,
                amount: 5000,
                currency: 'usd'
            });

            expect(payment.id).toBeDefined();
            expect(payment.customerId).toBe(customerId);
            expect(payment.amount).toBe(5000);
            expect(payment.currency).toBe('usd');
            // Without payment adapter, status is 'pending' (payment recorded but not processed)
            // Provider-specific tests (Stripe/MercadoPago) test actual payment processing
            expect(payment.status).toBe('pending');
        });

        it('should get payment by ID', async () => {
            const created = await billing.payments.process({
                customerId,
                amount: 2500,
                currency: 'usd'
            });

            const fetched = await billing.payments.get(created.id);
            expect(fetched).not.toBeNull();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get payments by customer ID', async () => {
            await billing.payments.process({ customerId, amount: 1000, currency: 'usd' });
            await billing.payments.process({ customerId, amount: 2000, currency: 'usd' });

            const payments = await billing.payments.getByCustomerId(customerId);
            expect(payments).toHaveLength(2);
        });

        it('should refund a payment', async () => {
            const payment = await billing.payments.process({
                customerId,
                amount: 5000,
                currency: 'usd'
            });

            const refunded = await billing.payments.refund({
                paymentId: payment.id,
                amount: 2500,
                reason: 'Customer request'
            });

            // Refund is recorded in metadata
            expect(refunded.metadata?.refundedAmount).toBe(2500);
        });

        it('should full refund a payment', async () => {
            const payment = await billing.payments.process({
                customerId,
                amount: 5000,
                currency: 'usd'
            });

            const refunded = await billing.payments.refund({
                paymentId: payment.id
            });

            expect(refunded.metadata?.refundedAmount).toBe(5000);
            expect(refunded.status).toBe('refunded');
        });
    });

    describe('Invoice Flow', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'invoice_customer',
                email: 'invoice@example.com',
                name: 'Invoice Customer'
            });
            customerId = customer.id;
        });

        it('should create an invoice', async () => {
            const invoice = await billing.invoices.create({
                customerId,
                lines: [{ description: 'Pro Plan - Monthly', quantity: 1, unitAmount: 2999 }]
            });

            expect(invoice.id).toBeDefined();
            expect(invoice.customerId).toBe(customerId);
            expect(invoice.status).toBe('draft');
            expect(invoice.total).toBe(2999);
        });

        it('should create invoice with multiple lines', async () => {
            const invoice = await billing.invoices.create({
                customerId,
                lines: [
                    { description: 'Base Plan', quantity: 1, unitAmount: 1999 },
                    { description: 'Add-on Feature', quantity: 2, unitAmount: 500 }
                ]
            });

            expect(invoice.total).toBe(1999 + 2 * 500);
        });

        it('should get invoice by ID', async () => {
            const created = await billing.invoices.create({
                customerId,
                lines: [{ description: 'Service', quantity: 1, unitAmount: 999 }]
            });

            const fetched = await billing.invoices.get(created.id);
            expect(fetched).not.toBeNull();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get invoices by customer ID', async () => {
            await billing.invoices.create({
                customerId,
                lines: [{ description: 'Invoice 1', quantity: 1, unitAmount: 100 }]
            });
            await billing.invoices.create({
                customerId,
                lines: [{ description: 'Invoice 2', quantity: 1, unitAmount: 200 }]
            });

            const invoices = await billing.invoices.getByCustomerId(customerId);
            expect(invoices).toHaveLength(2);
        });

        it('should mark invoice as paid', async () => {
            const invoice = await billing.invoices.create({
                customerId,
                lines: [{ description: 'Service', quantity: 1, unitAmount: 999 }]
            });

            const paid = await billing.invoices.markPaid(invoice.id);
            expect(paid.status).toBe('paid');
            expect(paid.paidAt).not.toBeNull();
        });
    });

    describe('Entitlements', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'entitlement_customer',
                email: 'entitlement@example.com',
                name: 'Entitlement Customer'
            });
            customerId = customer.id;
        });

        it('should grant entitlement to customer', async () => {
            const entitlement = await billing.entitlements.grant(customerId, 'premium_features');

            expect(entitlement.customerId).toBe(customerId);
            expect(entitlement.entitlementKey).toBe('premium_features');
        });

        it('should check if customer has entitlement', async () => {
            await billing.entitlements.grant(customerId, 'api_access');

            const hasAccess = await billing.entitlements.check(customerId, 'api_access');
            expect(hasAccess).toBe(true);

            const noAccess = await billing.entitlements.check(customerId, 'nonexistent');
            expect(noAccess).toBe(false);
        });

        it('should revoke entitlement', async () => {
            await billing.entitlements.grant(customerId, 'temp_feature');

            const hasBefore = await billing.entitlements.check(customerId, 'temp_feature');
            expect(hasBefore).toBe(true);

            await billing.entitlements.revoke(customerId, 'temp_feature');

            const hasAfter = await billing.entitlements.check(customerId, 'temp_feature');
            expect(hasAfter).toBe(false);
        });

        it('should get all entitlements for customer', async () => {
            await billing.entitlements.grant(customerId, 'feature1');
            await billing.entitlements.grant(customerId, 'feature2');

            const entitlements = await billing.entitlements.getByCustomerId(customerId);
            expect(entitlements).toHaveLength(2);
        });
    });

    describe('Limits', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'limit_customer',
                email: 'limit@example.com',
                name: 'Limit Customer'
            });
            customerId = customer.id;
        });

        it('should set limit for customer', async () => {
            const limit = await billing.limits.set(customerId, 'api_calls', 1000);

            expect(limit.customerId).toBe(customerId);
            expect(limit.limitKey).toBe('api_calls');
            expect(limit.maxValue).toBe(1000);
            expect(limit.currentValue).toBe(0);
        });

        it('should check limit', async () => {
            await billing.limits.set(customerId, 'storage_gb', 10);

            const result = await billing.limits.check(customerId, 'storage_gb');
            expect(result.allowed).toBe(true);
            expect(result.currentValue).toBe(0);
            expect(result.maxValue).toBe(10);
            expect(result.remaining).toBe(10);
        });

        it('should increment limit', async () => {
            await billing.limits.set(customerId, 'api_calls', 100);

            const incremented = await billing.limits.increment(customerId, 'api_calls', 10);
            expect(incremented.currentValue).toBe(10);

            const check = await billing.limits.check(customerId, 'api_calls');
            expect(check.remaining).toBe(90);
        });

        it('should prevent exceeding limit', async () => {
            await billing.limits.set(customerId, 'api_calls', 5);

            // Use up the limit
            await billing.limits.increment(customerId, 'api_calls', 5);

            const check = await billing.limits.check(customerId, 'api_calls');
            expect(check.allowed).toBe(false);
            expect(check.remaining).toBe(0);
        });

        it('should get all limits for customer', async () => {
            await billing.limits.set(customerId, 'limit1', 100);
            await billing.limits.set(customerId, 'limit2', 200);

            const limits = await billing.limits.getByCustomerId(customerId);
            expect(limits).toHaveLength(2);
        });
    });

    describe('Promo Codes', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            const customer = await billing.customers.create({
                externalId: 'promo_customer',
                email: 'promo@example.com',
                name: 'Promo Customer'
            });
            customerId = customer.id;

            const plan = await storageAdapter.plans.create({
                name: 'Standard Plan',
                active: true,
                livemode: true
            });
            planId = plan.id;
        });

        it('should validate promo code', async () => {
            // Use the Core API format for promo code creation
            await storageAdapter.promoCodes.create({
                id: crypto.randomUUID(),
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            // validate() takes positional args: (code, customerId?, planId?)
            const result = await billing.promoCodes.validate('SAVE20', customerId, planId);

            expect(result.valid).toBe(true);
            expect(result.promoCode?.code).toBe('SAVE20');
        });

        it('should reject invalid promo code', async () => {
            // validate() takes positional args: (code, customerId?, planId?)
            const result = await billing.promoCodes.validate('INVALID', customerId, planId);

            expect(result.valid).toBe(false);
            // The API uses 'error' not 'reason'
            expect(result.error).toBeDefined();
            expect(result.error).toBe('Promo code not found');
        });

        it('should return percentage discount info on validate', async () => {
            await storageAdapter.promoCodes.create({
                id: crypto.randomUUID(),
                code: 'PERCENT25',
                discountType: 'percentage',
                discountValue: 25
            });

            const result = await billing.promoCodes.validate('PERCENT25', customerId, planId);

            expect(result.valid).toBe(true);
            expect(result.discountPercent).toBe(25);
            // Calculate discount manually: 25% of 10000 = 2500
            const amount = 10000;
            const discountPercent = result.discountPercent ?? 0;
            const discountAmount = Math.round((amount * discountPercent) / 100);
            expect(discountAmount).toBe(2500);
        });

        it('should return fixed discount amount on validate', async () => {
            await storageAdapter.promoCodes.create({
                id: crypto.randomUUID(),
                code: 'FLAT500',
                discountType: 'fixed_amount',
                discountValue: 500,
                currency: 'usd'
            });

            const result = await billing.promoCodes.validate('FLAT500', customerId, planId);

            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBe(500);
        });

        it('should apply promo code to subscription and increment redemptions', async () => {
            const promoId = crypto.randomUUID();
            await storageAdapter.promoCodes.create({
                id: promoId,
                code: 'APPLY_TEST',
                discountType: 'percentage',
                discountValue: 10
            });

            // Create a subscription to apply the promo code to
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            // Apply increments redemption count
            await billing.promoCodes.apply('APPLY_TEST', subscription.id);

            // Verify redemption was incremented
            const promoCode = await billing.promoCodes.getByCode('APPLY_TEST');
            expect(promoCode?.currentRedemptions).toBe(1);
        });
    });

    describe('Event Emission', () => {
        it('should emit events on customer create and update', async () => {
            const events: string[] = [];
            billing.on('customer.created', () => events.push('customer.created'));
            billing.on('customer.updated', () => events.push('customer.updated'));

            const customer = await billing.customers.create({
                externalId: 'event_customer',
                email: 'event@example.com',
                name: 'Event Customer'
            });

            await billing.customers.update(customer.id, { name: 'Updated' });

            expect(events).toContain('customer.created');
            expect(events).toContain('customer.updated');
        });

        it('should emit events on subscription operations', async () => {
            const events: string[] = [];
            billing.on('subscription.created', () => events.push('subscription.created'));
            billing.on('subscription.canceled', () => events.push('subscription.canceled'));

            const customer = await billing.customers.create({
                externalId: 'sub_event_customer',
                email: 'subevent@example.com',
                name: 'Sub Event Customer'
            });

            const plan = await storageAdapter.plans.create({
                name: 'Event Plan',
                active: true,
                livemode: true
            });

            const sub = await billing.subscriptions.create({
                customerId: customer.id,
                planId: plan.id
            });

            await billing.subscriptions.cancel(sub.id);

            expect(events).toContain('subscription.created');
            expect(events).toContain('subscription.canceled');
        });

        it('should emit events on payment refund', async () => {
            const events: string[] = [];
            billing.on('payment.refunded', () => events.push('payment.refunded'));

            const customer = await billing.customers.create({
                externalId: 'pay_event_customer',
                email: 'payevent@example.com',
                name: 'Pay Event Customer'
            });

            const payment = await billing.payments.process({
                customerId: customer.id,
                amount: 1000,
                currency: 'usd'
            });

            await billing.payments.refund({ paymentId: payment.id });

            expect(events).toContain('payment.refunded');
        });
    });

    describe('Complete Billing Flow', () => {
        it('should complete full customer lifecycle: signup -> subscribe -> pay -> invoice', async () => {
            // 1. Create customer
            const customer = await billing.customers.create({
                externalId: 'full_flow_customer',
                email: 'fullflow@example.com',
                name: 'Full Flow Customer'
            });

            // 2. Create plan and price
            const plan = await storageAdapter.plans.create({
                name: 'Premium Plan',
                active: true,
                entitlements: ['premium_access'],
                limits: { api_calls: 10000 },
                livemode: true
            });

            await storageAdapter.prices.create({
                planId: plan.id,
                currency: 'usd',
                unitAmount: 4999,
                billingInterval: 'month',
                active: true,
                livemode: true
            });

            // 3. Grant entitlements and set limits (using correct API)
            await billing.entitlements.grant(customer.id, 'premium_access');
            await billing.limits.set(customer.id, 'api_calls', 10000);

            // 4. Create subscription
            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: plan.id
            });

            expect(subscription.status).toBe('active');

            // 5. Create invoice
            const invoice = await billing.invoices.create({
                customerId: customer.id,
                subscriptionId: subscription.id,
                lines: [{ description: 'Premium Plan - Monthly', quantity: 1, unitAmount: 4999 }]
            });

            expect(invoice.total).toBe(4999);

            // 6. Process payment
            // Note: Without a payment adapter, payment stays 'pending'
            // This tests the storage layer correctly records the payment
            const payment = await billing.payments.process({
                customerId: customer.id,
                amount: invoice.total,
                currency: 'usd',
                invoiceId: invoice.id,
                subscriptionId: subscription.id
            });

            // Without payment adapter, status is 'pending' (correct behavior)
            // Payment processing with actual providers is tested in provider-specific tests
            expect(payment.status).toBe('pending');
            expect(payment.amount).toBe(4999);
            expect(payment.customerId).toBe(customer.id);
            expect(payment.invoiceId).toBe(invoice.id);

            // 7. Mark invoice as paid (simulates manual confirmation or webhook)
            const paidInvoice = await billing.invoices.markPaid(invoice.id);
            expect(paidInvoice.status).toBe('paid');

            // 8. Verify entitlements
            const hasPremium = await billing.entitlements.check(customer.id, 'premium_access');
            expect(hasPremium).toBe(true);

            // 9. Use some API calls
            await billing.limits.increment(customer.id, 'api_calls', 100);
            const limitCheck = await billing.limits.check(customer.id, 'api_calls');
            expect(limitCheck.currentValue).toBe(100);
            expect(limitCheck.remaining).toBe(9900);

            // 10. Cancel subscription
            const canceledSub = await billing.subscriptions.cancel(subscription.id);
            expect(canceledSub.status).toBe('canceled');
        });
    });
});
