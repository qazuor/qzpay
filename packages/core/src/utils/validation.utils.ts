/**
 * Validation utilities for QZPay
 */
import { QZPAY_CURRENCY_VALUES } from '../constants/currency.js';
import type { QZPayCurrency } from '../constants/index.js';

/**
 * Validation result type
 */
export interface QZPayValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate email format
 */
export function qzpayIsValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate currency code
 */
export function qzpayIsValidCurrency(currency: string): currency is QZPayCurrency {
    return QZPAY_CURRENCY_VALUES.includes(currency as QZPayCurrency);
}

/**
 * Validate positive integer
 */
export function qzpayIsPositiveInteger(value: number): boolean {
    return Number.isInteger(value) && value > 0;
}

/**
 * Validate non-negative integer
 */
export function qzpayIsNonNegativeInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
}

/**
 * Validate percentage (0-100)
 */
export function qzpayIsValidPercentage(value: number): boolean {
    return value >= 0 && value <= 100;
}

/**
 * Validate UUID format
 */
export function qzpayIsValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Validate required string
 */
export function qzpayIsRequiredString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate required fields in an object
 */
export function qzpayValidateRequired<T extends Record<string, unknown>>(obj: T, requiredFields: (keyof T)[]): QZPayValidationResult {
    const errors: string[] = [];

    for (const field of requiredFields) {
        const value = obj[field];
        if (value === undefined || value === null || value === '') {
            errors.push(`${String(field)} is required`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Assert condition, throw if false
 */
export function qzpayAssert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Assert value is defined
 */
export function qzpayAssertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(`${name} is required`);
    }
}

/**
 * Create a validation builder
 */
export function qzpayCreateValidator<T extends Record<string, unknown>>(obj: T): QZPayValidator<T> {
    return new QZPayValidator(obj);
}

export class QZPayValidator<T extends Record<string, unknown>> {
    private errors: string[] = [];

    constructor(private readonly obj: T) {}

    required(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (value === undefined || value === null || value === '') {
            this.errors.push(message ?? `${String(field)} is required`);
        }
        return this;
    }

    email(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'string' && !qzpayIsValidEmail(value)) {
            this.errors.push(message ?? `${String(field)} must be a valid email`);
        }
        return this;
    }

    positiveInteger(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'number' && !qzpayIsPositiveInteger(value)) {
            this.errors.push(message ?? `${String(field)} must be a positive integer`);
        }
        return this;
    }

    currency(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'string' && !qzpayIsValidCurrency(value)) {
            this.errors.push(message ?? `${String(field)} must be a valid currency`);
        }
        return this;
    }

    custom(condition: boolean, message: string): this {
        if (!condition) {
            this.errors.push(message);
        }
        return this;
    }

    validate(): QZPayValidationResult {
        return {
            valid: this.errors.length === 0,
            errors: [...this.errors]
        };
    }

    assertValid(): void {
        if (this.errors.length > 0) {
            throw new Error(`Validation failed: ${this.errors.join(', ')}`);
        }
    }
}
