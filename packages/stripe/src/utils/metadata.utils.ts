/**
 * Stripe Metadata Utilities
 *
 * Utilities for handling Stripe metadata with proper validation and limits
 *
 * STRIPE METADATA LIMITS:
 * - Maximum 50 keys per object
 * - Maximum 500 characters per value (after conversion to string)
 * - Keys must be strings
 * - Values are automatically converted to strings by Stripe
 *
 * Reference: https://docs.stripe.com/api/metadata
 */

/**
 * Stripe metadata constraints
 */
export const STRIPE_METADATA_LIMITS = {
    MAX_KEYS: 50,
    MAX_VALUE_LENGTH: 500
} as const;

/**
 * Converts QZPay metadata to Stripe-compatible format
 *
 * - Filters out undefined and null values
 * - Converts all values to strings
 * - Validates against Stripe metadata limits
 *
 * @param metadata - The metadata object to convert
 * @returns Stripe-compatible metadata object
 * @throws {Error} If metadata exceeds Stripe limits
 *
 * @example
 * ```ts
 * toStripeMetadata({ userId: 123, plan: 'premium' })
 * // Returns: { userId: '123', plan: 'premium' }
 *
 * toStripeMetadata({ active: true, createdAt: new Date() })
 * // Returns: { active: 'true', createdAt: '2025-01-15T...' }
 * ```
 */
export function toStripeMetadata(metadata: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    let keyCount = 0;

    for (const [key, value] of Object.entries(metadata)) {
        // Skip undefined and null values
        if (value === undefined || value === null) {
            continue;
        }

        keyCount++;

        // Validate key count
        if (keyCount > STRIPE_METADATA_LIMITS.MAX_KEYS) {
            throw new Error(`Metadata exceeds Stripe limit of ${STRIPE_METADATA_LIMITS.MAX_KEYS} keys`);
        }

        // Convert value to string
        const stringValue = String(value);

        // Validate value length
        if (stringValue.length > STRIPE_METADATA_LIMITS.MAX_VALUE_LENGTH) {
            throw new Error(
                `Metadata value for key '${key}' exceeds Stripe limit of ${STRIPE_METADATA_LIMITS.MAX_VALUE_LENGTH} characters ` +
                    `(current: ${stringValue.length})`
            );
        }

        result[key] = stringValue;
    }

    return result;
}

/**
 * Validates metadata against Stripe limits without conversion
 *
 * @param metadata - The metadata object to validate
 * @throws {Error} If metadata exceeds Stripe limits
 *
 * @example
 * ```ts
 * validateStripeMetadata({ userId: '123', plan: 'premium' }) // No error
 * validateStripeMetadata({ ...51 keys }) // Throws error
 * ```
 */
export function validateStripeMetadata(metadata: Record<string, unknown>): void {
    toStripeMetadata(metadata);
}
