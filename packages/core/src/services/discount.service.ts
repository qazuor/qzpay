/**
 * Discount service helpers for QZPay
 *
 * Provides utilities for promo code validation, discount calculations,
 * automatic discounts, and volume/tiered pricing.
 */
import type { QZPayCurrency, QZPayDiscountCondition, QZPayDiscountStackingMode, QZPayDiscountType } from '../constants/index.js';
import type { QZPayAppliedDiscount, QZPayPromoCode, QZPayPromoCodeCondition } from '../types/index.js';

// ==================== Types ====================

/**
 * Context for evaluating discount conditions
 */
export interface QZPayDiscountContext {
    /** Customer ID */
    customerId?: string;
    /** Whether customer is new (first purchase) */
    isNewCustomer?: boolean;
    /** Subtotal before discounts */
    subtotal: number;
    /** Currency */
    currency: QZPayCurrency;
    /** Quantity of items */
    quantity?: number;
    /** Plan ID being purchased */
    planId?: string;
    /** Product IDs being purchased */
    productIds?: string[];
    /** Customer tags */
    customerTags?: string[];
    /** Current date for validation */
    currentDate?: Date;
}

/**
 * Result of promo code validation check
 */
export interface QZPayPromoCodeCheckResult {
    valid: boolean;
    error?: string;
    promoCode?: QZPayPromoCode;
}

/**
 * Result of discount calculation
 */
export interface QZPayDiscountCalculationResult {
    /** Original amount before discount */
    originalAmount: number;
    /** Total discount amount */
    discountAmount: number;
    /** Final amount after discount */
    finalAmount: number;
    /** Applied discounts */
    appliedDiscounts: QZPayAppliedDiscount[];
    /** Discounts that were skipped (invalid, stacking rules, etc.) */
    skippedDiscounts: Array<{ code: string; reason: string }>;
}

/**
 * Automatic discount definition
 */
export interface QZPayAutomaticDiscount {
    id: string;
    name: string;
    discountType: QZPayDiscountType;
    discountValue: number;
    conditions: QZPayPromoCodeCondition[];
    priority: number;
    stackingMode: QZPayDiscountStackingMode;
    active: boolean;
    validFrom?: Date;
    validUntil?: Date;
}

/**
 * Volume tier definition
 */
export interface QZPayVolumeTier {
    minQuantity: number;
    maxQuantity?: number;
    discountType: QZPayDiscountType;
    discountValue: number;
}

/**
 * Volume pricing configuration
 */
export interface QZPayVolumePricing {
    tiers: QZPayVolumeTier[];
    stackable: boolean;
}

// ==================== Validation Helpers ====================

/**
 * Validate a promo code against its rules and context
 */
export function qzpayValidatePromoCode(promoCode: QZPayPromoCode, context: QZPayDiscountContext): QZPayPromoCodeCheckResult {
    const now = context.currentDate ?? new Date();

    // Check if active
    if (!promoCode.active) {
        return { valid: false, error: 'Promo code is not active' };
    }

    // Check validity period
    if (promoCode.validFrom && now < promoCode.validFrom) {
        return { valid: false, error: 'Promo code is not yet valid' };
    }

    if (promoCode.validUntil && now > promoCode.validUntil) {
        return { valid: false, error: 'Promo code has expired' };
    }

    // Check max redemptions
    if (promoCode.maxRedemptions !== null && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
        return { valid: false, error: 'Promo code has reached maximum redemptions' };
    }

    // Check currency match for fixed amount discounts
    if (promoCode.discountType === 'fixed_amount' && promoCode.currency !== null) {
        if (promoCode.currency !== context.currency) {
            return { valid: false, error: `Promo code is only valid for ${promoCode.currency} currency` };
        }
    }

    // Check applicable plans
    if (promoCode.applicablePlanIds.length > 0 && context.planId) {
        if (!promoCode.applicablePlanIds.includes(context.planId)) {
            return { valid: false, error: 'Promo code is not valid for this plan' };
        }
    }

    // Check applicable products
    if (promoCode.applicableProductIds.length > 0 && context.productIds) {
        const hasApplicableProduct = context.productIds.some((id) => promoCode.applicableProductIds.includes(id));
        if (!hasApplicableProduct) {
            return { valid: false, error: 'Promo code is not valid for these products' };
        }
    }

    // Check conditions
    const conditionResult = qzpayEvaluateConditions(promoCode.conditions, context);
    if (!conditionResult.valid) {
        return { valid: false, error: conditionResult.error ?? 'Condition not met' };
    }

    return { valid: true, promoCode };
}

