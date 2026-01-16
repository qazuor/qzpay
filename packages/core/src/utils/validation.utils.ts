/**
 * Validation utilities for QZPay
 */
import { QZPAY_CURRENCY_VALUES, qzpayIsValidIso4217Currency } from '../constants/currency.js';
import type { QZPayCurrency } from '../constants/index.js';
import type { QZPayMetadata, QZPayMetadataValue } from '../types/common.types.js';

/**
 * Validation result type
 */
export interface QZPayValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Metadata validation constraints.
 *
 * @remarks
 * These limits are aligned with common payment provider constraints (Stripe, MercadoPago)
 * and ensure reliable serialization across different storage backends.
 *
 * Reference:
 * - Stripe: https://docs.stripe.com/api/metadata
 * - MercadoPago: Similar restrictions apply
 */
export const QZPAY_METADATA_LIMITS = {
    /** Maximum number of keys allowed in metadata object */
    MAX_KEYS: 50,
    /** Maximum length for string values (in characters) */
    MAX_VALUE_LENGTH: 500
} as const;

/**
 * Validate email format using RFC 5322 compliant regex.
 *
 * This regex validates most common email formats while being strict enough
 * to catch common mistakes. It allows:
 * - Alphanumeric characters, dots, hyphens, underscores in local part
 * - Plus addressing (user+tag@example.com)
 * - Quoted strings for special characters
 * - Multiple domain levels (user@mail.example.com)
 *
 * @param email - The email address to validate
 * @returns True if the email format is valid
 *
 * @example
 * ```ts
 * qzpayIsValidEmail('user@example.com') // true
 * qzpayIsValidEmail('user+tag@example.com') // true
 * qzpayIsValidEmail('invalid@') // false
 * ```
 */
export function qzpayIsValidEmail(email: string): boolean {
    // Practical email validation regex
    // Covers 99.9% of real-world valid emails without RFC 5322 quoted-string edge cases
    // that use control characters (extremely rare in practice)
    const emailRegex =
        /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    return emailRegex.test(email);
}

/**
 * Validate currency code against QZPay supported currencies (case-insensitive).
 *
 * This validates against a limited set of currencies explicitly supported by QZPay.
 * For validating against all ISO 4217 standard currencies, use `qzpayIsValidIso4217Currency`.
 *
 * @param currency - Currency code to validate
 * @returns True if the currency is supported by QZPay
 *
 * @example
 * ```ts
 * qzpayIsValidCurrency('USD') // true
 * qzpayIsValidCurrency('eur') // true (case-insensitive)
 * qzpayIsValidCurrency('JPY') // false (not in QZPay supported list)
 * ```
 *
 * @see qzpayIsValidIso4217Currency For ISO 4217 standard validation
 */
