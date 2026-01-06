/**
 * Webhook Middleware Tests
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createWebhookMiddleware, createWebhookResponse, getWebhookEvent } from '../../src/middleware/webhook.middleware.js';
import type { QZPayWebhookEnv } from '../../src/types.js';
import { createMockBilling, createMockPaymentAdapter, createMockWebhookEvent } from '../helpers/hono-mocks.js';

describe('Webhook Middleware', () => {
    describe('createWebhookMiddleware', () => {
        it('should verify signature and parse webhook event', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => {
                    const event = c.get('webhookEvent');
                    return c.json({ eventType: event.type });
                }
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'valid_sig' },
                body: JSON.stringify({ type: 'payment.created' })
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.eventType).toBe('payment.created');
            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalled();
        });

        it('should return 401 for invalid signature', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            vi.mocked(mockAdapter.webhooks?.verifySignature).mockReturnValue(false);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => c.json({ received: true })
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'invalid_sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Invalid webhook signature');
        });

        it('should skip signature verification when disabled', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter,
                    verifySignature: false
                }),
                (c) => {
                    const event = c.get('webhookEvent');
                    return c.json({ eventType: event.type });
                }
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                body: 'payload'
            });

            expect(response.status).toBe(200);
            expect(mockAdapter.webhooks?.verifySignature).not.toHaveBeenCalled();
        });

        it('should use default stripe-signature header for Stripe', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => c.json({ received: true })
            );

            await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'test_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'test_sig');
        });

        it('should use default x-signature header for MercadoPago', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('mercadopago');

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => c.json({ received: true })
            );

            await app.request('/webhook', {
                method: 'POST',
                headers: { 'x-signature': 'test_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'test_sig');
        });

        it('should use custom signature header when provided', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('custom');

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter,
                    signatureHeader: 'x-custom-signature'
                }),
                (c) => c.json({ received: true })
            );

            await app.request('/webhook', {
                method: 'POST',
                headers: { 'x-custom-signature': 'custom_sig' },
                body: 'payload'
            });

            expect(mockAdapter.webhooks?.verifySignature).toHaveBeenCalledWith('payload', 'custom_sig');
        });

        it('should return 500 when adapter does not support webhooks', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe', false);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter,
                    verifySignature: false
                }),
                (c) => c.json({ received: true })
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                body: 'payload'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Payment adapter does not support webhooks');
        });

        it('should return 400 when event parsing fails', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockImplementation(() => {
                throw new Error('Invalid payload');
            });

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => c.json({ received: true })
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'invalid_payload'
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid payload');
        });

        it('should set all webhook variables on context', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('payment.created', { amount: 1000 });
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => {
                    return c.json({
                        hasQzpay: !!c.get('qzpay'),
                        eventType: c.get('webhookEvent').type,
                        hasPayload: !!c.get('webhookPayload'),
                        signature: c.get('webhookSignature')
                    });
                }
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'test_signature' },
                body: '{"type":"payment.created"}'
            });
            const data = await response.json();

            expect(data.hasQzpay).toBe(true);
            expect(data.eventType).toBe('payment.created');
            expect(data.hasPayload).toBe(true);
            expect(data.signature).toBe('test_signature');
        });

        it('should handle empty signature header', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            vi.mocked(mockAdapter.webhooks?.verifySignature).mockReturnValue(false);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => c.json({ received: true })
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                body: 'payload'
            });

            expect(response.status).toBe(401);
        });
    });

    describe('createWebhookResponse', () => {
        it('should create success response', async () => {
            const app = new Hono();

            app.post('/test', (c) => {
                const webhookResponse = createWebhookResponse(c);
                return webhookResponse.success();
            });

            const response = await app.request('/test', { method: 'POST' });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.received).toBe(true);
        });

        it('should create error response with default status', async () => {
            const app = new Hono();

            app.post('/test', (c) => {
                const webhookResponse = createWebhookResponse(c);
                return webhookResponse.error('Something went wrong');
            });

            const response = await app.request('/test', { method: 'POST' });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Something went wrong');
        });

        it('should create error response with custom status', async () => {
            const app = new Hono();

            app.post('/test', (c) => {
                const webhookResponse = createWebhookResponse(c);
                return webhookResponse.error('Not found', 404);
            });

            const response = await app.request('/test', { method: 'POST' });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Not found');
        });

        it('should create skip response', async () => {
            const app = new Hono();

            app.post('/test', (c) => {
                const webhookResponse = createWebhookResponse(c);
                return webhookResponse.skip();
            });

            const response = await app.request('/test', { method: 'POST' });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.skipped).toBe(true);
        });

        it('should handle invalid error status', async () => {
            const app = new Hono();

            app.post('/test', (c) => {
                const webhookResponse = createWebhookResponse(c);
                return webhookResponse.error('Error', 200);
            });

            const response = await app.request('/test', { method: 'POST' });

            // Invalid status (200) should default to 400
            expect(response.status).toBe(400);
        });
    });

    describe('getWebhookEvent', () => {
        it('should return webhook event from context', async () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter('stripe');
            const mockEvent = createMockWebhookEvent('subscription.created', { id: 'sub_123' });
            vi.mocked(mockAdapter.webhooks?.constructEvent).mockReturnValue(mockEvent);

            const app = new Hono<QZPayWebhookEnv>();

            app.post(
                '/webhook',
                createWebhookMiddleware({
                    billing: mockBilling,
                    paymentAdapter: mockAdapter
                }),
                (c) => {
                    const event = getWebhookEvent(c);
                    return c.json({
                        eventId: event.id,
                        eventType: event.type
                    });
                }
            );

            const response = await app.request('/webhook', {
                method: 'POST',
                headers: { 'stripe-signature': 'sig' },
                body: 'payload'
            });
            const data = await response.json();

            expect(data.eventType).toBe('subscription.created');
        });
    });
});
