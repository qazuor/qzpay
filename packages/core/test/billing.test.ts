import { describe, expect, it, vi } from 'vitest';
import type { QZPayStorageAdapter } from '../src/adapters/storage.adapter.js';
import { QZPAY_ENV_VARS, createQZPayBillingFromEnv, qzpayDetectEnvConfig, qzpayGetDetectedProviders } from '../src/billing-from-env.js';
import { createQZPayBilling } from '../src/billing.js';
import type { QZPayCustomer } from '../src/types/customer.types.js';
import type { QZPayCustomerEntitlement, QZPayEntitlementDefinition } from '../src/types/entitlements.types.js';
import type { QZPayInvoice } from '../src/types/invoice.types.js';
import type { QZPayCustomerLimit, QZPayLimitDefinition, QZPayUsageRecord } from '../src/types/limits.types.js';
import type { QZPayPayment } from '../src/types/payment.types.js';
import type { QZPayPlan } from '../src/types/plan.types.js';
import type { QZPayPrice } from '../src/types/price.types.js';
import type { QZPayPromoCode } from '../src/types/promo-code.types.js';
import type { QZPaySubscription } from '../src/types/subscription.types.js';
import type { QZPayPayout, QZPayVendor } from '../src/types/vendor.types.js';

// Mock storage adapter with full interface
function createMockStorage(): QZPayStorageAdapter {
    const customers: Map<string, QZPayCustomer> = new Map();
    const subscriptions: Map<string, QZPaySubscription> = new Map();
    const payments: Map<string, QZPayPayment> = new Map();
    const invoices: Map<string, QZPayInvoice> = new Map();
    const promoCodes: Map<string, QZPayPromoCode> = new Map();
    const entitlements: Map<string, QZPayCustomerEntitlement> = new Map();
    const limits: Map<string, QZPayCustomerLimit> = new Map();
    let idCounter = 0;

    return {
        customers: {
            create: vi.fn(async (input) => {
                const customer: QZPayCustomer = {
                    id: `cus_${++idCounter}`,
                    email: input.email,
                    name: input.name ?? null,
                    phone: input.phone ?? null,
                    externalId: input.externalId ?? '',
                    providerCustomerIds: input.providerCustomerIds ?? {},
                    metadata: input.metadata ?? {},
                    livemode: input.livemode ?? false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                };
                customers.set(customer.id, customer);
                return customer;
            }),
            findById: vi.fn(async (id) => customers.get(id) ?? null),
            findByExternalId: vi.fn(async (externalId) => {
                for (const customer of customers.values()) {
                    if (customer.externalId === externalId) {
                        return customer;
                    }
                }
                return null;
            }),
            findByEmail: vi.fn(async () => null),
            update: vi.fn(async (id, input) => {
                const customer = customers.get(id);
                if (!customer) return customer as unknown as QZPayCustomer;
                const updated = { ...customer, ...input, updatedAt: new Date() };
                customers.set(id, updated);
                return updated;
            }),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({
                data: Array.from(customers.values()),
                total: customers.size,
                limit: 100,
                offset: 0,
                hasMore: false
            }))
        },
        subscriptions: {
            create: vi.fn(async (input) => {
                const subscription: QZPaySubscription = {
                    id: input.id,
                    customerId: input.customerId,
                    planId: input.planId,
                    status: 'active',
                    interval: 'month',
                    intervalCount: 1,
                    quantity: input.quantity ?? 1,
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    trialStart: null,
                    trialEnd: null,
                    cancelAt: null,
                    canceledAt: null,
                    cancelAtPeriodEnd: false,
                    providerSubscriptionIds: {},
                    metadata: input.metadata ?? {},
                    livemode: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                };
                subscriptions.set(subscription.id, subscription);
                return subscription;
            }),
            findById: vi.fn(async (id) => subscriptions.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                return Array.from(subscriptions.values()).filter((s) => s.customerId === customerId);
            }),
            update: vi.fn(async (id, input) => {
                const subscription = subscriptions.get(id);
                if (!subscription) throw new Error('Subscription not found');
                const updated = { ...subscription, ...input, updatedAt: new Date() };
                subscriptions.set(id, updated);
                return updated;
            }),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({
                data: Array.from(subscriptions.values()),
                total: subscriptions.size,
                limit: 100,
                offset: 0,
                hasMore: false
            }))
        },
        payments: {
            create: vi.fn(async (input) => {
                payments.set(input.id, input as QZPayPayment);
                return input as QZPayPayment;
            }),
            findById: vi.fn(async (id) => payments.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                return Array.from(payments.values()).filter((p) => p.customerId === customerId);
            }),
            update: vi.fn(async (id, input) => {
                const payment = payments.get(id);
                if (!payment) throw new Error('Payment not found');
                const updated = { ...payment, ...input, updatedAt: new Date() };
                payments.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({ data: Array.from(payments.values()), total: payments.size, limit: 100, offset: 0, hasMore: false }))
        },
        invoices: {
            create: vi.fn(async (input) => {
                const invoice: QZPayInvoice = {
                    id: input.id,
                    customerId: input.customerId,
                    subscriptionId: null,
                    number: `INV-${idCounter++}`,
                    status: 'draft',
                    currency: 'USD',
                    subtotal: 0,
                    taxAmount: 0,
                    discountAmount: 0,
                    total: 0,
                    amountPaid: 0,
                    amountDue: 0,
                    lines: input.lines ?? [],
                    dueDate: null,
                    paidAt: null,
                    providerInvoiceIds: {},
                    metadata: {},
                    livemode: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                };
                invoices.set(invoice.id, invoice);
                return invoice;
            }),
            findById: vi.fn(async (id) => invoices.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                return Array.from(invoices.values()).filter((i) => i.customerId === customerId);
            }),
            update: vi.fn(async (id, input) => {
                const invoice = invoices.get(id);
                if (!invoice) throw new Error('Invoice not found');
                const updated = { ...invoice, ...input, updatedAt: new Date() };
                invoices.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({ data: Array.from(invoices.values()), total: invoices.size, limit: 100, offset: 0, hasMore: false }))
        },
        plans: {
            create: vi.fn(async () => ({}) as QZPayPlan),
            findById: vi.fn(async () => null),
            update: vi.fn(async () => ({}) as QZPayPlan),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({ data: [], total: 0, limit: 100, offset: 0, hasMore: false }))
        },
        prices: {
            create: vi.fn(async () => ({}) as QZPayPrice),
            findById: vi.fn(async () => null),
            findByPlanId: vi.fn(async () => []),
            update: vi.fn(async () => ({}) as QZPayPrice),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({ data: [], total: 0, limit: 100, offset: 0, hasMore: false }))
        },
        promoCodes: {
            create: vi.fn(async () => ({}) as QZPayPromoCode),
            findById: vi.fn(async (id) => promoCodes.get(id) ?? null),
            findByCode: vi.fn(async (code) => {
                for (const promo of promoCodes.values()) {
                    if (promo.code === code) return promo;
                }
                return null;
            }),
            update: vi.fn(async () => ({}) as QZPayPromoCode),
            delete: vi.fn(async () => {}),
            incrementRedemptions: vi.fn(async (id) => {
                const promo = promoCodes.get(id);
                if (promo) {
                    promo.currentRedemptions++;
                    promoCodes.set(id, promo);
                }
            }),
            list: vi.fn(async () => ({
                data: Array.from(promoCodes.values()),
                total: promoCodes.size,
                limit: 100,
                offset: 0,
                hasMore: false
            }))
        },
        vendors: {
            create: vi.fn(async () => ({}) as QZPayVendor),
            findById: vi.fn(async () => null),
            findByExternalId: vi.fn(async () => null),
            update: vi.fn(async () => ({}) as QZPayVendor),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({ data: [], total: 0, limit: 100, offset: 0, hasMore: false })),
            createPayout: vi.fn(async () => ({}) as QZPayPayout),
            findPayoutsByVendorId: vi.fn(async () => [])
        },
        entitlements: {
            createDefinition: vi.fn(async () => ({}) as QZPayEntitlementDefinition),
            findDefinitionByKey: vi.fn(async () => null),
            listDefinitions: vi.fn(async () => []),
            grant: vi.fn(async (input) => {
                const entitlement: QZPayCustomerEntitlement = {
                    customerId: input.customerId,
                    entitlementKey: input.entitlementKey,
                    grantedAt: new Date(),
                    expiresAt: null,
                    source: input.source ?? 'manual',
                    sourceId: null
                };
                entitlements.set(`${input.customerId}:${input.entitlementKey}`, entitlement);
                return entitlement;
            }),
            revoke: vi.fn(async (customerId, entitlementKey) => {
                entitlements.delete(`${customerId}:${entitlementKey}`);
            }),
            findByCustomerId: vi.fn(async (customerId) => {
                return Array.from(entitlements.values()).filter((e) => e.customerId === customerId);
            }),
            check: vi.fn(async (customerId, entitlementKey) => {
                return entitlements.has(`${customerId}:${entitlementKey}`);
            })
        },
        limits: {
            createDefinition: vi.fn(async () => ({}) as QZPayLimitDefinition),
            findDefinitionByKey: vi.fn(async () => null),
            listDefinitions: vi.fn(async () => []),
            set: vi.fn(async (input) => {
                const limit: QZPayCustomerLimit = {
                    customerId: input.customerId,
                    limitKey: input.limitKey,
                    maxValue: input.maxValue,
                    currentValue: 0,
                    resetAt: null,
                    source: 'manual',
                    sourceId: null
                };
                limits.set(`${input.customerId}:${input.limitKey}`, limit);
                return limit;
            }),
            increment: vi.fn(async (input) => {
                const key = `${input.customerId}:${input.limitKey}`;
                const limit = limits.get(key);
                if (!limit) {
                    const newLimit: QZPayCustomerLimit = {
                        customerId: input.customerId,
                        limitKey: input.limitKey,
                        maxValue: Number.POSITIVE_INFINITY,
                        currentValue: input.incrementBy ?? 1,
                        resetAt: null,
                        source: 'manual',
                        sourceId: null
                    };
                    limits.set(key, newLimit);
                    return newLimit;
                }
                limit.currentValue += input.incrementBy ?? 1;
                limits.set(key, limit);
                return limit;
            }),
            findByCustomerId: vi.fn(async (customerId) => {
                return Array.from(limits.values()).filter((l) => l.customerId === customerId);
            }),
            check: vi.fn(async (customerId, limitKey) => {
                return limits.get(`${customerId}:${limitKey}`) ?? null;
            }),
            recordUsage: vi.fn(async (record) => record as QZPayUsageRecord)
        },
        transaction: vi.fn(async (fn) => fn()),
        // Helper to set mock data for tests
        _setPromoCode: (promo: QZPayPromoCode) => promoCodes.set(promo.id, promo),
        _setLimit: (limit: QZPayCustomerLimit) => limits.set(`${limit.customerId}:${limit.limitKey}`, limit)
    } as unknown as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void; _setLimit: (l: QZPayCustomerLimit) => void };
}

