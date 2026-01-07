/**
 * Hospeda - API Routes (Hono)
 */
import { createBillingRoutes, createRateLimitMiddleware, createWebhookRoutes } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import billing, { stripeWebhookSecret } from './config.js';
import {
    cancelAddOn,
    cancelPlan,
    changePlan,
    getBillingHistory,
    getOwner,
    getPlanLimits,
    listCustomerAddOns,
    purchaseService,
    registerOwner,
    subscribeToAddOn
} from './services.js';
import type { HospedaAddOn, HospedaPlanTier, HospedaService } from './types.js';

const app = new Hono();

// ==================== Middleware ====================

app.use('*', logger());
app.use('*', cors());

// Rate limiting
app.use(
    '/api/*',
    createRateLimitMiddleware({
        windowMs: 60 * 1000,
        limit: 100,
        keyGenerator: (c) => c.req.header('authorization') || c.req.header('x-forwarded-for') || 'anonymous'
    })
);

// JWT auth for protected routes (except webhooks)
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
app.use('/api/*', jwt({ secret: jwtSecret }));

// ==================== Health Check ====================

app.get('/health', (c) => c.json({ status: 'ok', service: 'hospeda-billing' }));

// ==================== Owner Registration ====================

app.post('/api/owners/register', async (c) => {
    try {
        const body = await c.req.json<{
            email: string;
            name: string;
            planTier?: HospedaPlanTier;
            billingCycle?: 'monthly' | 'yearly';
        }>();

        const result = await registerOwner(body);

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
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Registration failed'
            },
            400
        );
    }
});

// ==================== Owner Profile ====================

app.get('/api/owners/:id', async (c) => {
    try {
        const owner = await getOwner(c.req.param('id'));

        if (!owner) {
            return c.json({ success: false, error: 'Owner not found' }, 404);
        }

        return c.json({ success: true, data: owner });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get owner'
            },
            500
        );
    }
});

app.get('/api/owners/:id/limits', async (c) => {
    try {
        const limits = await getPlanLimits(c.req.param('id'));
        return c.json({ success: true, data: limits });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get limits'
            },
            500
        );
    }
});

// ==================== Plan Management ====================

app.post('/api/owners/:id/plan', async (c) => {
    try {
        const body = await c.req.json<{
            tier: HospedaPlanTier;
            billingCycle?: 'monthly' | 'yearly';
        }>();

        const subscription = await changePlan(c.req.param('id'), body.tier, body.billingCycle);

        return c.json({
            success: true,
            data: {
                subscriptionId: subscription.id,
                status: subscription.status,
                tier: body.tier
            }
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to change plan'
            },
            400
        );
    }
});

app.delete('/api/owners/:id/plan', async (c) => {
    try {
        const cancelAtPeriodEnd = c.req.query('immediate') !== 'true';
        await cancelPlan(c.req.param('id'), cancelAtPeriodEnd);

        return c.json({
            success: true,
            message: cancelAtPeriodEnd ? 'Plan will be canceled at end of period' : 'Plan canceled immediately'
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel plan'
            },
            400
        );
    }
});

// ==================== Add-ons ====================

app.get('/api/owners/:id/addons', async (c) => {
    try {
        const addOns = await listCustomerAddOns(c.req.param('id'));
        return c.json({ success: true, data: addOns });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list add-ons'
            },
            500
        );
    }
});

app.post('/api/owners/:id/addons', async (c) => {
    try {
        const body = await c.req.json<{ addOn: HospedaAddOn }>();
        const subscription = await subscribeToAddOn(c.req.param('id'), body.addOn);

        return c.json(
            {
                success: true,
                data: {
                    subscriptionId: subscription.id,
                    addOn: body.addOn
                }
            },
            201
        );
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to subscribe to add-on'
            },
            400
        );
    }
});

app.delete('/api/owners/:id/addons/:addOn', async (c) => {
    try {
        await cancelAddOn(c.req.param('id'), c.req.param('addOn') as HospedaAddOn);
        return c.json({ success: true, message: 'Add-on canceled' });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel add-on'
            },
            400
        );
    }
});

// ==================== One-time Services ====================

app.post('/api/owners/:id/services', async (c) => {
    try {
        const body = await c.req.json<{
            service: HospedaService;
            propertyId?: string;
        }>();

        const result = await purchaseService(c.req.param('id'), body.service, body.propertyId);

        return c.json({ success: true, data: result }, 201);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to purchase service'
            },
            400
        );
    }
});

// ==================== Billing History ====================

app.get('/api/owners/:id/billing', async (c) => {
    try {
        const history = await getBillingHistory(c.req.param('id'));
        return c.json({ success: true, data: history });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get billing history'
            },
            500
        );
    }
});

// ==================== Mount QZPay Routes ====================

// Standard billing routes (for admin/internal use)
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

// ==================== Export ====================

export default app;

// For Bun/Node
export const port = Number(process.env.PORT) || 3000;
