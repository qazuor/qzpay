/**
 * Payment status constants
 */
export const QZPAY_PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    CANCELED: 'canceled',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    DISPUTED: 'disputed'
} as const;

export type QZPayPaymentStatus = (typeof QZPAY_PAYMENT_STATUS)[keyof typeof QZPAY_PAYMENT_STATUS];

export const QZPAY_PAYMENT_STATUS_VALUES = Object.values(QZPAY_PAYMENT_STATUS) as readonly QZPayPaymentStatus[];
