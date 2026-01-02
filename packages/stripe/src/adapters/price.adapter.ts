import type { QZPayCreatePriceInput, QZPayPaymentPriceAdapter, QZPayProviderPrice } from '@qazuor/qzpay-core';
/**
 * Stripe Price Adapter
 *
 * Implements QZPayPaymentPriceAdapter for Stripe Products and Prices
 */
import type Stripe from 'stripe';

export class QZPayStripePriceAdapter implements QZPayPaymentPriceAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a price in Stripe
     */
    async create(input: QZPayCreatePriceInput, providerProductId: string): Promise<string> {
        const params: Stripe.PriceCreateParams = {
            product: providerProductId,
            unit_amount: input.unitAmount,
            currency: input.currency.toLowerCase(),
            metadata: input.metadata ? this.toStripeMetadata(input.metadata) : {}
        };

        // Set recurring based on billing interval
        if (input.billingInterval) {
            params.recurring = {
                interval: this.mapInterval(input.billingInterval),
                interval_count: input.intervalCount ?? 1
            };
        }

        // Set nickname if provided
        if (input.nickname) {
            params.nickname = input.nickname;
        }

        const price = await this.stripe.prices.create(params);

        return price.id;
    }

    /**
     * Archive a price in Stripe
     */
    async archive(providerPriceId: string): Promise<void> {
        await this.stripe.prices.update(providerPriceId, { active: false });
    }

    /**
     * Retrieve a price from Stripe
     */
    async retrieve(providerPriceId: string): Promise<QZPayProviderPrice> {
        const price = await this.stripe.prices.retrieve(providerPriceId);

        return this.mapPrice(price);
    }

    /**
     * Create a product in Stripe
     */
    async createProduct(name: string, description?: string): Promise<string> {
        const params: Stripe.ProductCreateParams = {
            name
        };

        if (description) {
            params.description = description;
        }

        const product = await this.stripe.products.create(params);

        return product.id;
    }

    /**
     * Map Stripe price to QZPay provider price
     */
    private mapPrice(price: Stripe.Price): QZPayProviderPrice {
        return {
            id: price.id,
            active: price.active,
            unitAmount: price.unit_amount ?? 0,
            currency: price.currency.toUpperCase(),
            recurring: price.recurring
                ? {
                      interval: price.recurring.interval,
                      intervalCount: price.recurring.interval_count
                  }
                : null
        };
    }

    /**
     * Map QZPay interval to Stripe interval
     */
    private mapInterval(interval: string): Stripe.PriceCreateParams.Recurring.Interval {
        const intervalMap: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
            day: 'day',
            week: 'week',
            month: 'month',
            year: 'year'
        };

        return intervalMap[interval] ?? 'month';
    }

    /**
     * Convert metadata to Stripe-compatible format
     */
    private toStripeMetadata(metadata: Record<string, unknown>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }
}
