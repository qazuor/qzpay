import type { QZPayPaymentAdapter } from '@qazuor/qzpay-core';
/**
 * MercadoPago Payment Adapter
 *
 * Main adapter that orchestrates all MercadoPago sub-adapters
 */
import { MercadoPagoConfig } from 'mercadopago';
import {
    QZPayMercadoPagoCheckoutAdapter,
    QZPayMercadoPagoCustomerAdapter,
    QZPayMercadoPagoPaymentAdapter,
    QZPayMercadoPagoPriceAdapter,
    QZPayMercadoPagoSubscriptionAdapter,
    QZPayMercadoPagoWebhookAdapter
} from './adapters/index.js';
import type { QZPayMercadoPagoConfig } from './types.js';

export class QZPayMercadoPagoAdapter implements QZPayPaymentAdapter {
    readonly provider = 'mercadopago' as const;

    readonly customers: QZPayMercadoPagoCustomerAdapter;
    readonly subscriptions: QZPayMercadoPagoSubscriptionAdapter;
    readonly payments: QZPayMercadoPagoPaymentAdapter;
    readonly checkout: QZPayMercadoPagoCheckoutAdapter;
    readonly prices: QZPayMercadoPagoPriceAdapter;
    readonly webhooks: QZPayMercadoPagoWebhookAdapter;

    private readonly client: MercadoPagoConfig;

    constructor(config: QZPayMercadoPagoConfig) {
        // Validate access token format. Current MercadoPago issues tokens
        // with the `APP_USR-` prefix for BOTH sandbox and production —
        // sandbox vs prod is determined by which credentials section the
        // token was copied from in the MP dashboard, not by the prefix.
        // The legacy `TEST-` prefix is no longer used by MP and is rejected
        // here to surface mis-configurations early.
        if (!config.accessToken.startsWith('APP_USR-')) {
            throw new Error(
                "Invalid MercadoPago access token format. Expected token starting with 'APP_USR-' (current MercadoPago format for both sandbox and production)."
            );
        }

        // Initialize MercadoPago client
        const clientOptions: ConstructorParameters<typeof MercadoPagoConfig>[0] = {
            accessToken: config.accessToken,
            options: {
                timeout: config.timeout ?? 5000
            }
        };

        if (config.integratorId) {
            clientOptions.options = {
                ...clientOptions.options,
                integratorId: config.integratorId
            };
        }

        if (config.platformId) {
            clientOptions.options = {
                ...clientOptions.options,
                platformId: config.platformId
            };
        }

        this.client = new MercadoPagoConfig(clientOptions);

        // Initialize sub-adapters with retry configuration
        const retryConfig = config.retry;
        this.customers = new QZPayMercadoPagoCustomerAdapter(this.client);
        this.subscriptions = new QZPayMercadoPagoSubscriptionAdapter(this.client);
        this.payments = new QZPayMercadoPagoPaymentAdapter(this.client, retryConfig);
        this.checkout = new QZPayMercadoPagoCheckoutAdapter(this.client, config.sandbox ?? false);
        this.prices = new QZPayMercadoPagoPriceAdapter(this.client);
        this.webhooks = new QZPayMercadoPagoWebhookAdapter({
            webhookSecret: config.webhookSecret,
            failClosedWhenSecretMissing: config.webhookFailClosedWhenSecretMissing ?? false
        });
    }

    /**
     * Get the underlying MercadoPago client
     */
    getMercadoPagoClient(): MercadoPagoConfig {
        return this.client;
    }
}

/**
 * Factory function to create MercadoPago adapter
 */
export function createQZPayMercadoPagoAdapter(config: QZPayMercadoPagoConfig): QZPayMercadoPagoAdapter {
    return new QZPayMercadoPagoAdapter(config);
}
