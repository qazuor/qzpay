/**
 * Pagination utilities for QZPay Drizzle
 *
 * Provides helpers for implementing cursor-based and offset pagination.
 */
import type { SQL } from 'drizzle-orm';
import { asc, desc, gt, lt } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Offset-based pagination options
 */
export interface QZPayOffsetPaginationOptions {
    /** Number of items per page (default: 20, max: 100) */
    limit?: number;
    /** Number of items to skip (default: 0) */
    offset?: number;
    /** Sort direction (default: 'desc') */
    orderDirection?: 'asc' | 'desc';
}

/**
 * Cursor-based pagination options
 */
export interface QZPayCursorPaginationOptions {
    /** Number of items per page (default: 20, max: 100) */
    limit?: number;
    /** Cursor for the next page (ID of last item) */
    cursor?: string;
    /** Sort direction (default: 'desc') */
    direction?: 'asc' | 'desc';
}

/**
 * Paginated result with offset pagination
 */
export interface QZPayOffsetPaginatedResult<T> {
    /** Array of items */
    data: T[];
    /** Total number of items matching the query */
    total: number;
    /** Number of items per page */
    limit: number;
    /** Number of items skipped */
    offset: number;
    /** Whether there are more items */
    hasMore: boolean;
    /** Current page number (1-based) */
    page: number;
    /** Total number of pages */
    totalPages: number;
}

/**
 * Paginated result with cursor pagination
 */
export interface QZPayCursorPaginatedResult<T> {
    /** Array of items */
    data: T[];
    /** Cursor for the next page (null if no more items) */
    nextCursor: string | null;
    /** Cursor for the previous page (null if on first page) */
    prevCursor: string | null;
    /** Whether there are more items */
    hasMore: boolean;
    /** Number of items returned */
    count: number;
}

/**
 * Default pagination limits
 */
export const QZPAY_PAGINATION_DEFAULTS = {
    /** Default page size */
    defaultLimit: 20,
    /** Maximum allowed page size */
    maxLimit: 100,
    /** Minimum page size */
    minLimit: 1
} as const;

/**
 * Normalize pagination options to ensure they're within bounds
 *
 * @example
 * ```typescript
 * const options = normalizePaginationOptions({ limit: 500, offset: -10 });
 * // { limit: 100, offset: 0 }
 * ```
 */
export function normalizePaginationOptions(options?: QZPayOffsetPaginationOptions): Required<QZPayOffsetPaginationOptions> {
    const limit = Math.min(
        Math.max(options?.limit ?? QZPAY_PAGINATION_DEFAULTS.defaultLimit, QZPAY_PAGINATION_DEFAULTS.minLimit),
        QZPAY_PAGINATION_DEFAULTS.maxLimit
    );

    const offset = Math.max(options?.offset ?? 0, 0);

    const orderDirection = options?.orderDirection ?? 'desc';

    return { limit, offset, orderDirection };
}

/**
 * Build an offset paginated result from query data
 *
 * @example
 * ```typescript
 * const result = buildOffsetPaginatedResult(
 *   customers,
 *   totalCount,
 *   { limit: 20, offset: 40 }
 * );
 * // { data: [...], total: 100, limit: 20, offset: 40, hasMore: true, page: 3, totalPages: 5 }
 * ```
 */
export function buildOffsetPaginatedResult<T>(
    data: T[],
    total: number,
    options: Required<QZPayOffsetPaginationOptions>
): QZPayOffsetPaginatedResult<T> {
    const { limit, offset } = options;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
        page,
        totalPages
    };
}

/**
 * Build a cursor paginated result from query data
 *
 * @example
 * ```typescript
 * const result = buildCursorPaginatedResult(
 *   customers,
 *   (customer) => customer.id,
 *   { limit: 20 }
 * );
 * ```
 */
export function buildCursorPaginatedResult<T>(
    data: T[],
    getCursor: (item: T) => string,
    options: { limit: number; cursor?: string }
): QZPayCursorPaginatedResult<T> {
    const { limit, cursor } = options;
    const hasMore = data.length > limit;

    // Remove the extra item we fetched to check for more
    const items = hasMore ? data.slice(0, limit) : data;

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem !== undefined ? getCursor(lastItem) : null;
    const prevCursor = cursor ?? null;

    return {
        data: items,
        nextCursor,
        prevCursor,
        hasMore,
        count: items.length
    };
}

/**
 * Create cursor pagination WHERE clause
 *
 * @example
 * ```typescript
 * const where = createCursorWhereClause(
 *   billingCustomers.id,
 *   { cursor: 'abc-123', direction: 'desc' }
 * );
 * // Returns: lt(billingCustomers.id, 'abc-123')
 * ```
 */
export function createCursorWhereClause<T extends PgColumn>(cursorColumn: T, options: QZPayCursorPaginationOptions): SQL | undefined {
    if (!options.cursor) {
        return undefined;
    }

    const direction = options.direction ?? 'desc';

    // For descending order, get items with ID less than cursor
    // For ascending order, get items with ID greater than cursor
    return direction === 'desc' ? lt(cursorColumn, options.cursor) : gt(cursorColumn, options.cursor);
}

/**
 * Get the ORDER BY clause for pagination
 *
 * @example
 * ```typescript
 * const orderBy = getPaginationOrderBy(billingCustomers.createdAt, 'desc');
 * ```
 */
export function getPaginationOrderBy<T extends PgColumn>(
    column: T,
    direction: 'asc' | 'desc' = 'desc'
): ReturnType<typeof asc> | ReturnType<typeof desc> {
    return direction === 'asc' ? asc(column) : desc(column);
}

/**
 * Calculate page info from offset and limit
 *
 * @example
 * ```typescript
 * const info = calculatePageInfo(100, { limit: 20, offset: 40 });
 * // { currentPage: 3, totalPages: 5, hasNext: true, hasPrev: true }
 * ```
 */
export function calculatePageInfo(
    total: number,
    options: { limit: number; offset: number }
): {
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    firstItemIndex: number;
    lastItemIndex: number;
} {
    const { limit, offset } = options;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const firstItemIndex = offset + 1;
    const lastItemIndex = Math.min(offset + limit, total);

    return {
        currentPage,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        firstItemIndex,
        lastItemIndex
    };
}

/**
 * Convert page number to offset
 *
 * @example
 * ```typescript
 * const offset = pageToOffset(3, 20); // 40
 * ```
 */
export function pageToOffset(page: number, limit: number): number {
    return Math.max(0, (page - 1) * limit);
}

/**
 * Convert offset to page number
 *
 * @example
 * ```typescript
 * const page = offsetToPage(40, 20); // 3
 * ```
 */
export function offsetToPage(offset: number, limit: number): number {
    return Math.floor(offset / limit) + 1;
}
