import { describe, expect, it } from 'vitest';
import {
    // Presets
    QZPAY_RESILIENCE_PRESETS,
    qzpayAdvanceRetryState,
    qzpayAggregateHealthChecks,
    qzpayBulkheadAddToQueue,
    qzpayBulkheadCanAccept,
    qzpayBulkheadCompleteExecution,
    qzpayBulkheadReject,
    qzpayBulkheadStartExecution,
    qzpayCalculateNextDelay,
    qzpayCircuitAllowsRequest,
    qzpayCircuitRecordFailure,
    qzpayCircuitRecordSuccess,
    qzpayCircuitToHalfOpen,
    // Bulkhead
    qzpayCreateBulkheadConfig,
    qzpayCreateBulkheadState,
    // Circuit Breaker
    qzpayCreateCircuitBreakerConfig,
    qzpayCreateCircuitBreakerState,
    qzpayCreateDeadline,
    // Health Check
    qzpayCreateHealthCheckResult,
    // Retry
    qzpayCreateRetryConfig,
    qzpayCreateRetryState,
    // Timeout
    qzpayCreateTimeoutConfig,
    qzpayDeadlinePassed,
    qzpayGetCircuitStats,
    qzpayGetRemainingTime,
    qzpayGetRetryDelay,
    qzpayIsRetryableError,
    qzpayShouldRetry,
    // Fallback
    qzpayWithFallback
} from '../src/services/resilience.service.js';
import {
    QZPAY_RATE_LIMIT_PRESETS,
    type QZPayIdempotencyKey,
    // Types
    type QZPayRateLimitEntry,
    qzpayCalculateRateLimitWindow,
    qzpayCheckIPAllowed,
    qzpayCheckIdempotencyKey,
    qzpayCheckRateLimit,
    qzpayCompleteIdempotencyKey,
    // Audit
    qzpayCreateAuditEntry,
    qzpayCreateCustomerAuditEntry,
    // IP Restriction
    qzpayCreateIPRestrictionConfig,
    // Idempotency
    qzpayCreateIdempotencyKey,
    qzpayCreatePaymentAuditEntry,
    // Rate limiting
    qzpayCreateRateLimitConfig,
    qzpayCreateSubscriptionAuditEntry,
    qzpayFailIdempotencyKey,
    qzpayGenerateRateLimitKey,
    qzpayGenerateRequestHash,
    qzpayGetRateLimitHeaders,
    qzpayIPMatches,
    qzpayIdempotencyKeyIsExpired,
    qzpayMaskCardNumber,
    qzpayMaskEmail,
    // Masking
    qzpayMaskSensitiveData,
    // Validation
    qzpaySanitizeString,
    qzpayUpdateRateLimitEntry,
    qzpayValidateAmount,
    qzpayValidateCurrency,
    qzpayValidateEmail,
    qzpayValidateMetadata
} from '../src/services/security.service.js';

// ============================================================================
// SECURITY SERVICE TESTS
// ============================================================================

