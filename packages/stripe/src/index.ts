/**
 * @qazuor/qzpay-stripe
 *
 * Stripe payment provider adapter for QZPay billing library.
 * Provides full Stripe integration for payments, subscriptions, and marketplace.
 */

// Main adapter
export { QZPayStripeAdapter, createQZPayStripeAdapter } from './stripe.adapter.js';

// Sub-adapters for direct access
export {
    QZPayStripeCustomerAdapter,
    QZPayStripeSubscriptionAdapter,
    QZPayStripePaymentAdapter,
    QZPayStripeCheckoutAdapter,
    QZPayStripePriceAdapter,
    QZPayStripeWebhookAdapter,
    QZPayStripeVendorAdapter,
    mapStripeEventToQZPayEvent,
    extractStripeEventData
} from './adapters/index.js';

// Types
export type { QZPayStripeConfig, QZPayStripeConnectConfig, QZPayStripeWebhookEventType, QZPayStripeWebhookData } from './types.js';

// Re-export Stripe types that consumers might need
export type { Stripe } from 'stripe';
