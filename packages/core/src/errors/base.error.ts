import type { QZPayMetadata } from '../types/common.types.js';

/**
 * Base error class for QZPay errors.
 *
 * @example
 * ```ts
 * class MyCustomError extends QZPayError {
 *   constructor(message: string) {
 *     super(message);
 *     this.name = 'MyCustomError';
 *   }
 * }
 * ```
 */
export class QZPayError extends Error {
    /**
     * Optional metadata associated with the error.
     * Normalized to only contain string, number, boolean, null, or undefined values.
     */
    public readonly metadata?: QZPayMetadata | undefined;

    constructor(message: string, metadata?: QZPayMetadata | undefined) {
        super(message);
        this.name = 'QZPayError';
        this.metadata = metadata;

        // Maintains proper stack trace for where error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
