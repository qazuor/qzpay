/**
 * Base Repository Tests
 *
 * Tests for error classes and helper functions
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    QZPayEntityNotFoundError,
    QZPayOptimisticLockError,
    assertExists,
    firstOrNull,
    firstOrThrow,
    updateWithVersionHelper
} from '../src/repositories/base.repository.js';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

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

    describe('updateWithVersionHelper', () => {
        // biome-ignore lint/suspicious/noExplicitAny: Test database type varies
        let db: any;
        let customersRepo: QZPayCustomersRepository;

        beforeAll(async () => {
            const testDb = await startTestDatabase();
            db = testDb.db;
            customersRepo = new QZPayCustomersRepository(db);
        });

        afterAll(async () => {
            await stopTestDatabase();
        });

        beforeEach(async () => {
            await clearTestData();
        });

        describe('successful updates', () => {
            it('should update record with correct version', async () => {
                // Create a customer
                const customer = await customersRepo.create({
                    externalId: 'test-001',
                    email: 'test@example.com',
                    name: 'Original Name',
                    livemode: true
                });

                const originalVersion = customer.version;

                // Import schema for table reference
                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Update with version check
                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    originalVersion,
                    { name: 'Updated Name' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(updated.name).toBe('Updated Name');
                expect(updated.version).not.toBe(originalVersion);
                expect(updated.version).toBeDefined();
                expect(updated.id).toBe(customer.id);
            });

            it('should update multiple fields at once', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-002',
                    email: 'multi@example.com',
                    name: 'Original',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    {
                        name: 'New Name',
                        email: 'newemail@example.com'
                    },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(updated.name).toBe('New Name');
                expect(updated.email).toBe('newemail@example.com');
                expect(updated.version).not.toBe(customer.version);
            });

            it('should allow sequential updates with refreshed version', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-003',
                    email: 'sequential@example.com',
                    name: 'Version 1',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // First update
                const update1 = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'Version 2' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                // Second update with new version
                const update2 = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    update1.version,
                    { name: 'Version 3' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(update1.version).not.toBe(customer.version);
                expect(update2.version).not.toBe(update1.version);
                expect(update2.name).toBe('Version 3');
            });

            it('should automatically update the updatedAt timestamp', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-004',
                    email: 'timestamp@example.com',
                    name: 'Test',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Wait a bit to ensure timestamp difference
                await new Promise((resolve) => setTimeout(resolve, 10));

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'Updated' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(updated.updatedAt.getTime()).toBeGreaterThan(customer.updatedAt.getTime());
            });
        });

        describe('optimistic locking errors', () => {
            it('should throw QZPayOptimisticLockError when version mismatch', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-005',
                    email: 'conflict@example.com',
                    name: 'Original',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // First update changes the version
                await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'First Update' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                // Second update with old version should fail
                await expect(
                    updateWithVersionHelper(
                        db,
                        billingCustomers,
                        customer.id,
                        customer.version, // Old version
                        { name: 'Second Update' },
                        { entityType: 'Customer', entityId: customer.id }
                    )
                ).rejects.toThrow(QZPayOptimisticLockError);
            });

            it('should include entity type and ID in error', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-006',
                    email: 'error-details@example.com',
                    name: 'Test',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Update to change version
                await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'Changed' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                // Try updating with stale version
                try {
                    await updateWithVersionHelper(
                        db,
                        billingCustomers,
                        customer.id,
                        customer.version,
                        { name: 'Fail' },
                        { entityType: 'Customer', entityId: customer.id }
                    );
                    expect.fail('Should have thrown QZPayOptimisticLockError');
                } catch (error) {
                    expect(error).toBeInstanceOf(QZPayOptimisticLockError);
                    expect((error as QZPayOptimisticLockError).entityType).toBe('Customer');
                    expect((error as QZPayOptimisticLockError).entityId).toBe(customer.id);
                }
            });

            it('should simulate real-world race condition', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-007',
                    email: 'race@example.com',
                    name: 'Original',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Simulate two processes reading the same version
                const version = customer.version;

                // Process 1 succeeds
                const update1 = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    version,
                    { name: 'Process 1' },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(update1.name).toBe('Process 1');

                // Process 2 fails with optimistic lock error
                await expect(
                    updateWithVersionHelper(
                        db,
                        billingCustomers,
                        customer.id,
                        version, // Same version as process 1
                        { name: 'Process 2' },
                        { entityType: 'Customer', entityId: customer.id }
                    )
                ).rejects.toThrow(QZPayOptimisticLockError);

                // Verify process 1's update persisted
                const final = await customersRepo.findById(customer.id);
                expect(final?.name).toBe('Process 1');
            });
        });

        describe('entity not found errors', () => {
            it('should throw QZPayEntityNotFoundError for non-existent ID', async () => {
                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                await expect(
                    updateWithVersionHelper(
                        db,
                        billingCustomers,
                        'non-existent-id',
                        'some-version',
                        { name: 'Test' },
                        { entityType: 'Customer', entityId: 'non-existent-id' }
                    )
                ).rejects.toThrow(QZPayEntityNotFoundError);
            });

            it('should not update soft-deleted records by default', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-008',
                    email: 'deleted@example.com',
                    name: 'To Delete',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Soft delete the customer
                await customersRepo.softDelete(customer.id);

                // Try to update the deleted customer
                await expect(
                    updateWithVersionHelper(
                        db,
                        billingCustomers,
                        customer.id,
                        customer.version,
                        { name: 'Should Fail' },
                        { entityType: 'Customer', entityId: customer.id }
                    )
                ).rejects.toThrow(QZPayEntityNotFoundError);
            });
        });

        describe('options', () => {
            it('should update soft-deleted records when includeSoftDeleted is true', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-009',
                    email: 'include-deleted@example.com',
                    name: 'Original',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                // Soft delete
                await customersRepo.softDelete(customer.id);

                // Update with includeSoftDeleted option
                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'Updated Deleted' },
                    {
                        entityType: 'Customer',
                        entityId: customer.id,
                        includeSoftDeleted: true
                    }
                );

                expect(updated.name).toBe('Updated Deleted');
                expect(updated.deletedAt).not.toBeNull();
            });

            it('should apply custom transform function', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-010',
                    email: 'transform@example.com',
                    name: 'test name',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'new name' },
                    {
                        entityType: 'Customer',
                        entityId: customer.id,
                        transform: (record) => ({
                            ...record,
                            name: record.name.toUpperCase()
                        })
                    }
                );

                expect(updated.name).toBe('NEW NAME');
            });

            it('should support async transform function', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-011',
                    email: 'async-transform@example.com',
                    name: 'test',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { name: 'value' },
                    {
                        entityType: 'Customer',
                        entityId: customer.id,
                        transform: async (record) => {
                            // Simulate async operation
                            await new Promise((resolve) => setTimeout(resolve, 10));
                            return {
                                ...record,
                                name: `[ASYNC] ${record.name}`
                            };
                        }
                    }
                );

                expect(updated.name).toBe('[ASYNC] value');
            });
        });

        describe('edge cases', () => {
            it('should handle empty update data object', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-012',
                    email: 'empty-update@example.com',
                    name: 'Original',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    {}, // Empty update
                    { entityType: 'Customer', entityId: customer.id }
                );

                // Version should still change
                expect(updated.version).not.toBe(customer.version);
                // Data should remain the same
                expect(updated.name).toBe('Original');
            });

            it('should handle null values in update data', async () => {
                const customer = await customersRepo.create({
                    externalId: 'test-013',
                    email: 'null-update@example.com',
                    name: 'Original',
                    segment: 'premium',
                    livemode: true
                });

                const { billingCustomers } = await import('../src/schema/customers.schema.js');

                const updated = await updateWithVersionHelper(
                    db,
                    billingCustomers,
                    customer.id,
                    customer.version,
                    { segment: null },
                    { entityType: 'Customer', entityId: customer.id }
                );

                expect(updated.segment).toBeNull();
                expect(updated.version).not.toBe(customer.version);
            });
        });
    });
});
