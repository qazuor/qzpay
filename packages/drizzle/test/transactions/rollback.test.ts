import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
/**
 * Transaction Rollback Tests
 *
 * Tests database transaction behavior including proper rollback
 * on errors and partial failure scenarios.
 *
 * NOTE: The current implementation of transaction() does not propagate
 * the transaction context to repositories, so true transaction rollback
 * is not fully supported. These tests verify the current behavior.
 *
 * TODO: Implement proper transaction context propagation in v2
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayDrizzleStorageAdapter } from '../../src/adapter/drizzle-storage.adapter.js';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Transaction Rollback', () => {
    let db: PostgresJsDatabase;
    let storageAdapter: QZPayDrizzleStorageAdapter;
    let customersRepo: QZPayCustomersRepository;
    let plansRepo: QZPayPlansRepository;

    beforeAll(async () => {
        const result = await startTestDatabase();
        db = result.db;
        storageAdapter = new QZPayDrizzleStorageAdapter({ db, livemode: true });
        customersRepo = new QZPayCustomersRepository(db);
        plansRepo = new QZPayPlansRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Transaction API', () => {
        it('should return the result of successful transaction', async () => {
            const result = await storageAdapter.transaction(async () => {
                const customer = await customersRepo.create({
                    externalId: 'return-test',
                    email: 'return@example.com',
                    name: 'Return Test',
                    livemode: true
                });

                return {
                    customerId: customer.id,
                    customerEmail: customer.email,
                    success: true
                };
            });

            expect(result.success).toBe(true);
            expect(result.customerEmail).toBe('return@example.com');
            expect(result.customerId).toBeDefined();

            // Verify the customer was created
            const customer = await customersRepo.findById(result.customerId);
            expect(customer).not.toBeNull();
        });

        it('should propagate errors from transaction callback', async () => {
            await expect(
                storageAdapter.transaction(async () => {
                    throw new Error('Custom error message');
                })
            ).rejects.toThrow('Custom error message');
        });

        it('should execute multiple operations sequentially within transaction', async () => {
            const result = await storageAdapter.transaction(async () => {
                const customer = await customersRepo.create({
                    externalId: 'multi-op-test',
                    email: 'multi@example.com',
                    name: 'Multi Op Test',
                    livemode: true
                });

                const plan = await plansRepo.create({
                    name: 'Multi Op Plan',
                    description: 'Created in transaction',
                    active: true,
                    livemode: true
                });

                return { customerId: customer.id, planId: plan.id };
            });

            expect(result.customerId).toBeDefined();
            expect(result.planId).toBeDefined();

            // Verify both were created
            const customer = await customersRepo.findById(result.customerId);
            const plan = await plansRepo.findById(result.planId);

            expect(customer).not.toBeNull();
            expect(plan).not.toBeNull();
        });
    });

    describe('Repository operations', () => {
        it('should create customer successfully', async () => {
            const customer = await customersRepo.create({
                externalId: 'standalone-test',
                email: 'standalone@example.com',
                name: 'Standalone Test',
                livemode: true
            });

            expect(customer.id).toBeDefined();
            expect(customer.email).toBe('standalone@example.com');
        });

        it('should update customer successfully', async () => {
            const customer = await customersRepo.create({
                externalId: 'update-test',
                email: 'update@example.com',
                name: 'Original Name',
                livemode: true
            });

            const updated = await customersRepo.update(customer.id, {
                name: 'Updated Name'
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(customer.updatedAt.getTime());
        });

        it('should throw when updating non-existent customer', async () => {
            await expect(
                customersRepo.update('00000000-0000-0000-0000-000000000000', {
                    name: 'Updated Name'
                })
            ).rejects.toThrow();
        });
    });

    describe('Version tracking', () => {
        it('should generate new version on create', async () => {
            const customer = await customersRepo.create({
                externalId: 'version-test',
                email: 'version@example.com',
                name: 'Version Test',
                livemode: true
            });

            expect(customer.version).toBeDefined();
            // UUID format check
            expect(customer.version).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should track version for potential optimistic locking', async () => {
            const customer = await customersRepo.create({
                externalId: 'track-version-test',
                email: 'track@example.com',
                name: 'Version 1',
                livemode: true
            });

            const originalVersion = customer.version;

            // Update the customer
            const updated = await customersRepo.update(customer.id, {
                name: 'Version 2',
                version: crypto.randomUUID() // Generate new version
            });

            // Version should be different after explicit update
            expect(updated.version).not.toBe(originalVersion);
        });
    });
});
