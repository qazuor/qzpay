/**
 * Memory Storage Adapter Tests - Core Operations
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorageAdapter } from '../src/adapters/memory-storage.adapter.js';

describe('createMemoryStorageAdapter', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let reset: ReturnType<typeof createMemoryStorageAdapter>['reset'];
    let seed: ReturnType<typeof createMemoryStorageAdapter>['seed'];
    let getData: ReturnType<typeof createMemoryStorageAdapter>['getData'];
    let getSnapshot: ReturnType<typeof createMemoryStorageAdapter>['getSnapshot'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
        reset = storage.reset;
        seed = storage.seed;
        getData = storage.getData;
        getSnapshot = storage.getSnapshot;
    });

    describe('reset', () => {
        it('should clear all customers', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            reset();

            const result = await adapter.customers.findById(customer.id);
            expect(result).toBeNull();
        });

        it('should clear all subscriptions', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const subscription = await adapter.subscriptions.create({
                id: 'sub_123',
                customerId: customer.id,
                planId: 'plan_123'
            });

            reset();

            const result = await adapter.subscriptions.findById(subscription.id);
            expect(result).toBeNull();
        });

        it('should clear all entities', async () => {
            await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            await adapter.plans.create({
                id: 'plan_123',
                name: 'Test Plan'
            });

            reset();

            const data = getData();
            expect(data.customers.size).toBe(0);
            expect(data.subscriptions.size).toBe(0);
            expect(data.payments.size).toBe(0);
            expect(data.paymentMethods.size).toBe(0);
            expect(data.invoices.size).toBe(0);
            expect(data.plans.size).toBe(0);
            expect(data.prices.size).toBe(0);
            expect(data.promoCodes.size).toBe(0);
            expect(data.vendors.size).toBe(0);
            expect(data.vendorPayouts.size).toBe(0);
            expect(data.addons.size).toBe(0);
            expect(data.subscriptionAddons.size).toBe(0);
            expect(data.entitlementDefinitions.size).toBe(0);
            expect(data.customerEntitlements.size).toBe(0);
            expect(data.limitDefinitions.size).toBe(0);
            expect(data.customerLimits.size).toBe(0);
            expect(data.usageRecords.size).toBe(0);
        });
    });

    describe('seed', () => {
        it('should seed customers', () => {
            const now = new Date();
            seed({
                customers: {
                    cus_123: {
                        id: 'cus_123',
                        externalId: 'user_123',
                        email: 'test@example.com',
                        name: 'Test User',
                        phone: null,
                        providerCustomerIds: {},
                        metadata: {},
                        livemode: false,
                        createdAt: now,
                        updatedAt: now,
                        deletedAt: null
                    }
                }
            });

            const data = getData();
            expect(data.customers.size).toBe(1);
            expect(data.customers.get('cus_123')?.email).toBe('test@example.com');
        });

        it('should seed plans and prices', () => {
            const now = new Date();
            seed({
                plans: {
                    plan_123: {
                        id: 'plan_123',
                        name: 'Pro Plan',
                        description: 'Professional tier',
                        active: true,
                        prices: [],
                        features: [],
                        entitlements: [],
                        limits: {},
                        metadata: {},
                        createdAt: now,
                        updatedAt: now,
                        deletedAt: null
                    }
                },
                prices: {
                    price_123: {
                        id: 'price_123',
                        planId: 'plan_123',
                        nickname: 'Monthly',
                        currency: 'USD',
                        unitAmount: 1900,
                        billingInterval: 'month',
                        intervalCount: 1,
                        trialDays: null,
                        active: true,
                        providerPriceIds: {},
                        metadata: {},
                        createdAt: now,
                        updatedAt: now
                    }
                }
            });

            const data = getData();
            expect(data.plans.size).toBe(1);
            expect(data.prices.size).toBe(1);
            expect(data.prices.get('price_123')?.planId).toBe('plan_123');
        });

        it('should seed entitlements and limits', () => {
            const now = new Date();
            seed({
                entitlementDefinitions: {
                    api_access: {
                        id: 'ent_api',
                        key: 'api_access',
                        name: 'API Access',
                        description: 'Access to API',
                        createdAt: now,
                        updatedAt: now
                    }
                },
                limitDefinitions: {
                    projects: {
                        id: 'lim_projects',
                        key: 'projects',
                        name: 'Projects',
                        description: 'Number of projects',
                        unit: 'projects',
                        defaultValue: 1,
                        createdAt: now,
                        updatedAt: now
                    }
                }
            });

            const data = getData();
            expect(data.entitlementDefinitions.size).toBe(1);
            expect(data.limitDefinitions.size).toBe(1);
        });

        it('should not clear existing data', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'existing@example.com'
            });

            const now = new Date();
            seed({
                customers: {
                    cus_new: {
                        id: 'cus_new',
                        externalId: 'user_new',
                        email: 'new@example.com',
                        name: null,
                        phone: null,
                        providerCustomerIds: {},
                        metadata: {},
                        livemode: false,
                        createdAt: now,
                        updatedAt: now,
                        deletedAt: null
                    }
                }
            });

            const data = getData();
            expect(data.customers.size).toBe(2);
            expect(data.customers.has(customer.id)).toBe(true);
            expect(data.customers.has('cus_new')).toBe(true);
        });
    });

    describe('getData', () => {
        it('should return all data maps', () => {
            const data = getData();

            expect(data).toHaveProperty('customers');
            expect(data).toHaveProperty('subscriptions');
            expect(data).toHaveProperty('payments');
            expect(data).toHaveProperty('paymentMethods');
            expect(data).toHaveProperty('invoices');
            expect(data).toHaveProperty('plans');
            expect(data).toHaveProperty('prices');
            expect(data).toHaveProperty('promoCodes');
            expect(data).toHaveProperty('vendors');
            expect(data).toHaveProperty('vendorPayouts');
            expect(data).toHaveProperty('addons');
            expect(data).toHaveProperty('subscriptionAddons');
            expect(data).toHaveProperty('entitlementDefinitions');
            expect(data).toHaveProperty('customerEntitlements');
            expect(data).toHaveProperty('limitDefinitions');
            expect(data).toHaveProperty('customerLimits');
            expect(data).toHaveProperty('usageRecords');
        });

        it('should return live data', async () => {
            await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const data = getData();
            expect(data.customers.size).toBe(1);
        });
    });

    describe('getSnapshot', () => {
        it('should return serializable data', () => {
            const snapshot = getSnapshot();

            expect(snapshot).toHaveProperty('customers');
            expect(snapshot).toHaveProperty('subscriptions');
            expect(snapshot).toHaveProperty('payments');
            expect(typeof snapshot.customers).toBe('object');
        });

        it('should capture current state', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const snapshot = getSnapshot();

            expect(snapshot.customers).toBeDefined();
            expect(snapshot.customers?.[customer.id]).toBeDefined();
            expect(snapshot.customers?.[customer.id]?.email).toBe('test@example.com');
        });

        it('should be seedable', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const snapshot = getSnapshot();

            reset();

            seed(snapshot);

            const restored = await adapter.customers.findById(customer.id);
            expect(restored?.email).toBe('test@example.com');
        });
    });

    describe('transaction', () => {
        it('should execute function and return result', async () => {
            const result = await adapter.transaction(async () => {
                return 'success';
            });

            expect(result).toBe('success');
        });

        it('should propagate errors', async () => {
            await expect(
                adapter.transaction(async () => {
                    throw new Error('Transaction failed');
                })
            ).rejects.toThrow('Transaction failed');
        });

        it('should execute async operations', async () => {
            const result = await adapter.transaction(async () => {
                const customer = await adapter.customers.create({
                    externalId: 'user_123',
                    email: 'test@example.com'
                });
                return customer.id;
            });

            expect(result).toMatch(/^mock_cus_\d+$/);
        });
    });
});
