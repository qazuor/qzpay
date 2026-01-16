/**
 * Common types shared across QZPay.
 */

/**
 * Allowed metadata value types.
 *
 * @remarks
 * Metadata values are restricted to JSON-serializable primitives to ensure
 * compatibility with databases and payment providers (Stripe, MercadoPago, etc.).
 *
 * Nested objects, arrays, and functions are not allowed to prevent serialization
 * issues and maintain consistent behavior across different storage backends.
 *
 * Note: `undefined` is allowed for convenience (e.g., to remove metadata keys),
 * but will be automatically removed by `qzpayAssertValidMetadata()` during validation.
 */
export type QZPayMetadataValue = string | number | boolean | null | undefined;

/**
 * Normalized metadata type for storing additional information.
 *
 * @remarks
 * Metadata is restricted to primitive values (string, number, boolean, null) for
 * reliable serialization to databases and payment providers.
 *
 * Constraints:
 * - Maximum 50 keys per object
 * - Maximum 500 characters per string value
 * - No nested objects or arrays
 * - No undefined values (use null instead)
 *
 * Use `qzpayAssertValidMetadata()` to validate metadata before storing.
 *
 * @example
 * ```typescript
 * const metadata: QZPayMetadata = {
 *   userId: 'user_123',
 *   tier: 'premium',
 *   isActive: true,
 *   signupDate: '2024-01-15',
 *   trialDays: 30,
 *   discount: null
 * };
 * ```
 *
 * @see qzpayAssertValidMetadata
 */
export type QZPayMetadata = Record<string, QZPayMetadataValue>;
