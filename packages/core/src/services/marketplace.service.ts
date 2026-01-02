/**
 * Marketplace service helpers for QZPay
 *
 * Provides utilities for vendor management, payment splitting,
 * commission calculations, and payout scheduling.
 */
import type { QZPayCurrency } from '../constants/index.js';
import type { QZPayPayoutSchedule, QZPaySplitPayment, QZPayVendor, QZPayVendorPayout } from '../types/index.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Split configuration for a payment
 */
export interface QZPaySplitConfig {
    vendorId: string;
    /** Amount going to vendor (if specified, overrides percentage) */
    vendorAmount?: number;
    /** Percentage going to vendor (0-100) */
    vendorPercentage?: number;
    /** Fixed platform fee */
    platformFee?: number;
    /** Percentage platform fee (0-100) */
    platformFeePercentage?: number;
    /** Minimum platform fee */
    minPlatformFee?: number;
    /** Maximum platform fee */
    maxPlatformFee?: number;
}

/**
 * Result of split calculation
 */
export interface QZPaySplitResult {
    vendorId: string;
    totalAmount: number;
    vendorAmount: number;
    platformFee: number;
    currency: QZPayCurrency;
}

/**
 * Multi-vendor split configuration
 */
export interface QZPayMultiVendorSplitConfig {
    totalAmount: number;
    currency: QZPayCurrency;
    splits: Array<{
        vendorId: string;
        amount?: number;
        percentage?: number;
    }>;
    platformFeePercentage?: number;
    minPlatformFee?: number;
}

/**
 * Multi-vendor split result
 */
export interface QZPayMultiVendorSplitResult {
    totalAmount: number;
    vendorPayouts: QZPaySplitPayment[];
    platformFee: number;
    currency: QZPayCurrency;
}

/**
 * Payout eligibility result
 */
export interface QZPayPayoutEligibility {
    eligible: boolean;
    reason?: string;
    nextEligibleDate?: Date;
}

/**
 * Payout period
 */
export interface QZPayPayoutPeriod {
    start: Date;
    end: Date;
}

// ==================== Commission Helpers ====================

/**
 * Calculate platform commission from amount
 */
export function qzpayCalculatePlatformCommission(
    amount: number,
    commissionRate: number,
    options: {
        minCommission?: number;
        maxCommission?: number;
    } = {}
): number {
    let commission = Math.round(amount * (commissionRate / 100));

    if (options.minCommission !== undefined) {
        commission = Math.max(commission, options.minCommission);
    }

    if (options.maxCommission !== undefined) {
        commission = Math.min(commission, options.maxCommission);
    }

    return commission;
}

/**
 * Calculate vendor amount after commission
 */
export function qzpayCalculateVendorAmount(
    totalAmount: number,
    commissionRate: number,
    options: {
        minCommission?: number;
        maxCommission?: number;
    } = {}
): number {
    const commission = qzpayCalculatePlatformCommission(totalAmount, commissionRate, options);
    return totalAmount - commission;
}

/**
 * Calculate split payment details
 */
export function qzpayCalculateSplit(totalAmount: number, config: QZPaySplitConfig, currency: QZPayCurrency): QZPaySplitResult {
    let vendorAmount: number;
    let platformFee: number;

    // Calculate vendor amount
    if (config.vendorAmount !== undefined) {
        vendorAmount = config.vendorAmount;
    } else if (config.vendorPercentage !== undefined) {
        vendorAmount = Math.round(totalAmount * (config.vendorPercentage / 100));
    } else {
        vendorAmount = totalAmount;
    }

    // Calculate platform fee
    if (config.platformFee !== undefined) {
        platformFee = config.platformFee;
    } else if (config.platformFeePercentage !== undefined) {
        platformFee = Math.round(totalAmount * (config.platformFeePercentage / 100));
    } else {
        platformFee = totalAmount - vendorAmount;
    }

    // Apply min/max platform fee
    if (config.minPlatformFee !== undefined) {
        platformFee = Math.max(platformFee, config.minPlatformFee);
    }
    if (config.maxPlatformFee !== undefined) {
        platformFee = Math.min(platformFee, config.maxPlatformFee);
    }

    // Ensure vendor amount + platform fee equals total
    vendorAmount = totalAmount - platformFee;

    return {
        vendorId: config.vendorId,
        totalAmount,
        vendorAmount: Math.max(0, vendorAmount),
        platformFee: Math.max(0, platformFee),
        currency
    };
}

/**
 * Calculate multi-vendor split
 */
