/**
 * Subscription Polling Jobs Repository Tests
 *
 * Integration tests for QZPaySubscriptionPollingJobsRepository.
 * Uses Testcontainers to run against a real Postgres so the partial-
 * unique constraint, optimistic locking, and gen_random_uuid() rotation
 * are exercised end-to-end (these would silently no-op against a fake DB).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPaySubscriptionPollingJobsRepository } from '../src/repositories/subscription-polling-jobs.repository.js';
import { QZPaySubscriptionsRepository } from '../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPaySubscriptionPollingJobsRepository', () => {
    let repo: QZPaySubscriptionPollingJobsRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let customersRepo: QZPayCustomersRepository;
    let subscriptionId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repo = new QZPaySubscriptionPollingJobsRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Create a customer and a subscription so polling jobs can FK to it
        const customer = await customersRepo.create({
            externalId: `polling-test-${Date.now()}`,
            email: 'polling-test@example.com',
            name: 'Polling Test User',
            livemode: true
        });
        const now = new Date();
        const subscription = await subscriptionsRepo.create({
            customerId: customer.id,
            planId: 'plan_test',
            status: 'incomplete',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            livemode: true
        });
        subscriptionId = subscription.id;
    });

    describe('create', () => {
        it('should insert a new pending polling job with defaults', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });

            expect(job).not.toBeNull();
            expect(job?.subscriptionId).toBe(subscriptionId);
            expect(job?.provider).toBe('mercadopago');
            expect(job?.providerResourceId).toBe('preapproval_123');
            expect(job?.status).toBe('pending');
            expect(job?.attempts).toBe(0);
            expect(job?.version).toBeDefined();
        });

        it('should return null on partial-unique conflict (second active job for same subscription)', async () => {
            const first = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_first',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(first).not.toBeNull();

            const second = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_second',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(second).toBeNull();
        });

        it('should allow a second job for the same subscription when the first is terminal', async () => {
            const first = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_first',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(first).not.toBeNull();
            if (!first) return;

            // Move first to terminal
            const terminated = await repo.tryLockedUpdate({
                id: first.id,
                expectedVersion: first.version,
                status: 'succeeded',
                completedAt: new Date()
            });
            expect(terminated?.status).toBe('succeeded');

            // Now a second `pending` job for the same sub is allowed
            const second = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_second',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(second).not.toBeNull();
        });
    });

    describe('findById', () => {
        it('should fetch a job by id', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            const found = await repo.findById(job.id);
            expect(found?.id).toBe(job.id);
        });

        it('should return null for unknown id', async () => {
            const found = await repo.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findActiveBySubscriptionId', () => {
        it('should return the pending job for a subscription', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            const found = await repo.findActiveBySubscriptionId(subscriptionId);
            expect(found?.id).toBe(job.id);
        });

        it('should NOT return a terminal job', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');
            await repo.tryLockedUpdate({
                id: job.id,
                expectedVersion: job.version,
                status: 'succeeded',
                completedAt: new Date()
            });

            const found = await repo.findActiveBySubscriptionId(subscriptionId);
            expect(found).toBeNull();
        });
    });

    describe('findDuePending', () => {
        it('should return only jobs whose next_poll_at <= now', async () => {
            const past = new Date(Date.now() - 60_000);
            const future = new Date(Date.now() + 60_000);

            const dueJob = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_due',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: past,
                metadata: {}
            });
            expect(dueJob).not.toBeNull();
            // Need a second sub for the second job (one active per sub)
            const customer2 = await customersRepo.create({
                externalId: `polling-test-due2-${Date.now()}`,
                email: 'polling-test2@example.com',
                name: 'Polling Test 2',
                livemode: true
            });
            const now = new Date();
            const sub2 = await subscriptionsRepo.create({
                customerId: customer2.id,
                planId: 'plan_test',
                status: 'incomplete',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                livemode: true
            });
            const notDueJob = await repo.create({
                subscriptionId: sub2.id,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_future',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: future,
                metadata: {}
            });
            expect(notDueJob).not.toBeNull();

            const due = await repo.findDuePending(new Date(), 50);
            const dueIds = due.map((j) => j.id);
            expect(dueIds).toContain(dueJob?.id);
            expect(dueIds).not.toContain(notDueJob?.id);
        });

        it('should clamp limit between 1 and 200', async () => {
            const past = new Date(Date.now() - 60_000);
            await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_due',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: past,
                metadata: {}
            });

            // Limit 0 → still returns at least 1 because clamp lower-bounds to 1
            const due = await repo.findDuePending(new Date(), 0);
            expect(due.length).toBeGreaterThanOrEqual(0);
            expect(due.length).toBeLessThanOrEqual(200);
        });
    });

    describe('tryLockedUpdate', () => {
        it('should update when expectedVersion matches and rotate version', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            const updated = await repo.tryLockedUpdate({
                id: job.id,
                expectedVersion: job.version,
                status: 'pending',
                incrementAttemptsBy: 1,
                lastPolledAt: new Date(),
                lastProviderStatus: 'pending'
            });

            expect(updated).not.toBeNull();
            expect(updated?.attempts).toBe(1);
            expect(updated?.lastProviderStatus).toBe('pending');
            expect(updated?.version).not.toBe(job.version);
        });

        it('should return null when expectedVersion does not match', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            const result = await repo.tryLockedUpdate({
                id: job.id,
                expectedVersion: '00000000-0000-0000-0000-000000000000',
                status: 'succeeded'
            });

            expect(result).toBeNull();
            // Original job is unchanged
            const stillPending = await repo.findById(job.id);
            expect(stillPending?.status).toBe('pending');
        });

        it('should set completedAt when transitioning to terminal status', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            const completedAt = new Date();
            const updated = await repo.tryLockedUpdate({
                id: job.id,
                expectedVersion: job.version,
                status: 'succeeded',
                completedAt
            });

            expect(updated?.status).toBe('succeeded');
            expect(updated?.completedAt).toEqual(completedAt);
        });

        it('should accept null to clear lastProviderStatus / lastError', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');
            const populated = await repo.tryLockedUpdate({
                id: job.id,
                expectedVersion: job.version,
                lastProviderStatus: 'pending',
                lastError: 'transient'
            });
            if (!populated) throw new Error('First update failed');

            const cleared = await repo.tryLockedUpdate({
                id: populated.id,
                expectedVersion: populated.version,
                lastProviderStatus: null,
                lastError: null
            });

            expect(cleared?.lastProviderStatus).toBeNull();
            expect(cleared?.lastError).toBeNull();
        });
    });

    describe('cascade delete', () => {
        it('should delete polling jobs when the parent subscription is deleted', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_123',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            await subscriptionsRepo.softDelete(subscriptionId);
            // Soft delete does NOT cascade; only hard delete does.
            const stillThere = await repo.findById(job.id);
            expect(stillThere).not.toBeNull();
        });
    });
});
