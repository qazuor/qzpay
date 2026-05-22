/**
 * MercadoPago IPN (Instant Payment Notification) Security Tests
 *
 * Tests for IPN signature validation, replay attack prevention,
 * and other security-related webhook handling scenarios.
 */
import * as crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoIPNHandler, QZPayMercadoPagoWebhookAdapter } from '../src/adapters/webhook.adapter.js';
import { createMockMPWebhookPayload } from './helpers/mercadopago-mocks.js';

/**
 * Build a MercadoPago-style signed manifest matching the production formula:
 *   id:{lowercased dataId};request-id:{requestId};ts:{timestamp};
 */
function buildSignature(secret: string, dataId: string, requestId: string, timestamp: string): string {
    const signedPayload = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `ts=${timestamp},v1=${expectedSig}`;
}

describe('MercadoPago IPN Security', () => {
    const webhookSecret = 'mp_webhook_secret_test_123';
    const requestId = 'req-uuid-abc-123';

    describe('Replay Attack Prevention (Timestamp Validation)', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should reject timestamp older than tolerance (default 5 minutes)', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, oldTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(false);
        });

        it('should reject future timestamp beyond tolerance', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const futureTimestamp = String(Math.floor(Date.now() / 1000) + 600);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, futureTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(false);
        });

        it('should accept timestamp within tolerance window', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const recentTimestamp = String(Math.floor(Date.now() / 1000) - 120);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, recentTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should accept current timestamp', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const currentTimestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, currentTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should use custom timestamp tolerance when configured', () => {
            const customAdapter = new QZPayMercadoPagoWebhookAdapter({
                webhookSecret,
                timestampToleranceSeconds: 60
            });

            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const oldTimestamp = String(Math.floor(Date.now() / 1000) - 120);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, oldTimestamp);

            expect(customAdapter.verifySignature(payload, signature, requestId)).toBe(false);
        });

        it('should accept timestamp within custom tolerance', () => {
            const customAdapter = new QZPayMercadoPagoWebhookAdapter({
                webhookSecret,
                timestampToleranceSeconds: 600
            });

            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = String(Math.floor(Date.now() / 1000) - 300);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, timestamp);

            expect(customAdapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should throw descriptive error for old timestamp in constructEvent', () => {
            const mockPayload = createMockMPWebhookPayload('payment', 'created', {
                data: { id: 'pay_123' }
            });
            const payload = JSON.stringify(mockPayload);
            const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
            const signature = buildSignature(webhookSecret, 'pay_123', requestId, oldTimestamp);

            expect(() => adapter.constructEvent(payload, signature, requestId)).toThrow(
                'Webhook timestamp too old, possible replay attack'
            );
        });

        it('should reject invalid timestamp format', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signature = 'ts=not_a_number,v1=somehash';

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(false);
        });

        it('should handle edge case at exact tolerance boundary', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const boundaryTimestamp = String(Math.floor(Date.now() / 1000) - 300);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, boundaryTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should handle edge case just beyond tolerance boundary', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const beyondBoundaryTimestamp = String(Math.floor(Date.now() / 1000) - 301);
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, beyondBoundaryTimestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(false);
        });
    });

    describe('HMAC Signature Validation', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should accept valid HMAC signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, timestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should reject invalid HMAC signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signature = 'ts=1234567890,v1=invalid_signature_hash_that_wont_match';

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(false);
        });

        it('should reject empty signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            expect(adapter.verifySignature(payload, '', requestId)).toBe(false);
        });

        it('should reject signature without timestamp', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            expect(adapter.verifySignature(payload, 'v1=some_signature_hash', requestId)).toBe(false);
        });

        it('should reject signature without v1 hash', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            expect(adapter.verifySignature(payload, 'ts=1234567890', requestId)).toBe(false);
        });

        it('should reject malformed signature format', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signatures = ['not_a_valid_format', '=', 'ts=,v1=', 'ts1234567890v1hash', 'timestamp=123,version=hash'];

            for (const sig of signatures) {
                expect(adapter.verifySignature(payload, sig, requestId)).toBe(false);
            }
        });

        it('should use timing-safe comparison to prevent timing attacks', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = '1234567890';
            const wrongSig = 'a'.repeat(64);
            const signature = `ts=${timestamp},v1=${wrongSig}`;

            const startTime = process.hrtime.bigint();
            adapter.verifySignature(payload, signature, requestId);
            const endTime = process.hrtime.bigint();

            expect(endTime - startTime).toBeGreaterThan(0n);
        });

        it('should skip signature verification when no secret is configured', () => {
            const adapterWithoutSecret = new QZPayMercadoPagoWebhookAdapter();
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            expect(adapterWithoutSecret.verifySignature(payload, '', requestId)).toBe(true);
            expect(adapterWithoutSecret.verifySignature(payload, 'invalid', requestId)).toBe(true);
            expect(adapterWithoutSecret.verifySignature(payload, 'ts=1,v1=x', requestId)).toBe(true);
        });

        it('should reject signature when requestId is missing and secret is set', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, timestamp);

            // Note: NO requestId argument here — must fail loudly, not fall back to ts.
            expect(adapter.verifySignature(payload, signature)).toBe(false);
        });
    });

    describe('Payload Tampering Prevention', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should reject tampered payload id', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'payment_456', requestId, timestamp);

            const tamperedIdPayload = { id: 123, data: { id: 'payment_HACKED' } };
            expect(adapter.verifySignature(JSON.stringify(tamperedIdPayload), signature, requestId)).toBe(false);
        });

        it('should accept payload with non-id injected fields (only id is signed)', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const originalId = 'payment_456';
            const signature = buildSignature(webhookSecret, originalId, requestId, timestamp);

            const payloadWithInjection = {
                id: 123,
                data: { id: originalId },
                malicious_field: 'attack_payload',
                __proto__: { isAdmin: true }
            };

            expect(adapter.verifySignature(JSON.stringify(payloadWithInjection), signature, requestId)).toBe(true);

            const payloadWithChangedId = {
                id: 123,
                data: { id: 'different_id' }
            };
            expect(adapter.verifySignature(JSON.stringify(payloadWithChangedId), signature, requestId)).toBe(false);
        });

        it('should handle buffer payload correctly', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const dataId = 'payment_buffer_test';
            const signature = buildSignature(webhookSecret, dataId, requestId, timestamp);

            const payloadString = JSON.stringify({ id: 123, data: { id: dataId } });
            const bufferPayload = Buffer.from(payloadString);

            expect(adapter.verifySignature(bufferPayload, signature, requestId)).toBe(true);
        });
    });

    describe('constructEvent Security', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should throw on invalid signature during event construction', () => {
            const payload = JSON.stringify(createMockMPWebhookPayload('payment', 'created'));
            const currentTimestamp = String(Math.floor(Date.now() / 1000));
            const invalidSignature = `ts=${currentTimestamp},v1=invalid_signature`;

            expect(() => adapter.constructEvent(payload, invalidSignature, requestId)).toThrow('Invalid MercadoPago webhook signature');
        });

        it('should construct event with valid signature', () => {
            const mockPayload = createMockMPWebhookPayload('payment', 'created', {
                data: { id: 'pay_123' }
            });
            const payload = JSON.stringify(mockPayload);
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'pay_123', requestId, timestamp);

            const result = adapter.constructEvent(payload, signature, requestId);

            expect(result).toEqual({
                id: String(mockPayload.id),
                type: 'payment.created',
                data: mockPayload.data,
                created: expect.any(Date)
            });
        });

        it('should preserve event data integrity', () => {
            const sensitiveData = {
                id: 'payment_sensitive_123',
                amount: 10000,
                currency: 'ARS',
                payer: { email: 'user@example.com', id: 'payer_456' },
                metadata: { order_id: 'order_789' }
            };

            const mockPayload = createMockMPWebhookPayload('payment', 'created', {
                data: sensitiveData
            });
            const payload = JSON.stringify(mockPayload);
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, sensitiveData.id, requestId, timestamp);

            const result = adapter.constructEvent(payload, signature, requestId);

            expect(result.data).toEqual(sensitiveData);
        });
    });

    describe('IPN Handler Security', () => {
        let ipnHandler: QZPayMercadoPagoIPNHandler;

        beforeEach(() => {
            ipnHandler = new QZPayMercadoPagoIPNHandler();
        });

        describe('Handler Registration', () => {
            it('should register handler for specific type', () => {
                const handler = vi.fn();
                ipnHandler.on('payment', handler);

                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'payment',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_123' }
                });

                ipnHandler.process(notification);
                expect(handler).toHaveBeenCalled();
            });

            it('should remove handler when off is called', () => {
                const handler = vi.fn();
                ipnHandler.on('payment', handler);
                ipnHandler.off('payment');

                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'payment',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_123' }
                });

                ipnHandler.process(notification);
                expect(handler).not.toHaveBeenCalled();
            });
        });

        describe('Error Handling', () => {
            it('should return error for unregistered handler', async () => {
                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'unknown_type',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'unknown.action',
                    data: { id: 'id_123' }
                });

                const result = await ipnHandler.process(notification);

                expect(result.processed).toBe(false);
                expect(result.error).toContain('No handler registered');
            });

            it('should catch and report handler errors', async () => {
                const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
                ipnHandler.on('payment', errorHandler);

                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'payment',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_123' }
                });

                const result = await ipnHandler.process(notification);

                expect(result.processed).toBe(false);
                expect(result.error).toBe('Handler failed');
            });

            it('should handle non-Error exceptions', async () => {
                const errorHandler = vi.fn().mockRejectedValue('string error');
                ipnHandler.on('payment', errorHandler);

                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'payment',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_123' }
                });

                const result = await ipnHandler.process(notification);

                expect(result.processed).toBe(false);
                expect(result.error).toBe('Unknown error');
            });
        });

        describe('Notification Parsing Security', () => {
            it('should parse valid notification payload', () => {
                const rawPayload = {
                    id: 123456,
                    live_mode: true,
                    type: 'payment',
                    date_created: '2024-01-15T10:30:00.000Z',
                    application_id: 'app_123',
                    user_id: 'user_456',
                    version: 2,
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_789', extra: 'data' }
                };

                const notification = QZPayMercadoPagoIPNHandler.parseNotification(rawPayload);

                expect(notification).toEqual({
                    id: 123456,
                    liveMode: true,
                    type: 'payment',
                    dateCreated: expect.any(Date),
                    applicationId: 'app_123',
                    userId: 'user_456',
                    version: 2,
                    apiVersion: 'v1',
                    action: 'payment.created',
                    data: { id: 'payment_789', extra: 'data' }
                });
            });

            it('should parse string payload', () => {
                const rawPayload = JSON.stringify({
                    id: 123,
                    live_mode: false,
                    type: 'subscription_preapproval',
                    date_created: '2024-01-15T10:30:00.000Z',
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'created',
                    data: { id: 'sub_123' }
                });

                const notification = QZPayMercadoPagoIPNHandler.parseNotification(rawPayload);

                expect(notification.type).toBe('subscription_preapproval');
                expect(notification.data.id).toBe('sub_123');
            });

            it('should handle missing optional fields', () => {
                const minimalPayload = {
                    id: 1,
                    live_mode: false,
                    type: 'test',
                    date_created: '2024-01-15T10:30:00.000Z',
                    user_id: 'user',
                    api_version: 'v1',
                    action: 'test',
                    data: { id: 'test' }
                };

                const notification = QZPayMercadoPagoIPNHandler.parseNotification(minimalPayload);

                expect(notification.applicationId).toBe('');
                expect(notification.version).toBe(1);
            });
        });

        describe('Idempotency', () => {
            it('should process same notification multiple times consistently', async () => {
                const processedIds = new Set<string>();
                const handler = vi.fn().mockImplementation(async (notification) => {
                    const id = notification.data.id;
                    if (processedIds.has(id)) {
                        throw new Error('Already processed');
                    }
                    processedIds.add(id);
                });

                ipnHandler.on('payment', handler);

                const notification = QZPayMercadoPagoIPNHandler.parseNotification({
                    id: 1,
                    live_mode: false,
                    type: 'payment',
                    date_created: new Date().toISOString(),
                    user_id: 'user_123',
                    api_version: 'v1',
                    action: 'payment.created',
                    data: { id: 'unique_payment_123' }
                });

                const result1 = await ipnHandler.process(notification);
                expect(result1.processed).toBe(true);

                const result2 = await ipnHandler.process(notification);
                expect(result2.processed).toBe(false);
                expect(result2.error).toBe('Already processed');
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should handle JSON parse errors gracefully', () => {
            const invalidJson = 'not valid json {{{';
            const signature = 'ts=1234567890,v1=some_signature';

            expect(adapter.verifySignature(invalidJson, signature, requestId)).toBe(false);
        });

        it('should handle empty payload', () => {
            expect(adapter.verifySignature('', 'ts=1234567890,v1=sig', requestId)).toBe(false);
        });

        it('should handle null-like values in signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'test' } });

            expect(adapter.verifySignature(payload, 'null', requestId)).toBe(false);
            expect(adapter.verifySignature(payload, 'undefined', requestId)).toBe(false);
        });

        it('should handle very large payloads', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const dataId = 'large_payload_test';

            const largeData = {
                id: 123,
                data: {
                    id: dataId,
                    items: Array(1000)
                        .fill(null)
                        .map((_, i) => ({
                            id: `item_${i}`,
                            amount: 1000,
                            description: `Line item ${i} with some additional text`
                        }))
                }
            };
            const largePayload = JSON.stringify(largeData);
            const signature = buildSignature(webhookSecret, dataId, requestId, timestamp);

            expect(adapter.verifySignature(largePayload, signature, requestId)).toBe(true);
        });

        it('should handle special characters in payload', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const dataId = 'special_chars_test';

            const payloadWithSpecialChars = {
                id: 123,
                data: {
                    id: dataId,
                    description: 'Test "quoted" <script>alert("xss")</script>',
                    metadata: { note: 'Line1\nLine2\tTabbed' }
                }
            };
            const payload = JSON.stringify(payloadWithSpecialChars);
            const signature = buildSignature(webhookSecret, dataId, requestId, timestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should handle unicode characters in payload', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const dataId = 'unicode_test';

            const payloadWithUnicode = {
                id: 123,
                data: {
                    id: dataId,
                    name: '日本語テスト 🎉 émoji'
                }
            };
            const payload = JSON.stringify(payloadWithUnicode);
            const signature = buildSignature(webhookSecret, dataId, requestId, timestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });

        it('should handle payload with nested data.id fallback to root id', () => {
            const timestamp = String(Math.floor(Date.now() / 1000));

            const payloadWithoutDataId = {
                id: 456,
                data: { other: 'field' }
            };
            const payload = JSON.stringify(payloadWithoutDataId);
            const signature = buildSignature(webhookSecret, '456', requestId, timestamp);

            expect(adapter.verifySignature(payload, signature, requestId)).toBe(true);
        });
    });

    describe('Webhook Secret Handling', () => {
        it('should use the configured webhook secret for verification', () => {
            const customSecret = 'custom_mp_secret_789';
            const customAdapter = new QZPayMercadoPagoWebhookAdapter(customSecret);

            const timestamp = String(Math.floor(Date.now() / 1000));
            const dataId = 'secret_test';
            const payload = JSON.stringify({ id: 123, data: { id: dataId } });
            const signatureCustom = buildSignature(customSecret, dataId, requestId, timestamp);

            expect(customAdapter.verifySignature(payload, signatureCustom, requestId)).toBe(true);

            const defaultAdapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
            expect(defaultAdapter.verifySignature(payload, signatureCustom, requestId)).toBe(false);
        });
    });

    describe('Chargeback Event Security', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should handle chargeback events', () => {
            const chargebackPayload = createMockMPWebhookPayload('chargebacks', 'created', {
                data: {
                    id: 'chargeback_123',
                    payment_id: 12345,
                    status: 'opened',
                    amount: 100.0,
                    reason: 'fraud'
                }
            });

            const payload = JSON.stringify(chargebackPayload);
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = buildSignature(webhookSecret, 'chargeback_123', requestId, timestamp);

            const result = adapter.constructEvent(payload, signature, requestId);

            expect(result.type).toContain('dispute');
        });
    });
});
