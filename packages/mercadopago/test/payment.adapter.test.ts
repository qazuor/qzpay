/**
 * MercadoPago Payment Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoPaymentAdapter } from '../src/adapters/payment.adapter.js';
import { createMockMPPayment, createMockMPRefund, createMockPaymentApi, createMockRefundApi } from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    Payment: vi.fn(),
    PaymentRefund: vi.fn(),
    CardToken: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoPaymentAdapter', () => {
    let adapter: QZPayMercadoPagoPaymentAdapter;
    let mockPaymentApi: ReturnType<typeof createMockPaymentApi>;
    let mockRefundApi: ReturnType<typeof createMockRefundApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPaymentApi = createMockPaymentApi();
        mockRefundApi = createMockRefundApi();

        const { Payment, PaymentRefund } = await import('mercadopago');
        vi.mocked(Payment).mockImplementation(() => mockPaymentApi as never);
        vi.mocked(PaymentRefund).mockImplementation(() => mockRefundApi as never);

        adapter = new QZPayMercadoPagoPaymentAdapter({} as never);
    });

    describe('create', () => {
        it('should create a payment', async () => {
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ id: 12345 }));

            const result = await adapter.create('cus_123', {
                amount: 10000, // 100.00 in cents
                currency: 'USD'
            });

            expect(result.id).toBe('12345');
            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: {
                    transaction_amount: 100, // Converted from cents
                    description: 'QZPay Payment',
                    payment_method_id: 'account_money',
                    payer: { id: 'cus_123' },
                    metadata: { qzpay_customer_id: 'cus_123' }
                },
                requestOptions: expect.objectContaining({
                    idempotencyKey: expect.any(String)
                })
            });
        });

        it('should use provided payment method', async () => {
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment());

            await adapter.create('cus_123', {
                amount: 5000,
                currency: 'BRL',
                paymentMethodId: 'credit_card'
            });

            expect(mockPaymentApi.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.objectContaining({
                        payment_method_id: 'credit_card'
                    })
                })
            );
        });

        it('should map payment status correctly', async () => {
            mockPaymentApi.create.mockResolvedValue(
                createMockMPPayment({
                    status: 'approved',
                    transaction_amount: 50.0,
                    currency_id: 'BRL'
                })
            );

            const result = await adapter.create('cus_123', {
                amount: 5000,
                currency: 'BRL'
            });

            expect(result.status).toBe('succeeded');
            expect(result.amount).toBe(5000); // Converted back to cents
            expect(result.currency).toBe('BRL');
        });

        it('should handle pending status', async () => {
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ status: 'pending' }));

            const result = await adapter.create('cus_123', {
                amount: 1000,
                currency: 'USD'
            });

            expect(result.status).toBe('pending');
        });

        it('should handle rejected status', async () => {
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ status: 'rejected' }));

            const result = await adapter.create('cus_123', {
                amount: 1000,
                currency: 'USD'
            });

            expect(result.status).toBe('failed');
        });

        // SPEC-123 A1: regression guard for the idempotency-key-inside-retry bug.
        // Before this fix the key was regenerated on every retry attempt, so a
        // retry that came after MercadoPago had actually processed the first
        // attempt would produce a duplicate charge.
        describe('idempotency key (SPEC-123 A1)', () => {
            it('should reuse the SAME idempotency key across retry attempts', async () => {
                // First two calls fail with retriable errors, third one succeeds.
                const retriableError = Object.assign(new Error('Internal server error'), {
                    cause: [{ code: '500' }]
                });
                mockPaymentApi.create
                    .mockRejectedValueOnce(retriableError)
                    .mockRejectedValueOnce(retriableError)
                    .mockResolvedValueOnce(createMockMPPayment({ id: 99 }));

                // Tight retry config so the test runs fast.
                const fastAdapter = new QZPayMercadoPagoPaymentAdapter({} as never, {
                    enabled: true,
                    maxAttempts: 3,
                    initialDelayMs: 1,
                    maxDelayMs: 1,
                    backoffMultiplier: 1
                });

                const result = await fastAdapter.create('cus_123', {
                    amount: 5000,
                    currency: 'ARS'
                });

                expect(result.id).toBe('99');
                expect(mockPaymentApi.create).toHaveBeenCalledTimes(3);

                const keys = mockPaymentApi.create.mock.calls.map(
                    (call) => (call[0] as { requestOptions: { idempotencyKey: string } }).requestOptions.idempotencyKey
                );

                expect(keys).toHaveLength(3);
                expect(keys[0]).toBeDefined();
                expect(keys[1]).toBe(keys[0]);
                expect(keys[2]).toBe(keys[0]);
            });

            it('should respect a caller-supplied idempotency key', async () => {
                mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ id: 7 }));

                await adapter.create('cus_123', {
                    amount: 1000,
                    currency: 'ARS',
                    idempotencyKey: 'my-stable-correlation-id'
                });

                expect(mockPaymentApi.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        requestOptions: expect.objectContaining({
                            idempotencyKey: 'my-stable-correlation-id'
                        })
                    })
                );
            });

            it('should generate a fresh UUID for each independent create() call', async () => {
                mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ id: 1 }));

                await adapter.create('cus_a', { amount: 1000, currency: 'ARS' });
                await adapter.create('cus_b', { amount: 1000, currency: 'ARS' });

                const keys = mockPaymentApi.create.mock.calls.map(
                    (call) => (call[0] as { requestOptions: { idempotencyKey: string } }).requestOptions.idempotencyKey
                );

                expect(keys).toHaveLength(2);
                expect(keys[0]).not.toBe(keys[1]);
                // Default format is qzpay_<uuid>; both should look like that.
                expect(keys[0]).toMatch(/^qzpay_[0-9a-f-]+$/);
                expect(keys[1]).toMatch(/^qzpay_[0-9a-f-]+$/);
            });
        });
    });

    describe('capture', () => {
        it('should capture a payment', async () => {
            mockPaymentApi.capture.mockResolvedValue(createMockMPPayment({ status: 'approved' }));

            const result = await adapter.capture('12345');

            expect(mockPaymentApi.capture).toHaveBeenCalledWith({ id: 12345 });
            expect(result.status).toBe('succeeded');
        });
    });

    describe('cancel', () => {
        it('should cancel a payment', async () => {
            mockPaymentApi.cancel.mockResolvedValue({});

            await adapter.cancel('12345');

            expect(mockPaymentApi.cancel).toHaveBeenCalledWith({ id: 12345 });
        });
    });

    describe('refund', () => {
        it('should create a full refund', async () => {
            mockRefundApi.create.mockResolvedValue(createMockMPRefund({ id: 99999, amount: 100.0 }));

            const result = await adapter.refund({}, '12345');

            expect(mockRefundApi.create).toHaveBeenCalledWith({
                payment_id: 12345,
                body: {}
            });
            expect(result).toEqual({
                id: '99999',
                status: 'approved',
                amount: 10000 // Converted to cents
            });
        });

        it('should create a partial refund', async () => {
            mockRefundApi.create.mockResolvedValue(createMockMPRefund({ amount: 50.0 }));

            const result = await adapter.refund({ amount: 5000 }, '12345');

            expect(mockRefundApi.create).toHaveBeenCalledWith({
                payment_id: 12345,
                body: { amount: 50 } // Converted from cents
            });
            expect(result.amount).toBe(5000);
        });

        it('should handle null status', async () => {
            mockRefundApi.create.mockResolvedValue(createMockMPRefund({ status: null }));

            const result = await adapter.refund({}, '12345');

            expect(result.status).toBe('pending');
        });

        it('should handle null amount', async () => {
            mockRefundApi.create.mockResolvedValue(createMockMPRefund({ amount: null }));

            const result = await adapter.refund({}, '12345');

            expect(result.amount).toBe(0);
        });
    });

    describe('retrieve', () => {
        it('should retrieve a payment', async () => {
            mockPaymentApi.get.mockResolvedValue(
                createMockMPPayment({
                    id: 12345,
                    status: 'approved',
                    transaction_amount: 75.5,
                    currency_id: 'ARS',
                    metadata: { order: '123' }
                })
            );

            const result = await adapter.retrieve('12345');

            expect(mockPaymentApi.get).toHaveBeenCalledWith({ id: 12345 });
            expect(result).toEqual({
                id: '12345',
                status: 'succeeded',
                amount: 7550, // Rounded to cents
                currency: 'ARS',
                metadata: { order: '123' }
            });
        });

        it('should handle all status mappings', async () => {
            const statusMappings = [
                { mp: 'pending', qzpay: 'pending' },
                { mp: 'approved', qzpay: 'succeeded' },
                { mp: 'authorized', qzpay: 'requires_capture' },
                { mp: 'in_process', qzpay: 'processing' },
                { mp: 'in_mediation', qzpay: 'disputed' },
                { mp: 'rejected', qzpay: 'failed' },
                { mp: 'cancelled', qzpay: 'canceled' },
                { mp: 'refunded', qzpay: 'refunded' },
                { mp: 'charged_back', qzpay: 'disputed' }
            ];

            for (const { mp, qzpay } of statusMappings) {
                mockPaymentApi.get.mockResolvedValue(createMockMPPayment({ status: mp }));

                const result = await adapter.retrieve('12345');

                expect(result.status).toBe(qzpay);
            }
        });

        it('should handle missing metadata', async () => {
            mockPaymentApi.get.mockResolvedValue(
                createMockMPPayment({
                    metadata: undefined
                })
            );

            const result = await adapter.retrieve('12345');

            expect(result.metadata).toEqual({});
        });

        it('should filter null/undefined metadata values', async () => {
            mockPaymentApi.get.mockResolvedValue(
                createMockMPPayment({
                    metadata: {
                        valid: 'value',
                        nullVal: null,
                        undefinedVal: undefined
                    }
                })
            );

            const result = await adapter.retrieve('12345');

            expect(result.metadata).toEqual({ valid: 'value' });
        });
    });
});
