/**
 * Webhook Routes Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { createSimpleWebhookHandler, createWebhookRouter } from '../../src/routes/webhook.routes.js';
import { createMockBilling, createMockPaymentAdapter, createMockWebhookEvent } from '../helpers/hono-mocks.js';

describe('Webhook Routes', () => {
    describe('createWebhookRouter', () => {
        it('should handle webhook events', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'valid_sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.received).toBe(true);
        });

        it('should call specific event handler', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('customer.created', { id: 'cus_123' });
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const handlerFn = vi.fn();

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'customer.created': handlerFn
                }
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });

            expect(handlerFn).toHaveBeenCalled();
            expect(handlerFn.mock.calls[0][1]).toEqual(mockEvent);
        });

        it('should call onEvent handler for all events', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('invoice.paid');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const onEventFn = vi.fn();

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                onEvent: onEventFn
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });

            expect(onEventFn).toHaveBeenCalled();
        });

        it('should call both specific and generic handlers', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.updated');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const specificHandler = vi.fn();
            const genericHandler = vi.fn();

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'payment.updated': specificHandler
                },
                onEvent: genericHandler
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });

            expect(specificHandler).toHaveBeenCalled();
            expect(genericHandler).toHaveBeenCalled();
        });

        it('should return handler result if provided', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('custom.event');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'custom.event': async (c) => {
                        return c.json({ custom: 'response' }, 200);
                    }
                }
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(data.custom).toBe('response');
        });

        it('should call onError handler when an error occurs', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('error.event');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const onErrorFn = vi.fn().mockImplementation((_error, c) => {
                return c.json({ handled: 'error' }, 422);
            });

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'error.event': async () => {
                        throw new Error('Handler error');
                    }
                },
                onError: onErrorFn
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(onErrorFn).toHaveBeenCalled();
            expect(data.handled).toBe('error');
            expect(response.status).toBe(422);
        });

        it('should return 500 error when handler fails and no onError', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('failing.event');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'failing.event': async () => {
                        throw new Error('Processing failed');
                    }
                }
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Processing failed');
        });

        it('should use default stripe-signature header for stripe', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'test_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'test_sig');
        });

        it('should use default x-signature header for mercadopago', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('mercadopago');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'x-signature': 'mp_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'mp_sig');
        });

        it('should use custom signature header when provided', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('custom');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                signatureHeader: 'x-my-signature'
            });

            await router.request('/', {
                method: 'POST',
                headers: { 'x-my-signature': 'custom_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'custom_sig');
        });

        it('should return 401 for invalid signature', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            vi.mocked(mockAdapter.webhooks?.verifySignature).mockReturnValue(false);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'invalid' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Invalid webhook signature');
        });

        it('should handle non-Error thrown objects', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('test.event');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const router = createWebhookRouter({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                handlers: {
                    'test.event': async () => {
                        throw 'String error';
                    }
                }
            });

            const response = await router.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            // When a non-Error is thrown, the message is 'Webhook processing failed'
            expect(data.error).toBe('Webhook processing failed');
        });
    });

    describe('createSimpleWebhookHandler', () => {
        it('should create a simple webhook handler', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.succeeded');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const onEventFn = vi.fn();

            const handler = createSimpleWebhookHandler({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                onEvent: onEventFn
            });

            await handler.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });

            expect(onEventFn).toHaveBeenCalled();
        });

        it('should work with custom signature header', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('custom');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const handler = createSimpleWebhookHandler({
                billing: mockBilling,
                paymentAdapter: mockAdapter,
                signatureHeader: 'x-webhook-sig'
            });

            await handler.request('/', {
                method: 'POST',
                headers: { 'x-webhook-sig': 'custom_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'custom_sig');
        });

        it('should work without onEvent handler', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const handler = createSimpleWebhookHandler({
                billing: mockBilling,
                paymentAdapter: mockAdapter
            });

            const response = await handler.request('/', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.received).toBe(true);
        });
    });
});
