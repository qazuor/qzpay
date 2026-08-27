/**
 * Safe resolution of a caller-supplied `orderBy` into a Drizzle column.
 *
 * `QZPayListOptions.orderBy` is typed per entity, but types are a compile-time
 * courtesy: a JavaScript consumer, a JSON payload, or an `as any` can hand this
 * layer any string at all. Interpolating that string into a `sql` template would
 * be column-name injection, so the name is never interpolated — it is used to
 * look up a real column object on the Drizzle table, and anything that does not
 * resolve to one is rejected.
 *
 * An unknown column throws rather than silently falling back to a default
 * ordering. Quietly ignoring an option the caller explicitly passed is the exact
 * defect this whole change set exists to remove.
 *
 * @module utils/order-by
 */

import type { SQL } from 'drizzle-orm';
import { PgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { getPaginationOrderBy } from './pagination.js';

/**
 * Views a Drizzle table as a plain record so columns can be looked up by name.
 *
 * Drizzle's `PgTable` types carry no string index signature, so TypeScript will
 * not let a table value be passed where a `Record<string, unknown>` is expected
 * even though the runtime object is exactly that. The cast is confined here, and
 * every value it yields is checked with `instanceof PgColumn` before use — an
 * unknown key produces `undefined`, which fails that check.
 */
function columnsOf(table: PgTable): Record<string, unknown> {
    return table as unknown as Record<string, unknown>;
}

/**
 * Raised when `orderBy` does not name an orderable column on the entity.
 *
 * Carries the accepted names so the caller does not have to guess.
 */
export class QZPayInvalidOrderByError extends Error {
    /** Entity whose listing was being ordered, e.g. `subscriptions`. */
    readonly entity: string;
    /** The rejected column name, exactly as received. */
    readonly received: string;
    /** Column names this entity accepts. */
    readonly allowed: readonly string[];

    constructor(params: { entity: string; received: string; allowed: readonly string[] }) {
        super(`Cannot order ${params.entity} by "${params.received}". ` + `Orderable columns: ${params.allowed.join(', ')}.`);
        this.name = 'QZPayInvalidOrderByError';
        this.entity = params.entity;
        this.received = params.received;
        this.allowed = params.allowed;
    }
}

/**
 * Resolves an `orderBy` name into a Drizzle `ORDER BY` clause.
 *
 * @param params.table - The Drizzle table object to resolve the name against.
 * @param params.entity - Entity name, used only for the error message.
 * @param params.orderBy - Caller-supplied column name. Falls back to `fallback` when absent.
 * @param params.orderDirection - Sort direction. Defaults to `desc`.
 * @param params.fallback - Column used when the caller supplies none. Defaults to `createdAt`,
 *   the only column present on every table in this schema.
 * @returns The `ORDER BY` clause to hand to Drizzle.
 * @throws {QZPayInvalidOrderByError} When the name does not resolve to a column.
 */
export function resolveOrderBy(params: {
    table: PgTable;
    entity: string;
    orderBy?: string | undefined;
    orderDirection?: 'asc' | 'desc' | undefined;
    fallback?: string;
}): SQL {
    const { table, entity, orderBy, orderDirection, fallback = 'createdAt' } = params;
    const requested = orderBy ?? fallback;
    const candidate = columnsOf(table)[requested];

    if (!(candidate instanceof PgColumn)) {
        throw new QZPayInvalidOrderByError({
            entity,
            received: requested,
            allowed: orderableColumnsOf(table)
        });
    }

    return getPaginationOrderBy(candidate, orderDirection ?? 'desc');
}

/**
 * Lists the column names of a Drizzle table that can be ordered by.
 *
 * Derived from the table object itself rather than a hand-maintained list, so it
 * cannot drift from the schema. Useful for error messages and for tests that
 * assert an entity's orderable surface.
 *
 * @param table - The Drizzle table object.
 * @returns Sorted column names.
 */
export function orderableColumnsOf(table: PgTable): readonly string[] {
    const columns = columnsOf(table);
    return Object.keys(columns)
        .filter((key) => columns[key] instanceof PgColumn)
        .sort();
}
