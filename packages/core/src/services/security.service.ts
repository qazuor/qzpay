/**
 * Security service helpers for QZPay
 *
 * Provides utilities for rate limiting, idempotency,
 * request validation, and security auditing.
 */
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Rate limit configuration
 */
export interface QZPayRateLimitConfig {
    /** Maximum requests allowed */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Optional key prefix */
    keyPrefix?: string;
}

/**
 * Rate limit result
 */
export interface QZPayRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfterMs?: number;
}

/**
 * Rate limit entry
 */
export interface QZPayRateLimitEntry {
    key: string;
    count: number;
    windowStart: Date;
    windowEnd: Date;
}

/**
 * Idempotency key record
 */
export interface QZPayIdempotencyKey {
    id: string;
    key: string;
    operation: string;
    requestHash: string;
    status: 'pending' | 'completed' | 'failed';
    response: Record<string, unknown> | null;
    statusCode: number | null;
    expiresAt: Date;
    createdAt: Date;
    completedAt: Date | null;
}

/**
 * Idempotency check result
 */
export interface QZPayIdempotencyCheckResult {
    isNew: boolean;
    existingKey?: QZPayIdempotencyKey;
    shouldProcess: boolean;
}

/**
 * Security audit log entry
 */
export interface QZPaySecurityAuditEntry {
    id: string;
    timestamp: Date;
    action: string;
    resourceType: string;
    resourceId: string;
    actorId: string | null;
    actorType: 'user' | 'api' | 'system' | 'webhook';
    ipAddress: string | null;
    userAgent: string | null;
    success: boolean;
    metadata: Record<string, unknown>;
}

/**
 * IP restriction configuration
 */
export interface QZPayIPRestrictionConfig {
    allowedIPs: string[];
    blockedIPs: string[];
    mode: 'allowlist' | 'blocklist' | 'both';
}

/**
 * Request signature verification
 */
export interface QZPaySignatureConfig {
    algorithm: 'sha256' | 'sha512';
    headerName: string;
    timestampTolerance: number;
}

// ==================== Rate Limiting ====================

/**
 * Create rate limit configuration with defaults
 */
export function qzpayCreateRateLimitConfig(overrides: Partial<QZPayRateLimitConfig> = {}): QZPayRateLimitConfig {
    return {
        maxRequests: 100,
        windowMs: 60000, // 1 minute
        keyPrefix: 'ratelimit',
        ...overrides
    };
}

/**
 * Generate rate limit key
 */
export function qzpayGenerateRateLimitKey(identifier: string, config: QZPayRateLimitConfig): string {
    const prefix = config.keyPrefix ?? 'ratelimit';
    return `${prefix}:${identifier}`;
}

/**
 * Calculate rate limit window
 */
export function qzpayCalculateRateLimitWindow(
    config: QZPayRateLimitConfig,
    now: Date = new Date()
): {
    start: Date;
    end: Date;
} {
    const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs);
    const windowEnd = new Date(windowStart.getTime() + config.windowMs);

    return { start: windowStart, end: windowEnd };
}

/**
 * Check rate limit (in-memory)
 */
export function qzpayCheckRateLimit(
    entry: QZPayRateLimitEntry | null,
    config: QZPayRateLimitConfig,
    now: Date = new Date()
): QZPayRateLimitResult {
    const window = qzpayCalculateRateLimitWindow(config, now);

    // No entry or expired window - allow
    if (!entry || entry.windowEnd <= now) {
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: window.end
        };
    }

    // Within current window
    if (entry.count >= config.maxRequests) {
        const retryAfterMs = entry.windowEnd.getTime() - now.getTime();
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.windowEnd,
            retryAfterMs: Math.max(0, retryAfterMs)
        };
    }

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count - 1,
        resetAt: entry.windowEnd
    };
}

/**
 * Create or update rate limit entry
 */
export function qzpayUpdateRateLimitEntry(
    key: string,
    existing: QZPayRateLimitEntry | null,
    config: QZPayRateLimitConfig,
    now: Date = new Date()
): QZPayRateLimitEntry {
    const window = qzpayCalculateRateLimitWindow(config, now);

    // Existing entry in current window
    if (existing && existing.windowEnd > now) {
        return {
            ...existing,
            count: existing.count + 1
        };
    }

    // New window
    return {
        key,
        count: 1,
        windowStart: window.start,
        windowEnd: window.end
    };
}