const mockPlans: QZPayPlan[] = [
    {
        id: 'free',
        name: 'Free Plan',
        description: 'Basic features',
        active: true,
        prices: [],
        metadata: {}
    },
    {
        id: 'pro',
        name: 'Pro Plan',
        description: 'Professional features',
        active: true,
        prices: [],
        metadata: {}
    }
];

describe('createQZPayBilling', () => {
    it('should create billing instance with minimal config', () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        expect(billing).toBeDefined();
        expect(billing.customers).toBeDefined();
        expect(billing.on).toBeTypeOf('function');
    });

    it('should create billing instance with full config', () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({
            storage,
            plans: mockPlans,
            defaultCurrency: 'EUR',
            livemode: true,
            gracePeriodDays: 7,
            retryConfig: { maxRetries: 5, retryIntervalDays: 2 }
        });

        expect(billing).toBeDefined();
        expect(billing.isLivemode()).toBe(true);
    });

    describe('getPlans', () => {
        it('should return available plans', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage, plans: mockPlans });

            const plans = billing.getPlans();
            expect(plans).toHaveLength(2);
            expect(plans[0]?.id).toBe('free');
        });

        it('should return empty array when no plans configured', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage });

            expect(billing.getPlans()).toEqual([]);
        });
    });

    describe('getPlan', () => {
        it('should return plan by ID', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage, plans: mockPlans });

            const plan = billing.getPlan('pro');
            expect(plan).toBeDefined();
            expect(plan?.name).toBe('Pro Plan');
        });

        it('should return undefined for unknown plan', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage, plans: mockPlans });

            expect(billing.getPlan('unknown')).toBeUndefined();
        });
    });

    describe('isLivemode', () => {
        it('should return false by default', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage });

            expect(billing.isLivemode()).toBe(false);
        });

        it('should return configured livemode', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage, livemode: true });

            expect(billing.isLivemode()).toBe(true);
        });
    });

    describe('getStorage', () => {
        it('should return storage adapter', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage });

            expect(billing.getStorage()).toBe(storage);
        });
    });

    describe('getPaymentAdapter', () => {
        it('should return undefined when not configured', () => {
            const storage = createMockStorage();
            const billing = createQZPayBilling({ storage });

            expect(billing.getPaymentAdapter()).toBeUndefined();
        });
    });
});

