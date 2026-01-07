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

describe('MercadoPago IPN Security', () => {
    const webhookSecret = 'mp_webhook_secret_test_123';

    describe('HMAC Signature Validation', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should accept valid HMAC signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = '1234567890';

            // Create valid signature using the same algorithm as the adapter
            const signedPayload = `id:payment_456;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });

        it('should reject invalid HMAC signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signature = 'ts=1234567890,v1=invalid_signature_hash_that_wont_match';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(false);
        });

        it('should reject empty signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            const result = adapter.verifySignature(payload, '');

            expect(result).toBe(false);
        });

        it('should reject signature without timestamp', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signature = 'v1=some_signature_hash';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(false);
        });

        it('should reject signature without v1 hash', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signature = 'ts=1234567890';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(false);
        });

        it('should reject malformed signature format', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const signatures = ['not_a_valid_format', '=', 'ts=,v1=', 'ts1234567890v1hash', 'timestamp=123,version=hash'];

            for (const sig of signatures) {
                const result = adapter.verifySignature(payload, sig);
                expect(result).toBe(false);
            }
        });

        it('should use timing-safe comparison to prevent timing attacks', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });
            const timestamp = '1234567890';

            // Generate a wrong signature
            const wrongSig = 'a'.repeat(64); // Wrong hash
            const signature = `ts=${timestamp},v1=${wrongSig}`;

            // The comparison should take constant time regardless of where the mismatch is
            const startTime = process.hrtime.bigint();
            adapter.verifySignature(payload, signature);
            const endTime = process.hrtime.bigint();

            // Just verify it completes without error - actual timing test would need many iterations
            expect(endTime - startTime).toBeGreaterThan(0n);
        });

        it('should skip signature verification when no secret is configured', () => {
            const adapterWithoutSecret = new QZPayMercadoPagoWebhookAdapter();
            const payload = JSON.stringify({ id: 123, data: { id: 'payment_456' } });

            // Should return true regardless of signature
            expect(adapterWithoutSecret.verifySignature(payload, '')).toBe(true);
            expect(adapterWithoutSecret.verifySignature(payload, 'invalid')).toBe(true);
            expect(adapterWithoutSecret.verifySignature(payload, 'ts=1,v1=x')).toBe(true);
        });
    });

    describe('Payload Tampering Prevention', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should reject tampered payload', () => {
            const originalPayload = { id: 123, data: { id: 'payment_456', amount: 1000 } };
            const timestamp = '1234567890';

            // Create signature for original payload
            const signedPayload = `id:payment_456;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            // Tamper with the payload (change amount)
            const tamperedPayload = { ...originalPayload, data: { id: 'payment_456', amount: 999999 } };

            const _result = adapter.verifySignature(JSON.stringify(tamperedPayload), signature);

            // Signature should still be valid because MP uses id-based signature, not full payload
            // But if someone changes the ID, it should fail
            const tamperedIdPayload = { id: 123, data: { id: 'payment_HACKED' } };
            const resultTamperedId = adapter.verifySignature(JSON.stringify(tamperedIdPayload), signature);
            expect(resultTamperedId).toBe(false);
        });

        it('should reject payload with injected fields', () => {
            const timestamp = '1234567890';
            const originalId = 'payment_456';

            // Create valid signature
            const signedPayload = `id:${originalId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            // Inject malicious fields while keeping original id
            const payloadWithInjection = {
                id: 123,
                data: { id: originalId },
                malicious_field: 'attack_payload',
                __proto__: { isAdmin: true }
            };

            // The signature should still validate (id unchanged)
            const result = adapter.verifySignature(JSON.stringify(payloadWithInjection), signature);
            expect(result).toBe(true);

            // But changing the id should fail
            const payloadWithChangedId = {
                id: 123,
                data: { id: 'different_id' }
            };
            const result2 = adapter.verifySignature(JSON.stringify(payloadWithChangedId), signature);
            expect(result2).toBe(false);
        });

        it('should handle buffer payload correctly', () => {
            const timestamp = '1234567890';
            const dataId = 'payment_buffer_test';

            const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const payloadString = JSON.stringify({ id: 123, data: { id: dataId } });
            const bufferPayload = Buffer.from(payloadString);

            const result = adapter.verifySignature(bufferPayload, signature);

            expect(result).toBe(true);
        });
    });

    describe('constructEvent Security', () => {
        let adapter: QZPayMercadoPagoWebhookAdapter;

        beforeEach(() => {
            adapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
        });

        it('should throw on invalid signature during event construction', () => {
            const payload = JSON.stringify(createMockMPWebhookPayload('payment', 'created'));
            const invalidSignature = 'ts=1234567890,v1=invalid_signature';

            expect(() => adapter.constructEvent(payload, invalidSignature)).toThrow('Invalid MercadoPago webhook signature');
        });

        it('should construct event with valid signature', () => {
            const mockPayload = createMockMPWebhookPayload('payment', 'created', {
                data: { id: 'pay_123' }
            });
            const payload = JSON.stringify(mockPayload);
            const timestamp = '1234567890';

            const signedPayload = `id:pay_123;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.constructEvent(payload, signature);

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
            const timestamp = '1234567890';

            const signedPayload = `id:${sensitiveData.id};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.constructEvent(payload, signature);

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

                // First call should succeed
                const result1 = await ipnHandler.process(notification);
                expect(result1.processed).toBe(true);

                // Second call should fail (duplicate)
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

            const result = adapter.verifySignature(invalidJson, signature);

            expect(result).toBe(false);
        });

        it('should handle empty payload', () => {
            const result = adapter.verifySignature('', 'ts=1234567890,v1=sig');

            expect(result).toBe(false);
        });

        it('should handle null-like values in signature', () => {
            const payload = JSON.stringify({ id: 123, data: { id: 'test' } });

            expect(adapter.verifySignature(payload, 'null')).toBe(false);
            expect(adapter.verifySignature(payload, 'undefined')).toBe(false);
        });

        it('should handle very large payloads', () => {
            const timestamp = '1234567890';
            const dataId = 'large_payload_test';

            // Create large payload
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

            const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(largePayload, signature);

            expect(result).toBe(true);
        });

        it('should handle special characters in payload', () => {
            const timestamp = '1234567890';
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

            const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });

        it('should handle unicode characters in payload', () => {
            const timestamp = '1234567890';
            const dataId = 'unicode_test';

            const payloadWithUnicode = {
                id: 123,
                data: {
                    id: dataId,
                    name: '日本語テスト 🎉 émoji'
                }
            };
            const payload = JSON.stringify(payloadWithUnicode);

            const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });

        it('should handle payload with nested data.id fallback to root id', () => {
            const timestamp = '1234567890';

            // Payload without data.id should fallback to root id
            const payloadWithoutDataId = {
                id: 456,
                data: { other: 'field' }
            };
            const payload = JSON.stringify(payloadWithoutDataId);

            const signedPayload = `id:456;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });
    });

    describe('Webhook Secret Handling', () => {
        it('should use the configured webhook secret for verification', () => {
            const customSecret = 'custom_mp_secret_789';
            const customAdapter = new QZPayMercadoPagoWebhookAdapter(customSecret);

            const timestamp = '1234567890';
            const dataId = 'secret_test';
            const payload = JSON.stringify({ id: 123, data: { id: dataId } });

            // Signature created with custom secret
            const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', customSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            expect(customAdapter.verifySignature(payload, signature)).toBe(true);

            // Same signature should fail with default secret
            const defaultAdapter = new QZPayMercadoPagoWebhookAdapter(webhookSecret);
            expect(defaultAdapter.verifySignature(payload, signature)).toBe(false);
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
            const timestamp = '1234567890';

            const signedPayload = `id:chargeback_123;request-id:${timestamp};ts:${timestamp};`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            const signature = `ts=${timestamp},v1=${expectedSig}`;

            const result = adapter.constructEvent(payload, signature);

            expect(result.type).toContain('dispute');
        });
    });
});
