/**
 * Base Repository Tests
 *
 * Tests for error classes and helper functions
 */
import { describe, expect, it } from 'vitest';
import {
    QZPayEntityNotFoundError,
    QZPayOptimisticLockError,
    assertExists,
    firstOrNull,
    firstOrThrow
} from '../src/repositories/base.repository.js';

describe('Base Repository', () => {
    describe('QZPayOptimisticLockError', () => {
        it('should create error with correct message', () => {
            const error = new QZPayOptimisticLockError('customer', 'cus_123');

            expect(error.message).toBe('Optimistic lock error: customer with id cus_123 was modified by another process');
            expect(error.name).toBe('QZPayOptimisticLockError');
            expect(error.entityType).toBe('customer');
            expect(error.entityId).toBe('cus_123');
        });

        it('should be an instance of Error', () => {
            const error = new QZPayOptimisticLockError('subscription', 'sub_456');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(QZPayOptimisticLockError);
        });
    });

    describe('QZPayEntityNotFoundError', () => {
        it('should create error with correct message', () => {
            const error = new QZPayEntityNotFoundError('Invoice', 'inv_789');

            expect(error.message).toBe('Invoice with id inv_789 not found');
            expect(error.name).toBe('QZPayEntityNotFoundError');
            expect(error.entityType).toBe('Invoice');
            expect(error.entityId).toBe('inv_789');
        });

        it('should be an instance of Error', () => {
            const error = new QZPayEntityNotFoundError('Payment', 'pay_123');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(QZPayEntityNotFoundError);
        });
    });

    describe('assertExists', () => {
        it('should not throw when result exists', () => {
            const result = { id: '1', name: 'Test' };

            expect(() => assertExists(result, 'Customer', '1')).not.toThrow();
        });

        it('should throw QZPayEntityNotFoundError when result is undefined', () => {
            expect(() => assertExists(undefined, 'Customer', 'cus_123')).toThrow(QZPayEntityNotFoundError);
        });

        it('should include entity info in error', () => {
            try {
                assertExists(undefined, 'Subscription', 'sub_456');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayEntityNotFoundError);
                expect((error as QZPayEntityNotFoundError).entityType).toBe('Subscription');
                expect((error as QZPayEntityNotFoundError).entityId).toBe('sub_456');
            }
        });

        it('should throw for all falsy values (including 0, empty string, false)', () => {
            // assertExists treats ALL falsy values as "not found"
            expect(() => assertExists(0, 'Count', '1')).toThrow(QZPayEntityNotFoundError);
            expect(() => assertExists('', 'Empty', '1')).toThrow(QZPayEntityNotFoundError);
            expect(() => assertExists(false, 'Flag', '1')).toThrow(QZPayEntityNotFoundError);
            expect(() => assertExists(null, 'Null', '1')).toThrow(QZPayEntityNotFoundError);
        });

        it('should not throw for truthy values', () => {
            expect(() => assertExists({ id: '1' }, 'Object', '1')).not.toThrow();
            expect(() => assertExists([1, 2, 3], 'Array', '1')).not.toThrow();
            expect(() => assertExists('valid', 'String', '1')).not.toThrow();
            expect(() => assertExists(42, 'Number', '1')).not.toThrow();
        });
    });

    describe('firstOrNull', () => {
        it('should return first element from non-empty array', () => {
            const results = [{ id: '1' }, { id: '2' }];
            const result = firstOrNull(results);

            expect(result).toEqual({ id: '1' });
        });

        it('should return null for empty array', () => {
            const results: { id: string }[] = [];
            const result = firstOrNull(results);

            expect(result).toBeNull();
        });

        it('should return first element even if undefined', () => {
            const results = [undefined, { id: '2' }];
            const result = firstOrNull(results);

            expect(result).toBeNull();
        });

        it('should work with single element array', () => {
            const results = [{ id: 'only' }];
            const result = firstOrNull(results);

            expect(result).toEqual({ id: 'only' });
        });
    });

    describe('firstOrThrow', () => {
        it('should return first element from non-empty array', () => {
            const results = [
                { id: '1', name: 'First' },
                { id: '2', name: 'Second' }
            ];
            const result = firstOrThrow(results, 'Item', '1');

            expect(result).toEqual({ id: '1', name: 'First' });
        });

        it('should throw QZPayEntityNotFoundError for empty array', () => {
            const results: { id: string }[] = [];

            expect(() => firstOrThrow(results, 'Customer', 'cus_123')).toThrow(QZPayEntityNotFoundError);
        });

        it('should include entity info in error', () => {
            try {
                firstOrThrow([], 'Plan', 'plan_456');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayEntityNotFoundError);
                expect((error as QZPayEntityNotFoundError).entityType).toBe('Plan');
                expect((error as QZPayEntityNotFoundError).entityId).toBe('plan_456');
            }
        });

        it('should throw when first element is undefined', () => {
            const results = [undefined];

            expect(() => firstOrThrow(results as unknown[], 'Item', '1')).toThrow(QZPayEntityNotFoundError);
        });

        it('should work with single element array', () => {
            const results = [{ id: 'only', value: 42 }];
            const result = firstOrThrow(results, 'Result', 'only');

            expect(result).toEqual({ id: 'only', value: 42 });
        });
    });
});
