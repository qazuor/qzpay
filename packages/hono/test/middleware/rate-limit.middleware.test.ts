/**
 * Rate Limit Middleware Tests
 */
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    QZPayMemoryRateLimitStore,
    createApiKeyRateLimiter,
    createCustomerRateLimiter,
    createRateLimitMiddleware,
    createStrictRateLimiter,
    rateLimitKeyByApiKey,
    rateLimitKeyByCustomerId,
    rateLimitKeyByIP
} from '../../src/middleware/rate-limit.middleware.js';

describe('Rate Limit Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('QZPayMemoryRateLimitStore', () => {
        let store: QZPayMemoryRateLimitStore;

        beforeEach(() => {
            store = new QZPayMemoryRateLimitStore();
        });

        afterEach(() => {
            store.destroy();
        });

        it('should return null for non-existent key', async () => {
            const result = await store.get('non-existent');
            expect(result).toBeNull();
        });

        it('should increment and return entry', async () => {
            const entry = await store.increment('test-key', 60000);

            expect(entry.count).toBe(1);
            expect(entry.resetAt).toBeGreaterThan(Date.now());
        });

        it('should increment existing entry', async () => {
            await store.increment('test-key', 60000);
            const entry = await store.increment('test-key', 60000);

            expect(entry.count).toBe(2);
        });

        it('should reset entry', async () => {
            await store.increment('test-key', 60000);
            await store.reset('test-key');

            const result = await store.get('test-key');
            expect(result).toBeNull();
        });

        it('should expire entries after window', async () => {
            await store.increment('test-key', 1000);

            // Fast forward past window
            vi.advanceTimersByTime(2000);

            const result = await store.get('test-key');
            expect(result).toBeNull();
        });

        it('should track store size', async () => {
            expect(store.size()).toBe(0);

            await store.increment('key1', 60000);
            await store.increment('key2', 60000);

            expect(store.size()).toBe(2);
        });

        it('should cleanup expired entries', async () => {
            await store.increment('key1', 1000);
            await store.increment('key2', 120000);

            expect(store.size()).toBe(2);

            // Fast forward to trigger cleanup (1 minute)
            vi.advanceTimersByTime(61000);

            // key1 should be expired
            const key1 = await store.get('key1');
            expect(key1).toBeNull();

            // key2 should still exist
            const key2 = await store.get('key2');
            expect(key2).not.toBeNull();
        });

        it('should clear store on destroy', () => {
            store.destroy();
            expect(store.size()).toBe(0);
        });
    });

    describe('Key Generators', () => {
        it('should extract IP from x-forwarded-for', () => {
            const mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
                        return undefined;
                    })
                }
            } as unknown as Parameters<typeof rateLimitKeyByIP>[0];

            const key = rateLimitKeyByIP(mockContext);
            expect(key).toBe('192.168.1.1');
        });

        it('should extract IP from x-real-ip', () => {
            const mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'x-real-ip') return '10.0.0.1';
                        return undefined;
                    })
                }
            } as unknown as Parameters<typeof rateLimitKeyByIP>[0];

            const key = rateLimitKeyByIP(mockContext);
            expect(key).toBe('10.0.0.1');
        });

        it('should fallback to unknown for IP', () => {
            const mockContext = {
                req: {
                    header: vi.fn(() => undefined)
                }
            } as unknown as Parameters<typeof rateLimitKeyByIP>[0];

            const key = rateLimitKeyByIP(mockContext);
            expect(key).toBe('unknown');
        });

        it('should use API key when present', () => {
            const mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'x-api-key') return 'my-api-key';
                        return undefined;
                    })
                }
            } as unknown as Parameters<typeof rateLimitKeyByApiKey>[0];

            const key = rateLimitKeyByApiKey(mockContext);
            expect(key).toBe('my-api-key');
        });

        it('should fallback to IP when no API key', () => {
            const mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'x-forwarded-for') return '192.168.1.1';
                        return undefined;
                    })
                }
            } as unknown as Parameters<typeof rateLimitKeyByApiKey>[0];

            const key = rateLimitKeyByApiKey(mockContext);
            expect(key).toBe('192.168.1.1');
        });

        it('should use customer ID when present', () => {
            const mockContext = {
                req: {
                    header: vi.fn(() => undefined)
                },
                get: vi.fn((key: string) => {
                    if (key === 'customerId') return 'cust_123';
                    return undefined;
                })
            } as unknown as Parameters<typeof rateLimitKeyByCustomerId>[0];

            const key = rateLimitKeyByCustomerId(mockContext);
            expect(key).toBe('cust_123');
        });

        it('should fallback to IP when no customer ID', () => {
            const mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'x-real-ip') return '10.0.0.1';
                        return undefined;
                    })
                },
                get: vi.fn(() => undefined)
            } as unknown as Parameters<typeof rateLimitKeyByCustomerId>[0];

            const key = rateLimitKeyByCustomerId(mockContext);
            expect(key).toBe('10.0.0.1');
        });
    });

    describe('createRateLimitMiddleware', () => {
        it('should allow requests under limit', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createRateLimitMiddleware({ limit: 5, store }));
            app.get('/test', (c) => c.text('OK'));

            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.status).toBe(200);
            expect(await res.text()).toBe('OK');
            store.destroy();
        });

        it('should include rate limit headers', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createRateLimitMiddleware({ limit: 100, store }));
            app.get('/test', (c) => c.text('OK'));

            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
            expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
            store.destroy();
        });

        it('should not include headers when disabled', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createRateLimitMiddleware({ limit: 100, headers: false, store }));
            app.get('/test', (c) => c.text('OK'));

            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
            store.destroy();
        });

        it('should block requests over limit', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createRateLimitMiddleware({ limit: 2, store }));
            app.get('/test', (c) => c.text('OK'));

            // First two requests should pass
            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });
            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });

            // Third request should be rate limited
            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.status).toBe(429);
            expect(res.headers.get('Retry-After')).toBeTruthy();

            const body = await res.json();
            expect(body.error).toBe('Too many requests, please try again later.');
            store.destroy();
        });

        it('should use custom message string', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    message: 'Slow down!',
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });
            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.status).toBe(429);
            expect(await res.text()).toBe('Slow down!');
            store.destroy();
        });

        it('should use custom status code', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    statusCode: 503,
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });
            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            expect(res.status).toBe(503);
            store.destroy();
        });

        it('should respect skip function', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    skip: (c) => c.req.header('x-admin') === 'true',
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            // Admin requests should not be rate limited
            for (let i = 0; i < 5; i++) {
                const res = await app.request('/test', {
                    headers: { 'x-forwarded-for': '192.168.1.1', 'x-admin': 'true' }
                });
                expect(res.status).toBe(200);
            }
            store.destroy();
        });

        it('should call onRateLimited callback', async () => {
            const store = new QZPayMemoryRateLimitStore();
            const onRateLimited = vi.fn();

            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    onRateLimited,
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });
            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });

            expect(onRateLimited).toHaveBeenCalledTimes(1);
            expect(onRateLimited).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    limit: 1,
                    remaining: 0
                })
            );
            store.destroy();
        });

        it('should use custom key generator', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    keyGenerator: (c) => c.req.header('x-user-id') ?? 'anonymous',
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            // Different users should have separate limits
            const res1 = await app.request('/test', {
                headers: { 'x-user-id': 'user1' }
            });
            const res2 = await app.request('/test', {
                headers: { 'x-user-id': 'user2' }
            });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);

            // Same user should be rate limited
            const res3 = await app.request('/test', {
                headers: { 'x-user-id': 'user1' }
            });
            expect(res3.status).toBe(429);
            store.destroy();
        });

        it('should reset after window expires', async () => {
            const store = new QZPayMemoryRateLimitStore();

            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 1,
                    windowMs: 1000,
                    store
                })
            );
            app.get('/test', (c) => c.text('OK'));

            // First request passes
            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });

            // Second request is limited
            let res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });
            expect(res.status).toBe(429);

            // Wait for window to expire
            vi.advanceTimersByTime(2000);

            // Request should pass again
            res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });
            expect(res.status).toBe(200);

            store.destroy();
        });
    });

    describe('Convenience Factories', () => {
        it('createApiKeyRateLimiter should use API key', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createApiKeyRateLimiter({ limit: 1, store }));
            app.get('/test', (c) => c.text('OK'));

            // Different API keys should have separate limits
            const res1 = await app.request('/test', {
                headers: { 'x-api-key': 'key1' }
            });
            const res2 = await app.request('/test', {
                headers: { 'x-api-key': 'key2' }
            });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            store.destroy();
        });

        it('createCustomerRateLimiter should work with customer context', async () => {
            const store = new QZPayMemoryRateLimitStore();
            // Simulate auth middleware setting customerId
            app.use('*', async (c, next) => {
                const customerId = c.req.header('x-customer-id');
                if (customerId) {
                    c.set('customerId', customerId);
                }
                await next();
            });
            app.use('*', createCustomerRateLimiter({ limit: 1, store }));
            app.get('/test', (c) => c.text('OK'));

            // Different customers should have separate limits
            const res1 = await app.request('/test', {
                headers: { 'x-customer-id': 'cust1' }
            });
            const res2 = await app.request('/test', {
                headers: { 'x-customer-id': 'cust2' }
            });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            store.destroy();
        });

        it('createStrictRateLimiter should have low limit', async () => {
            const store = new QZPayMemoryRateLimitStore();
            app.use('*', createStrictRateLimiter({ store }));
            app.get('/test', (c) => c.text('OK'));

            // Default strict limit is 5
            for (let i = 0; i < 5; i++) {
                const res = await app.request('/test', {
                    headers: { 'x-forwarded-for': '192.168.1.1' }
                });
                expect(res.status).toBe(200);
            }

            // 6th request should be limited
            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });
            expect(res.status).toBe(429);
            store.destroy();
        });
    });

    describe('Integration with custom store', () => {
        it('should work with custom store implementation', async () => {
            // Simple mock store
            const mockStore = {
                data: new Map<string, { count: number; resetAt: number }>(),
                async get(key: string) {
                    return this.data.get(key) ?? null;
                },
                async increment(key: string, windowMs: number) {
                    const existing = this.data.get(key);
                    if (existing) {
                        existing.count++;
                        return existing;
                    }
                    const entry = { count: 1, resetAt: Date.now() + windowMs };
                    this.data.set(key, entry);
                    return entry;
                },
                async reset(key: string) {
                    this.data.delete(key);
                }
            };

            app.use(
                '*',
                createRateLimitMiddleware({
                    limit: 2,
                    store: mockStore
                })
            );
            app.get('/test', (c) => c.text('OK'));

            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });
            await app.request('/test', { headers: { 'x-forwarded-for': '192.168.1.1' } });

            const res = await app.request('/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });
            expect(res.status).toBe(429);

            // Verify store was used
            expect(mockStore.data.get('192.168.1.1')?.count).toBe(3);
        });
    });
});
