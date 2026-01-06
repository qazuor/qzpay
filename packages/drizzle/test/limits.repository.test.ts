/**
 * Limits Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayLimitsRepository } from '../src/repositories/limits.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

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
        // Create a test customer
        const customer = await customersRepository.create({
            externalId: 'test-customer',
            email: 'test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    // ==================== Limit Definitions ====================

    describe('createDefinition', () => {
        it('should create a new limit definition', async () => {
            const input = {
                id: crypto.randomUUID(),
                key: 'api_calls',
                name: 'API Calls',
                description: 'Number of API calls per month'
            };

            const limit = await repository.createDefinition(input);

            expect(limit.id).toBe(input.id);
            expect(limit.key).toBe('api_calls');
            expect(limit.name).toBe('API Calls');
            expect(limit.description).toBe('Number of API calls per month');
        });
    });

    describe('findDefinitionById', () => {
        it('should find limit definition by ID', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'storage_limit',
                name: 'Storage Limit'
            });

            const found = await repository.findDefinitionById(created.id);

            expect(found).not.toBeNull();
            expect(found?.key).toBe('storage_limit');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findDefinitionById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findDefinitionByKey', () => {
        it('should find limit definition by key', async () => {
            await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'bandwidth_limit',
                name: 'Bandwidth Limit'
            });

            const found = await repository.findDefinitionByKey('bandwidth_limit');

            expect(found).not.toBeNull();
            expect(found?.name).toBe('Bandwidth Limit');
        });
    });

    describe('listDefinitions', () => {
        it('should list all limit definitions', async () => {
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'limit_a', name: 'Limit A' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'limit_b', name: 'Limit B' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'limit_c', name: 'Limit C' });

            const definitions = await repository.listDefinitions();

            expect(definitions).toHaveLength(3);
            // Should be ordered by key
            expect(definitions[0].key).toBe('limit_a');
            expect(definitions[1].key).toBe('limit_b');
            expect(definitions[2].key).toBe('limit_c');
        });
    });

    describe('updateDefinition', () => {
        it('should update limit definition', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'old_limit',
                name: 'Old Limit Name'
            });

            const updated = await repository.updateDefinition(created.id, {
                name: 'New Limit Name',
                description: 'Updated description'
            });

            expect(updated.name).toBe('New Limit Name');
            expect(updated.description).toBe('Updated description');
        });
    });

    describe('deleteDefinition', () => {
        it('should delete limit definition', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'to_delete',
                name: 'To Delete'
            });

            await repository.deleteDefinition(created.id);

            const found = await repository.findDefinitionById(created.id);
            expect(found).toBeNull();
        });

        it('should throw error when deleting non-existent definition', async () => {
            await expect(repository.deleteDefinition('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('searchDefinitions', () => {
        beforeEach(async () => {
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_a', name: 'Search A' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_b', name: 'Search B' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_c', name: 'Search C' });
        });

        it('should search and paginate definitions', async () => {
            const page1 = await repository.searchDefinitions({ limit: 2, offset: 0 });
            const page2 = await repository.searchDefinitions({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page1.total).toBe(3);
            expect(page2.data).toHaveLength(1);
        });
    });

    // ==================== Customer Limits ====================

    describe('set', () => {
        it('should set a new limit for customer', async () => {
            const customerLimit = await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 0,
                source: 'subscription',
                livemode: true
            });

            expect(customerLimit.customerId).toBe(testCustomerId);
            expect(customerLimit.limitKey).toBe('api_calls');
            expect(customerLimit.maxValue).toBe(1000);
            expect(customerLimit.currentValue).toBe(0);
        });

        it('should update existing limit', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 0,
                source: 'subscription',
                livemode: true
            });

            const updated = await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 2000,
                currentValue: 0,
                source: 'manual',
                livemode: true
            });

            expect(updated.maxValue).toBe(2000);
            expect(updated.source).toBe('manual');
        });

        it('should set limit with reset date', async () => {
            const resetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            const customerLimit = await repository.set({
                customerId: testCustomerId,
                limitKey: 'monthly_limit',
                maxValue: 500,
                currentValue: 0,
                resetAt,
                source: 'subscription',
                livemode: true
            });

            expect(customerLimit.resetAt).toEqual(resetAt);
        });
    });

    describe('increment', () => {
        it('should increment current value', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 100,
                source: 'subscription',
                livemode: true
            });

            const incremented = await repository.increment(testCustomerId, 'api_calls', 50);

            expect(incremented.currentValue).toBe(150);
        });

        it('should increment by 1 by default', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 10,
                source: 'subscription',
                livemode: true
            });

            const incremented = await repository.increment(testCustomerId, 'api_calls');

            expect(incremented.currentValue).toBe(11);
        });

        it('should throw error when limit does not exist', async () => {
            await expect(repository.increment(testCustomerId, 'non_existent')).rejects.toThrow();
        });
    });

    describe('decrement', () => {
        it('should decrement current value', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 100,
                source: 'subscription',
                livemode: true
            });

            const decremented = await repository.decrement(testCustomerId, 'api_calls', 30);

            expect(decremented.currentValue).toBe(70);
        });

        it('should not go below zero', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 10,
                source: 'subscription',
                livemode: true
            });

            const decremented = await repository.decrement(testCustomerId, 'api_calls', 50);

            expect(decremented.currentValue).toBe(0);
        });

        it('should throw error when limit does not exist', async () => {
            await expect(repository.decrement(testCustomerId, 'non_existent')).rejects.toThrow();
        });
    });

    describe('resetUsage', () => {
        it('should reset current value to zero', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 500,
                source: 'subscription',
                livemode: true
            });

            const reset = await repository.resetUsage(testCustomerId, 'api_calls');

            expect(reset.currentValue).toBe(0);
        });
    });

    describe('check', () => {
        it('should check if limit exists and return status', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 100,
                currentValue: 75,
                source: 'subscription',
                livemode: true
            });

            const result = await repository.check(testCustomerId, 'api_calls');

            expect(result.exists).toBe(true);
            expect(result.isExceeded).toBe(false);
            expect(result.remaining).toBe(25);
            expect(result.limit).not.toBeNull();
        });

        it('should detect exceeded limit', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 100,
                currentValue: 100,
                source: 'subscription',
                livemode: true
            });

            const result = await repository.check(testCustomerId, 'api_calls');

            expect(result.isExceeded).toBe(true);
            expect(result.remaining).toBe(0);
        });

        it('should return exists:false for non-existent limit', async () => {
            const result = await repository.check(testCustomerId, 'non_existent');

            expect(result.exists).toBe(false);
            expect(result.limit).toBeNull();
        });
    });

    describe('findByCustomerId', () => {
        it('should find all limits for customer', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 1000,
                currentValue: 100,
                source: 'subscription',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'storage',
                maxValue: 500,
                currentValue: 50,
                source: 'subscription',
                livemode: true
            });

            const limits = await repository.findByCustomerId(testCustomerId);

            expect(limits).toHaveLength(2);
            expect(limits.map((l) => l.limitKey).sort()).toEqual(['api_calls', 'storage']);
        });
    });

    describe('delete', () => {
        it('should delete customer limit', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'to_delete',
                maxValue: 100,
                currentValue: 0,
                source: 'manual',
                livemode: true
            });

            await repository.delete(testCustomerId, 'to_delete');

            const result = await repository.check(testCustomerId, 'to_delete');
            expect(result.exists).toBe(false);
        });

        it('should throw error when deleting non-existent limit', async () => {
            await expect(repository.delete(testCustomerId, 'non_existent')).rejects.toThrow();
        });
    });

    describe('deleteBySource', () => {
        it('should delete all limits from a source', async () => {
            const sourceId = crypto.randomUUID();

            await repository.set({
                customerId: testCustomerId,
                limitKey: 'limit_1',
                maxValue: 100,
                currentValue: 0,
                source: 'subscription',
                sourceId,
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'limit_2',
                maxValue: 200,
                currentValue: 0,
                source: 'subscription',
                sourceId,
                livemode: true
            });

            const count = await repository.deleteBySource('subscription', sourceId);

            expect(count).toBe(2);

            const limits = await repository.findByCustomerId(testCustomerId);
            expect(limits).toHaveLength(0);
        });
    });

    describe('searchCustomerLimits', () => {
        beforeEach(async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'search_limit_1',
                maxValue: 100,
                currentValue: 10,
                source: 'subscription',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'search_limit_2',
                maxValue: 200,
                currentValue: 20,
                source: 'manual',
                livemode: true
            });
        });

        it('should search by customer ID', async () => {
            const result = await repository.searchCustomerLimits({ customerId: testCustomerId });

            expect(result.data).toHaveLength(2);
        });

        it('should search by limit key', async () => {
            const result = await repository.searchCustomerLimits({ limitKey: 'search_limit_1' });

            expect(result.data).toHaveLength(1);
        });

        it('should search by source', async () => {
            const result = await repository.searchCustomerLimits({ source: 'subscription' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].source).toBe('subscription');
        });

        it('should paginate results', async () => {
            const page1 = await repository.searchCustomerLimits({ customerId: testCustomerId, limit: 1 });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(2);
        });
    });

    describe('findNeedingReset', () => {
        it('should find limits that need reset', async () => {
            const pastResetDate = new Date(Date.now() - 1000);
            const futureResetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await repository.set({
                customerId: testCustomerId,
                limitKey: 'needs_reset',
                maxValue: 100,
                currentValue: 50,
                resetAt: pastResetDate,
                source: 'subscription',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'no_reset_yet',
                maxValue: 100,
                currentValue: 50,
                resetAt: futureResetDate,
                source: 'subscription',
                livemode: true
            });

            const needingReset = await repository.findNeedingReset(true);

            expect(needingReset).toHaveLength(1);
            expect(needingReset[0].limitKey).toBe('needs_reset');
        });
    });

    describe('resetAllExpired', () => {
        it('should reset all expired limits', async () => {
            const pastResetDate = new Date(Date.now() - 1000);
            const newResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await repository.set({
                customerId: testCustomerId,
                limitKey: 'expired_1',
                maxValue: 100,
                currentValue: 50,
                resetAt: pastResetDate,
                source: 'subscription',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'expired_2',
                maxValue: 200,
                currentValue: 100,
                resetAt: pastResetDate,
                source: 'subscription',
                livemode: true
            });

            const count = await repository.resetAllExpired(newResetDate);

            expect(count).toBe(2);

            const limits = await repository.findByCustomerId(testCustomerId);
            expect(limits.every((l) => l.currentValue === 0)).toBe(true);
            expect(limits.every((l) => l.resetAt?.getTime() === newResetDate.getTime())).toBe(true);
        });
    });

    describe('countCustomerLimits', () => {
        it('should count customer limits', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'count_1',
                maxValue: 100,
                currentValue: 0,
                source: 'manual',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'count_2',
                maxValue: 200,
                currentValue: 0,
                source: 'manual',
                livemode: true
            });

            const count = await repository.countCustomerLimits(testCustomerId);

            expect(count).toBe(2);
        });
    });

    describe('getUsageSummary', () => {
        it('should return usage summary for customer', async () => {
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'api_calls',
                maxValue: 100,
                currentValue: 75,
                source: 'subscription',
                livemode: true
            });
            await repository.set({
                customerId: testCustomerId,
                limitKey: 'storage',
                maxValue: 500,
                currentValue: 250,
                source: 'subscription',
                livemode: true
            });

            const summary = await repository.getUsageSummary(testCustomerId);

            expect(summary).toHaveLength(2);

            const apiCalls = summary.find((s) => s.limitKey === 'api_calls');
            expect(apiCalls?.maxValue).toBe(100);
            expect(apiCalls?.currentValue).toBe(75);
            expect(apiCalls?.remaining).toBe(25);
            expect(apiCalls?.percentage).toBe(75);

            const storage = summary.find((s) => s.limitKey === 'storage');
            expect(storage?.maxValue).toBe(500);
            expect(storage?.currentValue).toBe(250);
            expect(storage?.remaining).toBe(250);
            expect(storage?.percentage).toBe(50);
        });
    });
});
