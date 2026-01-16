import { QZPayError } from './base.error.js';

/**
 * Error thrown when input validation fails.
 *
 * @example
 * ```ts
 * if (!email.includes('@')) {
 *   throw new QZPayValidationError(
 *     'Invalid email format',
 *     'email',
 *     email
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * try {
 *   validateQuantity(quantity);
 * } catch (error) {
 *   if (error instanceof QZPayValidationError) {
 *     console.error(`Validation failed for ${error.field}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class QZPayValidationError extends QZPayError {
    /**
     * The field or parameter that failed validation.
     */
    public readonly field: string;

    /**
     * The invalid value that caused the validation error.
     */
    public readonly value: unknown;

    constructor(message: string, field: string, value?: unknown) {
        super(message, {
            field,
            valueType: value === null ? 'null' : typeof value
        });
        this.name = 'QZPayValidationError';
        this.field = field;
        this.value = value;
    }
}
