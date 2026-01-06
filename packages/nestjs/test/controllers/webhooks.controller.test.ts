/**
 * Webhooks Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayWebhooksController } from '../../src/controllers/webhooks.controller.js';
import type { QZPayWebhookService } from '../../src/qzpay-webhook.service.js';
import { createMockWebhookEvent } from '../helpers/nestjs-mocks.js';

describe('QZPayWebhooksController', () => {
    let controller: QZPayWebhooksController;
    let mockWebhookService: QZPayWebhookService;

    beforeEach(() => {
        mockWebhookService = {
            constructEvent: vi.fn(),
            handleWebhook: vi.fn()
        } as unknown as QZPayWebhookService;

        controller = new QZPayWebhooksController(mockWebhookService);
    });

    describe('handleStripeWebhook', () => {
        it('should handle valid Stripe webhook with Buffer', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = Buffer.from(JSON.stringify({ type: 'payment.succeeded' }));
            const mockEvent = createMockWebhookEvent('payment.succeeded');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: true });
            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(rawBody.toString(), signature);
            expect(mockWebhookService.handleWebhook).toHaveBeenCalledWith(mockEvent);
        });

        it('should handle valid Stripe webhook with string', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = JSON.stringify({ type: 'payment.succeeded' });
            const mockEvent = createMockWebhookEvent('payment.succeeded');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: true });
            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(rawBody, signature);
            expect(mockWebhookService.handleWebhook).toHaveBeenCalledWith(mockEvent);
        });

        it('should handle missing raw body', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = null as unknown as Buffer;

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: false, error: 'Raw body not available' });
            expect(mockWebhookService.constructEvent).not.toHaveBeenCalled();
            expect(mockWebhookService.handleWebhook).not.toHaveBeenCalled();
        });

        it('should handle undefined raw body', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = undefined as unknown as Buffer;

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: false, error: 'Raw body not available' });
        });

        it('should handle signature verification failure', async () => {
            const signature = 'invalid_signature';
            const rawBody = Buffer.from(JSON.stringify({ type: 'payment.succeeded' }));

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: false, error: 'Invalid signature' });
            expect(mockWebhookService.handleWebhook).not.toHaveBeenCalled();
        });

        it('should handle webhook processing error', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = Buffer.from(JSON.stringify({ type: 'payment.succeeded' }));
            const mockEvent = createMockWebhookEvent('payment.succeeded');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockRejectedValue(new Error('Webhook processing failed'));

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: false, error: 'Webhook processing failed' });
        });

        it('should handle different event types', async () => {
            const signature = 't=1234567890,v1=signature123';
            const eventTypes = [
                'payment.succeeded',
                'payment.failed',
                'subscription.created',
                'subscription.updated',
                'subscription.cancelled',
                'invoice.paid'
            ];

            for (const eventType of eventTypes) {
                const rawBody = Buffer.from(JSON.stringify({ type: eventType }));
                const mockEvent = createMockWebhookEvent(eventType);

                vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
                vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

                const result = await controller.handleStripeWebhook(signature, rawBody);

                expect(result).toEqual({ received: true });
            }
        });

        it('should handle non-Error exceptions', async () => {
            const signature = 't=1234567890,v1=signature123';
            const rawBody = Buffer.from(JSON.stringify({ type: 'payment.succeeded' }));

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw 'String error'; // Non-Error exception
            });

            const result = await controller.handleStripeWebhook(signature, rawBody);

            expect(result).toEqual({ received: false, error: 'Unknown error' });
        });
    });

    describe('handleMercadoPagoWebhook', () => {
        it('should handle valid MercadoPago webhook', async () => {
            const signature = 'mp_signature_123';
            const body = { type: 'payment', data: { id: 'pay_123' } };
            const mockEvent = createMockWebhookEvent('payment.created', body.data);

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: true });
            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(JSON.stringify(body), signature);
            expect(mockWebhookService.handleWebhook).toHaveBeenCalledWith(mockEvent);
        });

        it('should handle MercadoPago payment notification', async () => {
            const signature = 'mp_signature_123';
            const body = {
                action: 'payment.updated',
                type: 'payment',
                data: { id: 'pay_123' }
            };
            const mockEvent = createMockWebhookEvent('payment.updated', body.data);

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: true });
        });

        it('should handle signature verification failure', async () => {
            const signature = 'invalid_signature';
            const body = { type: 'payment', data: { id: 'pay_123' } };

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Invalid signature' });
            expect(mockWebhookService.handleWebhook).not.toHaveBeenCalled();
        });

        it('should handle webhook processing error', async () => {
            const signature = 'mp_signature_123';
            const body = { type: 'payment', data: { id: 'pay_123' } };
            const mockEvent = createMockWebhookEvent('payment.created');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockRejectedValue(new Error('Processing failed'));

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Processing failed' });
        });

        it('should handle empty body', async () => {
            const signature = 'mp_signature_123';
            const body = {};
            const mockEvent = createMockWebhookEvent('payment.created');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: true });
            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(JSON.stringify(body), signature);
        });

        it('should handle non-Error exceptions', async () => {
            const signature = 'mp_signature_123';
            const body = { type: 'payment', data: { id: 'pay_123' } };

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw { message: 'Object error' }; // Non-Error exception
            });

            const result = await controller.handleMercadoPagoWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Unknown error' });
        });
    });

    describe('handleGenericWebhook', () => {
        it('should handle valid generic webhook', async () => {
            const signature = 'generic_signature_123';
            const body = { event: 'payment.created', data: { id: 'pay_123' } };
            const mockEvent = createMockWebhookEvent('payment.created', body.data);

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: true });
            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(JSON.stringify(body), signature);
            expect(mockWebhookService.handleWebhook).toHaveBeenCalledWith(mockEvent);
        });

        it('should handle custom webhook format', async () => {
            const signature = 'custom_sig_123';
            const body = {
                eventType: 'subscription.activated',
                payload: { subscriptionId: 'sub_123' },
                timestamp: Date.now()
            };
            const mockEvent = createMockWebhookEvent('subscription.activated', body.payload);

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: true });
        });

        it('should handle signature verification failure', async () => {
            const signature = 'invalid_signature';
            const body = { event: 'payment.created' };

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Invalid signature' });
            expect(mockWebhookService.handleWebhook).not.toHaveBeenCalled();
        });

        it('should handle webhook processing error', async () => {
            const signature = 'generic_signature_123';
            const body = { event: 'payment.created' };
            const mockEvent = createMockWebhookEvent('payment.created');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockRejectedValue(new Error('Handler failed'));

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Handler failed' });
        });

        it('should handle empty body', async () => {
            const signature = 'generic_signature_123';
            const body = {};
            const mockEvent = createMockWebhookEvent('webhook.received');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: true });
        });

        it('should handle complex nested body', async () => {
            const signature = 'generic_signature_123';
            const body = {
                event: 'order.completed',
                data: {
                    orderId: 'ord_123',
                    customer: { id: 'cus_123', email: 'test@example.com' },
                    items: [
                        { id: 'item_1', amount: 1000 },
                        { id: 'item_2', amount: 2000 }
                    ],
                    metadata: { source: 'api', version: 2 }
                }
            };
            const mockEvent = createMockWebhookEvent('order.completed', body.data);

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: true });
        });

        it('should handle non-Error exceptions', async () => {
            const signature = 'generic_signature_123';
            const body = { event: 'payment.created' };

            vi.mocked(mockWebhookService.constructEvent).mockImplementation(() => {
                throw null; // Non-Error exception
            });

            const result = await controller.handleGenericWebhook(signature, body);

            expect(result).toEqual({ received: false, error: 'Unknown error' });
        });

        it('should serialize body correctly for event construction', async () => {
            const signature = 'generic_signature_123';
            const body = {
                event: 'test.event',
                special: { chars: 'test\'s "quoted" value' }
            };
            const mockEvent = createMockWebhookEvent('test.event');

            vi.mocked(mockWebhookService.constructEvent).mockReturnValue(mockEvent);
            vi.mocked(mockWebhookService.handleWebhook).mockResolvedValue(undefined);

            await controller.handleGenericWebhook(signature, body);

            expect(mockWebhookService.constructEvent).toHaveBeenCalledWith(JSON.stringify(body), signature);
        });
    });
});