/**
 * Get rate limit headers for response
 */
export function qzpayGetRateLimitHeaders(result: QZPayRateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000))
    };

    if (!result.allowed && result.retryAfterMs !== undefined) {
        headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
    }

    return headers;
}

/**
 * Common rate limit presets
 */
export const QZPAY_RATE_LIMIT_PRESETS = {
    /** Standard API rate limit */
    API_STANDARD: qzpayCreateRateLimitConfig({ maxRequests: 100, windowMs: 60000 }),
    /** Strict rate limit for sensitive operations */
    API_STRICT: qzpayCreateRateLimitConfig({ maxRequests: 10, windowMs: 60000 }),
    /** Webhook delivery rate limit */
    WEBHOOK: qzpayCreateRateLimitConfig({ maxRequests: 1000, windowMs: 60000 }),
    /** Authentication attempts */
    AUTH: qzpayCreateRateLimitConfig({ maxRequests: 5, windowMs: 300000 })
} as const;

// ==================== Idempotency ====================

/**
 * Create idempotency key record
 */
export function qzpayCreateIdempotencyKey(
    key: string,
    operation: string,
    requestHash: string,
    expirationMs = 86400000 // 24 hours
): QZPayIdempotencyKey {
    const now = new Date();

    return {
        id: qzpayGenerateId('idem'),
        key,
        operation,
        requestHash,
        status: 'pending',
        response: null,
        statusCode: null,
        expiresAt: new Date(now.getTime() + expirationMs),
        createdAt: now,
        completedAt: null
    };
}

/**
 * Check if idempotency key exists and is still valid
 */
export function qzpayCheckIdempotencyKey(
    existingKey: QZPayIdempotencyKey | null,
    requestHash: string,
    now: Date = new Date()
): QZPayIdempotencyCheckResult {
    // No existing key - process normally
    if (!existingKey) {
        return { isNew: true, shouldProcess: true };
    }

    // Key expired - treat as new
    if (existingKey.expiresAt < now) {
        return { isNew: true, shouldProcess: true };
    }

    // Key exists and not expired
    // Check if request is the same
    if (existingKey.requestHash !== requestHash) {
        // Same key but different request - this is an error
        return {
            isNew: false,
            existingKey,
            shouldProcess: false
        };
    }

    // Same key and same request
    if (existingKey.status === 'completed') {
        // Return cached response
        return {
            isNew: false,
            existingKey,
            shouldProcess: false
        };
    }

    if (existingKey.status === 'pending') {
        // Request is still processing
        return {
            isNew: false,
            existingKey,
            shouldProcess: false
        };
    }

    // Failed - allow retry
    return {
        isNew: false,
        existingKey,
        shouldProcess: true
    };
}

/**
 * Complete idempotency key with response
 */
export function qzpayCompleteIdempotencyKey(
    key: QZPayIdempotencyKey,
    response: Record<string, unknown>,
    statusCode: number
): QZPayIdempotencyKey {
    return {
        ...key,
        status: 'completed',
        response,
        statusCode,
        completedAt: new Date()
    };
}

/**
 * Fail idempotency key
 */
export function qzpayFailIdempotencyKey(key: QZPayIdempotencyKey): QZPayIdempotencyKey {
    return {
        ...key,
        status: 'failed',
        completedAt: new Date()
    };
}

/**
 * Generate request hash for idempotency comparison
 */
export function qzpayGenerateRequestHash(request: Record<string, unknown>): string {
    const sortedKeys = Object.keys(request).sort();
    const normalized = sortedKeys.reduce(
        (acc, key) => {
            acc[key] = request[key];
            return acc;
        },
        {} as Record<string, unknown>
    );

    return JSON.stringify(normalized);
}

/**
 * Check if idempotency key is expired
 */
export function qzpayIdempotencyKeyIsExpired(key: QZPayIdempotencyKey, now: Date = new Date()): boolean {
    return key.expiresAt < now;
}

// ==================== Security Audit ====================

/**
 * Create audit log entry
 */
