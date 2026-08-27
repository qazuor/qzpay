/**
 * Internal pagination for `listAll`.
 *
 * Callers used to express "give me everything" as `{ limit: 10000 }` — a guess
 * dressed as a number. This walks the pages instead, so the answer is either
 * complete or an explicit error, never a silently truncated array.
 *
 * @module utils/collect-all
 */

/** Rows fetched per internal page when the caller does not choose. */
export const QZPAY_LIST_ALL_DEFAULT_BATCH_SIZE = 200;

/**
 * Raised when a `listAll` result would exceed the caller's `maxItems` cap.
 *
 * Throwing is deliberate: returning the first N rows of a larger set is the
 * failure mode `listAll` exists to eliminate, so it is never the fallback.
 */
export class QZPayListAllLimitExceededError extends Error {
    /** Entity being listed, e.g. `subscriptions`. */
    readonly entity: string;
    /** The cap that was exceeded. */
    readonly maxItems: number;
    /** Total rows the query matched, when the storage layer reported it. */
    readonly total?: number | undefined;

    constructor(params: { entity: string; maxItems: number; total?: number }) {
        const found = params.total === undefined ? 'more' : `${params.total}`;
        super(
            `Listing all ${params.entity} exceeded maxItems=${params.maxItems} (matched ${found}). Raise maxItems, or narrow the query with filters.`
        );
        this.name = 'QZPayListAllLimitExceededError';
        this.entity = params.entity;
        this.maxItems = params.maxItems;
        this.total = params.total;
    }
}

/**
 * Collects every row of a paginated query.
 *
 * Note on consistency: this walks offsets across several statements, so rows
 * inserted or deleted while it runs can be seen twice or missed. That is
 * inherent to offset pagination and is acceptable for the reporting and cron
 * workloads this serves; a caller needing a point-in-time snapshot should run it
 * inside a transaction.
 *
 * @param params.entity - Entity name, used only for error messages.
 * @param params.fetchPage - Fetches one page. Receives `limit`/`offset`.
 * @param params.batchSize - Rows per internal page. Defaults to 200.
 * @param params.maxItems - Optional cap; exceeding it throws.
 * @returns Every matching row, in the order the pages returned them.
 * @throws {QZPayListAllLimitExceededError} When the result exceeds `maxItems`.
 */
export async function collectAllPages<T>(params: {
    entity: string;
    fetchPage: (page: {
        limit: number;
        offset: number;
    }) => Promise<{ data: T[]; total: number; hasMore: boolean }>;
    // Explicit `| undefined` because this package enables
    // `exactOptionalPropertyTypes`: callers forward `options?.batchSize`, which
    // is `number | undefined`, and a bare optional would reject it.
    batchSize?: number | undefined;
    maxItems?: number | undefined;
}): Promise<T[]> {
    const { entity, fetchPage, maxItems } = params;
    const batchSize = params.batchSize ?? QZPAY_LIST_ALL_DEFAULT_BATCH_SIZE;

    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new RangeError(`batchSize must be a positive integer, received ${batchSize}`);
    }

    const collected: T[] = [];
    let offset = 0;

    while (true) {
        const page = await fetchPage({ limit: batchSize, offset });

        if (maxItems !== undefined && collected.length + page.data.length > maxItems) {
            throw new QZPayListAllLimitExceededError({ entity, maxItems, total: page.total });
        }

        collected.push(...page.data);

        // An empty page ends the walk even if `hasMore` disagrees: trusting the
        // flag alone would spin forever against a storage layer that reports it
        // wrong, and an infinite loop in a cron is worse than a short answer.
        if (page.data.length === 0 || !page.hasMore) break;

        offset += batchSize;
    }

    return collected;
}
