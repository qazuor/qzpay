/**
 * Billing interval constants
 */
export const QZPAY_BILLING_INTERVAL = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year'
} as const;

export type QZPayBillingInterval = (typeof QZPAY_BILLING_INTERVAL)[keyof typeof QZPAY_BILLING_INTERVAL];

export const QZPAY_BILLING_INTERVAL_VALUES = Object.values(QZPAY_BILLING_INTERVAL) as readonly QZPayBillingInterval[];
