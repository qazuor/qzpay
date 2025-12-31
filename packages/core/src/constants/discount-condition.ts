/**
 * Discount condition constants
 */
export const QZPAY_DISCOUNT_CONDITION = {
    FIRST_PURCHASE: 'first_purchase',
    MIN_AMOUNT: 'min_amount',
    MIN_QUANTITY: 'min_quantity',
    SPECIFIC_PLANS: 'specific_plans',
    SPECIFIC_PRODUCTS: 'specific_products',
    DATE_RANGE: 'date_range',
    CUSTOMER_TAG: 'customer_tag'
} as const;

export type QZPayDiscountCondition = (typeof QZPAY_DISCOUNT_CONDITION)[keyof typeof QZPAY_DISCOUNT_CONDITION];

export const QZPAY_DISCOUNT_CONDITION_VALUES = Object.values(QZPAY_DISCOUNT_CONDITION) as readonly QZPayDiscountCondition[];