describe('Security Service', () => {
    // ==================== Rate Limiting ====================

    describe('Rate Limiting', () => {
        describe('qzpayCreateRateLimitConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateRateLimitConfig();
                expect(config.maxRequests).toBe(100);
                expect(config.windowMs).toBe(60000);
                expect(config.keyPrefix).toBe('ratelimit');
            });

            it('should allow overrides', () => {
                const config = qzpayCreateRateLimitConfig({
                    maxRequests: 50,
                    windowMs: 30000,
                    keyPrefix: 'api'
                });
                expect(config.maxRequests).toBe(50);
                expect(config.windowMs).toBe(30000);
                expect(config.keyPrefix).toBe('api');
            });
        });

        describe('qzpayGenerateRateLimitKey', () => {
            it('should generate key with prefix', () => {
                const config = qzpayCreateRateLimitConfig({ keyPrefix: 'api' });
                const key = qzpayGenerateRateLimitKey('user:123', config);
                expect(key).toBe('api:user:123');
            });

            it('should use default prefix', () => {
                const config = qzpayCreateRateLimitConfig();
                const key = qzpayGenerateRateLimitKey('test', config);
                expect(key).toBe('ratelimit:test');
            });
        });

        describe('qzpayCalculateRateLimitWindow', () => {
            it('should calculate window boundaries', () => {
                const config = qzpayCreateRateLimitConfig({ windowMs: 60000 });
                const now = new Date('2024-01-15T10:30:45.000Z');
                const window = qzpayCalculateRateLimitWindow(config, now);

                expect(window.start.getTime()).toBeLessThanOrEqual(now.getTime());
                expect(window.end.getTime()).toBeGreaterThan(now.getTime());
                expect(window.end.getTime() - window.start.getTime()).toBe(60000);
            });
        });

        describe('qzpayCheckRateLimit', () => {
            it('should allow when no entry exists', () => {
                const config = qzpayCreateRateLimitConfig({ maxRequests: 10 });
                const result = qzpayCheckRateLimit(null, config);

                expect(result.allowed).toBe(true);
                expect(result.remaining).toBe(9);
            });

            it('should allow when under limit', () => {
                const config = qzpayCreateRateLimitConfig({ maxRequests: 10, windowMs: 60000 });
                const now = new Date();
                const entry: QZPayRateLimitEntry = {
                    key: 'test',
                    count: 5,
                    windowStart: new Date(now.getTime() - 30000),
                    windowEnd: new Date(now.getTime() + 30000)
                };

                const result = qzpayCheckRateLimit(entry, config, now);
                expect(result.allowed).toBe(true);
                expect(result.remaining).toBe(4);
            });

            it('should deny when at limit', () => {
                const config = qzpayCreateRateLimitConfig({ maxRequests: 10, windowMs: 60000 });
                const now = new Date();
                const entry: QZPayRateLimitEntry = {
                    key: 'test',
                    count: 10,
                    windowStart: new Date(now.getTime() - 30000),
                    windowEnd: new Date(now.getTime() + 30000)
                };

                const result = qzpayCheckRateLimit(entry, config, now);
                expect(result.allowed).toBe(false);
                expect(result.remaining).toBe(0);
                expect(result.retryAfterMs).toBeGreaterThan(0);
            });

            it('should allow when window expired', () => {
                const config = qzpayCreateRateLimitConfig({ maxRequests: 10, windowMs: 60000 });
                const now = new Date();
                const entry: QZPayRateLimitEntry = {
                    key: 'test',
                    count: 10,
                    windowStart: new Date(now.getTime() - 120000),
                    windowEnd: new Date(now.getTime() - 60000)
                };

                const result = qzpayCheckRateLimit(entry, config, now);
                expect(result.allowed).toBe(true);
            });
        });

        describe('qzpayUpdateRateLimitEntry', () => {
            it('should create new entry when none exists', () => {
                const config = qzpayCreateRateLimitConfig({ windowMs: 60000 });
                const entry = qzpayUpdateRateLimitEntry('test', null, config);

                expect(entry.key).toBe('test');
                expect(entry.count).toBe(1);
            });

            it('should increment existing entry', () => {
                const config = qzpayCreateRateLimitConfig({ windowMs: 60000 });
                const now = new Date();
                const existing: QZPayRateLimitEntry = {
                    key: 'test',
                    count: 5,
                    windowStart: new Date(now.getTime() - 30000),
                    windowEnd: new Date(now.getTime() + 30000)
                };

                const entry = qzpayUpdateRateLimitEntry('test', existing, config, now);
                expect(entry.count).toBe(6);
            });

            it('should reset for new window', () => {
                const config = qzpayCreateRateLimitConfig({ windowMs: 60000 });
                const now = new Date();
                const existing: QZPayRateLimitEntry = {
                    key: 'test',
                    count: 100,
                    windowStart: new Date(now.getTime() - 120000),
                    windowEnd: new Date(now.getTime() - 60000)
                };

                const entry = qzpayUpdateRateLimitEntry('test', existing, config, now);
                expect(entry.count).toBe(1);
            });
        });

        describe('qzpayGetRateLimitHeaders', () => {
            it('should return headers for allowed request', () => {
                const result = {
                    allowed: true,
                    remaining: 50,
                    resetAt: new Date('2024-01-15T10:31:00.000Z')
                };

                const headers = qzpayGetRateLimitHeaders(result);
                expect(headers['X-RateLimit-Remaining']).toBe('50');
                expect(headers['X-RateLimit-Reset']).toBeDefined();
                expect(headers['Retry-After']).toBeUndefined();
            });

            it('should include Retry-After for denied request', () => {
                const result = {
                    allowed: false,
                    remaining: 0,
                    resetAt: new Date(),
                    retryAfterMs: 30000
                };

                const headers = qzpayGetRateLimitHeaders(result);
                expect(headers['Retry-After']).toBe('30');
            });
        });

        describe('QZPAY_RATE_LIMIT_PRESETS', () => {
            it('should have API_STANDARD preset', () => {
                expect(QZPAY_RATE_LIMIT_PRESETS.API_STANDARD.maxRequests).toBe(100);
            });

            it('should have API_STRICT preset', () => {
                expect(QZPAY_RATE_LIMIT_PRESETS.API_STRICT.maxRequests).toBe(10);
            });

            it('should have AUTH preset', () => {
                expect(QZPAY_RATE_LIMIT_PRESETS.AUTH.maxRequests).toBe(5);
                expect(QZPAY_RATE_LIMIT_PRESETS.AUTH.windowMs).toBe(300000); // 5 minutes
            });
        });
    });

    // ==================== Idempotency ====================

    describe('Idempotency', () => {
        describe('qzpayCreateIdempotencyKey', () => {
            it('should create key with defaults', () => {
                const key = qzpayCreateIdempotencyKey('key-123', 'create_payment', 'hash-abc');

                expect(key.id).toMatch(/^idem_/);
                expect(key.key).toBe('key-123');
                expect(key.operation).toBe('create_payment');
                expect(key.requestHash).toBe('hash-abc');
                expect(key.status).toBe('pending');
                expect(key.response).toBeNull();
                expect(key.statusCode).toBeNull();
                expect(key.completedAt).toBeNull();
            });

            it('should set expiration time', () => {
                const before = Date.now();
                const key = qzpayCreateIdempotencyKey('key-123', 'op', 'hash', 3600000);
                const expectedExpiry = before + 3600000;

                expect(key.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
                expect(key.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
            });
        });

        describe('qzpayCheckIdempotencyKey', () => {
            it('should return isNew when no key exists', () => {
                const result = qzpayCheckIdempotencyKey(null, 'hash');
                expect(result.isNew).toBe(true);
                expect(result.shouldProcess).toBe(true);
            });

            it('should return isNew when key expired', () => {
                const expiredKey: QZPayIdempotencyKey = {
                    id: 'idem_123',
                    key: 'key-123',
                    operation: 'op',
                    requestHash: 'hash',
                    status: 'completed',
                    response: { success: true },
                    statusCode: 200,
                    expiresAt: new Date(Date.now() - 1000),
                    createdAt: new Date(),
                    completedAt: new Date()
                };

                const result = qzpayCheckIdempotencyKey(expiredKey, 'hash');
                expect(result.isNew).toBe(true);
                expect(result.shouldProcess).toBe(true);
            });

            it('should not process when different request hash', () => {
                const existingKey: QZPayIdempotencyKey = {
                    id: 'idem_123',
                    key: 'key-123',
                    operation: 'op',
                    requestHash: 'hash-original',
                    status: 'pending',
                    response: null,
                    statusCode: null,
                    expiresAt: new Date(Date.now() + 86400000),
                    createdAt: new Date(),
                    completedAt: null
                };

                const result = qzpayCheckIdempotencyKey(existingKey, 'hash-different');
                expect(result.isNew).toBe(false);
                expect(result.shouldProcess).toBe(false);
                expect(result.existingKey).toBeDefined();
            });

            it('should not process when already completed', () => {
                const existingKey: QZPayIdempotencyKey = {
                    id: 'idem_123',
                    key: 'key-123',
                    operation: 'op',
                    requestHash: 'hash',
                    status: 'completed',
                    response: { success: true },
                    statusCode: 200,
                    expiresAt: new Date(Date.now() + 86400000),
                    createdAt: new Date(),
                    completedAt: new Date()
                };

                const result = qzpayCheckIdempotencyKey(existingKey, 'hash');
                expect(result.shouldProcess).toBe(false);
                expect(result.existingKey?.response).toEqual({ success: true });
            });

            it('should allow retry when previous failed', () => {
                const failedKey: QZPayIdempotencyKey = {
                    id: 'idem_123',
                    key: 'key-123',
                    operation: 'op',
                    requestHash: 'hash',
                    status: 'failed',
                    response: null,
                    statusCode: null,
                    expiresAt: new Date(Date.now() + 86400000),
                    createdAt: new Date(),
                    completedAt: new Date()
                };

                const result = qzpayCheckIdempotencyKey(failedKey, 'hash');
                expect(result.shouldProcess).toBe(true);
            });
        });

        describe('qzpayCompleteIdempotencyKey', () => {
            it('should mark key as completed with response', () => {
                const key = qzpayCreateIdempotencyKey('key', 'op', 'hash');
                const completed = qzpayCompleteIdempotencyKey(key, { data: 'test' }, 200);

                expect(completed.status).toBe('completed');
                expect(completed.response).toEqual({ data: 'test' });
                expect(completed.statusCode).toBe(200);
                expect(completed.completedAt).toBeInstanceOf(Date);
            });
        });

        describe('qzpayFailIdempotencyKey', () => {
            it('should mark key as failed', () => {
                const key = qzpayCreateIdempotencyKey('key', 'op', 'hash');
                const failed = qzpayFailIdempotencyKey(key);

                expect(failed.status).toBe('failed');
                expect(failed.completedAt).toBeInstanceOf(Date);
            });
        });

        describe('qzpayGenerateRequestHash', () => {
            it('should generate consistent hash for same input', () => {
                const hash1 = qzpayGenerateRequestHash({ a: 1, b: 2 });
                const hash2 = qzpayGenerateRequestHash({ b: 2, a: 1 });
                expect(hash1).toBe(hash2);
            });

            it('should generate different hash for different input', () => {
                const hash1 = qzpayGenerateRequestHash({ a: 1 });
                const hash2 = qzpayGenerateRequestHash({ a: 2 });
                expect(hash1).not.toBe(hash2);
            });
        });

        describe('qzpayIdempotencyKeyIsExpired', () => {
            it('should return true when expired', () => {
                const key = qzpayCreateIdempotencyKey('key', 'op', 'hash', 1);
                const future = new Date(Date.now() + 1000);
                expect(qzpayIdempotencyKeyIsExpired(key, future)).toBe(true);
            });

            it('should return false when not expired', () => {
                const key = qzpayCreateIdempotencyKey('key', 'op', 'hash', 86400000);
                expect(qzpayIdempotencyKeyIsExpired(key)).toBe(false);
            });
        });
    });

    // ==================== Audit ====================

    describe('Audit', () => {
        describe('qzpayCreateAuditEntry', () => {
            it('should create audit entry with required fields', () => {
                const entry = qzpayCreateAuditEntry('create', 'payment', 'pay_123');

                expect(entry.id).toMatch(/^audit_/);
                expect(entry.action).toBe('create');
                expect(entry.resourceType).toBe('payment');
                expect(entry.resourceId).toBe('pay_123');
                expect(entry.actorType).toBe('system');
                expect(entry.success).toBe(true);
            });

            it('should include optional fields', () => {
                const entry = qzpayCreateAuditEntry('update', 'customer', 'cust_123', {
                    actorId: 'user_456',
                    actorType: 'user',
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    success: false,
                    metadata: { reason: 'test' }
                });

                expect(entry.actorId).toBe('user_456');
                expect(entry.actorType).toBe('user');
                expect(entry.ipAddress).toBe('192.168.1.1');
                expect(entry.userAgent).toBe('Mozilla/5.0');
                expect(entry.success).toBe(false);
                expect(entry.metadata).toEqual({ reason: 'test' });
            });
        });

        describe('qzpayCreatePaymentAuditEntry', () => {
            it('should create payment audit entry', () => {
                const entry = qzpayCreatePaymentAuditEntry('capture', 'pay_123', 5000);

                expect(entry.action).toBe('payment.capture');
                expect(entry.resourceType).toBe('payment');
                expect(entry.resourceId).toBe('pay_123');
                expect(entry.metadata.amount).toBe(5000);
            });
        });

        describe('qzpayCreateSubscriptionAuditEntry', () => {
            it('should create subscription audit entry', () => {
                const entry = qzpayCreateSubscriptionAuditEntry('cancel', 'sub_123');

                expect(entry.action).toBe('subscription.cancel');
                expect(entry.resourceType).toBe('subscription');
                expect(entry.resourceId).toBe('sub_123');
            });
        });

        describe('qzpayCreateCustomerAuditEntry', () => {
            it('should create customer audit entry', () => {
                const entry = qzpayCreateCustomerAuditEntry('create', 'cust_123');

                expect(entry.action).toBe('customer.create');
                expect(entry.resourceType).toBe('customer');
            });
        });
    });

    // ==================== IP Restriction ====================

    describe('IP Restriction', () => {
        describe('qzpayCreateIPRestrictionConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateIPRestrictionConfig();
                expect(config.allowedIPs).toEqual([]);
                expect(config.blockedIPs).toEqual([]);
                expect(config.mode).toBe('blocklist');
            });
        });

        describe('qzpayIPMatches', () => {
            it('should match exact IP', () => {
                expect(qzpayIPMatches('192.168.1.1', '192.168.1.1')).toBe(true);
                expect(qzpayIPMatches('192.168.1.1', '192.168.1.2')).toBe(false);
            });

            it('should match wildcard pattern', () => {
                expect(qzpayIPMatches('192.168.1.1', '192.168.1.*')).toBe(true);
                expect(qzpayIPMatches('192.168.1.100', '192.168.1.*')).toBe(true);
                expect(qzpayIPMatches('192.168.2.1', '192.168.1.*')).toBe(false);
            });

            it('should match CIDR notation', () => {
                expect(qzpayIPMatches('192.168.1.1', '192.168.1.0/24')).toBe(true);
                expect(qzpayIPMatches('192.168.1.255', '192.168.1.0/24')).toBe(true);
                expect(qzpayIPMatches('192.168.2.1', '192.168.1.0/24')).toBe(false);
            });

            it('should handle /32 CIDR (exact match)', () => {
                expect(qzpayIPMatches('10.0.0.1', '10.0.0.1/32')).toBe(true);
                expect(qzpayIPMatches('10.0.0.2', '10.0.0.1/32')).toBe(false);
            });

            it('should handle large CIDR ranges', () => {
                expect(qzpayIPMatches('10.0.0.1', '10.0.0.0/16')).toBe(true);
                expect(qzpayIPMatches('10.0.255.255', '10.0.0.0/16')).toBe(true);
                expect(qzpayIPMatches('10.1.0.1', '10.0.0.0/16')).toBe(false);
            });
        });

        describe('qzpayCheckIPAllowed', () => {
            it('should block IP in blocklist mode', () => {
                const config = qzpayCreateIPRestrictionConfig({
                    mode: 'blocklist',
                    blockedIPs: ['192.168.1.1', '10.0.0.0/8']
                });

                expect(qzpayCheckIPAllowed('192.168.1.1', config)).toBe(false);
                expect(qzpayCheckIPAllowed('10.0.0.5', config)).toBe(false);
                expect(qzpayCheckIPAllowed('8.8.8.8', config)).toBe(true);
            });

            it('should only allow IPs in allowlist mode', () => {
                const config = qzpayCreateIPRestrictionConfig({
                    mode: 'allowlist',
                    allowedIPs: ['192.168.1.1', '10.0.0.*']
                });

                expect(qzpayCheckIPAllowed('192.168.1.1', config)).toBe(true);
                expect(qzpayCheckIPAllowed('10.0.0.5', config)).toBe(true);
                expect(qzpayCheckIPAllowed('8.8.8.8', config)).toBe(false);
            });

            it('should handle both mode', () => {
                const config = qzpayCreateIPRestrictionConfig({
                    mode: 'both',
                    allowedIPs: ['192.168.1.*'],
                    blockedIPs: ['192.168.1.100']
                });

                expect(qzpayCheckIPAllowed('192.168.1.1', config)).toBe(true);
                expect(qzpayCheckIPAllowed('192.168.1.100', config)).toBe(false); // blocked
                expect(qzpayCheckIPAllowed('10.0.0.1', config)).toBe(false); // not in allowlist
            });

            it('should allow all when empty allowlist', () => {
                const config = qzpayCreateIPRestrictionConfig({
                    mode: 'allowlist',
                    allowedIPs: []
                });

                expect(qzpayCheckIPAllowed('any.ip.here', config)).toBe(true);
            });
        });
    });

    // ==================== Validation ====================

    describe('Validation', () => {
        describe('qzpaySanitizeString', () => {
            it('should remove null bytes', () => {
                expect(qzpaySanitizeString('hello\0world')).toBe('helloworld');
            });

            it('should trim whitespace', () => {
                expect(qzpaySanitizeString('  hello  ')).toBe('hello');
            });

            it('should limit length', () => {
                expect(qzpaySanitizeString('hello world', 5)).toBe('hello');
            });
        });

        describe('qzpayValidateEmail', () => {
            it('should validate correct email', () => {
                const result = qzpayValidateEmail('user@example.com');
                expect(result.valid).toBe(true);
                expect(result.sanitized).toBe('user@example.com');
            });

            it('should lowercase email', () => {
                const result = qzpayValidateEmail('USER@EXAMPLE.COM');
                expect(result.sanitized).toBe('user@example.com');
            });

            it('should reject invalid email', () => {
                expect(qzpayValidateEmail('invalid').valid).toBe(false);
                expect(qzpayValidateEmail('no@domain').valid).toBe(false);
                expect(qzpayValidateEmail('@nodomain.com').valid).toBe(false);
            });

            it('should reject too long email', () => {
                const longEmail = `${'a'.repeat(250)}@example.com`;
                expect(qzpayValidateEmail(longEmail).valid).toBe(false);
            });
        });

        describe('qzpayValidateAmount', () => {
            it('should validate correct amount', () => {
                expect(qzpayValidateAmount(1000).valid).toBe(true);
                expect(qzpayValidateAmount(0).valid).toBe(true);
            });

            it('should reject non-number', () => {
                expect(qzpayValidateAmount('100' as unknown as number).valid).toBe(false);
            });

            it('should reject non-integer', () => {
                expect(qzpayValidateAmount(10.5).valid).toBe(false);
            });

            it('should reject negative', () => {
                expect(qzpayValidateAmount(-100).valid).toBe(false);
            });

            it('should reject too large', () => {
                expect(qzpayValidateAmount(100000000).valid).toBe(false);
            });
        });

        describe('qzpayValidateCurrency', () => {
            it('should validate supported currencies', () => {
                expect(qzpayValidateCurrency('usd').valid).toBe(true);
                expect(qzpayValidateCurrency('USD').valid).toBe(true);
                expect(qzpayValidateCurrency('eur').valid).toBe(true);
                expect(qzpayValidateCurrency('brl').valid).toBe(true);
            });

            it('should reject unsupported currencies', () => {
                expect(qzpayValidateCurrency('xyz').valid).toBe(false);
            });
        });

        describe('qzpayValidateMetadata', () => {
            it('should validate empty or null metadata', () => {
                expect(qzpayValidateMetadata(null).valid).toBe(true);
                expect(qzpayValidateMetadata(undefined).valid).toBe(true);
                expect(qzpayValidateMetadata({}).valid).toBe(true);
            });

            it('should validate valid metadata', () => {
                const result = qzpayValidateMetadata({
                    key1: 'value',
                    key2: 123,
                    key3: true
                });
                expect(result.valid).toBe(true);
            });

            it('should reject non-object metadata', () => {
                expect(qzpayValidateMetadata('string' as unknown).valid).toBe(false);
                expect(qzpayValidateMetadata([1, 2, 3] as unknown).valid).toBe(false);
            });

            it('should report too many keys', () => {
                const tooManyKeys = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`key${i}`, 'value']));
                const result = qzpayValidateMetadata(tooManyKeys);
                expect(result.errors.length).toBeGreaterThan(0);
            });

            it('should truncate long values', () => {
                const longValue = 'a'.repeat(600);
                const result = qzpayValidateMetadata({ key: longValue });
                expect((result.value.key as string).length).toBe(500);
            });
        });
    });

    // ==================== Masking ====================

    describe('Masking', () => {
        describe('qzpayMaskSensitiveData', () => {
            it('should mask sensitive fields', () => {
                const data = {
                    password: 'secretpassword',
                    api_key: 'sk_live_123456789',
                    name: 'John Doe'
                };

                const masked = qzpayMaskSensitiveData(data);
                expect(masked.password).toBe('****word');
                expect(masked.api_key).toBe('****6789');
                expect(masked.name).toBe('John Doe');
            });

            it('should mask nested objects', () => {
                const data = {
                    user: {
                        token: 'bearer_token_123'
                    }
                };

                const masked = qzpayMaskSensitiveData(data);
                expect((masked.user as Record<string, unknown>).token).toBe('****_123');
            });

            it('should handle short sensitive values', () => {
                const data = { password: 'abc' };
                const masked = qzpayMaskSensitiveData(data);
                expect(masked.password).toBe('****');
            });
        });

        describe('qzpayMaskCardNumber', () => {
            it('should mask card number showing last 4', () => {
                expect(qzpayMaskCardNumber('4111111111111111')).toBe('****1111');
                expect(qzpayMaskCardNumber('4111-1111-1111-1111')).toBe('****1111');
            });

            it('should handle short numbers', () => {
                expect(qzpayMaskCardNumber('1234')).toBe('****');
            });
        });

        describe('qzpayMaskEmail', () => {
            it('should mask email preserving domain', () => {
                expect(qzpayMaskEmail('john.doe@example.com')).toBe('j***e@example.com');
            });

            it('should handle short local part', () => {
                expect(qzpayMaskEmail('ab@example.com')).toBe('***@example.com');
            });

            it('should handle invalid email', () => {
                expect(qzpayMaskEmail('invalid')).toBe('****@****');
            });
        });
    });
});