describe('billing.customers', () => {
    it('should create a customer', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const customer = await billing.customers.create({
            externalId: 'user_create_1',
            email: 'test@example.com',
            name: 'Test User'
        });

        expect(customer.id).toMatch(/^cus_/);
        expect(customer.email).toBe('test@example.com');
        expect(storage.customers.create).toHaveBeenCalled();
    });

    it('should emit customer.created event', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.on('customer.created', handler);
        await billing.customers.create({ externalId: 'user_emit_1', email: 'test@example.com' });

        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'customer.created',
                data: expect.objectContaining({ email: 'test@example.com' })
            })
        );
    });

    it('should get customer by ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const created = await billing.customers.create({ externalId: 'user_get_1', email: 'test@example.com' });
        const customer = await billing.customers.get(created.id);

        expect(customer).toBeDefined();
        expect(customer?.id).toBe(created.id);
    });

    it('should update a customer', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const created = await billing.customers.create({ externalId: 'user_update_1', email: 'test@example.com' });
        billing.on('customer.updated', handler);

        const updated = await billing.customers.update(created.id, { name: 'Updated Name' });

        expect(updated?.name).toBe('Updated Name');
        expect(handler).toHaveBeenCalled();
    });

    it('should sync user (create if not exists)', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const customer = await billing.customers.syncUser({
            externalId: 'user_123',
            email: 'test@example.com',
            name: 'Test User'
        });

        expect(customer.externalId).toBe('user_123');
    });

    it('should sync user (update if exists)', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        // Create initial customer
        await billing.customers.syncUser({
            externalId: 'user_123',
            email: 'old@example.com',
            name: 'Old Name'
        });

        // Sync with new data
        const customer = await billing.customers.syncUser({
            externalId: 'user_123',
            email: 'new@example.com',
            name: 'New Name'
        });

        expect(customer.email).toBe('new@example.com');
    });

    it('should list customers', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.customers.create({ externalId: 'user_1', email: 'test1@example.com' });
        await billing.customers.create({ externalId: 'user_2', email: 'test2@example.com' });

        const result = await billing.customers.list();
        expect(result.data).toHaveLength(2);
    });
});

