/**
 * Tests for discount service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayAutomaticDiscount, QZPayDiscountContext, QZPayPromoCode, QZPayVolumePricing } from '../src/index.js';
import {
    qzpayApplyAutomaticDiscounts,
    qzpayApplyPromoCode,
    qzpayCalculateDiscountAmount,
    qzpayCalculateDiscounts,
    qzpayCalculateTieredPricing,
    qzpayCalculateTierUnitPrice,
    qzpayCalculateVolumeDiscount,
    qzpayCombineDiscounts,
    qzpayEvaluateAutomaticDiscounts,
    qzpayEvaluateConditions,
    qzpayEvaluateSingleCondition,
    qzpayFindVolumeTier,
    qzpayFormatDiscount,
    qzpayGetConditionValueType,
    qzpayGetDiscountDescription,
    qzpayGetRemainingRedemptions,
    qzpayGetVolumePricingBreakdown,
    qzpayPromoCodeIsExhausted,
    qzpayPromoCodeIsExpired,
    qzpayValidatePromoCode
} from '../src/index.js';

// ==================== Test Fixtures ====================

function createPromoCode(overrides: Partial<QZPayPromoCode> = {}): QZPayPromoCode {
    return {
        id: 'promo_123',
        code: 'SAVE20',
        discountType: 'percentage',
        discountValue: 20,
        currency: null,
        stackingMode: 'none',
        conditions: [],
        maxRedemptions: null,
        currentRedemptions: 0,
        maxRedemptionsPerCustomer: null,
        validFrom: null,
        validUntil: null,
        applicablePlanIds: [],
        applicableProductIds: [],
        active: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function createContext(overrides: Partial<QZPayDiscountContext> = {}): QZPayDiscountContext {
    return {
        subtotal: 10000, // $100.00
        currency: 'usd',
        ...overrides
    };
}

function createAutomaticDiscount(overrides: Partial<QZPayAutomaticDiscount> = {}): QZPayAutomaticDiscount {
    return {
        id: 'auto_123',
        name: 'First Purchase Discount',
        discountType: 'percentage',
        discountValue: 10,
        conditions: [],
        priority: 1,
        stackingMode: 'none',
        active: true,
        ...overrides
    };
}

// ==================== Validation Tests ====================

describe('Promo Code Validation', () => {
    describe('qzpayValidatePromoCode', () => {
        it('should validate an active promo code', () => {
            const promoCode = createPromoCode();
            const context = createContext();

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(true);
            expect(result.promoCode).toBeDefined();
        });

        it('should reject inactive promo code', () => {
            const promoCode = createPromoCode({ active: false });
            const context = createContext();

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is not active');
        });

        it('should reject expired promo code', () => {
            const promoCode = createPromoCode({
                validUntil: new Date('2020-01-01')
            });
            const context = createContext();

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code has expired');
        });

        it('should reject promo code not yet valid', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const promoCode = createPromoCode({
                validFrom: futureDate
            });
            const context = createContext();

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is not yet valid');
        });

        it('should reject exhausted promo code', () => {
            const promoCode = createPromoCode({
                maxRedemptions: 100,
                currentRedemptions: 100
            });
            const context = createContext();

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code has reached maximum redemptions');
        });

        it('should reject fixed amount promo with wrong currency', () => {
            const promoCode = createPromoCode({
                discountType: 'fixed_amount',
                discountValue: 1000,
                currency: 'eur'
            });
            const context = createContext({ currency: 'usd' });

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is only valid for eur currency');
        });

        it('should reject promo code for non-applicable plan', () => {
            const promoCode = createPromoCode({
                applicablePlanIds: ['plan_pro']
            });
            const context = createContext({ planId: 'plan_basic' });

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is not valid for this plan');
        });

        it('should accept promo code for applicable plan', () => {
            const promoCode = createPromoCode({
                applicablePlanIds: ['plan_pro', 'plan_enterprise']
            });
            const context = createContext({ planId: 'plan_pro' });

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(true);
        });

        it('should reject promo code for non-applicable products', () => {
            const promoCode = createPromoCode({
                applicableProductIds: ['prod_a', 'prod_b']
            });
            const context = createContext({ productIds: ['prod_c'] });

            const result = qzpayValidatePromoCode(promoCode, context);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Promo code is not valid for these products');
        });
    });

    describe('qzpayEvaluateConditions', () => {
        it('should pass with no conditions', () => {
            const result = qzpayEvaluateConditions([], createContext());
            expect(result.valid).toBe(true);
        });

        it('should evaluate first_purchase condition', () => {
            const conditions = [{ type: 'first_purchase' as const, value: true }];

            const newCustomer = qzpayEvaluateConditions(conditions, createContext({ isNewCustomer: true }));
            expect(newCustomer.valid).toBe(true);

            const existingCustomer = qzpayEvaluateConditions(conditions, createContext({ isNewCustomer: false }));
            expect(existingCustomer.valid).toBe(false);
        });

        it('should evaluate min_amount condition', () => {
            const conditions = [{ type: 'min_amount' as const, value: 5000 }];

            const sufficient = qzpayEvaluateConditions(conditions, createContext({ subtotal: 6000 }));
            expect(sufficient.valid).toBe(true);

            const insufficient = qzpayEvaluateConditions(conditions, createContext({ subtotal: 3000 }));
            expect(insufficient.valid).toBe(false);
            expect(insufficient.error).toContain('Minimum purchase amount');
        });

        it('should evaluate min_quantity condition', () => {
            const conditions = [{ type: 'min_quantity' as const, value: 3 }];

            const sufficient = qzpayEvaluateConditions(conditions, createContext({ quantity: 5 }));
            expect(sufficient.valid).toBe(true);

            const insufficient = qzpayEvaluateConditions(conditions, createContext({ quantity: 2 }));
            expect(insufficient.valid).toBe(false);
        });

        it('should evaluate specific_plans condition', () => {
            const conditions = [{ type: 'specific_plans' as const, value: ['plan_pro', 'plan_enterprise'] }];

            const validPlan = qzpayEvaluateConditions(conditions, createContext({ planId: 'plan_pro' }));
            expect(validPlan.valid).toBe(true);

            const invalidPlan = qzpayEvaluateConditions(conditions, createContext({ planId: 'plan_basic' }));
            expect(invalidPlan.valid).toBe(false);
        });

        it('should evaluate customer_tag condition', () => {
            const conditions = [{ type: 'customer_tag' as const, value: 'vip' }];

            const hasTag = qzpayEvaluateConditions(conditions, createContext({ customerTags: ['vip', 'early_adopter'] }));
            expect(hasTag.valid).toBe(true);

            const noTag = qzpayEvaluateConditions(conditions, createContext({ customerTags: ['regular'] }));
            expect(noTag.valid).toBe(false);
        });

        it('should evaluate date_range condition', () => {
            const now = new Date();
            const pastDate = new Date(now.getTime() - 86400000);
            const futureDate = new Date(now.getTime() + 86400000);

            const validRange = [
                {
                    type: 'date_range' as const,
                    value: { start: pastDate.toISOString(), end: futureDate.toISOString() }
                }
            ];

            const result = qzpayEvaluateConditions(validRange, createContext({ currentDate: now }));
            expect(result.valid).toBe(true);

            const expiredRange = [{ type: 'date_range' as const, value: { end: pastDate.toISOString() } }];

            const expired = qzpayEvaluateConditions(expiredRange, createContext({ currentDate: now }));
            expect(expired.valid).toBe(false);
        });
    });

    describe('qzpayEvaluateSingleCondition', () => {
        it('should return valid for unknown condition types', () => {
            const result = qzpayEvaluateSingleCondition({ type: 'unknown' as 'first_purchase', value: null }, createContext());
            expect(result.valid).toBe(true);
        });
    });

    describe('qzpayPromoCodeIsExpired', () => {
        it('should return false for no expiration', () => {
            const promoCode = createPromoCode({ validUntil: null });
            expect(qzpayPromoCodeIsExpired(promoCode)).toBe(false);
        });

        it('should return true for past expiration', () => {
            const promoCode = createPromoCode({ validUntil: new Date('2020-01-01') });
            expect(qzpayPromoCodeIsExpired(promoCode)).toBe(true);
        });

        it('should return false for future expiration', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const promoCode = createPromoCode({ validUntil: futureDate });
            expect(qzpayPromoCodeIsExpired(promoCode)).toBe(false);
        });
    });

    describe('qzpayPromoCodeIsExhausted', () => {
        it('should return false for unlimited redemptions', () => {
            const promoCode = createPromoCode({ maxRedemptions: null });
            expect(qzpayPromoCodeIsExhausted(promoCode)).toBe(false);
        });

        it('should return true when max reached', () => {
            const promoCode = createPromoCode({ maxRedemptions: 100, currentRedemptions: 100 });
            expect(qzpayPromoCodeIsExhausted(promoCode)).toBe(true);
        });

        it('should return false when under limit', () => {
            const promoCode = createPromoCode({ maxRedemptions: 100, currentRedemptions: 50 });
            expect(qzpayPromoCodeIsExhausted(promoCode)).toBe(false);
        });
    });

    describe('qzpayGetRemainingRedemptions', () => {
        it('should return null for unlimited', () => {
            const promoCode = createPromoCode({ maxRedemptions: null });
            expect(qzpayGetRemainingRedemptions(promoCode)).toBeNull();
        });

        it('should return remaining count', () => {
            const promoCode = createPromoCode({ maxRedemptions: 100, currentRedemptions: 60 });
            expect(qzpayGetRemainingRedemptions(promoCode)).toBe(40);
        });

        it('should return 0 when exhausted', () => {
            const promoCode = createPromoCode({ maxRedemptions: 100, currentRedemptions: 150 });
            expect(qzpayGetRemainingRedemptions(promoCode)).toBe(0);
        });
    });
});

// ==================== Calculation Tests ====================

describe('Discount Calculations', () => {
    describe('qzpayCalculateDiscountAmount', () => {
        it('should calculate percentage discount', () => {
            expect(qzpayCalculateDiscountAmount('percentage', 20, 10000)).toBe(2000);
            expect(qzpayCalculateDiscountAmount('percentage', 50, 10000)).toBe(5000);
            expect(qzpayCalculateDiscountAmount('percentage', 100, 10000)).toBe(10000);
        });

        it('should cap percentage at 100%', () => {
            expect(qzpayCalculateDiscountAmount('percentage', 150, 10000)).toBe(10000);
        });

        it('should handle negative percentage as 0', () => {
            expect(qzpayCalculateDiscountAmount('percentage', -10, 10000)).toBe(0);
        });

        it('should calculate fixed amount discount', () => {
            expect(qzpayCalculateDiscountAmount('fixed_amount', 2500, 10000)).toBe(2500);
        });

        it('should cap fixed amount at total', () => {
            expect(qzpayCalculateDiscountAmount('fixed_amount', 15000, 10000)).toBe(10000);
        });

        it('should handle free trial as 100% off', () => {
            expect(qzpayCalculateDiscountAmount('free_trial', 0, 10000)).toBe(10000);
        });

        it('should return 0 for unknown type', () => {
            expect(qzpayCalculateDiscountAmount('unknown' as 'percentage', 20, 10000)).toBe(0);
        });
    });

    describe('qzpayApplyPromoCode', () => {
        it('should apply percentage promo code', () => {
            const promoCode = createPromoCode({ discountValue: 25 });
            const result = qzpayApplyPromoCode(promoCode, 10000);

            expect(result.promoCodeId).toBe('promo_123');
            expect(result.code).toBe('SAVE20');
            expect(result.discountType).toBe('percentage');
            expect(result.discountValue).toBe(25);
            expect(result.discountAmount).toBe(2500);
        });

        it('should apply fixed amount promo code', () => {
            const promoCode = createPromoCode({
                discountType: 'fixed_amount',
                discountValue: 1500
            });
            const result = qzpayApplyPromoCode(promoCode, 10000);

            expect(result.discountAmount).toBe(1500);
        });
    });

    describe('qzpayCalculateDiscounts', () => {
        it('should return no discount for empty promo codes', () => {
            const result = qzpayCalculateDiscounts(10000, [], createContext());

            expect(result.originalAmount).toBe(10000);
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(10000);
            expect(result.appliedDiscounts).toHaveLength(0);
        });

        it('should apply single promo code', () => {
            const promoCode = createPromoCode({ discountValue: 20 });
            const result = qzpayCalculateDiscounts(10000, [promoCode], createContext());

            expect(result.discountAmount).toBe(2000);
            expect(result.finalAmount).toBe(8000);
            expect(result.appliedDiscounts).toHaveLength(1);
        });

        it('should skip invalid promo codes', () => {
            const validPromo = createPromoCode({ id: 'valid', discountValue: 20 });
            const invalidPromo = createPromoCode({
                id: 'invalid',
                active: false,
                discountValue: 50
            });

            const result = qzpayCalculateDiscounts(10000, [validPromo, invalidPromo], createContext());

            expect(result.appliedDiscounts).toHaveLength(1);
            expect(result.skippedDiscounts).toHaveLength(1);
            expect(result.skippedDiscounts[0].code).toBe('SAVE20');
        });

        it('should apply best stacking mode correctly', () => {
            const promo10 = createPromoCode({ id: 'p10', code: 'SAVE10', discountValue: 10 });
            const promo30 = createPromoCode({ id: 'p30', code: 'SAVE30', discountValue: 30 });
            const promo20 = createPromoCode({ id: 'p20', code: 'SAVE20', discountValue: 20 });

            const result = qzpayCalculateDiscounts(10000, [promo10, promo30, promo20], createContext(), 'best');

            expect(result.discountAmount).toBe(3000);
            expect(result.appliedDiscounts).toHaveLength(1);
            expect(result.appliedDiscounts[0].code).toBe('SAVE30');
        });

        it('should apply none stacking mode (first only)', () => {
            const promo1 = createPromoCode({ id: 'p1', code: 'FIRST', discountValue: 10 });
            const promo2 = createPromoCode({ id: 'p2', code: 'SECOND', discountValue: 30 });

            const result = qzpayCalculateDiscounts(10000, [promo1, promo2], createContext(), 'none');

            expect(result.discountAmount).toBe(1000);
            expect(result.appliedDiscounts).toHaveLength(1);
            expect(result.appliedDiscounts[0].code).toBe('FIRST');
            expect(result.skippedDiscounts).toHaveLength(1);
        });

        it('should apply additive stacking mode', () => {
            const promo1 = createPromoCode({ id: 'p1', code: 'FIRST', discountValue: 10, stackingMode: 'additive' });
            const promo2 = createPromoCode({ id: 'p2', code: 'SECOND', discountValue: 20, stackingMode: 'additive' });

            const result = qzpayCalculateDiscounts(10000, [promo1, promo2], createContext(), 'additive');

            expect(result.discountAmount).toBe(3000); // 10% + 20% = 30%
            expect(result.appliedDiscounts).toHaveLength(2);
        });

        it('should cap additive discounts at original amount', () => {
            const promo1 = createPromoCode({ id: 'p1', discountValue: 60, stackingMode: 'additive' });
            const promo2 = createPromoCode({ id: 'p2', discountValue: 60, stackingMode: 'additive' });

            const result = qzpayCalculateDiscounts(10000, [promo1, promo2], createContext(), 'additive');

            expect(result.discountAmount).toBe(10000); // Capped
            expect(result.finalAmount).toBe(0);
        });

        it('should apply multiplicative stacking mode', () => {
            const promo1 = createPromoCode({ id: 'p1', discountValue: 20, stackingMode: 'multiplicative' });
            const promo2 = createPromoCode({ id: 'p2', discountValue: 10, stackingMode: 'multiplicative' });

            const result = qzpayCalculateDiscounts(10000, [promo1, promo2], createContext(), 'multiplicative');

            // First: 10000 - 20% = 8000
            // Second: 8000 - 10% = 7200
            // Total discount: 2800
            expect(result.discountAmount).toBe(2800);
            expect(result.appliedDiscounts).toHaveLength(2);
        });
    });
});

// ==================== Automatic Discount Tests ====================

describe('Automatic Discounts', () => {
    describe('qzpayEvaluateAutomaticDiscounts', () => {
        it('should return empty for no discounts', () => {
            const result = qzpayEvaluateAutomaticDiscounts([], createContext());
            expect(result).toHaveLength(0);
        });

        it('should filter inactive discounts', () => {
            const discounts = [createAutomaticDiscount({ active: false })];

            const result = qzpayEvaluateAutomaticDiscounts(discounts, createContext());

            expect(result).toHaveLength(0);
        });

        it('should filter by validity period', () => {
            const pastDate = new Date('2020-01-01');
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const discounts = [
                createAutomaticDiscount({ id: 'expired', validUntil: pastDate }),
                createAutomaticDiscount({ id: 'future', validFrom: futureDate }),
                createAutomaticDiscount({ id: 'valid' })
            ];

            const result = qzpayEvaluateAutomaticDiscounts(discounts, createContext());

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('valid');
        });

        it('should filter by conditions', () => {
            const discounts = [
                createAutomaticDiscount({
                    id: 'new_only',
                    conditions: [{ type: 'first_purchase', value: true }]
                }),
                createAutomaticDiscount({ id: 'everyone' })
            ];

            const newCustomerResult = qzpayEvaluateAutomaticDiscounts(discounts, createContext({ isNewCustomer: true }));

            expect(newCustomerResult).toHaveLength(2);

            const existingCustomerResult = qzpayEvaluateAutomaticDiscounts(discounts, createContext({ isNewCustomer: false }));

            expect(existingCustomerResult).toHaveLength(1);
            expect(existingCustomerResult[0].id).toBe('everyone');
        });

        it('should sort by priority descending', () => {
            const discounts = [
                createAutomaticDiscount({ id: 'low', priority: 1 }),
                createAutomaticDiscount({ id: 'high', priority: 10 }),
                createAutomaticDiscount({ id: 'medium', priority: 5 })
            ];

            const result = qzpayEvaluateAutomaticDiscounts(discounts, createContext());

            expect(result.map((d) => d.id)).toEqual(['high', 'medium', 'low']);
        });
    });

    describe('qzpayApplyAutomaticDiscounts', () => {
        it('should apply best automatic discount', () => {
            const discounts = [
                createAutomaticDiscount({ id: 'small', discountValue: 5 }),
                createAutomaticDiscount({ id: 'large', discountValue: 15 })
            ];

            const result = qzpayApplyAutomaticDiscounts(discounts, 10000, createContext());

            expect(result.discountAmount).toBe(1500);
        });

        it('should return no discount when no applicable', () => {
            const discounts = [
                createAutomaticDiscount({
                    conditions: [{ type: 'first_purchase', value: true }]
                })
            ];

            const result = qzpayApplyAutomaticDiscounts(discounts, 10000, createContext({ isNewCustomer: false }));

            expect(result.discountAmount).toBe(0);
        });
    });
});

// ==================== Volume/Tiered Pricing Tests ====================

describe('Volume Pricing', () => {
    const volumePricing: QZPayVolumePricing = {
        tiers: [
            { minQuantity: 1, maxQuantity: 9, discountType: 'percentage', discountValue: 0 },
            { minQuantity: 10, maxQuantity: 49, discountType: 'percentage', discountValue: 10 },
            { minQuantity: 50, maxQuantity: 99, discountType: 'percentage', discountValue: 15 },
            { minQuantity: 100, discountType: 'percentage', discountValue: 25 }
        ],
        stackable: false
    };

    describe('qzpayFindVolumeTier', () => {
        it('should find correct tier for quantity', () => {
            expect(qzpayFindVolumeTier(volumePricing, 1)?.discountValue).toBe(0);
            expect(qzpayFindVolumeTier(volumePricing, 9)?.discountValue).toBe(0);
            expect(qzpayFindVolumeTier(volumePricing, 10)?.discountValue).toBe(10);
            expect(qzpayFindVolumeTier(volumePricing, 50)?.discountValue).toBe(15);
            expect(qzpayFindVolumeTier(volumePricing, 100)?.discountValue).toBe(25);
            expect(qzpayFindVolumeTier(volumePricing, 1000)?.discountValue).toBe(25);
        });

        it('should return null for quantity below first tier', () => {
            const pricing: QZPayVolumePricing = {
                tiers: [{ minQuantity: 10, discountType: 'percentage', discountValue: 10 }],
                stackable: false
            };

            expect(qzpayFindVolumeTier(pricing, 5)).toBeNull();
        });
    });

    describe('qzpayCalculateVolumeDiscount', () => {
        it('should calculate volume discount correctly', () => {
            const unitPrice = 1000; // $10.00

            // 5 items, no discount tier
            const result5 = qzpayCalculateVolumeDiscount(volumePricing, 5, unitPrice);
            expect(result5.discountAmount).toBe(0);

            // 25 items, 10% discount
            const result25 = qzpayCalculateVolumeDiscount(volumePricing, 25, unitPrice);
            expect(result25.discountAmount).toBe(2500); // 10% of $250

            // 75 items, 15% discount
            const result75 = qzpayCalculateVolumeDiscount(volumePricing, 75, unitPrice);
            expect(result75.discountAmount).toBe(11250); // 15% of $750
        });

        it('should return tier info', () => {
            const result = qzpayCalculateVolumeDiscount(volumePricing, 50, 1000);

            expect(result.tier).not.toBeNull();
            expect(result.tier?.minQuantity).toBe(50);
            expect(result.tier?.discountValue).toBe(15);
        });
    });

    describe('qzpayCalculateTierUnitPrice', () => {
        const basePrice = 1000;

        it('should calculate percentage tier price', () => {
            const tier = { minQuantity: 10, discountType: 'percentage' as const, discountValue: 20 };
            expect(qzpayCalculateTierUnitPrice(tier, basePrice)).toBe(800);
        });

        it('should calculate fixed amount tier price', () => {
            const tier = { minQuantity: 10, discountType: 'fixed_amount' as const, discountValue: 300 };
            expect(qzpayCalculateTierUnitPrice(tier, basePrice)).toBe(700);
        });

        it('should not go below zero', () => {
            const tier = { minQuantity: 10, discountType: 'fixed_amount' as const, discountValue: 2000 };
            expect(qzpayCalculateTierUnitPrice(tier, basePrice)).toBe(0);
        });
    });

    describe('qzpayCalculateTieredPricing', () => {
        it('should calculate graduated tiered pricing', () => {
            const tiers = [
                { minQuantity: 1, maxQuantity: 10, discountType: 'percentage' as const, discountValue: 0 },
                { minQuantity: 11, maxQuantity: 20, discountType: 'percentage' as const, discountValue: 10 },
                { minQuantity: 21, discountType: 'percentage' as const, discountValue: 20 }
            ];

            // 25 items at $10 base
            // First 10: $10 each = $100
            // Next 10: $9 each = $90
            // Last 5: $8 each = $40
            // Total: $230
            const result = qzpayCalculateTieredPricing(tiers, 25, 1000);
            expect(result).toBe(23000);
        });
    });

    describe('qzpayGetVolumePricingBreakdown', () => {
        it('should return detailed breakdown', () => {
            const pricing: QZPayVolumePricing = {
                tiers: [
                    { minQuantity: 1, maxQuantity: 10, discountType: 'percentage', discountValue: 0 },
                    { minQuantity: 11, maxQuantity: 20, discountType: 'percentage', discountValue: 10 }
                ],
                stackable: false
            };

            const breakdown = qzpayGetVolumePricingBreakdown(pricing, 15, 1000);

            expect(breakdown).toHaveLength(2);
            expect(breakdown[0].quantity).toBe(10);
            expect(breakdown[0].unitPrice).toBe(1000);
            expect(breakdown[1].quantity).toBe(5);
            expect(breakdown[1].unitPrice).toBe(900);
        });
    });
});

// ==================== Combination Tests ====================

describe('Discount Combination', () => {
    describe('qzpayCombineDiscounts', () => {
        const promoCode = createPromoCode({ discountValue: 15 });
        const autoDiscount = createAutomaticDiscount({ discountValue: 10 });

        it('should return best discount', () => {
            const result = qzpayCombineDiscounts(10000, [promoCode], [autoDiscount], createContext(), 'best');

            expect(result.discountAmount).toBe(1500);
            expect(result.appliedDiscounts).toHaveLength(1);
        });

        it('should apply promo first when specified', () => {
            const result = qzpayCombineDiscounts(10000, [promoCode], [autoDiscount], createContext(), 'promo_first');

            // Promo: 15% of 10000 = 1500
            // Auto: 10% of 8500 = 850
            expect(result.discountAmount).toBe(2350);
        });

        it('should apply auto first when specified', () => {
            const result = qzpayCombineDiscounts(10000, [promoCode], [autoDiscount], createContext(), 'auto_first');

            // Auto: 10% of 10000 = 1000
            // Promo: 15% of 9000 = 1350
            expect(result.discountAmount).toBe(2350);
        });

        it('should handle empty promo codes', () => {
            const result = qzpayCombineDiscounts(10000, [], [autoDiscount], createContext(), 'best');

            expect(result.discountAmount).toBe(1000);
        });

        it('should handle empty auto discounts', () => {
            const result = qzpayCombineDiscounts(10000, [promoCode], [], createContext(), 'best');

            expect(result.discountAmount).toBe(1500);
        });
    });
});

// ==================== Utility Tests ====================

describe('Discount Utilities', () => {
    describe('qzpayFormatDiscount', () => {
        it('should format percentage discount', () => {
            expect(qzpayFormatDiscount('percentage', 20)).toBe('20% off');
        });

        it('should format fixed amount discount', () => {
            expect(qzpayFormatDiscount('fixed_amount', 1000, 'usd')).toBe('USD 10.00 off');
            expect(qzpayFormatDiscount('fixed_amount', 1000)).toBe('10.00 off');
        });

        it('should format free trial', () => {
            expect(qzpayFormatDiscount('free_trial', 0)).toBe('Free trial');
        });
    });

    describe('qzpayGetDiscountDescription', () => {
        it('should generate description with all parts', () => {
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);

            const promoCode = createPromoCode({
                discountValue: 25,
                applicablePlanIds: ['plan_pro'],
                validUntil: futureDate
            });

            const description = qzpayGetDiscountDescription(promoCode);

            expect(description).toContain('25% off');
            expect(description).toContain('on select plans');
            expect(description).toContain('until');
        });

        it('should handle minimal promo code', () => {
            const promoCode = createPromoCode();
            const description = qzpayGetDiscountDescription(promoCode);

            expect(description).toBe('20% off');
        });
    });

    describe('qzpayGetConditionValueType', () => {
        it('should return correct type for each condition', () => {
            expect(qzpayGetConditionValueType('first_purchase')).toBe('boolean');
            expect(qzpayGetConditionValueType('min_amount')).toBe('number');
            expect(qzpayGetConditionValueType('min_quantity')).toBe('number');
            expect(qzpayGetConditionValueType('specific_plans')).toBe('array');
            expect(qzpayGetConditionValueType('specific_products')).toBe('array');
            expect(qzpayGetConditionValueType('date_range')).toBe('object');
            expect(qzpayGetConditionValueType('customer_tag')).toBe('array');
        });
    });
});
