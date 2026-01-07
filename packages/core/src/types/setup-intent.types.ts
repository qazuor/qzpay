/**
 * Setup Intent types for QZPay
 *
 * Setup Intents allow you to save payment method details for future use
 * without charging the customer immediately. This is useful for:
 * - Free trials with card collection
 * - Saving cards for future purchases
 * - Off-session payments
 */

/**
 * Setup Intent status
 */
export type QZPaySetupIntentStatus =
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'canceled';

/**
 * Setup Intent usage type
 * - on_session: Payment method will be used while customer is present
 * - off_session: Payment method can be used for future charges without customer present
 */
export type QZPaySetupIntentUsage = 'on_session' | 'off_session';

/**
 * Setup Intent entity
 */
export interface QZPaySetupIntent {
    /** Unique identifier */
    id: string;

    /** Customer this setup intent is for */
    customerId: string;

    /** Current status of the setup intent */
    status: QZPaySetupIntentStatus;

    /** Payment method ID once attached */
    paymentMethodId: string | null;

    /** Client secret for frontend confirmation */
    clientSecret: string;

    /** Intended usage of the payment method */
    usage: QZPaySetupIntentUsage;

    /** Provider-specific IDs */
    providerSetupIntentIds: Record<string, string>;

    /** Additional metadata */
    metadata: Record<string, string>;

    /** When the setup intent was created */
    createdAt: Date;

    /** When the setup intent was last updated */
    updatedAt: Date;
}

/**
 * Input for creating a setup intent
 */
export interface QZPayCreateSetupIntentInput {
    /** Customer ID to create setup intent for */
    customerId: string;

    /** Payment method types to accept (e.g., ['card']) */
    paymentMethodTypes?: string[];

    /** Intended usage of the payment method */
    usage?: QZPaySetupIntentUsage;

    /** Optional metadata */
    metadata?: Record<string, string>;

    /** Description shown to customer */
    description?: string;

    /** Return URL for redirect-based payment methods */
    returnUrl?: string;
}

/**
 * Input for confirming a setup intent
 */
export interface QZPayConfirmSetupIntentInput {
    /** Setup intent ID to confirm */
    setupIntentId: string;

    /** Payment method ID to use for confirmation */
    paymentMethodId?: string;

    /** Return URL for redirect-based confirmation */
    returnUrl?: string;
}

/**
 * Provider-specific setup intent response
 */
export interface QZPayProviderSetupIntent {
    /** Provider's setup intent ID */
    id: string;

    /** Client secret for frontend */
    clientSecret: string;

    /** Status in provider's format */
    status: string;

    /** Payment method ID if attached */
    paymentMethodId: string | null;

    /** Full provider response for debugging */
    raw: unknown;
}

/**
 * Setup Intent adapter interface
 *
 * To be implemented by payment provider adapters that support setup intents.
 */
export interface QZPaySetupIntentAdapter {
    /**
     * Create a new setup intent
     */
    create(input: QZPayCreateSetupIntentInput): Promise<QZPayProviderSetupIntent>;

    /**
     * Retrieve an existing setup intent
     */
    retrieve(setupIntentId: string): Promise<QZPayProviderSetupIntent>;

    /**
     * Confirm a setup intent
     */
    confirm(input: QZPayConfirmSetupIntentInput): Promise<QZPayProviderSetupIntent>;

    /**
     * Cancel a setup intent
     */
    cancel(setupIntentId: string): Promise<void>;

    /**
     * Update a setup intent
     */
    update(
        setupIntentId: string,
        updates: Partial<Pick<QZPayCreateSetupIntentInput, 'metadata' | 'description'>>
    ): Promise<QZPayProviderSetupIntent>;
}
