/**
 * Discount type constants
 */
export const QZPAY_DISCOUNT_TYPE = {
    PERCENTAGE: 'percentage',
    FIXED_AMOUNT: 'fixed_amount',
    FREE_TRIAL: 'free_trial'
} as const;

export type QZPayDiscountType = (typeof QZPAY_DISCOUNT_TYPE)[keyof typeof QZPAY_DISCOUNT_TYPE];

export const QZPAY_DISCOUNT_TYPE_VALUES = Object.values(QZPAY_DISCOUNT_TYPE) as readonly QZPayDiscountType[];