describe('billing.on/once/off', () => {
    it('should subscribe to events', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.on('customer.created', handler);
        await billing.customers.create({ externalId: 'user_event_1', email: 'test@example.com' });

        expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.on('customer.created', handler);
        billing.off('customer.created', handler);
        await billing.customers.create({ externalId: 'user_event_2', email: 'test@example.com' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('should handle once subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.once('customer.created', handler);
        await billing.customers.create({ externalId: 'user_once_1', email: 'test1@example.com' });
        await billing.customers.create({ externalId: 'user_once_2', email: 'test2@example.com' });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function from on()', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const unsubscribe = billing.on('customer.created', handler);
        unsubscribe();
        await billing.customers.create({ externalId: 'user_unsub_1', email: 'test@example.com' });

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('qzpayDetectEnvConfig', () => {
    it('should detect Stripe from environment', () => {
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_test_123',
            [QZPAY_ENV_VARS.STRIPE_WEBHOOK_SECRET]: 'whsec_123'
        };

        const result = qzpayDetectEnvConfig(env);

        expect(result.providers).toHaveLength(1);
        expect(result.providers[0]?.provider).toBe('stripe');
        expect(result.providers[0]?.apiKey).toBe('sk_test_123');
        expect(result.livemode).toBe(false);
    });

    it('should detect livemode from Stripe key prefix', () => {
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_live_123'
        };

        const result = qzpayDetectEnvConfig(env);
        expect(result.livemode).toBe(true);
    });

    it('should detect MercadoPago from environment', () => {
        const env = {
            [QZPAY_ENV_VARS.MERCADOPAGO_ACCESS_TOKEN]: 'TEST-123'
        };

        const result = qzpayDetectEnvConfig(env);

        expect(result.providers).toHaveLength(1);
        expect(result.providers[0]?.provider).toBe('mercadopago');
    });

    it('should detect multiple providers', () => {
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_test_123',
            [QZPAY_ENV_VARS.MERCADOPAGO_ACCESS_TOKEN]: 'TEST-123'
        };

        const result = qzpayDetectEnvConfig(env);
        expect(result.providers).toHaveLength(2);
    });

    it('should use default currency when not specified', () => {
        const result = qzpayDetectEnvConfig({});
        expect(result.defaultCurrency).toBe('USD');
    });

    it('should use configured currency', () => {
        const env = {
            [QZPAY_ENV_VARS.DEFAULT_CURRENCY]: 'EUR'
        };

        const result = qzpayDetectEnvConfig(env);
        expect(result.defaultCurrency).toBe('EUR');
    });

    it('should parse grace period days', () => {
        const env = {
            [QZPAY_ENV_VARS.GRACE_PERIOD_DAYS]: '7'
        };

        const result = qzpayDetectEnvConfig(env);
        expect(result.gracePeriodDays).toBe(7);
    });
});

describe('qzpayGetDetectedProviders', () => {
    it('should return detected providers', () => {
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_test_123'
        };

        const providers = qzpayGetDetectedProviders(env);
        expect(providers).toHaveLength(1);
        expect(providers[0]?.provider).toBe('stripe');
    });

    it('should return empty array when no providers detected', () => {
        const providers = qzpayGetDetectedProviders({});
        expect(providers).toHaveLength(0);
    });
});

describe('createQZPayBillingFromEnv', () => {
    it('should create billing instance from environment', () => {
        const storage = createMockStorage();
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_test_123'
        };

        const billing = createQZPayBillingFromEnv({
            storage,
            env,
            plans: mockPlans
        });

        expect(billing).toBeDefined();
        expect(billing.getPlans()).toHaveLength(2);
    });

    it('should respect override options', () => {
        const storage = createMockStorage();
        const env = {
            [QZPAY_ENV_VARS.STRIPE_API_KEY]: 'sk_test_123'
        };

        const billing = createQZPayBillingFromEnv({
            storage,
            env,
            livemode: true,
            defaultCurrency: 'EUR'
        });

        expect(billing.isLivemode()).toBe(true);
    });
});

// ============================================
// PHASE 3A: Core Services Tests
// ============================================

describe('billing.subscriptions', () => {
    it('should create a subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const subscription = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });

        expect(subscription.id).toBeDefined();
        expect(subscription.customerId).toBe('cus_123');
        expect(subscription.planId).toBe('pro');
        expect(storage.subscriptions.create).toHaveBeenCalled();
    });

    it('should emit subscription.created event', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });
        const handler = vi.fn();

        billing.on('subscription.created', handler);
        await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });

        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'subscription.created',
                data: expect.objectContaining({ planId: 'pro' })
            })
        );
    });

    it('should get subscription by ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });
        const subscription = await billing.subscriptions.get(created.id);

        expect(subscription).toBeDefined();
        expect(subscription?.id).toBe(created.id);
    });

    it('should get subscriptions by customer ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        await billing.subscriptions.create({ customerId: 'cus_123', planId: 'pro' });
        await billing.subscriptions.create({ customerId: 'cus_123', planId: 'free' });

        const subscriptions = await billing.subscriptions.getByCustomerId('cus_123');
        expect(subscriptions).toHaveLength(2);
    });

    it('should update a subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });
        const handler = vi.fn();

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'free'
        });

        billing.on('subscription.updated', handler);
        const updated = await billing.subscriptions.update(created.id, {
            planId: 'pro'
        });

        expect(updated.planId).toBe('pro');
        expect(handler).toHaveBeenCalled();
    });

    it('should cancel a subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });
        const handler = vi.fn();

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });

        billing.on('subscription.canceled', handler);
        const canceled = await billing.subscriptions.cancel(created.id);

        expect(canceled.status).toBe('canceled');
        expect(canceled.canceledAt).toBeDefined();
        expect(handler).toHaveBeenCalled();
    });

    it('should cancel subscription at period end', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });

        const canceled = await billing.subscriptions.cancel(created.id, {
            cancelAtPeriodEnd: true
        });

        expect(canceled.status).toBe('active'); // Status not changed yet
        expect(canceled.canceledAt).toBeDefined();
    });

    it('should pause a subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });
        const handler = vi.fn();

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });

        billing.on('subscription.paused', handler);
        const paused = await billing.subscriptions.pause(created.id);

        expect(paused.status).toBe('paused');
        expect(handler).toHaveBeenCalled();
    });

    it('should resume a paused subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });
        const handler = vi.fn();

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'pro'
        });
        await billing.subscriptions.pause(created.id);

        billing.on('subscription.resumed', handler);
        const resumed = await billing.subscriptions.resume(created.id);

        expect(resumed.status).toBe('active');
        expect(handler).toHaveBeenCalled();
    });

    it('should list subscriptions', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        await billing.subscriptions.create({ customerId: 'cus_1', planId: 'pro' });
        await billing.subscriptions.create({ customerId: 'cus_2', planId: 'free' });

        const result = await billing.subscriptions.list();
        expect(result.data).toHaveLength(2);
    });

    it('should change plan immediately with proration', async () => {
        const storage = createMockStorage();
        const freePlan: QZPayPlan = {
            id: 'free',
            name: 'Free Plan',
            description: 'Free tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_free',
                    planId: 'free',
                    currency: 'USD',
                    unitAmount: 0,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const proPlan: QZPayPlan = {
            id: 'pro',
            name: 'Pro Plan',
            description: 'Pro tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_pro',
                    planId: 'pro',
                    currency: 'USD',
                    unitAmount: 1999,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const billing = createQZPayBilling({
            storage,
            plans: [freePlan, proPlan]
        });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'free'
        });

        const result = await billing.subscriptions.changePlan(created.id, {
            newPlanId: 'pro',
            prorationBehavior: 'create_prorations'
        });

        expect(result.subscription).toBeDefined();
        expect(result.subscription.planId).toBe('pro');
        expect(result.proration).toBeDefined();
        expect(typeof result.proration?.creditAmount).toBe('number');
        expect(typeof result.proration?.chargeAmount).toBe('number');
    });

    it('should change plan at period end without proration', async () => {
        const storage = createMockStorage();
        const freePlan: QZPayPlan = {
            id: 'free',
            name: 'Free Plan',
            description: 'Free tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_free',
                    planId: 'free',
                    currency: 'USD',
                    unitAmount: 0,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const proPlan: QZPayPlan = {
            id: 'pro',
            name: 'Pro Plan',
            description: 'Pro tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_pro',
                    planId: 'pro',
                    currency: 'USD',
                    unitAmount: 1999,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const billing = createQZPayBilling({
            storage,
            plans: [freePlan, proPlan]
        });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'free'
        });

        const result = await billing.subscriptions.changePlan(created.id, {
            newPlanId: 'pro',
            applyAt: 'period_end'
        });

        expect(result.subscription).toBeDefined();
        expect(result.subscription.planId).toBe('free'); // Not changed yet
        expect(result.proration).toBeNull(); // No proration for period_end changes
        expect(result.subscription.metadata).toHaveProperty('scheduledPlanChangeNewPlanId');
    });

    it('should throw error when subscription not found', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await expect(
            billing.subscriptions.changePlan('nonexistent', {
                newPlanId: 'pro'
            })
        ).rejects.toThrow('Subscription nonexistent not found');
    });

    it('should throw error when new plan not found', async () => {
        const storage = createMockStorage();
        const freePlan: QZPayPlan = {
            id: 'free',
            name: 'Free Plan',
            description: 'Free tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_free',
                    planId: 'free',
                    currency: 'USD',
                    unitAmount: 0,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const billing = createQZPayBilling({
            storage,
            plans: [freePlan]
        });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'free'
        });

        await expect(
            billing.subscriptions.changePlan(created.id, {
                newPlanId: 'nonexistent'
            })
        ).rejects.toThrow('Plan nonexistent not found');
    });

    it('should change plan without proration when behavior is none', async () => {
        const storage = createMockStorage();
        const freePlan: QZPayPlan = {
            id: 'free',
            name: 'Free Plan',
            description: 'Free tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_free',
                    planId: 'free',
                    currency: 'USD',
                    unitAmount: 0,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const proPlan: QZPayPlan = {
            id: 'pro',
            name: 'Pro Plan',
            description: 'Pro tier',
            active: true,
            entitlements: [],
            limits: [],
            features: [],
            metadata: {},
            prices: [
                {
                    id: 'price_pro',
                    planId: 'pro',
                    currency: 'USD',
                    unitAmount: 1999,
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    trialDays: 0,
                    active: true,
                    metadata: {}
                }
            ]
        };
        const billing = createQZPayBilling({
            storage,
            plans: [freePlan, proPlan]
        });

        const created = await billing.subscriptions.create({
            customerId: 'cus_123',
            planId: 'free'
        });

        const result = await billing.subscriptions.changePlan(created.id, {
            newPlanId: 'pro',
            prorationBehavior: 'none'
        });

        expect(result.subscription.planId).toBe('pro');
        expect(result.proration).toBeNull();
    });
});

