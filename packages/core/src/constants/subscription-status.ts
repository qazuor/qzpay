/**
 * Subscription status constants
 */
export const QZPAY_SUBSCRIPTION_STATUS = {
    ACTIVE: 'active',
    TRIALING: 'trialing',
    PAST_DUE: 'past_due',
    PAUSED: 'paused',
    CANCELED: 'canceled',
    UNPAID: 'unpaid',
    INCOMPLETE: 'incomplete',
    INCOMPLETE_EXPIRED: 'incomplete_expired'
} as const;

export type QZPaySubscriptionStatus = (typeof QZPAY_SUBSCRIPTION_STATUS)[keyof typeof QZPAY_SUBSCRIPTION_STATUS];

export const QZPAY_SUBSCRIPTION_STATUS_VALUES = Object.values(QZPAY_SUBSCRIPTION_STATUS) as readonly QZPaySubscriptionStatus[];