// ============================================================================
// RESILIENCE SERVICE TESTS
// ============================================================================

describe('Resilience Service', () => {
    // ==================== Circuit Breaker ====================

    describe('Circuit Breaker', () => {
        describe('qzpayCreateCircuitBreakerConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateCircuitBreakerConfig();
                expect(config.failureThreshold).toBe(5);
                expect(config.successThreshold).toBe(3);
                expect(config.resetTimeout).toBe(30000);
            });

            it('should allow overrides', () => {
                const config = qzpayCreateCircuitBreakerConfig({
                    failureThreshold: 10,
                    name: 'payment-api'
                });
                expect(config.failureThreshold).toBe(10);
                expect(config.name).toBe('payment-api');
            });
        });

        describe('qzpayCreateCircuitBreakerState', () => {
            it('should create initial closed state', () => {
                const state = qzpayCreateCircuitBreakerState();
                expect(state.state).toBe('closed');
                expect(state.failures).toBe(0);
                expect(state.successes).toBe(0);
                expect(state.totalRequests).toBe(0);
            });
        });

        describe('qzpayCircuitAllowsRequest', () => {
            it('should allow when closed', () => {
                const state = qzpayCreateCircuitBreakerState();
                const config = qzpayCreateCircuitBreakerConfig();
                expect(qzpayCircuitAllowsRequest(state, config)).toBe(true);
            });

            it('should deny when open and within timeout', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'open' as const,
                    lastFailureTime: new Date()
                };
                const config = qzpayCreateCircuitBreakerConfig({ resetTimeout: 30000 });
                expect(qzpayCircuitAllowsRequest(state, config)).toBe(false);
            });

            it('should allow when open but timeout passed', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'open' as const,
                    lastFailureTime: new Date(Date.now() - 60000)
                };
                const config = qzpayCreateCircuitBreakerConfig({ resetTimeout: 30000 });
                expect(qzpayCircuitAllowsRequest(state, config)).toBe(true);
            });

            it('should allow when half-open', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'half-open' as const
                };
                const config = qzpayCreateCircuitBreakerConfig();
                expect(qzpayCircuitAllowsRequest(state, config)).toBe(true);
            });
        });

        describe('qzpayCircuitRecordSuccess', () => {
            it('should reset failures when closed', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    failures: 3
                };
                const config = qzpayCreateCircuitBreakerConfig();
                const newState = qzpayCircuitRecordSuccess(state, config);

                expect(newState.failures).toBe(0);
                expect(newState.successes).toBe(1);
                expect(newState.totalSuccesses).toBe(1);
            });

            it('should close circuit when success threshold met in half-open', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'half-open' as const,
                    successes: 2
                };
                const config = qzpayCreateCircuitBreakerConfig({ successThreshold: 3 });
                const newState = qzpayCircuitRecordSuccess(state, config);

                expect(newState.state).toBe('closed');
                expect(newState.successes).toBe(0);
                expect(newState.failures).toBe(0);
            });
        });

        describe('qzpayCircuitRecordFailure', () => {
            it('should increment failures when closed', () => {
                const state = qzpayCreateCircuitBreakerState();
                const config = qzpayCreateCircuitBreakerConfig({ failureThreshold: 5 });
                const newState = qzpayCircuitRecordFailure(state, config);

                expect(newState.failures).toBe(1);
                expect(newState.state).toBe('closed');
            });

            it('should open circuit when threshold reached', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    failures: 4
                };
                const config = qzpayCreateCircuitBreakerConfig({ failureThreshold: 5 });
                const newState = qzpayCircuitRecordFailure(state, config);

                expect(newState.state).toBe('open');
                expect(newState.failures).toBe(5);
            });

            it('should return to open from half-open on failure', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'half-open' as const
                };
                const config = qzpayCreateCircuitBreakerConfig();
                const newState = qzpayCircuitRecordFailure(state, config);

                expect(newState.state).toBe('open');
            });
        });

        describe('qzpayCircuitToHalfOpen', () => {
            it('should transition from open to half-open', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    state: 'open' as const,
                    failures: 5
                };
                const newState = qzpayCircuitToHalfOpen(state);

                expect(newState.state).toBe('half-open');
                expect(newState.failures).toBe(0);
                expect(newState.successes).toBe(0);
            });

            it('should not transition if not open', () => {
                const state = qzpayCreateCircuitBreakerState();
                const newState = qzpayCircuitToHalfOpen(state);
                expect(newState.state).toBe('closed');
            });
        });

        describe('qzpayGetCircuitStats', () => {
            it('should calculate statistics', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    totalRequests: 100,
                    totalFailures: 10,
                    totalSuccesses: 90,
                    lastStateChange: new Date(Date.now() - 5000) // 5 seconds ago
                };
                const stats = qzpayGetCircuitStats(state);

                expect(stats.failureRate).toBe(10);
                expect(stats.requestCount).toBe(100);
                expect(stats.uptime).toBeGreaterThanOrEqual(5000);
            });

            it('should handle zero requests', () => {
                const state = qzpayCreateCircuitBreakerState();
                const stats = qzpayGetCircuitStats(state);
                expect(stats.failureRate).toBe(0);
            });

            it('should return uptime from lastStateChange', () => {
                const state = {
                    ...qzpayCreateCircuitBreakerState(),
                    lastStateChange: new Date(Date.now() - 10000)
                };
                const stats = qzpayGetCircuitStats(state);
                expect(stats.uptime).toBeGreaterThanOrEqual(10000);
            });
        });
    });

    // ==================== Retry ====================

    describe('Retry', () => {
        describe('qzpayCreateRetryConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateRetryConfig();
                expect(config.maxRetries).toBe(3);
                expect(config.initialDelay).toBe(1000);
                expect(config.backoffMultiplier).toBe(2);
            });
        });

        describe('qzpayCreateRetryState', () => {
            it('should create initial state', () => {
                const config = qzpayCreateRetryConfig();
                const state = qzpayCreateRetryState(config);

                expect(state.attempt).toBe(0);
                expect(state.maxAttempts).toBe(4); // maxRetries + 1
                expect(state.exhausted).toBe(false);
            });
        });

        describe('qzpayCalculateNextDelay', () => {
            it('should calculate exponential backoff', () => {
                const config = qzpayCreateRetryConfig({
                    initialDelay: 1000,
                    backoffMultiplier: 2,
                    maxDelay: 30000,
                    jitterFactor: 0 // disable jitter for predictable test
                });

                expect(qzpayCalculateNextDelay(0, config)).toBe(1000);
                expect(qzpayCalculateNextDelay(1, config)).toBe(2000);
                expect(qzpayCalculateNextDelay(2, config)).toBe(4000);
            });

            it('should cap at maxDelay', () => {
                const config = qzpayCreateRetryConfig({
                    initialDelay: 1000,
                    backoffMultiplier: 2,
                    maxDelay: 5000,
                    jitterFactor: 0
                });

                expect(qzpayCalculateNextDelay(10, config)).toBe(5000);
            });
        });

        describe('qzpayAdvanceRetryState', () => {
            it('should increment attempt', () => {
                const config = qzpayCreateRetryConfig({ maxRetries: 3 });
                const state = qzpayCreateRetryState(config);
                const newState = qzpayAdvanceRetryState(state, config, 'Error');

                expect(newState.attempt).toBe(1);
                expect(newState.lastError).toBe('Error');
                expect(newState.exhausted).toBe(false);
            });

            it('should mark exhausted when max reached', () => {
                const config = qzpayCreateRetryConfig({ maxRetries: 3 });
                let state = qzpayCreateRetryState(config);

                for (let i = 0; i < 4; i++) {
                    state = qzpayAdvanceRetryState(state, config, 'Error');
                }

                expect(state.exhausted).toBe(true);
            });
        });

        describe('qzpayIsRetryableError', () => {
            it('should check retryable errors', () => {
                const config = qzpayCreateRetryConfig({
                    retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR']
                });

                expect(qzpayIsRetryableError('TIMEOUT', config)).toBe(true);
                expect(qzpayIsRetryableError('CONNECTION_ERROR occurred', config)).toBe(true);
                expect(qzpayIsRetryableError('INVALID_INPUT', config)).toBe(false);
            });

            it('should retry all when no filter', () => {
                const config = qzpayCreateRetryConfig({ retryableErrors: [] });
                expect(qzpayIsRetryableError('ANY_ERROR', config)).toBe(true);
            });
        });

        describe('qzpayShouldRetry', () => {
            it('should return true when can retry', () => {
                const config = qzpayCreateRetryConfig();
                const state = qzpayCreateRetryState(config);

                expect(qzpayShouldRetry(state, 'TIMEOUT', config)).toBe(true);
            });

            it('should return false when exhausted', () => {
                const config = qzpayCreateRetryConfig({ maxRetries: 0 });
                let state = qzpayCreateRetryState(config);
                state = qzpayAdvanceRetryState(state, config, 'Error');

                expect(qzpayShouldRetry(state, 'TIMEOUT', config)).toBe(false);
            });
        });

        describe('qzpayGetRetryDelay', () => {
            it('should return next retry date', () => {
                const config = qzpayCreateRetryConfig({ initialDelay: 1000 });
                const state = qzpayCreateRetryState(config);
                const retryDate = qzpayGetRetryDelay(state);

                expect(retryDate.getTime()).toBeGreaterThan(Date.now());
            });
        });
    });

    // ==================== Bulkhead ====================

    describe('Bulkhead', () => {
        describe('qzpayCreateBulkheadConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateBulkheadConfig();
                expect(config.maxConcurrent).toBe(10);
                expect(config.maxQueueSize).toBe(100);
            });
        });

        describe('qzpayBulkheadCanAccept', () => {
            it('should accept when under limit', () => {
                const state = qzpayCreateBulkheadState();
                const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10 });
                const result = qzpayBulkheadCanAccept(state, config);

                expect(result.canAccept).toBe(true);
                expect(result.willQueue).toBe(false);
            });

            it('should queue when at concurrent limit', () => {
                const state = { ...qzpayCreateBulkheadState(), executing: 10 };
                const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10, maxQueueSize: 100 });
                const result = qzpayBulkheadCanAccept(state, config);

                expect(result.canAccept).toBe(true);
                expect(result.willQueue).toBe(true);
            });

            it('should reject when queue full', () => {
                const state = { ...qzpayCreateBulkheadState(), executing: 10, queued: 100 };
                const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10, maxQueueSize: 100 });
                const result = qzpayBulkheadCanAccept(state, config);

                expect(result.canAccept).toBe(false);
                expect(result.reason).toBeDefined();
            });
        });

        describe('qzpayBulkheadStartExecution', () => {
            it('should increment executing', () => {
                const state = qzpayCreateBulkheadState();
                const newState = qzpayBulkheadStartExecution(state);
                expect(newState.executing).toBe(1);
            });

            it('should decrement queue when from queue', () => {
                const state = { ...qzpayCreateBulkheadState(), queued: 5 };
                const newState = qzpayBulkheadStartExecution(state, true);
                expect(newState.executing).toBe(1);
                expect(newState.queued).toBe(4);
            });
        });

        describe('qzpayBulkheadCompleteExecution', () => {
            it('should decrement executing and increment completed', () => {
                const state = { ...qzpayCreateBulkheadState(), executing: 5 };
                const newState = qzpayBulkheadCompleteExecution(state);
                expect(newState.executing).toBe(4);
                expect(newState.completed).toBe(1);
            });
        });

        describe('qzpayBulkheadAddToQueue', () => {
            it('should increment queued', () => {
                const state = qzpayCreateBulkheadState();
                const newState = qzpayBulkheadAddToQueue(state);
                expect(newState.queued).toBe(1);
            });
        });

        describe('qzpayBulkheadReject', () => {
            it('should increment rejected', () => {
                const state = qzpayCreateBulkheadState();
                const newState = qzpayBulkheadReject(state);
                expect(newState.rejected).toBe(1);
            });
        });
    });

    // ==================== Health Check ====================

    describe('Health Check', () => {
        describe('qzpayCreateHealthCheckResult', () => {
            it('should create healthy result', () => {
                const result = qzpayCreateHealthCheckResult('database', true, 50);

                expect(result.healthy).toBe(true);
                expect(result.name).toBe('database');
                expect(result.status).toBe('up');
                expect(result.responseTime).toBe(50);
            });

            it('should create unhealthy result', () => {
                const result = qzpayCreateHealthCheckResult('redis', false, 5000, {
                    message: 'Connection timeout'
                });

                expect(result.healthy).toBe(false);
                expect(result.status).toBe('down');
                expect(result.message).toBe('Connection timeout');
            });

            it('should allow custom status', () => {
                const result = qzpayCreateHealthCheckResult('api', true, 100, {
                    status: 'degraded'
                });

                expect(result.status).toBe('degraded');
            });
        });

        describe('qzpayAggregateHealthChecks', () => {
            it('should aggregate all healthy', () => {
                const results = [
                    qzpayCreateHealthCheckResult('db', true, 50),
                    qzpayCreateHealthCheckResult('cache', true, 10),
                    qzpayCreateHealthCheckResult('api', true, 100)
                ];

                const aggregate = qzpayAggregateHealthChecks(results);
                expect(aggregate.healthy).toBe(true);
                expect(aggregate.status).toBe('up');
                expect(aggregate.message).toBe('All services healthy');
            });

            it('should show degraded when some unhealthy', () => {
                const results = [qzpayCreateHealthCheckResult('db', true, 50), qzpayCreateHealthCheckResult('cache', false, 5000)];

                const aggregate = qzpayAggregateHealthChecks(results);
                expect(aggregate.healthy).toBe(false);
                expect(aggregate.status).toBe('degraded');
            });

            it('should show down when all unhealthy', () => {
                const results = [qzpayCreateHealthCheckResult('db', false, 5000), qzpayCreateHealthCheckResult('cache', false, 5000)];

                const aggregate = qzpayAggregateHealthChecks(results);
                expect(aggregate.status).toBe('down');
            });

            it('should calculate average response time', () => {
                const results = [qzpayCreateHealthCheckResult('a', true, 100), qzpayCreateHealthCheckResult('b', true, 200)];

                const aggregate = qzpayAggregateHealthChecks(results);
                expect(aggregate.responseTime).toBe(150);
            });
        });
    });

    // ==================== Fallback ====================

    describe('Fallback', () => {
        describe('qzpayWithFallback', () => {
            it('should return value when success', () => {
                const result = qzpayWithFallback({ success: true, value: 'data' }, { value: 'fallback' });
                expect(result).toBe('data');
            });

            it('should return fallback value when failed', () => {
                const result = qzpayWithFallback({ success: false, error: 'Error' }, { value: 'fallback' });
                expect(result).toBe('fallback');
            });

            it('should call fallback function', () => {
                const result = qzpayWithFallback({ success: false }, { fn: () => 'computed-fallback' });
                expect(result).toBe('computed-fallback');
            });
        });
    });

    // ==================== Timeout ====================

    describe('Timeout', () => {
        describe('qzpayCreateTimeoutConfig', () => {
            it('should create config with defaults', () => {
                const config = qzpayCreateTimeoutConfig();
                expect(config.timeout).toBe(30000);
                expect(config.message).toBe('Operation timed out');
            });
        });

        describe('qzpayDeadlinePassed', () => {
            it('should return true when deadline passed', () => {
                const startTime = new Date(Date.now() - 40000);
                expect(qzpayDeadlinePassed(startTime, 30000)).toBe(true);
            });

            it('should return false when deadline not passed', () => {
                const startTime = new Date();
                expect(qzpayDeadlinePassed(startTime, 30000)).toBe(false);
            });
        });

        describe('qzpayGetRemainingTime', () => {
            it('should return remaining time', () => {
                const startTime = new Date(Date.now() - 10000);
                const remaining = qzpayGetRemainingTime(startTime, 30000);
                expect(remaining).toBeGreaterThan(19000);
                expect(remaining).toBeLessThanOrEqual(20000);
            });

            it('should return 0 when expired', () => {
                const startTime = new Date(Date.now() - 40000);
                expect(qzpayGetRemainingTime(startTime, 30000)).toBe(0);
            });
        });

        describe('qzpayCreateDeadline', () => {
            it('should create deadline from timeout', () => {
                const startTime = new Date();
                const deadline = qzpayCreateDeadline(30000, startTime);
                expect(deadline.getTime()).toBe(startTime.getTime() + 30000);
            });
        });
    });

    // ==================== Presets ====================

    describe('QZPAY_RESILIENCE_PRESETS', () => {
        it('should have PAYMENT preset', () => {
            const preset = QZPAY_RESILIENCE_PRESETS.PAYMENT;
            expect(preset.circuitBreaker.failureThreshold).toBe(3);
            expect(preset.retry.maxRetries).toBe(3);
            expect(preset.timeout.timeout).toBe(30000);
        });

        it('should have WEBHOOK preset with more retries', () => {
            const preset = QZPAY_RESILIENCE_PRESETS.WEBHOOK;
            expect(preset.retry.maxRetries).toBe(5);
        });

        it('should have DATABASE preset with quick failures', () => {
            const preset = QZPAY_RESILIENCE_PRESETS.DATABASE;
            expect(preset.timeout.timeout).toBe(5000);
            expect(preset.retry.maxRetries).toBe(2);
        });
    });
});