/**
 * Evaluate promo code conditions
 */
export function qzpayEvaluateConditions(
    conditions: QZPayPromoCodeCondition[],
    context: QZPayDiscountContext
): { valid: boolean; error?: string } {
    for (const condition of conditions) {
        const result = qzpayEvaluateSingleCondition(condition, context);
        if (!result.valid) {
            return result;
        }
    }

    return { valid: true };
}

/**
 * Evaluate a single condition
 */
export function qzpayEvaluateSingleCondition(
    condition: QZPayPromoCodeCondition,
    context: QZPayDiscountContext
): { valid: boolean; error?: string } {
    switch (condition.type) {
        case 'first_purchase':
            if (condition.value === true && !context.isNewCustomer) {
                return { valid: false, error: 'Promo code is only valid for first-time customers' };
            }
            break;

        case 'min_amount':
            if (typeof condition.value === 'number' && context.subtotal < condition.value) {
                return { valid: false, error: `Minimum purchase amount of ${condition.value} required` };
            }
            break;

        case 'min_quantity':
            if (typeof condition.value === 'number' && (context.quantity ?? 1) < condition.value) {
                return { valid: false, error: `Minimum quantity of ${condition.value} items required` };
            }
            break;

        case 'specific_plans':
            if (Array.isArray(condition.value) && context.planId) {
                if (!condition.value.includes(context.planId)) {
                    return { valid: false, error: 'Promo code is not valid for this plan' };
                }
            }
            break;

        case 'specific_products':
            if (Array.isArray(condition.value) && context.productIds) {
                const hasMatch = context.productIds.some((id) => (condition.value as string[]).includes(id));
                if (!hasMatch) {
                    return { valid: false, error: 'Promo code is not valid for these products' };
                }
            }
            break;

        case 'date_range':
            if (typeof condition.value === 'object' && condition.value !== null) {
                const range = condition.value as { start?: string; end?: string };
                const now = context.currentDate ?? new Date();

                if (range.start && now < new Date(range.start)) {
                    return { valid: false, error: 'Promo code is not yet valid' };
                }
                if (range.end && now > new Date(range.end)) {
                    return { valid: false, error: 'Promo code has expired' };
                }
            }
            break;

        case 'customer_tag':
            if (typeof condition.value === 'string' && context.customerTags) {
                if (!context.customerTags.includes(condition.value)) {
                    return { valid: false, error: 'Promo code is not valid for your account type' };
                }
            }
            break;
    }

    return { valid: true };
}

/**
 * Check if a promo code is expired
 */
export function qzpayPromoCodeIsExpired(promoCode: QZPayPromoCode, currentDate?: Date): boolean {
    const now = currentDate ?? new Date();
    return promoCode.validUntil !== null && now > promoCode.validUntil;
}

/**
 * Check if a promo code has reached max redemptions
 */
export function qzpayPromoCodeIsExhausted(promoCode: QZPayPromoCode): boolean {
    return promoCode.maxRedemptions !== null && promoCode.currentRedemptions >= promoCode.maxRedemptions;
}

/**
 * Get remaining redemptions for a promo code
 */
