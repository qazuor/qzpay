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

    describe('search', () => {
        // Polling fallback for one-time payment flows: at start-paid time
        // the local record has the checkout/preference id, not the payment
        // id (that one materializes only when the user completes checkout).
        // The cron polls via search; idempotency comes from the downstream
        // handler check.

        it('searches by externalReference (typed) and maps results', async () => {
            mockPaymentApi.search.mockResolvedValue({
                paging: { total: 1, limit: 30, offset: 0 },
                results: [
                    {
                        id: 999000111,
                        status: 'approved',
                        transaction_amount: 250,
                        currency_id: 'ARS',
                        date_created: '2026-05-23T16:00:00Z',
                        metadata: { annualSubscriptionId: 'sub_local_uuid' }
                    }
                ]
            });

            const results = await adapter.search({ externalReference: 'cs_annual_xyz' });

            expect(mockPaymentApi.search).toHaveBeenCalledWith({
                options: expect.objectContaining({
                    external_reference: 'cs_annual_xyz',
                    sort: 'date_created',
                    criteria: 'desc'
                })
            });
            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                id: '999000111',
                // MP `approved` → qzpay `succeeded` via mapStatus.
                status: 'succeeded',
                amount: 25000, // 250 * 100 cents
                currency: 'ARS',
                metadata: { annualSubscriptionId: 'sub_local_uuid' }
            });
        });

        it('searches by checkoutSessionId via untyped preference_id passthrough', async () => {
            mockPaymentApi.search.mockResolvedValue({ results: [] });

            await adapter.search({ checkoutSessionId: 'pref_abc' });

            expect(mockPaymentApi.search).toHaveBeenCalledWith({
                options: expect.objectContaining({
                    preference_id: 'pref_abc'
                })
            });
        });

        it('returns empty array when no payments match', async () => {
            mockPaymentApi.search.mockResolvedValue({ results: [] });

            const results = await adapter.search({ externalReference: 'cs_no_match' });

            expect(results).toEqual([]);
        });

        it('handles empty response without `results` field gracefully', async () => {
            mockPaymentApi.search.mockResolvedValue({});

            const results = await adapter.search({ externalReference: 'cs_empty' });

            expect(results).toEqual([]);
        });

        it('returns multiple payments ordered as MP returns them (most recent first)', async () => {
            // Simulates the user retrying with a different card on the same
            // checkout session — MP returns both attempts ordered by
            // date_created DESC because we pass sort=date_created criteria=desc.
            mockPaymentApi.search.mockResolvedValue({
                results: [
                    {
                        id: 200,
                        status: 'approved',
                        transaction_amount: 100,
                        currency_id: 'ARS',
                        date_created: '2026-05-23T16:05:00Z'
                    },
                    {
                        id: 100,
                        status: 'rejected',
                        transaction_amount: 100,
                        currency_id: 'ARS',
                        date_created: '2026-05-23T16:00:00Z'
                    }
                ]
            });

            const results = await adapter.search({ externalReference: 'cs_retry' });

            expect(results).toHaveLength(2);
            expect(results[0].id).toBe('200');
            // MP `approved` → qzpay `succeeded`, MP `rejected` → qzpay `failed`.
            expect(results[0].status).toBe('succeeded');
            expect(results[1].id).toBe('100');
            expect(results[1].status).toBe('failed');
        });

        it('drops results that lack an id', async () => {
            mockPaymentApi.search.mockResolvedValue({
                results: [
                    { id: 500, status: 'approved', transaction_amount: 10, currency_id: 'ARS' },
                    { status: 'approved', transaction_amount: 10, currency_id: 'ARS' }
                ]
            });

            const results = await adapter.search({ externalReference: 'cs_partial' });

            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('500');
        });

        it('wraps provider errors in mapMercadoPagoError', async () => {
            mockPaymentApi.search.mockRejectedValue(new Error('MP REST 401: invalid token'));

            await expect(adapter.search({ externalReference: 'cs_err' })).rejects.toThrow();
        });
    });
});
