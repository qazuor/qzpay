/**
 * Cancel at constants
 */
export const QZPAY_CANCEL_AT = {
    IMMEDIATELY: 'immediately',
    PERIOD_END: 'period_end'
} as const;

export type QZPayCancelAt = (typeof QZPAY_CANCEL_AT)[keyof typeof QZPAY_CANCEL_AT];

export const QZPAY_CANCEL_AT_VALUES = Object.values(QZPAY_CANCEL_AT) as readonly QZPayCancelAt[];
