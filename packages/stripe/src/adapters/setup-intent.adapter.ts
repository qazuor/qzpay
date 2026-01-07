/**
 * Stripe Setup Intent Adapter
 *
 * Implements QZPaySetupIntentAdapter for Stripe.
 * Allows saving payment methods for future use without charging immediately.
 */
import type {
    QZPayConfirmSetupIntentInput,
    QZPayCreateSetupIntentInput,
    QZPayProviderSetupIntent,
    QZPaySetupIntentAdapter
} from '@qazuor/qzpay-core';
import type Stripe from 'stripe';

export class QZPayStripeSetupIntentAdapter implements QZPaySetupIntentAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a new Setup Intent in Stripe
     */
    async create(input: QZPayCreateSetupIntentInput): Promise<QZPayProviderSetupIntent> {
        const params: Stripe.SetupIntentCreateParams = {
            customer: input.customerId,
            usage: input.usage ?? 'off_session',
            metadata: input.metadata ?? {}
        };

        // Set payment method types if provided
        if (input.paymentMethodTypes?.length) {
            params.payment_method_types = input.paymentMethodTypes;
        } else {
            // Default to card payments
            params.payment_method_types = ['card'];
        }

        // Set description if provided
        if (input.description) {
            params.description = input.description;
        }

        const setupIntent = await this.stripe.setupIntents.create(params);

        return this.mapSetupIntent(setupIntent);
    }

    /**
     * Retrieve an existing Setup Intent from Stripe
     */
    async retrieve(setupIntentId: string): Promise<QZPayProviderSetupIntent> {
        const setupIntent = await this.stripe.setupIntents.retrieve(setupIntentId);

        return this.mapSetupIntent(setupIntent);
    }

    /**
     * Confirm a Setup Intent
     */
    async confirm(input: QZPayConfirmSetupIntentInput): Promise<QZPayProviderSetupIntent> {
        const params: Stripe.SetupIntentConfirmParams = {};

        // Set payment method if provided
        if (input.paymentMethodId) {
            params.payment_method = input.paymentMethodId;
        }

        // Set return URL for redirect-based payment methods
        if (input.returnUrl) {
            params.return_url = input.returnUrl;
        }

        const setupIntent = await this.stripe.setupIntents.confirm(input.setupIntentId, params);

        return this.mapSetupIntent(setupIntent);
    }

    /**
     * Cancel a Setup Intent
     */
    async cancel(setupIntentId: string): Promise<void> {
        await this.stripe.setupIntents.cancel(setupIntentId);
    }

    /**
     * Update a Setup Intent
     */
    async update(
        setupIntentId: string,
        updates: Partial<Pick<QZPayCreateSetupIntentInput, 'metadata' | 'description'>>
    ): Promise<QZPayProviderSetupIntent> {
        const params: Stripe.SetupIntentUpdateParams = {};

        if (updates.metadata) {
            params.metadata = updates.metadata;
        }

        if (updates.description) {
            params.description = updates.description;
        }

        const setupIntent = await this.stripe.setupIntents.update(setupIntentId, params);

        return this.mapSetupIntent(setupIntent);
    }

    /**
     * Map Stripe SetupIntent to QZPay provider setup intent
     */
    private mapSetupIntent(setupIntent: Stripe.SetupIntent): QZPayProviderSetupIntent {
        // Extract payment method ID
        let paymentMethodId: string | null = null;
        if (setupIntent.payment_method) {
            paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method.id;
        }

        return {
            id: setupIntent.id,
            clientSecret: setupIntent.client_secret ?? '',
            status: setupIntent.status,
            paymentMethodId,
            raw: setupIntent
        };
    }
}

/**
 * Create a Stripe Setup Intent adapter instance
 */
export function createStripeSetupIntentAdapter(stripe: Stripe): QZPayStripeSetupIntentAdapter {
    return new QZPayStripeSetupIntentAdapter(stripe);
}
