/**
 * Transaction utilities for QZPay Drizzle
 *
 * Provides transaction context propagation to ensure proper rollback
 * and isolation of database operations.
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

/**
 * Transaction type with proper schema support
 */
export type QZPayTransaction = PgTransaction<
    PostgresJsQueryResultHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
>;

/**
 * Transaction context type
 * Can be either a database connection or a transaction
 */
export type QZPayTransactionContext = PostgresJsDatabase | QZPayTransaction;

/**
 * Check if the context is a transaction
 */
export function isTransaction(ctx: QZPayTransactionContext): ctx is QZPayTransaction {
    return 'rollback' in ctx;
}

/**
 * Execute a callback within a database transaction.
 *
 * If the callback completes successfully, the transaction is committed.
 * If the callback throws an error, the transaction is rolled back and the error is propagated.
 *
 * @param db - Database connection
 * @param fn - Callback function that receives the transaction context
 * @returns The result of the callback
 * @throws Error if the callback fails (after rollback)
 *
 * @example
 * ```typescript
 * // Create invoice with lines in a transaction
 * const result = await withTransaction(db, async (tx) => {
 *   const invoice = await invoiceRepo.create(tx, invoiceData);
 *   const lines = await Promise.all(
 *     lineItems.map(line => invoiceRepo.createLine(tx, line))
 *   );
 *   return { invoice, lines };
 * });
 * ```
 */
export async function withTransaction<T>(db: PostgresJsDatabase, fn: (tx: QZPayTransaction) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
        return fn(tx);
    });
}

/**
 * Execute multiple operations in a transaction with automatic rollback on failure.
 *
 * This is a convenience wrapper around withTransaction that provides
 * a cleaner API for sequential operations.
 *
 * @param db - Database connection
 * @param operations - Array of operations to execute
 * @returns Array of operation results
 * @throws Error if any operation fails (after rollback)
 *
 * @example
 * ```typescript
 * const [subscription, usage] = await transactional(db, [
 *   async (tx) => subscriptionRepo.create(tx, subData),
 *   async (tx) => promoCodeRepo.recordUsage(tx, usageData),
 * ]);
 * ```
 */
export async function transactional<T extends unknown[]>(
    db: PostgresJsDatabase,
    operations: Array<(tx: QZPayTransaction) => Promise<unknown>>
): Promise<T> {
    return withTransaction(db, async (tx) => {
        const results: unknown[] = [];
        for (const operation of operations) {
            const result = await operation(tx);
            results.push(result);
        }
        return results as T;
    });
}

/**
 * Retry a transaction operation with exponential backoff.
 *
 * Useful for handling transient errors like deadlocks or serialization failures.
 *
 * @param db - Database connection
 * @param fn - Transaction callback
 * @param options - Retry options
 * @returns The result of the transaction
 * @throws Error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryTransaction(db, async (tx) => {
 *   // Operation that might fail due to deadlock
 *   return await updateWithConflict(tx, data);
 * }, { maxRetries: 3, baseDelay: 100 });
 * ```
 */
export async function retryTransaction<T>(
    db: PostgresJsDatabase,
    fn: (tx: QZPayTransaction) => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
        shouldRetry?: (error: Error) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelay = 100,
        maxDelay = 1000,
        shouldRetry = (error: Error) => {
            // Retry on common transient errors
            const message = error.message.toLowerCase();
            return (
                message.includes('deadlock') ||
                message.includes('serialization') ||
                message.includes('could not serialize') ||
                message.includes('concurrent update')
            );
        }
    } = options;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            return await withTransaction(db, fn);
        } catch (error) {
            lastError = error as Error;

            // Don't retry if we've exhausted attempts or error is not retryable
            if (attempt >= maxRetries || !shouldRetry(lastError)) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
            await new Promise((resolve) => setTimeout(resolve, delay));

            attempt++;
        }
    }

    // This should never happen, but TypeScript needs it
    throw lastError ?? new Error('Transaction failed after retries');
}

/**
 * Transaction isolation levels supported by PostgreSQL
 */
export type QZPayIsolationLevel = 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';

/**
 * Execute a transaction with a specific isolation level.
 *
 * @param db - Database connection
 * @param isolationLevel - Transaction isolation level
 * @param fn - Transaction callback
 * @returns The result of the transaction
 *
 * @example
 * ```typescript
 * // Use serializable isolation for critical operations
 * const result = await withIsolationLevel(
 *   db,
 *   'serializable',
 *   async (tx) => {
 *     const balance = await getBalance(tx, accountId);
 *     if (balance >= amount) {
 *       return await deductBalance(tx, accountId, amount);
 *     }
 *     throw new Error('Insufficient funds');
 *   }
 * );
 * ```
 */
export async function withIsolationLevel<T>(
    db: PostgresJsDatabase,
    isolationLevel: QZPayIsolationLevel,
    fn: (tx: QZPayTransaction) => Promise<T>
): Promise<T> {
    return withTransaction(db, async (tx) => {
        // Set isolation level for this transaction
        await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel.toUpperCase()}`);
        return fn(tx);
    });
}

/**
 * Transaction configuration options
 */
export interface QZPayTransactionOptions {
    /**
     * Isolation level for the transaction
     */
    isolationLevel?: QZPayIsolationLevel;

    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;

    /**
     * Whether to automatically retry on transient errors
     */
    autoRetry?: boolean;

    /**
     * Custom retry strategy
     */
    shouldRetry?: (error: Error) => boolean;
}

/**
 * Execute a transaction with custom configuration.
 *
 * @param db - Database connection
 * @param options - Transaction options
 * @param fn - Transaction callback
 * @returns The result of the transaction
 *
 * @example
 * ```typescript
 * const result = await executeTransaction(db, {
 *   isolationLevel: 'serializable',
 *   autoRetry: true,
 *   maxRetries: 3
 * }, async (tx) => {
 *   return await criticalOperation(tx);
 * });
 * ```
 */
export async function executeTransaction<T>(
    db: PostgresJsDatabase,
    options: QZPayTransactionOptions,
    fn: (tx: QZPayTransaction) => Promise<T>
): Promise<T> {
    const { isolationLevel, autoRetry = false, maxRetries, shouldRetry } = options;

    const executeFn = async (tx: QZPayTransaction) => {
        if (isolationLevel) {
            await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel.toUpperCase()}`);
        }
        return fn(tx);
    };

    if (autoRetry) {
        // Build retry options object conditionally to satisfy exactOptionalPropertyTypes
        const retryOptions: { maxRetries?: number; shouldRetry?: (error: Error) => boolean } = {};
        if (maxRetries !== undefined) {
            retryOptions.maxRetries = maxRetries;
        }
        if (shouldRetry !== undefined) {
            retryOptions.shouldRetry = shouldRetry;
        }
        return retryTransaction(db, executeFn, retryOptions);
    }

    return withTransaction(db, executeFn);
}
