import type { QZPayPaymentCustomerAdapter, QZPayProviderCreateCustomerInput, QZPayProviderCustomer } from '@qazuor/qzpay-core';
/**
 * Stripe Customer Adapter
 *
 * Implements QZPayPaymentCustomerAdapter for Stripe
 */
import type Stripe from 'stripe';
import { toStripeMetadata } from '../utils/metadata.utils.js';
import { type RetryConfig, withRetry } from '../utils/retry.utils.js';

export class QZPayStripeCustomerAdapter implements QZPayPaymentCustomerAdapter {
    constructor(
        private readonly stripe: Stripe,
        private readonly retryConfig?: Partial<RetryConfig>
    ) {}

    /**
     * Create a customer in Stripe
     */
    async create(input: QZPayProviderCreateCustomerInput): Promise<string> {
        return withRetry(
            async () => {
                const params: Stripe.CustomerCreateParams = {
                    email: input.email
                };

                if (input.name) {
                    params.name = input.name;
                }

                // Build metadata with externalId
                const metadata: Record<string, string> = {};

                // Add externalId to metadata if provided
                if ('externalId' in input && input.externalId) {
                    // biome-ignore lint/complexity/useLiteralKeys: Index signature requires bracket notation
                    metadata['qzpay_external_id'] = input.externalId;
                }

                // Merge with custom metadata
                if (input.metadata) {
                    Object.assign(metadata, toStripeMetadata(input.metadata));
                }

                if (Object.keys(metadata).length > 0) {
                    params.metadata = metadata;
                }

                const customer = await this.stripe.customers.create(params);

                return customer.id;
            },
            this.retryConfig,
            'Create customer'
        );
    }

    /**
     * Update a customer in Stripe
     */
    async update(providerCustomerId: string, input: Partial<QZPayProviderCreateCustomerInput>): Promise<void> {
        return withRetry(
            async () => {
                const params: Stripe.CustomerUpdateParams = {};

                if (input.email !== undefined) {
                    params.email = input.email;
                }

                if (input.name !== undefined && input.name !== null) {
                    params.name = input.name;
                }

                if (input.metadata !== undefined) {
                    params.metadata = toStripeMetadata(input.metadata);
                }

                await this.stripe.customers.update(providerCustomerId, params);
            },
            this.retryConfig,
            'Update customer'
        );
    }

    /**
     * Delete a customer in Stripe
     */
    async delete(providerCustomerId: string): Promise<void> {
        return withRetry(
            async () => {
                await this.stripe.customers.del(providerCustomerId);
            },
            this.retryConfig,
            'Delete customer'
        );
    }

    /**
     * Retrieve a customer from Stripe
     */
    async retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer> {
        return withRetry(
            async () => {
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
            },
            this.retryConfig,
            'Retrieve customer'
        );
    }
}
