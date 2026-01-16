import type { QZPayMetadata } from '../types/common.types.js';
import { QZPayError } from './base.error.js';
import { QZPayErrorCode } from './error-codes.js';

/**
 * Error thrown when synchronization with a payment provider fails.
 *
 * This error is used specifically for operations that attempt to sync
 * data with external payment providers (Stripe, MercadoPago, etc.).
 *
 * @example
 * ```ts
 * try {
 *   await paymentAdapter.customers.create(input);
 * } catch (error) {
 *   throw new QZPayProviderSyncError(
 *     'Failed to create customer in Stripe',
 *     'stripe',
 *     'create_customer',
 *     { customerId: customer.id },
 *     error instanceof Error ? error : undefined
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * try {
 *   await billing.customers.create(input);
 * } catch (error) {
 *   if (error instanceof QZPayProviderSyncError) {
 *     console.error(`Provider ${error.provider} sync failed during ${error.operation}`);
 *     console.error(`Underlying error: ${error.cause?.message}`);
 *   }
 * }
 * ```
 */
export class QZPayProviderSyncError extends QZPayError {
    /**
     * The payment provider that failed (e.g., 'stripe', 'mercadopago').
     */
    public readonly provider: string;

    /**
     * The operation that was being performed when the error occurred.
     */
    public readonly operation: string;

    /**
     * The underlying error that caused the sync failure, if available.
     */
    public readonly cause?: Error | undefined;

    constructor(message: string, provider: string, operation: string, metadata?: QZPayMetadata, cause?: Error | undefined) {
        super(message, {
            ...metadata,
            provider,
            operation,
            code: QZPayErrorCode.PROVIDER_SYNC_FAILED,
            causeMessage: cause?.message ?? null
        });
        this.name = 'QZPayProviderSyncError';
        this.provider = provider;
        this.operation = operation;
        this.cause = cause;

        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
