/**
 * MercadoPago Subscription Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';
import {
    createMockCustomerApi,
    createMockMPCustomer,
    createMockMPPreapproval,
    createMockPreApprovalApi
} from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    PreApproval: vi.fn(),
    Customer: vi.fn(),
    CardToken: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoSubscriptionAdapter', () => {
    let adapter: QZPayMercadoPagoSubscriptionAdapter;
    let mockPreApprovalApi: ReturnType<typeof createMockPreApprovalApi>;
    let mockCustomerApi: ReturnType<typeof createMockCustomerApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPreApprovalApi = createMockPreApprovalApi();
        mockCustomerApi = createMockCustomerApi();

        const { PreApproval, Customer } = await import('mercadopago');
        vi.mocked(PreApproval).mockImplementation(() => mockPreApprovalApi as never);
        vi.mocked(Customer).mockImplementation(() => mockCustomerApi as never);

        // Default mock: customer with email
        mockCustomerApi.get.mockResolvedValue(createMockMPCustomer({ email: 'test@example.com' }));

        adapter = new QZPayMercadoPagoSubscriptionAdapter({} as never);
    });

    describe('create', () => {
        it('should create a subscription', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval({ id: 'sub_new123' }));

            const result = await adapter.create('cus_123', { planId: 'plan_123' }, 'price_mp_123');

            expect(result.id).toBe('sub_new123');
            expect(mockCustomerApi.get).toHaveBeenCalledWith({ customerId: 'cus_123' });
            expect(mockPreApprovalApi.create).toHaveBeenCalledWith({
                body: {
                    preapproval_plan_id: 'price_mp_123',
                    payer_email: 'test@example.com',
                    external_reference: 'cus_123'
                }
            });
        });

        it('should throw error if customer email is missing', async () => {
            mockCustomerApi.get.mockResolvedValue(createMockMPCustomer({ email: '' }));

            await expect(adapter.create('cus_123', { planId: 'plan_123' }, 'price_123')).rejects.toThrow(
                'Customer email is required for MercadoPago subscriptions'
            );
        });

        it('should map authorized status to active', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval({ status: 'authorized' }));

            const result = await adapter.create('cus_123', { planId: 'plan_123' }, 'price_123');

            expect(result.status).toBe('active');
        });

        it('should calculate period end correctly for monthly', async () => {
            const now = new Date();
            mockPreApprovalApi.create.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 29.99,
                        currency_id: 'USD',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.create('cus_123', { planId: 'plan_123' }, 'price_123');

            const expectedEnd = new Date(now);
            expectedEnd.setMonth(expectedEnd.getMonth() + 1);

            expect(result.currentPeriodEnd.getMonth()).toBe(expectedEnd.getMonth());
        });
    });

    describe('update', () => {
        it('should update subscription with plan ID', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval());

            await adapter.update('sub_123', { planId: 'new_plan_123' });

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: {
                    reason: 'Plan updated to: new_plan_123'
                }
            });
        });

        it('should update subscription with cancel at', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval());
            const cancelAt = new Date('2025-12-31');

            await adapter.update('sub_123', { cancelAt });

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: {
                    status: 'cancelled'
                }
            });
        });

        it('should retrieve updated subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ id: 'sub_123' }));

            const result = await adapter.update('sub_123', { planId: 'new_plan' });

            expect(mockPreApprovalApi.get).toHaveBeenCalledWith({ id: 'sub_123' });
            expect(result.id).toBe('sub_123');
        });
    });

    describe('cancel', () => {
        it('should cancel a subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.cancel('sub_123', false);

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: { status: 'cancelled' }
            });
        });

        it('should cancel at period end (same behavior)', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.cancel('sub_123', true);

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: { status: 'cancelled' }
            });
        });
    });

    describe('pause', () => {
        it('should pause a subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.pause('sub_123');

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: { status: 'paused' }
            });
        });
    });

    describe('resume', () => {
        it('should resume a subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.resume('sub_123');

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'sub_123',
                body: { status: 'authorized' }
            });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a subscription', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    id: 'sub_123',
                    status: 'authorized',
                    date_created: now.toISOString()
                })
            );

            const result = await adapter.retrieve('sub_123');

            expect(mockPreApprovalApi.get).toHaveBeenCalledWith({ id: 'sub_123' });
            expect(result.id).toBe('sub_123');
            expect(result.status).toBe('active');
        });

        it('should handle cancelled status with canceledAt', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    status: 'cancelled',
                    last_modified: now.toISOString()
                })
            );

            const result = await adapter.retrieve('sub_123');

            expect(result.status).toBe('canceled');
            expect(result.canceledAt).toBeInstanceOf(Date);
        });

        it('should handle pending status', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ status: 'pending' }));

            const result = await adapter.retrieve('sub_123');

            expect(result.status).toBe('pending');
        });

        it('should handle paused status', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ status: 'paused' }));

            const result = await adapter.retrieve('sub_123');

            expect(result.status).toBe('paused');
        });

        it('should calculate period end for weekly', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 7, // 7 days = 1 week
                        frequency_type: 'days',
                        transaction_amount: 9.99,
                        currency_id: 'USD',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.retrieve('sub_123');

            const expectedEnd = new Date(now);
            expectedEnd.setDate(expectedEnd.getDate() + 7);

            expect(result.currentPeriodEnd.getDate()).toBe(expectedEnd.getDate());
        });

        it('should calculate period end for yearly', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 12, // 12 months = 1 year
                        frequency_type: 'months',
                        transaction_amount: 99.99,
                        currency_id: 'USD',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.retrieve('sub_123');

            const expectedEnd = new Date(now);
            expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);

            expect(result.currentPeriodEnd.getFullYear()).toBe(expectedEnd.getFullYear());
        });

        it('should handle missing auto_recurring', async () => {
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    auto_recurring: undefined
                })
            );

            const result = await adapter.retrieve('sub_123');

            expect(result.currentPeriodEnd).toBeInstanceOf(Date);
        });
    });
});