describe('billing.payments', () => {
    it('should process a payment', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const payment = await billing.payments.process({
            customerId: 'cus_123',
            amount: 9999,
            currency: 'USD'
        });

        expect(payment.id).toBeDefined();
        expect(payment.customerId).toBe('cus_123');
        expect(payment.amount).toBe(9999);
        expect(payment.status).toBe('pending');
        expect(storage.payments.create).toHaveBeenCalled();
    });

    it('should get payment by ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const created = await billing.payments.process({
            customerId: 'cus_123',
            amount: 5000,
            currency: 'USD'
        });
        const payment = await billing.payments.get(created.id);

        expect(payment).toBeDefined();
        expect(payment?.id).toBe(created.id);
    });

    it('should get payments by customer ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.payments.process({ customerId: 'cus_123', amount: 1000, currency: 'USD' });
        await billing.payments.process({ customerId: 'cus_123', amount: 2000, currency: 'USD' });

        const payments = await billing.payments.getByCustomerId('cus_123');
        expect(payments).toHaveLength(2);
    });

    it('should refund a payment', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const created = await billing.payments.process({
            customerId: 'cus_123',
            amount: 10000,
            currency: 'USD'
        });

        billing.on('payment.refunded', handler);
        const refunded = await billing.payments.refund({
            paymentId: created.id,
            amount: 5000,
            reason: 'Customer request'
        });

        expect(refunded.status).toBe('partially_refunded');
        expect(handler).toHaveBeenCalled();
    });

    it('should fully refund a payment', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const created = await billing.payments.process({
            customerId: 'cus_123',
            amount: 10000,
            currency: 'USD'
        });

        const refunded = await billing.payments.refund({
            paymentId: created.id // No amount = full refund
        });

        expect(refunded.status).toBe('refunded');
    });

    it('should throw error when refunding non-existent payment', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await expect(billing.payments.refund({ paymentId: 'non_existent' })).rejects.toThrow('Payment non_existent not found');
    });

    it('should list payments', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.payments.process({ customerId: 'cus_1', amount: 1000, currency: 'USD' });
        await billing.payments.process({ customerId: 'cus_2', amount: 2000, currency: 'EUR' });

        const result = await billing.payments.list();
        expect(result.data).toHaveLength(2);
    });
});

