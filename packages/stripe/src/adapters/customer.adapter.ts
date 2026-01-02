import type { QZPayCreateCustomerInput, QZPayPaymentCustomerAdapter, QZPayProviderCustomer } from '@qazuor/qzpay-core';
/**
 * Stripe Customer Adapter
 *
 * Implements QZPayPaymentCustomerAdapter for Stripe
 */
import type Stripe from 'stripe';

export class QZPayStripeCustomerAdapter implements QZPayPaymentCustomerAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a customer in Stripe
     */
    async create(input: QZPayCreateCustomerInput): Promise<string> {
        const params: Stripe.CustomerCreateParams = {
            email: input.email,
            metadata: {
                qzpay_external_id: input.externalId
            }
        };

        if (input.name) {
            params.name = input.name;
        }

        if (input.metadata) {
            params.metadata = {
                ...params.metadata,
                ...this.toStripeMetadata(input.metadata)
            };
        }

        const customer = await this.stripe.customers.create(params);

        return customer.id;
    }

    /**
     * Update a customer in Stripe
     */
    async update(providerCustomerId: string, input: Partial<QZPayCreateCustomerInput>): Promise<void> {
        const params: Stripe.CustomerUpdateParams = {};

        if (input.email !== undefined) {
            params.email = input.email;
        }

        if (input.name !== undefined && input.name !== null) {
            params.name = input.name;
        }

        if (input.metadata !== undefined) {
            params.metadata = this.toStripeMetadata(input.metadata);
        }

        await this.stripe.customers.update(providerCustomerId, params);
    }

    /**
     * Delete a customer in Stripe
     */
    async delete(providerCustomerId: string): Promise<void> {
        await this.stripe.customers.del(providerCustomerId);
    }

    /**
     * Retrieve a customer from Stripe
     */
    async retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer> {
        const customer = await this.stripe.customers.retrieve(providerCustomerId);

        if (customer.deleted) {
            throw new Error(`Customer ${providerCustomerId} has been deleted`);
        }

        return {
            id: customer.id,
            email: customer.email ?? '',
            name: customer.name ?? null,
            metadata: (customer.metadata as Record<string, string>) ?? {}
        };
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
