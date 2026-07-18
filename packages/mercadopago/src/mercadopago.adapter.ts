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
import { isAbsoluteHttpUrl } from './utils/url.utils.js';

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
        // Validate access token format. MercadoPago issues access tokens with
        // the `APP_USR-` prefix for most applications, while some apps issue
        // their Test credentials with a `TEST-` prefix. Sandbox vs production
        // is determined by which credentials section the token was copied from
        // in the MP dashboard, not by the prefix. Both prefixes are accepted;
        // any other format is rejected to surface mis-configurations early.
        if (!config.accessToken.startsWith('APP_USR-') && !config.accessToken.startsWith('TEST-')) {
            throw new Error("Invalid MercadoPago access token format. Expected token starting with 'APP_USR-' or 'TEST-'.");
        }

        // Validate the optional preapproval_plan back_url eagerly (like the access
        // token) so a malformed value fails at construction/boot rather than only
        // when the first plan is provisioned in production.
        if (config.defaultPlanBackUrl !== undefined && !isAbsoluteHttpUrl(config.defaultPlanBackUrl)) {
            throw new Error(
                `Invalid MercadoPago defaultPlanBackUrl: must be an absolute http(s) URL. Received: "${config.defaultPlanBackUrl}".`
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
        this.prices = new QZPayMercadoPagoPriceAdapter(this.client, config.defaultPlanBackUrl);
        this.webhooks = new QZPayMercadoPagoWebhookAdapter({
            webhookSecret: config.webhookSecret,
            failClosedWhenSecretMissing: config.webhookFailClosedWhenSecretMissing ?? false,
            ...(config.logger ? { logger: config.logger } : {})
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
