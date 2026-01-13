/**
 * Memory Storage Adapter Tests - Other Entities
 * Tests for subscriptions, payments, payment methods, invoices, plans, prices, etc.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorageAdapter } from '../src/adapters/memory-storage.adapter.js';

describe('adapter.subscriptions', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('create', () => {
        it('should create a subscription', async () => {
            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId,
                planId: 'plan_123'
            });

            expect(subscription.id).toBe('sub_123');
            expect(subscription.customerId).toBe(customerId);
            expect(subscription.planId).toBe('plan_123');
            expect(subscription.status).toBe('active');
            expect(subscription.quantity).toBe(1);
        });

        it('should create subscription with trial', async () => {
            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId,
                planId: 'plan_123',
                trialDays: 14
            });

            expect(subscription.status).toBe('trialing');
            expect(subscription.trialStart).toBeInstanceOf(Date);
            expect(subscription.trialEnd).toBeInstanceOf(Date);
        });

        it('should create subscription with custom quantity', async () => {
            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId,
                planId: 'plan_123',
                quantity: 5
            });

            expect(subscription.quantity).toBe(5);
        });
    });

    describe('update', () => {
        it('should update subscription', async () => {
            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId,
                planId: 'plan_123'
            });

            const updated = await adapter.subscriptions.update(subscription.id, {
                status: 'canceled'
            });

            expect(updated.status).toBe('canceled');
        });
    });

    describe('findByCustomerId', () => {
        it('should find subscriptions by customer ID', async () => {
            await adapter.subscriptions.create({
                id: 'sub_1',
                customerId,
                planId: 'plan_123'
            });

            await adapter.subscriptions.create({
                id: 'sub_2',
                customerId,
                planId: 'plan_456'
            });

            const subscriptions = await adapter.subscriptions.findByCustomerId(customerId);

            expect(subscriptions).toHaveLength(2);
        });
    });

    describe('list', () => {
        it('should list subscriptions', async () => {
            await adapter.subscriptions.create({
                id: 'sub_1',
                customerId,
                planId: 'plan_123'
            });

            const result = await adapter.subscriptions.list();

            expect(result.data).toHaveLength(1);
        });
    });
});

describe('adapter.payments', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('create', () => {
        it('should create a payment', async () => {
            const now = new Date();
            const payment = await adapter.payments.create({
                id: 'pay_123',
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            expect(payment.id).toBe('pay_123');
            expect(payment.amount).toBe(1000);
        });
    });

    describe('update', () => {
        it('should update payment', async () => {
            const now = new Date();
            const payment = await adapter.payments.create({
                id: 'pay_123',
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'pending',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const updated = await adapter.payments.update(payment.id, {
                status: 'succeeded'
            });

            expect(updated.status).toBe('succeeded');
        });
    });

    describe('findByCustomerId', () => {
        it('should find payments by customer ID', async () => {
            const now = new Date();
            await adapter.payments.create({
                id: 'pay_1',
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const payments = await adapter.payments.findByCustomerId(customerId);

            expect(payments).toHaveLength(1);
        });
    });
});

describe('adapter.paymentMethods', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('create', () => {
        it('should create a payment method', async () => {
            const pm = await adapter.paymentMethods.create({
                id: 'pm_123',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_123'
            });

            expect(pm.id).toBe('pm_123');
            expect(pm.type).toBe('card');
        });

        it('should create payment method with billing details', async () => {
            const pm = await adapter.paymentMethods.create({
                id: 'pm_123',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_123',
                billingDetails: {
                    name: 'John Doe',
                    email: 'john@example.com'
                }
            });

            expect(pm.billingDetails?.name).toBe('John Doe');
            expect(pm.billingDetails?.email).toBe('john@example.com');
        });
    });

    describe('update', () => {
        it('should update payment method', async () => {
            const pm = await adapter.paymentMethods.create({
                id: 'pm_123',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_123'
            });

            const updated = await adapter.paymentMethods.update(pm.id, {
                metadata: { updated: 'true' }
            });

            expect(updated.metadata).toEqual({ updated: 'true' });
        });
    });

    describe('setDefault', () => {
        it('should set payment method as default', async () => {
            const _pm1 = await adapter.paymentMethods.create({
                id: 'pm_1',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_1',
                setAsDefault: true
            });

            const pm2 = await adapter.paymentMethods.create({
                id: 'pm_2',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_2'
            });

            await adapter.paymentMethods.setDefault(customerId, pm2.id);

            const defaultPm = await adapter.paymentMethods.findDefaultByCustomerId(customerId);
            expect(defaultPm?.id).toBe('pm_2');
        });
    });

    describe('findByCustomerId', () => {
        it('should find payment methods by customer ID', async () => {
            await adapter.paymentMethods.create({
                id: 'pm_1',
                customerId,
                type: 'card',
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_1'
            });

            const pms = await adapter.paymentMethods.findByCustomerId(customerId);

            expect(pms).toHaveLength(1);
        });
    });
});

describe('adapter.invoices', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('create', () => {
        it('should create an invoice', async () => {
            const invoice = await adapter.invoices.create({
                id: 'inv_123',
                customerId,
                lines: [
                    {
                        description: 'Pro Plan',
                        quantity: 1,
                        unitAmount: 1900
                    }
                ]
            });

            expect(invoice.id).toBe('inv_123');
            expect(invoice.lines).toHaveLength(1);
            expect(invoice.subtotal).toBe(1900);
            expect(invoice.total).toBe(1900);
        });

        it('should calculate totals correctly', async () => {
            const invoice = await adapter.invoices.create({
                id: 'inv_123',
                customerId,
                lines: [
                    {
                        description: 'Item 1',
                        quantity: 2,
                        unitAmount: 1000
                    },
                    {
                        description: 'Item 2',
                        quantity: 1,
                        unitAmount: 500
                    }
                ]
            });

            expect(invoice.subtotal).toBe(2500);
        });
    });

    describe('update', () => {
        it('should update invoice', async () => {
            const invoice = await adapter.invoices.create({
                id: 'inv_123',
                customerId,
                lines: [
                    {
                        description: 'Pro Plan',
                        quantity: 1,
                        unitAmount: 1900
                    }
                ]
            });

            const updated = await adapter.invoices.update(invoice.id, {
                status: 'paid'
            });

            expect(updated.status).toBe('paid');
        });
    });

    describe('findByCustomerId', () => {
        it('should find invoices by customer ID', async () => {
            await adapter.invoices.create({
                id: 'inv_1',
                customerId,
                lines: [
                    {
                        description: 'Pro Plan',
                        quantity: 1,
                        unitAmount: 1900
                    }
                ]
            });

            const invoices = await adapter.invoices.findByCustomerId(customerId);

            expect(invoices).toHaveLength(1);
        });
    });
});

describe('adapter.plans', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('create', () => {
        it('should create a plan', async () => {
            const plan = await adapter.plans.create({
                id: 'plan_123',
                name: 'Pro Plan'
            });

            expect(plan.id).toBe('plan_123');
            expect(plan.name).toBe('Pro Plan');
            expect(plan.active).toBe(true);
        });
    });

    describe('update', () => {
        it('should update plan', async () => {
            const plan = await adapter.plans.create({
                id: 'plan_123',
                name: 'Pro Plan'
            });

            const updated = await adapter.plans.update(plan.id, {
                active: false
            });

            expect(updated.active).toBe(false);
        });
    });
});

describe('adapter.prices', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let planId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const plan = await adapter.plans.create({
            id: 'plan_123',
            name: 'Pro Plan'
        });
        planId = plan.id;
    });

    describe('create', () => {
        it('should create a price', async () => {
            const price = await adapter.prices.create({
                id: 'price_123',
                planId,
                currency: 'USD',
                unitAmount: 1900,
                billingInterval: 'month'
            });

            expect(price.id).toBe('price_123');
            expect(price.unitAmount).toBe(1900);
        });
    });

    describe('findByPlanId', () => {
        it('should find prices by plan ID', async () => {
            await adapter.prices.create({
                id: 'price_1',
                planId,
                currency: 'USD',
                unitAmount: 1900,
                billingInterval: 'month'
            });

            const prices = await adapter.prices.findByPlanId(planId);

            expect(prices).toHaveLength(1);
        });
    });
});

describe('adapter.promoCodes', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('create', () => {
        it('should create a promo code', async () => {
            const promo = await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            expect(promo.code).toBe('SAVE20');
            expect(promo.discountValue).toBe(20);
        });
    });

    describe('findByCode', () => {
        it('should find promo code by code', async () => {
            await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            const promo = await adapter.promoCodes.findByCode('SAVE20');

            expect(promo?.id).toBe('promo_123');
        });
    });

    describe('incrementRedemptions', () => {
        it('should increment redemption count', async () => {
            const promo = await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            await adapter.promoCodes.incrementRedemptions(promo.id);

            const updated = await adapter.promoCodes.findById(promo.id);
            expect(updated?.currentRedemptions).toBe(1);
        });
    });
});

describe('adapter.vendors', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('create', () => {
        it('should create a vendor', async () => {
            const vendor = await adapter.vendors.create({
                id: 'ven_123',
                externalId: 'vendor_123',
                name: 'Vendor Inc',
                email: 'vendor@example.com'
            });

            expect(vendor.name).toBe('Vendor Inc');
            expect(vendor.status).toBe('pending');
        });
    });

    describe('findByExternalId', () => {
        it('should find vendor by external ID', async () => {
            await adapter.vendors.create({
                id: 'ven_123',
                externalId: 'vendor_123',
                name: 'Vendor Inc',
                email: 'vendor@example.com'
            });

            const vendor = await adapter.vendors.findByExternalId('vendor_123');

            expect(vendor?.id).toBe('ven_123');
        });
    });
});

describe('adapter.entitlements', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('createDefinition', () => {
        it('should create entitlement definition', async () => {
            const now = new Date();
            const entitlement = await adapter.entitlements.createDefinition({
                id: 'ent_api',
                key: 'api_access',
                name: 'API Access',
                description: 'Access to API',
                createdAt: now,
                updatedAt: now
            });

            expect(entitlement.key).toBe('api_access');
        });
    });

    describe('grant', () => {
        it('should grant entitlement to customer', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_api',
                key: 'api_access',
                name: 'API Access',
                description: 'Access to API',
                createdAt: now,
                updatedAt: now
            });

            const granted = await adapter.entitlements.grant({
                customerId,
                entitlementKey: 'api_access'
            });

            expect(granted.customerId).toBe(customerId);
            expect(granted.entitlementKey).toBe('api_access');
        });
    });

    describe('check', () => {
        it('should check if customer has entitlement', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_api',
                key: 'api_access',
                name: 'API Access',
                description: 'Access to API',
                createdAt: now,
                updatedAt: now
            });

            await adapter.entitlements.grant({
                customerId,
                entitlementKey: 'api_access'
            });

            const hasAccess = await adapter.entitlements.check(customerId, 'api_access');

            expect(hasAccess).toBe(true);
        });

        it('should return false for non-granted entitlement', async () => {
            const hasAccess = await adapter.entitlements.check(customerId, 'api_access');

            expect(hasAccess).toBe(false);
        });
    });

    describe('revoke', () => {
        it('should revoke entitlement from customer', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_api',
                key: 'api_access',
                name: 'API Access',
                description: 'Access to API',
                createdAt: now,
                updatedAt: now
            });

            await adapter.entitlements.grant({
                customerId,
                entitlementKey: 'api_access'
            });

            await adapter.entitlements.revoke(customerId, 'api_access');

            const hasAccess = await adapter.entitlements.check(customerId, 'api_access');
            expect(hasAccess).toBe(false);
        });
    });
});

describe('adapter.limits', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let customerId: string;

    beforeEach(async () => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;

        const customer = await adapter.customers.create({
            externalId: 'user_123',
            email: 'test@example.com'
        });
        customerId = customer.id;
    });

    describe('createDefinition', () => {
        it('should create limit definition', async () => {
            const now = new Date();
            const limit = await adapter.limits.createDefinition({
                id: 'lim_projects',
                key: 'projects',
                name: 'Projects',
                description: 'Number of projects',
                unit: 'projects',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            expect(limit.key).toBe('projects');
        });
    });

    describe('set', () => {
        it('should set limit for customer', async () => {
            const now = new Date();
            await adapter.limits.createDefinition({
                id: 'lim_projects',
                key: 'projects',
                name: 'Projects',
                description: 'Number of projects',
                unit: 'projects',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            const limit = await adapter.limits.set({
                customerId,
                limitKey: 'projects',
                maxValue: 10
            });

            expect(limit.maxValue).toBe(10);
            expect(limit.currentValue).toBe(0);
        });
    });

    describe('increment', () => {
        it('should increment limit usage', async () => {
            const now = new Date();
            await adapter.limits.createDefinition({
                id: 'lim_projects',
                key: 'projects',
                name: 'Projects',
                description: 'Number of projects',
                unit: 'projects',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            await adapter.limits.set({
                customerId,
                limitKey: 'projects',
                maxValue: 10
            });

            const incremented = await adapter.limits.increment({
                customerId,
                limitKey: 'projects'
            });

            expect(incremented.currentValue).toBe(1);
        });
    });

    describe('check', () => {
        it('should check customer limit', async () => {
            const now = new Date();
            await adapter.limits.createDefinition({
                id: 'lim_projects',
                key: 'projects',
                name: 'Projects',
                description: 'Number of projects',
                unit: 'projects',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            await adapter.limits.set({
                customerId,
                limitKey: 'projects',
                maxValue: 10
            });

            const limit = await adapter.limits.check(customerId, 'projects');

            expect(limit?.maxValue).toBe(10);
        });
    });
});

describe('adapter.addons', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('create', () => {
        it('should create an add-on', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            expect(addon.name).toBe('Extra Storage');
            expect(addon.unitAmount).toBe(500);
        });
    });

    describe('addToSubscription', () => {
        it('should add addon to subscription', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            const subAddon = await adapter.addons.addToSubscription({
                id: 'sub_addon_123',
                subscriptionId: 'sub_123',
                addOnId: addon.id,
                quantity: 1,
                unitAmount: 500,
                currency: 'USD'
            });

            expect(subAddon.addOnId).toBe(addon.id);
            expect(subAddon.status).toBe('active');
        });
    });

    describe('findBySubscriptionId', () => {
        it('should find addons by subscription ID', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            await adapter.addons.addToSubscription({
                id: 'sub_addon_123',
                subscriptionId: 'sub_123',
                addOnId: addon.id,
                quantity: 1,
                unitAmount: 500,
                currency: 'USD'
            });

            const addons = await adapter.addons.findBySubscriptionId('sub_123');

            expect(addons).toHaveLength(1);
        });
    });
});
