import * as crypto from 'node:crypto';
/**
 * Security Test Suite - Authentication & Authorization
 *
 * Tests for API key security, token handling, and access control
 */
import { describe, expect, it, vi } from 'vitest';

describe('Authentication Security Tests', () => {
    describe('API Key Security', () => {
        it('should reject requests without API key', () => {
            const result = validateApiKey(undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Missing');
        });

        it('should reject empty API key', () => {
            const result = validateApiKey('');
            expect(result.valid).toBe(false);
        });

        it('should reject malformed API key', () => {
            const malformedKeys = [
                'invalid', // No prefix
                'sk_', // Empty after prefix
                'pk_live_abc', // Wrong type (publishable key)
                `sk_live_${'a'.repeat(300)}`, // Too long
                'sk_live_<script>alert(1)</script>', // XSS attempt
                "sk_live_'; DROP TABLE --" // SQL injection
            ];

            for (const key of malformedKeys) {
                const result = validateApiKey(key);
                expect(result.valid).toBe(false);
            }
        });

        it('should accept valid API key format', () => {
            const validKeys = ['sk_test_abc123xyz789', 'sk_live_0123456789abcdef'];

            for (const key of validKeys) {
                const result = validateApiKey(key);
                expect(result.valid).toBe(true);
            }
        });

        it('should not expose API key in error messages', () => {
            const apiKey = 'sk_test_secret_key_12345';
            const result = validateApiKeyWithServer(apiKey, 'invalid_hash');

            expect(result.error).not.toContain(apiKey);
            expect(result.error).not.toContain('secret');
        });

        it('should use constant-time comparison for API key validation', () => {
            const validKey = 'sk_test_valid_key_12345';
            const storedHash = hashApiKey(validKey);

            // Measure time for valid vs invalid keys
            const times: { valid: number[]; invalid: number[] } = { valid: [], invalid: [] };

            for (let i = 0; i < 100; i++) {
                const start1 = performance.now();
                validateApiKeyHash(validKey, storedHash);
                times.valid.push(performance.now() - start1);

                const start2 = performance.now();
                validateApiKeyHash('sk_test_wrong_key_00000', storedHash);
                times.invalid.push(performance.now() - start2);
            }

            const avgValid = times.valid.reduce((a, b) => a + b) / times.valid.length;
            const avgInvalid = times.invalid.reduce((a, b) => a + b) / times.invalid.length;

            // Times should be similar (within 20%)
            expect(Math.abs(avgValid - avgInvalid)).toBeLessThan(avgValid * 0.2);
        });
    });

    describe('Token Security', () => {
        it('should generate cryptographically secure tokens', () => {
            const tokens = new Set<string>();

            // Generate 1000 tokens and check uniqueness
            for (let i = 0; i < 1000; i++) {
                const token = generateSecureToken();
                expect(tokens.has(token)).toBe(false);
                tokens.add(token);

                // Should be sufficient length
                expect(token.length).toBeGreaterThanOrEqual(32);
            }
        });

        it('should detect token expiration', () => {
            const token = generateTokenWithExpiry({ expiresInSeconds: 1 });

            expect(isTokenExpired(token)).toBe(false);

            // Wait for expiration
            vi.useFakeTimers();
            vi.advanceTimersByTime(2000);

            expect(isTokenExpired(token)).toBe(true);

            vi.useRealTimers();
        });

        it('should reject tampered tokens', () => {
            const token = generateSignedToken({ userId: 'user_123', scope: 'read' });

            // Tamper with the token
            const parts = token.split('.');
            if (parts.length === 3) {
                parts[1] = Buffer.from(JSON.stringify({ userId: 'user_admin', scope: 'admin' })).toString('base64url');
                const tamperedToken = parts.join('.');

                expect(verifySignedToken(tamperedToken)).toBe(false);
            }

            // Original should still work
            expect(verifySignedToken(token)).toBe(true);
        });
    });

    describe('Authorization', () => {
        it('should enforce resource ownership', () => {
            const customerId = 'cust_123';
            const requestingUserId = 'user_456';
            const ownerId = 'user_123';

            expect(canAccessResource(requestingUserId, customerId, ownerId)).toBe(false);
            expect(canAccessResource(ownerId, customerId, ownerId)).toBe(true);
        });

        it('should validate permission scopes', () => {
            const readOnlyToken = { scopes: ['billing:read'] };
            const fullAccessToken = { scopes: ['billing:read', 'billing:write'] };

            expect(hasPermission(readOnlyToken, 'billing:read')).toBe(true);
            expect(hasPermission(readOnlyToken, 'billing:write')).toBe(false);
            expect(hasPermission(fullAccessToken, 'billing:write')).toBe(true);
        });

        it('should prevent privilege escalation', () => {
            const userToken = { role: 'user', scopes: ['billing:read'] };

            // Should not be able to add admin scopes
            const escalatedToken = attemptEscalation(userToken, ['admin:*']);
            expect(escalatedToken.scopes).not.toContain('admin:*');
        });

        it('should enforce rate limits per user', () => {
            const rateLimiter = new UserRateLimiter({ maxRequests: 100, windowMs: 60000 });

            // User should be able to make requests up to limit
            for (let i = 0; i < 100; i++) {
                expect(rateLimiter.isAllowed('user_123')).toBe(true);
            }

            // Next request should be blocked
            expect(rateLimiter.isAllowed('user_123')).toBe(false);

            // Different user should have their own limit
            expect(rateLimiter.isAllowed('user_456')).toBe(true);
        });
    });

    describe('Session Security', () => {
        it('should regenerate session ID after authentication', () => {
            const sessionManager = new SecureSessionManager();

            const oldSessionId = sessionManager.createSession();
            sessionManager.authenticate(oldSessionId, 'user_123');

            const newSessionId = sessionManager.getSessionId(oldSessionId);

            expect(newSessionId).not.toBe(oldSessionId);
        });

        it('should invalidate all sessions on password change', () => {
            const sessionManager = new SecureSessionManager();

            const session1 = sessionManager.createSession();
            const session2 = sessionManager.createSession();

            sessionManager.authenticate(session1, 'user_123');
            sessionManager.authenticate(session2, 'user_123');

            sessionManager.invalidateAllUserSessions('user_123');

            expect(sessionManager.isValidSession(session1)).toBe(false);
            expect(sessionManager.isValidSession(session2)).toBe(false);
        });

        it('should implement session timeout', () => {
            vi.useFakeTimers();

            const sessionManager = new SecureSessionManager({ timeoutMs: 3600000 }); // 1 hour

            const sessionId = sessionManager.createSession();
            expect(sessionManager.isValidSession(sessionId)).toBe(true);

            vi.advanceTimersByTime(3600001); // Just over 1 hour

            expect(sessionManager.isValidSession(sessionId)).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('Brute Force Protection', () => {
        it('should lock account after failed login attempts', () => {
            const loginProtection = new LoginProtection({
                maxAttempts: 5,
                lockoutDurationMs: 900000 // 15 minutes
            });

            // Fail 5 login attempts
            for (let i = 0; i < 5; i++) {
                loginProtection.recordFailedAttempt('user@example.com');
            }

            expect(loginProtection.isAccountLocked('user@example.com')).toBe(true);
        });

        it('should reset failed attempts after successful login', () => {
            const loginProtection = new LoginProtection({
                maxAttempts: 5,
                lockoutDurationMs: 900000
            });

            // Fail 3 attempts
            for (let i = 0; i < 3; i++) {
                loginProtection.recordFailedAttempt('user@example.com');
            }

            // Successful login
            loginProtection.recordSuccessfulLogin('user@example.com');

            // Should not be locked
            expect(loginProtection.isAccountLocked('user@example.com')).toBe(false);
            expect(loginProtection.getFailedAttempts('user@example.com')).toBe(0);
        });

        it('should implement exponential backoff', () => {
            const loginProtection = new LoginProtection({
                maxAttempts: 5,
                lockoutDurationMs: 60000,
                useExponentialBackoff: true
            });

            loginProtection.recordFailedAttempt('user@example.com');
            const delay1 = loginProtection.getBackoffDelay('user@example.com');

            loginProtection.recordFailedAttempt('user@example.com');
            const delay2 = loginProtection.getBackoffDelay('user@example.com');

            loginProtection.recordFailedAttempt('user@example.com');
            const delay3 = loginProtection.getBackoffDelay('user@example.com');

            // Delays should increase exponentially
            expect(delay2).toBeGreaterThan(delay1);
            expect(delay3).toBeGreaterThan(delay2);
        });
    });
});

// Helper implementations
function validateApiKey(apiKey: string | undefined): { valid: boolean; error?: string } {
    if (!apiKey) {
        return { valid: false, error: 'Missing API key' };
    }

    if (apiKey.length === 0) {
        return { valid: false, error: 'Empty API key' };
    }

    // Check format: sk_test_ or sk_live_ prefix
    if (!apiKey.match(/^sk_(test|live)_[a-zA-Z0-9]{10,100}$/)) {
        return { valid: false, error: 'Invalid API key format' };
    }

    return { valid: true };
}

function validateApiKeyWithServer(apiKey: string, expectedHash: string): { valid: boolean; error?: string } {
    const result = validateApiKey(apiKey);
    if (!result.valid) return result;

    const hash = hashApiKey(apiKey);
    if (hash !== expectedHash) {
        return { valid: false, error: 'Invalid credentials' }; // Generic error
    }

    return { valid: true };
}

function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function validateApiKeyHash(apiKey: string, storedHash: string): boolean {
    const providedHash = hashApiKey(apiKey);
    try {
        return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
    } catch {
        return false;
    }
}

function generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

function generateTokenWithExpiry(options: { expiresInSeconds: number }): string {
    const payload = {
        exp: Date.now() + options.expiresInSeconds * 1000,
        data: crypto.randomBytes(16).toString('hex')
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
        return Date.now() > payload.exp;
    } catch {
        return true;
    }
}

const TOKEN_SECRET = 'test_secret_for_signing';

function generateSignedToken(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifySignedToken(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, body, signature] = parts;
    if (!header || !body || !signature) return false;

    const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
        return false;
    }
}

function canAccessResource(requestingUserId: string, _resourceId: string, ownerId: string): boolean {
    return requestingUserId === ownerId;
}

function hasPermission(token: { scopes: string[] }, requiredScope: string): boolean {
    return token.scopes.includes(requiredScope) || token.scopes.includes('*');
}

function attemptEscalation(token: { role: string; scopes: string[] }, requestedScopes: string[]): { role: string; scopes: string[] } {
    // Filter out any admin scopes for non-admin users
    let allowedScopes = requestedScopes;
    if (token.role !== 'admin') {
        allowedScopes = requestedScopes.filter((s) => !s.startsWith('admin:'));
    }
    return { ...token, scopes: [...token.scopes, ...allowedScopes] };
}

class UserRateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(options: { maxRequests: number; windowMs: number }) {
        this.maxRequests = options.maxRequests;
        this.windowMs = options.windowMs;
    }

    isAllowed(userId: string): boolean {
        const now = Date.now();
        const userRequests = this.requests.get(userId) ?? [];
        const validRequests = userRequests.filter((timestamp) => now - timestamp < this.windowMs);

        if (validRequests.length >= this.maxRequests) {
            return false;
        }

        validRequests.push(now);
        this.requests.set(userId, validRequests);
        return true;
    }
}

class SecureSessionManager {
    private sessions: Map<string, { userId?: string; createdAt: number }> = new Map();
    private sessionMapping: Map<string, string> = new Map();
    private timeoutMs: number;

    constructor(options: { timeoutMs?: number } = {}) {
        this.timeoutMs = options.timeoutMs ?? 3600000;
    }

    createSession(): string {
        const sessionId = crypto.randomBytes(32).toString('hex');
        this.sessions.set(sessionId, { createdAt: Date.now() });
        return sessionId;
    }

    authenticate(sessionId: string, userId: string): string {
        // Regenerate session ID to prevent session fixation
        const newSessionId = crypto.randomBytes(32).toString('hex');
        const session = this.sessions.get(sessionId);

        if (session) {
            this.sessions.delete(sessionId);
            this.sessions.set(newSessionId, { userId, createdAt: Date.now() });
            this.sessionMapping.set(sessionId, newSessionId);
        }

        return newSessionId;
    }

    getSessionId(oldSessionId: string): string {
        return this.sessionMapping.get(oldSessionId) ?? oldSessionId;
    }

    isValidSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        return Date.now() - session.createdAt < this.timeoutMs;
    }

    invalidateAllUserSessions(userId: string): void {
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.userId === userId) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

class LoginProtection {
    private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
    private maxAttempts: number;
    private lockoutDurationMs: number;
    private useExponentialBackoff: boolean;

    constructor(options: { maxAttempts: number; lockoutDurationMs: number; useExponentialBackoff?: boolean }) {
        this.maxAttempts = options.maxAttempts;
        this.lockoutDurationMs = options.lockoutDurationMs;
        this.useExponentialBackoff = options.useExponentialBackoff ?? false;
    }

    recordFailedAttempt(identifier: string): void {
        const current = this.attempts.get(identifier) ?? { count: 0, lastAttempt: 0 };
        this.attempts.set(identifier, { count: current.count + 1, lastAttempt: Date.now() });
    }

    recordSuccessfulLogin(identifier: string): void {
        this.attempts.delete(identifier);
    }

    isAccountLocked(identifier: string): boolean {
        const record = this.attempts.get(identifier);
        if (!record) return false;

        if (record.count >= this.maxAttempts) {
            if (Date.now() - record.lastAttempt < this.lockoutDurationMs) {
                return true;
            }
            // Lockout expired
            this.attempts.delete(identifier);
        }

        return false;
    }

    getFailedAttempts(identifier: string): number {
        return this.attempts.get(identifier)?.count ?? 0;
    }

    getBackoffDelay(identifier: string): number {
        const record = this.attempts.get(identifier);
        if (!record || !this.useExponentialBackoff) return 0;
        // Exponential backoff: 2^attempts * 1000ms
        return Math.min(2 ** record.count * 1000, this.lockoutDurationMs);
    }
}
