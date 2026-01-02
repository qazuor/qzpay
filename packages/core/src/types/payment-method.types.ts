/**
 * Payment Method types for QZPay
 */

/**
 * Payment method type
 */
export type QZPayPaymentMethodType = 'card' | 'bank_account' | 'sepa_debit' | 'ideal' | 'other';

/**
 * Card brand
 */
export type QZPayCardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown';

/**
 * Payment method status
 */
export type QZPayPaymentMethodStatus = 'active' | 'expired' | 'invalid';

/**
 * Card details (safe, non-sensitive)
 */
export interface QZPayCardDetails {
    brand: QZPayCardBrand;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: 'credit' | 'debit' | 'prepaid' | 'unknown';
    country: string | null;
}

/**
 * Bank account details (safe, non-sensitive)
 */
export interface QZPayBankAccountDetails {
    bankName: string | null;
    last4: string;
    accountType: 'checking' | 'savings';
    country: string | null;
}

/**
 * Billing details
 */
export interface QZPayBillingDetails {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: QZPayBillingAddress | null;
}

/**
 * Billing address
 */
export interface QZPayBillingAddress {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
}

/**
 * Payment method
 */
export interface QZPayPaymentMethod {
    id: string;
    customerId: string;
    type: QZPayPaymentMethodType;
    status: QZPayPaymentMethodStatus;
    isDefault: boolean;
    card: QZPayCardDetails | null;
    bankAccount: QZPayBankAccountDetails | null;
    billingDetails: QZPayBillingDetails | null;
    providerPaymentMethodIds: Record<string, string>;
    metadata: Record<string, unknown>;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Input for creating a payment method
 */
export interface QZPayCreatePaymentMethodInput {
    customerId: string;
    type: QZPayPaymentMethodType;
    providerPaymentMethodId: string;
    provider: string;
    setAsDefault?: boolean;
    billingDetails?: Partial<QZPayBillingDetails>;
    metadata?: Record<string, unknown>;
}

/**
 * Input for updating a payment method
 */
export interface QZPayUpdatePaymentMethodInput {
    billingDetails?: Partial<QZPayBillingDetails>;
    metadata?: Record<string, unknown>;
}

/**
 * Payment method expiration check result
 */
export interface QZPayPaymentMethodExpirationCheck {
    isExpired: boolean;
    isExpiringSoon: boolean;
    daysUntilExpiration: number | null;
    expirationDate: Date | null;
}
