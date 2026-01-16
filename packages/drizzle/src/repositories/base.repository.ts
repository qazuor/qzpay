/**
 * Base repository types and utilities for QZPay Drizzle
 *
 * Provides common types and error classes for repositories.
 *
 * ## Transaction Support
 *
 * For multi-table operations requiring ACID guarantees, use the transaction utilities
 * from `@qazuor/qzpay-drizzle/utils`:
 *
 * @example
 * ```typescript
 * import { withTransaction } from '@qazuor/qzpay-drizzle/utils';
 *
 * // Create invoice with lines in a transaction
 * const result = await withTransaction(db, async (tx) => {
 *   const invoice = await invoiceRepo.create(tx, invoiceData);
 *   const lines = await Promise.all(
 *     lineItems.map(line => invoiceRepo.createLine(tx, line))
 *   );
 *   return { invoice, lines };
 * });
 * ```
 *
 * See {@link withTransaction} for more details.
 */

// ==================== Pagination Constants ====================

/**
 * Default pagination limit if none specified
 */
export const QZPAY_DEFAULT_LIMIT = 20;

/**
 * Maximum allowed pagination limit to prevent resource exhaustion
 */
export const QZPAY_MAX_LIMIT = 100;

/**
 * Maximum allowed offset to prevent deep pagination attacks
 */
export const QZPAY_MAX_OFFSET = 10000;

/**
 * Options for pagination validation
 */
export interface QZPayPaginationValidationOptions {
    /**
     * Maximum allowed limit (overrides default MAX_LIMIT)
     */
    maxLimit?: number;

    /**
     * Maximum allowed offset (overrides default MAX_OFFSET)
     */
    maxOffset?: number;

    /**
     * Default limit to use when none specified
     */
    defaultLimit?: number;
}

/**
 * Validated pagination result
 */
export interface QZPayValidatedPagination {
    limit: number;
    offset: number;
}

/**
 * Validates and normalizes pagination parameters.
 *
 * - Applies default limit if not specified
 * - Clamps limit to maximum allowed value
 * - Clamps offset to maximum allowed value
 * - Ensures limit and offset are non-negative
 *
 * @param limit - Requested limit
 * @param offset - Requested offset
 * @param options - Validation options
 * @returns Validated pagination values
 *
 * @example
 * ```typescript
 * // Default behavior
 * validatePagination(undefined, undefined) // { limit: 20, offset: 0 }
 * validatePagination(500, 0) // { limit: 100, offset: 0 }
 * validatePagination(50, 50000) // { limit: 50, offset: 10000 }
 *
 * // With custom options
 * validatePagination(200, 0, { maxLimit: 1000 }) // { limit: 200, offset: 0 }
 * ```
 */
export function qzpayValidatePagination(
    limit?: number,
    offset?: number,
    options: QZPayPaginationValidationOptions = {}
): QZPayValidatedPagination {
    const { maxLimit = QZPAY_MAX_LIMIT, maxOffset = QZPAY_MAX_OFFSET, defaultLimit = QZPAY_DEFAULT_LIMIT } = options;

    // Apply defaults and ensure non-negative
    let validatedLimit = limit ?? defaultLimit;
    let validatedOffset = offset ?? 0;

    // Ensure non-negative
    validatedLimit = Math.max(0, validatedLimit);
    validatedOffset = Math.max(0, validatedOffset);

    // Clamp to maximum values
    validatedLimit = Math.min(validatedLimit, maxLimit);
    validatedOffset = Math.min(validatedOffset, maxOffset);

    return {
        limit: validatedLimit,
        offset: validatedOffset
    };
}

/**
 * Order by configuration
 */
export interface QZPayOrderBy<T> {
    field: keyof T;
    direction: 'asc' | 'desc';
}

/**
 * Find many options
 */
export interface QZPayFindManyOptions<T> {
    where?: Partial<T>;
    orderBy?: QZPayOrderBy<T>;
    limit?: number;
    offset?: number;
    includeSoftDeleted?: boolean;
}

/**
 * Paginated result
 */
export interface QZPayPaginatedResult<T> {
    data: T[];
    total: number;
}

/**
 * Optimistic locking error
 */
export class QZPayOptimisticLockError extends Error {
    constructor(
        public readonly entityType: string,
        public readonly entityId: string
    ) {
        super(`Optimistic lock error: ${entityType} with id ${entityId} was modified by another process`);
        this.name = 'QZPayOptimisticLockError';
    }
}

/**
 * Entity not found error
 */
export class QZPayEntityNotFoundError extends Error {
    constructor(
        public readonly entityType: string,
        public readonly entityId: string
    ) {
        super(`${entityType} with id ${entityId} not found`);
        this.name = 'QZPayEntityNotFoundError';
    }
}

/**
 * Helper function to assert result exists
 */
export function assertExists<T>(result: T | undefined, entityType: string, id: string): asserts result is T {
    if (!result) {
        throw new QZPayEntityNotFoundError(entityType, id);
    }
}

/**
 * Helper function to get first result or null
 */
export function firstOrNull<T>(results: T[]): T | null {
    return results[0] ?? null;
}

/**
 * Helper function to get first result and assert it exists
 */
export function firstOrThrow<T>(results: T[], entityType: string, id: string): T {
    const result = results[0];
    if (!result) {
        throw new QZPayEntityNotFoundError(entityType, id);
    }
    return result;
}

