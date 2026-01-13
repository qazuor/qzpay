/**
 * Customer types for QZPay
 */

/**
 * Saved payment method (card) for a customer
 */
export interface QZPaySavedCard {
    id: string;
    provider: string;
    lastFourDigits: string;
    firstSixDigits?: string;
    expirationMonth: number;
    expirationYear: number;
    cardholderName?: string;
    paymentMethodId?: string;
    paymentMethodName?: string;
    paymentMethodThumbnail?: string;
    isDefault?: boolean;
    createdAt: Date;
}

export interface QZPayCustomer {
    id: string;
    externalId: string;
    email: string;
    name: string | null;
    phone: string | null;
    providerCustomerIds: Record<string, string>;
    savedCards?: QZPaySavedCard[];
    metadata: Record<string, unknown>;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayCreateCustomerInput {
    externalId: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
}

export interface QZPayUpdateCustomerInput {
    email?: string;
    name?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
    providerCustomerIds?: Record<string, string>;
    savedCards?: QZPaySavedCard[];
}

/**
 * Input for saving a card from a token
 */
export interface QZPaySaveCardInput {
    provider: string;
    token: string;
}
