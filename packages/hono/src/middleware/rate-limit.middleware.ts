/**
 * Rate Limiting Middleware for QZPay Hono
 *
 * Provides configurable rate limiting with pluggable storage backends.
 * Includes memory-based store by default, with interface for Redis/external stores.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// ==================== Types ====================

/**
 * Rate limit store interface
 *
 * Implement this interface to use a custom storage backend (e.g., Redis).
 */
export interface QZPayRateLimitStore {
    /**
     * Get current rate limit info for a key
     */
    get(key: string): Promise<QZPayRateLimitEntry | null>;

    /**
     * Increment the counter for a key
     * Should create entry if not exists
     * @returns Updated entry
     */
    increment(key: string, windowMs: number): Promise<QZPayRateLimitEntry>;

    /**
     * Reset the counter for a key
     */
    reset(key: string): Promise<void>;
}

/**
 * Rate limit entry in store
 */
export interface QZPayRateLimitEntry {
    /** Current request count */
    count: number;
    /** Unix timestamp when the window resets */
    resetAt: number;
}

/**
 * Rate limit info returned to handlers
 */
export interface QZPayRateLimitInfo {
    /** Maximum requests allowed in window */
    limit: number;
    /** Remaining requests in current window */
    remaining: number;
    /** When the window resets */
    resetAt: Date;
}

/**
 * Rate limit configuration
 */
export interface QZPayRateLimitConfig {
    /** Time window in milliseconds (default: 60000 = 1 minute) */
    windowMs?: number | undefined;

    /** Maximum requests per window (default: 100) */
    limit?: number | undefined;

    /**
     * Function to generate the rate limit key from the request
     * Default: uses IP address
     */
    keyGenerator?: ((c: Context) => string) | undefined;

    /**
     * Custom response when rate limited
     * Can be a string message or object to return as JSON
     */
    message?: string | Record<string, unknown> | undefined;

    /**
     * Skip rate limiting for certain requests
     * Return true to skip
     */
    skip?: ((c: Context) => boolean | Promise<boolean>) | undefined;

    /**
     * Custom store implementation
     * Default: QZPayMemoryRateLimitStore
     */
    store?: QZPayRateLimitStore | undefined;

    /**
     * Callback when rate limit is exceeded
     */
    onRateLimited?: ((c: Context, info: QZPayRateLimitInfo) => void | Promise<void>) | undefined;

    /**
     * Whether to include rate limit headers in response
     * Default: true
     */
    headers?: boolean | undefined;

    /**
     * HTTP status code when rate limited
     * Default: 429
     */
    statusCode?: number | undefined;
}

// ==================== Memory Store Implementation ====================

/**
 * In-memory rate limit store
 *
 * Good for development and single-instance deployments.
 * For multi-instance deployments, use a Redis-based store.
 */
export class QZPayMemoryRateLimitStore implements QZPayRateLimitStore {
    private store = new Map<string, QZPayRateLimitEntry>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    async get(key: string): Promise<QZPayRateLimitEntry | null> {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() > entry.resetAt) {
            this.store.delete(key);
            return null;
        }

        return entry;
    }

    async increment(key: string, windowMs: number): Promise<QZPayRateLimitEntry> {
        const now = Date.now();
        const existing = await this.get(key);

        if (existing) {
            existing.count++;
            return existing;
        }

        // Create new entry
        const entry: QZPayRateLimitEntry = {
            count: 1,
            resetAt: now + windowMs
        };
        this.store.set(key, entry);
        return entry;
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetAt) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Stop the cleanup interval
     * Call this when shutting down to prevent memory leaks
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }

    /**
     * Get current store size (for monitoring)
     */
    size(): number {
        return this.store.size;
    }
}

// ==================== Default Key Generators ====================

/**
 * Generate rate limit key from IP address
 */
export function rateLimitKeyByIP(c: Context): string {
    // Try various headers for IP address
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }

    const realIp = c.req.header('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Fallback - in Hono, we might not have direct access to socket
    return 'unknown';
}

/**
 * Generate rate limit key from API key header
 */
export function rateLimitKeyByApiKey(c: Context): string {
    return c.req.header('x-api-key') ?? rateLimitKeyByIP(c);
}

