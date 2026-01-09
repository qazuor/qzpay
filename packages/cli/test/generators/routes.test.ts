/**
 * Tests for routes generator (Hono)
 */
import { describe, expect, it } from 'vitest';
import { generateRoutes } from '../../src/generators/routes.js';
import { fullConfig, libraryConfig, minimalConfig, nestjsConfig } from '../fixtures/config.js';

describe('generateRoutes', () => {
    describe('framework check', () => {
        it('should generate routes when framework is hono', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("import { Hono } from 'hono'");
        });

        it('should not generate routes when framework is nestjs', () => {
            const result = generateRoutes(nestjsConfig);
            expect(result).toContain('Routes not generated - framework is not Hono');
        });

        it('should not generate routes when framework is none', () => {
            const result = generateRoutes(libraryConfig);
            expect(result).toContain('Routes not generated - framework is not Hono');
        });
    });

    describe('imports', () => {
        it('should import Hono and middleware', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("import { Hono } from 'hono'");
            expect(result).toContain("import { cors } from 'hono/cors'");
            expect(result).toContain("import { logger } from 'hono/logger'");
        });

        it('should import qzpay-hono helpers', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("import { createBillingRoutes, createWebhookRoutes } from '@qazuor/qzpay-hono'");
        });

        it('should import config', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("import { billing, stripeWebhookSecret } from './qzpay.config.js'");
        });

        it('should import service functions', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain('registerCustomer');
            expect(result).toContain('getCustomer');
            expect(result).toContain('subscribeToPlan');
            expect(result).toContain('changePlan');
            expect(result).toContain('cancelSubscription');
        });

        it('should import addon functions when addons is enabled', () => {
            const result = generateRoutes(fullConfig);
            expect(result).toContain('addAddOn');
            expect(result).toContain('removeAddOn');
        });

        it('should import usage functions when usageBased is enabled', () => {
            const result = generateRoutes(fullConfig);
            expect(result).toContain('trackUsage');
            expect(result).toContain('checkUsageLimit');
            expect(result).toContain('getUsageSummary');
        });
    });

    describe('middleware', () => {
        it('should apply logger middleware', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.use('*', logger())");
        });

        it('should apply cors middleware', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.use('*', cors())");
        });
    });

    describe('health check', () => {
        it('should include health check endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.get('/health'");
            expect(result).toContain("status: 'ok'");
        });
    });

    describe('billing routes', () => {
        it('should create billing routes with qzpay-hono', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain('createBillingRoutes');
            expect(result).toContain("prefix: '/billing'");
            expect(result).toContain('customers: true');
            expect(result).toContain('subscriptions: true');
            expect(result).toContain('payments: true');
            expect(result).toContain('invoices: true');
        });
    });

    describe('webhook routes', () => {
        it('should create webhook routes', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain('createWebhookRoutes');
            expect(result).toContain('stripeWebhookSecret');
        });
    });

    describe('custom routes', () => {
        it('should include customer registration endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.post('/api/customers/register'");
        });

        it('should include get customer endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.get('/api/customers/:id'");
        });

        it('should include subscribe endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.post('/api/customers/:id/subscribe'");
        });

        it('should include change plan endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.post('/api/customers/:id/change-plan'");
        });

        it('should include cancel endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.post('/api/customers/:id/cancel'");
        });

        it('should include payments endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.get('/api/customers/:id/payments'");
        });

        it('should include invoices endpoint', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain("app.get('/api/customers/:id/invoices'");
        });
    });

    describe('addon routes', () => {
        it('should include addon routes when addons is enabled', () => {
            const result = generateRoutes(fullConfig);
            expect(result).toContain("app.post('/api/customers/:id/addons'");
            expect(result).toContain("app.delete('/api/customers/:id/addons/:addOnKey'");
        });

        it('should not include addon routes when addons is disabled', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).not.toContain('/addons');
        });
    });

    describe('service routes', () => {
        it('should include service routes when oneTime is enabled', () => {
            const result = generateRoutes(fullConfig);
            expect(result).toContain("app.post('/api/customers/:id/services'");
        });

        it('should not include service routes when oneTime is disabled', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).not.toContain("'/api/customers/:id/services'");
        });
    });

    describe('usage routes', () => {
        it('should include usage routes when usageBased is enabled', () => {
            const result = generateRoutes(fullConfig);
            expect(result).toContain("app.post('/api/customers/:id/usage'");
            expect(result).toContain("app.get('/api/customers/:id/usage/:metric'");
            expect(result).toContain("app.get('/api/customers/:id/usage'");
        });

        it('should not include usage routes when usageBased is disabled', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).not.toContain('/usage');
        });
    });

    describe('server export', () => {
        it('should export server with port', () => {
            const result = generateRoutes(minimalConfig);
            expect(result).toContain('const port = Number(process.env.PORT) || 3000');
            expect(result).toContain('export default');
            expect(result).toContain('port');
            expect(result).toContain('fetch: app.fetch');
        });
    });
});
