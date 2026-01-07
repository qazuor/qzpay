/**
 * Stripe Webhook Security Tests
 *
 * Tests for webhook signature validation, replay attack prevention,
 * and other security-related webhook handling scenarios.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeWebhookAdapter } from '../src/adapters/webhook.adapter.js';
import { createMockStripeClient, createMockStripeEvent } from './helpers/stripe-mocks.js';

describe('Stripe Webhook Security', () => {
    let adapter: QZPayStripeWebhookAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;
    const webhookSecret = 'whsec_test_secret_123';

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeWebhookAdapter(mockStripe, webhookSecret);
        vi.clearAllMocks();
    });

    describe('Signature Validation', () => {
        it('should accept valid signature', () => {
            const mockEvent = createMockStripeEvent('payment_intent.succeeded', { id: 'pi_123' });
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_123' } } });
            const validSignature = 't=1234567890,v1=valid_signature_hash';

            const result = adapter.verifySignature(payload, validSignature);

            expect(result).toBe(true);
            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, validSignature, webhookSecret);
        });

        it('should reject invalid signature', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                const error = new Error('No signatures found matching the expected signature for payload');
                error.name = 'StripeSignatureVerificationError';
                throw error;
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const invalidSignature = 't=1234567890,v1=invalid_signature';

            const result = adapter.verifySignature(payload, invalidSignature);

            expect(result).toBe(false);
        });

        it('should reject empty signature', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('No stripe-signature header value was provided');
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });

            const result = adapter.verifySignature(payload, '');

            expect(result).toBe(false);
        });

        it('should reject malformed signature header', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('Unable to extract timestamp and signatures from header');
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const malformedSignature = 'not_a_valid_signature_format';

            const result = adapter.verifySignature(payload, malformedSignature);

            expect(result).toBe(false);
        });

        it('should reject signature with missing timestamp', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('Unable to extract timestamp and signatures from header');
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const signatureWithoutTimestamp = 'v1=some_signature_hash';

            const result = adapter.verifySignature(payload, signatureWithoutTimestamp);

            expect(result).toBe(false);
        });

        it('should reject signature with missing v1 hash', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature for payload');
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const signatureWithoutHash = 't=1234567890';

            const result = adapter.verifySignature(payload, signatureWithoutHash);

            expect(result).toBe(false);
        });
    });

    describe('Timestamp Validation (Replay Attack Prevention)', () => {
        it('should reject expired timestamp (older than tolerance)', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                const error = new Error('Timestamp outside the tolerance zone');
                error.name = 'StripeSignatureVerificationError';
                throw error;
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            // Timestamp from 10 minutes ago (default tolerance is 5 minutes / 300 seconds)
            const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
            const expiredSignature = `t=${oldTimestamp},v1=valid_hash`;

            const result = adapter.verifySignature(payload, expiredSignature);

            expect(result).toBe(false);
        });

        it('should reject future timestamp', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                const error = new Error('Timestamp outside the tolerance zone');
                error.name = 'StripeSignatureVerificationError';
                throw error;
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            // Timestamp 10 minutes in the future
            const futureTimestamp = Math.floor(Date.now() / 1000) + 600;
            const futureSignature = `t=${futureTimestamp},v1=valid_hash`;

            const result = adapter.verifySignature(payload, futureSignature);

            expect(result).toBe(false);
        });

        it('should accept timestamp within tolerance window', () => {
            const mockEvent = createMockStripeEvent('payment_intent.succeeded');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            // Timestamp from 2 minutes ago (within 5 minute tolerance)
            const recentTimestamp = Math.floor(Date.now() / 1000) - 120;
            const validSignature = `t=${recentTimestamp},v1=valid_hash`;

            const result = adapter.verifySignature(payload, validSignature);

            expect(result).toBe(true);
        });
    });

    describe('Payload Tampering Prevention', () => {
        it('should reject tampered payload', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature for payload');
            });

            // Original payload was signed, but we're sending modified version
            const tamperedPayload = JSON.stringify({
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_123', amount: 999999 } } // Amount was changed
            });
            const originalSignature = 't=1234567890,v1=signature_for_original_payload';

            const result = adapter.verifySignature(tamperedPayload, originalSignature);

            expect(result).toBe(false);
        });

        it('should reject payload with injected fields', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature for payload');
            });

            const payloadWithInjection = JSON.stringify({
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_123' } },
                injected_field: 'malicious_data'
            });
            const signature = 't=1234567890,v1=original_signature';

            const result = adapter.verifySignature(payloadWithInjection, signature);

            expect(result).toBe(false);
        });

        it('should handle binary/buffer payload correctly', () => {
            const mockEvent = createMockStripeEvent('payment_intent.succeeded');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payloadString = JSON.stringify({ type: 'payment_intent.succeeded' });
            const bufferPayload = Buffer.from(payloadString);
            const signature = 't=1234567890,v1=valid_signature';

            const result = adapter.verifySignature(bufferPayload, signature);

            expect(result).toBe(true);
            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(bufferPayload, signature, webhookSecret);
        });
    });

    describe('constructEvent Security', () => {
        it('should throw on invalid signature during event construction', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const invalidSignature = 'invalid';

            expect(() => adapter.constructEvent(payload, invalidSignature)).toThrow();
        });

        it('should return properly structured event on valid signature', () => {
            const mockEvent = createMockStripeEvent('customer.subscription.created', {
                id: 'sub_123',
                customer: 'cus_456'
            });
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({ type: 'customer.subscription.created' });
            const validSignature = 't=1234567890,v1=valid_signature';

            const result = adapter.constructEvent(payload, validSignature);

            expect(result).toEqual({
                id: 'evt_test123',
                type: 'customer.subscription.created',
                data: expect.objectContaining({ id: 'sub_123', customer: 'cus_456' }),
                created: expect.any(Date)
            });
        });

        it('should preserve event data integrity', () => {
            const sensitiveData = {
                id: 'pi_123',
                amount: 10000,
                currency: 'usd',
                customer: 'cus_456',
                metadata: { order_id: 'order_789' }
            };
            const mockEvent = createMockStripeEvent('payment_intent.succeeded', sensitiveData);
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: sensitiveData } });
            const signature = 't=1234567890,v1=valid_signature';

            const result = adapter.constructEvent(payload, signature);

            expect(result.data).toEqual(expect.objectContaining(sensitiveData));
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle JSON parse errors gracefully', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new SyntaxError('Unexpected token in JSON');
            });

            const invalidJson = 'not valid json {{{';
            const signature = 't=1234567890,v1=some_signature';

            const result = adapter.verifySignature(invalidJson, signature);

            expect(result).toBe(false);
        });

        it('should handle empty payload', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('No webhook payload was provided');
            });

            const result = adapter.verifySignature('', 't=1234567890,v1=signature');

            expect(result).toBe(false);
        });

        it('should handle null-like values in signature', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const payload = JSON.stringify({ type: 'test' });

            // Test with various null-like values
            expect(adapter.verifySignature(payload, 'null')).toBe(false);
            expect(adapter.verifySignature(payload, 'undefined')).toBe(false);
        });

        it('should handle very large payloads', () => {
            const mockEvent = createMockStripeEvent('invoice.created');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            // Create a large payload (simulating invoice with many line items)
            const largeData = {
                type: 'invoice.created',
                data: {
                    object: {
                        id: 'in_123',
                        lines: Array(1000)
                            .fill(null)
                            .map((_, i) => ({
                                id: `li_${i}`,
                                amount: 1000,
                                description: `Line item ${i}`
                            }))
                    }
                }
            };
            const largePayload = JSON.stringify(largeData);
            const signature = 't=1234567890,v1=valid_signature';

            const result = adapter.verifySignature(largePayload, signature);

            expect(result).toBe(true);
        });

        it('should handle special characters in payload', () => {
            const mockEvent = createMockStripeEvent('customer.updated', {
                id: 'cus_123',
                name: 'Test "User" <script>alert("xss")</script>',
                metadata: { note: 'Line1\nLine2\tTabbed' }
            });
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({
                type: 'customer.updated',
                data: {
                    object: {
                        name: 'Test "User" <script>alert("xss")</script>',
                        metadata: { note: 'Line1\nLine2\tTabbed' }
                    }
                }
            });
            const signature = 't=1234567890,v1=valid_signature';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });

        it('should handle unicode characters in payload', () => {
            const mockEvent = createMockStripeEvent('customer.updated', {
                id: 'cus_123',
                name: '日本語テスト 🎉 émoji'
            });
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({
                type: 'customer.updated',
                data: { object: { name: '日本語テスト 🎉 émoji' } }
            });
            const signature = 't=1234567890,v1=valid_signature';

            const result = adapter.verifySignature(payload, signature);

            expect(result).toBe(true);
        });
    });

    describe('Webhook Secret Handling', () => {
        it('should use the configured webhook secret for verification', () => {
            const customSecret = 'whsec_custom_secret_456';
            const customAdapter = new QZPayStripeWebhookAdapter(mockStripe, customSecret);

            const mockEvent = createMockStripeEvent('payment_intent.succeeded');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
            const signature = 't=1234567890,v1=valid_signature';

            customAdapter.verifySignature(payload, signature);

            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, customSecret);
        });
    });
});
