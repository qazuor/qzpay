/**
 * Memory Storage Adapter Tests - Advanced Features
 * Tests for remaining coverage gaps
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorageAdapter } from '../src/adapters/memory-storage.adapter.js';

describe('adapter.addons - advanced operations', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('update', () => {
        it('should update an addon', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            const updated = await adapter.addons.update(addon.id, {
                name: 'Updated Storage',
                unitAmount: 600
            });

            expect(updated.name).toBe('Updated Storage');
            expect(updated.unitAmount).toBe(600);
        });

        it('should throw error for non-existent addon', async () => {
            await expect(
                adapter.addons.update('nonexistent', {
                    name: 'Test'
                })
            ).rejects.toThrow('Add-on nonexistent not found');
        });
    });

    describe('delete', () => {
        it('should delete an addon', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            await adapter.addons.delete(addon.id);

            const result = await adapter.addons.findById(addon.id);
            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find addon by ID', async () => {
            const addon = await adapter.addons.create({
                id: 'addon_123',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            const found = await adapter.addons.findById(addon.id);

            expect(found?.id).toBe(addon.id);
        });

        it('should return null for non-existent addon', async () => {
            const result = await adapter.addons.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('findByPlanId', () => {
        it('should find addons compatible with plan', async () => {
            await adapter.addons.create({
                id: 'addon_1',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month',
                compatiblePlanIds: ['plan_123']
            });

            await adapter.addons.create({
                id: 'addon_2',
                name: 'Priority Support',
                unitAmount: 1000,
                currency: 'USD',
                billingInterval: 'month',
                compatiblePlanIds: ['plan_123', 'plan_456']
            });

            const addons = await adapter.addons.findByPlanId('plan_123');

            expect(addons).toHaveLength(2);
        });
    });

    describe('list', () => {
        it('should list all addons', async () => {
            await adapter.addons.create({
                id: 'addon_1',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });

            const result = await adapter.addons.list();

            expect(result.data).toHaveLength(1);
        });
    });

    describe('removeFromSubscription', () => {
        it('should remove addon from subscription', async () => {
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

            await adapter.addons.removeFromSubscription('sub_123', addon.id);

            const addons = await adapter.addons.findBySubscriptionId('sub_123');
            expect(addons).toHaveLength(0);
        });
    });

    describe('updateSubscriptionAddOn', () => {
        it('should update subscription addon', async () => {
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

            const updated = await adapter.addons.updateSubscriptionAddOn('sub_123', addon.id, {
                quantity: 2
            });

            expect(updated.quantity).toBe(2);
        });

        it('should throw error for non-existent subscription addon', async () => {
            await expect(
                adapter.addons.updateSubscriptionAddOn('sub_123', 'addon_123', {
                    quantity: 2
                })
            ).rejects.toThrow('Subscription add-on not found');
        });
    });

    describe('findSubscriptionAddOn', () => {
        it('should find specific subscription addon', async () => {
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

            const found = await adapter.addons.findSubscriptionAddOn('sub_123', addon.id);

            expect(found?.addOnId).toBe(addon.id);
        });

        it('should return null for non-existent subscription addon', async () => {
            const result = await adapter.addons.findSubscriptionAddOn('sub_123', 'addon_123');

            expect(result).toBeNull();
        });
    });
});

describe('adapter.vendors - advanced operations', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('update', () => {
        it('should update vendor', async () => {
            const vendor = await adapter.vendors.create({
                id: 'ven_123',
                externalId: 'vendor_123',
                name: 'Vendor Inc',
                email: 'vendor@example.com'
            });

            const updated = await adapter.vendors.update(vendor.id, {
                name: 'Updated Vendor Inc',
                status: 'active'
            });

            expect(updated.name).toBe('Updated Vendor Inc');
            expect(updated.status).toBe('active');
        });

        it('should throw error for non-existent vendor', async () => {
            await expect(
                adapter.vendors.update('nonexistent', {
                    name: 'Test'
                })
            ).rejects.toThrow('Vendor nonexistent not found');
        });
    });

    describe('delete', () => {
        it('should delete vendor', async () => {
            const vendor = await adapter.vendors.create({
                id: 'ven_123',
                externalId: 'vendor_123',
                name: 'Vendor Inc',
                email: 'vendor@example.com'
            });

            await adapter.vendors.delete(vendor.id);

            const result = await adapter.vendors.findById(vendor.id);
            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find vendor by ID', async () => {
            const vendor = await adapter.vendors.create({
                id: 'ven_123',
                externalId: 'vendor_123',
                name: 'Vendor Inc',
                email: 'vendor@example.com'
            });

            const found = await adapter.vendors.findById(vendor.id);

            expect(found?.id).toBe(vendor.id);
        });

        it('should return null for non-existent vendor', async () => {
            const result = await adapter.vendors.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('list', () => {
        it('should list vendors', async () => {
            await adapter.vendors.create({
                id: 'ven_1',
                externalId: 'vendor_1',
                name: 'Vendor 1',
                email: 'vendor1@example.com'
            });

            const result = await adapter.vendors.list();

            expect(result.data).toHaveLength(1);
        });
    });

    describe('createPayout', () => {
        it('should create vendor payout', async () => {
            const now = new Date();
            const payout = await adapter.vendors.createPayout({
                id: 'payout_123',
                vendorId: 'ven_123',
                amount: 10000,
                currency: 'USD',
                status: 'pending',
                periodStart: now,
                periodEnd: now,
                providerPayoutIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            expect(payout.id).toBe('payout_123');
            expect(payout.amount).toBe(10000);
        });
    });

    describe('findPayoutsByVendorId', () => {
        it('should find payouts by vendor ID', async () => {
            const now = new Date();
            await adapter.vendors.createPayout({
                id: 'payout_1',
                vendorId: 'ven_123',
                amount: 10000,
                currency: 'USD',
                status: 'pending',
                periodStart: now,
                periodEnd: now,
                providerPayoutIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const payouts = await adapter.vendors.findPayoutsByVendorId('ven_123');

            expect(payouts).toHaveLength(1);
        });
    });
});

describe('adapter.entitlements - advanced operations', () => {
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

    describe('findDefinitionByKey', () => {
        it('should find entitlement definition by key', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_api',
                key: 'api_access',
                name: 'API Access',
                description: 'Access to API',
                createdAt: now,
                updatedAt: now
            });

            const found = await adapter.entitlements.findDefinitionByKey('api_access');

            expect(found?.key).toBe('api_access');
        });

        it('should return null for non-existent key', async () => {
            const result = await adapter.entitlements.findDefinitionByKey('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('listDefinitions', () => {
        it('should list all entitlement definitions', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_1',
                key: 'feature_1',
                name: 'Feature 1',
                description: 'Description',
                createdAt: now,
                updatedAt: now
            });

            const definitions = await adapter.entitlements.listDefinitions();

            expect(definitions).toHaveLength(1);
        });
    });

    describe('grant with expiresAt', () => {
        it('should grant entitlement with expiration', async () => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
                entitlementKey: 'api_access',
                expiresAt
            });

            expect(granted.expiresAt).toEqual(expiresAt);
        });
    });

    describe('check with expired entitlement', () => {
        it('should return false for expired entitlement', async () => {
            const now = new Date();
            const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
                entitlementKey: 'api_access',
                expiresAt: pastDate
            });

            const hasAccess = await adapter.entitlements.check(customerId, 'api_access');

            expect(hasAccess).toBe(false);
        });
    });

    describe('findByCustomerId', () => {
        it('should find all entitlements for customer', async () => {
            const now = new Date();
            await adapter.entitlements.createDefinition({
                id: 'ent_1',
                key: 'feature_1',
                name: 'Feature 1',
                description: 'Description',
                createdAt: now,
                updatedAt: now
            });

            await adapter.entitlements.grant({
                customerId,
                entitlementKey: 'feature_1'
            });

            const entitlements = await adapter.entitlements.findByCustomerId(customerId);

            expect(entitlements).toHaveLength(1);
        });
    });
});

describe('adapter.limits - advanced operations', () => {
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

    describe('findDefinitionByKey', () => {
        it('should find limit definition by key', async () => {
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

            const found = await adapter.limits.findDefinitionByKey('projects');

            expect(found?.key).toBe('projects');
        });

        it('should return null for non-existent key', async () => {
            const result = await adapter.limits.findDefinitionByKey('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('listDefinitions', () => {
        it('should list all limit definitions', async () => {
            const now = new Date();
            await adapter.limits.createDefinition({
                id: 'lim_1',
                key: 'limit_1',
                name: 'Limit 1',
                description: 'Description',
                unit: 'units',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            const definitions = await adapter.limits.listDefinitions();

            expect(definitions).toHaveLength(1);
        });
    });

    describe('increment with custom amount', () => {
        it('should increment by custom amount', async () => {
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
                limitKey: 'projects',
                incrementBy: 5
            });

            expect(incremented.currentValue).toBe(5);
        });

        it('should throw error for non-existent limit', async () => {
            await expect(
                adapter.limits.increment({
                    customerId,
                    limitKey: 'nonexistent'
                })
            ).rejects.toThrow();
        });
    });

    describe('findByCustomerId', () => {
        it('should find all limits for customer', async () => {
            const now = new Date();
            await adapter.limits.createDefinition({
                id: 'lim_1',
                key: 'limit_1',
                name: 'Limit 1',
                description: 'Description',
                unit: 'units',
                defaultValue: 1,
                createdAt: now,
                updatedAt: now
            });

            await adapter.limits.set({
                customerId,
                limitKey: 'limit_1',
                maxValue: 10
            });

            const limits = await adapter.limits.findByCustomerId(customerId);

            expect(limits).toHaveLength(1);
        });
    });

    describe('recordUsage', () => {
        it('should record usage', async () => {
            const now = new Date();
            const usage = await adapter.limits.recordUsage({
                id: 'usage_123',
                customerId,
                limitKey: 'api_calls',
                value: 100,
                timestamp: now,
                metadata: {},
                createdAt: now
            });

            expect(usage.id).toBe('usage_123');
            expect(usage.value).toBe(100);
        });
    });
});

describe('adapter.promoCodes - advanced operations', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('update', () => {
        it('should update promo code', async () => {
            const promo = await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            const updated = await adapter.promoCodes.update(promo.id, {
                active: false
            });

            expect(updated.active).toBe(false);
        });

        it('should throw error for non-existent promo code', async () => {
            await expect(
                adapter.promoCodes.update('nonexistent', {
                    active: false
                })
            ).rejects.toThrow('Promo code nonexistent not found');
        });
    });

    describe('delete', () => {
        it('should delete promo code', async () => {
            const promo = await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            await adapter.promoCodes.delete(promo.id);

            const result = await adapter.promoCodes.findById(promo.id);
            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find promo code by ID', async () => {
            const promo = await adapter.promoCodes.create({
                id: 'promo_123',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            const found = await adapter.promoCodes.findById(promo.id);

            expect(found?.id).toBe(promo.id);
        });

        it('should return null for non-existent ID', async () => {
            const result = await adapter.promoCodes.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('list', () => {
        it('should list promo codes', async () => {
            await adapter.promoCodes.create({
                id: 'promo_1',
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20
            });

            const result = await adapter.promoCodes.list();

            expect(result.data).toHaveLength(1);
        });
    });
});

describe('adapter - additional operations', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('subscriptions.delete', () => {
        it('should delete subscription', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId: customer.id,
                planId: 'plan_123'
            });

            await adapter.subscriptions.delete(subscription.id);

            const result = await adapter.subscriptions.findById(subscription.id);
            expect(result).toBeNull();
        });
    });

    describe('payments.findById', () => {
        it('should find payment by ID', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const now = new Date();
            const payment = await adapter.payments.create({
                id: 'pay_123',
                customerId: customer.id,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const found = await adapter.payments.findById(payment.id);

            expect(found?.id).toBe(payment.id);
        });

        it('should return null for non-existent payment', async () => {
            const result = await adapter.payments.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('payments.list', () => {
        it('should list payments', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const now = new Date();
            await adapter.payments.create({
                id: 'pay_1',
                customerId: customer.id,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const result = await adapter.payments.list();

            expect(result.data).toHaveLength(1);
        });
    });

    describe('paymentMethods - error cases', () => {
        it('should throw error when updating non-existent payment method', async () => {
            await expect(adapter.paymentMethods.update('nonexistent', {})).rejects.toThrow('Payment method nonexistent not found');
        });

        it('should return null for non-existent payment method', async () => {
            const result = await adapter.paymentMethods.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null for default payment method when none exists', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const result = await adapter.paymentMethods.findDefaultByCustomerId(customer.id);

            expect(result).toBeNull();
        });

        it('should list payment methods', async () => {
            const result = await adapter.paymentMethods.list();

            expect(result.data).toHaveLength(0);
        });
    });

    describe('invoices - error cases', () => {
        it('should throw error when updating non-existent invoice', async () => {
            await expect(adapter.invoices.update('nonexistent', {})).rejects.toThrow('Invoice nonexistent not found');
        });

        it('should return null for non-existent invoice', async () => {
            const result = await adapter.invoices.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should list invoices', async () => {
            const result = await adapter.invoices.list();

            expect(result.data).toHaveLength(0);
        });
    });

    describe('plans - error cases', () => {
        it('should throw error when updating non-existent plan', async () => {
            await expect(adapter.plans.update('nonexistent', {})).rejects.toThrow('Plan nonexistent not found');
        });

        it('should return null for non-existent plan', async () => {
            const result = await adapter.plans.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should list plans', async () => {
            const result = await adapter.plans.list();

            expect(result.data).toHaveLength(0);
        });
    });

    describe('prices - error cases', () => {
        it('should throw error when updating non-existent price', async () => {
            await expect(adapter.prices.update('nonexistent', {})).rejects.toThrow('Price nonexistent not found');
        });

        it('should return null for non-existent price', async () => {
            const result = await adapter.prices.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should list prices', async () => {
            const result = await adapter.prices.list();

            expect(result.data).toHaveLength(0);
        });
    });
});
