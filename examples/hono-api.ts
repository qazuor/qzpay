/**
 * Hono API Server Example
 *
 * This example shows how to set up a billing API
 * using Hono middleware and routes.
 */
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { createBillingRoutes, createRateLimitMiddleware, createWebhookRoutes } from '@qazuor/qzpay-hono';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import postgres from 'postgres';

// Initialize database
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Initialize adapters
const storageAdapter = createQZPayDrizzleAdapter({ db });
const stripeAdapter = createQZPayStripeAdapter({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

// Initialize billing
const billing = createQZPayBilling({
    storage: storageAdapter,
    paymentAdapter: stripeAdapter,
    livemode: true,
});

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());

// Rate limiting
app.use(
    '/api/*',
    createRateLimitMiddleware({
        windowMs: 60 * 1000, // 1 minute
        limit: 100,
        keyGenerator: (c) => c.req.header('x-api-key') || 'anonymous'
    })
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount billing routes
const billingRoutes = createBillingRoutes({
    billing,
    prefix: '/billing',
    customers: true,
    subscriptions: true,
    payments: true,
    invoices: true,
    plans: true
});
app.route('/api', billingRoutes);

// Mount webhook routes
const webhookRoutes = createWebhookRoutes({
    billing,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
});
app.route('/webhooks', webhookRoutes);

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`Server running on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch
};
