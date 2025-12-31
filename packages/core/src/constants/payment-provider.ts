/**
 * Payment provider constants
 */
export const QZPAY_PAYMENT_PROVIDER = {
    STRIPE: 'stripe',
    MERCADOPAGO: 'mercadopago'
} as const;

export type QZPayPaymentProvider = (typeof QZPAY_PAYMENT_PROVIDER)[keyof typeof QZPAY_PAYMENT_PROVIDER];

export const QZPAY_PAYMENT_PROVIDER_VALUES = Object.values(QZPAY_PAYMENT_PROVIDER) as readonly QZPayPaymentProvider[];
