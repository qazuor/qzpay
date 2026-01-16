import type { QZPayPaymentAdapter } from '@qazuor/qzpay-core';
/**
 * QZPay Stripe Adapter
 *
 * Main adapter class that implements QZPayPaymentAdapter for Stripe
 */
import Stripe from 'stripe';
import {
    QZPayStripeCheckoutAdapter,
    QZPayStripeCustomerAdapter,
    QZPayStripePaymentAdapter,
    QZPayStripePriceAdapter,
    QZPayStripeSetupIntentAdapter,
    QZPayStripeSubscriptionAdapter,
    QZPayStripeVendorAdapter,
    QZPayStripeWebhookAdapter
} from './adapters/index.js';
import type { QZPayStripeConfig, QZPayStripeConnectConfig } from './types.js';

/**
 * Stripe Payment Adapter for QZPay
 *
 * Provides full Stripe integration including:
 * - Customer management
 * - Subscription lifecycle
 * - One-time payments
 * - Checkout Sessions
 * - Products and Prices
 * - Webhook handling
 * - Connect/Marketplace (optional)
 *
 * @example
 * ```typescript
 * import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
 *
 * const stripeAdapter = createQZPayStripeAdapter({
 *   secretKey: process.env.STRIPE_SECRET_KEY!,
 *   webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
 * });
 *
 * // Use with QZPay
 * const qzpay = new QZPay({
 *   paymentAdapter: stripeAdapter,
 *   storage: storageAdapter
 * });
 * ```
 */
export class QZPayStripeAdapter implements QZPayPaymentAdapter {
    readonly provider = 'stripe' as const;

    readonly customers: QZPayStripeCustomerAdapter;
    readonly subscriptions: QZPayStripeSubscriptionAdapter;
    readonly payments: QZPayStripePaymentAdapter;
    readonly checkout: QZPayStripeCheckoutAdapter;
    readonly prices: QZPayStripePriceAdapter;
    readonly webhooks: QZPayStripeWebhookAdapter;
    readonly setupIntents: QZPayStripeSetupIntentAdapter;
    readonly vendors?: QZPayStripeVendorAdapter;

    private readonly stripe: Stripe;

    constructor(config: QZPayStripeConfig, connectConfig?: QZPayStripeConnectConfig) {
        // Validate secret key format
        if (!config.secretKey.startsWith('sk_')) {
            throw new Error("Invalid Stripe secret key format. Expected key starting with 'sk_'");
        }

        // Validate webhook secret format if provided
        if (config.webhookSecret && !config.webhookSecret.startsWith('whsec_')) {
            throw new Error("Invalid Stripe webhook secret format. Expected secret starting with 'whsec_'");
        }

        // Initialize Stripe client with optional API version override
        const stripeConfig: Stripe.StripeConfig = {
            ...config.stripeOptions
        };

        // Only set apiVersion if explicitly provided
        if (config.apiVersion) {
            stripeConfig.apiVersion = config.apiVersion;
        }

        this.stripe = new Stripe(config.secretKey, stripeConfig);

        // Initialize sub-adapters with retry configuration
        const retryConfig = config.retry;
        this.customers = new QZPayStripeCustomerAdapter(this.stripe, retryConfig);
        this.subscriptions = new QZPayStripeSubscriptionAdapter(this.stripe, retryConfig);
        this.payments = new QZPayStripePaymentAdapter(this.stripe, retryConfig);
        this.checkout = new QZPayStripeCheckoutAdapter(this.stripe);
        this.prices = new QZPayStripePriceAdapter(this.stripe);
        this.webhooks = new QZPayStripeWebhookAdapter(this.stripe, config.webhookSecret, retryConfig);
        this.setupIntents = new QZPayStripeSetupIntentAdapter(this.stripe);

        // Initialize vendor adapter if Connect is configured
        if (connectConfig) {
            this.vendors = new QZPayStripeVendorAdapter(this.stripe);
        }
    }

    /**
     * Get the underlying Stripe client for advanced operations
     */
    getStripeClient(): Stripe {
        return this.stripe;
    }
}

/**
 * Create a QZPay Stripe adapter instance
 *
 * @param config - Stripe configuration options
 * @param connectConfig - Optional Stripe Connect configuration for marketplace
 * @returns Configured Stripe adapter
 *
 * @example
 * ```typescript
 * const adapter = createQZPayStripeAdapter({
 *   secretKey: 'sk_test_...',
 *   webhookSecret: 'whsec_...'
 * });
 * ```
 */
export function createQZPayStripeAdapter(config: QZPayStripeConfig, connectConfig?: QZPayStripeConnectConfig): QZPayStripeAdapter {
    return new QZPayStripeAdapter(config, connectConfig);
}
