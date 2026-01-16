/**
 * MercadoPago Webhook Adapter Tests
 */
import * as crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { QZPayMercadoPagoWebhookAdapter } from '../src/adapters/webhook.adapter.js';
import { createMockMPWebhookPayload } from './helpers/mercadopago-mocks.js';

describe('QZPayMercadoPagoWebhookAdapter', () => {
    describe('constructEvent', () => {
        it('should construct event from payload', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();
            const payload = createMockMPWebhookPayload('payment', 'created');

            const result = adapter.constructEvent(JSON.stringify(payload), '');

            expect(result).toEqual({
                id: String(payload.id),
                type: 'payment.created',
                data: payload.data,
                created: expect.any(Date)
            });
        });

        it('should handle buffer payload', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();
            const payload = createMockMPWebhookPayload('payment', 'updated');
            const buffer = Buffer.from(JSON.stringify(payload));

            const result = adapter.constructEvent(buffer, '');

            expect(result.type).toBe('payment.updated');
        });

        it('should throw error for invalid signature when secret is set', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');
            const payload = createMockMPWebhookPayload('payment', 'created');

            expect(() => adapter.constructEvent(JSON.stringify(payload), 'invalid_signature')).toThrow(
                'Invalid MercadoPago webhook signature'
            );
        });

        it('should map payment events', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const createdPayload = createMockMPWebhookPayload('payment', 'created');
            const createdResult = adapter.constructEvent(JSON.stringify(createdPayload), '');
            expect(createdResult.type).toBe('payment.created');

            const updatedPayload = createMockMPWebhookPayload('payment', 'updated');
            const updatedResult = adapter.constructEvent(JSON.stringify(updatedPayload), '');
            expect(updatedResult.type).toBe('payment.updated');
        });

        it('should map subscription events', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const createdPayload = createMockMPWebhookPayload('subscription_preapproval', 'created');
            const createdResult = adapter.constructEvent(JSON.stringify(createdPayload), '');
            expect(createdResult.type).toBe('subscription.created');

            const updatedPayload = createMockMPWebhookPayload('subscription_preapproval', 'updated');
            const updatedResult = adapter.constructEvent(JSON.stringify(updatedPayload), '');
            expect(updatedResult.type).toBe('subscription.updated');
        });

        it('should map plan events', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const createdPayload = createMockMPWebhookPayload('plan', 'created');
            const createdResult = adapter.constructEvent(JSON.stringify(createdPayload), '');
            expect(createdResult.type).toBe('plan.created');

            const updatedPayload = createMockMPWebhookPayload('plan', 'updated');
            const updatedResult = adapter.constructEvent(JSON.stringify(updatedPayload), '');
            expect(updatedResult.type).toBe('plan.updated');
        });

        it('should map invoice payment event', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const payload = createMockMPWebhookPayload('subscription_authorized_payment', 'created');
            const result = adapter.constructEvent(JSON.stringify(payload), '');
            expect(result.type).toBe('invoice.paid');
        });

        it('should handle unknown event types', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const payload = createMockMPWebhookPayload('unknown_type', 'action');
            const result = adapter.constructEvent(JSON.stringify(payload), '');
            expect(result.type).toBe('unknown_type.action');
        });

        it('should handle event without action', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const payload = { ...createMockMPWebhookPayload('payment', ''), action: '' };
            const result = adapter.constructEvent(JSON.stringify(payload), '');
            expect(result.type).toBe('payment.updated'); // Falls back to pattern matching (default for payment)
        });
    });

    describe('verifySignature', () => {
        it('should return true when no secret is configured', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const result = adapter.verifySignature('any payload', 'any signature');

            expect(result).toBe(true);
        });

        it('should return false for invalid signature format', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const result = adapter.verifySignature('payload', 'invalid');

            expect(result).toBe(false);
        });

        it('should return false for missing timestamp', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const result = adapter.verifySignature('payload', 'v1=signature');

            expect(result).toBe(false);
        });

        it('should return false for missing signature', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const result = adapter.verifySignature('payload', 'ts=123456789');

            expect(result).toBe(false);
        });

        it('should verify correct signature', () => {
            const secret = 'test_webhook_secret';
            const adapter = new QZPayMercadoPagoWebhookAdapter(secret);

            const payload = JSON.stringify({ id: 123, data: { id: 'test_id' } });
            const timestamp = Math.floor(Date.now() / 1000).toString();

            // Create the expected signature
            const signedPayload = `id:test_id;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });

        it('should return false for wrong signature', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const payload = JSON.stringify({ id: 123, data: { id: 'test_id' } });
            const signature = 'ts=1234567890,v1=wrong_signature_hash_value_here_x';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(false);
        });

        it('should handle buffer payload for verification', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const buffer = Buffer.from('{"id": 123, "data": {"id": "test"}}');
            const result = adapter.verifySignature(buffer, 'ts=123,v1=invalid');

            expect(result).toBe(false);
        });

        it('should handle malformed JSON gracefully', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter('secret_123');

            const result = adapter.verifySignature('not json', 'ts=123,v1=sig');

            expect(result).toBe(false);
        });
    });

    describe('event type mapping patterns', () => {
        it('should map payment-related patterns', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            // Using pattern matching for payment events
            const paymentCreated = {
                type: 'payment.something',
                action: '',
                id: 1,
                date_created: new Date().toISOString(),
                user_id: '',
                api_version: '',
                live_mode: false,
                data: { id: '1' }
            };
            const result = adapter.constructEvent(JSON.stringify(paymentCreated), '');
            expect(result.type).toBe('payment.updated'); // Default for payment patterns
        });

        it('should map subscription-related patterns', () => {
            const adapter = new QZPayMercadoPagoWebhookAdapter();

            const subscriptionEvent = {
                type: 'preapproval.created',
                action: '',
                id: 1,
                date_created: new Date().toISOString(),
                user_id: '',
                api_version: '',
                live_mode: false,
                data: { id: '1' }
            };
            const result = adapter.constructEvent(JSON.stringify(subscriptionEvent), '');
            expect(result.type).toBe('subscription.created');
        });
    });
});
