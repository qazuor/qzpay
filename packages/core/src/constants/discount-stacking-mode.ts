/**
 * Discount stacking mode constants
 */
export const QZPAY_DISCOUNT_STACKING_MODE = {
    NONE: 'none',
    ADDITIVE: 'additive',
    MULTIPLICATIVE: 'multiplicative',
    BEST: 'best'
} as const;

export type QZPayDiscountStackingMode = (typeof QZPAY_DISCOUNT_STACKING_MODE)[keyof typeof QZPAY_DISCOUNT_STACKING_MODE];

export const QZPAY_DISCOUNT_STACKING_MODE_VALUES = Object.values(QZPAY_DISCOUNT_STACKING_MODE) as readonly QZPayDiscountStackingMode[];
