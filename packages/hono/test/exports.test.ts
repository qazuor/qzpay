/**
 * Exports Tests
 *
 * Tests to ensure all exports are available and properly typed
 */
import { describe, expect, it } from 'vitest';
import * as honoExports from '../src/index.js';
import * as middlewareExports from '../src/middleware/index.js';
import * as routesExports from '../src/routes/index.js';

describe('Package Exports', () => {
    describe('Main exports (src/index.ts)', () => {
        it('should export middleware functions', () => {
            expect(honoExports.createQZPayMiddleware).toBeDefined();
            expect(honoExports.getQZPay).toBeDefined();
            expect(honoExports.createWebhookMiddleware).toBeDefined();
            expect(honoExports.createWebhookResponse).toBeDefined();
            expect(honoExports.getWebhookEvent).toBeDefined();
        });

        it('should export route functions', () => {
            expect(honoExports.createWebhookRouter).toBeDefined();
            expect(honoExports.createSimpleWebhookHandler).toBeDefined();
            expect(honoExports.createBillingRoutes).toBeDefined();
        });

        it('should have correct function types', () => {
            expect(typeof honoExports.createQZPayMiddleware).toBe('function');
            expect(typeof honoExports.getQZPay).toBe('function');
            expect(typeof honoExports.createWebhookMiddleware).toBe('function');
            expect(typeof honoExports.createWebhookResponse).toBe('function');
            expect(typeof honoExports.getWebhookEvent).toBe('function');
            expect(typeof honoExports.createWebhookRouter).toBe('function');
            expect(typeof honoExports.createSimpleWebhookHandler).toBe('function');
            expect(typeof honoExports.createBillingRoutes).toBe('function');
        });
    });

    describe('Middleware exports (src/middleware/index.ts)', () => {
        it('should export QZPay middleware', () => {
            expect(middlewareExports.createQZPayMiddleware).toBeDefined();
            expect(middlewareExports.getQZPay).toBeDefined();
        });

        it('should export webhook middleware', () => {
            expect(middlewareExports.createWebhookMiddleware).toBeDefined();
            expect(middlewareExports.createWebhookResponse).toBeDefined();
            expect(middlewareExports.getWebhookEvent).toBeDefined();
        });

        it('should have correct function types', () => {
            expect(typeof middlewareExports.createQZPayMiddleware).toBe('function');
            expect(typeof middlewareExports.getQZPay).toBe('function');
            expect(typeof middlewareExports.createWebhookMiddleware).toBe('function');
            expect(typeof middlewareExports.createWebhookResponse).toBe('function');
            expect(typeof middlewareExports.getWebhookEvent).toBe('function');
        });
    });

    describe('Routes exports (src/routes/index.ts)', () => {
        it('should export webhook routes', () => {
            expect(routesExports.createWebhookRouter).toBeDefined();
            expect(routesExports.createSimpleWebhookHandler).toBeDefined();
        });

        it('should export billing routes', () => {
            expect(routesExports.createBillingRoutes).toBeDefined();
        });

        it('should export admin routes', () => {
            expect(routesExports.createAdminRoutes).toBeDefined();
        });

        it('should have correct function types', () => {
            expect(typeof routesExports.createWebhookRouter).toBe('function');
            expect(typeof routesExports.createSimpleWebhookHandler).toBe('function');
            expect(typeof routesExports.createBillingRoutes).toBe('function');
            expect(typeof routesExports.createAdminRoutes).toBe('function');
        });
    });

    describe('Export consistency', () => {
        it('should export same middleware from index and middleware/index', () => {
            expect(honoExports.createQZPayMiddleware).toBe(middlewareExports.createQZPayMiddleware);
            expect(honoExports.getQZPay).toBe(middlewareExports.getQZPay);
            expect(honoExports.createWebhookMiddleware).toBe(middlewareExports.createWebhookMiddleware);
            expect(honoExports.createWebhookResponse).toBe(middlewareExports.createWebhookResponse);
            expect(honoExports.getWebhookEvent).toBe(middlewareExports.getWebhookEvent);
        });

        it('should export same routes from index and routes/index', () => {
            expect(honoExports.createWebhookRouter).toBe(routesExports.createWebhookRouter);
            expect(honoExports.createSimpleWebhookHandler).toBe(routesExports.createSimpleWebhookHandler);
            expect(honoExports.createBillingRoutes).toBe(routesExports.createBillingRoutes);
        });
    });
});
