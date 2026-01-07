/**
 * Asistia - API Routes (Hono)
 */
import { createBillingRoutes, createRateLimitMiddleware, createWebhookRoutes } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import billing, { stripeWebhookSecret } from './config.js';
import {
    cancelAddOn,
    cancelSubscription,
    changePlan,
    getBillingHistory,
    getOrganization,
    getPlanLimits,
    purchaseService,
    registerOrganization,
    subscribeToAddOn
} from './services.js';
import type { AsistiaAddOn, AsistiaPlanTier, AsistiaService } from './types.js';
import { canUse, getUsageSummary, recordMessageUsage, recordTokenUsage } from './usage.js';

const app = new Hono();

// ==================== Middleware ====================

app.use('*', logger());
app.use('*', cors());

// Rate limiting - stricter for usage endpoints
app.use(
    '/api/*',
    createRateLimitMiddleware({
        windowMs: 60 * 1000,
        limit: 200,
        keyGenerator: (c) => c.req.header('authorization') || 'anonymous'
    })
);

// JWT auth
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
app.use('/api/*', jwt({ secret: jwtSecret }));

// ==================== Health ====================

app.get('/health', (c) => c.json({ status: 'ok', service: 'asistia-billing' }));

// ==================== Organization Registration ====================

app.post('/api/organizations/register', async (c) => {
    try {
        const body = await c.req.json<{
            email: string;
            name: string;
            organizationName: string;
            planTier?: AsistiaPlanTier;
            billingCycle?: 'monthly' | 'yearly';
        }>();

        const result = await registerOrganization(body);

        return c.json(
            {
                success: true,
                data: {
                    customerId: result.customer.id,
                    subscriptionId: result.subscription?.id
                }
            },
            201
        );
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Organization Profile ====================

app.get('/api/organizations/:id', async (c) => {
    try {
        const org = await getOrganization(c.req.param('id'));
        if (!org) {
            return c.json({ success: false, error: 'Not found' }, 404);
        }
        return c.json({ success: true, data: org });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
    }
});

app.get('/api/organizations/:id/limits', async (c) => {
    try {
        const limits = await getPlanLimits(c.req.param('id'));
        return c.json({ success: true, data: limits });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
    }
});

// ==================== Usage ====================

app.get('/api/organizations/:id/usage', async (c) => {
    try {
        const usage = await getUsageSummary(c.req.param('id'));
        return c.json({ success: true, data: usage });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
    }
});

// Check if action is allowed
app.post('/api/organizations/:id/usage/check', async (c) => {
    try {
        const body = await c.req.json<{ metric: 'messages' | 'tokens'; amount?: number }>();
        const result = await canUse(c.req.param('id'), body.metric, body.amount);
        return c.json({ success: true, data: result });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
    }
});

// Record usage (internal API, called by your bot service)
app.post('/api/organizations/:id/usage/record', async (c) => {
    try {
        const body = await c.req.json<{
            metric: 'messages' | 'tokens';
            amount: number;
        }>();

        const customerId = c.req.param('id');

        if (body.metric === 'messages') {
            await recordMessageUsage(customerId, body.amount);
        } else if (body.metric === 'tokens') {
            await recordTokenUsage(customerId, body.amount);
        }

        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Plan Management ====================

app.post('/api/organizations/:id/plan', async (c) => {
    try {
        const body = await c.req.json<{
            tier: AsistiaPlanTier;
            billingCycle?: 'monthly' | 'yearly';
        }>();

        const subscription = await changePlan(c.req.param('id'), body.tier, body.billingCycle);

        return c.json({
            success: true,
            data: { subscriptionId: subscription.id, tier: body.tier }
        });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

app.delete('/api/organizations/:id/plan', async (c) => {
    try {
        const cancelAtPeriodEnd = c.req.query('immediate') !== 'true';
        await cancelSubscription(c.req.param('id'), cancelAtPeriodEnd);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Add-ons ====================

app.post('/api/organizations/:id/addons', async (c) => {
    try {
        const body = await c.req.json<{ addOn: AsistiaAddOn }>();
        const subscription = await subscribeToAddOn(c.req.param('id'), body.addOn);
        return c.json({ success: true, data: { subscriptionId: subscription.id } }, 201);
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

app.delete('/api/organizations/:id/addons/:addOn', async (c) => {
    try {
        await cancelAddOn(c.req.param('id'), c.req.param('addOn') as AsistiaAddOn);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Services ====================

app.post('/api/organizations/:id/services', async (c) => {
    try {
        const body = await c.req.json<{ service: AsistiaService }>();
        const result = await purchaseService(c.req.param('id'), body.service);
        return c.json({ success: true, data: result }, 201);
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Billing History ====================

app.get('/api/organizations/:id/billing', async (c) => {
    try {
        const history = await getBillingHistory(c.req.param('id'));
        return c.json({ success: true, data: history });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
    }
});

// ==================== Admin Routes ====================

const billingRoutes = createBillingRoutes({
    billing,
    prefix: '/billing',
    customers: true,
    subscriptions: true,
    payments: true,
    invoices: true,
    plans: true
});
app.route('/api/admin', billingRoutes);

// ==================== Webhooks ====================

const webhookRoutes = createWebhookRoutes({
    billing,
    stripeWebhookSecret
});
app.route('/webhooks', webhookRoutes);

export default app;
export const port = Number(process.env.PORT) || 3001;
