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
        // Validate access token format
        if (!config.accessToken.startsWith('APP_USR-') && !config.accessToken.startsWith('TEST-')) {
            throw new Error("Invalid MercadoPago access token format. Expected token starting with 'APP_USR-' or 'TEST-'");
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
        this.checkout = new QZPayMercadoPagoCheckoutAdapter(this.client, this.isSandbox(config.accessToken));
        this.prices = new QZPayMercadoPagoPriceAdapter(this.client);
        this.webhooks = new QZPayMercadoPagoWebhookAdapter(config.webhookSecret);
    }

    /**
     * Get the underlying MercadoPago client
     */
    getMercadoPagoClient(): MercadoPagoConfig {
        return this.client;
    }

    /**
     * Check if using sandbox/test mode based on access token
     */
    private isSandbox(accessToken: string): boolean {
        return accessToken.includes('TEST');
    }
}

/**
 * Factory function to create MercadoPago adapter
 */
export function createQZPayMercadoPagoAdapter(config: QZPayMercadoPagoConfig): QZPayMercadoPagoAdapter {
    return new QZPayMercadoPagoAdapter(config);
}
