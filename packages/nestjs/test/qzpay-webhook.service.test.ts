/**
 * QZPay Webhook Service Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPayWebhookService } from '../src/qzpay-webhook.service.js';
import { createMockBilling, createMockPaymentAdapter, createMockWebhookEvent } from './helpers/nestjs-mocks.js';

describe('QZPayWebhookService', () => {
    describe('constructor', () => {
        it('should register default handlers', () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            // Default handlers are registered internally
            expect(service).toBeDefined();
        });
    });

    describe('registerHandler', () => {
        it('should register a custom handler', () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);
            const handler = vi.fn();

            service.registerHandler('custom.event', handler);

            // Handler should be registered (tested via handleWebhook)
            expect(service).toBeDefined();
        });
    });

    describe('unregisterHandler', () => {
        it('should unregister a handler', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);
            const handler = vi.fn();

            service.registerHandler('custom.event', handler);
            service.unregisterHandler('custom.event');

            const event = createMockWebhookEvent('custom.event');
            await service.handleWebhook(event);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('handleWebhook', () => {
        it('should call registered handler', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);
            const handler = vi.fn();

            service.registerHandler('test.event', handler);

            const event = createMockWebhookEvent('test.event', { data: 'test' });
            await service.handleWebhook(event);

            expect(handler).toHaveBeenCalledWith(event);
        });

        it('should handle default customer.created event', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            const event = createMockWebhookEvent('customer.created', { id: 'cus_123' });
            await expect(service.handleWebhook(event)).resolves.toBeUndefined();
        });

        it('should handle default subscription.created event', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            const event = createMockWebhookEvent('subscription.created', { id: 'sub_123' });
            await expect(service.handleWebhook(event)).resolves.toBeUndefined();
        });

        it('should handle default payment.succeeded event', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            const event = createMockWebhookEvent('payment.succeeded', { id: 'pay_123' });
            await expect(service.handleWebhook(event)).resolves.toBeUndefined();
        });

        it('should handle default payment.failed event', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            const event = createMockWebhookEvent('payment.failed', { id: 'pay_123' });
            await expect(service.handleWebhook(event)).resolves.toBeUndefined();
        });

        it('should not throw for unregistered events', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            const event = createMockWebhookEvent('unknown.event');
            await expect(service.handleWebhook(event)).resolves.toBeUndefined();
        });

        it('should throw when handler throws error', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);

            service.registerHandler('error.event', async () => {
                throw new Error('Handler error');
            });

            const event = createMockWebhookEvent('error.event');
            await expect(service.handleWebhook(event)).rejects.toThrow('Handler error');
        });

        it('should override default handler when custom handler registered', async () => {
            const mockBilling = createMockBilling();
            const service = new QZPayWebhookService(mockBilling);
            const customHandler = vi.fn();

            service.registerHandler('customer.created', customHandler);

            const event = createMockWebhookEvent('customer.created', { id: 'cus_123' });
            await service.handleWebhook(event);

            expect(customHandler).toHaveBeenCalledWith(event);
        });
    });

    describe('constructEvent', () => {
        it('should construct event from payload', () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(mockAdapter);

            const mockEvent = createMockWebhookEvent('payment.created');
            vi.mocked(mockAdapter.webhooks.constructEvent).mockReturnValue(mockEvent);

            const service = new QZPayWebhookService(mockBilling);
            const result = service.constructEvent('payload', 'signature');

            expect(result).toEqual(mockEvent);
            expect(mockAdapter.webhooks.constructEvent).toHaveBeenCalledWith('payload', 'signature');
        });

        it('should throw when payment adapter not configured', () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(null);

            const service = new QZPayWebhookService(mockBilling);

            expect(() => service.constructEvent('payload', 'signature')).toThrow('Payment adapter not configured');
        });
    });

    describe('verifySignature', () => {
        it('should verify valid signature', () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(mockAdapter);
            vi.mocked(mockAdapter.webhooks.verifySignature).mockReturnValue(true);

            const service = new QZPayWebhookService(mockBilling);
            const result = service.verifySignature('payload', 'valid_signature');

            expect(result).toBe(true);
            expect(mockAdapter.webhooks.verifySignature).toHaveBeenCalledWith('payload', 'valid_signature');
        });

        it('should reject invalid signature', () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(mockAdapter);
            vi.mocked(mockAdapter.webhooks.verifySignature).mockReturnValue(false);

            const service = new QZPayWebhookService(mockBilling);
            const result = service.verifySignature('payload', 'invalid_signature');

            expect(result).toBe(false);
        });

        it('should throw when payment adapter not configured', () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(null);

            const service = new QZPayWebhookService(mockBilling);

            expect(() => service.verifySignature('payload', 'signature')).toThrow('Payment adapter not configured');
        });

        it('should handle buffer payload', () => {
            const mockBilling = createMockBilling();
            const mockAdapter = createMockPaymentAdapter();
            vi.mocked(mockBilling.getPaymentAdapter).mockReturnValue(mockAdapter);
            vi.mocked(mockAdapter.webhooks.verifySignature).mockReturnValue(true);

            const service = new QZPayWebhookService(mockBilling);
            const bufferPayload = Buffer.from('payload');
            const result = service.verifySignature(bufferPayload, 'signature');

            expect(result).toBe(true);
        });
    });
});