export function qzpayCreateAuditEntry(
    action: string,
    resourceType: string,
    resourceId: string,
    options: {
        actorId?: string;
        actorType?: QZPaySecurityAuditEntry['actorType'];
        ipAddress?: string;
        userAgent?: string;
        success?: boolean;
        metadata?: Record<string, unknown>;
    } = {}
): QZPaySecurityAuditEntry {
    return {
        id: qzpayGenerateId('audit'),
        timestamp: new Date(),
        action,
        resourceType,
        resourceId,
        actorId: options.actorId ?? null,
        actorType: options.actorType ?? 'system',
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
        success: options.success ?? true,
        metadata: options.metadata ?? {}
    };
}

/**
 * Create payment audit entry
 */
export function qzpayCreatePaymentAuditEntry(
    action: 'create' | 'capture' | 'refund' | 'void',
    paymentId: string,
    amount: number,
    options: Parameters<typeof qzpayCreateAuditEntry>[3] = {}
): QZPaySecurityAuditEntry {
    return qzpayCreateAuditEntry(`payment.${action}`, 'payment', paymentId, {
        ...options,
        metadata: { ...options.metadata, amount }
    });
}

/**
 * Create subscription audit entry
 */
export function qzpayCreateSubscriptionAuditEntry(
    action: 'create' | 'update' | 'cancel' | 'renew',
    subscriptionId: string,
    options: Parameters<typeof qzpayCreateAuditEntry>[3] = {}
): QZPaySecurityAuditEntry {
    return qzpayCreateAuditEntry(`subscription.${action}`, 'subscription', subscriptionId, options);
}

/**
 * Create customer audit entry
 */
export function qzpayCreateCustomerAuditEntry(
    action: 'create' | 'update' | 'delete',
    customerId: string,
    options: Parameters<typeof qzpayCreateAuditEntry>[3] = {}
): QZPaySecurityAuditEntry {
    return qzpayCreateAuditEntry(`customer.${action}`, 'customer', customerId, options);
}

// ==================== IP Restriction ====================

/**
 * Create IP restriction config
 */
export function qzpayCreateIPRestrictionConfig(overrides: Partial<QZPayIPRestrictionConfig> = {}): QZPayIPRestrictionConfig {
    return {
        allowedIPs: [],
        blockedIPs: [],
        mode: 'blocklist',
        ...overrides
    };
}

/**
 * Check if IP is allowed
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: IP validation requires multiple conditional checks for blocklist/allowlist modes
export function qzpayCheckIPAllowed(ip: string, config: QZPayIPRestrictionConfig): boolean {
    const normalizedIP = ip.trim().toLowerCase();

    // Check blocked list first
    if (config.mode === 'blocklist' || config.mode === 'both') {
        for (const blockedIP of config.blockedIPs) {
            if (qzpayIPMatches(normalizedIP, blockedIP)) {
                return false;
            }
        }
    }

    // Check allow list
    if (config.mode === 'allowlist' || config.mode === 'both') {
        if (config.allowedIPs.length === 0) {
            return true; // Empty allowlist means allow all (except blocked)
        }

        for (const allowedIP of config.allowedIPs) {
            if (qzpayIPMatches(normalizedIP, allowedIP)) {
                return true;
            }
        }

        return false;
    }

    return true;
}

/**
 * Check if IP matches pattern (supports CIDR notation and wildcards)
 */
export function qzpayIPMatches(ip: string, pattern: string): boolean {
    // Exact match
    if (ip === pattern) {
        return true;
    }

    // Wildcard match (e.g., 192.168.*)
    if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
        return regex.test(ip);
    }

    // CIDR notation (simplified check)
    if (pattern.includes('/')) {
        return qzpayIPMatchesCIDR(ip, pattern);
    }

    return false;
}

/**
 * Simple CIDR matching (IPv4 only)
 */
function qzpayIPMatchesCIDR(ip: string, cidr: string): boolean {
    const parts = cidr.split('/');
    const cidrIP = parts[0];
    const maskBits = parts[1];

    if (!cidrIP || !maskBits) {
        return false;
    }

    const mask = Number.parseInt(maskBits, 10);

    if (Number.isNaN(mask) || mask < 0 || mask > 32) {
        return false;
    }

    const ipNum = qzpayIPToNumber(ip);
    const cidrNum = qzpayIPToNumber(cidrIP);

    if (ipNum === null || cidrNum === null) {
        return false;
    }

    const maskNum = (-1 << (32 - mask)) >>> 0;
    return (ipNum & maskNum) === (cidrNum & maskNum);
}

