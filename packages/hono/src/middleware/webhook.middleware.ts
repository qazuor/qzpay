/**
 * Webhook Middleware
 *
 * Handles webhook verification and parsing for payment providers
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { QZPayWebhookEnv, QZPayWebhookMiddlewareConfig, QZPayWebhookResponse } from '../types.js';

/**
 * Default signature header names by provider
 */
const DEFAULT_SIGNATURE_HEADERS: Record<string, string> = {
    stripe: 'stripe-signature',
    mercadopago: 'x-signature'
};

/**
 * Create webhook middleware that verifies and parses webhook events
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createWebhookMiddleware } from '@qazuor/qzpay-hono';
 *
 * const app = new Hono();
 *
 * app.post('/webhooks/stripe',
 *   createWebhookMiddleware({
 *     billing,
 *     paymentAdapter: stripeAdapter,
 *     signatureHeader: 'stripe-signature'
 *   }),
 *   async (c) => {
 *     const event = c.get('webhookEvent');
 *     console.log('Received webhook:', event.type);
 *     return c.json({ received: true });
 *   }
 * );
 * ```
 */
export function createWebhookMiddleware(config: QZPayWebhookMiddlewareConfig): MiddlewareHandler<QZPayWebhookEnv> {
    const { billing, paymentAdapter, verifySignature = true } = config;

    // Determine signature header
    const signatureHeader = config.signatureHeader ?? DEFAULT_SIGNATURE_HEADERS[paymentAdapter.provider] ?? 'x-signature';

    return async (c, next) => {
        // Get raw body
        const payload = await c.req.text();

        // Get signature header
        const signature = c.req.header(signatureHeader) ?? '';

        // Verify signature if enabled
        if (verifySignature && paymentAdapter.webhooks) {
            const isValid = paymentAdapter.webhooks.verifySignature(payload, signature);
            if (!isValid) {
                return c.json({ error: 'Invalid webhook signature' }, 401);
            }
        }

        // Parse webhook event
        if (!paymentAdapter.webhooks) {
            return c.json({ error: 'Payment adapter does not support webhooks' }, 500);
        }

        try {
            const event = paymentAdapter.webhooks.constructEvent(payload, signature);

            // Set variables on context
            c.set('qzpay', billing);
            c.set('webhookEvent', event);
            c.set('webhookPayload', payload);
            c.set('webhookSignature', signature);

            await next();
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to parse webhook event';
            return c.json({ error: message }, 400);
        }
    };
}

/**
 * Create webhook response helpers
 */
export function createWebhookResponse(c: Context): QZPayWebhookResponse {
    return {
        success: () => c.json({ received: true }, 200),
        error: (message: string, status = 400) => {
            // Cast status to valid content status code
            const validStatus = (status >= 400 && status < 600 ? status : 400) as 400 | 401 | 403 | 404 | 500;
            return c.json({ error: message }, validStatus);
        },
        skip: () => c.json({ skipped: true }, 200)
    };
}

/**
 * Get webhook event from context
 * Utility function for type-safe access
 */
export function getWebhookEvent<E extends QZPayWebhookEnv>(c: { get: (key: 'webhookEvent') => E['Variables']['webhookEvent'] }) {
    return c.get('webhookEvent');
}
