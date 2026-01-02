/**
 * Optimistic locking utilities for QZPay Drizzle
 *
 * Provides helpers for implementing optimistic locking to prevent concurrent update conflicts.
 * Uses a version column (UUID) that changes with each update.
 */
import type { SQL } from 'drizzle-orm';
import { and, eq, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { QZPayOptimisticLockError } from '../repositories/base.repository.js';

/**
 * Generate a new version token
 *
 * @example
 * ```typescript
 * const version = generateVersion();
 * // 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateVersion(): string {
    return crypto.randomUUID();
}

/**
 * Create a WHERE clause that includes version check for optimistic locking
 *
 * @example
 * ```typescript
 * const where = withVersionCheck(
 *   eq(billingCustomers.id, customerId),
 *   billingCustomers.version,
 *   expectedVersion
 * );
 * // Returns: and(eq(id, customerId), eq(version, expectedVersion))
 * ```
 */
export function withVersionCheck<TVersion extends PgColumn>(idCondition: SQL, versionColumn: TVersion, expectedVersion: string): SQL {
    const condition = and(idCondition, eq(versionColumn, expectedVersion));
    if (!condition) {
        throw new Error('Failed to build version check condition');
    }
    return condition;
}

/**
 * Add version update to SET clause
 *
 * @example
 * ```typescript
 * const updateData = withNewVersion({ name: 'Updated Name' });
 * // { name: 'Updated Name', version: 'new-uuid' }
 * ```
 */
export function withNewVersion<T extends Record<string, unknown>>(updateData: T): T & { version: string } {
    return {
        ...updateData,
        version: generateVersion()
    };
}

/**
 * Result of an optimistic update operation
 */
export interface QZPayOptimisticUpdateResult<T> {
    /** Whether the update was successful */
    success: boolean;
    /** The updated record (if successful) */
    data: T | null;
    /** The new version (if successful) */
    newVersion: string | null;
    /** Number of rows affected */
    rowsAffected: number;
}

/**
 * Verify update result and throw if no rows were affected
 *
 * @example
 * ```typescript
 * const result = await db.update(billingCustomers)
 *   .set(updateData)
 *   .where(withVersionCheck(...))
 *   .returning();
 *
 * verifyOptimisticUpdate(result, 'customer', customerId);
 * ```
 */
export function verifyOptimisticUpdate<T>(result: T[], entityType: string, entityId: string): T {
    if (result.length === 0) {
        throw new QZPayOptimisticLockError(entityType, entityId);
    }
    return result[0] as T;
}

/**
 * Retry options for optimistic locking operations
 */
export interface QZPayOptimisticRetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Delay between retries in milliseconds (default: 100) */
    retryDelay?: number;
    /** Exponential backoff multiplier (default: 2) */
    backoffMultiplier?: number;
    /** Maximum delay between retries in milliseconds (default: 1000) */
    maxDelay?: number;
}

/**
 * Execute an operation with automatic retry on optimistic lock conflicts
 *
 * @example
 * ```typescript
 * const result = await withOptimisticRetry(async () => {
 *   const current = await repo.findById(id);
 *   if (!current) throw new Error('Not found');
 *
 *   return repo.updateWithVersion(id, current.version, { name: 'New Name' });
 * }, { maxRetries: 5 });
 * ```
 */
export async function withOptimisticRetry<T>(operation: () => Promise<T>, options?: QZPayOptimisticRetryOptions): Promise<T> {
    const { maxRetries = 3, retryDelay = 100, backoffMultiplier = 2, maxDelay = 1000 } = options ?? {};

    let lastError: Error | undefined;
    let currentDelay = retryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof QZPayOptimisticLockError && attempt < maxRetries) {
                lastError = error;
                await sleep(currentDelay);
                currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
                continue;
            }
            throw error;
        }
    }

    throw lastError ?? new Error('Unexpected error in withOptimisticRetry');
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is an optimistic lock error
 *
 * @example
 * ```typescript
 * try {
 *   await repo.update(id, data);
 * } catch (error) {
 *   if (isOptimisticLockError(error)) {
 *     console.log('Conflict detected, please retry');
 *   }
 * }
 * ```
 */
export function isOptimisticLockError(error: unknown): error is QZPayOptimisticLockError {
    return error instanceof QZPayOptimisticLockError;
}

/**
 * Create a compare-and-swap condition for atomic updates
 *
 * @example
 * ```typescript
 * const cas = compareAndSwap(
 *   billingSubscriptions.status,
 *   'active',
 *   'canceled'
 * );
 * // Use in WHERE clause to only update if current status is 'active'
 * ```
 */
export function compareAndSwap<T extends PgColumn>(column: T, expectedValue: unknown, _newValue: unknown): SQL {
    return eq(column, expectedValue);
}

/**
 * Create SQL for an atomic counter increment with optimistic locking
 *
 * @example
 * ```typescript
 * const increment = atomicIncrement(billingCustomerLimits.currentValue, 1);
 * // Use in SET clause for atomic increment
 * ```
 */
export function atomicIncrement<T extends PgColumn>(column: T, incrementBy = 1): SQL {
    return sql`${column} + ${incrementBy}`;
}

/**
 * Create SQL for an atomic counter decrement with optimistic locking
 *
 * @example
 * ```typescript
 * const decrement = atomicDecrement(billingCustomerLimits.currentValue, 1);
 * // Use in SET clause for atomic decrement
 * ```
 */
export function atomicDecrement<T extends PgColumn>(column: T, decrementBy = 1): SQL {
    return sql`${column} - ${decrementBy}`;
}

/**
 * Version column default value for schema definition
 * Use this when defining the version column in your schema
 *
 * @example
 * ```typescript
 * version: uuid('version').default(sql`gen_random_uuid()`).notNull()
 * ```
 */
export const VERSION_DEFAULT = sql`gen_random_uuid()`;
