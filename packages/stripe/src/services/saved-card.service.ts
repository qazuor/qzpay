/**
 * Stripe Saved Card Service Implementation
 *
 * Implements the unified SavedCardService interface for Stripe.
 * Uses Stripe's PaymentMethod API to save and manage cards.
 */
import type { SaveCardInput, SavedCard, SavedCardService, SavedCardServiceConfig, SavedCardServiceStripeConfig } from '@qazuor/qzpay-core';
import Stripe from 'stripe';

/**
 * Stripe implementation of SavedCardService
 */
export class StripeSavedCardService implements SavedCardService {
    private readonly stripe: Stripe;
    private readonly getProviderCustomerId: (customerId: string) => Promise<string>;

    constructor(config: SavedCardServiceStripeConfig) {
        this.stripe = new Stripe(config.stripeSecretKey);
        this.getProviderCustomerId = config.getProviderCustomerId;
    }

    /**
     * Save a payment method to a customer in Stripe
     */
    async save(input: SaveCardInput): Promise<SavedCard> {
        if (!input.paymentMethodId) {
            throw new Error('paymentMethodId is required for Stripe');
        }

        const stripeCustomerId = await this.getProviderCustomerId(input.customerId);

        // Attach the PaymentMethod to the customer
        await this.stripe.paymentMethods.attach(input.paymentMethodId, {
            customer: stripeCustomerId
        });

        // Set metadata if provided
        if (input.metadata) {
            await this.stripe.paymentMethods.update(input.paymentMethodId, {
                metadata: this.toStripeMetadata(input.metadata)
            });
        }

        // Set as default if requested
        if (input.setAsDefault) {
            await this.stripe.customers.update(stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: input.paymentMethodId
                }
            });
        }

        // Retrieve the PaymentMethod to get full details
        const paymentMethod = await this.stripe.paymentMethods.retrieve(input.paymentMethodId);

        return this.mapToSavedCard(paymentMethod, input.customerId, stripeCustomerId, input.setAsDefault ?? false);
    }

    /**
     * List all saved cards for a customer in Stripe
     */
    async list(customerId: string): Promise<SavedCard[]> {
        const stripeCustomerId = await this.getProviderCustomerId(customerId);

        // Get the customer to check default payment method
        const customer = await this.stripe.customers.retrieve(stripeCustomerId);

        // Check if customer is deleted
        if (customer.deleted) {
            throw new Error(`Customer ${stripeCustomerId} has been deleted`);
        }

        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method
            ? typeof customer.invoice_settings.default_payment_method === 'string'
                ? customer.invoice_settings.default_payment_method
                : customer.invoice_settings.default_payment_method.id
            : null;

        // List all PaymentMethods of type 'card' for this customer
        const paymentMethods = await this.stripe.paymentMethods.list({
            customer: stripeCustomerId,
            type: 'card'
        });

        return paymentMethods.data.map((pm) => this.mapToSavedCard(pm, customerId, stripeCustomerId, pm.id === defaultPaymentMethodId));
    }

    /**
     * Remove a saved card from a customer in Stripe
     */
    async remove(customerId: string, cardId: string): Promise<void> {
        // Verify the customer owns this payment method
        const stripeCustomerId = await this.getProviderCustomerId(customerId);

        // Retrieve the PaymentMethod to verify it belongs to this customer
        const paymentMethod = await this.stripe.paymentMethods.retrieve(cardId);

        if (paymentMethod.customer !== stripeCustomerId) {
            throw new Error(`PaymentMethod ${cardId} does not belong to customer ${customerId}`);
        }

        // Detach the PaymentMethod from the customer
        await this.stripe.paymentMethods.detach(cardId);
    }

    /**
     * Set a card as the default payment method in Stripe
     */
    async setDefault(customerId: string, cardId: string): Promise<void> {
        const stripeCustomerId = await this.getProviderCustomerId(customerId);

        // Verify the PaymentMethod belongs to this customer
        const paymentMethod = await this.stripe.paymentMethods.retrieve(cardId);

        if (paymentMethod.customer !== stripeCustomerId) {
            throw new Error(`PaymentMethod ${cardId} does not belong to customer ${customerId}`);
        }

        // Set as default payment method
        await this.stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
                default_payment_method: cardId
            }
        });
    }

    /**
     * Map Stripe PaymentMethod to SavedCard
     */
    private mapToSavedCard(
        paymentMethod: Stripe.PaymentMethod,
        customerId: string,
        providerCustomerId: string,
        isDefault: boolean
    ): SavedCard {
        if (!paymentMethod.card) {
            throw new Error(`PaymentMethod ${paymentMethod.id} is not a card`);
        }

        const card = paymentMethod.card;
        const savedCard: SavedCard = {
            id: paymentMethod.id,
            customerId,
            providerCustomerId,
            provider: 'stripe',
            last4: card.last4,
            brand: card.brand,
            expMonth: card.exp_month,
            expYear: card.exp_year,
            isDefault,
            createdAt: new Date(paymentMethod.created * 1000)
        };

        // Add optional cardholder name if available
        if (paymentMethod.billing_details?.name) {
            savedCard.cardholderName = paymentMethod.billing_details.name;
        }

        return savedCard;
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

/**
 * Create a Stripe saved card service instance
 *
 * @param config - Stripe configuration
 * @returns SavedCardService instance for Stripe
 *
 * @example
 * ```typescript
 * const cardService = createSavedCardService({
 *   provider: 'stripe',
 *   stripeSecretKey: 'sk_test_xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     const customer = await db.customers.findById(customerId);
 *     return customer.stripeCustomerId;
 *   },
 * });
 *
 * // Save a card
 * const card = await cardService.save({
 *   customerId: 'local_cus_123',
 *   paymentMethodId: 'pm_xxx',
 *   setAsDefault: true,
 * });
 * ```
 */
export function createSavedCardService(config: SavedCardServiceConfig): SavedCardService {
    if (config.provider !== 'stripe') {
        throw new Error(`Invalid provider: ${config.provider}. Expected 'stripe'`);
    }

    return new StripeSavedCardService(config);
}
