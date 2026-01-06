/**
 * Usage Records Repository Integration Tests
 *
 * Tests the usage records repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayPlansRepository } from '../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../src/repositories/subscriptions.repository.js';
import { QZPayUsageRecordsRepository } from '../src/repositories/usage-records.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayUsageRecordsRepository', () => {
    let repository: QZPayUsageRecordsRepository;
    let customersRepository: QZPayCustomersRepository;
    let plansRepository: QZPayPlansRepository;
    let subscriptionsRepository: QZPaySubscriptionsRepository;
    let testSubscriptionId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayUsageRecordsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
        plansRepository = new QZPayPlansRepository(db);
        subscriptionsRepository = new QZPaySubscriptionsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Create test customer, plan, and subscription
        const customer = await customersRepository.create({
            externalId: 'ext-usage-customer',
            email: 'usage-test@example.com',
            livemode: true
        });

        const plan = await plansRepository.create({
            name: 'Usage Test Plan',
            active: true,
            livemode: true
        });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = await subscriptionsRepository.create({
            customerId: customer.id,
            planId: plan.id,
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            livemode: true
        });

        testSubscriptionId = subscription.id;
    });

    describe('create', () => {
        it('should create a usage record', async () => {
            const record = await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 100,
                action: 'increment',
                livemode: true
            });

            expect(record.id).toBeDefined();
            expect(record.subscriptionId).toBe(testSubscriptionId);
            expect(record.metricName).toBe('api_calls');
            expect(record.quantity).toBe(100);
            expect(record.action).toBe('increment');
        });

        it('should create usage record with idempotency key', async () => {
            const record = await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 50,
                action: 'increment',
                idempotencyKey: 'unique-key-123',
                livemode: true
            });

            expect(record.idempotencyKey).toBe('unique-key-123');
        });

        it('should create usage record with set action', async () => {
            const record = await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 500,
                action: 'set',
                livemode: true
            });

            expect(record.action).toBe('set');
            expect(record.quantity).toBe(500);
        });
    });

    describe('findById', () => {
        it('should find usage record by ID', async () => {
            const created = await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByIdempotencyKey', () => {
        it('should find usage record by idempotency key', async () => {
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 25,
                action: 'increment',
                idempotencyKey: 'find-me-key',
                livemode: true
            });

            const found = await repository.findByIdempotencyKey('find-me-key');

            expect(found).not.toBeNull();
            expect(found?.idempotencyKey).toBe('find-me-key');
        });

        it('should return null for non-existent key', async () => {
            const found = await repository.findByIdempotencyKey('non-existent');
            expect(found).toBeNull();
        });
    });

    describe('findBySubscriptionId', () => {
        it('should find usage records by subscription ID', async () => {
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 20,
                action: 'increment',
                livemode: true
            });

            const result = await repository.findBySubscriptionId(testSubscriptionId);

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by metric name', async () => {
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 100,
                action: 'increment',
                livemode: true
            });

            const result = await repository.findBySubscriptionId(testSubscriptionId, {
                metricName: 'api_calls'
            });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].metricName).toBe('api_calls');
        });

        it('should filter by date range', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });

            const result = await repository.findBySubscriptionId(testSubscriptionId, {
                startDate: yesterday,
                endDate: tomorrow
            });

            expect(result.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 5; i++) {
                await repository.create({
                    subscriptionId: testSubscriptionId,
                    metricName: 'api_calls',
                    quantity: i + 1,
                    action: 'increment',
                    livemode: true
                });
            }

            const page1 = await repository.findBySubscriptionId(testSubscriptionId, { limit: 2, offset: 0 });
            const page2 = await repository.findBySubscriptionId(testSubscriptionId, { limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(2);
            expect(page1.total).toBe(5);
        });
    });

    describe('getTotalUsage', () => {
        it('should get total usage for increment actions', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 20,
                action: 'increment',
                livemode: true
            });

            const total = await repository.getTotalUsage({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                startDate: yesterday,
                endDate: tomorrow
            });

            expect(total).toBe(30);
        });

        it('should use set action value when present', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 100,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 500,
                action: 'set',
                livemode: true
            });

            const total = await repository.getTotalUsage({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                startDate: yesterday,
                endDate: tomorrow
            });

            // Should use the 'set' value, not sum of increments
            expect(total).toBe(500);
        });
    });

    describe('getUsageSummaryByMetric', () => {
        it('should get usage summary grouped by metric', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 100,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 50,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 200,
                action: 'increment',
                livemode: true
            });

            const summary = await repository.getUsageSummaryByMetric(testSubscriptionId, yesterday, tomorrow);

            expect(summary).toHaveLength(2);
            const apiSummary = summary.find((s) => s.metricName === 'api_calls');
            expect(apiSummary?.total).toBe(150);
            expect(apiSummary?.count).toBe(2);
        });
    });

    describe('getDailyUsage', () => {
        it('should get daily usage breakdown', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 100,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 50,
                action: 'increment',
                livemode: true
            });

            const daily = await repository.getDailyUsage(testSubscriptionId, 'api_calls', yesterday, tomorrow);

            expect(daily.length).toBeGreaterThanOrEqual(1);
            const todayUsage = daily.find((d) => d.date === now.toISOString().split('T')[0]);
            expect(todayUsage?.total).toBe(150);
        });
    });

    describe('recordUsage', () => {
        it('should record usage and return created: true', async () => {
            const result = await repository.recordUsage({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 25,
                action: 'increment',
                livemode: true
            });

            expect(result.created).toBe(true);
            expect(result.record.quantity).toBe(25);
        });

        it('should return existing record with created: false for duplicate idempotency key', async () => {
            const first = await repository.recordUsage({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 25,
                action: 'increment',
                idempotencyKey: 'duplicate-key',
                livemode: true
            });

            const second = await repository.recordUsage({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 50, // Different quantity
                action: 'increment',
                idempotencyKey: 'duplicate-key', // Same key
                livemode: true
            });

            expect(first.created).toBe(true);
            expect(second.created).toBe(false);
            expect(second.record.id).toBe(first.record.id);
            expect(second.record.quantity).toBe(25); // Original quantity preserved
        });
    });

    describe('getMetricNames', () => {
        it('should get unique metric names for subscription', async () => {
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'storage_mb',
                quantity: 100,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 20,
                action: 'increment',
                livemode: true
            });

            const metrics = await repository.getMetricNames(testSubscriptionId);

            expect(metrics).toHaveLength(2);
            expect(metrics).toContain('api_calls');
            expect(metrics).toContain('storage_mb');
        });
    });

    describe('deleteOldRecords', () => {
        it('should delete records before specified date', async () => {
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });

            const future = new Date();
            future.setDate(future.getDate() + 1);

            const deletedCount = await repository.deleteOldRecords(future);

            expect(deletedCount).toBe(1);

            const remaining = await repository.findBySubscriptionId(testSubscriptionId);
            expect(remaining.data).toHaveLength(0);
        });
    });

    describe('getUsageCountForPeriod', () => {
        it('should count usage records for period', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 10,
                action: 'increment',
                livemode: true
            });
            await repository.create({
                subscriptionId: testSubscriptionId,
                metricName: 'api_calls',
                quantity: 20,
                action: 'increment',
                livemode: true
            });

            const count = await repository.getUsageCountForPeriod(testSubscriptionId, 'api_calls', yesterday, tomorrow);

            expect(count).toBe(2);
        });
    });
});
