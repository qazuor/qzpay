/**
 * Subscriptions Repository Tests
 *
 * Tests for QZPaySubscriptionsRepository operations.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayPlansRepository } from '../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPaySubscriptionsRepository', () => {
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let customersRepo: QZPayCustomersRepository;
    let plansRepo: QZPayPlansRepository;
    let customerId: string;
    let planId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
        plansRepo = new QZPayPlansRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Create a customer for subscriptions
        const customer = await customersRepo.create({
            externalId: `sub-test-${Date.now()}`,
            email: 'subscription-test@example.com',
            name: 'Subscription Test User',
            livemode: true
        });
        customerId = customer.id;

        // Create a plan for subscriptions
        const plan = await plansRepo.create({
            name: 'Test Plan',
            description: 'A test plan for subscriptions',
            active: true,
            features: [],
            entitlements: [],
            limits: {},
            livemode: true
        });
        planId = plan.id;
    });

    describe('create', () => {
        it('should create a new subscription', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const subscription = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            expect(subscription.id).toBeDefined();
            expect(subscription.customerId).toBe(customerId);
            expect(subscription.planId).toBe(planId);
            expect(subscription.status).toBe('active');
            expect(subscription.billingInterval).toBe('month');
        });

        it('should create subscription with trial period', async () => {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const subscription = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'trialing',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                trialStart: now,
                trialEnd: trialEnd,
                livemode: true
            });

            expect(subscription.status).toBe('trialing');
            expect(subscription.trialStart).toBeDefined();
            expect(subscription.trialEnd).toBeDefined();
        });
    });

    describe('findById', () => {
        it('should find subscription by id', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const found = await subscriptionsRepo.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.customerId).toBe(customerId);
        });

        it('should return null for non-existent subscription', async () => {
            // Use a valid UUID format that doesn't exist
            const found = await subscriptionsRepo.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByCustomerId', () => {
        it('should find all subscriptions for a customer', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // Create multiple subscriptions
            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'canceled',
                billingInterval: 'year',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const result = await subscriptionsRepo.findByCustomerId(customerId);

            expect(result.data.length).toBe(2);
            expect(result.data.every((s) => s.customerId === customerId)).toBe(true);
        });
    });

    describe('update', () => {
        it('should update subscription status', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const updated = await subscriptionsRepo.update(created.id, {
                status: 'past_due'
            });

            expect(updated.status).toBe('past_due');
            expect(updated.id).toBe(created.id);
        });

        it('should update cancel at timestamp', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const cancelDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
            const updated = await subscriptionsRepo.update(created.id, {
                cancelAt: cancelDate
            });

            expect(updated.cancelAt).toBeDefined();
        });

        it('should update metadata', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                metadata: {},
                livemode: true
            });

            const updated = await subscriptionsRepo.update(created.id, {
                metadata: { upgraded: true, previousPlan: 'basic' }
            });

            expect(updated.metadata).toEqual({ upgraded: true, previousPlan: 'basic' });
        });
    });

    describe('softDelete', () => {
        it('should soft delete a subscription', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            await subscriptionsRepo.softDelete(created.id);

            const found = await subscriptionsRepo.findById(created.id);
            expect(found).toBeNull();
        });
    });

    describe('search', () => {
        it('should search subscriptions with filters', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // Create subscriptions with different statuses
            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'canceled',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const activeResult = await subscriptionsRepo.search({
                status: 'active',
                livemode: true
            });

            expect(activeResult.data.length).toBe(1);
            expect(activeResult.data[0].status).toBe('active');
        });

        it('should paginate results', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // Create 5 subscriptions
            for (let i = 0; i < 5; i++) {
                await subscriptionsRepo.create({
                    customerId,
                    planId,
                    status: 'active',
                    billingInterval: 'month',
                    intervalCount: 1,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    livemode: true
                });
            }

            const result = await subscriptionsRepo.search({
                limit: 2,
                offset: 0,
                livemode: true
            });

            expect(result.data.length).toBe(2);
            expect(result.total).toBe(5);
        });
    });

    describe('findByStatus', () => {
        it('should find subscriptions by status', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // Create active subscription
            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Create canceled subscription
            await subscriptionsRepo.create({
                customerId,
                planId,
                status: 'canceled',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const activeResult = await subscriptionsRepo.search({
                status: 'active',
                livemode: true
            });

            expect(activeResult.data.length).toBe(1);
            expect(activeResult.data[0].status).toBe('active');
        });
    });
});
