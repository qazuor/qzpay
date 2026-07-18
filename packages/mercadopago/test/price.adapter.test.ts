/**
 * MercadoPago Price Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoPriceAdapter } from '../src/adapters/price.adapter.js';
import { createMockMPPreapprovalPlan, createMockPreApprovalPlanApi } from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    PreApprovalPlan: vi.fn(),
    CardToken: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoPriceAdapter', () => {
    let adapter: QZPayMercadoPagoPriceAdapter;
    let mockPlanApi: ReturnType<typeof createMockPreApprovalPlanApi>;

    // MercadoPago requires a `back_url` on every preapproval_plan creation, so the
    // adapter is constructed with an adapter-level default in most tests. The
    // "resolves back_url" describe below covers the no-default and per-request cases.
    const DEFAULT_BACK_URL = 'https://example.test/checkout/return';

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPlanApi = createMockPreApprovalPlanApi();

        const { PreApprovalPlan } = await import('mercadopago');
        vi.mocked(PreApprovalPlan).mockImplementation(() => mockPlanApi as never);

        adapter = new QZPayMercadoPagoPriceAdapter({} as never, DEFAULT_BACK_URL);
    });

    describe('create', () => {
        it('should create a monthly price', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_new123' }));

            const result = await adapter.create(
                {
                    unitAmount: 2999, // $29.99 in cents
                    currency: 'USD',
                    billingInterval: 'month'
                },
                'Premium Plan'
            );

            expect(result).toBe('plan_new123');
            // No billing_day: the plan bills on the subscription's rolling
            // anniversary (start/trial-end date), not a fixed calendar day.
            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: {
                    reason: 'Premium Plan',
                    back_url: DEFAULT_BACK_URL,
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 29.99, // Converted from cents
                        currency_id: 'USD'
                    }
                }
            });
        });

        it('should not set billing_day (rolling anniversary billing)', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_nobd' }));

            await adapter.create({ unitAmount: 1500, currency: 'ARS', billingInterval: 'month' }, 'No Billing Day Plan');

            const body = mockPlanApi.create.mock.calls[0]?.[0]?.body;
            expect(body.auto_recurring).not.toHaveProperty('billing_day');
        });

        it('should create a yearly price', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan());

            await adapter.create(
                {
                    unitAmount: 9999,
                    currency: 'USD',
                    billingInterval: 'year'
                },
                'Annual Plan'
            );

            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    auto_recurring: expect.objectContaining({
                        frequency: 12, // 12 months
                        frequency_type: 'months'
                    })
                })
            });
        });

        it('should create a weekly price', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan());

            await adapter.create(
                {
                    unitAmount: 999,
                    currency: 'USD',
                    billingInterval: 'week'
                },
                'Weekly Plan'
            );

            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    auto_recurring: expect.objectContaining({
                        frequency: 7, // 7 days
                        frequency_type: 'days'
                    })
                })
            });
        });

        it('should create a daily price', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan());

            await adapter.create(
                {
                    unitAmount: 99,
                    currency: 'USD',
                    billingInterval: 'day'
                },
                'Daily Plan'
            );

            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    auto_recurring: expect.objectContaining({
                        frequency: 1,
                        frequency_type: 'days'
                    })
                })
            });
        });

        it('should handle custom interval count', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan());

            await adapter.create(
                {
                    unitAmount: 4999,
                    currency: 'USD',
                    billingInterval: 'month',
                    intervalCount: 3
                },
                'Quarterly Plan'
            );

            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    auto_recurring: expect.objectContaining({
                        frequency: 3, // 3 months
                        frequency_type: 'months'
                    })
                })
            });
        });

        it('should add free trial when trialDays provided', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan());

            await adapter.create(
                {
                    unitAmount: 1999,
                    currency: 'USD',
                    billingInterval: 'month',
                    trialDays: 14
                },
                'Plan with Trial'
            );

            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    auto_recurring: expect.objectContaining({
                        free_trial: {
                            frequency: 14,
                            frequency_type: 'days'
                        }
                    })
                })
            });
        });

        it('should throw error when plan creation fails', async () => {
            mockPlanApi.create.mockResolvedValue({});

            await expect(
                adapter.create(
                    {
                        unitAmount: 1000,
                        currency: 'USD',
                        billingInterval: 'month'
                    },
                    'Failed Plan'
                )
            ).rejects.toThrow('Failed to create MercadoPago plan');
        });
    });

    describe('create — back_url resolution (regression: MercadoPago "Back url is required")', () => {
        it('sends the per-request input.backUrl in the preapproval_plan body', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_burl' }));

            await adapter.create(
                {
                    unitAmount: 2999,
                    currency: 'ARS',
                    billingInterval: 'month',
                    backUrl: 'https://hospeda.com.ar/es/suscriptores/checkout/success/'
                },
                'Premium Plan'
            );

            const body = mockPlanApi.create.mock.calls[0]?.[0]?.body;
            expect(body.back_url).toBe('https://hospeda.com.ar/es/suscriptores/checkout/success/');
        });

        it('prefers the per-request input.backUrl over the adapter default', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_override' }));

            await adapter.create(
                {
                    unitAmount: 1000,
                    currency: 'ARS',
                    billingInterval: 'month',
                    backUrl: 'https://hospeda.com.ar/return/'
                },
                'Override Plan'
            );

            const body = mockPlanApi.create.mock.calls[0]?.[0]?.body;
            expect(body.back_url).toBe('https://hospeda.com.ar/return/');
        });

        it('falls back to the adapter defaultPlanBackUrl when input.backUrl is absent', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_default' }));

            await adapter.create({ unitAmount: 1000, currency: 'ARS', billingInterval: 'month' }, 'Default Plan');

            const body = mockPlanApi.create.mock.calls[0]?.[0]?.body;
            expect(body.back_url).toBe(DEFAULT_BACK_URL);
        });

        it('throws a clear error (never calls MercadoPago) when no back_url resolves — reproduces the empty-mapping prod failure', async () => {
            // Adapter WITHOUT a default back_url and an input WITHOUT backUrl: this is
            // exactly the first-provision-on-empty-mapping path that returned
            // MercadoPago's opaque "Create price - Back url is required" 400 in prod.
            const adapterNoDefault = new QZPayMercadoPagoPriceAdapter({} as never);

            await expect(
                adapterNoDefault.create({ unitAmount: 1000, currency: 'ARS', billingInterval: 'month' }, 'No Back Url Plan')
            ).rejects.toThrow(/back_url/i);

            expect(mockPlanApi.create).not.toHaveBeenCalled();
        });

        it('throws when the resolved back_url is not an absolute http(s) URL', async () => {
            await expect(
                adapter.create({ unitAmount: 1000, currency: 'ARS', billingInterval: 'month', backUrl: 'not-a-url' }, 'Bad Url Plan')
            ).rejects.toThrow(/absolute http/i);

            expect(mockPlanApi.create).not.toHaveBeenCalled();
        });

        it('treats a whitespace-only input.backUrl as absent and uses the default', async () => {
            mockPlanApi.create.mockResolvedValue(createMockMPPreapprovalPlan({ id: 'plan_ws' }));

            await adapter.create({ unitAmount: 1000, currency: 'ARS', billingInterval: 'month', backUrl: '   ' }, 'Whitespace Plan');

            const body = mockPlanApi.create.mock.calls[0]?.[0]?.body;
            expect(body.back_url).toBe(DEFAULT_BACK_URL);
        });
    });

    describe('archive', () => {
        it('should archive a price (set inactive)', async () => {
            mockPlanApi.update.mockResolvedValue({});

            await adapter.archive('plan_123');

            expect(mockPlanApi.update).toHaveBeenCalledWith({
                id: 'plan_123',
                updatePreApprovalPlanRequest: {
                    status: 'inactive'
                }
            });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a price', async () => {
            mockPlanApi.get.mockResolvedValue(
                createMockMPPreapprovalPlan({
                    id: 'plan_123',
                    status: 'active',
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 29.99,
                        currency_id: 'USD',
                        billing_day: null,
                        free_trial: null
                    }
                })
            );

            const result = await adapter.retrieve('plan_123');

            expect(mockPlanApi.get).toHaveBeenCalledWith({ preApprovalPlanId: 'plan_123' });
            expect(result).toEqual({
                id: 'plan_123',
                active: true,
                unitAmount: 2999, // Converted to cents
                currency: 'USD',
                recurring: {
                    interval: 'month',
                    intervalCount: 1
                }
            });
        });

        it('should handle inactive status', async () => {
            mockPlanApi.get.mockResolvedValue(
                createMockMPPreapprovalPlan({
                    status: 'inactive'
                })
            );

            const result = await adapter.retrieve('plan_123');

            expect(result.active).toBe(false);
        });

        it('should handle weekly interval', async () => {
            mockPlanApi.get.mockResolvedValue(
                createMockMPPreapprovalPlan({
                    auto_recurring: {
                        frequency: 7,
                        frequency_type: 'days',
                        transaction_amount: 9.99,
                        currency_id: 'USD',
                        billing_day: null,
                        free_trial: null
                    }
                })
            );

            const result = await adapter.retrieve('plan_123');

            expect(result.recurring).toEqual({
                interval: 'week',
                intervalCount: 1
            });
        });

        it('should handle yearly interval', async () => {
            mockPlanApi.get.mockResolvedValue(
                createMockMPPreapprovalPlan({
                    auto_recurring: {
                        frequency: 12,
                        frequency_type: 'months',
                        transaction_amount: 99.99,
                        currency_id: 'USD',
                        billing_day: null,
                        free_trial: null
                    }
                })
            );

            const result = await adapter.retrieve('plan_123');

            expect(result.recurring).toEqual({
                interval: 'year',
                intervalCount: 1
            });
        });

        it('should handle missing auto_recurring', async () => {
            mockPlanApi.get.mockResolvedValue(
                createMockMPPreapprovalPlan({
                    auto_recurring: undefined
                })
            );

            const result = await adapter.retrieve('plan_123');

            expect(result.unitAmount).toBe(0);
            expect(result.recurring).toEqual({
                interval: 'month',
                intervalCount: 1
            });
        });
    });

    describe('createProduct', () => {
        it('should return product name as ID', async () => {
            const result = await adapter.createProduct('Premium Product', 'A great product');

            expect(result).toBe('Premium Product');
        });

        it('should work without description', async () => {
            const result = await adapter.createProduct('Basic Product');

            expect(result).toBe('Basic Product');
        });
    });
});