/**
 * Generate rate limit key from customer ID (requires auth middleware)
 */
export function rateLimitKeyByCustomerId(c: Context): string {
    // Assumes customer ID is set by auth middleware
    const customerId = c.get('customerId') as string | undefined;
    return customerId ?? rateLimitKeyByIP(c);
}

// ==================== Middleware Factory ====================

// Singleton memory store for default usage
let defaultStore: QZPayMemoryRateLimitStore | null = null;

function getDefaultStore(): QZPayMemoryRateLimitStore {
    if (!defaultStore) {
        defaultStore = new QZPayMemoryRateLimitStore();
    }
    return defaultStore;
}

/**
 * Create a rate limiting middleware
 *
 * @example
 * ```typescript
 * import { createRateLimitMiddleware } from '@qazuor/qzpay-hono';
 *
 * // Basic usage with defaults (100 req/min by IP)
 * app.use('/api/*', createRateLimitMiddleware());
 *
 * // Custom configuration
 * app.use('/api/*', createRateLimitMiddleware({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   limit: 100,
 *   keyGenerator: (c) => c.req.header('x-api-key') || 'anonymous'
 * }));
 * ```
 */
export function createRateLimitMiddleware(config: QZPayRateLimitConfig = {}): MiddlewareHandler {
    const {
        windowMs = 60 * 1000, // 1 minute
        limit = 100,
        keyGenerator = rateLimitKeyByIP,
        message = { error: 'Too many requests, please try again later.' },
        skip,
        store = getDefaultStore(),
        onRateLimited,
        headers = true,
        statusCode = 429
    } = config;

    return async (c, next) => {
        // Check if should skip
        if (skip && (await skip(c))) {
            return next();
        }

        // Generate key
        const key = keyGenerator(c);

        // Get current count
        const entry = await store.increment(key, windowMs);
        const remaining = Math.max(0, limit - entry.count);
        const resetAt = new Date(entry.resetAt);

        const info: QZPayRateLimitInfo = {
            limit,
            remaining,
            resetAt
        };

        // Add headers if enabled
        if (headers) {
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', String(remaining));
            c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
        }

        // Check if rate limited
        if (entry.count > limit) {
            // Call callback if provided
            if (onRateLimited) {
                await onRateLimited(c, info);
            }

            // Add Retry-After header
            const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000);
            c.header('Retry-After', String(retryAfter));

            // Return rate limit response
            if (typeof message === 'string') {
                return c.text(message, statusCode as ContentfulStatusCode);
            }
            return c.json(message, statusCode as ContentfulStatusCode);
        }

        return next();
    };
}

// ==================== Convenience Middleware Factories ====================

/**
 * Create rate limiter keyed by API key
 *
 * @example
 * ```typescript
 * app.use('/api/*', createApiKeyRateLimiter({ limit: 1000 }));
 * ```
 */
export function createApiKeyRateLimiter(config: Omit<QZPayRateLimitConfig, 'keyGenerator'> = {}): MiddlewareHandler {
    return createRateLimitMiddleware({
        ...config,
        keyGenerator: rateLimitKeyByApiKey
    });
}

/**
 * Create rate limiter keyed by customer ID
 * Requires authentication middleware to set customerId
 *
 * @example
 * ```typescript
 * app.use('/api/*', authMiddleware);
 * app.use('/api/*', createCustomerRateLimiter({ limit: 500 }));
 * ```
 */
export function createCustomerRateLimiter(config: Omit<QZPayRateLimitConfig, 'keyGenerator'> = {}): MiddlewareHandler {
    return createRateLimitMiddleware({
        ...config,
        keyGenerator: rateLimitKeyByCustomerId
    });
}

/**
 * Create a strict rate limiter for sensitive endpoints
 *
 * @example
 * ```typescript
 * app.use('/api/auth/*', createStrictRateLimiter());
 * ```
 */
export function createStrictRateLimiter(config: Partial<QZPayRateLimitConfig> = {}): MiddlewareHandler {
    return createRateLimitMiddleware({
        windowMs: 60 * 1000, // 1 minute
        limit: 5, // 5 requests per minute
        message: { error: 'Rate limit exceeded. Please wait before trying again.' },
        ...config
    });
}