export function qzpayCalculateMultiVendorSplit(config: QZPayMultiVendorSplitConfig): QZPayMultiVendorSplitResult {
    const vendorPayouts: QZPaySplitPayment[] = [];
    let totalVendorAmount = 0;

    // Calculate vendor amounts
    for (const split of config.splits) {
        let vendorAmount: number;

        if (split.amount !== undefined) {
            vendorAmount = split.amount;
        } else if (split.percentage !== undefined) {
            vendorAmount = Math.round(config.totalAmount * (split.percentage / 100));
        } else {
            continue;
        }

        totalVendorAmount += vendorAmount;
    }

    // Calculate platform fee
    let platformFee = config.totalAmount - totalVendorAmount;

    if (config.platformFeePercentage !== undefined) {
        const calculatedFee = Math.round(config.totalAmount * (config.platformFeePercentage / 100));
        platformFee = Math.max(platformFee, calculatedFee);
    }

    if (config.minPlatformFee !== undefined) {
        platformFee = Math.max(platformFee, config.minPlatformFee);
    }

    // Adjust vendor amounts if platform fee changed
    const availableForVendors = config.totalAmount - platformFee;
    const adjustmentRatio = totalVendorAmount > 0 ? availableForVendors / totalVendorAmount : 0;

    // Build vendor payouts
    for (const split of config.splits) {
        let vendorAmount: number;

        if (split.amount !== undefined) {
            vendorAmount = Math.round(split.amount * adjustmentRatio);
        } else if (split.percentage !== undefined) {
            vendorAmount = Math.round(config.totalAmount * (split.percentage / 100) * adjustmentRatio);
        } else {
            continue;
        }

        // Calculate individual platform fee for this vendor
        const vendorPlatformFee = Math.round((vendorAmount / availableForVendors) * platformFee);

        vendorPayouts.push({
            vendorId: split.vendorId,
            amount: vendorAmount,
            platformFee: vendorPlatformFee
        });
    }

    return {
        totalAmount: config.totalAmount,
        vendorPayouts,
        platformFee,
        currency: config.currency
    };
}

// ==================== Vendor Status Helpers ====================

/**
 * Check if vendor is active
 */
export function qzpayVendorIsActive(vendor: QZPayVendor): boolean {
    return vendor.status === 'active' && vendor.deletedAt === null;
}

/**
 * Check if vendor is pending verification
 */
export function qzpayVendorIsPending(vendor: QZPayVendor): boolean {
    return vendor.status === 'pending';
}

/**
 * Check if vendor is suspended
 */
export function qzpayVendorIsSuspended(vendor: QZPayVendor): boolean {
    return vendor.status === 'suspended';
}

/**
 * Check if vendor can receive payments
 */
export function qzpayVendorCanReceivePayments(vendor: QZPayVendor): boolean {
    return qzpayVendorIsActive(vendor) && Object.keys(vendor.providerAccountIds).length > 0;
}

/**
 * Get vendor effective commission rate
 */
export function qzpayGetVendorCommissionRate(vendor: QZPayVendor, defaultRate: number = 10): number {
    return vendor.commissionRate ?? defaultRate;
}

// ==================== Payout Schedule Helpers ====================

/**
 * Get next payout date based on schedule
 */
export function qzpayGetNextPayoutDate(schedule: QZPayPayoutSchedule, fromDate: Date = new Date()): Date {
    const date = new Date(fromDate);

    switch (schedule.interval) {
        case 'daily':
            // Next day at midnight
            date.setDate(date.getDate() + 1);
            date.setHours(0, 0, 0, 0);
            return date;

        case 'weekly': {
            // Next occurrence of dayOfWeek (0 = Sunday)
            const targetDay = schedule.dayOfWeek ?? 1; // Default to Monday
            const currentDay = date.getDay();
            const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
            date.setDate(date.getDate() + daysUntilTarget);
            date.setHours(0, 0, 0, 0);
            return date;
        }

        case 'monthly': {
            // Next occurrence of dayOfMonth
            const targetDayOfMonth = schedule.dayOfMonth ?? 1; // Default to 1st
            date.setMonth(date.getMonth() + 1);
            date.setDate(Math.min(targetDayOfMonth, qzpayGetDaysInMonth(date)));
            date.setHours(0, 0, 0, 0);
            return date;
        }

        default:
            return date;
    }
}

/**
 * Get payout period for a date
 */
export function qzpayGetPayoutPeriod(schedule: QZPayPayoutSchedule, forDate: Date = new Date()): QZPayPayoutPeriod {
    const date = new Date(forDate);

    switch (schedule.interval) {
        case 'daily': {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            return { start: startOfDay, end: endOfDay };
        }

        case 'weekly': {
            const targetDay = schedule.dayOfWeek ?? 1;
            const startOfWeek = new Date(date);
            const daysDiff = (date.getDay() - targetDay + 7) % 7;
            startOfWeek.setDate(date.getDate() - daysDiff);
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            return { start: startOfWeek, end: endOfWeek };
        }

        case 'monthly': {
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start: startOfMonth, end: endOfMonth };
        }

        default:
            return { start: date, end: date };
    }
}

/**
 * Check if a date is within a payout period
 */
