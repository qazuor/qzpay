/**
 * Stripe Payment Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripePaymentAdapter } from '../src/adapters/payment.adapter.js';
import { createMockStripeClient, createMockStripePaymentIntent, createMockStripeRefund } from './helpers/stripe-mocks.js';

describe('QZPayStripePaymentAdapter', () => {
    let adapter: QZPayStripePaymentAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripePaymentAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a payment intent', async () => {
            const mockPI = createMockStripePaymentIntent({ id: 'pi_new123' });
            vi.mocked(mockStripe.paymentIntents.create).mockResolvedValue(mockPI);

            const result = await adapter.create('cus_123', {
                amount: 1000,
                currency: 'USD'
            });

            expect(result.id).toBe('pi_new123');
            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
                customer: 'cus_123',
                amount: 1000,
                currency: 'usd',
                metadata: {}
            });
        });

        it('should create and confirm with payment method', async () => {
            const mockPI = createMockStripePaymentIntent();
            vi.mocked(mockStripe.paymentIntents.create).mockResolvedValue(mockPI);

            await adapter.create('cus_123', {
                amount: 2000,
                currency: 'EUR',
                paymentMethodId: 'pm_123'
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_method: 'pm_123',
                    confirm: true
                })
            );
        });

        it('should include metadata', async () => {
            const mockPI = createMockStripePaymentIntent();
            vi.mocked(mockStripe.paymentIntents.create).mockResolvedValue(mockPI);

            await adapter.create('cus_123', {
                amount: 1000,
                currency: 'USD',
                metadata: { orderId: 'order_123' }
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { orderId: 'order_123' }
                })
            );
        });

        it('should map payment intent status correctly', async () => {
            const mockPI = createMockStripePaymentIntent({
                id: 'pi_123',
                status: 'requires_action',
                amount: 5000,
                currency: 'gbp'
            });
            vi.mocked(mockStripe.paymentIntents.create).mockResolvedValue(mockPI);

            const result = await adapter.create('cus_123', {
                amount: 5000,
                currency: 'GBP'
            });

            expect(result).toEqual({
                id: 'pi_123',
                status: 'requires_action',
                amount: 5000,
                currency: 'GBP',
                metadata: {}
            });
        });
    });

    describe('capture', () => {
        it('should capture a payment intent', async () => {
            const mockPI = createMockStripePaymentIntent({ status: 'succeeded' });
            vi.mocked(mockStripe.paymentIntents.capture).mockResolvedValue(mockPI);

            const result = await adapter.capture('pi_123');

            expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_123');
            expect(result.status).toBe('succeeded');
        });
    });

    describe('cancel', () => {
        it('should cancel a payment intent', async () => {
            const mockPI = createMockStripePaymentIntent({ status: 'canceled' });
            vi.mocked(mockStripe.paymentIntents.cancel).mockResolvedValue(mockPI);

            await adapter.cancel('pi_123');

            expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_123');
        });
    });

    describe('refund', () => {
        it('should create a full refund', async () => {
            const mockRefund = createMockStripeRefund({ id: 're_123', amount: 1000 });
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            const result = await adapter.refund({}, 'pi_123');

            expect(mockStripe.refunds.create).toHaveBeenCalledWith({
                payment_intent: 'pi_123'
            });
            expect(result).toEqual({
                id: 're_123',
                status: 'succeeded',
                amount: 1000
            });
        });

        it('should create a partial refund', async () => {
            const mockRefund = createMockStripeRefund({ amount: 500 });
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            const result = await adapter.refund({ amount: 500 }, 'pi_123');

            expect(mockStripe.refunds.create).toHaveBeenCalledWith({
                payment_intent: 'pi_123',
                amount: 500
            });
            expect(result.amount).toBe(500);
        });

        it('should include refund reason - duplicate', async () => {
            const mockRefund = createMockStripeRefund();
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            await adapter.refund({ reason: 'duplicate' }, 'pi_123');

            expect(mockStripe.refunds.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'duplicate'
                })
            );
        });

        it('should include refund reason - fraudulent', async () => {
            const mockRefund = createMockStripeRefund();
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            await adapter.refund({ reason: 'fraudulent' }, 'pi_123');

            expect(mockStripe.refunds.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'fraudulent'
                })
            );
        });

        it('should map unknown reason to requested_by_customer', async () => {
            const mockRefund = createMockStripeRefund();
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            await adapter.refund({ reason: 'some_other_reason' }, 'pi_123');

            expect(mockStripe.refunds.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'requested_by_customer'
                })
            );
        });

        it('should handle refund with pending status', async () => {
            const mockRefund = createMockStripeRefund({ status: 'pending' });
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            const result = await adapter.refund({}, 'pi_123');

            expect(result.status).toBe('pending');
        });

        it('should handle refund with null status', async () => {
            const mockRefund = createMockStripeRefund({ status: null } as never);
            vi.mocked(mockStripe.refunds.create).mockResolvedValue(mockRefund);

            const result = await adapter.refund({}, 'pi_123');

            expect(result.status).toBe('pending');
        });
    });

    describe('retrieve', () => {
        it('should retrieve a payment intent', async () => {
            const mockPI = createMockStripePaymentIntent({
                id: 'pi_123',
                status: 'succeeded',
                amount: 2500,
                currency: 'eur',
                metadata: { key: 'value' }
            });
            vi.mocked(mockStripe.paymentIntents.retrieve).mockResolvedValue(mockPI);

            const result = await adapter.retrieve('pi_123');

            expect(result).toEqual({
                id: 'pi_123',
                status: 'succeeded',
                amount: 2500,
                currency: 'EUR',
                metadata: { key: 'value' }
            });
        });

        it('should map all payment intent statuses', async () => {
            const statuses = [
                'requires_payment_method',
                'requires_confirmation',
                'requires_action',
                'processing',
                'requires_capture',
                'canceled',
                'succeeded'
            ] as const;

            for (const status of statuses) {
                const mockPI = createMockStripePaymentIntent({ status });
                vi.mocked(mockStripe.paymentIntents.retrieve).mockResolvedValue(mockPI);

                const result = await adapter.retrieve('pi_123');

                expect(result.status).toBe(status);
            }
        });
    });
});
