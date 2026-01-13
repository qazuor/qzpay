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
    QZPayStripeSetupIntentAdapter,
    // Webhook utilities
    mapStripeEventToQZPayEvent,
    extractStripeEventData,
    // 3DS utilities
    isPaymentRequires3DS,
    extract3DSDetails,
    // Dispute utilities
    isDisputeEvent,
    extractDisputeDetails,
    // Pending update utilities
    isPendingUpdateEvent,
    extractPendingUpdateDetails,
    // Fraud warning utilities
    isFraudWarningEvent,
    extractFraudWarningDetails,
    // Event classification
    classifyStripeEvent,
    requiresImmediateAction
} from './adapters/index.js';

// Webhook types
export type {
    QZPayStripe3DSStatus,
    QZPayStripe3DSResult,
    QZPayStripeDisputeStatus,
    QZPayStripeDisputeReason,
    QZPayStripeDisputeDetails,
    QZPayStripePendingUpdate,
    QZPayStripeFraudWarning,
    QZPayStripeEventCategory
} from './adapters/index.js';

// Types
export type {
    QZPayStripeConfig,
    QZPayStripeConnectConfig,
    QZPayStripeWebhookEventType,
    QZPayStripeWebhookData,
    // v2 Marketplace types (prepared)
    QZPayStripeConnectPaymentOptions,
    QZPayStripeTransferData
} from './types.js';

// Error utilities
export { QZPayError, QZPayErrorCode, mapStripeError, withErrorMapping } from './utils/error.utils.js';

// Re-export Stripe types that consumers might need
export type { Stripe } from 'stripe';
