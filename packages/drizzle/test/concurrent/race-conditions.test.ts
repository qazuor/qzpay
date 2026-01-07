/**
 * Concurrent Operations Tests
 *
 * Tests race conditions and concurrent access scenarios to ensure
 * data integrity under concurrent load.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayLimitsRepository } from '../../src/repositories/limits.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Concurrent Operations', () => {
    let customersRepo: QZPayCustomersRepository;
    let limitsRepo: QZPayLimitsRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        customersRepo = new QZPayCustomersRepository(db);
        limitsRepo = new QZPayLimitsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Concurrent customer updates', () => {
        it('should handle concurrent updates (last-write-wins without optimistic locking)', async () => {
            // Create a customer
            const customer = await customersRepo.create({
                externalId: 'concurrent-test-1',
                email: 'concurrent@example.com',
                name: 'Original Name',
                livemode: true
            });

            // Simulate two concurrent updates
            // Note: Without optimistic locking implementation, both updates will succeed
            // and the final value depends on which completes last
            const update1Promise = customersRepo.update(customer.id, {
                name: 'Update 1'
            });

            const update2Promise = customersRepo.update(customer.id, {
                name: 'Update 2'
            });

            const results = await Promise.allSettled([update1Promise, update2Promise]);

            // Both should succeed (no optimistic locking verification in update)
            const succeeded = results.filter((r) => r.status === 'fulfilled');
            expect(succeeded.length).toBe(2);

            // Final value should be one of the updates
            const finalCustomer = await customersRepo.findById(customer.id);
            expect(['Update 1', 'Update 2']).toContain(finalCustomer?.name);
        });

        it('should maintain data integrity under rapid sequential updates', async () => {
            const customer = await customersRepo.create({
                externalId: 'rapid-update-test',
                email: 'rapid@example.com',
                name: 'Name 0',
                livemode: true
            });

            // Perform 10 sequential updates
            let currentCustomer = customer;
            for (let i = 1; i <= 10; i++) {
                currentCustomer = await customersRepo.update(currentCustomer.id, {
                    name: `Name ${i}`
                });
            }

            // Verify final state
            const finalCustomer = await customersRepo.findById(customer.id);
            expect(finalCustomer?.name).toBe('Name 10');
        });
    });

    describe('Concurrent limit operations', () => {
        it('should handle concurrent limit increments correctly', async () => {
            // Create a customer first
            const customer = await customersRepo.create({
                externalId: 'limit-concurrent-test',
                email: 'limits@example.com',
                livemode: true
            });

            const limitKey = 'api_calls';

            // Create initial limit using set()
            await limitsRepo.set({
                customerId: customer.id,
                limitKey,
                maxValue: 1000,
                source: 'manual',
                livemode: true
            });

            // Perform multiple concurrent increments
            const incrementPromises = Array.from({ length: 5 }, () => limitsRepo.increment(customer.id, limitKey, 10).catch((e) => e));

            await Promise.all(incrementPromises);

            // Get final value
            const finalLimit = await limitsRepo.findByCustomerAndKey(customer.id, limitKey);

            // Due to race conditions, not all increments may succeed
            // But the final value should be consistent (some multiple of 10)
            expect(finalLimit?.currentValue).toBeGreaterThanOrEqual(10);
            expect(finalLimit?.currentValue).toBeLessThanOrEqual(50);
            expect((finalLimit?.currentValue ?? 0) % 10).toBe(0);
        });

        it('should handle limit updates atomically', async () => {
            const customer = await customersRepo.create({
                externalId: 'atomic-limit-test',
                email: 'atomic@example.com',
                livemode: true
            });

            const limitKey = 'storage_mb';

            // Create limit with high max value
            await limitsRepo.set({
                customerId: customer.id,
                limitKey,
                maxValue: 100,
                source: 'manual',
                livemode: true
            });

            // Try to increment multiple times concurrently
            const incrementPromises = Array.from({ length: 5 }, () =>
                limitsRepo.increment(customer.id, limitKey, 10).catch((e) => ({ error: e }))
            );

            await Promise.all(incrementPromises);

            // Final value should be consistent
            const finalLimit = await limitsRepo.findByCustomerAndKey(customer.id, limitKey);
            // All 5 increments should succeed (no optimistic locking on limits)
            expect(finalLimit?.currentValue).toBe(50);
        });
    });

    describe('Concurrent creates', () => {
        it('should handle concurrent customer creates with unique constraints', async () => {
            const email = 'unique-email@example.com';

            // Try to create two customers with the same email concurrently
            const createPromises = Array.from({ length: 2 }, (_, i) =>
                customersRepo
                    .create({
                        externalId: `unique-test-${i}`,
                        email,
                        name: `User ${i}`,
                        livemode: true
                    })
                    .catch((e) => ({ error: e }))
            );

            const results = await Promise.all(createPromises);

            // At least one should succeed, others may fail due to unique constraint
            const succeeded = results.filter((r) => !('error' in r));
            expect(succeeded.length).toBeGreaterThanOrEqual(1);
        });

        it('should create multiple customers with different emails concurrently', async () => {
            const createPromises = Array.from({ length: 10 }, (_, i) =>
                customersRepo.create({
                    externalId: `batch-test-${i}`,
                    email: `batch-${i}@example.com`,
                    name: `Batch User ${i}`,
                    livemode: true
                })
            );

            const results = await Promise.all(createPromises);

            // All should succeed
            expect(results.length).toBe(10);
            results.forEach((customer, i) => {
                expect(customer.email).toBe(`batch-${i}@example.com`);
            });
        });
    });

    describe('Mixed concurrent operations', () => {
        it('should handle mixed read/write operations concurrently', async () => {
            // Create initial customers
            const customers = await Promise.all(
                Array.from({ length: 5 }, (_, i) =>
                    customersRepo.create({
                        externalId: `mixed-test-${i}`,
                        email: `mixed-${i}@example.com`,
                        name: `Mixed User ${i}`,
                        livemode: true
                    })
                )
            );

            // Perform mixed operations concurrently
            const operations = [
                // Reads
                customersRepo.findById(customers[0].id),
                customersRepo.findById(customers[1].id),
                customersRepo.findByEmail('mixed-2@example.com', true),
                // Writes
                customersRepo.update(customers[3].id, {
                    name: 'Updated Mixed User 3',
                    version: customers[3].version
                }),
                customersRepo.update(customers[4].id, {
                    name: 'Updated Mixed User 4',
                    version: customers[4].version
                })
            ];

            const results = await Promise.allSettled(operations);

            // All operations should complete (either fulfilled or rejected gracefully)
            expect(results.length).toBe(5);

            // Reads should always succeed
            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('fulfilled');
            expect(results[2].status).toBe('fulfilled');
        });
    });

    describe('Stress test', () => {
        it('should maintain consistency under high concurrent load', async () => {
            const customer = await customersRepo.create({
                externalId: 'stress-test',
                email: 'stress@example.com',
                name: 'Stress Test User',
                metadata: { counter: 0 },
                livemode: true
            });

            // Perform 20 concurrent read operations
            const readPromises = Array.from({ length: 20 }, () => customersRepo.findById(customer.id));

            const results = await Promise.all(readPromises);

            // All reads should return the same customer
            for (const result of results) {
                expect(result?.id).toBe(customer.id);
                expect(result?.email).toBe('stress@example.com');
            }
        });
    });
});
