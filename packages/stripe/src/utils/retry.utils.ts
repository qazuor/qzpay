/**
 * Retry Utilities with Exponential Backoff
 *
 * Provides retry logic for transient errors with configurable exponential backoff.
 * Only retries on errors that are likely to succeed on retry (network, rate limiting, server errors).
 */

import { QZPayError, QZPayErrorCode } from './error.utils.js';

/**
 * Retry configuration options
 */
export interface RetryConfig {
    /**
     * Enable or disable retry logic
     * @default true
     */
    enabled: boolean;

    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxAttempts: number;

    /**
     * Initial delay in milliseconds before first retry
     * @default 1000 (1 second)
     */
    initialDelayMs: number;

    /**
     * Maximum delay in milliseconds between retries
     * @default 8000 (8 seconds)
     */
    maxDelayMs: number;

    /**
     * Backoff multiplier (delay doubles each retry by default)
     * @default 2
     */
    backoffMultiplier: number;

    /**
     * Custom logger function for retry attempts
     */
    logger?: (message: string, context: Record<string, unknown>) => void;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    backoffMultiplier: 2
};

/**
 * Check if error is retriable (transient error that might succeed on retry)
 *
 * Retriable errors:
 * - Network errors / timeouts
 * - Rate limiting (429)
 * - Server errors (5xx)
 *
 * Non-retriable errors:
 * - Validation errors (400)
 * - Authentication (401, 403)
 * - Not found (404)
 * - Card errors
 */
export function isRetriableError(error: unknown): boolean {
    // Handle QZPay errors
    if (error instanceof QZPayError) {
        const retriableCodes: QZPayErrorCode[] = [
            QZPayErrorCode.RATE_LIMIT_EXCEEDED,
            QZPayErrorCode.API_ERROR,
            QZPayErrorCode.CONNECTION_ERROR,
            QZPayErrorCode.TIMEOUT_ERROR
        ];

        return retriableCodes.includes(error.code);
    }

    // Handle native errors
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        // Network and timeout errors
        if (
            message.includes('timeout') ||
            message.includes('network') ||
            message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('etimedout') ||
            errorName.includes('timeout')
        ) {
            return true;
        }

        // Rate limiting
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return true;
        }

        // Server errors
        if (message.includes('internal server error') || message.includes('service unavailable')) {
            return true;
        }
    }

    // Handle errors with status codes
    if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;

        // Retry on:
        // - 429 (Rate Limit)
        // - 500 (Internal Server Error)
        // - 502 (Bad Gateway)
        // - 503 (Service Unavailable)
        // - 504 (Gateway Timeout)
        return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    }

    return false;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelayMs * config.backoffMultiplier ** (attempt - 1);
    return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute operation with retry logic
 *
 * @param operation - Async operation to execute
 * @param config - Retry configuration
 * @param context - Context string for logging (e.g., "Create payment")
 * @returns Result of the operation
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *     () => stripe.paymentIntents.create(params),
 *     { maxAttempts: 3, initialDelayMs: 1000 },
 *     "Create PaymentIntent"
 * );
 * ```
 */
export async function withRetry<T>(operation: () => Promise<T>, config: Partial<RetryConfig> = {}, context = 'Operation'): Promise<T> {
    const finalConfig: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        ...config
    };

    // If retry is disabled, execute once
    if (!finalConfig.enabled) {
        return operation();
    }

    let lastError: unknown;
    let attempt = 0;

    while (attempt < finalConfig.maxAttempts) {
        attempt++;

        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            const shouldRetry = isRetriableError(error);
            const isLastAttempt = attempt >= finalConfig.maxAttempts;

            if (!shouldRetry || isLastAttempt) {
                // Log final failure
                if (finalConfig.logger) {
                    finalConfig.logger(`${context} failed after ${attempt} attempt(s)`, {
                        attempt,
                        error: error instanceof Error ? error.message : String(error),
                        retriable: shouldRetry
                    });
                }
                throw error;
            }

            // Calculate delay and retry
            const delay = calculateDelay(attempt, finalConfig);

            // Log retry attempt
            if (finalConfig.logger) {
                finalConfig.logger(`${context} failed, retrying in ${delay}ms`, {
                    attempt,
                    maxAttempts: finalConfig.maxAttempts,
                    delay,
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            await sleep(delay);
        }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError;
}

/**
 * Create a retry wrapper function with preset configuration
 *
 * @param config - Default retry configuration
 * @returns Function to execute operations with retry
 *
 * @example
 * ```typescript
 * const retryFn = createRetryWrapper({ maxAttempts: 5 });
 * const result = await retryFn(() => apiCall(), "API Call");
 * ```
 */
export function createRetryWrapper(config: Partial<RetryConfig> = {}) {
    return <T>(operation: () => Promise<T>, context?: string): Promise<T> => {
        return withRetry(operation, config, context);
    };
}