describe('billing.invoices', () => {
    it('should create an invoice', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.on('invoice.created', handler);
        const invoice = await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Pro Plan', quantity: 1, unitAmount: 9999 }]
        });

        expect(invoice.id).toBeDefined();
        expect(invoice.customerId).toBe('cus_123');
        expect(handler).toHaveBeenCalled();
    });

    it('should get invoice by ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const created = await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Test', quantity: 1, unitAmount: 1000 }]
        });
        const invoice = await billing.invoices.get(created.id);

        expect(invoice).toBeDefined();
        expect(invoice?.id).toBe(created.id);
    });

    it('should get invoices by customer ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Invoice 1', quantity: 1, unitAmount: 1000 }]
        });
        await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Invoice 2', quantity: 1, unitAmount: 2000 }]
        });

        const invoices = await billing.invoices.getByCustomerId('cus_123');
        expect(invoices).toHaveLength(2);
    });

    it('should mark invoice as paid', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const created = await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Test', quantity: 1, unitAmount: 1000 }]
        });

        billing.on('invoice.paid', handler);
        const paid = await billing.invoices.markPaid(created.id, 'pay_123');

        expect(paid.status).toBe('paid');
        expect(paid.paidAt).toBeDefined();
        expect(handler).toHaveBeenCalled();
    });

    it('should void an invoice', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const created = await billing.invoices.create({
            customerId: 'cus_123',
            lines: [{ description: 'Test', quantity: 1, unitAmount: 1000 }]
        });

        billing.on('invoice.voided', handler);
        const voided = await billing.invoices.void(created.id);

        expect(voided.status).toBe('void');
        expect(handler).toHaveBeenCalled();
    });

    it('should list invoices', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.invoices.create({
            customerId: 'cus_1',
            lines: [{ description: 'Inv 1', quantity: 1, unitAmount: 1000 }]
        });
        await billing.invoices.create({
            customerId: 'cus_2',
            lines: [{ description: 'Inv 2', quantity: 1, unitAmount: 2000 }]
        });

        const result = await billing.invoices.list();
        expect(result.data).toHaveLength(2);
    });
});

