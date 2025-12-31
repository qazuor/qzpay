/**
 * Base repository types and utilities for QZPay Drizzle
 *
 * Provides common types and error classes for repositories.
 */

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