/**
 * Options for optimistic locking update
 */
export interface QZPayUpdateWithVersionOptions<TSelect> {
    /** Entity type for error messages (e.g., 'Customer', 'Subscription') */
    entityType: string;
    /** Entity ID for error messages */
    entityId: string;
    /** Whether to include soft-deleted records in the version check (default: false) */
    includeSoftDeleted?: boolean;
    /** Custom transformer to apply before returning the result */
    transform?: (record: TSelect) => TSelect | Promise<TSelect>;
}

/**
 * Performs an optimistic locking update operation
 *
 * Updates a record by ID with version checking to prevent concurrent modifications.
 * Automatically generates a new version UUID for the updated record.
 *
 * @template TTable - The Drizzle table type
 * @template TInsert - The insert schema type for the table
 * @template TSelect - The select schema type for the table
 *
 * @param db - The database connection
 * @param table - The Drizzle table to update
 * @param id - The ID of the record to update
 * @param expectedVersion - The expected current version UUID
 * @param updateData - The data to update (partial)
 * @param options - Additional options for the update operation
 *
 * @returns The updated record with the new version
 *
 * @throws {QZPayOptimisticLockError} When the version doesn't match (concurrent modification detected)
 * @throws {QZPayEntityNotFoundError} When the record is not found
 *
 * @example
 * ```typescript
 * // Basic usage in a repository
 * async updateWithVersion(
 *   id: string,
 *   expectedVersion: string,
 *   data: Partial<QZPayBillingCustomerInsert>
 * ): Promise<QZPayBillingCustomer> {
 *   return updateWithVersionHelper(
 *     this.db,
 *     billingCustomers,
 *     id,
 *     expectedVersion,
 *     data,
 *     { entityType: 'Customer', entityId: id }
 *   );
 * }
 *
 * // Usage from service layer
 * const customer = await customerRepo.findById('cust-123');
 * const updated = await customerRepo.updateWithVersion(
 *   'cust-123',
 *   customer.version,
 *   { name: 'New Name' }
 * );
 * // updated.version will be different from customer.version
 *
 * // Concurrent modification scenario
 * const v1 = customer.version;
 * await customerRepo.updateWithVersion('cust-123', v1, { name: 'Update 1' });
 * // This will throw QZPayOptimisticLockError because version changed
 * await customerRepo.updateWithVersion('cust-123', v1, { name: 'Update 2' });
 * ```
 */
export async function updateWithVersionHelper<
    // biome-ignore lint/suspicious/noExplicitAny: Generic table type requires any
    TTable extends { id: any; version: any; deletedAt?: any },
    TInsert extends Record<string, unknown>,
    TSelect extends { id: string; version: string }
>(
    // biome-ignore lint/suspicious/noExplicitAny: Database type requires any for generic operations
    db: any,
    table: TTable,
    id: string,
    expectedVersion: string,
    updateData: Partial<TInsert>,
    options: QZPayUpdateWithVersionOptions<TSelect>
): Promise<TSelect> {
    const { entityType, entityId, includeSoftDeleted = false, transform } = options;

    // Import required functions from drizzle-orm
    const { and, eq, isNull } = await import('drizzle-orm');
    const { generateVersion } = await import('../utils/optimistic-locking.js');

    // Build WHERE clause with version check
    const conditions = [eq(table.id, id), eq(table.version, expectedVersion)];

    // Add soft-delete check unless explicitly including deleted records
    if (!includeSoftDeleted && 'deletedAt' in table) {
        conditions.push(isNull(table.deletedAt));
    }

    const whereClause = and(...conditions);

    if (!whereClause) {
        throw new Error('Failed to build WHERE clause for version update');
    }

    // Prepare update data with new version and timestamp
    const dataWithVersion = {
        ...updateData,
        version: generateVersion(),
        updatedAt: new Date()
    };

    let result: TSelect[];

    try {
        // Execute update with version check
        result = await db.update(table).set(dataWithVersion).where(whereClause).returning();
    } catch (_error) {
        // If the query fails, it could be due to invalid ID format or other DB errors
        // Try to check if the record exists to provide a better error message
        try {
            const existsQuery = await db
                .select()
                .from(table)
                .where(includeSoftDeleted ? eq(table.id, id) : and(eq(table.id, id), isNull(table.deletedAt)))
                .limit(1);

            if (existsQuery.length > 0) {
                // Record exists but update failed, could be version mismatch or constraint violation
                throw new QZPayOptimisticLockError(entityType, entityId);
            }
        } catch {
            // If existence check also fails, the ID format is likely invalid
        }
        // Record doesn't exist or ID is invalid
        throw new QZPayEntityNotFoundError(entityType, entityId);
    }

    // Verify update succeeded
    if (result.length === 0) {
        // Check if record exists but version mismatch
        const existsQuery = await db
            .select()
            .from(table)
            .where(includeSoftDeleted ? eq(table.id, id) : and(eq(table.id, id), isNull(table.deletedAt)))
            .limit(1);

        if (existsQuery.length > 0) {
            // Record exists but version mismatch
            throw new QZPayOptimisticLockError(entityType, entityId);
        }
        // Record doesn't exist
        throw new QZPayEntityNotFoundError(entityType, entityId);
    }

    const updatedRecord = result[0] as TSelect;

    // Apply transformation if provided
    if (transform) {
        return await transform(updatedRecord);
    }

    return updatedRecord;
}
