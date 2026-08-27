/**
 * Unit tests for safe `orderBy` resolution.
 *
 * These guard two properties that matter more than the ordering itself:
 * an unknown column must be REJECTED rather than quietly ignored, and a
 * caller-supplied string must never reach the SQL as a name.
 */
import type { SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { billingCustomers } from '../../src/schema/customers.schema.js';
import { billingPromoCodes } from '../../src/schema/promo-codes.schema.js';
import { billingSubscriptions } from '../../src/schema/subscriptions.schema.js';
import { QZPayInvalidOrderByError, orderableColumnsOf, resolveOrderBy } from '../../src/utils/order-by.js';

/**
 * SQL column names referenced by an ORDER BY clause.
 *
 * Read off the chunks rather than stringified: a real column arrives as a
 * `PgColumn` instance, which is the whole point — a caller's string never
 * becomes part of the query.
 */
function orderedColumns(clause: SQL): string[] {
    return clause.queryChunks.filter((chunk): chunk is PgColumn => chunk instanceof PgColumn).map((column) => column.name);
}

/**
 * Direction text of an ORDER BY clause, lowercased.
 *
 * Reads the literal chunks only. The clause cannot be serialised whole — a
 * column holds a back-reference to its table, so `JSON.stringify` hits a cycle.
 */
function orderDirectionOf(clause: SQL): string {
    return clause.queryChunks
        .filter((chunk) => !(chunk instanceof PgColumn))
        .map((chunk) => {
            const value = (chunk as { value?: unknown }).value;
            return Array.isArray(value) ? value.join('') : String(value ?? '');
        })
        .join(' ')
        .toLowerCase();
}

describe('resolveOrderBy', () => {
    it('defaults to createdAt descending when nothing is requested', () => {
        // Arrange / Act
        const clause = resolveOrderBy({ table: billingSubscriptions, entity: 'subscriptions' });

        // Assert — the clause references the real column, not a bare string.
        expect(orderedColumns(clause)).toEqual(['created_at']);
        expect(orderDirectionOf(clause)).toContain('desc');
    });

    it('honours an explicit column and ascending direction', () => {
        // Arrange / Act
        const clause = resolveOrderBy({
            table: billingSubscriptions,
            entity: 'subscriptions',
            orderBy: 'currentPeriodEnd',
            orderDirection: 'asc'
        });

        // Assert
        expect(orderedColumns(clause)).toEqual(['current_period_end']);
        expect(orderDirectionOf(clause)).toContain('asc');
    });

    it('rejects a column that does not exist on the entity', () => {
        // Silently falling back to a default ordering is the failure mode this
        // whole change set exists to remove: an option the caller passed must
        // never be discarded without a word.
        // Arrange / Act / Assert
        expect(() =>
            resolveOrderBy({
                table: billingSubscriptions,
                entity: 'subscriptions',
                orderBy: 'nonExistentColumn'
            })
        ).toThrow(QZPayInvalidOrderByError);
    });

    it('rejects a column that exists on ANOTHER entity', () => {
        // `updatedAt` is real on subscriptions but absent from promo codes.
        // A shared hand-written whitelist would have missed exactly this.
        // Arrange / Act / Assert
        expect(() => resolveOrderBy({ table: billingPromoCodes, entity: 'promoCodes', orderBy: 'updatedAt' })).toThrow(
            QZPayInvalidOrderByError
        );

        expect(() =>
            resolveOrderBy({
                table: billingSubscriptions,
                entity: 'subscriptions',
                orderBy: 'updatedAt'
            })
        ).not.toThrow();
    });

    it.each([
        ['a SQL fragment', 'createdAt; DROP TABLE billing_subscriptions'],
        ['a subquery', '(SELECT 1)'],
        ['a quoted identifier', '"createdAt"'],
        ['a prototype key', 'constructor'],
        ['a prototype chain key', '__proto__'],
        ['an empty string', '']
    ])('refuses %s instead of interpolating it', (_label, hostile) => {
        // The name is looked up on the table object and checked with
        // `instanceof PgColumn`, so nothing that is not a real column can reach
        // the query — including keys that exist on Object.prototype.
        // Arrange / Act / Assert
        expect(() =>
            resolveOrderBy({
                table: billingSubscriptions,
                entity: 'subscriptions',
                orderBy: hostile
            })
        ).toThrow(QZPayInvalidOrderByError);
    });

    it('names the entity and the accepted columns in the error', () => {
        // Arrange / Act
        let caught: QZPayInvalidOrderByError | undefined;
        try {
            resolveOrderBy({ table: billingCustomers, entity: 'customers', orderBy: 'nope' });
        } catch (error) {
            caught = error as QZPayInvalidOrderByError;
        }

        // Assert
        expect(caught).toBeInstanceOf(QZPayInvalidOrderByError);
        expect(caught?.entity).toBe('customers');
        expect(caught?.received).toBe('nope');
        expect(caught?.allowed).toContain('createdAt');
        expect(caught?.message).toContain('customers');
        expect(caught?.message).toContain('nope');
    });

    it('honours a custom fallback column', () => {
        // Arrange / Act
        const clause = resolveOrderBy({
            table: billingSubscriptions,
            entity: 'subscriptions',
            fallback: 'updatedAt'
        });

        // Assert
        expect(orderedColumns(clause)).toEqual(['updated_at']);
    });
});

describe('orderableColumnsOf', () => {
    it('derives the column list from the table itself', () => {
        // Arrange / Act
        const columns = orderableColumnsOf(billingSubscriptions);

        // Assert
        expect(columns).toContain('createdAt');
        expect(columns).toContain('currentPeriodEnd');
        expect(columns).toContain('status');
    });

    it('reports narrower sets for tables that lack the common timestamps', () => {
        // Not every table carries `updatedAt` — this is why the allowed set is
        // derived per table rather than assumed to be uniform.
        // Arrange / Act
        const promoCodeColumns = orderableColumnsOf(billingPromoCodes);
        const subscriptionColumns = orderableColumnsOf(billingSubscriptions);

        // Assert
        expect(promoCodeColumns).not.toContain('updatedAt');
        expect(subscriptionColumns).toContain('updatedAt');
    });

    it('excludes anything that is not a column', () => {
        // Arrange / Act
        const columns = orderableColumnsOf(billingSubscriptions);

        // Assert — table internals must not leak into the accepted set.
        expect(columns.every((name) => !name.startsWith('_'))).toBe(true);
        expect(columns).not.toContain('constructor');
    });

    it('returns the names sorted, so error messages are stable', () => {
        // Arrange / Act
        const columns = orderableColumnsOf(billingCustomers);

        // Assert
        expect([...columns]).toEqual([...columns].sort());
    });
});
