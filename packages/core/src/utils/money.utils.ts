/**
 * Money utilities for QZPay
 * All amounts are stored in cents (smallest currency unit)
 */
import type { QZPayCurrency } from '../constants/index.js';

/**
 * Currency decimal places configuration
 */
const CURRENCY_DECIMALS: Record<string, number> = {
    USD: 2,
    EUR: 2,
    GBP: 2,
    ARS: 2,
    BRL: 2,
    MXN: 2,
    CLP: 0,
    COP: 2,
    PEN: 2,
    UYU: 2
};

/**
 * Get decimal places for a currency
 */
export function qzpayGetCurrencyDecimals(currency: QZPayCurrency): number {
    return CURRENCY_DECIMALS[currency] ?? 2;
}

/**
 * Convert amount from cents to decimal
 */
export function qzpayCentsToDecimal(cents: number, currency: QZPayCurrency): number {
    const decimals = qzpayGetCurrencyDecimals(currency);
    return cents / 10 ** decimals;
}

/**
 * Convert amount from decimal to cents
 */
export function qzpayDecimalToCents(amount: number, currency: QZPayCurrency): number {
    const decimals = qzpayGetCurrencyDecimals(currency);
    return Math.round(amount * 10 ** decimals);
}

/**
 * Format amount in cents to display string
 */
export function qzpayFormatMoney(cents: number, currency: QZPayCurrency, locale = 'en-US'): string {
    const decimals = qzpayGetCurrencyDecimals(currency);
    const amount = cents / 10 ** decimals;

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
}

/**
 * Add two amounts in cents
 */
export function qzpayAddMoney(a: number, b: number): number {
    return a + b;
}

/**
 * Subtract two amounts in cents
 */
export function qzpaySubtractMoney(a: number, b: number): number {
    return a - b;
}

/**
 * Multiply amount by a factor
 */
export function qzpayMultiplyMoney(amount: number, factor: number): number {
    return Math.round(amount * factor);
}

/**
 * Calculate percentage of an amount
 */
export function qzpayPercentageOf(amount: number, percentage: number): number {
    return Math.round((amount * percentage) / 100);
}

/**
 * Apply percentage discount
 */
export function qzpayApplyPercentageDiscount(amount: number, percentage: number): number {
    return amount - qzpayPercentageOf(amount, percentage);
}

/**
 * Apply fixed discount
 */
export function qzpayApplyFixedDiscount(amount: number, discount: number): number {
    return Math.max(0, amount - discount);
}

/**
 * Calculate proration amount
 */
export function qzpayCalculateProration(totalAmount: number, totalDays: number, usedDays: number): number {
    if (totalDays === 0) return 0;
    const dailyRate = totalAmount / totalDays;
    return Math.round(dailyRate * usedDays);
}

/**
 * Split amount between parties (for marketplace)
 */
export function qzpaySplitAmount(amount: number, platformFeePercent: number): { platformFee: number; vendorAmount: number } {
    const platformFee = qzpayPercentageOf(amount, platformFeePercent);
    const vendorAmount = amount - platformFee;
    return { platformFee, vendorAmount };
}

/**
 * Check if amount is valid (positive integer)
 */
export function qzpayIsValidAmount(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0;
}

/**
 * Ensure amount is valid, throw if not
 */
export function qzpayAssertValidAmount(amount: number): void {
    if (!qzpayIsValidAmount(amount)) {
        throw new Error(`Invalid amount: ${amount}. Amount must be a non-negative integer (cents).`);
    }
}
