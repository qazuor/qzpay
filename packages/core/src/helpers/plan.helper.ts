/**
 * Plan Helper - utilities for plan comparison and feature checking
 */

import type { QZPayBillingInterval, QZPayCurrency } from '../constants/index.js';
import type { QZPayPlan, QZPayPlanFeature, QZPayPrice } from '../types/index.js';

/**
 * Plan comparison result
 */
export interface QZPayPlanComparison {
    isUpgrade: boolean;
    isDowngrade: boolean;
    isSameTier: boolean;
    priceDifference: number;
    priceDifferencePercent: number;
    featuresGained: string[];
    featuresLost: string[];
    entitlementsGained: string[];
    entitlementsLost: string[];
    limitChanges: QZPayLimitChange[];
}

/**
 * Limit change details
 */
export interface QZPayLimitChange {
    key: string;
    currentLimit: number | null;
    newLimit: number | null;
    change: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed';
    changeAmount: number;
}

/**
 * Price comparison across intervals
 */
export interface QZPayPriceComparison {
    interval: QZPayBillingInterval;
    monthlyEquivalent: number;
    annualEquivalent: number;
    savingsVsMonthly: number;
    savingsPercent: number;
}

/**
 * Plan recommendation
 */
export interface QZPayPlanRecommendation {
    plan: QZPayPlan;
    score: number;
    reasons: string[];
    matchedFeatures: string[];
    missingFeatures: string[];
}

/**
 * Get active prices from a plan
 *
 * @param plan - Plan to extract prices from
 * @returns Array of active prices only
 */
export function qzpayGetActivePrices(plan: QZPayPlan): QZPayPrice[] {
    return plan.prices.filter((price) => price.active);
}

/**
 * Get price by interval
 *
 * @param plan - Plan to search
 * @param interval - Billing interval to match
 * @param currency - Optional currency filter
 * @returns First matching price or null if not found
 */
export function qzpayGetPriceByInterval(plan: QZPayPlan, interval: QZPayBillingInterval, currency?: QZPayCurrency): QZPayPrice | null {
    const prices = qzpayGetActivePrices(plan);
    return (
        prices.find((price) => {
            const matchesInterval = price.billingInterval === interval;
            const matchesCurrency = !currency || price.currency === currency;
            return matchesInterval && matchesCurrency;
        }) ?? null
    );
}

/**
 * Get cheapest price from a plan
 *
 * Compares prices by monthly equivalent to find the best value.
 *
 * @param plan - Plan to search
 * @param currency - Optional currency filter
 * @returns Cheapest price based on monthly equivalent, or null if no prices
 */
export function qzpayGetCheapestPrice(plan: QZPayPlan, currency?: QZPayCurrency): QZPayPrice | null {
    const prices = qzpayGetActivePrices(plan).filter((p) => !currency || p.currency === currency);

    if (prices.length === 0) {
        return null;
    }

    // Convert all to monthly equivalent for comparison
    return prices.reduce((cheapest, price) => {
        const currentMonthly = qzpayGetMonthlyEquivalent(cheapest);
        const priceMonthly = qzpayGetMonthlyEquivalent(price);
        return priceMonthly < currentMonthly ? price : cheapest;
    });
}

/**
 * Get monthly equivalent of a price
 *
 * Converts any billing interval to approximate monthly cost.
 *
 * @param price - Price to convert
 * @returns Monthly equivalent amount in cents
 */
export function qzpayGetMonthlyEquivalent(price: QZPayPrice): number {
    const { unitAmount, billingInterval, intervalCount } = price;

    switch (billingInterval) {
        case 'day':
            return Math.round((unitAmount / intervalCount) * 30);
        case 'week':
            return Math.round((unitAmount / intervalCount) * 4.33);
        case 'month':
            return Math.round(unitAmount / intervalCount);
        case 'year':
            return Math.round(unitAmount / (intervalCount * 12));
        default:
            return unitAmount;
    }
}

/**
 * Get annual equivalent of a price
 *
 * Converts any billing interval to approximate annual cost.
 *
 * @param price - Price to convert
 * @returns Annual equivalent amount in cents
 */
export function qzpayGetAnnualEquivalent(price: QZPayPrice): number {
    const { unitAmount, billingInterval, intervalCount } = price;

    switch (billingInterval) {
        case 'day':
            return Math.round((unitAmount / intervalCount) * 365);
        case 'week':
            return Math.round((unitAmount / intervalCount) * 52);
        case 'month':
            return Math.round((unitAmount / intervalCount) * 12);
        case 'year':
            return Math.round(unitAmount / intervalCount);
        default:
            return unitAmount * 12;
    }
}

/**
 * Compare prices across intervals
 *
 * Calculates monthly/annual equivalents and savings vs monthly baseline.
 *
 * @param prices - Array of prices to compare
 * @returns Array of comparisons with savings calculations
 */
