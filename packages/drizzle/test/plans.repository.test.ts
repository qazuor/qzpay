/**
 * Plans Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayPlansRepository } from '../src/repositories/plans.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayPlansRepository', () => {
    let repository: QZPayPlansRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayPlansRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('create', () => {
        it('should create a new plan', async () => {
            const input = {
                id: crypto.randomUUID(),
                name: 'Basic Plan',
                description: 'A basic plan for starters',
                active: true,
                livemode: true
            };

            const plan = await repository.create(input);

            expect(plan.id).toBe(input.id);
            expect(plan.name).toBe('Basic Plan');
            expect(plan.description).toBe('A basic plan for starters');
            expect(plan.active).toBe(true);
            expect(plan.livemode).toBe(true);
            expect(plan.createdAt).toBeInstanceOf(Date);
        });

        it('should create plan with features', async () => {
            const input = {
                id: crypto.randomUUID(),
                name: 'Pro Plan',
                features: [{ name: 'Feature 1' }, { name: 'Feature 2' }],
                active: true,
                livemode: true
            };

            const plan = await repository.create(input);

            expect(plan.features).toEqual([{ name: 'Feature 1' }, { name: 'Feature 2' }]);
        });

        it('should create plan with entitlements and limits', async () => {
            const input = {
                id: crypto.randomUUID(),
                name: 'Enterprise Plan',
                entitlements: ['api_access', 'premium_support'],
                limits: { api_calls: 10000, storage_gb: 100 },
                active: true,
                livemode: true
            };

            const plan = await repository.create(input);

            expect(plan.entitlements).toEqual(['api_access', 'premium_support']);
            expect(plan.limits).toEqual({ api_calls: 10000, storage_gb: 100 });
        });
    });

    describe('findById', () => {
        it('should find plan by ID', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Find Test Plan',
                active: true,
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe('Find Test Plan');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });

        it('should not find soft-deleted plans', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Deleted Plan',
                active: true,
                livemode: true
            });

            await repository.softDelete(created.id);
            const found = await repository.findById(created.id);

            expect(found).toBeNull();
        });
    });

    describe('findActive', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Active Plan 1',
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Active Plan 2',
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Inactive Plan',
                active: false,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Test Mode Plan',
                active: true,
                livemode: false
            });
        });

        it('should find active plans in livemode', async () => {
            const plans = await repository.findActive(true);

            expect(plans).toHaveLength(2);
            expect(plans.every((p) => p.active)).toBe(true);
            expect(plans.every((p) => p.livemode)).toBe(true);
        });

        it('should find active plans in test mode', async () => {
            const plans = await repository.findActive(false);

            expect(plans).toHaveLength(1);
            expect(plans[0].name).toBe('Test Mode Plan');
        });
    });

    describe('update', () => {
        it('should update plan fields', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Original Name',
                description: 'Original description',
                active: true,
                livemode: true
            });

            const updated = await repository.update(created.id, {
                name: 'Updated Name',
                description: 'Updated description'
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.description).toBe('Updated description');
            expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should throw error when updating non-existent plan', async () => {
            await expect(repository.update('00000000-0000-0000-0000-000000000000', { name: 'Test' })).rejects.toThrow();
        });
    });

    describe('softDelete', () => {
        it('should soft delete a plan and deactivate it', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'To Delete',
                active: true,
                livemode: true
            });

            await repository.softDelete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw error when deleting non-existent plan', async () => {
            await expect(repository.softDelete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('activate / deactivate', () => {
        it('should activate a plan', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Inactive Plan',
                active: false,
                livemode: true
            });

            const activated = await repository.activate(created.id);

            expect(activated.active).toBe(true);
        });

        it('should deactivate a plan', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Active Plan',
                active: true,
                livemode: true
            });

            const deactivated = await repository.deactivate(created.id);

            expect(deactivated.active).toBe(false);
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Basic Plan',
                description: 'For beginners',
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Pro Plan',
                description: 'For professionals',
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                name: 'Enterprise Plan',
                description: 'For large teams',
                active: false,
                livemode: true
            });
        });

        it('should search by name', async () => {
            const result = await repository.search({ query: 'Pro' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].name).toBe('Pro Plan');
        });

        it('should search by description', async () => {
            const result = await repository.search({ query: 'large teams' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].name).toBe('Enterprise Plan');
        });

        it('should filter by active status', async () => {
            const activeResult = await repository.search({ active: true });
            const inactiveResult = await repository.search({ active: false });

            expect(activeResult.data).toHaveLength(2);
            expect(inactiveResult.data).toHaveLength(1);
        });

        it('should filter by livemode', async () => {
            const result = await repository.search({ livemode: true });

            expect(result.data).toHaveLength(3);
        });

        it('should paginate results', async () => {
            const page1 = await repository.search({ limit: 1, offset: 0 });
            const page2 = await repository.search({ limit: 1, offset: 1 });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(3);
            expect(page2.data).toHaveLength(1);
            expect(page2.data[0].id).not.toBe(page1.data[0].id);
        });
    });

    describe('updateFeatures', () => {
        it('should update plan features', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Features Plan',
                features: [{ name: 'Old Feature' }],
                active: true,
                livemode: true
            });

            const updated = await repository.updateFeatures(created.id, [{ name: 'New Feature 1' }, { name: 'New Feature 2' }]);

            expect(updated.features).toEqual([{ name: 'New Feature 1' }, { name: 'New Feature 2' }]);
        });
    });

    describe('updateEntitlements', () => {
        it('should update plan entitlements', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Entitlements Plan',
                entitlements: ['old_entitlement'],
                active: true,
                livemode: true
            });

            const updated = await repository.updateEntitlements(created.id, ['new_entitlement_1', 'new_entitlement_2']);

            expect(updated.entitlements).toEqual(['new_entitlement_1', 'new_entitlement_2']);
        });
    });

    describe('updateLimits', () => {
        it('should update plan limits', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Limits Plan',
                limits: { old_limit: 100 },
                active: true,
                livemode: true
            });

            const updated = await repository.updateLimits(created.id, { new_limit: 500, another_limit: 1000 });

            expect(updated.limits).toEqual({ new_limit: 500, another_limit: 1000 });
        });
    });

    describe('updateMetadata', () => {
        it('should update plan metadata', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                name: 'Metadata Plan',
                metadata: { initial: true },
                active: true,
                livemode: true
            });

            const updated = await repository.updateMetadata(created.id, { updated: true, version: 2 });

            expect(updated.metadata).toEqual({ updated: true, version: 2 });
        });
    });

    describe('count', () => {
        beforeEach(async () => {
            await repository.create({ id: crypto.randomUUID(), name: 'P1', active: true, livemode: true });
            await repository.create({ id: crypto.randomUUID(), name: 'P2', active: true, livemode: true });
            await repository.create({ id: crypto.randomUUID(), name: 'P3', active: false, livemode: true });
            await repository.create({ id: crypto.randomUUID(), name: 'P4', active: true, livemode: false });
        });

        it('should count plans with filters', async () => {
            const total = await repository.count();
            const liveActive = await repository.count(true, true);
            const liveInactive = await repository.count(true, false);
            const testActive = await repository.count(false, true);

            expect(total).toBe(4);
            expect(liveActive).toBe(2);
            expect(liveInactive).toBe(1);
            expect(testActive).toBe(1);
        });
    });
});
