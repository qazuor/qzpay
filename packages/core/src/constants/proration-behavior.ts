/**
 * Proration behavior constants
 */
export const QZPAY_PRORATION_BEHAVIOR = {
    CREATE_PRORATIONS: 'create_prorations',
    NONE: 'none',
    ALWAYS_INVOICE: 'always_invoice'
} as const;

export type QZPayProrationBehavior = (typeof QZPAY_PRORATION_BEHAVIOR)[keyof typeof QZPAY_PRORATION_BEHAVIOR];

export const QZPAY_PRORATION_BEHAVIOR_VALUES = Object.values(QZPAY_PRORATION_BEHAVIOR) as readonly QZPayProrationBehavior[];
