/**
 * Unit tests for `listAll`'s internal pagination.
 *
 * The property under test is that the answer is either COMPLETE or an explicit
 * error. A silently short array is the exact failure `listAll` replaces.
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPAY_LIST_ALL_DEFAULT_BATCH_SIZE, QZPayListAllLimitExceededError, collectAllPages } from '../../src/utils/collect-all.js';

/** Builds a fetchPage over a fixed dataset, recording how it was called. */
function pagedSource(total: number) {
    const rows = Array.from({ length: total }, (_, index) => ({ id: index }));
    const calls: { limit: number; offset: number }[] = [];

    const fetchPage = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => {
        calls.push({ limit, offset });
        const data = rows.slice(offset, offset + limit);
        return { data, total: rows.length, hasMore: offset + data.length < rows.length };
    });

    return { rows, calls, fetchPage };
}

describe('collectAllPages', () => {
    it('returns every row across several pages', () => {
        // Arrange
        const { rows, fetchPage } = pagedSource(450);

        // Act / Assert
        return expect(collectAllPages({ entity: 'subscriptions', fetchPage, batchSize: 100 })).resolves.toEqual(rows);
    });

    it('walks pages with a moving offset', async () => {
        // Arrange
        const { calls, fetchPage } = pagedSource(250);

        // Act
        await collectAllPages({ entity: 'subscriptions', fetchPage, batchSize: 100 });

        // Assert
        expect(calls).toEqual([
            { limit: 100, offset: 0 },
            { limit: 100, offset: 100 },
            { limit: 100, offset: 200 }
        ]);
    });

    it('stops after one page when the source has no more rows', async () => {
        // Arrange
        const { fetchPage } = pagedSource(10);

        // Act
        const result = await collectAllPages({ entity: 'plans', fetchPage, batchSize: 100 });

        // Assert
        expect(result).toHaveLength(10);
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array for an empty source', async () => {
        // Arrange
        const { fetchPage } = pagedSource(0);

        // Act
        const result = await collectAllPages({ entity: 'plans', fetchPage });

        // Assert
        expect(result).toEqual([]);
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('defaults to a batch size of 200', async () => {
        // Arrange
        const { calls, fetchPage } = pagedSource(10);

        // Act
        await collectAllPages({ entity: 'plans', fetchPage });

        // Assert
        expect(calls[0]?.limit).toBe(QZPAY_LIST_ALL_DEFAULT_BATCH_SIZE);
        expect(QZPAY_LIST_ALL_DEFAULT_BATCH_SIZE).toBe(200);
    });

    it('THROWS instead of truncating when maxItems is exceeded', async () => {
        // Returning the first N of a larger set is precisely the behaviour this
        // API exists to eliminate, so it must never be the fallback.
        // Arrange
        const { fetchPage } = pagedSource(500);

        // Act / Assert
        await expect(collectAllPages({ entity: 'payments', fetchPage, batchSize: 100, maxItems: 250 })).rejects.toBeInstanceOf(
            QZPayListAllLimitExceededError
        );
    });

    it('reports the entity, the cap and the real total in the error', async () => {
        // Arrange
        const { fetchPage } = pagedSource(500);

        // Act
        const error = await collectAllPages({
            entity: 'payments',
            fetchPage,
            batchSize: 100,
            maxItems: 250
        }).catch((caught: unknown) => caught as QZPayListAllLimitExceededError);

        // Assert
        expect(error.entity).toBe('payments');
        expect(error.maxItems).toBe(250);
        expect(error.total).toBe(500);
        expect(error.message).toContain('250');
    });

    it('accepts a result that lands exactly on maxItems', async () => {
        // Arrange
        const { fetchPage } = pagedSource(200);

        // Act
        const result = await collectAllPages({
            entity: 'payments',
            fetchPage,
            batchSize: 100,
            maxItems: 200
        });

        // Assert
        expect(result).toHaveLength(200);
    });

    it('stops on an empty page even when the source insists hasMore', async () => {
        // Trusting the flag alone would spin forever against a storage layer
        // that reports it wrong, and an endless loop inside a cron is worse than
        // a short answer.
        // Arrange
        const fetchPage = vi.fn(async ({ offset }: { limit: number; offset: number }) => ({
            data: offset === 0 ? [{ id: 1 }] : [],
            total: 999,
            hasMore: true
        }));

        // Act
        const result = await collectAllPages({ entity: 'invoices', fetchPage, batchSize: 1 });

        // Assert
        expect(result).toEqual([{ id: 1 }]);
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects a batchSize of %p', async (batchSize) => {
        // Arrange
        const { fetchPage } = pagedSource(10);

        // Act / Assert
        await expect(collectAllPages({ entity: 'plans', fetchPage, batchSize })).rejects.toBeInstanceOf(RangeError);
    });

    it('propagates an error raised by the source', async () => {
        // Arrange
        const failure = new Error('connection lost');
        const fetchPage = vi.fn(async () => {
            throw failure;
        });

        // Act / Assert
        await expect(collectAllPages({ entity: 'plans', fetchPage })).rejects.toBe(failure);
    });
});
