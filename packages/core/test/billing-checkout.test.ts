/**
 * Integration coverage for `billing.checkout` — the public service exposed by
 * QZPayBilling for one-time payment and subscription-authorization checkouts.
 *
 * Tests use a minimal mock storage + mock payment adapter so the orchestration
 * can be exercised end-to-end (input validation → resolve line items → local
 * persist → provider call → writeback + event emission).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QZPayPaymentAdapter, QZPayProviderCheckout, QZPayProviderCreateCheckoutInput } from '../src/adapters/payment.adapter.js';
import type { QZPayStorageAdapter } from '../src/adapters/storage.adapter.js';
import { createQZPayBilling } from '../src/billing.js';
import { QZPayProviderSyncError, QZPayValidationError } from '../src/errors/index.js';
import type { QZPayCheckoutSession, QZPayCreateCheckoutInput } from '../src/types/checkout.types.js';
import type { QZPayCustomer } from '../src/types/customer.types.js';
import type { QZPayPlan } from '../src/types/plan.types.js';

const MOCK_PROVIDER = 'mock' as const;

function buildStorage(): {
    storage: QZPayStorageAdapter;
    seedCustomer: (customer: QZPayCustomer) => void;
    getCheckouts: () => QZPayCheckoutSession[];
} {
    const customers = new Map<string, QZPayCustomer>();
    const checkouts = new Map<string, QZPayCheckoutSession>();

    const storage = {
        customers: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findById: vi.fn(async (id: string) => customers.get(id) ?? null),
            findByExternalId: vi.fn(async () => null),
            findByEmail: vi.fn(async () => null),
            list: vi.fn(async () => ({ data: [], total: 0, limit: 0, offset: 0, hasMore: false }))
        },
        subscriptions: {} as unknown as QZPayStorageAdapter['subscriptions'],
        payments: {} as unknown as QZPayStorageAdapter['payments'],
        paymentMethods: {} as unknown as QZPayStorageAdapter['paymentMethods'],
        invoices: {} as unknown as QZPayStorageAdapter['invoices'],
        plans: {} as unknown as QZPayStorageAdapter['plans'],
        prices: {} as unknown as QZPayStorageAdapter['prices'],
        promoCodes: {} as unknown as QZPayStorageAdapter['promoCodes'],
        vendors: {} as unknown as QZPayStorageAdapter['vendors'],
        entitlements: {} as unknown as QZPayStorageAdapter['entitlements'],
        limits: {} as unknown as QZPayStorageAdapter['limits'],
        addons: {} as unknown as QZPayStorageAdapter['addons'],
        checkouts: {
            create: vi.fn(async (session: QZPayCheckoutSession) => {
                checkouts.set(session.id, session);
                return session;
            }),
            update: vi.fn(async (id: string, input: Partial<QZPayCheckoutSession>) => {
                const current = checkouts.get(id);
                if (!current) throw new Error(`Checkout ${id} not found`);
                const updated = { ...current, ...input };
                checkouts.set(id, updated);
                return updated;
            }),
            findById: vi.fn(async (id: string) => checkouts.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId: string) =>
                Array.from(checkouts.values()).filter((c) => c.customerId === customerId)
            ),
            list: vi.fn(async () => ({
                data: Array.from(checkouts.values()),
                total: checkouts.size,
                limit: 100,
                offset: 0,
                hasMore: false
            }))
        },
        transaction: vi.fn(async (fn: () => Promise<unknown>) => fn())
    } as unknown as QZPayStorageAdapter;

    return {
        storage,
        seedCustomer: (customer) => customers.set(customer.id, customer),
        getCheckouts: () => Array.from(checkouts.values())
    };
}

function buildPaymentAdapter(overrides?: {
    checkoutCreate?: (input: QZPayProviderCreateCheckoutInput) => Promise<QZPayProviderCheckout>;
}): QZPayPaymentAdapter {
    const defaultCreate = vi.fn(
        async (input: QZPayProviderCreateCheckoutInput): Promise<QZPayProviderCheckout> => ({
            id: `mp_pref_${input.externalReference}`,
            url: `https://mp.example/checkout/${input.externalReference}`,
            status: 'open',
            paymentIntentId: null,
            subscriptionId: null,
            customerId: input.customer?.providerCustomerId ?? null,
            metadata: {}
        })
    );

    return {
        provider: MOCK_PROVIDER,
        customers: {} as unknown as QZPayPaymentAdapter['customers'],
        subscriptions: {} as unknown as QZPayPaymentAdapter['subscriptions'],
        payments: {} as unknown as QZPayPaymentAdapter['payments'],
        prices: {} as unknown as QZPayPaymentAdapter['prices'],
        webhooks: {} as unknown as QZPayPaymentAdapter['webhooks'],
        checkout: {
            create: overrides?.checkoutCreate ? vi.fn(overrides.checkoutCreate) : defaultCreate,
            retrieve: vi.fn(),
            expire: vi.fn()
        }
    } as unknown as QZPayPaymentAdapter;
}

function buildPlans(): QZPayPlan[] {
    return [
        {
            id: 'plan_pro',
            name: 'Pro Plan',
            description: '',
            features: [],
            prices: [
                {
                    id: 'price_pro_monthly',
                    planId: 'plan_pro',
                    unitAmount: 2999,
                    currency: 'USD',
                    billingInterval: 'month',
                    intervalCount: 1,
                    providerPriceIds: { [MOCK_PROVIDER]: 'mp_plan_pro_monthly' }
                } as unknown as QZPayPlan['prices'][number]
            ]
        } as unknown as QZPayPlan
    ];
}

function makeValidInput(overrides: Partial<QZPayCreateCheckoutInput> = {}): QZPayCreateCheckoutInput {
    return {
        mode: 'subscription',
        lineItems: [{ priceId: 'price_pro_monthly', quantity: 1 }],
        successUrl: 'https://app.example/success',
        cancelUrl: 'https://app.example/cancel',
        ...overrides
    };
}

describe('billing.checkout', () => {
    let mock: ReturnType<typeof buildStorage>;
    let adapter: QZPayPaymentAdapter;

    beforeEach(() => {
        mock = buildStorage();
        adapter = buildPaymentAdapter();
    });

    describe('create — subscription mode (priceId)', () => {
        it('persists local session, calls adapter, writes back providerSessionIds, emits checkout.created', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });
            const events: QZPayCheckoutSession[] = [];
            billing.on('checkout.created', (event) => {
                events.push(event.data);
            });

            const result = await billing.checkout.create(makeValidInput());

            // 1. Local session persisted before provider call
            expect(mock.storage.checkouts.create).toHaveBeenCalledTimes(1);
            const persisted = mock.getCheckouts()[0];
            expect(persisted).toBeDefined();
            expect(persisted?.status).toBe('open');
            expect(persisted?.currency).toBe('USD');

            // 2. Adapter received the RO-RO shape with resolved line items
            expect(adapter.checkout.create).toHaveBeenCalledTimes(1);
            const adapterCall = vi.mocked(adapter.checkout.create).mock.calls[0]?.[0];
            expect(adapterCall?.resolvedLineItems).toEqual([
                {
                    providerPriceId: 'mp_plan_pro_monthly',
                    unitAmount: 2999,
                    currency: 'USD',
                    title: 'Pro Plan'
                }
            ]);
            expect(adapterCall?.externalReference).toBe(result.id);
            expect(adapterCall?.idempotencyKey).toBe(result.id);

            // 3. Writeback: storage.update called with providerSessionIds
            expect(mock.storage.checkouts.update).toHaveBeenCalledWith(result.id, {
                providerSessionIds: { [MOCK_PROVIDER]: `mp_pref_${result.id}` }
            });

            // 4. Event emitted, helpers attached
            expect(events).toHaveLength(1);
            expect(result.providerInitPoint).toBe(`https://mp.example/checkout/${result.id}`);
        });

        it('resolves the customer record and forwards it to the adapter when customerId is supplied', async () => {
            mock.seedCustomer({
                id: 'cus_123',
                email: 'jane@example.com',
                name: 'Jane Doe',
                phone: null,
                externalId: '',
                providerCustomerIds: { [MOCK_PROVIDER]: 'mp_cus_xyz' },
                metadata: {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            });
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });

            await billing.checkout.create(makeValidInput({ customerId: 'cus_123' }));

            const adapterCall = vi.mocked(adapter.checkout.create).mock.calls[0]?.[0];
            expect(adapterCall?.customer).toEqual({
                id: 'cus_123',
                email: 'jane@example.com',
                firstName: 'Jane',
                lastName: 'Doe',
                providerCustomerId: 'mp_cus_xyz'
            });
        });

        it('throws QZPayValidationError when the priceId is not in the plan map', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });

            await expect(
                billing.checkout.create(makeValidInput({ lineItems: [{ priceId: 'price_unknown', quantity: 1 }] }))
            ).rejects.toThrow(QZPayValidationError);

            // No storage.create should fire when validation rejects before the persist step
            expect(mock.storage.checkouts.create).not.toHaveBeenCalled();
        });
    });

    describe('create — payment mode (inline amount)', () => {
        it('builds resolved line items from inline unitAmount/currency/title without consulting plan map', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });

            const input: QZPayCreateCheckoutInput = {
                mode: 'payment',
                lineItems: [{ quantity: 1, unitAmount: 12000, currency: 'ARS', title: 'Annual Pro Upfront' }],
                successUrl: 'https://app.example/success',
                cancelUrl: 'https://app.example/cancel'
            };

            await billing.checkout.create(input);

            const adapterCall = vi.mocked(adapter.checkout.create).mock.calls[0]?.[0];
            expect(adapterCall?.resolvedLineItems).toEqual([
                {
                    unitAmount: 12000,
                    currency: 'ARS',
                    title: 'Annual Pro Upfront'
                }
            ]);
            expect(mock.getCheckouts()[0]?.currency).toBe('ARS');
        });
    });

    describe('create — no payment adapter', () => {
        it('returns the local session without invoking provider sync and still emits the event', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                plans: buildPlans(),
                livemode: false
            });
            const events: QZPayCheckoutSession[] = [];
            billing.on('checkout.created', (event) => {
                events.push(event.data);
            });

            const result = await billing.checkout.create(makeValidInput());

            expect(mock.storage.checkouts.create).toHaveBeenCalledTimes(1);
            expect(result.providerSessionIds).toEqual({});
            expect(result.providerInitPoint).toBeUndefined();
            expect(events).toHaveLength(1);
        });
    });

    describe('create — providerSyncErrorStrategy', () => {
        it("'throw' marks the session expired and throws QZPayProviderSyncError on adapter failure", async () => {
            const failingAdapter = buildPaymentAdapter({
                checkoutCreate: async () => {
                    throw new Error('boom');
                }
            });
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: failingAdapter,
                plans: buildPlans(),
                livemode: true, // 'throw' is the default for livemode
                providerSyncErrorStrategy: 'throw'
            });

            await expect(billing.checkout.create(makeValidInput())).rejects.toThrow(QZPayProviderSyncError);

            const persisted = mock.getCheckouts()[0];
            expect(persisted?.status).toBe('expired');
        });

        it("'log' keeps the local session open and returns the un-enriched record on adapter failure", async () => {
            const logSpy = vi.fn();
            const failingAdapter = buildPaymentAdapter({
                checkoutCreate: async () => {
                    throw new Error('boom');
                }
            });
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: failingAdapter,
                plans: buildPlans(),
                livemode: false,
                providerSyncErrorStrategy: 'log',
                logger: {
                    debug: vi.fn(),
                    info: vi.fn(),
                    warn: logSpy,
                    error: vi.fn()
                }
            });

            const result = await billing.checkout.create(makeValidInput());

            expect(result.status).toBe('open');
            expect(result.providerSessionIds).toEqual({});
            expect(logSpy).toHaveBeenCalled();
            const persisted = mock.getCheckouts()[0];
            expect(persisted?.status).toBe('open');
        });
    });

    describe('input validation', () => {
        it('throws QZPayValidationError when neither priceId nor inline amount is supplied', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });

            await expect(
                billing.checkout.create({
                    mode: 'payment',
                    lineItems: [{ quantity: 1 }],
                    successUrl: 'https://app.example/success',
                    cancelUrl: 'https://app.example/cancel'
                })
            ).rejects.toThrow(QZPayValidationError);

            expect(mock.storage.checkouts.create).not.toHaveBeenCalled();
        });
    });

    describe('lookups', () => {
        it('get / getByCustomerId / list delegate to storage', async () => {
            const billing = createQZPayBilling({
                storage: mock.storage,
                paymentAdapter: adapter,
                plans: buildPlans(),
                livemode: false
            });
            const result = await billing.checkout.create(makeValidInput({ customerId: 'cus_lookup' }));

            await expect(billing.checkout.get(result.id)).resolves.toMatchObject({ id: result.id });
            await expect(billing.checkout.getByCustomerId('cus_lookup')).resolves.toHaveLength(1);
            const listed = await billing.checkout.list({});
            expect(listed.data).toHaveLength(1);
        });
    });
});
