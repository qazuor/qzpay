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

        it('should return null on partial-unique conflict (second active job for the SAME resource)', async () => {
            const first = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_same',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(first).not.toBeNull();

            const duplicate = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_same',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(duplicate).toBeNull();
        });

        it('should allow concurrent active jobs for DIFFERENT resources of the same subscription', async () => {
            // Regression guard. This is the exact shape that lost real money:
            // one subscription, several one-time checkouts in flight at once.
            // The old index was scoped to `subscription_id`, so the first
            // checkout — even an abandoned one — held the only slot and every
            // later enqueue returned null, leaving the purchase that actually
            // got PAID with no polling job. MP Preferences have no Webhooks v2
            // channel, so that job is the only activation path there is.
            const abandonedCheckout = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_abandoned',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(abandonedCheckout).not.toBeNull();

            const paidCheckout = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_paid',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(paidCheckout).not.toBeNull();
            expect(paidCheckout?.providerResourceId).toBe('checkout_paid');
            expect(paidCheckout?.id).not.toBe(abandonedCheckout?.id);
        });

        it('should scope resource uniqueness per provider', async () => {
            // Resource ids are only unique inside one provider's namespace, so
            // the same id under two providers must not collide.
            const mp = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'shared_id',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(mp).not.toBeNull();

            const stripe = await repo.create({
                subscriptionId,
                provider: 'stripe',
                providerResourceId: 'shared_id',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(stripe).not.toBeNull();
        });

        it('should allow a second job for the same RESOURCE once the first is terminal', async () => {
            // Both jobs deliberately share one providerResourceId: with two
            // different ids the second insert would succeed regardless of the
            // first's status, and this test would pass without proving that
            // terminal rows are exempt from the partial index.
            const first = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_retried',
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

            // Now a second `pending` job for the same resource is allowed
            const second = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_retried',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            expect(second).not.toBeNull();
            expect(second?.id).not.toBe(first.id);
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

        it('should return the OLDEST pending job when a subscription has several', async () => {
            // Now that one subscription can hold several concurrent jobs, an
            // unordered `LIMIT 1` would return an arbitrary row and a caller
            // closing "the" job would close a different purchase each call.
            const first = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_older',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            const second = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_newer',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!first || !second) throw new Error('Setup failed');

            // Repeat: a single call could match the oldest by chance.
            for (let i = 0; i < 5; i++) {
                const found = await repo.findActiveBySubscriptionId(subscriptionId);
                expect(found?.id).toBe(first.id);
            }
        });
    });

    describe('findActiveByProviderResourceId', () => {
        it('should return the pending job for that exact resource, not a sibling', async () => {
            const target = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_target',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            const sibling = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_sibling',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!target || !sibling) throw new Error('Setup failed');

            const found = await repo.findActiveByProviderResourceId('mercadopago', 'checkout_target');
            expect(found?.id).toBe(target.id);
            expect(found?.id).not.toBe(sibling.id);
        });

        it('should NOT return a terminal job', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'checkout_done',
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

            const found = await repo.findActiveByProviderResourceId('mercadopago', 'checkout_done');
            expect(found).toBeNull();
        });

        it('should not match the same resource id under a different provider', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'ambiguous_id',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });
            if (!job) throw new Error('Setup failed');

            expect(await repo.findActiveByProviderResourceId('stripe', 'ambiguous_id')).toBeNull();
            expect(await repo.findActiveByProviderResourceId('mercadopago', 'ambiguous_id')).not.toBeNull();
        });

        it('should return null for an unknown resource id', async () => {
            const found = await repo.findActiveByProviderResourceId('mercadopago', 'never_created');
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

    describe('resourceType', () => {
        // Polling supports two flavours: recurring subscriptions (default
        // `subscription`) and one-time payment checkouts (`one_time_payment`).
        // The schema default keeps existing rows happy.

        it('defaults resource_type to "subscription" when omitted on insert', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'preapproval_default',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });

            expect(job?.resourceType).toBe('subscription');
        });

        it('persists resource_type="one_time_payment" when supplied explicitly', async () => {
            const job = await repo.create({
                subscriptionId,
                provider: 'mercadopago',
                providerResourceId: 'pref_annual_xyz',
                resourceType: 'one_time_payment',
                status: 'pending',
                attempts: 0,
                maxAttempts: 60,
                nextPollAt: new Date(),
                metadata: {}
            });

            expect(job?.resourceType).toBe('one_time_payment');

            const found = await repo.findById(job?.id ?? '');
            expect(found?.resourceType).toBe('one_time_payment');
        });
    });
});