export function qzpayComparePrices(prices: QZPayPrice[]): QZPayPriceComparison[] {
    // Get monthly price as baseline
    const monthlyPrice = prices.find((p) => p.billingInterval === 'month');
    const monthlyEquivalentBaseline = monthlyPrice ? monthlyPrice.unitAmount : 0;

    return prices.map((price) => {
        const monthlyEquivalent = qzpayGetMonthlyEquivalent(price);
        const annualEquivalent = qzpayGetAnnualEquivalent(price);

        const savingsVsMonthly = monthlyEquivalentBaseline > 0 ? monthlyEquivalentBaseline - monthlyEquivalent : 0;
        const savingsPercent = monthlyEquivalentBaseline > 0 ? Math.round((savingsVsMonthly / monthlyEquivalentBaseline) * 100) : 0;

        return {
            interval: price.billingInterval,
            monthlyEquivalent,
            annualEquivalent,
            savingsVsMonthly,
            savingsPercent
        };
    });
}

/**
 * Check if plan has a specific feature
 *
 * @param plan - Plan to check
 * @param featureName - Feature name to search for (case-insensitive)
 * @returns True if feature is included in plan
 */
export function qzpayPlanHasFeature(plan: QZPayPlan, featureName: string): boolean {
    return plan.features.some((f) => f.name.toLowerCase() === featureName.toLowerCase() && f.included);
}

/**
 * Check if plan has a specific entitlement
 *
 * @param plan - Plan to check
 * @param entitlementKey - Entitlement key to search for
 * @returns True if entitlement is included in plan
 */
export function qzpayPlanHasEntitlement(plan: QZPayPlan, entitlementKey: string): boolean {
    return plan.entitlements.includes(entitlementKey);
}

/**
 * Get included features from a plan
 *
 * @param plan - Plan to extract features from
 * @returns Array of features marked as included
 */
export function qzpayGetIncludedFeatures(plan: QZPayPlan): QZPayPlanFeature[] {
    return plan.features.filter((f) => f.included);
}

/**
 * Get excluded features from a plan
 *
 * @param plan - Plan to extract features from
 * @returns Array of features marked as not included
 */
export function qzpayGetExcludedFeatures(plan: QZPayPlan): QZPayPlanFeature[] {
    return plan.features.filter((f) => !f.included);
}

/**
 * Get limit value for a plan
 *
 * @param plan - Plan to query
 * @param limitKey - Limit key to retrieve
 * @returns Limit value or null if not defined
 */
export function qzpayGetPlanLimit(plan: QZPayPlan, limitKey: string): number | null {
    return plan.limits[limitKey] ?? null;
}

/**
 * Calculate limit change details
 */
function calculateLimitChange(currentLimit: number | null, newLimit: number | null): QZPayLimitChange | null {
    let change: QZPayLimitChange['change'];
    let changeAmount = 0;

    if (currentLimit === null && newLimit !== null) {
        change = 'added';
        changeAmount = newLimit;
    } else if (currentLimit !== null && newLimit === null) {
        change = 'removed';
        changeAmount = -currentLimit;
    } else if (currentLimit !== null && newLimit !== null) {
        if (newLimit > currentLimit) {
            change = 'increased';
            changeAmount = newLimit - currentLimit;
        } else if (newLimit < currentLimit) {
            change = 'decreased';
            changeAmount = newLimit - currentLimit;
        } else {
            change = 'unchanged';
            changeAmount = 0;
        }
    } else {
        return null;
    }

    return { key: '', currentLimit, newLimit, change, changeAmount };
}

/**
 * Determine plan tier relationship
 */
function determineTierRelationship(
    priceDifference: number,
    featuresGained: string[],
    featuresLost: string[],
    entitlementsGained: string[],
    entitlementsLost: string[],
    limitChanges: QZPayLimitChange[]
): { isUpgrade: boolean; isDowngrade: boolean; isSameTier: boolean } {
    const hasMoreValue =
        featuresGained.length > featuresLost.length ||
        entitlementsGained.length > entitlementsLost.length ||
        limitChanges.filter((l) => l.change === 'increased').length > limitChanges.filter((l) => l.change === 'decreased').length;

    const hasLessValue =
        featuresLost.length > featuresGained.length ||
        entitlementsLost.length > entitlementsGained.length ||
        limitChanges.filter((l) => l.change === 'decreased').length > limitChanges.filter((l) => l.change === 'increased').length;

    let isUpgrade = false;
    let isDowngrade = false;
    let isSameTier = false;

    if (priceDifference > 0 || (priceDifference === 0 && hasMoreValue)) {
        isUpgrade = true;
    } else if (priceDifference < 0 || (priceDifference === 0 && hasLessValue)) {
        isDowngrade = true;
    } else {
        isSameTier = true;
    }

    return { isUpgrade, isDowngrade, isSameTier };
}

