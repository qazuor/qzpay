import { describe, expect, it, vi } from 'vitest';
import type { QZPayStorageAdapter } from '../src/adapters/storage.adapter.js';
import { QZPAY_ENV_VARS, createQZPayBillingFromEnv, qzpayDetectEnvConfig, qzpayGetDetectedProviders } from '../src/billing-from-env.js';
import { createQZPayBilling } from '../src/billing.js';
import type { QZPayCustomer } from '../src/types/customer.types.js';
import type { QZPayPlan } from '../src/types/plan.types.js';

// Mock storage adapter
function createMockStorage(): QZPayStorageAdapter {
    const customers: Map<string, QZPayCustomer> = new Map();
    let idCounter = 0;

    return {
        customers: {
            create: vi.fn(async (input) => {
                const customer: QZPayCustomer = {
                    id: `cus_${++idCounter}`,
                    email: input.email,
                    name: input.name,
                    externalId: input.externalId,
                    metadata: input.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
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
                if (!customer) return null;
                const updated = { ...customer, ...input, updatedAt: new Date() };
                customers.set(id, updated);
                return updated;
            }),
            delete: vi.fn(async () => {}),
            list: vi.fn(async () => ({ data: Array.from(customers.values()), total: customers.size }))
        },
        subscriptions: {
            create: vi.fn(),
            findById: vi.fn(),
            findByCustomerId: vi.fn(),
            findActiveByCustomerId: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        invoices: {
            create: vi.fn(),
            findById: vi.fn(),
            findByCustomerId: vi.fn(),
            findBySubscriptionId: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        payments: {
            create: vi.fn(),
            findById: vi.fn(),
            findByCustomerId: vi.fn(),
            findByInvoiceId: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        promoCodes: {
            create: vi.fn(),
            findById: vi.fn(),
            findByCode: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        plans: {
            create: vi.fn(),
            findById: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        usageRecords: {
            create: vi.fn(),
            findBySubscriptionId: vi.fn(),
            aggregate: vi.fn()
        },
        vendors: {
            create: vi.fn(),
            findById: vi.fn(),
            update: vi.fn(),
            list: vi.fn()
        },
        events: {
            create: vi.fn(),
            findById: vi.fn(),
            list: vi.fn()
        }
    };
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
        await billing.customers.create({ email: 'test@example.com' });

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

        const created = await billing.customers.create({ email: 'test@example.com' });
        const customer = await billing.customers.get(created.id);

        expect(customer).toBeDefined();
        expect(customer?.id).toBe(created.id);
    });

    it('should update a customer', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const created = await billing.customers.create({ email: 'test@example.com' });
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

        await billing.customers.create({ email: 'test1@example.com' });
        await billing.customers.create({ email: 'test2@example.com' });

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
        await billing.customers.create({ email: 'test@example.com' });

        expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.on('customer.created', handler);
        billing.off('customer.created', handler);
        await billing.customers.create({ email: 'test@example.com' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('should handle once subscription', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        billing.once('customer.created', handler);
        await billing.customers.create({ email: 'test1@example.com' });
        await billing.customers.create({ email: 'test2@example.com' });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function from on()', async () => {
        const storage = createMockStorage();
        const billing = createQZPayBilling({ storage });
        const handler = vi.fn();

        const unsubscribe = billing.on('customer.created', handler);
        unsubscribe();
        await billing.customers.create({ email: 'test@example.com' });

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
