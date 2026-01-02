import type { QZPayBilling, QZPayPaymentAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
/**
 * Hono middleware types for QZPay
 */
import type { Context, Env, MiddlewareHandler } from 'hono';

/**
 * QZPay variables added to Hono context
 */
export interface QZPayHonoVariables {
    /**
     * QZPay billing instance
     */
    qzpay: QZPayBilling;
}

/**
 * Hono environment with QZPay variables
 */
export interface QZPayHonoEnv extends Env {
    Variables: QZPayHonoVariables;
}

/**
 * Configuration for QZPay middleware
 */
export interface QZPayMiddlewareConfig {
    /**
     * QZPay billing instance to attach to context
     */
    billing: QZPayBilling;
}

/**
 * Webhook variables added to Hono context
 */
export interface QZPayWebhookVariables extends QZPayHonoVariables {
    /**
     * Parsed webhook event
     */
    webhookEvent: QZPayWebhookEvent;

    /**
     * Raw webhook payload
     */
    webhookPayload: string;

    /**
     * Webhook signature header
     */
    webhookSignature: string;
}

/**
 * Hono environment with webhook variables
 */
export interface QZPayWebhookEnv extends Env {
    Variables: QZPayWebhookVariables;
}

/**
 * Configuration for webhook middleware
 */
export interface QZPayWebhookMiddlewareConfig {
    /**
     * QZPay billing instance
     */
    billing: QZPayBilling;

    /**
     * Payment adapter with webhook support
     */
    paymentAdapter: QZPayPaymentAdapter;

    /**
     * Header name for webhook signature (default: 'stripe-signature')
     */
    signatureHeader?: string;

    /**
     * Whether to verify the webhook signature (default: true)
     */
    verifySignature?: boolean;
}

/**
 * Webhook handler function type
 */
export type QZPayWebhookHandler<E extends Env = QZPayWebhookEnv> = (
    c: Context<E>,
    event: QZPayWebhookEvent
) => Promise<Response | undefined>;

/**
 * Map of event types to handlers
 */
export type QZPayWebhookHandlerMap = {
    [eventType: string]: QZPayWebhookHandler;
};

/**
 * Configuration for webhook router
 */
export interface QZPayWebhookRouterConfig {
    /**
     * QZPay billing instance
     */
    billing: QZPayBilling;

    /**
     * Payment adapter with webhook support
     */
    paymentAdapter: QZPayPaymentAdapter;

    /**
     * Header name for webhook signature (default: 'stripe-signature')
     */
    signatureHeader?: string | undefined;

    /**
     * Custom handlers for specific event types
     */
    handlers?: QZPayWebhookHandlerMap | undefined;

    /**
     * Handler for all events (called after specific handler)
     */
    onEvent?: QZPayWebhookHandler | undefined;

    /**
     * Handler for errors during webhook processing
     */
    onError?: ((error: Error, c: Context) => Promise<Response | undefined>) | undefined;
}

/**
 * Response helpers for webhook handlers
 */
export interface QZPayWebhookResponse {
    /**
     * Acknowledge the webhook was received successfully
     */
    success: () => Response;

    /**
     * Return an error response
     */
    error: (message: string, status?: number) => Response;

    /**
     * Skip processing (return 200 without handling)
     */
    skip: () => Response;
}

/**
 * Billing routes configuration
 */
export interface QZPayBillingRoutesConfig {
    /**
     * QZPay billing instance
     */
    billing: QZPayBilling;

    /**
     * Route prefix (default: '/billing')
     */
    prefix?: string;

    /**
     * Enable customer routes (default: true)
     */
    customers?: boolean;

    /**
     * Enable subscription routes (default: true)
     */
    subscriptions?: boolean;

    /**
     * Enable payment routes (default: true)
     */
    payments?: boolean;

    /**
     * Enable invoice routes (default: true)
     */
    invoices?: boolean;

    /**
     * Enable plan routes (default: true)
     */
    plans?: boolean;

    /**
     * Enable promo code routes (default: true)
     */
    promoCodes?: boolean;

    /**
     * Enable entitlement routes (default: true)
     */
    entitlements?: boolean;

    /**
     * Enable limit routes (default: true)
     */
    limits?: boolean;

    /**
     * Authentication middleware to protect routes
     */
    authMiddleware?: MiddlewareHandler;
}

/**
 * API response format
 */
export interface QZPayApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Pagination parameters
 */
export interface QZPayApiPaginationParams {
    limit?: number;
    offset?: number;
    cursor?: string;
}

/**
 * List response with pagination
 */
export interface QZPayApiListResponse<T> extends QZPayApiResponse<T[]> {
    pagination?: {
        total?: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}
