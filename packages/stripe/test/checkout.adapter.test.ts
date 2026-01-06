/**
 * Stripe Checkout Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeCheckoutAdapter } from '../src/adapters/checkout.adapter.js';
import { createMockStripeCheckoutSession, createMockStripeClient } from './helpers/stripe-mocks.js';

describe('QZPayStripeCheckoutAdapter', () => {
    let adapter: QZPayStripeCheckoutAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeCheckoutAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a payment mode checkout session', async () => {
            const mockSession = createMockStripeCheckoutSession({ id: 'cs_new123' });
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            const result = await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 2 }]
                },
                ['price_123']
            );

            expect(result.id).toBe('cs_new123');
            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
                line_items: [{ price: 'price_123', quantity: 2 }],
                mode: 'payment',
                success_url: 'https://example.com/success',
                cancel_url: 'https://example.com/cancel',
                metadata: {}
            });
        });

        it('should create a subscription mode checkout session', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'subscription',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_recurring', quantity: 1 }]
                },
                ['price_recurring']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'subscription'
                })
            );
        });

        it('should set customer ID when provided', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    customerId: 'cus_123'
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: 'cus_123'
                })
            );
        });

        it('should set customer email when no customer ID', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    customerEmail: 'test@example.com'
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer_email: 'test@example.com'
                })
            );
        });

        it('should set expiration time', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);
            const beforeCall = Math.floor(Date.now() / 1000);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    expiresInMinutes: 30
                },
                ['price_123']
            );

            const call = vi.mocked(mockStripe.checkout.sessions.create).mock.calls[0]?.[0];
            expect(call?.expires_at).toBeGreaterThanOrEqual(beforeCall + 30 * 60);
            expect(call?.expires_at).toBeLessThanOrEqual(beforeCall + 30 * 60 + 2);
        });

        it('should skip expiration when expiresInMinutes is 0', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    expiresInMinutes: 0
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    expires_at: expect.anything()
                })
            );
        });

        it('should enable promotion codes', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    allowPromoCodes: true
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    allow_promotion_codes: true
                })
            );
        });

        it('should include metadata', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_123', quantity: 1 }],
                    metadata: { orderId: 'order_123' }
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { orderId: 'order_123' }
                })
            );
        });

        it('should handle multiple line items', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [
                        { priceId: 'price_1', quantity: 2 },
                        { priceId: 'price_2', quantity: 3 }
                    ]
                },
                ['price_1', 'price_2']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    line_items: [
                        { price: 'price_1', quantity: 2 },
                        { price: 'price_2', quantity: 3 }
                    ]
                })
            );
        });

        it('should default quantity to 1', async () => {
            const mockSession = createMockStripeCheckoutSession();
            vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession);

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: []
                },
                ['price_123']
            );

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    line_items: [{ price: 'price_123', quantity: 1 }]
                })
            );
        });
    });

    describe('retrieve', () => {
        it('should retrieve a checkout session', async () => {
            const mockSession = createMockStripeCheckoutSession({
                id: 'cs_123',
                url: 'https://checkout.stripe.com/cs_123',
                status: 'complete',
                customer: 'cus_123',
                payment_intent: 'pi_123',
                subscription: 'sub_123',
                metadata: { key: 'value' }
            });
            vi.mocked(mockStripe.checkout.sessions.retrieve).mockResolvedValue(mockSession);

            const result = await adapter.retrieve('cs_123');

            expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_123', {
                expand: ['payment_intent', 'subscription']
            });
            expect(result).toEqual({
                id: 'cs_123',
                url: 'https://checkout.stripe.com/cs_123',
                status: 'complete',
                paymentIntentId: 'pi_123',
                subscriptionId: 'sub_123',
                customerId: 'cus_123',
                metadata: { key: 'value' }
            });
        });

        it('should handle expanded payment intent object', async () => {
            const mockSession = createMockStripeCheckoutSession({
                payment_intent: { id: 'pi_expanded' }
            } as never);
            vi.mocked(mockStripe.checkout.sessions.retrieve).mockResolvedValue(mockSession);

            const result = await adapter.retrieve('cs_123');

            expect(result.paymentIntentId).toBe('pi_expanded');
        });

        it('should handle expanded subscription object', async () => {
            const mockSession = createMockStripeCheckoutSession({
                subscription: { id: 'sub_expanded' }
            } as never);
            vi.mocked(mockStripe.checkout.sessions.retrieve).mockResolvedValue(mockSession);

            const result = await adapter.retrieve('cs_123');

            expect(result.subscriptionId).toBe('sub_expanded');
        });

        it('should handle missing optional fields', async () => {
            const mockSession = createMockStripeCheckoutSession({
                url: null,
                status: null,
                customer: null,
                payment_intent: null,
                subscription: null
            });
            vi.mocked(mockStripe.checkout.sessions.retrieve).mockResolvedValue(mockSession);

            const result = await adapter.retrieve('cs_123');

            expect(result.url).toBe('');
            expect(result.status).toBe('open');
            expect(result.customerId).toBeNull();
            expect(result.paymentIntentId).toBeNull();
            expect(result.subscriptionId).toBeNull();
        });

        it('should handle customer object', async () => {
            const mockSession = createMockStripeCheckoutSession({
                customer: { id: 'cus_expanded' }
            } as never);
            vi.mocked(mockStripe.checkout.sessions.retrieve).mockResolvedValue(mockSession);

            const result = await adapter.retrieve('cs_123');

            expect(result.customerId).toBe('cus_expanded');
        });
    });

    describe('expire', () => {
        it('should expire a checkout session', async () => {
            const mockSession = createMockStripeCheckoutSession({ status: 'expired' });
            vi.mocked(mockStripe.checkout.sessions.expire).mockResolvedValue(mockSession);

            await adapter.expire('cs_123');

            expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_123');
        });
    });
});
