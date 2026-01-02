/**
 * Stripe adapter configuration types
 */
import type Stripe from 'stripe';

/**
 * Configuration options for the Stripe adapter
 */
export interface QZPayStripeConfig {
    /**
     * Stripe secret key (sk_live_* or sk_test_*)
     */
    secretKey: string;

    /**
     * Webhook signing secret (whsec_*)
     */
    webhookSecret: string;

    /**
     * Stripe API version to use
     */
    apiVersion?: Stripe.LatestApiVersion;

    /**
     * Additional Stripe client options
     */
    stripeOptions?: Stripe.StripeConfig;
}

/**
 * Stripe Connect configuration for marketplace
 */
export interface QZPayStripeConnectConfig {
    /**
     * Platform account ID
     */
    platformAccountId?: string;

    /**
     * Default application fee percentage (0-100)
     */
    applicationFeePercent?: number;

    /**
     * Minimum payout amount in cents
     */
    minPayoutAmount?: number;

    /**
     * Default payout schedule
     */
    payoutSchedule?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Stripe webhook event types mapped to QZPay events
 */
export type QZPayStripeWebhookEventType =
    | 'customer.created'
    | 'customer.updated'
    | 'customer.deleted'
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
    | 'customer.subscription.trial_will_end'
    | 'invoice.created'
    | 'invoice.finalized'
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | 'invoice.payment_action_required'
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'payment_intent.canceled'
    | 'charge.refunded'
    | 'checkout.session.completed'
    | 'checkout.session.expired'
    | 'account.updated'
    | 'payout.paid'
    | 'payout.failed';

/**
 * Mapped webhook event data
 */
export interface QZPayStripeWebhookData {
    eventType: QZPayStripeWebhookEventType;
    stripeEventId: string;
    stripeObjectId: string;
    data: Record<string, unknown>;
    createdAt: Date;
}