export function qzpayGetRemainingRedemptions(promoCode: QZPayPromoCode): number | null {
    if (promoCode.maxRedemptions === null) {
        return null;
    }
    return Math.max(0, promoCode.maxRedemptions - promoCode.currentRedemptions);
}

// ==================== Calculation Helpers ====================

/**
 * Calculate discount amount based on type and value
 */
export function qzpayCalculateDiscountAmount(discountType: QZPayDiscountType, discountValue: number, amount: number): number {
    switch (discountType) {
        case 'percentage':
            // Percentage value should be 0-100
            return Math.round((amount * Math.min(100, Math.max(0, discountValue))) / 100);

        case 'fixed_amount':
            return Math.min(amount, Math.max(0, discountValue));

        case 'free_trial':
            // Free trial gives 100% off
            return amount;

        default:
            return 0;
    }
}

/**
 * Apply a single promo code to an amount
 */
export function qzpayApplyPromoCode(promoCode: QZPayPromoCode, amount: number): QZPayAppliedDiscount {
    const discountAmount = qzpayCalculateDiscountAmount(promoCode.discountType, promoCode.discountValue, amount);

    return {
        promoCodeId: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discountAmount
    };
}

/**
 * Calculate total discount from multiple sources
 */
export function qzpayCalculateDiscounts(
    amount: number,
    promoCodes: QZPayPromoCode[],
    context: QZPayDiscountContext,
    globalStackingMode: QZPayDiscountStackingMode = 'best'
): QZPayDiscountCalculationResult {
    const result: QZPayDiscountCalculationResult = {
        originalAmount: amount,
        discountAmount: 0,
        finalAmount: amount,
        appliedDiscounts: [],
        skippedDiscounts: []
    };

    if (promoCodes.length === 0) {
        return result;
    }

    // Validate and separate promo codes
    const validPromoCodes: Array<{ promoCode: QZPayPromoCode; discount: number }> = [];

    for (const promoCode of promoCodes) {
        const validation = qzpayValidatePromoCode(promoCode, context);
        if (!validation.valid) {
            result.skippedDiscounts.push({ code: promoCode.code, reason: validation.error ?? 'Invalid' });
            continue;
        }

        const discount = qzpayCalculateDiscountAmount(promoCode.discountType, promoCode.discountValue, amount);
        validPromoCodes.push({ promoCode, discount });
    }

    if (validPromoCodes.length === 0) {
        return result;
    }

    // Apply stacking rules
    switch (globalStackingMode) {
        case 'none': {
            // Only apply the first valid promo code
            const firstValid = validPromoCodes[0];
            if (firstValid) {
                result.appliedDiscounts.push(qzpayApplyPromoCode(firstValid.promoCode, amount));
                result.discountAmount = firstValid.discount;

                // Skip the rest
                for (let i = 1; i < validPromoCodes.length; i++) {
                    const skipped = validPromoCodes[i];
                    if (skipped) {
                        result.skippedDiscounts.push({
                            code: skipped.promoCode.code,
                            reason: 'Discount stacking not allowed'
                        });
                    }
                }
            }
            break;
        }

        case 'best': {
            // Apply only the best (highest) discount
            let bestDiscount = validPromoCodes[0];
            if (!bestDiscount) break;
            for (const pc of validPromoCodes) {
                if (pc.discount > bestDiscount.discount) {
                    bestDiscount = pc;
                }
            }

            if (bestDiscount) {
                result.appliedDiscounts.push(qzpayApplyPromoCode(bestDiscount.promoCode, amount));
                result.discountAmount = bestDiscount.discount;

                // Skip the rest
                for (const pc of validPromoCodes) {
                    if (pc !== bestDiscount) {
                        result.skippedDiscounts.push({
                            code: pc.promoCode.code,
                            reason: 'Better discount applied'
                        });
                    }
                }
            }
            break;
        }

        case 'additive': {
            // Add all discounts together (capped at original amount)
            let totalAdditive = 0;
            for (const pc of validPromoCodes) {
                if (pc.promoCode.stackingMode !== 'none') {
                    result.appliedDiscounts.push(qzpayApplyPromoCode(pc.promoCode, amount));
                    totalAdditive += pc.discount;
                } else {
                    result.skippedDiscounts.push({
                        code: pc.promoCode.code,
                        reason: 'Promo code does not allow stacking'
                    });
                }
            }
            result.discountAmount = Math.min(amount, totalAdditive);
            break;
        }

        case 'multiplicative': {
            // Apply discounts one after another
            let remaining = amount;
            for (const pc of validPromoCodes) {
                if (pc.promoCode.stackingMode !== 'none' && remaining > 0) {
                    const discount = qzpayCalculateDiscountAmount(pc.promoCode.discountType, pc.promoCode.discountValue, remaining);

                    result.appliedDiscounts.push({
                        promoCodeId: pc.promoCode.id,
                        code: pc.promoCode.code,
                        discountType: pc.promoCode.discountType,
                        discountValue: pc.promoCode.discountValue,
                        discountAmount: discount
                    });

                    remaining -= discount;
                } else if (pc.promoCode.stackingMode === 'none') {
                    result.skippedDiscounts.push({
                        code: pc.promoCode.code,
                        reason: 'Promo code does not allow stacking'
                    });
                }
            }
            result.discountAmount = amount - remaining;
            break;
        }
    }

    result.finalAmount = Math.max(0, amount - result.discountAmount);
    return result;
}

