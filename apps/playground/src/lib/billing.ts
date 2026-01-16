/**
 * QZPay Billing Instance Factory
 * Creates and manages the billing instance based on selected payment mode
 */
import { type QZPayBilling, type QZPayBillingConfig, type QZPayEvent, type QZPayEventMap, createQZPayBilling } from '@qazuor/qzpay-core';
import { createLocalStorageAdapter } from '../adapters/local-storage.adapter';
import { createMockPaymentAdapter } from '../adapters/mock-payment.adapter';

export type PaymentMode = 'mock' | 'stripe' | 'mercadopago';

export interface BillingFactoryConfig {
    mode: PaymentMode;
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    mercadopagoAccessToken?: string;
    onEvent?: <K extends keyof QZPayEventMap>(eventType: K, payload: QZPayEventMap[K]) => void;
}

let billingInstance: QZPayBilling | null = null;

/**
 * Create a new billing instance
 *
 * NOTE: The playground always uses the mock payment adapter for processing payments
 * because Stripe and MercadoPago SDKs are designed for server-side use (Node.js),
 * not browsers. They rely on Node.js-specific APIs like `process` which don't exist
 * in browser environments.
 *
 * The selected mode affects:
 * - Which test cards are shown in the UI
 * - How template customers are configured (providerCustomerIds)
 * - The learning experience and documentation context
 *
 * But all actual payment processing is simulated locally using the mock adapter.
 */
export async function createPlaygroundBilling(config: BillingFactoryConfig): Promise<QZPayBilling> {
    // Create storage adapter (always localStorage for playground)
    const storage = createLocalStorageAdapter();

    // Always use mock payment adapter in browser playground
    // The real SDKs (Stripe, MercadoPago) require Node.js environment
    // and would fail with "process is not defined" in browsers.
    // The mode selection is for UI/UX purposes (showing appropriate test cards)
    const paymentAdapter = createMockPaymentAdapter();

    // Log the mode for debugging purposes
    if (config.mode !== 'mock') {
        console.info(
            `[QZPay Playground] Running in ${config.mode} mode with simulated payments. ` +
                `Real ${config.mode} API integration requires a Node.js server environment.`
        );
    }

    // Create billing config
    const billingConfig: QZPayBillingConfig = {
        storage,
        paymentAdapter,
        livemode: false, // Always test mode in playground
        defaultCurrency: 'USD'
    };

    // Create billing instance
    billingInstance = createQZPayBilling(billingConfig);

    // Subscribe to all events if callback provided
    if (config.onEvent) {
        const eventTypes: (keyof QZPayEventMap)[] = [
            'customer.created',
            'customer.updated',
            'customer.deleted',
            'subscription.created',
            'subscription.updated',
            'subscription.canceled',
            'subscription.paused',
            'subscription.resumed',
            'subscription.trial_ending',
            'subscription.trial_ended',
            'subscription.addon_added',
            'subscription.addon_removed',
            'subscription.addon_updated',
            'payment.succeeded',
            'payment.failed',
            'payment.refunded',
            'payment.disputed',
            'invoice.created',
            'invoice.paid',
            'invoice.payment_failed',
            'invoice.voided',
            'checkout.completed',
            'checkout.expired',
            'vendor.created',
            'vendor.updated',
            'vendor.payout',
            'addon.created',
            'addon.updated',
            'addon.deleted'
        ];

        for (const eventType of eventTypes) {
            billingInstance.on(eventType, (event: QZPayEvent<QZPayEventMap[typeof eventType]>) => {
                config.onEvent?.(eventType, event.data);
            });
        }
    }

    return billingInstance;
}

/**
 * Get the current billing instance
 * Throws if not initialized
 */
export function getBilling(): QZPayBilling {
    if (!billingInstance) {
        throw new Error('Billing not initialized. Call createPlaygroundBilling first.');
    }
    return billingInstance;
}

/**
 * Check if billing is initialized
 */
export function isBillingInitialized(): boolean {
    return billingInstance !== null;
}

/**
 * Reset the billing instance
 */
export function resetBilling(): void {
    billingInstance = null;
}
