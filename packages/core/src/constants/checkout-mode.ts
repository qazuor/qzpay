/**
 * Checkout mode constants
 */
export const QZPAY_CHECKOUT_MODE = {
    PAYMENT: 'payment',
    SUBSCRIPTION: 'subscription',
    SETUP: 'setup'
} as const;

export type QZPayCheckoutMode = (typeof QZPAY_CHECKOUT_MODE)[keyof typeof QZPAY_CHECKOUT_MODE];

export const QZPAY_CHECKOUT_MODE_VALUES = Object.values(QZPAY_CHECKOUT_MODE) as readonly QZPayCheckoutMode[];