/**
 * Convert IP to number
 */
function qzpayIPToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
        return null;
    }

    let num = 0;
    for (const part of parts) {
        const octet = Number.parseInt(part, 10);
        if (Number.isNaN(octet) || octet < 0 || octet > 255) {
            return null;
        }
        num = (num << 8) + octet;
    }

    return num >>> 0;
}

// ==================== Request Validation ====================

/**
 * Sanitize string input
 */
export function qzpaySanitizeString(input: string, maxLength = 1000): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Trim and limit length
    sanitized = sanitized.trim().slice(0, maxLength);

    return sanitized;
}

/**
 * Validate and sanitize email
 */
export function qzpayValidateEmail(email: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = email.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid email format' };
    }

    // Check length
    if (sanitized.length > 254) {
        return { valid: false, sanitized, error: 'Email too long' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate amount (in cents)
 */
export function qzpayValidateAmount(amount: unknown): { valid: boolean; value: number; error?: string } {
    if (typeof amount !== 'number') {
        return { valid: false, value: 0, error: 'Amount must be a number' };
    }

    if (!Number.isInteger(amount)) {
        return { valid: false, value: 0, error: 'Amount must be an integer (cents)' };
    }

    if (amount < 0) {
        return { valid: false, value: 0, error: 'Amount cannot be negative' };
    }

    if (amount > 99999999) {
        return { valid: false, value: 0, error: 'Amount exceeds maximum allowed' };
    }

    return { valid: true, value: amount };
}

/**
 * Validate currency code
 */
export function qzpayValidateCurrency(currency: string): { valid: boolean; value: string; error?: string } {
    const normalized = currency.toLowerCase().trim();

    const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'nzd', 'brl', 'mxn', 'ars'];

    if (!validCurrencies.includes(normalized)) {
        return { valid: false, value: normalized, error: `Invalid currency: ${currency}` };
    }

    return { valid: true, value: normalized };
}

/**
 * Validate metadata object
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Metadata validation requires checking multiple value types and constraints
export function qzpayValidateMetadata(
    metadata: unknown,
    maxKeys = 50,
    maxValueLength = 500
): { valid: boolean; value: Record<string, unknown>; errors: string[] } {
    const errors: string[] = [];

    if (metadata === null || metadata === undefined) {
        return { valid: true, value: {}, errors: [] };
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return { valid: false, value: {}, errors: ['Metadata must be an object'] };
    }

    const entries = Object.entries(metadata as Record<string, unknown>);

    if (entries.length > maxKeys) {
        errors.push(`Metadata exceeds maximum of ${maxKeys} keys`);
    }

    const sanitizedMetadata: Record<string, unknown> = {};

    for (const [key, value] of entries.slice(0, maxKeys)) {
        // Validate key
        if (typeof key !== 'string' || key.length === 0 || key.length > 40) {
            errors.push(`Invalid metadata key: ${key}`);
            continue;
        }

        // Validate value
        if (typeof value === 'string') {
            if (value.length > maxValueLength) {
                errors.push(`Metadata value for '${key}' exceeds maximum length`);
                sanitizedMetadata[key] = value.slice(0, maxValueLength);
            } else {
                sanitizedMetadata[key] = value;
            }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitizedMetadata[key] = value;
        } else {
            errors.push(`Invalid metadata value type for '${key}'`);
        }
    }

    return {
        valid: errors.length === 0,
        value: sanitizedMetadata,
        errors
    };
}

// ==================== Sensitive Data ====================

/**
 * Mask sensitive data for logging
 */
export function qzpayMaskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'secret', 'token', 'api_key', 'apiKey', 'card_number', 'cvv', 'cvc'];
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some((sk) => lowerKey.includes(sk));

        if (isSensitive && typeof value === 'string') {
            masked[key] = value.length > 4 ? `****${value.slice(-4)}` : '****';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            masked[key] = qzpayMaskSensitiveData(value as Record<string, unknown>);
        } else {
            masked[key] = value;
        }
    }

    return masked;
}

/**
 * Mask card number for display
 */
export function qzpayMaskCardNumber(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 8) {
        return '****';
    }
    return `****${digits.slice(-4)}`;
}

/**
 * Mask email for display
 */
export function qzpayMaskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
        return '****@****';
    }

    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';

    return `${maskedLocal}@${domain}`;
}
