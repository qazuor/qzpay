/**
 * Pagination Utilities Tests
 */
import { describe, expect, it } from 'vitest';
import {
    QZPAY_PAGINATION_DEFAULTS,
    buildCursorPaginatedResult,
    buildOffsetPaginatedResult,
    calculatePageInfo,
    normalizePaginationOptions,
    offsetToPage,
    pageToOffset
} from '../../src/utils/pagination.js';

describe('Pagination Utilities', () => {
    describe('normalizePaginationOptions', () => {
        it('should return defaults when no options provided', () => {
            const result = normalizePaginationOptions();

            expect(result.limit).toBe(QZPAY_PAGINATION_DEFAULTS.defaultLimit);
            expect(result.offset).toBe(0);
            expect(result.orderDirection).toBe('desc');
        });

        it('should clamp limit to max', () => {
            const result = normalizePaginationOptions({ limit: 500 });

            expect(result.limit).toBe(QZPAY_PAGINATION_DEFAULTS.maxLimit);
        });

        it('should clamp limit to min', () => {
            const result = normalizePaginationOptions({ limit: 0 });

            expect(result.limit).toBe(QZPAY_PAGINATION_DEFAULTS.minLimit);
        });

        it('should clamp negative offset to 0', () => {
            const result = normalizePaginationOptions({ offset: -10 });

            expect(result.offset).toBe(0);
        });

        it('should preserve valid options', () => {
            const result = normalizePaginationOptions({
                limit: 50,
                offset: 100,
                orderDirection: 'asc'
            });

            expect(result.limit).toBe(50);
            expect(result.offset).toBe(100);
            expect(result.orderDirection).toBe('asc');
        });
    });

    describe('buildOffsetPaginatedResult', () => {
        it('should build paginated result correctly', () => {
            const data = [{ id: '1' }, { id: '2' }];
            const result = buildOffsetPaginatedResult(data, 100, {
                limit: 20,
                offset: 40,
                orderDirection: 'desc'
            });

            expect(result.data).toEqual(data);
            expect(result.total).toBe(100);
            expect(result.limit).toBe(20);
            expect(result.offset).toBe(40);
            expect(result.hasMore).toBe(true);
            expect(result.page).toBe(3);
            expect(result.totalPages).toBe(5);
        });

        it('should detect when there are no more items', () => {
            const data = [{ id: '1' }, { id: '2' }];
            const result = buildOffsetPaginatedResult(data, 42, {
                limit: 20,
                offset: 40,
                orderDirection: 'desc'
            });

            expect(result.hasMore).toBe(false);
        });

        it('should handle empty data', () => {
            const result = buildOffsetPaginatedResult([], 0, {
                limit: 20,
                offset: 0,
                orderDirection: 'desc'
            });

            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.hasMore).toBe(false);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(0);
        });

        it('should handle single page', () => {
            const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const result = buildOffsetPaginatedResult(data, 3, {
                limit: 20,
                offset: 0,
                orderDirection: 'desc'
            });

            expect(result.hasMore).toBe(false);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
        });
    });

    describe('buildCursorPaginatedResult', () => {
        it('should build cursor result with more items', () => {
            const data = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }];
            const result = buildCursorPaginatedResult(data, (item) => item.id, { limit: 5 });

            expect(result.data).toHaveLength(5);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('5');
            expect(result.prevCursor).toBeNull();
            expect(result.count).toBe(5);
        });

        it('should handle no more items', () => {
            const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const result = buildCursorPaginatedResult(data, (item) => item.id, { limit: 5 });

            expect(result.data).toHaveLength(3);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
            expect(result.count).toBe(3);
        });

        it('should include previous cursor when provided', () => {
            const data = [{ id: '6' }, { id: '7' }, { id: '8' }];
            const result = buildCursorPaginatedResult(data, (item) => item.id, { limit: 5, cursor: '5' });

            expect(result.prevCursor).toBe('5');
        });

        it('should handle empty data', () => {
            const result = buildCursorPaginatedResult([], (item: { id: string }) => item.id, { limit: 5 });

            expect(result.data).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
            expect(result.count).toBe(0);
        });
    });

    describe('calculatePageInfo', () => {
        it('should calculate page info correctly', () => {
            const info = calculatePageInfo(100, { limit: 20, offset: 40 });

            expect(info.currentPage).toBe(3);
            expect(info.totalPages).toBe(5);
            expect(info.hasNext).toBe(true);
            expect(info.hasPrev).toBe(true);
            expect(info.firstItemIndex).toBe(41);
            expect(info.lastItemIndex).toBe(60);
        });

        it('should detect first page', () => {
            const info = calculatePageInfo(100, { limit: 20, offset: 0 });

            expect(info.currentPage).toBe(1);
            expect(info.hasPrev).toBe(false);
            expect(info.hasNext).toBe(true);
        });

        it('should detect last page', () => {
            const info = calculatePageInfo(100, { limit: 20, offset: 80 });

            expect(info.currentPage).toBe(5);
            expect(info.hasNext).toBe(false);
            expect(info.hasPrev).toBe(true);
            expect(info.lastItemIndex).toBe(100);
        });

        it('should handle single page', () => {
            const info = calculatePageInfo(10, { limit: 20, offset: 0 });

            expect(info.currentPage).toBe(1);
            expect(info.totalPages).toBe(1);
            expect(info.hasNext).toBe(false);
            expect(info.hasPrev).toBe(false);
        });

        it('should handle empty total', () => {
            const info = calculatePageInfo(0, { limit: 20, offset: 0 });

            expect(info.currentPage).toBe(1);
            expect(info.totalPages).toBe(0);
            expect(info.hasNext).toBe(false);
            expect(info.hasPrev).toBe(false);
        });
    });

    describe('pageToOffset', () => {
        it('should convert page to offset', () => {
            expect(pageToOffset(1, 20)).toBe(0);
            expect(pageToOffset(2, 20)).toBe(20);
            expect(pageToOffset(3, 20)).toBe(40);
            expect(pageToOffset(5, 10)).toBe(40);
        });

        it('should handle page 0 or negative as page 1', () => {
            expect(pageToOffset(0, 20)).toBe(0);
            expect(pageToOffset(-1, 20)).toBe(0);
        });
    });

    describe('offsetToPage', () => {
        it('should convert offset to page', () => {
            expect(offsetToPage(0, 20)).toBe(1);
            expect(offsetToPage(20, 20)).toBe(2);
            expect(offsetToPage(40, 20)).toBe(3);
            expect(offsetToPage(45, 20)).toBe(3);
        });

        it('should handle offset not aligned to page boundary', () => {
            expect(offsetToPage(25, 20)).toBe(2);
            expect(offsetToPage(39, 20)).toBe(2);
        });
    });

    describe('QZPAY_PAGINATION_DEFAULTS', () => {
        it('should have expected defaults', () => {
            expect(QZPAY_PAGINATION_DEFAULTS.defaultLimit).toBe(20);
            expect(QZPAY_PAGINATION_DEFAULTS.maxLimit).toBe(100);
            expect(QZPAY_PAGINATION_DEFAULTS.minLimit).toBe(1);
        });
    });
});
