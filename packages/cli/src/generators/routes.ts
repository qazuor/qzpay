/**
 * Routes Generator (Hono)
 *
 * Generates the `routes.ts` file with Hono web framework routes
 * for billing APIs, webhooks, and custom endpoints.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase } from '../utils/template.js';

/**
 * Generate `routes.ts` file content for Hono framework.
 *
 * Creates a complete Hono application with:
 * - Middleware setup (cors, logger)
 * - Health check endpoint
 * - QZPay auto-generated billing routes
 * - Webhook routes for payment providers
 * - Custom routes for project-specific logic
 * - Feature-specific routes (add-ons, services, usage)
 * - Server startup configuration
 *
 * Only generates content if framework is 'hono'.
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for Hono routes, or placeholder if not Hono
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: true },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateRoutes(config);
 * // Returns Hono app with billing + add-on routes
 * ```
 */
export function generateRoutes(config: InitConfig): string {
    if (config.framework.type !== 'hono') {
        return '// Routes not generated - framework is not Hono\n';
    }

    const pascal = toPascalCase(config.project.name);

    let content = `/**
 * ${pascal} - API Routes (Hono)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createBillingRoutes, createWebhookRoutes } from '@qazuor/qzpay-hono';
import { billing, stripeWebhookSecret } from './qzpay.config.js';
import {
    registerCustomer,
    getCustomer,
    subscribeToPlan,
    changePlan,
    cancelSubscription,
    getPaymentHistory,
    getInvoices`;

    if (config.features.addons) {
        content += `,
    addAddOn,
    removeAddOn`;
    }

    if (config.features.oneTime) {
        content += `,
    purchaseService`;
    }

    if (config.features.usageBased) {
        content += `,
    trackUsage,
    checkUsageLimit,
    getUsageSummary`;
    }

    content += `
} from './services.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: '${config.project.name}' }));

// ============================================================================
// QZPay Billing Routes (auto-generated CRUD)
// ============================================================================

const billingRoutes = createBillingRoutes({
    billing,
    prefix: '/billing',
    enable: {
        customers: true,
        subscriptions: true,
        payments: true,
        invoices: true
    }
});

app.route('/api', billingRoutes);

// ============================================================================
// Webhook Routes
// ============================================================================

const webhookRoutes = createWebhookRoutes({
    billing,
    stripeWebhookSecret
});

app.route('/webhooks', webhookRoutes);

// ============================================================================
// Custom ${pascal} Routes
// ============================================================================

// Register new customer
app.post('/api/customers/register', async (c) => {
    try {
        const body = await c.req.json();
        const customer = await registerCustomer({
            email: body.email,
            name: body.name,
            planTier: body.planTier
        });
        return c.json(customer, 201);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Get customer details
app.get('/api/customers/:id', async (c) => {
    try {
        const customer = await getCustomer(c.req.param('id'));
        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }
        return c.json(customer);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Subscribe to plan
app.post('/api/customers/:id/subscribe', async (c) => {
    try {
        const body = await c.req.json();
        const result = await subscribeToPlan(
            c.req.param('id'),
            body.planTier,
            body.interval || 'monthly'
        );
        return c.json(result);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Change plan
app.post('/api/customers/:id/change-plan', async (c) => {
    try {
        const body = await c.req.json();
        await changePlan(
            c.req.param('id'),
            body.planTier,
            body.interval || 'monthly'
        );
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Cancel subscription
app.post('/api/customers/:id/cancel', async (c) => {
    try {
        const body = await c.req.json();
        await cancelSubscription(c.req.param('id'), body.immediately);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Get payment history
app.get('/api/customers/:id/payments', async (c) => {
    try {
        const payments = await getPaymentHistory(c.req.param('id'));
        return c.json(payments);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Get invoices
app.get('/api/customers/:id/invoices', async (c) => {
    try {
        const invoices = await getInvoices(c.req.param('id'));
        return c.json(invoices);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});
`;

    if (config.features.addons) {
        content += `
// ============================================================================
// Add-on Routes
// ============================================================================

// Add add-on
app.post('/api/customers/:id/addons', async (c) => {
    try {
        const body = await c.req.json();
        await addAddOn(c.req.param('id'), body.addOnKey);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Remove add-on
app.delete('/api/customers/:id/addons/:addOnKey', async (c) => {
    try {
        await removeAddOn(c.req.param('id'), c.req.param('addOnKey'));
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});
`;
    }

    if (config.features.oneTime) {
        content += `
// ============================================================================
// One-time Purchase Routes
// ============================================================================

// Purchase service
app.post('/api/customers/:id/services', async (c) => {
    try {
        const body = await c.req.json();
        const result = await purchaseService(c.req.param('id'), body.serviceKey);
        return c.json(result);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});
`;
    }

    if (config.features.usageBased) {
        content += `
// ============================================================================
// Usage Tracking Routes
// ============================================================================

// Track usage
app.post('/api/customers/:id/usage', async (c) => {
    try {
        const body = await c.req.json();
        await trackUsage(c.req.param('id'), body.metric, body.quantity);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Check usage limit
app.get('/api/customers/:id/usage/:metric', async (c) => {
    try {
        const result = await checkUsageLimit(c.req.param('id'), c.req.param('metric'));
        return c.json(result);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Get usage summary
app.get('/api/customers/:id/usage', async (c) => {
    try {
        const summary = await getUsageSummary(c.req.param('id'));
        return c.json(summary);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});
`;
    }

    content += `
// ============================================================================
// Server Start
// ============================================================================

const port = Number(process.env.PORT) || 3000;

console.log(\`${pascal} API running on http://localhost:\${port}\`);

export default {
    port,
    fetch: app.fetch
};
`;

    return content;
}
