/**
 * Limits Repository Integration Tests
 *
 * Tests the limits repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayLimitsRepository } from '../../src/repositories/limits.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('QZPayLimitsRepository', () => {
    let repository: QZPayLimitsRepository;
    let customersRepository: QZPayCustomersRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayLimitsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        // Create a test customer for customer limits
        const customer = await customersRepository.create({
            externalId: `test-customer-${randomUUID()}`,
            email: 'limits-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('Limit Definitions', () => {
        describe('createDefinition', () => {
            it('should create a limit definition', async () => {
                const limitDefId = randomUUID();
                const input = {
                    id: limitDefId,
                    key: 'api_calls',
                    name: 'API Calls',
                    description: 'Monthly API call limit',
                    defaultValue: 1000
                };

                const definition = await repository.createDefinition(input);

                expect(definition.id).toBe(limitDefId);
                expect(definition.key).toBe('api_calls');
                expect(definition.name).toBe('API Calls');
                expect(definition.description).toBe('Monthly API call limit');
                expect(definition.defaultValue).toBe(1000);
            });
        });

        describe('findDefinitionById', () => {
            it('should find definition by ID', async () => {
                const limitFindId = randomUUID();
                const created = await repository.createDefinition({
                    id: limitFindId,
                    key: 'storage_gb',
                    name: 'Storage GB',
                    description: null,
                    defaultValue: 10
                });

                const found = await repository.findDefinitionById(created.id);

                expect(found).not.toBeNull();
                expect(found?.id).toBe(limitFindId);
            });

            it('should return null for non-existent ID', async () => {
                const nonExistentId = randomUUID();
                const found = await repository.findDefinitionById(nonExistentId);
                expect(found).toBeNull();
            });
        });

        describe('findDefinitionByKey', () => {
            it('should find definition by key', async () => {
                const limitKeyId = randomUUID();
                await repository.createDefinition({
                    id: limitKeyId,
                    key: 'users',
                    name: 'Users',
                    description: 'Maximum users',
                    defaultValue: 5
                });

                const found = await repository.findDefinitionByKey('users');

                expect(found).not.toBeNull();
                expect(found?.key).toBe('users');
            });
        });

        describe('updateDefinition', () => {
            it('should update definition fields', async () => {
                const limitUpdateId = randomUUID();
                const created = await repository.createDefinition({
                    id: limitUpdateId,
                    key: 'test_limit',
                    name: 'Original Name',
                    description: 'Original',
                    defaultValue: 100
                });

                const updated = await repository.updateDefinition(created.id, {
                    name: 'Updated Name',
                    defaultValue: 200
                });

                expect(updated.name).toBe('Updated Name');
                expect(updated.defaultValue).toBe(200);
            });
        });

        describe('deleteDefinition', () => {
            it('should delete a definition', async () => {
                const limitDeleteId = randomUUID();
                const created = await repository.createDefinition({
                    id: limitDeleteId,
                    key: 'temp',
                    name: 'Temporary',
                    description: null,
                    defaultValue: 0
                });

                await repository.deleteDefinition(created.id);

                const found = await repository.findDefinitionById(created.id);
                expect(found).toBeNull();
            });
        });
    });

    describe('Customer Limits', () => {
        describe('set', () => {
            it('should set a new limit for customer', async () => {
                const limit = await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 5000,
                    currentValue: 0,
                    source: 'subscription',
                    sourceId: randomUUID(),
                    livemode: true
                });

                expect(limit.id).toBeDefined();
                expect(limit.customerId).toBe(testCustomerId);
                expect(limit.limitKey).toBe('api_calls');
                expect(limit.maxValue).toBe(5000);
                expect(limit.currentValue).toBe(0);
            });

            it('should update existing limit when set again', async () => {
                const newSourceId = randomUUID();
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 5000,
                    currentValue: 0,
                    source: 'subscription',
                    livemode: true
                });

                const updated = await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 10000,
                    currentValue: 0,
                    source: 'subscription',
                    sourceId: newSourceId,
                    livemode: true
                });

                expect(updated.maxValue).toBe(10000);
                expect(updated.sourceId).toBe(newSourceId);
            });
        });

        describe('increment', () => {
            it('should increment current value', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 100,
                    source: 'manual',
                    livemode: true
                });

                const incremented = await repository.increment(testCustomerId, 'api_calls', 50);

                expect(incremented.currentValue).toBe(150);
            });

            it('should increment by 1 when no amount specified', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 10,
                    source: 'manual',
                    livemode: true
                });

                const incremented = await repository.increment(testCustomerId, 'api_calls');

                expect(incremented.currentValue).toBe(11);
            });

            it('should throw error for non-existent limit', async () => {
                await expect(repository.increment(testCustomerId, 'non_existent', 1)).rejects.toThrow();
            });
        });

        describe('decrement', () => {
            it('should decrement current value', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'storage',
                    maxValue: 1000,
                    currentValue: 500,
                    source: 'manual',
                    livemode: true
                });

                const decremented = await repository.decrement(testCustomerId, 'storage', 100);

                expect(decremented.currentValue).toBe(400);
            });

            it('should not go below 0', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'storage',
                    maxValue: 1000,
                    currentValue: 50,
                    source: 'manual',
                    livemode: true
                });

                const decremented = await repository.decrement(testCustomerId, 'storage', 100);

                expect(decremented.currentValue).toBe(0);
            });
        });

        describe('resetUsage', () => {
            it('should reset current value to 0', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 750,
                    source: 'manual',
                    livemode: true
                });

                const reset = await repository.resetUsage(testCustomerId, 'api_calls');

                expect(reset.currentValue).toBe(0);
            });
        });

        describe('findByCustomerAndKey', () => {
            it('should find customer limit', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'users',
                    maxValue: 10,
                    currentValue: 3,
                    source: 'manual',
                    livemode: true
                });

                const limit = await repository.findByCustomerAndKey(testCustomerId, 'users');

                expect(limit).not.toBeNull();
                expect(limit?.limitKey).toBe('users');
                expect(limit?.maxValue).toBe(10);
            });

            it('should return null for non-existent limit', async () => {
                const limit = await repository.findByCustomerAndKey(testCustomerId, 'non_existent');
                expect(limit).toBeNull();
            });
        });

        describe('check', () => {
            it('should return exists false for non-existent limit', async () => {
                const check = await repository.check(testCustomerId, 'non_existent');

                expect(check.exists).toBe(false);
                expect(check.isExceeded).toBe(false);
                expect(check.limit).toBeNull();
            });

            it('should check if limit is exceeded', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 100,
                    currentValue: 150,
                    source: 'manual',
                    livemode: true
                });

                const check = await repository.check(testCustomerId, 'api_calls');

                expect(check.exists).toBe(true);
                expect(check.isExceeded).toBe(true);
                expect(check.remaining).toBe(0);
            });

            it('should calculate remaining correctly', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 300,
                    source: 'manual',
                    livemode: true
                });

                const check = await repository.check(testCustomerId, 'api_calls');

                expect(check.exists).toBe(true);
                expect(check.isExceeded).toBe(false);
                expect(check.remaining).toBe(700);
            });
        });

        describe('findByCustomerId', () => {
            it('should find all limits for customer', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 0,
                    source: 'manual',
                    livemode: true
                });
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'storage',
                    maxValue: 100,
                    currentValue: 0,
                    source: 'manual',
                    livemode: true
                });

                const limits = await repository.findByCustomerId(testCustomerId);

                expect(limits).toHaveLength(2);
            });
        });

        describe('delete', () => {
            it('should delete customer limit', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'temp',
                    maxValue: 10,
                    currentValue: 0,
                    source: 'manual',
                    livemode: true
                });

                await repository.delete(testCustomerId, 'temp');

                const found = await repository.findByCustomerAndKey(testCustomerId, 'temp');
                expect(found).toBeNull();
            });
        });

        describe('deleteBySource', () => {
            it('should delete all limits from source', async () => {
                const sourceId = randomUUID();

                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'limit1',
                    maxValue: 100,
                    currentValue: 0,
                    source: 'subscription',
                    sourceId,
                    livemode: true
                });
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'limit2',
                    maxValue: 200,
                    currentValue: 0,
                    source: 'subscription',
                    sourceId,
                    livemode: true
                });

                const deletedCount = await repository.deleteBySource('subscription', sourceId);

                expect(deletedCount).toBe(2);
            });
        });

        describe('getUsageSummary', () => {
            it('should return usage summary for customer', async () => {
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 250,
                    source: 'manual',
                    livemode: true
                });
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'storage',
                    maxValue: 100,
                    currentValue: 75,
                    source: 'manual',
                    livemode: true
                });

                const summary = await repository.getUsageSummary(testCustomerId);

                expect(summary).toHaveLength(2);
                expect(summary[0]).toMatchObject({
                    limitKey: 'api_calls',
                    maxValue: 1000,
                    currentValue: 250,
                    remaining: 750,
                    percentage: 25
                });
                expect(summary[1]).toMatchObject({
                    limitKey: 'storage',
                    maxValue: 100,
                    currentValue: 75,
                    remaining: 25,
                    percentage: 75
                });
            });
        });

        describe('findNeedingReset', () => {
            it('should find limits that need reset', async () => {
                const pastDate = new Date('2020-01-01');
                const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'monthly',
                    maxValue: 1000,
                    currentValue: 500,
                    resetAt: pastDate,
                    source: 'manual',
                    livemode: true
                });
                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'future',
                    maxValue: 1000,
                    currentValue: 200,
                    resetAt: futureDate,
                    source: 'manual',
                    livemode: true
                });

                const needingReset = await repository.findNeedingReset(true);

                expect(needingReset).toHaveLength(1);
                expect(needingReset[0].limitKey).toBe('monthly');
            });
        });

        describe('resetAllExpired', () => {
            it('should reset all expired limits', async () => {
                const pastDate = new Date('2020-01-01');
                const newResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                await repository.set({
                    customerId: testCustomerId,
                    limitKey: 'limit1',
                    maxValue: 1000,
                    currentValue: 900,
                    resetAt: pastDate,
                    source: 'manual',
                    livemode: true
                });

                const resetCount = await repository.resetAllExpired(newResetDate);

                expect(resetCount).toBe(1);

                const limit = await repository.findByCustomerAndKey(testCustomerId, 'limit1');
                expect(limit?.currentValue).toBe(0);
                expect(limit?.resetAt).toEqual(newResetDate);
            });
        });
    });
});
