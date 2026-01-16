/**
 * MercadoPago Saved Card Service Implementation
 *
 * Implements the unified SavedCardService interface for MercadoPago.
 * Uses the existing QZPayMercadoPagoCustomerAdapter for card operations.
 */
import type {
    SaveCardInput,
    SavedCard,
    SavedCardService,
    SavedCardServiceConfig,
    SavedCardServiceMercadoPagoConfig
} from '@qazuor/qzpay-core';
import { MercadoPagoConfig } from 'mercadopago';
import { QZPayMercadoPagoCustomerAdapter } from '../adapters/customer.adapter.js';

/**
 * MercadoPago implementation of SavedCardService
 */
export class MercadoPagoSavedCardService implements SavedCardService {
    private readonly customerAdapter: QZPayMercadoPagoCustomerAdapter;
    private readonly getProviderCustomerId: (customerId: string) => Promise<string>;

    constructor(config: SavedCardServiceMercadoPagoConfig) {
        const mpConfig = new MercadoPagoConfig({
            accessToken: config.mercadopagoAccessToken
        });
        this.customerAdapter = new QZPayMercadoPagoCustomerAdapter(mpConfig);
        this.getProviderCustomerId = config.getProviderCustomerId;
    }

    /**
     * Save a card to a customer in MercadoPago
     */
    async save(input: SaveCardInput): Promise<SavedCard> {
        if (!input.token) {
            throw new Error('token is required for MercadoPago');
        }

        const mpCustomerId = await this.getProviderCustomerId(input.customerId);

        // Save the card using the customer adapter
        const savedCard = await this.customerAdapter.saveCard(mpCustomerId, input.token);

        // MercadoPago doesn't have a concept of default payment method at the API level
        // The application layer needs to track which card is default
        // For now, we'll set isDefault based on input parameter
        const isDefault = input.setAsDefault ?? false;

        return this.mapToSavedCard(savedCard, input.customerId, mpCustomerId, isDefault);
    }

    /**
     * List all saved cards for a customer in MercadoPago
     */
    async list(customerId: string): Promise<SavedCard[]> {
        const mpCustomerId = await this.getProviderCustomerId(customerId);

        // List cards using the customer adapter
        const savedCards = await this.customerAdapter.listCards(mpCustomerId);

        // MercadoPago doesn't track default payment method
        // Return all cards with isDefault=false
        // The application layer should track which card is default
        return savedCards.map((card) => this.mapToSavedCard(card, customerId, mpCustomerId, false));
    }

    /**
     * Remove a saved card from a customer in MercadoPago
     */
    async remove(customerId: string, cardId: string): Promise<void> {
        const mpCustomerId = await this.getProviderCustomerId(customerId);

        // Remove the card using the customer adapter
        await this.customerAdapter.removeCard(mpCustomerId, cardId);
    }

    /**
     * Set a card as the default payment method
     *
     * NOTE: MercadoPago doesn't have a native concept of default payment method
     * at the API level. Applications using MercadoPago should track the default
     * card in their own database.
     *
     * This method is a no-op for MercadoPago but is kept for interface consistency.
     *
     * @throws {Error} Always throws with a helpful message
     */
    async setDefault(_customerId: string, _cardId: string): Promise<void> {
        throw new Error(
            'MercadoPago does not support default payment method at the API level. ' +
                'Track the default card in your application database and pass it when creating payments.'
        );
    }

    /**
     * Map MercadoPago saved card to unified SavedCard interface
     */
    private mapToSavedCard(
        mpCard: {
            id: string;
            provider: string;
            lastFourDigits: string;
            firstSixDigits?: string;
            expirationMonth: number;
            expirationYear: number;
            cardholderName?: string;
            paymentMethodId?: string;
            paymentMethodName?: string;
            createdAt: Date;
        },
        customerId: string,
        providerCustomerId: string,
        isDefault: boolean
    ): SavedCard {
        // Extract brand from payment method name
        // MercadoPago uses paymentMethodId (e.g., 'visa', 'master')
        const brand = mpCard.paymentMethodId ?? 'unknown';

        const savedCard: SavedCard = {
            id: mpCard.id,
            customerId,
            providerCustomerId,
            provider: 'mercadopago',
            last4: mpCard.lastFourDigits,
            brand,
            expMonth: mpCard.expirationMonth,
            expYear: mpCard.expirationYear,
            isDefault,
            createdAt: mpCard.createdAt
        };

        // Add optional fields if available
        if (mpCard.cardholderName) {
            savedCard.cardholderName = mpCard.cardholderName;
        }

        if (mpCard.firstSixDigits) {
            savedCard.firstSixDigits = mpCard.firstSixDigits;
        }

        return savedCard;
    }
}

/**
 * Create a MercadoPago saved card service instance
 *
 * @param config - MercadoPago configuration
 * @returns SavedCardService instance for MercadoPago
 *
 * @example
 * ```typescript
 * const cardService = createSavedCardService({
 *   provider: 'mercadopago',
 *   mercadopagoAccessToken: 'APP_USR-xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     const customer = await db.customers.findById(customerId);
 *     return customer.mercadopagoCustomerId;
 *   },
 * });
 *
 * // Save a card
 * const card = await cardService.save({
 *   customerId: 'local_cus_123',
 *   token: 'card_token_xxx',
 *   setAsDefault: true, // Note: app must track default separately
 * });
 * ```
 */
export function createSavedCardService(config: SavedCardServiceConfig): SavedCardService {
    if (config.provider !== 'mercadopago') {
        throw new Error(`Invalid provider: ${config.provider}. Expected 'mercadopago'`);
    }

    return new MercadoPagoSavedCardService(config);
}
