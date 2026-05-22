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
 * Default request-id header names by provider. `null` means the provider
 * does not use a separate request-id header (e.g. Stripe embeds everything
 * in `stripe-signature`).
 */
const DEFAULT_REQUEST_ID_HEADERS: Record<string, string | null> = {
    stripe: null,
    mercadopago: 'x-request-id'
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
    const { billing, paymentAdapter, verifySignature = true, logger } = config;

    // Determine signature header
    const signatureHeader = config.signatureHeader ?? DEFAULT_SIGNATURE_HEADERS[paymentAdapter.provider] ?? 'x-signature';

    // Determine request-id header. `null` (either explicit or from the provider
    // defaults) means the adapter does not need a separate request-id.
    const requestIdHeader =
        config.requestIdHeader === undefined ? (DEFAULT_REQUEST_ID_HEADERS[paymentAdapter.provider] ?? null) : config.requestIdHeader;

    return async (c, next) => {
        // Get raw body
        const payload = await c.req.text();

        // Get signature + request-id headers
        const signature = c.req.header(signatureHeader) ?? '';
        const requestId = requestIdHeader ? (c.req.header(requestIdHeader) ?? '') : undefined;

        // Verify signature if enabled
        if (verifySignature && paymentAdapter.webhooks) {
            const isValid = paymentAdapter.webhooks.verifySignature(payload, signature, requestId);
            if (!isValid) {
                logger?.warn('Webhook signature verification failed', {
                    provider: paymentAdapter.provider,
                    operation: 'webhookMiddleware',
                    hasSignature: signature.length > 0,
                    hasRequestId: Boolean(requestId)
                });
                return c.json({ error: 'Invalid webhook signature' }, 401);
            }
            logger?.debug('Webhook signature verified', {
                provider: paymentAdapter.provider,
                operation: 'webhookMiddleware',
                payloadBytes: payload.length
            });
        }

        // Parse webhook event
        if (!paymentAdapter.webhooks) {
            logger?.error('Webhook middleware invoked but adapter has no webhooks support', {
                provider: paymentAdapter.provider,
                operation: 'webhookMiddleware'
            });
            return c.json({ error: 'Payment adapter does not support webhooks' }, 500);
        }

        try {
            const event = paymentAdapter.webhooks.constructEvent(payload, signature, requestId);

            logger?.debug('Webhook event constructed', {
                provider: paymentAdapter.provider,
                operation: 'webhookMiddleware',
                eventId: event.id,
                eventType: event.type
            });

            // Set variables on context
            c.set('qzpay', billing);
            c.set('webhookEvent', event);
            c.set('webhookPayload', payload);
            c.set('webhookSignature', signature);

            await next();
            return;
        } catch (error) {
            logger?.error('Webhook event construction threw', {
                provider: paymentAdapter.provider,
                operation: 'webhookMiddleware',
                error
            });
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
