/**
 * MercadoPago CardToken Adapter
 *
 * Handles creation of card tokens from saved card IDs.
 * Required for Card on File payments where the customer has a saved card
 * and we need to generate a new token for each payment.
 */
import { CardToken, type MercadoPagoConfig } from 'mercadopago';
import { wrapAdapterMethod } from '../utils/error-mapper.js';

/**
 * CardToken adapter interface
 */
export interface QZPayMercadoPagoCardTokenAdapter {
    /**
     * Create a card token from a saved card ID
     *
     * @param cardId - The saved card ID (from customer.cards)
     * @param securityCode - Optional CVV for additional security
     * @returns The generated card token ID
     *
     * @example
     * ```typescript
     * const token = await adapter.create('card_123456', '123');
     * // Use token in payment.create()
     * ```
     */
    create(cardId: string, securityCode?: string): Promise<string>;
}

/**
 * MercadoPago CardToken Adapter implementation
 */
export class QZPayMercadoPagoCardTokenAdapterImpl implements QZPayMercadoPagoCardTokenAdapter {
    private readonly cardTokenApi: CardToken;

    constructor(client: MercadoPagoConfig) {
        this.cardTokenApi = new CardToken(client);
    }

    async create(cardId: string, securityCode?: string): Promise<string> {
        return wrapAdapterMethod('Create card token', async () => {
            const body: Parameters<CardToken['create']>[0]['body'] = {
                card_id: cardId
            };

            // Add security code if provided
            if (securityCode) {
                body.security_code = securityCode;
            }

            const response = await this.cardTokenApi.create({ body });

            if (!response.id) {
                throw new Error('Failed to create card token from card ID');
            }

            return response.id;
        });
    }
}