// ==================== Automatic Discount Helpers ====================

/**
 * Evaluate automatic discounts against a context
 */
export function qzpayEvaluateAutomaticDiscounts(
    automaticDiscounts: QZPayAutomaticDiscount[],
    context: QZPayDiscountContext
): QZPayAutomaticDiscount[] {
    const now = context.currentDate ?? new Date();

    return automaticDiscounts
        .filter((discount) => {
            // Check if active
            if (!discount.active) return false;

            // Check validity period
            if (discount.validFrom && now < discount.validFrom) return false;
            if (discount.validUntil && now > discount.validUntil) return false;

            // Check conditions
            const conditionResult = qzpayEvaluateConditions(discount.conditions, context);
            return conditionResult.valid;
        })
        .sort((a, b) => b.priority - a.priority);
}

/**
 * Apply automatic discounts to an amount
 */
export function qzpayApplyAutomaticDiscounts(
    automaticDiscounts: QZPayAutomaticDiscount[],
    amount: number,
    context: QZPayDiscountContext
): QZPayDiscountCalculationResult {
    const applicableDiscounts = qzpayEvaluateAutomaticDiscounts(automaticDiscounts, context);

    // Convert automatic discounts to promo code format for calculation
    const pseudoPromoCodes: QZPayPromoCode[] = applicableDiscounts.map((discount) => ({
        id: discount.id,
        code: `AUTO_${discount.id}`,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        currency: null,
        stackingMode: discount.stackingMode,
        conditions: discount.conditions,
        maxRedemptions: null,
        currentRedemptions: 0,
        maxRedemptionsPerCustomer: null,
        validFrom: discount.validFrom ?? null,
        validUntil: discount.validUntil ?? null,
        applicablePlanIds: [],
        applicableProductIds: [],
        active: discount.active,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
    }));

    return qzpayCalculateDiscounts(amount, pseudoPromoCodes, context, 'best');
}

// ==================== Volume/Tiered Pricing Helpers ====================

/**
 * Find the applicable volume tier for a quantity
 */
export function qzpayFindVolumeTier(pricing: QZPayVolumePricing, quantity: number): QZPayVolumeTier | null {
    for (const tier of pricing.tiers) {
        const maxQty = tier.maxQuantity ?? Number.POSITIVE_INFINITY;
        if (quantity >= tier.minQuantity && quantity <= maxQty) {
            return tier;
        }
    }
    return null;
}

/**
 * Calculate volume discount for a quantity
 */
