import * as crypto from 'node:crypto';
/**
 * Security Test Suite - Webhook Security
 *
 * Tests for webhook signature verification and replay attack prevention
 */
import { describe, expect, it } from 'vitest';

describe('Webhook Security Tests', () => {
    const webhookSecret = 'whsec_test_secret_key_12345';

    describe('Signature Verification', () => {
        function createValidSignature(payload: string, timestamp: number, secret: string): string {
            const signedPayload = `${timestamp}.${payload}`;
            const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
            return `t=${timestamp},v1=${signature}`;
        }

        it('should verify valid webhook signature', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_123' } });
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = createValidSignature(payload, timestamp, webhookSecret);

            const result = verifyWebhookSignature(payload, signature, webhookSecret);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid signature', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });
            const timestamp = Math.floor(Date.now() / 1000);
            const invalidSignature = `t=${timestamp},v1=invalid_signature`;

            const result = verifyWebhookSignature(payload, invalidSignature, webhookSecret);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('signature');
        });

        it('should reject tampered payload', () => {
            const originalPayload = JSON.stringify({ type: 'payment.succeeded', data: { amount: 100 } });
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = createValidSignature(originalPayload, timestamp, webhookSecret);

            // Tamper with payload
            const tamperedPayload = JSON.stringify({ type: 'payment.succeeded', data: { amount: 10000 } });

            const result = verifyWebhookSignature(tamperedPayload, signature, webhookSecret);
            expect(result.valid).toBe(false);
        });

        it('should reject missing signature header', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });

            const result = verifyWebhookSignature(payload, '', webhookSecret);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Missing signature');
        });

        it('should reject malformed signature header', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });
            const malformedSignatures = ['invalid', 't=123', 'v1=abc', '123,abc', 'signature=abc'];

            for (const sig of malformedSignatures) {
                const result = verifyWebhookSignature(payload, sig, webhookSecret);
                expect(result.valid).toBe(false);
            }
        });

        it('should use constant-time comparison to prevent timing attacks', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });
            const timestamp = Math.floor(Date.now() / 1000);

            // Create signatures with different first characters
            const sig1 = `t=${timestamp},v1=${'a'.repeat(64)}`;
            const sig2 = `t=${timestamp},v1=${'z'.repeat(64)}`;

            // Both should take approximately the same time
            const times1: number[] = [];
            const times2: number[] = [];

            for (let i = 0; i < 100; i++) {
                const start1 = performance.now();
                verifyWebhookSignature(payload, sig1, webhookSecret);
                times1.push(performance.now() - start1);

                const start2 = performance.now();
                verifyWebhookSignature(payload, sig2, webhookSecret);
                times2.push(performance.now() - start2);
            }

            const avg1 = times1.reduce((a, b) => a + b) / times1.length;
            const avg2 = times2.reduce((a, b) => a + b) / times2.length;

            // Times should be within 10% of each other (constant time)
            expect(Math.abs(avg1 - avg2)).toBeLessThan(avg1 * 0.1);
        });
    });

    describe('Replay Attack Prevention', () => {
        it('should reject webhooks older than tolerance window', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });
            const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
            const signature = createValidSignatureForTest(payload, oldTimestamp, webhookSecret);

            const result = verifyWebhookWithTimestamp(payload, signature, webhookSecret, {
                toleranceSeconds: 300 // 5 minute tolerance
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('expired');
        });

        it('should reject webhooks from the future', () => {
            const payload = JSON.stringify({ type: 'payment.succeeded' });
            const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
            const signature = createValidSignatureForTest(payload, futureTimestamp, webhookSecret);

            const result = verifyWebhookWithTimestamp(payload, signature, webhookSecret, {
                toleranceSeconds: 300
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('future');
        });

        it('should track and reject replayed webhook IDs', () => {
            const webhookId = 'evt_123456';
            const replayTracker = new WebhookReplayTracker();

            // First occurrence should be allowed
            expect(replayTracker.isReplay(webhookId)).toBe(false);
            replayTracker.record(webhookId);

            // Second occurrence should be blocked
            expect(replayTracker.isReplay(webhookId)).toBe(true);
        });

        it('should expire old webhook IDs from replay cache', async () => {
            const webhookId = 'evt_123456';
            const replayTracker = new WebhookReplayTracker({ ttlMs: 100 });

            replayTracker.record(webhookId);
            expect(replayTracker.isReplay(webhookId)).toBe(true);

            // Wait for TTL to expire
            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(replayTracker.isReplay(webhookId)).toBe(false);
        });
    });

    describe('Rate Limiting', () => {
        it('should limit webhook processing rate', () => {
            const rateLimiter = new WebhookRateLimiter({
                maxRequests: 10,
                windowMs: 1000
            });

            // First 10 requests should be allowed
            for (let i = 0; i < 10; i++) {
                expect(rateLimiter.isAllowed('source_123')).toBe(true);
            }

            // 11th request should be blocked
            expect(rateLimiter.isAllowed('source_123')).toBe(false);
        });

        it('should track rate limits per source', () => {
            const rateLimiter = new WebhookRateLimiter({
                maxRequests: 5,
                windowMs: 1000
            });

            // Different sources should have separate limits
            for (let i = 0; i < 5; i++) {
                expect(rateLimiter.isAllowed('source_1')).toBe(true);
                expect(rateLimiter.isAllowed('source_2')).toBe(true);
            }

            expect(rateLimiter.isAllowed('source_1')).toBe(false);
            expect(rateLimiter.isAllowed('source_2')).toBe(false);
        });
    });

    describe('Payload Size Limits', () => {
        it('should reject oversized payloads', () => {
            const largePayload = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte

            const result = validateWebhookPayloadSize(largePayload, { maxSizeBytes: 1024 * 1024 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('size');
        });

        it('should accept payloads within size limit', () => {
            const normalPayload = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_123' } });

            const result = validateWebhookPayloadSize(normalPayload, { maxSizeBytes: 1024 * 1024 });
            expect(result.valid).toBe(true);
        });
    });

    describe('Content Type Validation', () => {
        it('should only accept application/json content type', () => {
            expect(validateWebhookContentType('application/json')).toBe(true);
            expect(validateWebhookContentType('application/json; charset=utf-8')).toBe(true);
            expect(validateWebhookContentType('text/plain')).toBe(false);
            expect(validateWebhookContentType('application/x-www-form-urlencoded')).toBe(false);
            expect(validateWebhookContentType('')).toBe(false);
        });
    });

    describe('IP Allowlisting', () => {
        it('should validate webhook source IP', () => {
            const allowedIPs = ['185.166.142.0/24', '54.187.174.169', '54.187.205.235'];

            expect(validateWebhookSourceIP('185.166.142.50', allowedIPs)).toBe(true);
            expect(validateWebhookSourceIP('54.187.174.169', allowedIPs)).toBe(true);
            expect(validateWebhookSourceIP('192.168.1.1', allowedIPs)).toBe(false);
            expect(validateWebhookSourceIP('10.0.0.1', allowedIPs)).toBe(false);
        });
    });
});

// Helper implementations
function createValidSignatureForTest(payload: string, timestamp: number, secret: string): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `t=${timestamp},v1=${signature}`;
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): { valid: boolean; error?: string } {
    if (!signature) {
        return { valid: false, error: 'Missing signature header' };
    }

    const parts = signature.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
        return { valid: false, error: 'Malformed signature header' };
    }

    const timestamp = timestampPart.slice(2);
    const sig = signaturePart.slice(3);

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    // Constant-time comparison
    try {
        if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature))) {
            return { valid: true };
        }
    } catch {
        // Different lengths
    }

    return { valid: false, error: 'Invalid signature' };
}

