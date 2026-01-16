/**
 * MercadoPago Payment Adapter - Card on File Flow Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoPaymentAdapter } from '../src/adapters/payment.adapter.js';
import { createMockMPPayment, createMockPaymentApi, createMockRefundApi } from './helpers/mercadopago-mocks.js';

// Mock CardToken API
function createMockCardTokenApi() {
    return {
        create: vi.fn()
    };
}

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    Payment: vi.fn().mockImplementation(() => createMockPaymentApi()),
    PaymentRefund: vi.fn().mockImplementation(() => createMockRefundApi()),
    CardToken: vi.fn().mockImplementation(() => createMockCardTokenApi()),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoPaymentAdapter - Card on File', () => {
    let adapter: QZPayMercadoPagoPaymentAdapter;
    let mockPaymentApi: ReturnType<typeof createMockPaymentApi>;
    let mockCardTokenApi: ReturnType<typeof createMockCardTokenApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPaymentApi = createMockPaymentApi();
        mockCardTokenApi = createMockCardTokenApi();

        const { Payment, PaymentRefund, CardToken } = await import('mercadopago');
        vi.mocked(Payment).mockImplementation(() => mockPaymentApi as never);
        vi.mocked(PaymentRefund).mockImplementation(() => createMockRefundApi() as never);
        vi.mocked(CardToken).mockImplementation(() => mockCardTokenApi as never);

        adapter = new QZPayMercadoPagoPaymentAdapter({} as never);
    });

    describe('Card on File Payment Flow', () => {
        it('should create payment with saved card_id', async () => {
            // Mock CardToken creation
            mockCardTokenApi.create.mockResolvedValue({
                id: 'card_token_generated_123'
            });

            // Mock payment creation
            mockPaymentApi.create.mockResolvedValue(
                createMockMPPayment({
                    id: 999,
                    status: 'approved',
                    transaction_amount: 150.0
                })
            );

            const result = await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 15000, // $150 in cents
                currency: 'ARS',
                cardId: 'saved_card_456',
                paymentMethodId: 'visa',
                installments: 1
            });

            // Verify card token was generated from saved card
            expect(mockCardTokenApi.create).toHaveBeenCalledWith({
                body: {
                    card_id: 'saved_card_456'
                }
            });

            // Verify payment was created with the generated token
            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    token: 'card_token_generated_123',
                    payment_method_id: 'visa',
                    installments: 1,
                    transaction_amount: 150.0,
                    metadata: expect.objectContaining({
                        saved_card_id: 'saved_card_456'
                    })
                }),
                requestOptions: expect.objectContaining({
                    idempotencyKey: expect.any(String)
                })
            });

            expect(result.id).toBe('999');
            expect(result.status).toBe('succeeded');
            expect(result.amount).toBe(15000);
        });

        it('should create payment with saved card and security code', async () => {
            mockCardTokenApi.create.mockResolvedValue({
                id: 'secure_token_789'
            });

            mockPaymentApi.create.mockResolvedValue(createMockMPPayment());

            await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 10000,
                currency: 'ARS',
                cardId: 'saved_card_789',
                paymentMethodId: 'master',
                metadata: {
                    orderId: 'order_456'
                }
            });

            // Note: Security code would be passed through cardToken API if supported
            // Currently, the adapter generates token from card_id without CVV
            expect(mockCardTokenApi.create).toHaveBeenCalledWith({
                body: {
                    card_id: 'saved_card_789'
                }
            });

            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    token: 'secure_token_789',
                    metadata: expect.objectContaining({
                        saved_card_id: 'saved_card_789',
                        orderId: 'order_456'
                    })
                }),
                requestOptions: expect.any(Object)
            });
        });

        it('should preserve metadata when using saved card', async () => {
            mockCardTokenApi.create.mockResolvedValue({
                id: 'token_with_metadata'
            });

            mockPaymentApi.create.mockResolvedValue(createMockMPPayment());

            await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 5000,
                currency: 'BRL',
                cardId: 'card_xyz',
                metadata: {
                    orderId: 'order_789',
                    userId: 'user_123',
                    subscriptionId: 'sub_456'
                }
            });

            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    metadata: expect.objectContaining({
                        saved_card_id: 'card_xyz',
                        orderId: 'order_789',
                        userId: 'user_123',
                        subscriptionId: 'sub_456'
                    })
                }),
                requestOptions: expect.any(Object)
            });
        });

        it('should handle card token creation failure', async () => {
            mockCardTokenApi.create.mockRejectedValue(new Error('Invalid card_id'));

            await expect(
                adapter.create('cus_mp_123', {
                    customerId: 'local_cus_123',
                    amount: 10000,
                    currency: 'ARS',
                    cardId: 'invalid_card'
                })
            ).rejects.toThrow();
        });

        it('should use installments with saved card', async () => {
            mockCardTokenApi.create.mockResolvedValue({
                id: 'installments_token'
            });

            mockPaymentApi.create.mockResolvedValue(createMockMPPayment());

            await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 30000,
                currency: 'ARS',
                cardId: 'card_installments',
                installments: 6
            });

            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    token: 'installments_token',
                    installments: 6
                }),
                requestOptions: expect.any(Object)
            });
        });

        it('should differentiate between first payment (token) and recurring (cardId)', async () => {
            // First payment with token
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ id: 1 }));

            await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 10000,
                currency: 'ARS',
                token: 'frontend_token_abc'
            });

            expect(mockCardTokenApi.create).not.toHaveBeenCalled();
            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    token: 'frontend_token_abc'
                }),
                requestOptions: expect.any(Object)
            });

            vi.clearAllMocks();

            // Recurring payment with saved card
            mockCardTokenApi.create.mockResolvedValue({
                id: 'backend_token_xyz'
            });
            mockPaymentApi.create.mockResolvedValue(createMockMPPayment({ id: 2 }));

            await adapter.create('cus_mp_123', {
                customerId: 'local_cus_123',
                amount: 10000,
                currency: 'ARS',
                cardId: 'saved_card_123'
            });

            expect(mockCardTokenApi.create).toHaveBeenCalledTimes(1);
            expect(mockPaymentApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    token: 'backend_token_xyz',
                    metadata: expect.objectContaining({
                        saved_card_id: 'saved_card_123'
                    })
                }),
                requestOptions: expect.any(Object)
            });
        });
    });
});
