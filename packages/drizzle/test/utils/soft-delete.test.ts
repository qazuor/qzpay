/**
 * Soft Delete Utilities Tests
 */
import { describe, expect, it } from 'vitest';
import {
    canPermanentlyDelete,
    eligibleForPermanentDeletion,
    excludeDeleted,
    getCascadeTargets,
    isActive,
    isSoftDeleted,
    onlyDeleted,
    restoreValues,
    shouldPermanentlyDelete,
    softDeleteFilter,
    softDeleteValues,
    withSoftDeleteFilter
} from '../../src/utils/soft-delete.js';

describe('Soft Delete Utilities', () => {
    describe('softDeleteValues', () => {
        it('should return deletedAt with provided date', () => {
            const date = new Date('2024-01-15');
            const result = softDeleteValues(date);

            expect(result.deletedAt).toEqual(date);
        });

        it('should return deletedAt with current date when not provided', () => {
            const before = new Date();
            const result = softDeleteValues();
            const after = new Date();

            expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(result.deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('restoreValues', () => {
        it('should return deletedAt as null', () => {
            const result = restoreValues();

            expect(result.deletedAt).toBeNull();
        });
    });

    describe('isSoftDeleted', () => {
        it('should return true for soft-deleted record', () => {
            const record = { id: '1', name: 'Test', deletedAt: new Date('2024-01-15') };

            expect(isSoftDeleted(record)).toBe(true);
        });

        it('should return false for active record', () => {
            const record = { id: '1', name: 'Test', deletedAt: null };

            expect(isSoftDeleted(record)).toBe(false);
        });

        it('should return false for null record', () => {
            expect(isSoftDeleted(null)).toBe(false);
        });
    });

    describe('isActive', () => {
        it('should return true for active record', () => {
            const record = { id: '1', name: 'Test', deletedAt: null };

            expect(isActive(record)).toBe(true);
        });

        it('should return false for soft-deleted record', () => {
            const record = { id: '1', name: 'Test', deletedAt: new Date('2024-01-15') };

            expect(isActive(record)).toBe(false);
        });

        it('should return false for null record', () => {
            expect(isActive(null)).toBe(false);
        });
    });

    describe('canPermanentlyDelete', () => {
        it('should return false for non-deleted records', () => {
            expect(canPermanentlyDelete(null)).toBe(false);
        });

        it('should return false if retention period not met', () => {
            const deletedAt = new Date(); // Just deleted
            expect(canPermanentlyDelete(deletedAt, { minRetentionDays: 30 })).toBe(false);
        });

        it('should return true if retention period met', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 31); // 31 days ago
            expect(canPermanentlyDelete(deletedAt, { minRetentionDays: 30 })).toBe(true);
        });

        it('should use default 30 days retention', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 31);
            expect(canPermanentlyDelete(deletedAt)).toBe(true);
        });

        it('should return false for exactly at retention boundary', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 29); // Just under 30 days
            expect(canPermanentlyDelete(deletedAt, { minRetentionDays: 30 })).toBe(false);
        });
    });

    describe('shouldPermanentlyDelete', () => {
        it('should return false for non-deleted records', () => {
            expect(shouldPermanentlyDelete(null)).toBe(false);
        });

        it('should return false if max retention not reached', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 100); // 100 days ago
            expect(shouldPermanentlyDelete(deletedAt, { maxRetentionDays: 365 })).toBe(false);
        });

        it('should return true if max retention exceeded', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 366); // Over a year ago
            expect(shouldPermanentlyDelete(deletedAt, { maxRetentionDays: 365 })).toBe(true);
        });

        it('should use default 365 days max retention', () => {
            const deletedAt = new Date();
            deletedAt.setDate(deletedAt.getDate() - 366);
            expect(shouldPermanentlyDelete(deletedAt)).toBe(true);
        });
    });

    describe('getCascadeTargets', () => {
        it('should return cascade targets for customer', () => {
            const targets = getCascadeTargets('customer');

            expect(targets).toContain('subscriptions');
            expect(targets).toContain('payments');
            expect(targets).toContain('invoices');
            expect(targets).toContain('paymentMethods');
            expect(targets).toContain('customerEntitlements');
            expect(targets).toContain('customerLimits');
        });

        it('should return cascade targets for subscription', () => {
            const targets = getCascadeTargets('subscription');

            expect(targets).toContain('payments');
            expect(targets).toContain('invoices');
        });

        it('should return cascade targets for plan', () => {
            const targets = getCascadeTargets('plan');

            expect(targets).toContain('prices');
            expect(targets).toContain('subscriptions');
        });

        it('should return cascade targets for vendor', () => {
            const targets = getCascadeTargets('vendor');

            expect(targets).toContain('vendorPayouts');
        });

        it('should return empty array for unknown entity type', () => {
            const targets = getCascadeTargets('unknown');

            expect(targets).toEqual([]);
        });
    });

    describe('excludeDeleted', () => {
        it('should create SQL for excluding deleted records', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = excludeDeleted(mockColumn);

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });
    });

    describe('onlyDeleted', () => {
        it('should create SQL for filtering only deleted records', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = onlyDeleted(mockColumn);

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });
    });

    describe('softDeleteFilter', () => {
        it('should return onlyDeleted filter when onlyDeleted option is true', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = softDeleteFilter(mockColumn, { onlyDeleted: true });

            expect(result).toBeDefined();
        });

        it('should return undefined when includeDeleted option is true', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = softDeleteFilter(mockColumn, { includeDeleted: true });

            expect(result).toBeUndefined();
        });

        it('should return excludeDeleted filter by default', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = softDeleteFilter(mockColumn);

            expect(result).toBeDefined();
        });

        it('should return excludeDeleted filter with empty options', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = softDeleteFilter(mockColumn, {});

            expect(result).toBeDefined();
        });
    });

    describe('withSoftDeleteFilter', () => {
        it('should return undefined when both where and filter are empty', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = withSoftDeleteFilter(undefined, mockColumn, { includeDeleted: true });

            expect(result).toBeUndefined();
        });

        it('should return delete filter when no existing where', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = withSoftDeleteFilter(undefined, mockColumn);

            expect(result).toBeDefined();
        });

        it('should return existing where when includeDeleted is true', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockWhere = { mockSql: true } as any;
            const result = withSoftDeleteFilter(mockWhere, mockColumn, { includeDeleted: true });

            expect(result).toBe(mockWhere);
        });

        it('should combine existing where with delete filter', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockWhere = { mockSql: true } as any;
            const result = withSoftDeleteFilter(mockWhere, mockColumn);

            expect(result).toBeDefined();
        });
    });

    describe('eligibleForPermanentDeletion', () => {
        it('should create SQL for finding eligible records', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = eligibleForPermanentDeletion(mockColumn, { maxRetentionDays: 30 });

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should use default 365 days max retention', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'deletedAt' } as any;
            const result = eligibleForPermanentDeletion(mockColumn);

            expect(result).toBeDefined();
        });
    });
});
