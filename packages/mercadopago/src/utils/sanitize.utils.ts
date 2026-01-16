/**
 * Input sanitization utilities for MercadoPago adapters
 */
import { qzpayIsValidEmail } from '@qazuor/qzpay-core';
import { QZPayErrorCode, QZPayMercadoPagoError } from './error-mapper.js';

/**
 * Sanitize email address.
 *
 * Performs the following operations:
 * - Trims whitespace
 * - Converts to lowercase
 * - Validates format using qzpayIsValidEmail
 *
 * @param email - The email address to sanitize
 * @returns Sanitized email address
 * @throws {QZPayMercadoPagoError} If email is invalid after sanitization
 *
 * @example
 * ```ts
 * sanitizeEmail('  User@Example.COM  ') // 'user@example.com'
 * sanitizeEmail('invalid@') // throws QZPayMercadoPagoError
 * ```
 */
export function sanitizeEmail(email: string): string {
    const sanitized = email.trim().toLowerCase();

    if (!qzpayIsValidEmail(sanitized)) {
        throw new QZPayMercadoPagoError(QZPayErrorCode.INVALID_REQUEST, `Invalid email format: ${email}`, undefined, undefined);
    }

    return sanitized;
}

/**
 * Sanitize name (person or business).
 *
 * Performs the following operations:
 * - Trims leading and trailing whitespace
 * - Removes dangerous characters (script injection, control chars)
 * - Normalizes multiple spaces to single space
 * - Allows: letters, numbers, spaces, hyphens, apostrophes, dots, accented chars
 *
 * @param name - The name to sanitize
 * @returns Sanitized name
 *
 * @example
 * ```ts
 * sanitizeName('  John   Doe  ') // 'John Doe'
 * sanitizeName("O'Brien-Smith Jr.") // "O'Brien-Smith Jr."
 * sanitizeName('José García') // 'José García'
 * sanitizeName('<script>alert("xss")</script>') // 'scriptalertxssscript'
 * ```
 */
export function sanitizeName(name: string): string {
    // Remove control characters and dangerous chars (but keep accented chars)
    // Allow: letters (including Unicode), numbers, spaces, hyphens, apostrophes, dots
    const sanitized = name
        // Remove control characters (0x00-0x1F, 0x7F-0x9F)
        // biome-ignore lint/suspicious/noControlCharactersInRegex: We explicitly want to remove control characters for security
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        // Remove potentially dangerous characters while preserving accented chars
        // Keep: alphanumeric, spaces, hyphen, apostrophe, dot, and Unicode letters
        .replace(/[^\p{L}\p{N}\s.\-']/gu, '')
        .trim()
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ');

    return sanitized;
}

/**
 * Sanitize phone number.
 *
 * Performs the following operations:
 * - Removes all whitespace
 * - Keeps only digits and leading plus sign
 * - Validates minimum length (at least 7 digits for international standards)
 *
 * @param phone - The phone number to sanitize
 * @returns Sanitized phone number (only digits and optional leading +)
 *
 * @example
 * ```ts
 * sanitizePhone('+1 (555) 123-4567') // '+15551234567'
 * sanitizePhone('555 123 4567') // '5551234567'
 * sanitizePhone('+54 9 11 1234-5678') // '+5491112345678'
 * ```
 */
export function sanitizePhone(phone: string): string {
    // Preserve leading + if present
    const hasPlus = phone.trim().startsWith('+');

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Reconstruct with + if it was present
    const sanitized = hasPlus ? `+${digitsOnly}` : digitsOnly;

    // Basic validation: phone numbers should have at least 7 digits
    // (some countries have very short numbers, 7 is a safe minimum)
    if (digitsOnly.length < 7) {
        throw new QZPayMercadoPagoError(
            QZPayErrorCode.INVALID_REQUEST,
            'Invalid phone number: must have at least 7 digits',
            undefined,
            undefined
        );
    }

    return sanitized;
}

/**
 * Sanitize optional field (returns null if empty after sanitization).
 *
 * Helper function for optional string fields. If the field is empty
 * or becomes empty after trimming, returns null instead of empty string.
 *
 * @param value - The value to sanitize
 * @param sanitizer - The sanitization function to apply
 * @returns Sanitized value or null if empty
 *
 * @example
 * ```ts
 * sanitizeOptional('  ', sanitizeName) // null
 * sanitizeOptional('John Doe', sanitizeName) // 'John Doe'
 * sanitizeOptional(undefined, sanitizeName) // null
 * ```
 */
export function sanitizeOptional<T extends string>(value: T | undefined | null, sanitizer: (val: string) => string): string | null {
    if (!value || value.trim() === '') {
        return null;
    }

    const sanitized = sanitizer(value);
    return sanitized.trim() === '' ? null : sanitized;
}