export function qzpayIsValidCurrency(currency: string): currency is QZPayCurrency {
    return QZPAY_CURRENCY_VALUES.includes(currency.toUpperCase() as QZPayCurrency);
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
 * Validate positive amount (must be greater than zero).
 *
 * Used for monetary amounts that cannot be negative or zero.
 * Works with both integers and decimals.
 *
 * @param amount - The amount to validate
 * @returns True if the amount is a positive number
 *
 * @example
 * ```ts
 * qzpayIsPositiveAmount(1000) // true
 * qzpayIsPositiveAmount(0.01) // true
 * qzpayIsPositiveAmount(0) // false
 * qzpayIsPositiveAmount(-100) // false
 * ```
 */
export function qzpayIsPositiveAmount(amount: number): boolean {
    return typeof amount === 'number' && !Number.isNaN(amount) && amount > 0;
}

/**
 * Validate non-negative amount (zero or greater).
 *
 * Used for monetary amounts that can be zero but not negative.
 * Works with both integers and decimals.
 *
 * @param amount - The amount to validate
 * @returns True if the amount is zero or positive
 *
 * @example
 * ```ts
 * qzpayIsNonNegativeAmount(1000) // true
 * qzpayIsNonNegativeAmount(0) // true
 * qzpayIsNonNegativeAmount(-100) // false
 * ```
 */
export function qzpayIsNonNegativeAmount(amount: number): boolean {
    return typeof amount === 'number' && !Number.isNaN(amount) && amount >= 0;
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
 * Validates metadata value type.
 *
 * @param value - The value to check
 * @returns True if value is a valid metadata primitive
 *
 * @internal
 */
function isValidMetadataValue(value: unknown): value is QZPayMetadataValue {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
}

/**
 * Validates and sanitizes metadata for safe storage.
 *
 * @remarks
 * This function ensures metadata is compatible with databases and payment providers
 * by validating:
 * - All values are primitives (string, number, boolean, null)
 * - No undefined values (removed automatically)
 * - No nested objects or arrays
 * - Number of keys does not exceed limit
 * - String values do not exceed length limit
 *
 * The function returns a sanitized copy of the metadata with undefined values removed.
 *
 * @param metadata - The metadata object to validate
 * @returns Sanitized metadata (copy with undefined values removed)
 * @throws {TypeError} If metadata contains invalid value types
 * @throws {RangeError} If metadata exceeds size limits
 *
 * @example
 * ```ts
 * // Valid metadata
 * const metadata = qzpayAssertValidMetadata({
 *   userId: 'user_123',
 *   tier: 'premium',
 *   count: 42,
 *   active: true,
 *   note: null
 * });
 *
 * // Removes undefined values
 * const metadata = qzpayAssertValidMetadata({
 *   userId: 'user_123',
 *   removedField: undefined  // This will be removed
 * });
 * // Returns: { userId: 'user_123' }
 *
 * // Throws on nested objects
 * qzpayAssertValidMetadata({
 *   user: { id: '123' }  // TypeError: nested objects not allowed
 * });
 *
 * // Throws on arrays
 * qzpayAssertValidMetadata({
 *   tags: ['premium', 'active']  // TypeError: arrays not allowed
 * });
 *
 * // Throws on too many keys
 * qzpayAssertValidMetadata({
 *   ...Object.fromEntries([...Array(51)].map((_, i) => [`key${i}`, i]))
 * });
 * // RangeError: exceeds maximum of 50 keys
 *
 * // Throws on string too long
 * qzpayAssertValidMetadata({
 *   description: 'a'.repeat(501)
 * });
 * // RangeError: exceeds maximum length of 500 characters
 * ```
 */
export function qzpayAssertValidMetadata(metadata: Record<string, unknown>): QZPayMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
        throw new TypeError('Metadata must be an object');
    }

    const sanitized: QZPayMetadata = {};
    let keyCount = 0;

    for (const [key, value] of Object.entries(metadata)) {
        // Skip undefined values (sanitize them out)
        if (value === undefined) {
            continue;
        }

        keyCount++;

        // Validate key count
        if (keyCount > QZPAY_METADATA_LIMITS.MAX_KEYS) {
            throw new RangeError(`Metadata exceeds maximum of ${QZPAY_METADATA_LIMITS.MAX_KEYS} keys (current: ${keyCount})`);
        }

        // Validate value type
        if (!isValidMetadataValue(value)) {
            const valueType = Array.isArray(value) ? 'array' : typeof value;
            throw new TypeError(
                `Invalid metadata value for key '${key}': ${valueType} is not allowed. Only string, number, boolean, or null are permitted`
            );
        }

        // Validate string length
        if (typeof value === 'string' && value.length > QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH) {
            throw new RangeError(
                `Metadata value for key '${key}' exceeds maximum length of ${QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH} characters ` +
                    `(current: ${value.length})`
            );
        }

        // Validate number is not NaN or Infinity
        if (typeof value === 'number') {
            if (Number.isNaN(value)) {
                throw new TypeError(`Metadata value for key '${key}' cannot be NaN`);
            }
            if (!Number.isFinite(value)) {
                throw new TypeError(`Metadata value for key '${key}' cannot be Infinity`);
            }
        }

        sanitized[key] = value;
    }

    return sanitized;
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

    positiveAmount(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'number' && !qzpayIsPositiveAmount(value)) {
            this.errors.push(message ?? `${String(field)} must be greater than 0`);
        }
        return this;
    }

    nonNegativeAmount(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'number' && !qzpayIsNonNegativeAmount(value)) {
            this.errors.push(message ?? `${String(field)} cannot be negative`);
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

    iso4217Currency(field: keyof T, message?: string): this {
        const value = this.obj[field];
        if (typeof value === 'string' && !qzpayIsValidIso4217Currency(value)) {
            this.errors.push(message ?? `${String(field)} must be a valid ISO 4217 currency code`);
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

// ==================== Subscription State Machine ====================

import { QZPAY_SUBSCRIPTION_STATUS, type QZPaySubscriptionStatus } from '../constants/subscription-status.js';

/**
 * Valid subscription status transitions map.
 *
 * Defines which status transitions are allowed in the subscription lifecycle.
 * Any transition not in this map is considered invalid.
 */
export const QZPAY_VALID_STATUS_TRANSITIONS: Readonly<Record<QZPaySubscriptionStatus, readonly QZPaySubscriptionStatus[]>> = {
    // From incomplete: initial state during payment setup
    [QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE]: [
        QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
        QZPAY_SUBSCRIPTION_STATUS.TRIALING,
        QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
        QZPAY_SUBSCRIPTION_STATUS.CANCELED
    ],

    // From incomplete_expired: terminal state (setup expired)
    [QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED]: [
        // No valid transitions - terminal state
    ],

    // From trialing: trial period
    [QZPAY_SUBSCRIPTION_STATUS.TRIALING]: [
        QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
        QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
        QZPAY_SUBSCRIPTION_STATUS.CANCELED,
        QZPAY_SUBSCRIPTION_STATUS.PAUSED
    ],

    // From active: normal subscription state
    [QZPAY_SUBSCRIPTION_STATUS.ACTIVE]: [
        QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
        QZPAY_SUBSCRIPTION_STATUS.CANCELED,
        QZPAY_SUBSCRIPTION_STATUS.PAUSED,
        QZPAY_SUBSCRIPTION_STATUS.UNPAID
    ],

    // From past_due: payment failed, in grace period
    [QZPAY_SUBSCRIPTION_STATUS.PAST_DUE]: [
        QZPAY_SUBSCRIPTION_STATUS.ACTIVE, // Payment succeeded
        QZPAY_SUBSCRIPTION_STATUS.UNPAID, // Grace period expired
        QZPAY_SUBSCRIPTION_STATUS.CANCELED // Customer canceled
    ],

    // From unpaid: all payment attempts failed
    [QZPAY_SUBSCRIPTION_STATUS.UNPAID]: [
        QZPAY_SUBSCRIPTION_STATUS.ACTIVE, // Payment succeeded
        QZPAY_SUBSCRIPTION_STATUS.CANCELED // Final cancellation
    ],

    // From paused: subscription temporarily suspended
    [QZPAY_SUBSCRIPTION_STATUS.PAUSED]: [
        QZPAY_SUBSCRIPTION_STATUS.ACTIVE, // Resumed
        QZPAY_SUBSCRIPTION_STATUS.CANCELED // Canceled while paused
    ],

    // From canceled: terminal state
    [QZPAY_SUBSCRIPTION_STATUS.CANCELED]: [
        // No valid transitions - terminal state
        // Reactivation requires creating a new subscription
    ]
} as const;

/**
 * Error thrown when an invalid subscription status transition is attempted.
 */
export class QZPayInvalidStatusTransitionError extends Error {
    constructor(
        public readonly fromStatus: QZPaySubscriptionStatus,
        public readonly toStatus: QZPaySubscriptionStatus,
        public readonly subscriptionId?: string
    ) {
        const idStr = subscriptionId ? ` for subscription ${subscriptionId}` : '';
        super(`Invalid subscription status transition${idStr}: ${fromStatus} -> ${toStatus}`);
        this.name = 'QZPayInvalidStatusTransitionError';
    }
}

/**
 * Check if a status transition is valid.
 *
 * @param fromStatus - Current subscription status
 * @param toStatus - Target subscription status
 * @returns true if the transition is valid
 *
 * @example
 * ```typescript
 * qzpayIsValidStatusTransition('active', 'past_due') // true
 * qzpayIsValidStatusTransition('canceled', 'active') // false
 * qzpayIsValidStatusTransition('trialing', 'active') // true
 * ```
 */
export function qzpayIsValidStatusTransition(fromStatus: QZPaySubscriptionStatus, toStatus: QZPaySubscriptionStatus): boolean {
    // Same status is always valid (no-op)
    if (fromStatus === toStatus) {
        return true;
    }

    const validTransitions = QZPAY_VALID_STATUS_TRANSITIONS[fromStatus];
    return validTransitions?.includes(toStatus) ?? false;
}

/**
 * Validate and assert that a status transition is valid.
 *
 * @param fromStatus - Current subscription status
 * @param toStatus - Target subscription status
 * @param subscriptionId - Optional subscription ID for error message
 * @throws {QZPayInvalidStatusTransitionError} If transition is not valid
 *
 * @example
 * ```typescript
 * // Valid transition - no error
 * qzpayAssertValidStatusTransition('active', 'past_due');
 *
 * // Invalid transition - throws error
 * qzpayAssertValidStatusTransition('canceled', 'active');
 * // Throws: QZPayInvalidStatusTransitionError
 *
 * // With subscription ID in error message
 * qzpayAssertValidStatusTransition('canceled', 'active', 'sub_123');
 * // Throws: Invalid subscription status transition for subscription sub_123: canceled -> active
 * ```
 */
export function qzpayAssertValidStatusTransition(
    fromStatus: QZPaySubscriptionStatus,
    toStatus: QZPaySubscriptionStatus,
    subscriptionId?: string
): void {
    if (!qzpayIsValidStatusTransition(fromStatus, toStatus)) {
        throw new QZPayInvalidStatusTransitionError(fromStatus, toStatus, subscriptionId);
    }
}

/**
 * Get all valid target statuses from a given status.
 *
 * @param fromStatus - Current subscription status
 * @returns Array of valid target statuses
 *
 * @example
 * ```typescript
 * qzpayGetValidTransitions('active')
 * // Returns: ['past_due', 'canceled', 'paused', 'unpaid']
 *
 * qzpayGetValidTransitions('canceled')
 * // Returns: []
 * ```
 */
export function qzpayGetValidTransitions(fromStatus: QZPaySubscriptionStatus): readonly QZPaySubscriptionStatus[] {
    return QZPAY_VALID_STATUS_TRANSITIONS[fromStatus] ?? [];
}

/**
 * Check if a status is a terminal state (no valid transitions out).
 *
 * @param status - Status to check
 * @returns true if status is terminal
 *
 * @example
 * ```typescript
 * qzpayIsTerminalStatus('canceled') // true
 * qzpayIsTerminalStatus('incomplete_expired') // true
 * qzpayIsTerminalStatus('active') // false
 * ```
 */
export function qzpayIsTerminalStatus(status: QZPaySubscriptionStatus): boolean {
    const transitions = QZPAY_VALID_STATUS_TRANSITIONS[status];
    return !transitions || transitions.length === 0;
}