describe('billing.plans', () => {
    it('should get plan from config by ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const plan = await billing.plans.get('pro');
        expect(plan).toBeDefined();
        expect(plan?.name).toBe('Pro Plan');
    });

    it('should return null for non-existent plan', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const plan = await billing.plans.get('non_existent');
        expect(plan).toBeNull();
    });

    it('should get active plans', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const activePlans = await billing.plans.getActive();
        expect(activePlans.length).toBeGreaterThan(0);
        expect(activePlans.every((p) => p.active)).toBe(true);
    });

    it('should get prices for a plan', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const _prices = await billing.plans.getPrices('pro');
        expect(storage.prices.findByPlanId).toHaveBeenCalledWith('pro');
    });

    it('should list plans', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage, plans: mockPlans });

        const _result = await billing.plans.list();
        expect(storage.plans.list).toHaveBeenCalled();
    });
});

describe('billing.promoCodes', () => {
    it('should validate a valid promo code', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'SAVE20',
            discountType: 'percentage',
            discountValue: 20,
            currency: null,
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: 100,
            currentRedemptions: 10,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.promoCodes.validate('SAVE20');

        expect(result.valid).toBe(true);
        expect(result.promoCode?.code).toBe('SAVE20');
        expect(result.discountPercent).toBe(20);
    });

    it('should reject non-existent promo code', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const result = await billing.promoCodes.validate('INVALID');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Promo code not found');
    });

    it('should reject inactive promo code', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'EXPIRED',
            discountType: 'percentage',
            discountValue: 10,
            currency: null,
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: false,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.promoCodes.validate('EXPIRED');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Promo code is not active');
    });

    it('should reject expired promo code', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'OLDCODE',
            discountType: 'percentage',
            discountValue: 10,
            currency: null,
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: new Date('2020-01-01'), // Expired
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.promoCodes.validate('OLDCODE');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Promo code has expired');
    });

    it('should reject promo code at max redemptions', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'MAXED',
            discountType: 'fixed_amount',
            discountValue: 500,
            currency: 'USD',
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: 10,
            currentRedemptions: 10, // At max
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.promoCodes.validate('MAXED');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Promo code has reached max redemptions');
    });

    it('should return discount amount for fixed discount', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'FLAT10',
            discountType: 'fixed_amount',
            discountValue: 1000,
            currency: 'USD',
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.promoCodes.validate('FLAT10');

        expect(result.valid).toBe(true);
        expect(result.discountAmount).toBe(1000);
        expect(result.discountPercent).toBeUndefined();
    });

    it('should apply a promo code', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'APPLY',
            discountType: 'percentage',
            discountValue: 10,
            currency: null,
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        await billing.promoCodes.apply('APPLY', 'sub_123');

        expect(storage.promoCodes.incrementRedemptions).toHaveBeenCalledWith('promo_1');
    });

    it('should get promo code by code', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setPromoCode: (p: QZPayPromoCode) => void };
        storage._setPromoCode({
            id: 'promo_1',
            code: 'GETME',
            discountType: 'percentage',
            discountValue: 15,
            currency: null,
            stackingMode: 'none',
            conditions: [],
            maxRedemptions: null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: null,
            validFrom: null,
            validUntil: null,
            applicablePlanIds: [],
            applicableProductIds: [],
            active: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
        });

        const billing = createQZPayBilling({ storage });
        const promo = await billing.promoCodes.getByCode('GETME');

        expect(promo).toBeDefined();
        expect(promo?.discountValue).toBe(15);
    });

    it('should list promo codes', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.promoCodes.list();
        expect(storage.promoCodes.list).toHaveBeenCalled();
    });
});

