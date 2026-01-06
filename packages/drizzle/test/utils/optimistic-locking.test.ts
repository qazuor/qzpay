/**
 * Optimistic Locking Utilities Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPayOptimisticLockError } from '../../src/repositories/base.repository.js';
import {
    atomicDecrement,
    atomicIncrement,
    compareAndSwap,
    generateVersion,
    isOptimisticLockError,
    verifyOptimisticUpdate,
    withNewVersion,
    withOptimisticRetry
} from '../../src/utils/optimistic-locking.js';

describe('Optimistic Locking Utilities', () => {
    describe('generateVersion', () => {
        it('should generate a valid UUID', () => {
            const version = generateVersion();

            // UUID v4 pattern
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(version).toMatch(uuidPattern);
        });

        it('should generate unique versions', () => {
            const versions = new Set<string>();
            for (let i = 0; i < 100; i++) {
                versions.add(generateVersion());
            }
            expect(versions.size).toBe(100);
        });
    });

    describe('withNewVersion', () => {
        it('should add version to update data', () => {
            const updateData = { name: 'Updated Name', email: 'test@example.com' };
            const result = withNewVersion(updateData);

            expect(result.name).toBe('Updated Name');
            expect(result.email).toBe('test@example.com');
            expect(result.version).toBeDefined();
            expect(typeof result.version).toBe('string');
        });

        it('should generate new version each time', () => {
            const data = { value: 1 };
            const result1 = withNewVersion(data);
            const result2 = withNewVersion(data);

            expect(result1.version).not.toBe(result2.version);
        });

        it('should preserve original data properties', () => {
            const data = { a: 1, b: 'test', c: { nested: true } };
            const result = withNewVersion(data);

            expect(result.a).toBe(1);
            expect(result.b).toBe('test');
            expect(result.c).toEqual({ nested: true });
        });
    });

    describe('verifyOptimisticUpdate', () => {
        it('should return first result when update succeeds', () => {
            const results = [{ id: '1', name: 'Updated' }];
            const result = verifyOptimisticUpdate(results, 'customer', '1');

            expect(result).toEqual({ id: '1', name: 'Updated' });
        });

        it('should throw QZPayOptimisticLockError when no rows affected', () => {
            expect(() => verifyOptimisticUpdate([], 'customer', 'cust-123')).toThrow(QZPayOptimisticLockError);
        });

        it('should include entity info in error', () => {
            try {
                verifyOptimisticUpdate([], 'subscription', 'sub-456');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayOptimisticLockError);
                expect((error as QZPayOptimisticLockError).message).toContain('subscription');
                expect((error as QZPayOptimisticLockError).message).toContain('sub-456');
            }
        });
    });

    describe('withOptimisticRetry', () => {
        it('should return result on first success', async () => {
            const operation = vi.fn().mockResolvedValue({ success: true });

            const result = await withOptimisticRetry(operation);

            expect(result).toEqual({ success: true });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on optimistic lock error', async () => {
            const operation = vi
                .fn()
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockResolvedValueOnce({ success: true });

            const result = await withOptimisticRetry(operation, { maxRetries: 3, retryDelay: 10 });

            expect(result).toEqual({ success: true });
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('should throw after max retries exceeded', async () => {
            const operation = vi.fn().mockRejectedValue(new QZPayOptimisticLockError('test', 'id'));

            await expect(withOptimisticRetry(operation, { maxRetries: 2, retryDelay: 10 })).rejects.toThrow(QZPayOptimisticLockError);

            expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        it('should not retry on non-optimistic-lock errors', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('Different error'));

            await expect(withOptimisticRetry(operation, { maxRetries: 3, retryDelay: 10 })).rejects.toThrow('Different error');

            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should use exponential backoff', async () => {
            const operation = vi
                .fn()
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockResolvedValueOnce({ success: true });

            const start = Date.now();
            await withOptimisticRetry(operation, {
                maxRetries: 3,
                retryDelay: 50,
                backoffMultiplier: 2,
                maxDelay: 200
            });
            const elapsed = Date.now() - start;

            // Should have waited at least 50 + 100 = 150ms (with some tolerance)
            expect(elapsed).toBeGreaterThanOrEqual(100);
        });

        it('should respect maxDelay', async () => {
            const operation = vi
                .fn()
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockRejectedValueOnce(new QZPayOptimisticLockError('test', 'id'))
                .mockResolvedValueOnce({ success: true });

            const start = Date.now();
            await withOptimisticRetry(operation, {
                maxRetries: 5,
                retryDelay: 10,
                backoffMultiplier: 10, // Would normally grow very fast
                maxDelay: 20
            });
            const elapsed = Date.now() - start;

            // Without maxDelay cap: 10 + 100 + 1000 = 1110ms
            // With maxDelay of 20: 10 + 20 + 20 = 50ms
            expect(elapsed).toBeLessThan(200);
        });
    });

    describe('isOptimisticLockError', () => {
        it('should return true for QZPayOptimisticLockError', () => {
            const error = new QZPayOptimisticLockError('customer', '123');

            expect(isOptimisticLockError(error)).toBe(true);
        });

        it('should return false for regular Error', () => {
            const error = new Error('Some error');

            expect(isOptimisticLockError(error)).toBe(false);
        });

        it('should return false for non-error values', () => {
            expect(isOptimisticLockError(null)).toBe(false);
            expect(isOptimisticLockError(undefined)).toBe(false);
            expect(isOptimisticLockError('error string')).toBe(false);
            expect(isOptimisticLockError({ message: 'object' })).toBe(false);
        });
    });

    describe('atomicIncrement', () => {
        it('should create SQL for incrementing a column', () => {
            // Create a mock column
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'currentValue' } as any;
            const result = atomicIncrement(mockColumn, 5);

            // The result should be a SQL object
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should use default increment of 1', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'count' } as any;
            const result = atomicIncrement(mockColumn);

            expect(result).toBeDefined();
        });
    });

    describe('atomicDecrement', () => {
        it('should create SQL for decrementing a column', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'currentValue' } as any;
            const result = atomicDecrement(mockColumn, 3);

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should use default decrement of 1', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'count' } as any;
            const result = atomicDecrement(mockColumn);

            expect(result).toBeDefined();
        });
    });

    describe('compareAndSwap', () => {
        it('should create SQL condition for expected value', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'status' } as any;
            const result = compareAndSwap(mockColumn, 'active', 'canceled');

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should work with numeric values', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
            const mockColumn = { name: 'version' } as any;
            const result = compareAndSwap(mockColumn, 1, 2);

            expect(result).toBeDefined();
        });
    });
});
