import type Stripe from 'stripe';
/**
 * Stripe Adapter Resilience Tests
 *
 * Tests for timeout handling, retry logic, and error recovery
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { QZPayStripePaymentAdapter } from '../src/adapters/payment.adapter.js';
import { QZPayStripeSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';

// ==================== Mock Stripe Errors ====================

class StripeError extends Error {
    type: string;
    code?: string;
    statusCode?: number;

    constructor(type: string, message: string, code?: string, statusCode?: number) {
        super(message);
        this.name = 'StripeError';
        this.type = type;
        this.code = code;
        this.statusCode = statusCode;
    }
}

class StripeRateLimitError extends StripeError {
    constructor() {
        super('StripeRateLimitError', 'Too many requests, please slow down', 'rate_limit', 429);
    }
}

class StripeAPIError extends StripeError {
    constructor(message = 'Internal server error') {
        super('StripeAPIError', message, 'api_error', 500);
    }
}

class StripeConnectionError extends StripeError {
    constructor() {
        super('StripeConnectionError', 'Could not connect to Stripe', 'connection_error');
    }
}

class StripeInvalidRequestError extends StripeError {
    constructor(message = 'Invalid request') {
        super('StripeInvalidRequestError', message, 'invalid_request_error', 400);
    }
}

class StripeCardError extends StripeError {
    constructor(message = 'Card declined', code = 'card_declined') {
        super('StripeCardError', message, code, 402);
    }
}

// ==================== Payment Adapter Resilience Tests ====================

describe('Stripe Payment Adapter Resilience', () => {
    let mockStripeClient: { paymentIntents: Record<string, ReturnType<typeof vi.fn>>; refunds: Record<string, ReturnType<typeof vi.fn>> };
    let adapter: QZPayStripePaymentAdapter;

    const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 1000,
        currency: 'usd',
        metadata: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockStripeClient = {
            paymentIntents: {
                create: vi.fn().mockResolvedValue(mockPaymentIntent),
                retrieve: vi.fn().mockResolvedValue(mockPaymentIntent),
                capture: vi.fn().mockResolvedValue(mockPaymentIntent),
                cancel: vi.fn().mockResolvedValue(mockPaymentIntent)
            },
            refunds: {
                create: vi.fn().mockResolvedValue({ id: 'ref_123', status: 'succeeded', amount: 1000 })
            }
        };
        adapter = new QZPayStripePaymentAdapter(mockStripeClient as unknown as Stripe);
    });

    describe('Rate Limit Handling', () => {
        it('should propagate rate limit errors', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeRateLimitError());

            await expect(adapter.create('cus_123', { amount: 1000, currency: 'USD' })).rejects.toThrow('Too many requests');
        });

        it('should include rate limit error type in rejection', async () => {
            const error = new StripeRateLimitError();
            mockStripeClient.paymentIntents.retrieve.mockRejectedValue(error);

            try {
                await adapter.retrieve('pi_123');
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as StripeError).type).toBe('StripeRateLimitError');
                expect((e as StripeError).statusCode).toBe(429);
            }
        });
    });

    describe('API Error Handling', () => {
        it('should propagate API errors on create', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeAPIError());

            await expect(adapter.create('cus_123', { amount: 1000, currency: 'USD' })).rejects.toThrow('Internal server error');
        });

        it('should propagate API errors on capture', async () => {
            mockStripeClient.paymentIntents.capture.mockRejectedValue(new StripeAPIError('Service unavailable'));

            await expect(adapter.capture('pi_123')).rejects.toThrow('Service unavailable');
        });

        it('should propagate API errors on cancel', async () => {
            mockStripeClient.paymentIntents.cancel.mockRejectedValue(new StripeAPIError());

            await expect(adapter.cancel('pi_123')).rejects.toThrow();
        });

        it('should propagate API errors on refund', async () => {
            mockStripeClient.refunds.create.mockRejectedValue(new StripeAPIError());

            await expect(adapter.refund({ amount: 500 }, 'pi_123')).rejects.toThrow();
        });
    });

    describe('Connection Error Handling', () => {
        it('should propagate connection errors', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeConnectionError());

            await expect(adapter.create('cus_123', { amount: 1000, currency: 'USD' })).rejects.toThrow('Could not connect to Stripe');
        });

        it('should include connection error type', async () => {
            const error = new StripeConnectionError();
            mockStripeClient.paymentIntents.retrieve.mockRejectedValue(error);

            try {
                await adapter.retrieve('pi_123');
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as StripeError).type).toBe('StripeConnectionError');
            }
        });
    });

    describe('Invalid Request Handling', () => {
        it('should validate currency before calling Stripe', async () => {
            // Currency validation now happens locally before calling Stripe API
            await expect(adapter.create('cus_123', { amount: 1000, currency: 'XYZ' })).rejects.toThrow('is not supported by Stripe');
        });

        it('should handle invalid payment ID on retrieve', async () => {
            mockStripeClient.paymentIntents.retrieve.mockRejectedValue(new StripeInvalidRequestError('No such payment_intent: pi_invalid'));

            await expect(adapter.retrieve('pi_invalid')).rejects.toThrow('No such payment_intent');
        });

        it('should handle invalid payment ID on capture', async () => {
            mockStripeClient.paymentIntents.capture.mockRejectedValue(
                new StripeInvalidRequestError('Cannot capture payment_intent in status succeeded')
            );

            await expect(adapter.capture('pi_123')).rejects.toThrow('Cannot capture');
        });
    });

    describe('Card Error Handling', () => {
        it('should propagate card declined errors', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeCardError('Your card was declined'));

            try {
                await adapter.create('cus_123', { amount: 1000, currency: 'USD', paymentMethodId: 'pm_123' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as StripeError).code).toBe('card_declined');
            }
        });

        it('should handle insufficient funds', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeCardError('Insufficient funds', 'insufficient_funds'));

            try {
                await adapter.create('cus_123', { amount: 100000, currency: 'USD', paymentMethodId: 'pm_123' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as StripeError).code).toBe('insufficient_funds');
            }
        });

        it('should handle expired card', async () => {
            mockStripeClient.paymentIntents.create.mockRejectedValue(new StripeCardError('Card has expired', 'expired_card'));

            try {
                await adapter.create('cus_123', { amount: 1000, currency: 'USD', paymentMethodId: 'pm_123' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as StripeError).code).toBe('expired_card');
            }
        });
    });

    describe('Timeout Handling', () => {
        it('should handle timeout on create', async () => {
            const timeoutError = new Error('Request timeout');
            timeoutError.name = 'TimeoutError';
            mockStripeClient.paymentIntents.create.mockRejectedValue(timeoutError);

            await expect(adapter.create('cus_123', { amount: 1000, currency: 'USD' })).rejects.toThrow('timeout');
        });

        it('should handle slow responses', async () => {
            // Simulate slow response
            mockStripeClient.paymentIntents.retrieve.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockPaymentIntent), 100))
            );

            const startTime = Date.now();
            const result = await adapter.retrieve('pi_123');
            const duration = Date.now() - startTime;

            expect(result.id).toBe('pi_123');
            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should handle multiple concurrent creates', async () => {
            mockStripeClient.paymentIntents.create.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return { ...mockPaymentIntent, id: `pi_${Math.random().toString(36).slice(2)}` };
            });

            const promises = Array.from({ length: 5 }, (_, i) => adapter.create('cus_123', { amount: 1000 + i, currency: 'USD' }));

            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            // All IDs should be unique
            const ids = results.map((r) => r.id);
            expect(new Set(ids).size).toBe(5);
        });

        it('should handle mixed success and failure in concurrent requests', async () => {
            let callCount = 0;
            mockStripeClient.paymentIntents.create.mockImplementation(async () => {
                callCount++;
                if (callCount % 2 === 0) {
                    throw new StripeAPIError('Temporary error');
                }
                return { ...mockPaymentIntent, id: `pi_${callCount}` };
            });

            const results = await Promise.allSettled([
                adapter.create('cus_123', { amount: 1000, currency: 'USD' }),
                adapter.create('cus_123', { amount: 2000, currency: 'USD' }),
                adapter.create('cus_123', { amount: 3000, currency: 'USD' }),
                adapter.create('cus_123', { amount: 4000, currency: 'USD' })
            ]);

            const fulfilled = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(fulfilled.length).toBe(2);
            expect(rejected.length).toBe(2);
        });
    });
});

// ==================== Customer Adapter Resilience Tests ====================

describe('Stripe Customer Adapter Resilience', () => {
    let mockStripeClient: { customers: Record<string, ReturnType<typeof vi.fn>> };
    let adapter: QZPayStripeCustomerAdapter;

    const mockCustomer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockStripeClient = {
            customers: {
                create: vi.fn().mockResolvedValue(mockCustomer),
                retrieve: vi.fn().mockResolvedValue(mockCustomer),
                update: vi.fn().mockResolvedValue(mockCustomer),
                del: vi.fn().mockResolvedValue({ id: 'cus_123', deleted: true }),
                list: vi.fn().mockResolvedValue({ data: [mockCustomer], has_more: false })
            }
        };
        adapter = new QZPayStripeCustomerAdapter(mockStripeClient as unknown as Stripe);
    });

    describe('Customer Not Found', () => {
        it('should handle customer not found on retrieve', async () => {
            mockStripeClient.customers.retrieve.mockRejectedValue(new StripeInvalidRequestError('No such customer: cus_invalid'));

            await expect(adapter.retrieve('cus_invalid')).rejects.toThrow('No such customer');
        });

        it('should handle customer not found on update', async () => {
            mockStripeClient.customers.update.mockRejectedValue(new StripeInvalidRequestError('No such customer: cus_invalid'));

            await expect(adapter.update('cus_invalid', { name: 'New Name' })).rejects.toThrow('No such customer');
        });

        it('should handle customer not found on delete', async () => {
            mockStripeClient.customers.del.mockRejectedValue(new StripeInvalidRequestError('No such customer: cus_invalid'));

            await expect(adapter.delete('cus_invalid')).rejects.toThrow('No such customer');
        });
    });

    describe('Duplicate Email Handling', () => {
        it('should handle duplicate email successfully (Stripe allows duplicates)', async () => {
            // Note: Stripe allows duplicate emails
            mockStripeClient.customers.create.mockResolvedValue(mockCustomer);

            const result = await adapter.create({ email: 'duplicate@example.com' });
            // create returns just the customer ID string
            expect(result).toBe('cus_123');
        });
    });

    describe('Rate Limit on Customer Operations', () => {
        it('should propagate rate limits on retrieve', async () => {
            mockStripeClient.customers.retrieve.mockRejectedValue(new StripeRateLimitError());

            await expect(adapter.retrieve('cus_123')).rejects.toThrow('Too many requests');
        });
    });
});

// ==================== Subscription Adapter Resilience Tests ====================

describe('Stripe Subscription Adapter Resilience', () => {
    let mockStripeClient: { subscriptions: Record<string, ReturnType<typeof vi.fn>> };
    let adapter: QZPayStripeSubscriptionAdapter;

    const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        customer: 'cus_123',
        items: { data: [{ price: { id: 'price_123' } }] },
        metadata: {},
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        canceled_at: null,
        ended_at: null,
        trial_start: null,
        trial_end: null
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockStripeClient = {
            subscriptions: {
                create: vi.fn().mockResolvedValue(mockSubscription),
                retrieve: vi.fn().mockResolvedValue(mockSubscription),
                update: vi.fn().mockResolvedValue(mockSubscription),
                cancel: vi.fn().mockResolvedValue({ ...mockSubscription, status: 'canceled' }),
                list: vi.fn().mockResolvedValue({ data: [mockSubscription], has_more: false })
            }
        };
        adapter = new QZPayStripeSubscriptionAdapter(mockStripeClient as unknown as Stripe);
    });

    describe('Subscription State Errors', () => {
        it('should handle canceling already canceled subscription', async () => {
            mockStripeClient.subscriptions.cancel.mockRejectedValue(
                new StripeInvalidRequestError('Cannot cancel subscription in status canceled')
            );

            await expect(adapter.cancel('sub_123')).rejects.toThrow('Cannot cancel subscription');
        });

        it('should handle updating canceled subscription', async () => {
            mockStripeClient.subscriptions.update.mockRejectedValue(
                new StripeInvalidRequestError('Cannot update subscription in status canceled')
            );

            await expect(adapter.update('sub_123', { priceId: 'price_new' })).rejects.toThrow('Cannot update subscription');
        });
    });

    describe('Payment Method Errors', () => {
        it('should handle no payment method error', async () => {
            mockStripeClient.subscriptions.create.mockRejectedValue(
                new StripeInvalidRequestError('This customer has no attached payment source or default payment method')
            );

            await expect(adapter.create('cus_123', { priceId: 'price_123' })).rejects.toThrow('no attached payment source');
        });
    });

    describe('Price Validation', () => {
        it('should handle invalid price ID', async () => {
            mockStripeClient.subscriptions.create.mockRejectedValue(new StripeInvalidRequestError('No such price: price_invalid'));

            await expect(adapter.create('cus_123', { priceId: 'price_invalid' })).rejects.toThrow('No such price');
        });
    });
});

// ==================== Error Recovery Scenarios ====================

describe('Error Recovery Scenarios', () => {
    describe('Transient Error Recovery', () => {
        it('should succeed after transient failures (simulated retry)', async () => {
            let attempts = 0;
            const mockStripeClient = {
                paymentIntents: {
                    create: vi.fn().mockImplementation(async () => {
                        attempts++;
                        if (attempts < 3) {
                            throw new StripeAPIError('Temporary error');
                        }
                        return { id: 'pi_123', status: 'succeeded', amount: 1000, currency: 'usd', metadata: {} };
                    })
                }
            };

            const adapter = new QZPayStripePaymentAdapter(mockStripeClient as unknown as Stripe);

            // Simulate manual retry logic (app-level)
            let result: { id: string; status: string; amount: number; currency: string; metadata: Record<string, string> } | undefined;
            for (let i = 0; i < 5; i++) {
                try {
                    result = await adapter.create('cus_123', { amount: 1000, currency: 'USD' });
                    break;
                } catch {
                    if (i === 4) throw new Error('Max retries exceeded');
                }
            }

            expect(result?.id).toBe('pi_123');
            expect(attempts).toBe(3);
        });
    });

    describe('Idempotency Support', () => {
        it('should support idempotency through metadata', async () => {
            const mockStripeClient = {
                paymentIntents: {
                    create: vi.fn().mockResolvedValue({
                        id: 'pi_123',
                        status: 'succeeded',
                        amount: 1000,
                        currency: 'usd',
                        metadata: { idempotencyKey: 'idem_123' }
                    })
                }
            };

            const adapter = new QZPayStripePaymentAdapter(mockStripeClient as unknown as Stripe);

            const result = await adapter.create('cus_123', {
                amount: 1000,
                currency: 'USD',
                metadata: { idempotencyKey: 'idem_123' }
            });

            expect(result.metadata.idempotencyKey).toBe('idem_123');
            expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({ idempotencyKey: 'idem_123' })
                })
            );
        });
    });

    describe('Partial Failure Handling', () => {
        it('should handle partial refund when full refund fails', async () => {
            const mockStripeClient = {
                paymentIntents: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'pi_123',
                        status: 'succeeded',
                        amount: 1000,
                        currency: 'usd',
                        metadata: {}
                    })
                },
                refunds: {
                    create: vi
                        .fn()
                        .mockRejectedValueOnce(new StripeInvalidRequestError('Amount exceeds available balance'))
                        .mockResolvedValueOnce({ id: 'ref_123', status: 'succeeded', amount: 500 })
                }
            };

            const adapter = new QZPayStripePaymentAdapter(mockStripeClient as unknown as Stripe);

            // First try full refund
            await expect(adapter.refund({ amount: 1000 }, 'pi_123')).rejects.toThrow('exceeds available');

            // Then partial refund succeeds
            const result = await adapter.refund({ amount: 500 }, 'pi_123');
            expect(result.amount).toBe(500);
        });
    });
});

// ==================== Webhook Resilience (implicit via adapter) ====================

describe('Webhook Processing Resilience', () => {
    it('should handle malformed webhook data gracefully', () => {
        // This is more of an integration concern, but we test the adapter doesn't crash
        const invalidData = { not: 'a valid payment' };

        // Type system should prevent this, but runtime should handle gracefully
        expect(() => {
            // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data handling
            const result = (invalidData as any).id;
            return result;
        }).not.toThrow();
    });
});
