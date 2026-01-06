/**
 * Usage billing helpers
 *
 * Utilities for calculating usage-based billing amounts.
 */

import type { QZPayCurrency } from '../constants/index.js';
import type {
    QZPayMeteredPrice,
    QZPayPricingTier,
    QZPayTierBreakdownItem,
    QZPayUsageEvent,
    QZPayUsageMeter,
    QZPayUsageSummary
} from '../types/usage.types.js';

/**
 * Calculate the amount for a given quantity using tiered pricing
 */
export function qzpayCalculateTieredAmount(
    quantity: number,
    price: QZPayMeteredPrice
): { amount: number; breakdown: QZPayTierBreakdownItem[] } {
    if (!price.tiers || price.tiers.length === 0) {
        // Fall back to unit amount
        const unitAmount = price.unitAmount ?? 0;
        const amount = Math.round(quantity * unitAmount);
        return {
            amount,
            breakdown: [
                {
                    tierIndex: 0,
                    quantity,
                    unitPrice: unitAmount,
                    amount,
                    fromUnit: 0,
                    toUnit: null
                }
            ]
        };
    }

    if (price.pricingModel === 'tiered_volume') {
        return calculateVolumeBasedPricing(quantity, price.tiers);
    }

    if (price.pricingModel === 'tiered_graduated') {
        return calculateGraduatedPricing(quantity, price.tiers);
    }

    if (price.pricingModel === 'package') {
        return calculatePackagePricing(quantity, price.tiers);
    }

    // per_unit or flat_fee
    const unitAmount = price.unitAmount ?? 0;
    const amount = price.pricingModel === 'flat_fee' ? unitAmount : Math.round(quantity * unitAmount);

    return {
        amount,
        breakdown: [
            {
                tierIndex: 0,
                quantity,
                unitPrice: unitAmount,
                amount,
                fromUnit: 0,
                toUnit: null
            }
        ]
    };
}

/**
 * Volume-based pricing: all units priced at the tier matching total volume
 */
function calculateVolumeBasedPricing(quantity: number, tiers: QZPayPricingTier[]): { amount: number; breakdown: QZPayTierBreakdownItem[] } {
    // Find the tier that applies to this quantity
    let applicableTier: QZPayPricingTier | null = null;
    let tierIndex = 0;
    let previousUpTo = 0;

    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier) continue;

        if (tier.upTo === null || quantity <= tier.upTo) {
            applicableTier = tier;
            tierIndex = i;
            break;
        }
        previousUpTo = tier.upTo;
    }

    if (!applicableTier) {
        // Use last tier
        const lastTier = tiers[tiers.length - 1];
        if (!lastTier) {
            // No valid tiers, return zero
            return { amount: 0, breakdown: [] };
        }
        applicableTier = lastTier;
        tierIndex = tiers.length - 1;
    }

    const amount = Math.round(quantity * applicableTier.unitAmount) + (applicableTier.flatAmount ?? 0);

    return {
        amount,
        breakdown: [
            {
                tierIndex,
                quantity,
                unitPrice: applicableTier.unitAmount,
                amount,
                fromUnit: previousUpTo,
                toUnit: applicableTier.upTo
            }
        ]
    };
}

/**
 * Graduated pricing: each tier priced separately based on quantity in that bracket
 */
function calculateGraduatedPricing(quantity: number, tiers: QZPayPricingTier[]): { amount: number; breakdown: QZPayTierBreakdownItem[] } {
    let totalAmount = 0;
    let remainingQuantity = quantity;
    let previousUpTo = 0;
    const breakdown: QZPayTierBreakdownItem[] = [];

    for (let i = 0; i < tiers.length && remainingQuantity > 0; i++) {
        const tier = tiers[i];
        if (!tier) continue;

        // Calculate quantity in this tier
        const tierCapacity = tier.upTo !== null ? tier.upTo - previousUpTo : remainingQuantity;
        const quantityInTier = Math.min(remainingQuantity, tierCapacity);

        // Calculate amount for this tier
        const tierAmount = Math.round(quantityInTier * tier.unitAmount) + (quantityInTier > 0 ? (tier.flatAmount ?? 0) : 0);

        if (quantityInTier > 0) {
            breakdown.push({
                tierIndex: i,
                quantity: quantityInTier,
                unitPrice: tier.unitAmount,
                amount: tierAmount,
                fromUnit: previousUpTo,
                toUnit: tier.upTo
            });
        }

        totalAmount += tierAmount;
        remainingQuantity -= quantityInTier;

        if (tier.upTo !== null) {
            previousUpTo = tier.upTo;
        }
    }

    return { amount: totalAmount, breakdown };
}

/**
 * Package pricing: price per package of units
 */
