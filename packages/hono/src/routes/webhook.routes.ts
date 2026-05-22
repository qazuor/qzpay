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
    const { billing, paymentAdapter, handlers = {}, onEvent, onError, logger } = config;

    const signatureHeader = config.signatureHeader ?? DEFAULT_SIGNATURE_HEADERS[paymentAdapter.provider] ?? 'x-signature';

    const router = new Hono<QZPayWebhookEnv>();

    logger?.debug('Webhook router constructed', {
        provider: paymentAdapter.provider,
        operation: 'createWebhookRouter',
        signatureHeader,
        handlerCount: Object.keys(handlers).length,
        hasOnEvent: Boolean(onEvent),
        hasOnError: Boolean(onError)
    });

    // Apply webhook middleware
    router.use(
        '*',
        createWebhookMiddleware({
            billing,
            paymentAdapter,
            signatureHeader,
            ...(config.requestIdHeader !== undefined ? { requestIdHeader: config.requestIdHeader } : {}),
            ...(logger ? { logger } : {})
        })
    );

    // Handle POST requests
    router.post('/', async (c) => {
        const event = c.get('webhookEvent');
        const response = createWebhookResponse(c);

        logger?.debug('Webhook event dispatch starting', {
            provider: paymentAdapter.provider,
            operation: 'webhookDispatch',
            eventId: event.id,
            eventType: event.type
        });

        try {
            // Call generic handler FIRST. Consumers typically use `onEvent`
            // for cross-cutting concerns that must run BEFORE any type-
            // specific dispatch — idempotency tracking, event persistence,
            // audit logging. If the generic handler returns a Response
            // (e.g. "this event is a duplicate, short-circuit") the
            // type-specific handler is skipped, which is the correct
            // semantics for those use cases. Type-specific handlers run
            // after and can rely on the cross-cutting work having
            // completed.
            if (onEvent) {
                const result = await onEvent(c, event);
                if (result) {
                    logger?.debug('Webhook onEvent short-circuited dispatch', {
                        provider: paymentAdapter.provider,
                        operation: 'webhookDispatch',
                        eventId: event.id,
                        eventType: event.type
                    });
                    return result;
                }
            }

            // Call specific handler if exists
            const handler = handlers[event.type];
            if (handler) {
                logger?.debug('Webhook handler invoking', {
                    provider: paymentAdapter.provider,
                    operation: 'webhookDispatch',
                    eventId: event.id,
                    eventType: event.type
                });
                const result = await handler(c, event);
                if (result) return result;
            } else {
                logger?.info('Webhook event has no registered handler', {
                    provider: paymentAdapter.provider,
                    operation: 'webhookDispatch',
                    eventId: event.id,
                    eventType: event.type
                });
            }

            return response.success();
        } catch (error) {
            logger?.error('Webhook handler threw', {
                provider: paymentAdapter.provider,
                operation: 'webhookDispatch',
                eventId: event.id,
                eventType: event.type,
                error
            });

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
    requestIdHeader?: QZPayWebhookRouterConfig['requestIdHeader'];
    onEvent?: QZPayWebhookRouterConfig['onEvent'];
    logger?: QZPayWebhookRouterConfig['logger'];
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
    const { billing, paymentAdapter, signatureHeader, onEvent, logger } = config;

    return createWebhookRouter({
        billing,
        paymentAdapter,
        signatureHeader,
        ...(config.requestIdHeader !== undefined ? { requestIdHeader: config.requestIdHeader } : {}),
        onEvent,
        ...(logger ? { logger } : {})
    });
}