export function qzpayIsWithinPayoutPeriod(date: Date, period: QZPayPayoutPeriod): boolean {
    return date >= period.start && date <= period.end;
}

/**
 * Get days in month
 */
function qzpayGetDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// ==================== Payout Helpers ====================

/**
 * Create a payout record
 */
export function qzpayCreatePayout(vendorId: string, amount: number, currency: QZPayCurrency, period: QZPayPayoutPeriod): QZPayVendorPayout {
    return {
        id: qzpayGenerateId('po'),
        vendorId,
        amount,
        currency,
        status: 'pending',
        periodStart: period.start,
        periodEnd: period.end,
        providerPayoutIds: {},
        paidAt: null,
        createdAt: new Date()
    };
}

/**
 * Check if vendor is eligible for payout
 */
export function qzpayCheckPayoutEligibility(
    vendor: QZPayVendor,
    pendingAmount: number,
    minPayoutAmount: number = 0
): QZPayPayoutEligibility {
    if (!qzpayVendorIsActive(vendor)) {
        return {
            eligible: false,
            reason: 'Vendor is not active'
        };
    }

    if (!qzpayVendorCanReceivePayments(vendor)) {
        return {
            eligible: false,
            reason: 'Vendor has no payment account configured'
        };
    }

    if (pendingAmount < minPayoutAmount) {
        return {
            eligible: false,
            reason: `Minimum payout amount of ${minPayoutAmount} not reached`,
            nextEligibleDate: qzpayGetNextPayoutDate(vendor.payoutSchedule)
        };
    }

    return { eligible: true };
}

/**
 * Mark payout as processing
 */
export function qzpayMarkPayoutProcessing(payout: QZPayVendorPayout): QZPayVendorPayout {
    return {
        ...payout,
        status: 'processing'
    };
}

/**
 * Mark payout as paid
 */
export function qzpayMarkPayoutPaid(payout: QZPayVendorPayout, providerPayoutId?: { provider: string; id: string }): QZPayVendorPayout {
    const providerPayoutIds = { ...payout.providerPayoutIds };
    if (providerPayoutId) {
        providerPayoutIds[providerPayoutId.provider] = providerPayoutId.id;
    }

    return {
        ...payout,
        status: 'paid',
        paidAt: new Date(),
        providerPayoutIds
    };
}

/**
 * Mark payout as failed
 */
export function qzpayMarkPayoutFailed(payout: QZPayVendorPayout): QZPayVendorPayout {
    return {
        ...payout,
        status: 'failed'
    };
}

// ==================== Reporting Helpers ====================

/**
 * Calculate total earnings for a vendor
 */
export function qzpayCalculateVendorEarnings(payouts: QZPayVendorPayout[]): number {
    return payouts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Calculate pending earnings for a vendor
 */
export function qzpayCalculatePendingEarnings(payouts: QZPayVendorPayout[]): number {
    return payouts.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Get payouts by status
 */
export function qzpayFilterPayoutsByStatus(payouts: QZPayVendorPayout[], status: QZPayVendorPayout['status']): QZPayVendorPayout[] {
    return payouts.filter((p) => p.status === status);
}

/**
 * Get payouts within date range
 */
export function qzpayFilterPayoutsByDateRange(payouts: QZPayVendorPayout[], startDate: Date, endDate: Date): QZPayVendorPayout[] {
    return payouts.filter((p) => p.createdAt >= startDate && p.createdAt <= endDate);
}

// ==================== Revenue Share Helpers ====================

/**
 * Revenue share configuration
 */
export interface QZPayRevenueShareConfig {
    vendorRate: number; // Percentage to vendor
    platformRate: number; // Percentage to platform
    affiliateRate?: number; // Optional affiliate cut
    referralRate?: number; // Optional referral cut
}

/**
 * Calculate revenue shares
 */
export function qzpayCalculateRevenueShares(
    amount: number,
    config: QZPayRevenueShareConfig,
    affiliateId?: string,
    referrerId?: string
): {
    vendorAmount: number;
    platformAmount: number;
    affiliateAmount: number;
    referralAmount: number;
} {
    let remaining = amount;
    let affiliateAmount = 0;
    let referralAmount = 0;

    // Calculate affiliate cut first (if applicable)
    if (affiliateId && config.affiliateRate) {
        affiliateAmount = Math.round(amount * (config.affiliateRate / 100));
        remaining -= affiliateAmount;
    }

    // Calculate referral cut (if applicable)
    if (referrerId && config.referralRate) {
        referralAmount = Math.round(amount * (config.referralRate / 100));
        remaining -= referralAmount;
    }

    // Calculate vendor and platform shares from remaining
    const vendorAmount = Math.round(remaining * (config.vendorRate / (config.vendorRate + config.platformRate)));
    const platformAmount = remaining - vendorAmount;

    return {
        vendorAmount,
        platformAmount,
        affiliateAmount,
        referralAmount
    };
}
