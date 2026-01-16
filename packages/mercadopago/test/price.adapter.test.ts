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

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPlanApi = createMockPreApprovalPlanApi();

        const { PreApprovalPlan } = await import('mercadopago');
        vi.mocked(PreApprovalPlan).mockImplementation(() => mockPlanApi as never);

        adapter = new QZPayMercadoPagoPriceAdapter({} as never);
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
            expect(mockPlanApi.create).toHaveBeenCalledWith({
                body: {
                    reason: 'Premium Plan',
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 29.99, // Converted from cents
                        currency_id: 'USD',
                        billing_day: 1
                    }
                }
            });
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
