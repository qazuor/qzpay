/**
 * Plans Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

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
            const planId = crypto.randomUUID();
            const input = {
                id: planId,
                name: 'Pro Plan',
                description: 'Professional features',
                active: true,
                features: [{ name: 'Feature 1', included: true }],
                entitlements: ['feature_1'],
                limits: { api_calls: 10000 },
                metadata: {},
                livemode: true
            };

            const plan = await repository.create(input);

            expect(plan.id).toBe(planId);
            expect(plan.name).toBe('Pro Plan');
            expect(plan.active).toBe(true);
        });
    });

    describe('findById', () => {
        it('should find plan by ID', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Find Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(planId);
        });

        it('should not find soft-deleted plans', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Deleted Plan',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            await repository.softDelete(created.id);
            const found = await repository.findById(created.id);

            expect(found).toBeNull();
        });
    });

    describe('findActive', () => {
        it('should find only active plans', async () => {
            const activeId = crypto.randomUUID();
            const inactiveId = crypto.randomUUID();
            await repository.create({
                id: activeId,
                name: 'Active',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: inactiveId,
                name: 'Inactive',
                description: null,
                active: false,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const active = await repository.findActive(true);

            expect(active.some((p) => p.id === activeId)).toBe(true);
            expect(active.some((p) => p.id === inactiveId)).toBe(false);
        });
    });

    describe('update', () => {
        it('should update plan fields', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Original',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const updated = await repository.update(created.id, {
                name: 'Updated',
                description: 'New description'
            });

            expect(updated.name).toBe('Updated');
            expect(updated.description).toBe('New description');
        });
    });

    describe('softDelete', () => {
        it('should soft delete a plan', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Delete Me',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            await repository.softDelete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });
    });

    describe('activate / deactivate', () => {
        it('should activate a plan', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: false,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const activated = await repository.activate(created.id);

            expect(activated.active).toBe(true);
        });

        it('should deactivate a plan', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const deactivated = await repository.deactivate(created.id);

            expect(deactivated.active).toBe(false);
        });
    });

    describe('search', () => {
        it('should search plans by query', async () => {
            const planId = crypto.randomUUID();
            await repository.create({
                id: planId,
                name: 'Professional Plan',
                description: 'For professionals',
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const result = await repository.search({ query: 'professional' });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.some((p) => p.name.toLowerCase().includes('professional'))).toBe(true);
        });

        it('should filter by active status', async () => {
            const planId = crypto.randomUUID();
            await repository.create({
                id: planId,
                name: 'Active',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const result = await repository.search({ active: true });

            expect(result.data.every((p) => p.active === true)).toBe(true);
        });

        it('should paginate results', async () => {
            const planId1 = crypto.randomUUID();
            const planId2 = crypto.randomUUID();
            await repository.create({
                id: planId1,
                name: 'Plan 1',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: planId2,
                name: 'Plan 2',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const page1 = await repository.search({ limit: 1, offset: 0 });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(2);
        });
    });

    describe('update methods', () => {
        it('should update features', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const features = [{ name: 'New Feature', included: true }];
            const updated = await repository.updateFeatures(created.id, features);

            expect(updated.features).toEqual(features);
        });

        it('should update entitlements', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const entitlements = ['premium', 'api_access'];
            const updated = await repository.updateEntitlements(created.id, entitlements);

            expect(updated.entitlements).toEqual(entitlements);
        });

        it('should update limits', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const limits = { api_calls: 5000, storage_gb: 100 };
            const updated = await repository.updateLimits(created.id, limits);

            expect(updated.limits).toEqual(limits);
        });

        it('should update metadata', async () => {
            const planId = crypto.randomUUID();
            const created = await repository.create({
                id: planId,
                name: 'Test',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const metadata = { tier: 'premium' };
            const updated = await repository.updateMetadata(created.id, metadata);

            expect(updated.metadata).toEqual(metadata);
        });
    });

    describe('count', () => {
        it('should count all plans', async () => {
            const planId1 = crypto.randomUUID();
            const planId2 = crypto.randomUUID();
            await repository.create({
                id: planId1,
                name: 'Plan 1',
                description: null,
                active: true,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: planId2,
                name: 'Plan 2',
                description: null,
                active: false,
                features: [],
                entitlements: [],
                limits: {},
                metadata: {},
                livemode: true
            });

            const total = await repository.count();
            const active = await repository.count(undefined, true);

            expect(total).toBe(2);
            expect(active).toBe(1);
        });
    });
});
