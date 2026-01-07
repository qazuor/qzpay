/**
 * @qazuor/qzpay-hono
 *
 * Hono middleware and handlers for QZPay billing library
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createQZPayBilling } from '@qazuor/qzpay-core';
 * import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
 * import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
 * import {
 *   createQZPayMiddleware,
 *   createWebhookRouter,
 *   createBillingRoutes
 * } from '@qazuor/qzpay-hono';
 *
 * // Initialize adapters
 * const storage = createQZPayDrizzleAdapter({ db });
 * const stripeAdapter = createQZPayStripeAdapter({
 *   secretKey: process.env.STRIPE_SECRET_KEY!,
 *   webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
 * });
 *
 * // Create billing instance
 * const billing = createQZPayBilling({
 *   storage,
 *   paymentAdapter: stripeAdapter
 * });
 *
 * // Create Hono app
 * const app = new Hono();
 *
 * // Add QZPay middleware for all routes
 * app.use('*', createQZPayMiddleware({ billing }));
 *
 * // Add webhook handler
 * const webhookRouter = createWebhookRouter({
 *   billing,
 *   paymentAdapter: stripeAdapter,
 *   handlers: {
 *     'customer.subscription.created': async (c, event) => {
 *       console.log('New subscription:', event.data);
 *     }
 *   }
 * });
 * app.route('/webhooks/stripe', webhookRouter);
 *
 * // Add billing API routes
 * const billingRoutes = createBillingRoutes({
 *   billing,
 *   prefix: '/api/billing'
 * });
 * app.route('/', billingRoutes);
 *
 * export default app;
 * ```
 */

// Types
export type {
    QZPayHonoEnv,
    QZPayHonoVariables,
    QZPayMiddlewareConfig,
    QZPayWebhookEnv,
    QZPayWebhookVariables,
    QZPayWebhookMiddlewareConfig,
    QZPayWebhookHandler,
    QZPayWebhookHandlerMap,
    QZPayWebhookRouterConfig,
    QZPayWebhookResponse,
    QZPayBillingRoutesConfig,
    QZPayApiResponse,
    QZPayApiPaginationParams,
    QZPayApiListResponse
} from './types.js';

// Middleware
export { createQZPayMiddleware, getQZPay } from './middleware/index.js';
export { createWebhookMiddleware, createWebhookResponse, getWebhookEvent } from './middleware/index.js';

// Routes
export { createWebhookRouter, createSimpleWebhookHandler, createBillingRoutes } from './routes/index.js';

// Rate limiting
export {
    // Middleware factories
    createRateLimitMiddleware,
    createApiKeyRateLimiter,
    createCustomerRateLimiter,
    createStrictRateLimiter,
    // Store implementation
    QZPayMemoryRateLimitStore,
    // Key generators
    rateLimitKeyByIP,
    rateLimitKeyByApiKey,
    rateLimitKeyByCustomerId
} from './middleware/index.js';

// Rate limiting types
export type {
    QZPayRateLimitStore,
    QZPayRateLimitEntry,
    QZPayRateLimitInfo,
    QZPayRateLimitConfig
} from './middleware/index.js';

// Validators (for extension by users)
export * from './validators/index.js';