function verifyWebhookWithTimestamp(
    payload: string,
    signature: string,
    secret: string,
    options: { toleranceSeconds: number }
): { valid: boolean; error?: string } {
    const baseResult = verifyWebhookSignature(payload, signature, secret);
    if (!baseResult.valid) return baseResult;

    const timestampPart = signature.split(',').find((p) => p.startsWith('t='));
    if (!timestampPart) return { valid: false, error: 'Missing timestamp' };

    const timestamp = Number.parseInt(timestampPart.slice(2), 10);
    const now = Math.floor(Date.now() / 1000);

    if (timestamp > now + 60) {
        return { valid: false, error: 'Timestamp too far in future' };
    }

    if (now - timestamp > options.toleranceSeconds) {
        return { valid: false, error: 'Webhook expired' };
    }

    return { valid: true };
}

class WebhookReplayTracker {
    private seen: Map<string, number> = new Map();
    private ttlMs: number;

    constructor(options: { ttlMs?: number } = {}) {
        this.ttlMs = options.ttlMs ?? 3600000; // 1 hour default
    }

    isReplay(webhookId: string): boolean {
        const recordedAt = this.seen.get(webhookId);
        if (!recordedAt) return false;

        if (Date.now() - recordedAt > this.ttlMs) {
            this.seen.delete(webhookId);
            return false;
        }

        return true;
    }

    record(webhookId: string): void {
        this.seen.set(webhookId, Date.now());
    }
}

class WebhookRateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(options: { maxRequests: number; windowMs: number }) {
        this.maxRequests = options.maxRequests;
        this.windowMs = options.windowMs;
    }

    isAllowed(source: string): boolean {
        const now = Date.now();
        const sourceRequests = this.requests.get(source) ?? [];

        // Remove old requests outside window
        const validRequests = sourceRequests.filter((timestamp) => now - timestamp < this.windowMs);

        if (validRequests.length >= this.maxRequests) {
            return false;
        }

        validRequests.push(now);
        this.requests.set(source, validRequests);
        return true;
    }
}

function validateWebhookPayloadSize(payload: string, options: { maxSizeBytes: number }): { valid: boolean; error?: string } {
    const size = Buffer.byteLength(payload, 'utf8');
    if (size > options.maxSizeBytes) {
        return { valid: false, error: `Payload size ${size} exceeds max ${options.maxSizeBytes}` };
    }
    return { valid: true };
}

function validateWebhookContentType(contentType: string): boolean {
    if (!contentType) return false;
    return contentType.toLowerCase().startsWith('application/json');
}

function validateWebhookSourceIP(ip: string, allowedRanges: string[]): boolean {
    for (const range of allowedRanges) {
        if (range.includes('/')) {
            // CIDR notation
            if (isIPInRange(ip, range)) return true;
        } else {
            // Exact match
            if (ip === range) return true;
        }
    }
    return false;
}

function isIPInRange(ip: string, cidr: string): boolean {
    const [rangeIP, bits] = cidr.split('/');
    if (!rangeIP || !bits) return false;
    const mask = ~(2 ** (32 - Number.parseInt(bits, 10)) - 1);
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(rangeIP);
    return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    const [octet1 = 0, octet2 = 0, octet3 = 0, octet4 = 0] = parts;
    return (octet1 << 24) | (octet2 << 16) | (octet3 << 8) | octet4;
}
