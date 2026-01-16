/**
 * Unified interface for saving cards across payment providers
 *
 * This service provides a consistent API for managing saved payment cards
 * across different payment providers (Stripe, MercadoPago, etc.).
 *
 * @example
 * ```typescript
 * import { createSavedCardService } from '@qazuor/qzpay-stripe';
 *
 * const cardService = createSavedCardService({
 *   provider: 'stripe',
 *   stripeSecretKey: 'sk_xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     const customer = await db.customers.findById(customerId);
 *     return customer.stripeCustomerId;
 *   },
 * });
 *
 * // Save a card
 * const card = await cardService.save({
 *   customerId: 'local_cus_123',
 *   paymentMethodId: 'pm_xxx', // From Stripe.js
 *   setAsDefault: true,
 * });
 *
 * // List cards
 * const cards = await cardService.list('local_cus_123');
 *
 * // Remove card
 * await cardService.remove('local_cus_123', card.id);
 * ```
 */

/**
 * Input for saving a card
 */
export interface SaveCardInput {
    /**
     * Local customer ID (your app's customer ID)
     */
    customerId: string;

    /**
     * For Stripe: the PaymentMethod ID from Stripe.js
     * Generated client-side via stripe.createPaymentMethod()
     */
    paymentMethodId?: string;

    /**
     * For MercadoPago: the token from MercadoPago.js
     * Generated client-side via MercadoPago.createCardToken()
     */
    token?: string;

    /**
     * Set this card as the default payment method
     * @default false
     */
    setAsDefault?: boolean;

    /**
     * Additional metadata to attach to the payment method
     */
    metadata?: Record<string, unknown>;
}

/**
 * Unified saved card representation
 */
export interface SavedCard {
    /**
     * Card ID (provider's PaymentMethod ID or Card ID)
     */
    id: string;

    /**
     * Local customer ID
     */
    customerId: string;

    /**
     * Provider's customer ID (Stripe customer ID or MercadoPago customer ID)
     */
    providerCustomerId: string;

    /**
     * Payment provider
     */
    provider: 'stripe' | 'mercadopago';

    /**
     * Last 4 digits of the card
     */
    last4: string;

    /**
     * Card brand (visa, mastercard, amex, etc.)
     */
    brand: string;

    /**
     * Expiration month (1-12)
     */
    expMonth: number;

    /**
     * Expiration year (4 digits)
     */
    expYear: number;

    /**
     * Whether this is the default payment method
     */
    isDefault: boolean;

    /**
     * Cardholder name (if available)
     */
    cardholderName?: string;

    /**
     * First 6 digits of the card (if available, mainly for MercadoPago)
     */
    firstSixDigits?: string;

    /**
     * Card creation timestamp
     */
    createdAt: Date;
}

/**
 * Unified interface for saved card operations
 */
export interface SavedCardService {
    /**
     * Save a payment method (card) to a customer
     *
     * @param input - Card save input
     * @returns The saved card details
     *
     * @throws {Error} If customerId is invalid
     * @throws {Error} If paymentMethodId/token is missing
     * @throws {Error} If provider operation fails
     *
     * @example
     * ```typescript
     * // Stripe example
     * const card = await cardService.save({
     *   customerId: 'local_cus_123',
     *   paymentMethodId: 'pm_xxx', // From Stripe.js
     *   setAsDefault: true,
     * });
     *
     * // MercadoPago example
     * const card = await cardService.save({
     *   customerId: 'local_cus_123',
     *   token: 'card_token_xxx', // From MercadoPago.js
     *   setAsDefault: true,
     * });
     * ```
     */
    save(input: SaveCardInput): Promise<SavedCard>;

    /**
     * List all saved cards for a customer
     *
     * @param customerId - Local customer ID
     * @returns Array of saved cards
     *
     * @throws {Error} If customerId is invalid
     * @throws {Error} If provider operation fails
     *
     * @example
     * ```typescript
     * const cards = await cardService.list('local_cus_123');
     * console.log(`Customer has ${cards.length} saved cards`);
     * ```
     */
    list(customerId: string): Promise<SavedCard[]>;

    /**
     * Remove a saved card from a customer
     *
     * @param customerId - Local customer ID
     * @param cardId - Card ID (PaymentMethod ID or Card ID)
     *
     * @throws {Error} If customerId is invalid
     * @throws {Error} If cardId is invalid
     * @throws {Error} If provider operation fails
     *
     * @example
     * ```typescript
     * await cardService.remove('local_cus_123', 'pm_xxx');
     * ```
     */
    remove(customerId: string, cardId: string): Promise<void>;

    /**
     * Set a card as the default payment method
     *
     * @param customerId - Local customer ID
     * @param cardId - Card ID (PaymentMethod ID or Card ID)
     *
     * @throws {Error} If customerId is invalid
     * @throws {Error} If cardId is invalid
     * @throws {Error} If provider operation fails
     *
     * @example
     * ```typescript
     * await cardService.setDefault('local_cus_123', 'pm_xxx');
     * ```
     */
    setDefault(customerId: string, cardId: string): Promise<void>;
}

/**
 * Configuration for Stripe saved card service
 */
export interface SavedCardServiceStripeConfig {
    provider: 'stripe';

    /**
     * Stripe secret key (sk_test_xxx or sk_live_xxx)
     */
    stripeSecretKey: string;

    /**
     * Function to resolve local customer ID to Stripe customer ID
     *
     * @example
     * ```typescript
     * getProviderCustomerId: async (customerId) => {
     *   const customer = await db.customers.findById(customerId);
     *   return customer.stripeCustomerId;
     * }
     * ```
     */
    getProviderCustomerId: (customerId: string) => Promise<string>;
}

/**
 * Configuration for MercadoPago saved card service
 */
export interface SavedCardServiceMercadoPagoConfig {
    provider: 'mercadopago';

    /**
     * MercadoPago access token
     */
    mercadopagoAccessToken: string;

    /**
     * Function to resolve local customer ID to MercadoPago customer ID
     *
     * @example
     * ```typescript
     * getProviderCustomerId: async (customerId) => {
     *   const customer = await db.customers.findById(customerId);
     *   return customer.mercadopagoCustomerId;
     * }
     * ```
     */
    getProviderCustomerId: (customerId: string) => Promise<string>;
}

/**
 * Union type for saved card service configuration
 */
export type SavedCardServiceConfig = SavedCardServiceStripeConfig | SavedCardServiceMercadoPagoConfig;

/**
 * Factory function to create a saved card service
 *
 * This is a generic interface. Actual implementations are provided by
 * provider-specific packages (@qazuor/qzpay-stripe, @qazuor/qzpay-mercadopago).
 *
 * @param config - Configuration for the saved card service
 * @returns SavedCardService instance
 *
 * @example
 * ```typescript
 * // Import from provider package
 * import { createSavedCardService } from '@qazuor/qzpay-stripe';
 *
 * const cardService = createSavedCardService({
 *   provider: 'stripe',
 *   stripeSecretKey: 'sk_xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     const customer = await db.customers.findById(customerId);
 *     return customer.stripeCustomerId;
 *   },
 * });
 * ```
 */
export function createSavedCardService(config: SavedCardServiceConfig): SavedCardService {
    throw new Error(`createSavedCardService must be imported from a provider package like @qazuor/qzpay-${config.provider}`);
}