function calculatePackagePricing(quantity: number, tiers: QZPayPricingTier[]): { amount: number; breakdown: QZPayTierBreakdownItem[] } {
    // For package pricing, first tier defines package size and price
    const packageTier = tiers[0];
    if (!packageTier || !packageTier.upTo) {
        return { amount: 0, breakdown: [] };
    }

    const packageSize = packageTier.upTo;
    const packagePrice = packageTier.flatAmount ?? packageTier.unitAmount;

    // Calculate number of packages needed (round up)
    const packagesNeeded = Math.ceil(quantity / packageSize);
    const amount = Math.round(packagesNeeded * packagePrice);

    return {
        amount,
        breakdown: [
            {
                tierIndex: 0,
                quantity: packagesNeeded,
                unitPrice: packagePrice,
                amount,
                fromUnit: 0,
                toUnit: null
            }
        ]
    };
}

/**
 * Aggregate usage events for a billing period
 */
export function qzpayAggregateUsageEvents(events: QZPayUsageEvent[], meter: QZPayUsageMeter): number {
    if (events.length === 0) return 0;

    switch (meter.aggregationType) {
        case 'sum':
            return events.reduce((sum, event) => sum + event.quantity, 0);

        case 'max':
            return Math.max(...events.map((e) => e.quantity));

        case 'last': {
            // Sort by timestamp and return the last value
            const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            return sorted[0]?.quantity ?? 0;
        }

        case 'count':
            return events.length;

        default:
            return events.reduce((sum, event) => sum + event.quantity, 0);
    }
}

/**
 * Create a usage summary from events and pricing
 */
export function qzpayCreateUsageSummary(
    customerId: string,
    subscriptionId: string | null,
    meterKey: string,
    events: QZPayUsageEvent[],
    meter: QZPayUsageMeter,
    price: QZPayMeteredPrice,
    periodStart: Date,
    periodEnd: Date
): QZPayUsageSummary {
    const aggregatedValue = qzpayAggregateUsageEvents(events, meter);
    const { amount, breakdown } = qzpayCalculateTieredAmount(aggregatedValue, price);

    // Apply min/max constraints
    let finalAmount = amount;
    if (price.minimumAmount !== null && finalAmount < price.minimumAmount) {
        finalAmount = price.minimumAmount;
    }
    if (price.maximumAmount !== null && finalAmount > price.maximumAmount) {
        finalAmount = price.maximumAmount;
    }

    return {
        customerId,
        subscriptionId,
        meterKey,
        periodStart,
        periodEnd,
        aggregatedValue,
        eventCount: events.length,
        amount: finalAmount,
        currency: price.currency,
        tierBreakdown: breakdown.length > 1 || breakdown[0]?.tierIndex !== 0 ? breakdown : null
    };
}

/**
 * Get billing period dates for a subscription
 */
export function qzpayGetBillingPeriod(
    subscriptionStart: Date,
    billingInterval: 'day' | 'week' | 'month' | 'year',
    intervalCount: number,
    referenceDate: Date = new Date()
): { periodStart: Date; periodEnd: Date } {
    const start = new Date(subscriptionStart);
    let periodStart = new Date(start);
    let periodEnd = new Date(start);

    // Calculate period end based on interval
    const addInterval = (date: Date, count: number): Date => {
        const result = new Date(date);
        switch (billingInterval) {
            case 'day':
                result.setDate(result.getDate() + count);
                break;
            case 'week':
                result.setDate(result.getDate() + count * 7);
                break;
            case 'month':
                result.setMonth(result.getMonth() + count);
                break;
            case 'year':
                result.setFullYear(result.getFullYear() + count);
                break;
        }
        return result;
    };

    // Find the current billing period
    periodEnd = addInterval(periodStart, intervalCount);
    while (periodEnd <= referenceDate) {
        periodStart = new Date(periodEnd);
        periodEnd = addInterval(periodStart, intervalCount);
    }

    return { periodStart, periodEnd };
}

/**
 * Format usage amount for display
 */
export function qzpayFormatUsageAmount(amount: number, currency: QZPayCurrency): string {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2
    });
    return formatter.format(amount / 100);
}

/**
 * Format usage quantity for display
 */
export function qzpayFormatUsageQuantity(quantity: number, unit: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2
    });
    return `${formatter.format(quantity)} ${unit}`;
}

/**
 * Validate usage event data
 */
export function qzpayValidateUsageEvent(input: {
    customerId: string;
    meterKey: string;
    quantity: number;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.customerId || input.customerId.trim() === '') {
        errors.push('Customer ID is required');
    }

    if (!input.meterKey || input.meterKey.trim() === '') {
        errors.push('Meter key is required');
    }

    if (typeof input.quantity !== 'number' || Number.isNaN(input.quantity)) {
        errors.push('Quantity must be a valid number');
    }

    if (input.quantity < 0) {
        errors.push('Quantity cannot be negative');
    }

    return { valid: errors.length === 0, errors };
}
