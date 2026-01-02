import type { QZPayCreateCheckoutInput, QZPayPaymentCheckoutAdapter, QZPayProviderCheckout } from '@qazuor/qzpay-core';
/**
 * MercadoPago Checkout Adapter
 * Uses Preference API for checkout sessions
 */
import { type MercadoPagoConfig, Preference } from 'mercadopago';

export class QZPayMercadoPagoCheckoutAdapter implements QZPayPaymentCheckoutAdapter {
    private readonly preferenceApi: Preference;
    private readonly useSandbox: boolean;

    constructor(client: MercadoPagoConfig, useSandbox = false) {
        this.preferenceApi = new Preference(client);
        this.useSandbox = useSandbox;
    }

    async create(input: QZPayCreateCheckoutInput, providerPriceIds: string[]): Promise<QZPayProviderCheckout> {
        // Build line items from price IDs
        // Note: MercadoPago requires unit_price, which should be set when creating the preference
        // The actual price should come from the plan/product configuration
        const items = providerPriceIds.map((priceId, index) => ({
            id: priceId,
            title: input.lineItems?.[index]?.description ?? `Item ${index + 1}`,
            quantity: input.lineItems?.[index]?.quantity ?? 1,
            unit_price: 0, // Price should be fetched from plan or passed differently
            currency_id: 'USD'
        }));

        // Build body without undefined values
        const body: Parameters<Preference['create']>[0]['body'] = {
            items,
            back_urls: {
                success: input.successUrl,
                failure: input.cancelUrl,
                pending: input.successUrl
            },
            auto_return: 'approved',
            metadata: {
                qzpay_mode: input.mode,
                qzpay_customer_id: input.customerId ?? null
            }
        };

        // Add optional payer
        if (input.customerEmail) {
            body.payer = { email: input.customerEmail };
        }

        // Add optional external reference
        if (input.customerId) {
            body.external_reference = input.customerId;
        }

        // Add expiration if specified
        if (input.expiresInMinutes !== undefined) {
            body.expires = true;
            body.expiration_date_from = new Date().toISOString();
            body.expiration_date_to = new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString();
        }

        const response = await this.preferenceApi.create({ body });

        return this.mapToProviderCheckout(response);
    }

    async retrieve(providerSessionId: string): Promise<QZPayProviderCheckout> {
        const response = await this.preferenceApi.get({
            preferenceId: providerSessionId
        });

        return this.mapToProviderCheckout(response);
    }

    async expire(providerSessionId: string): Promise<void> {
        // MercadoPago doesn't have a direct expire API
        // We update the expiration date to now
        await this.preferenceApi.update({
            id: providerSessionId,
            updatePreferenceRequest: {
                items: [], // Required field, keep existing
                expires: true,
                expiration_date_to: new Date().toISOString()
            }
        });
    }

    private mapToProviderCheckout(preference: Awaited<ReturnType<Preference['get']>>): QZPayProviderCheckout {
        const checkoutUrl = this.useSandbox ? preference.sandbox_init_point : preference.init_point;

        // Determine status based on dates
        let status = 'open';
        const expirationDate = preference.expiration_date_to;
        if (expirationDate && new Date(expirationDate) < new Date()) {
            status = 'expired';
        }

        return {
            id: preference.id ?? '',
            url: checkoutUrl ?? '',
            status,
            paymentIntentId: null, // MercadoPago creates payment after checkout
            subscriptionId: null,
            customerId: preference.external_reference ?? null,
            metadata: this.extractMetadata(preference.metadata)
        };
    }

    private extractMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> {
        if (!metadata) return {};
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }
}