export function qzpayCalculateVolumeDiscount(
    pricing: QZPayVolumePricing,
    quantity: number,
    unitPrice: number
): { discountAmount: number; tier: QZPayVolumeTier | null } {
    const tier = qzpayFindVolumeTier(pricing, quantity);
    if (!tier) {
        return { discountAmount: 0, tier: null };
    }

    const totalPrice = unitPrice * quantity;
    const discountAmount = qzpayCalculateDiscountAmount(tier.discountType, tier.discountValue, totalPrice);

    return { discountAmount, tier };
}

/**
 * Calculate tiered pricing (different prices for different quantity ranges)
 */
export function qzpayCalculateTieredPricing(tiers: QZPayVolumeTier[], quantity: number, basePrice: number): number {
    let totalPrice = 0;
    let remainingQuantity = quantity;

    // Sort tiers by minQuantity
    const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    for (const tier of sortedTiers) {
        if (remainingQuantity <= 0) break;

        const tierMaxQty = tier.maxQuantity ?? Number.POSITIVE_INFINITY;
        const tierQty = Math.min(remainingQuantity, tierMaxQty - tier.minQuantity + 1);

        if (tierQty > 0) {
            // Calculate price for this tier
            const tierUnitPrice = qzpayCalculateTierUnitPrice(tier, basePrice);
            totalPrice += tierUnitPrice * tierQty;
            remainingQuantity -= tierQty;
        }
    }

    // Any remaining quantity uses base price
    if (remainingQuantity > 0) {
        totalPrice += basePrice * remainingQuantity;
    }

    return Math.round(totalPrice);
}

/**
 * Calculate unit price for a tier
 */
export function qzpayCalculateTierUnitPrice(tier: QZPayVolumeTier, basePrice: number): number {
    switch (tier.discountType) {
        case 'percentage':
            return Math.round(basePrice * (1 - tier.discountValue / 100));

        case 'fixed_amount':
            return Math.max(0, basePrice - tier.discountValue);

        default:
            return basePrice;
    }
}

/**
 * Get volume pricing breakdown for a quantity
 */