/**
 * Compare two plans
 *
 * Analyzes price differences, feature changes, entitlement changes, and limit changes.
 *
 * @param currentPlan - Current plan
 * @param newPlan - New plan to compare against
 * @param currency - Optional currency filter for price comparison
 * @returns Comprehensive comparison including upgrade/downgrade determination
 */
export function qzpayComparePlans(currentPlan: QZPayPlan, newPlan: QZPayPlan, currency?: QZPayCurrency): QZPayPlanComparison {
    // Get prices for comparison
    const currentPrice = qzpayGetCheapestPrice(currentPlan, currency);
    const newPrice = qzpayGetCheapestPrice(newPlan, currency);

    const currentMonthly = currentPrice ? qzpayGetMonthlyEquivalent(currentPrice) : 0;
    const newMonthly = newPrice ? qzpayGetMonthlyEquivalent(newPrice) : 0;

    const priceDifference = newMonthly - currentMonthly;
    const priceDifferencePercent = currentMonthly > 0 ? Math.round((priceDifference / currentMonthly) * 100) : 0;

    // Compare features
    const currentFeatures = new Set(qzpayGetIncludedFeatures(currentPlan).map((f) => f.name));
    const newFeatures = new Set(qzpayGetIncludedFeatures(newPlan).map((f) => f.name));

    const featuresGained = [...newFeatures].filter((f) => !currentFeatures.has(f));
    const featuresLost = [...currentFeatures].filter((f) => !newFeatures.has(f));

    // Compare entitlements
    const currentEntitlements = new Set(currentPlan.entitlements);
    const newEntitlements = new Set(newPlan.entitlements);

    const entitlementsGained = [...newEntitlements].filter((e) => !currentEntitlements.has(e));
    const entitlementsLost = [...currentEntitlements].filter((e) => !newEntitlements.has(e));

    // Compare limits
    const allLimitKeys = new Set([...Object.keys(currentPlan.limits), ...Object.keys(newPlan.limits)]);

    const limitChanges: QZPayLimitChange[] = [];
    for (const key of allLimitKeys) {
        const currentLimit = currentPlan.limits[key] ?? null;
        const newLimit = newPlan.limits[key] ?? null;

        const change = calculateLimitChange(currentLimit, newLimit);
        if (change) {
            limitChanges.push({ ...change, key });
        }
    }

    const { isUpgrade, isDowngrade, isSameTier } = determineTierRelationship(
        priceDifference,
        featuresGained,
        featuresLost,
        entitlementsGained,
        entitlementsLost,
        limitChanges
    );

    return {
        isUpgrade,
        isDowngrade,
        isSameTier,
        priceDifference,
        priceDifferencePercent,
        featuresGained,
        featuresLost,
        entitlementsGained,
        entitlementsLost,
        limitChanges
    };
}

/**
 * Find plans with specific features
 *
 * @param plans - Array of plans to search
 * @param requiredFeatures - Array of feature names that must be included
 * @returns Plans that include all required features
 */
export function qzpayFindPlansWithFeatures(plans: QZPayPlan[], requiredFeatures: string[]): QZPayPlan[] {
    return plans.filter((plan) => {
        return requiredFeatures.every((feature) => qzpayPlanHasFeature(plan, feature));
    });
}

/**
 * Find plans with specific entitlements
 *
 * @param plans - Array of plans to search
 * @param requiredEntitlements - Array of entitlement keys that must be included
 * @returns Plans that include all required entitlements
 */
export function qzpayFindPlansWithEntitlements(plans: QZPayPlan[], requiredEntitlements: string[]): QZPayPlan[] {
    return plans.filter((plan) => {
        return requiredEntitlements.every((entitlement) => qzpayPlanHasEntitlement(plan, entitlement));
    });
}

/**
 * Find plans within a price range (monthly equivalent)
 *
 * @param plans - Array of plans to filter
 * @param minPrice - Minimum monthly price in cents
 * @param maxPrice - Maximum monthly price in cents
 * @param currency - Optional currency filter
 * @returns Plans with monthly equivalent within range
 */
export function qzpayFindPlansInPriceRange(plans: QZPayPlan[], minPrice: number, maxPrice: number, currency?: QZPayCurrency): QZPayPlan[] {
    return plans.filter((plan) => {
        const price = qzpayGetCheapestPrice(plan, currency);
        if (!price) return false;
        const monthly = qzpayGetMonthlyEquivalent(price);
        return monthly >= minPrice && monthly <= maxPrice;
    });
}

/**
 * Sort plans by price (cheapest first)
 *
 * @param plans - Array of plans to sort
 * @param currency - Optional currency filter
 * @returns New array sorted by monthly equivalent ascending
 */