describe('billing.entitlements', () => {
    it('should grant an entitlement', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const entitlement = await billing.entitlements.grant('cus_123', 'premium_features');

        expect(entitlement.customerId).toBe('cus_123');
        expect(entitlement.entitlementKey).toBe('premium_features');
        expect(entitlement.source).toBe('manual');
    });

    it('should check entitlement', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.entitlements.grant('cus_123', 'api_access');
        const hasAccess = await billing.entitlements.check('cus_123', 'api_access');

        expect(hasAccess).toBe(true);
    });

    it('should return false for missing entitlement', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const hasAccess = await billing.entitlements.check('cus_123', 'non_existent');

        expect(hasAccess).toBe(false);
    });

    it('should get entitlements by customer ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.entitlements.grant('cus_123', 'feature_a');
        await billing.entitlements.grant('cus_123', 'feature_b');

        const entitlements = await billing.entitlements.getByCustomerId('cus_123');
        expect(entitlements).toHaveLength(2);
    });

    it('should revoke an entitlement', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.entitlements.grant('cus_123', 'temp_access');
        await billing.entitlements.revoke('cus_123', 'temp_access');

        expect(storage.entitlements.revoke).toHaveBeenCalledWith('cus_123', 'temp_access');
    });
});

describe('billing.limits', () => {
    it('should set a limit', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const limit = await billing.limits.set('cus_123', 'api_calls', 1000);

        expect(limit.customerId).toBe('cus_123');
        expect(limit.limitKey).toBe('api_calls');
        expect(limit.maxValue).toBe(1000);
    });

    it('should check limit - allowed', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setLimit: (l: QZPayCustomerLimit) => void };
        storage._setLimit({
            customerId: 'cus_123',
            limitKey: 'api_calls',
            maxValue: 1000,
            currentValue: 500,
            resetAt: null,
            source: 'manual',
            sourceId: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.limits.check('cus_123', 'api_calls');

        expect(result.allowed).toBe(true);
        expect(result.currentValue).toBe(500);
        expect(result.maxValue).toBe(1000);
        expect(result.remaining).toBe(500);
    });

    it('should check limit - not allowed', async () => {
        const storage = createMockStorage() as QZPayStorageAdapter & { _setLimit: (l: QZPayCustomerLimit) => void };
        storage._setLimit({
            customerId: 'cus_123',
            limitKey: 'api_calls',
            maxValue: 1000,
            currentValue: 1000, // At limit
            resetAt: null,
            source: 'manual',
            sourceId: null
        });

        const billing = createQZPayBilling({ storage });
        const result = await billing.limits.check('cus_123', 'api_calls');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should return allowed with infinity for non-existent limit', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const result = await billing.limits.check('cus_123', 'non_existent');

        expect(result.allowed).toBe(true);
        expect(result.maxValue).toBe(Number.POSITIVE_INFINITY);
        expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
    });

    it('should increment a limit', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        const limit = await billing.limits.increment('cus_123', 'api_calls', 5);

        expect(limit.currentValue).toBe(5);
        expect(storage.limits.increment).toHaveBeenCalledWith({
            customerId: 'cus_123',
            limitKey: 'api_calls',
            incrementBy: 5
        });
    });

    it('should get limits by customer ID', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.limits.set('cus_123', 'limit_a', 100);
        await billing.limits.set('cus_123', 'limit_b', 200);

        const limits = await billing.limits.getByCustomerId('cus_123');
        expect(limits).toHaveLength(2);
    });

    it('should record usage', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.limits.recordUsage('cus_123', 'api_calls', 10);

        expect(storage.limits.recordUsage).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cus_123',
                limitKey: 'api_calls',
                quantity: 10,
                action: 'increment'
            })
        );
    });

    it('should record usage with set action', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });

        await billing.limits.recordUsage('cus_123', 'storage_gb', 50, 'set');

        expect(storage.limits.recordUsage).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'set',
                quantity: 50
            })
        );
    });
});