export function qzpayGetVolumePricingBreakdown(
    pricing: QZPayVolumePricing,
    quantity: number,
    unitPrice: number
): Array<{
    tier: QZPayVolumeTier;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}> {
    const breakdown: Array<{
        tier: QZPayVolumeTier;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }> = [];

    let remainingQuantity = quantity;
    const sortedTiers = [...pricing.tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    for (const tier of sortedTiers) {
        if (remainingQuantity <= 0) break;

        const tierMaxQty = tier.maxQuantity ?? Number.POSITIVE_INFINITY;
        const tierQty = Math.min(remainingQuantity, tierMaxQty - tier.minQuantity + 1);

        if (tierQty > 0) {
            const tierUnitPrice = qzpayCalculateTierUnitPrice(tier, unitPrice);

            breakdown.push({
                tier,
                quantity: tierQty,
                unitPrice: tierUnitPrice,
                totalPrice: tierUnitPrice * tierQty
            });

            remainingQuantity -= tierQty;
        }
    }

    return breakdown;
}

// ==================== Discount Combination Helpers ====================

/**
 * Combine promo codes with automatic discounts
 */
export function qzpayCombineDiscounts(
    amount: number,
    promoCodes: QZPayPromoCode[],
    automaticDiscounts: QZPayAutomaticDiscount[],
    context: QZPayDiscountContext,
    combineMode: 'promo_first' | 'auto_first' | 'best' = 'best'
): QZPayDiscountCalculationResult {
    const promoResult = qzpayCalculateDiscounts(amount, promoCodes, context);
    const autoResult = qzpayApplyAutomaticDiscounts(automaticDiscounts, amount, context);

    switch (combineMode) {
        case 'promo_first':
            // Apply promo codes first, then automatic on remaining
            if (promoResult.discountAmount > 0) {
                const remaining = amount - promoResult.discountAmount;
                const autoOnRemaining = qzpayApplyAutomaticDiscounts(automaticDiscounts, remaining, context);

                return {
                    originalAmount: amount,
                    discountAmount: promoResult.discountAmount + autoOnRemaining.discountAmount,
                    finalAmount: Math.max(0, amount - promoResult.discountAmount - autoOnRemaining.discountAmount),
                    appliedDiscounts: [...promoResult.appliedDiscounts, ...autoOnRemaining.appliedDiscounts],
                    skippedDiscounts: [...promoResult.skippedDiscounts, ...autoOnRemaining.skippedDiscounts]
                };
            }
            return autoResult;

        case 'auto_first':
            // Apply automatic first, then promo codes on remaining
            if (autoResult.discountAmount > 0) {
                const remaining = amount - autoResult.discountAmount;
                const promoOnRemaining = qzpayCalculateDiscounts(remaining, promoCodes, context);

                return {
                    originalAmount: amount,
                    discountAmount: autoResult.discountAmount + promoOnRemaining.discountAmount,
                    finalAmount: Math.max(0, amount - autoResult.discountAmount - promoOnRemaining.discountAmount),
                    appliedDiscounts: [...autoResult.appliedDiscounts, ...promoOnRemaining.appliedDiscounts],
                    skippedDiscounts: [...autoResult.skippedDiscounts, ...promoOnRemaining.skippedDiscounts]
                };
            }
            return promoResult;
        default:
            // Return whichever gives the best discount
            if (promoResult.discountAmount >= autoResult.discountAmount) {
                return {
                    ...promoResult,
                    skippedDiscounts: [
                        ...promoResult.skippedDiscounts,
                        ...autoResult.appliedDiscounts.map((d) => ({
                            code: d.code,
                            reason: 'Better promo code discount applied'
                        }))
                    ]
                };
            }
            return {
                ...autoResult,
                skippedDiscounts: [
                    ...autoResult.skippedDiscounts,
                    ...promoResult.appliedDiscounts.map((d) => ({
                        code: d.code,
                        reason: 'Better automatic discount applied'
                    }))
                ]
            };
    }
}

// ==================== Utility Helpers ====================

/**
 * Format discount for display
 */
export function qzpayFormatDiscount(discountType: QZPayDiscountType, discountValue: number, currency?: QZPayCurrency): string {
    switch (discountType) {
        case 'percentage':
            return `${discountValue}% off`;

        case 'fixed_amount':
            if (currency) {
                return `${currency.toUpperCase()} ${(discountValue / 100).toFixed(2)} off`;
            }
            return `${(discountValue / 100).toFixed(2)} off`;

        case 'free_trial':
            return 'Free trial';

        default:
            return `${discountValue} off`;
    }
}

/**
 * Get discount description
 */
export function qzpayGetDiscountDescription(promoCode: QZPayPromoCode): string {
    const parts: string[] = [];

    parts.push(qzpayFormatDiscount(promoCode.discountType, promoCode.discountValue, promoCode.currency ?? undefined));

    if (promoCode.applicablePlanIds.length > 0) {
        parts.push(`on select plans`);
    }

    if (promoCode.validUntil) {
        parts.push(`until ${promoCode.validUntil.toLocaleDateString()}`);
    }

    return parts.join(' ');
}

/**
 * Check if a discount condition type requires a specific value type
 */
export function qzpayGetConditionValueType(conditionType: QZPayDiscountCondition): 'boolean' | 'number' | 'array' | 'object' {
    switch (conditionType) {
        case 'first_purchase':
            return 'boolean';

        case 'min_amount':
        case 'min_quantity':
            return 'number';

        case 'specific_plans':
        case 'specific_products':
            return 'array';

        case 'date_range':
            return 'object';

        case 'customer_tag':
            return 'array';

        default:
            return 'boolean';
    }
}