export function qzpaySortPlansByPrice(plans: QZPayPlan[], currency?: QZPayCurrency): QZPayPlan[] {
    return [...plans].sort((a, b) => {
        const priceA = qzpayGetCheapestPrice(a, currency);
        const priceB = qzpayGetCheapestPrice(b, currency);

        if (!priceA && !priceB) return 0;
        if (!priceA) return 1;
        if (!priceB) return -1;

        return qzpayGetMonthlyEquivalent(priceA) - qzpayGetMonthlyEquivalent(priceB);
    });
}

/**
 * Sort plans by feature count (most features first)
 *
 * @param plans - Array of plans to sort
 * @returns New array sorted by included feature count descending
 */
export function qzpaySortPlansByFeatures(plans: QZPayPlan[]): QZPayPlan[] {
    return [...plans].sort((a, b) => {
        const featuresA = qzpayGetIncludedFeatures(a).length;
        const featuresB = qzpayGetIncludedFeatures(b).length;
        return featuresB - featuresA;
    });
}

/**
 * Get recommended plan based on requirements
 *
 * Scores plans based on required features (must have), desired features (bonus points),
 * total feature count, and price efficiency.
 *
 * @param plans - Array of plans to evaluate
 * @param requiredFeatures - Features that must be included (heavy penalty if missing)
 * @param desiredFeatures - Features that are nice to have (bonus points)
 * @param maxMonthlyPrice - Optional maximum monthly price filter
 * @param currency - Optional currency filter
 * @returns Best matching plan with score and reasoning, or null if no candidates
 */
export function qzpayRecommendPlan(
    plans: QZPayPlan[],
    requiredFeatures: string[],
    desiredFeatures: string[],
    maxMonthlyPrice?: number,
    currency?: QZPayCurrency
): QZPayPlanRecommendation | null {
    // Filter to active plans
    const activePlans = plans.filter((p) => p.active && p.deletedAt === null);
    if (activePlans.length === 0) return null;

    // Filter by max price if specified
    let candidates = activePlans;
    if (maxMonthlyPrice !== undefined) {
        candidates = qzpayFindPlansInPriceRange(activePlans, 0, maxMonthlyPrice, currency);
    }
    if (candidates.length === 0) return null;

    // Score each plan
    const scored = candidates.map((plan) => {
        let score = 0;
        const reasons: string[] = [];
        const matchedFeatures: string[] = [];
        const missingFeatures: string[] = [];

        // Check required features (must have all)
        const hasAllRequired = requiredFeatures.every((f) => qzpayPlanHasFeature(plan, f));
        if (!hasAllRequired) {
            // Still consider but with penalty
            const missingRequired = requiredFeatures.filter((f) => !qzpayPlanHasFeature(plan, f));
            score -= missingRequired.length * 100;
            missingFeatures.push(...missingRequired);
        } else {
            matchedFeatures.push(...requiredFeatures);
            reasons.push('Has all required features');
        }

        // Score desired features
        for (const feature of desiredFeatures) {
            if (qzpayPlanHasFeature(plan, feature)) {
                score += 10;
                matchedFeatures.push(feature);
            } else {
                missingFeatures.push(feature);
            }
        }

        // Bonus for having more features
        score += qzpayGetIncludedFeatures(plan).length * 2;

        // Price efficiency (lower is better)
        const price = qzpayGetCheapestPrice(plan, currency);
        if (price) {
            const monthly = qzpayGetMonthlyEquivalent(price);
            // Small penalty for higher prices
            score -= Math.floor(monthly / 1000);

            if (monthly < (maxMonthlyPrice ?? Number.POSITIVE_INFINITY) * 0.5) {
                reasons.push('Good value for price');
            }
        }

        return { plan, score, reasons, matchedFeatures, missingFeatures };
    });

    // Sort by score and return best match
    scored.sort((a, b) => b.score - a.score);
    return scored[0] ?? null;
}

/**
 * Get feature comparison matrix for multiple plans
 *
 * Creates a matrix showing which plans include which features.
 *
 * @param plans - Array of plans to compare
 * @returns Map of feature name to Map of plan ID to inclusion boolean
 */
export function qzpayGetFeatureMatrix(plans: QZPayPlan[]): Map<string, Map<string, boolean>> {
    // Collect all unique features
    const allFeatures = new Set<string>();
    for (const plan of plans) {
        for (const feature of plan.features) {
            allFeatures.add(feature.name);
        }
    }

    // Build matrix
    const matrix = new Map<string, Map<string, boolean>>();
    for (const featureName of allFeatures) {
        const row = new Map<string, boolean>();
        for (const plan of plans) {
            row.set(plan.id, qzpayPlanHasFeature(plan, featureName));
        }
        matrix.set(featureName, row);
    }

    return matrix;
}
