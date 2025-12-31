/**
 * Date utilities for QZPay
 */
import type { QZPayBillingInterval } from '../constants/index.js';

/**
 * Add interval to a date
 */
export function qzpayAddInterval(date: Date, interval: QZPayBillingInterval, count = 1): Date {
    const result = new Date(date);

    switch (interval) {
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
}

/**
 * Subtract interval from a date
 */
export function qzpaySubtractInterval(date: Date, interval: QZPayBillingInterval, count = 1): Date {
    return qzpayAddInterval(date, interval, -count);
}

/**
 * Get the start of a period (day, week, month, year)
 */
export function qzpayStartOfPeriod(date: Date, period: QZPayBillingInterval): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);

    switch (period) {
        case 'day':
            break;
        case 'week':
            result.setDate(result.getDate() - result.getDay());
            break;
        case 'month':
            result.setDate(1);
            break;
        case 'year':
            result.setMonth(0, 1);
            break;
    }

    return result;
}

/**
 * Get the end of a period (day, week, month, year)
 */
export function qzpayEndOfPeriod(date: Date, period: QZPayBillingInterval): Date {
    const result = qzpayStartOfPeriod(date, period);
    result.setMilliseconds(-1);

    switch (period) {
        case 'day':
            result.setDate(result.getDate() + 1);
            break;
        case 'week':
            result.setDate(result.getDate() + 7);
            break;
        case 'month':
            result.setMonth(result.getMonth() + 1);
            break;
        case 'year':
            result.setFullYear(result.getFullYear() + 1);
            break;
    }

    return result;
}

/**
 * Check if a date is in the past
 */
export function qzpayIsPast(date: Date): boolean {
    return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function qzpayIsFuture(date: Date): boolean {
    return date.getTime() > Date.now();
}

/**
 * Check if a date is today
 */
export function qzpayIsToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

/**
 * Get days until a date
 */
export function qzpayDaysUntil(date: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get days since a date
 */
export function qzpayDaysSince(date: Date): number {
    return -qzpayDaysUntil(date);
}

/**
 * Format date to ISO string (date only)
 */
export function qzpayFormatDate(date: Date): string {
    return date.toISOString().split('T')[0] ?? '';
}

/**
 * Format date to ISO string with time
 */
export function qzpayFormatDateTime(date: Date): string {
    return date.toISOString();
}

/**
 * Parse ISO date string to Date
 */
export function qzpayParseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${dateString}`);
    }
    return date;
}
