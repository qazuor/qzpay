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
 *
 * @throws {Error} If totalDays is less than or equal to 0
 */
export function qzpayCalculateProration(totalAmount: number, totalDays: number, usedDays: number): number {
    if (totalDays <= 0) {
        throw new Error('Cannot calculate proration: period has no days (daysInPeriod <= 0)');
    }
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

// ==================== Amount Overflow Protection ====================

/**
 * Maximum safe amount in cents (999,999,999.99 in dollars)
 * This prevents integer overflow in calculations while still allowing
 * extremely large amounts that are unlikely in practice.
 */
export const QZPAY_MAX_SAFE_AMOUNT = 99_999_999_999;

/**
 * Maximum safe amount for display purposes (999,999.99 in dollars)
 * This is the practical maximum for most billing scenarios.
 */
export const QZPAY_MAX_PRACTICAL_AMOUNT = 99_999_999;

/**
 * Error thrown when an amount calculation would overflow
 */
export class QZPayAmountOverflowError extends Error {
    constructor(
        message: string,
        public readonly operands: { a: number; b?: number },
        public readonly operation: 'add' | 'multiply' | 'calculate'
    ) {
        super(message);
        this.name = 'QZPayAmountOverflowError';
    }
}

/**
 * Validate that an amount does not exceed the safe maximum.
 *
 * @param amount - Amount in cents
 * @param maxAmount - Maximum allowed amount (defaults to MAX_SAFE_AMOUNT)
 * @returns true if amount is within safe range
 */
export function qzpayIsAmountSafe(amount: number, maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): boolean {
    return Number.isFinite(amount) && amount >= 0 && amount <= maxAmount;
}

/**
 * Assert that an amount is within safe range, throw if not.
 *
 * @param amount - Amount in cents
 * @param context - Optional context for error message
 * @param maxAmount - Maximum allowed amount
 * @throws {QZPayAmountOverflowError} If amount exceeds safe range
 */
export function qzpayAssertAmountSafe(amount: number, context?: string, maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): void {
    if (!qzpayIsAmountSafe(amount, maxAmount)) {
        const contextStr = context ? ` in ${context}` : '';
        throw new QZPayAmountOverflowError(
            `Amount ${amount}${contextStr} exceeds maximum safe value of ${maxAmount}`,
            { a: amount },
            'calculate'
        );
    }
}

/**
 * Safely add two amounts with overflow protection.
 *
 * @param a - First amount in cents
 * @param b - Second amount in cents
 * @param maxAmount - Maximum allowed result
 * @returns Sum of amounts
 * @throws {QZPayAmountOverflowError} If result would overflow
 */
export function qzpaySafeAddMoney(a: number, b: number, maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): number {
    qzpayAssertAmountSafe(a, 'first operand', maxAmount);
    qzpayAssertAmountSafe(b, 'second operand', maxAmount);

    const result = a + b;

    if (!qzpayIsAmountSafe(result, maxAmount)) {
        throw new QZPayAmountOverflowError(`Addition overflow: ${a} + ${b} = ${result} exceeds maximum ${maxAmount}`, { a, b }, 'add');
    }

    return result;
}

/**
 * Safely multiply amount by quantity with overflow protection.
 *
 * @param unitAmount - Unit amount in cents
 * @param quantity - Quantity (must be positive)
 * @param maxAmount - Maximum allowed result
 * @returns Product of unitAmount * quantity
 * @throws {QZPayAmountOverflowError} If result would overflow
 */
export function qzpaySafeMultiplyMoney(unitAmount: number, quantity: number, maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): number {
    qzpayAssertAmountSafe(unitAmount, 'unit amount', maxAmount);

    if (quantity < 0 || !Number.isFinite(quantity)) {
        throw new QZPayAmountOverflowError(
            `Invalid quantity: ${quantity}. Quantity must be a non-negative finite number.`,
            { a: unitAmount, b: quantity },
            'multiply'
        );
    }

    const result = Math.round(unitAmount * quantity);

    if (!qzpayIsAmountSafe(result, maxAmount)) {
        throw new QZPayAmountOverflowError(
            `Multiplication overflow: ${unitAmount} * ${quantity} = ${result} exceeds maximum ${maxAmount}`,
            { a: unitAmount, b: quantity },
            'multiply'
        );
    }

    return result;
}

/**
 * Calculate line item amount with overflow protection.
 *
 * This is the recommended function for calculating invoice line item totals.
 *
 * @param unitAmount - Unit price in cents
 * @param quantity - Quantity of items
 * @param maxAmount - Maximum allowed result
 * @returns Total amount for line item
 * @throws {QZPayAmountOverflowError} If result would overflow
 *
 * @example
 * ```typescript
 * // Calculate line item total
 * const total = qzpaySafeCalculateLineItemAmount(2999, 5); // 14995 cents
 *
 * // With custom max
 * const limited = qzpaySafeCalculateLineItemAmount(2999, 5, 10000);
 * // Throws QZPayAmountOverflowError
 * ```
 */
export function qzpaySafeCalculateLineItemAmount(unitAmount: number, quantity: number, maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): number {
    return qzpaySafeMultiplyMoney(unitAmount, quantity, maxAmount);
}

/**
 * Calculate invoice total with overflow protection.
 *
 * Sums an array of line item amounts with overflow checking.
 *
 * @param lineAmounts - Array of line item amounts in cents
 * @param maxAmount - Maximum allowed result
 * @returns Total invoice amount
 * @throws {QZPayAmountOverflowError} If result would overflow
 *
 * @example
 * ```typescript
 * const total = qzpayCalculateInvoiceTotal([1000, 2000, 3000]); // 6000
 * ```
 */
export function qzpayCalculateInvoiceTotal(lineAmounts: number[], maxAmount: number = QZPAY_MAX_SAFE_AMOUNT): number {
    let total = 0;

    for (const amount of lineAmounts) {
        total = qzpaySafeAddMoney(total, amount, maxAmount);
    }

    return total;
}
