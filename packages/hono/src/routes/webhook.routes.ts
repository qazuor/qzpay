/**
 * Webhook Routes
 *
 * Pre-configured webhook handler with event routing
 */
import { Hono } from 'hono';
import { createWebhookMiddleware, createWebhookResponse } from '../middleware/webhook.middleware.js';
import type { QZPayWebhookEnv, QZPayWebhookRouterConfig } from '../types.js';

/**
 * Default signature headers by provider
 */
const DEFAULT_SIGNATURE_HEADERS: Record<string, string> = {
    stripe: 'stripe-signature',
    mercadopago: 'x-signature'
};

/**
 * Create a webhook router for handling payment provider webhooks
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createWebhookRouter } from '@qazuor/qzpay-hono';
 *
 * const webhookRouter = createWebhookRouter({
 *   billing,
 *   paymentAdapter: stripeAdapter,
 *   handlers: {
 *     'customer.subscription.created': async (c, event) => {
 *       console.log('New subscription:', event.data);
 *     },
 *     'invoice.paid': async (c, event) => {
 *       console.log('Invoice paid:', event.data);
 *     }
 *   },
 *   onEvent: async (c, event) => {
 *     // Called for all events after specific handler
 *     await logEvent(event);
 *   }
 * });
 *
 * app.route('/webhooks/stripe', webhookRouter);
 * ```
 */
export function createWebhookRouter(config: QZPayWebhookRouterConfig): Hono<QZPayWebhookEnv> {
    const { billing, paymentAdapter, handlers = {}, onEvent, onError } = config;

    const signatureHeader = config.signatureHeader ?? DEFAULT_SIGNATURE_HEADERS[paymentAdapter.provider] ?? 'x-signature';

    const router = new Hono<QZPayWebhookEnv>();

    // Apply webhook middleware
    router.use(
        '*',
        createWebhookMiddleware({
            billing,
            paymentAdapter,
            signatureHeader
        })
    );

    // Handle POST requests
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Webhook routing requires multiple conditional paths
    router.post('/', async (c) => {
        const event = c.get('webhookEvent');
        const response = createWebhookResponse(c);

        try {
            // Call specific handler if exists
            const handler = handlers[event.type];
            if (handler) {
                const result = await handler(c, event);
                if (result) return result;
            }

            // Call generic handler if exists
            if (onEvent) {
                const result = await onEvent(c, event);
                if (result) return result;
            }

            return response.success();
        } catch (error) {
            if (onError) {
                const result = await onError(error instanceof Error ? error : new Error(String(error)), c);
                if (result) return result;
            }

            const message = error instanceof Error ? error.message : 'Webhook processing failed';
            return response.error(message, 500);
        }
    });

    return router;
}

/**
 * Simple webhook handler configuration
 */
export interface QZPaySimpleWebhookConfig {
    billing: QZPayWebhookRouterConfig['billing'];
    paymentAdapter: QZPayWebhookRouterConfig['paymentAdapter'];
    signatureHeader?: string;
    onEvent?: QZPayWebhookRouterConfig['onEvent'];
}

/**
 * Create a simple webhook handler endpoint
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createSimpleWebhookHandler } from '@qazuor/qzpay-hono';
 *
 * const app = new Hono();
 *
 * app.post('/webhooks/stripe', createSimpleWebhookHandler({
 *   billing,
 *   paymentAdapter: stripeAdapter,
 *   onEvent: async (c, event) => {
 *     // Process the event
 *     console.log('Received:', event.type);
 *   }
 * }));
 * ```
 */
export function createSimpleWebhookHandler(config: QZPaySimpleWebhookConfig): Hono<QZPayWebhookEnv> {
    const { billing, paymentAdapter, signatureHeader, onEvent } = config;

    return createWebhookRouter({
        billing,
        paymentAdapter,
        signatureHeader,
        onEvent
    });
}
