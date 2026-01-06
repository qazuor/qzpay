/**
 * Webhook Events Repository Integration Tests
 *
 * Tests the webhook events repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayWebhookEventsRepository } from '../src/repositories/webhook-events.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayWebhookEventsRepository', () => {
    let repository: QZPayWebhookEventsRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayWebhookEventsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('create', () => {
        it('should create a webhook event', async () => {
            const event = await repository.create({
                providerEventId: 'evt_stripe_123',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: { id: 'pi_123', amount: 1000 },
                status: 'pending',
                livemode: true
            });

            expect(event.id).toBeDefined();
            expect(event.providerEventId).toBe('evt_stripe_123');
            expect(event.provider).toBe('stripe');
            expect(event.type).toBe('payment_intent.succeeded');
            expect(event.status).toBe('pending');
        });

        it('should create event with default status', async () => {
            const event = await repository.create({
                providerEventId: 'evt_mp_456',
                provider: 'mercadopago',
                type: 'payment',
                payload: { data: { id: '123' } },
                livemode: true
            });

            expect(event.status).toBe('pending');
        });
    });

    describe('findById', () => {
        it('should find webhook event by ID', async () => {
            const created = await repository.create({
                providerEventId: 'evt_find_123',
                provider: 'stripe',
                type: 'invoice.paid',
                payload: {},
                status: 'pending',
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

    describe('exists', () => {
        it('should return true for existing provider event ID', async () => {
            await repository.create({
                providerEventId: 'evt_exists_123',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                status: 'pending',
                livemode: true
            });

            const exists = await repository.exists('evt_exists_123');
            expect(exists).toBe(true);
        });

        it('should return false for non-existent provider event ID', async () => {
            const exists = await repository.exists('evt_nonexistent');
            expect(exists).toBe(false);
        });
    });

    describe('findByProviderEventId', () => {
        it('should find event by provider event ID', async () => {
            await repository.create({
                providerEventId: 'evt_provider_123',
                provider: 'stripe',
                type: 'customer.created',
                payload: { customer: 'cus_123' },
                status: 'pending',
                livemode: true
            });

            const found = await repository.findByProviderEventId('evt_provider_123');

            expect(found).not.toBeNull();
            expect(found?.providerEventId).toBe('evt_provider_123');
        });

        it('should return null for non-existent provider event ID', async () => {
            const found = await repository.findByProviderEventId('evt_missing');
            expect(found).toBeNull();
        });
    });

    describe('record', () => {
        it('should record a new webhook event with default status', async () => {
            const event = await repository.record({
                providerEventId: 'evt_record_123',
                provider: 'stripe',
                type: 'charge.succeeded',
                payload: { charge: 'ch_123' },
                livemode: true
            });

            expect(event.id).toBeDefined();
            expect(event.status).toBe('pending');
            expect(event.attempts).toBe(0);
        });

        it('should record event with test mode', async () => {
            const event = await repository.record({
                providerEventId: 'evt_test_123',
                provider: 'mercadopago',
                type: 'payment',
                payload: {},
                livemode: false
            });

            expect(event.livemode).toBe(false);
        });
    });

    describe('markProcessing', () => {
        it('should mark event as processing and increment attempts', async () => {
            const created = await repository.record({
                providerEventId: 'evt_processing_123',
                provider: 'stripe',
                type: 'invoice.payment_succeeded',
                payload: {},
                livemode: true
            });

            const updated = await repository.markProcessing(created.id);

            expect(updated.status).toBe('processing');
            expect(updated.attempts).toBe(1);
        });

        it('should increment attempts on each call', async () => {
            const created = await repository.record({
                providerEventId: 'evt_multi_process',
                provider: 'stripe',
                type: 'subscription.updated',
                payload: {},
                livemode: true
            });

            await repository.markProcessing(created.id);
            const second = await repository.markProcessing(created.id);

            expect(second.attempts).toBe(2);
        });
    });

    describe('markProcessed', () => {
        it('should mark event as processed with timestamp', async () => {
            const created = await repository.record({
                providerEventId: 'evt_processed_123',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });

            await repository.markProcessing(created.id);
            const processed = await repository.markProcessed(created.id);

            expect(processed.status).toBe('processed');
            expect(processed.processedAt).toBeDefined();
            expect(processed.processedAt).not.toBeNull();
        });
    });

    describe('markFailed', () => {
        it('should mark event as failed with error message', async () => {
            const created = await repository.record({
                providerEventId: 'evt_failed_123',
                provider: 'stripe',
                type: 'charge.failed',
                payload: {},
                livemode: true
            });

            const failed = await repository.markFailed(created.id, 'Processing error: Invalid payload');

            expect(failed.status).toBe('failed');
            expect(failed.error).toBe('Processing error: Invalid payload');
        });
    });

    describe('findPending', () => {
        it('should find pending events', async () => {
            await repository.record({
                providerEventId: 'evt_pending_1',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });
            await repository.record({
                providerEventId: 'evt_pending_2',
                provider: 'stripe',
                type: 'invoice.paid',
                payload: {},
                livemode: true
            });

            const processed = await repository.record({
                providerEventId: 'evt_processed_skip',
                provider: 'stripe',
                type: 'customer.created',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(processed.id);
            await repository.markProcessed(processed.id);

            const pending = await repository.findPending();

            expect(pending).toHaveLength(2);
            expect(pending.every((e) => e.status === 'pending')).toBe(true);
        });

        it('should respect limit parameter', async () => {
            for (let i = 0; i < 5; i++) {
                await repository.record({
                    providerEventId: `evt_limit_${i}`,
                    provider: 'stripe',
                    type: 'test.event',
                    payload: {},
                    livemode: true
                });
            }

            const pending = await repository.findPending(3);
            expect(pending).toHaveLength(3);
        });
    });

    describe('findFailedForRetry', () => {
        it('should find failed events under max attempts', async () => {
            const event1 = await repository.record({
                providerEventId: 'evt_retry_1',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(event1.id);
            await repository.markFailed(event1.id, 'Error 1');

            const event2 = await repository.record({
                providerEventId: 'evt_retry_2',
                provider: 'stripe',
                type: 'invoice.payment_failed',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(event2.id);
            await repository.markFailed(event2.id, 'Error 2');

            const failed = await repository.findFailedForRetry(5);

            expect(failed).toHaveLength(2);
            expect(failed.every((e) => e.status === 'failed')).toBe(true);
        });

        it('should exclude events exceeding max attempts', async () => {
            const event = await repository.record({
                providerEventId: 'evt_max_attempts',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                livemode: true
            });

            // Simulate 3 attempts
            await repository.markProcessing(event.id);
            await repository.markProcessing(event.id);
            await repository.markProcessing(event.id);
            await repository.markFailed(event.id, 'Max attempts reached');

            const failed = await repository.findFailedForRetry(3);

            expect(failed).toHaveLength(0);
        });
    });

    describe('findByType', () => {
        beforeEach(async () => {
            await repository.record({
                providerEventId: 'evt_type_1',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });
            await repository.record({
                providerEventId: 'evt_type_2',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });
            await repository.record({
                providerEventId: 'evt_type_3',
                provider: 'mercadopago',
                type: 'payment',
                payload: {},
                livemode: true
            });
        });

        it('should find events by type', async () => {
            const result = await repository.findByType('payment_intent.succeeded');

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by provider', async () => {
            const stripeResult = await repository.findByType('payment_intent.succeeded', { provider: 'stripe' });

            expect(stripeResult.data).toHaveLength(2);
        });

        it('should filter by status', async () => {
            const event = await repository.findByProviderEventId('evt_type_1');
            if (event) {
                await repository.markProcessing(event.id);
                await repository.markProcessed(event.id);
            }

            const processedResult = await repository.findByType('payment_intent.succeeded', { status: 'processed' });
            const pendingResult = await repository.findByType('payment_intent.succeeded', { status: 'pending' });

            expect(processedResult.data).toHaveLength(1);
            expect(pendingResult.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 5; i++) {
                await repository.record({
                    providerEventId: `evt_page_${i}`,
                    provider: 'stripe',
                    type: 'subscription.created',
                    payload: {},
                    livemode: true
                });
            }

            const page1 = await repository.findByType('subscription.created', { limit: 2, offset: 0 });
            const page2 = await repository.findByType('subscription.created', { limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(2);
            expect(page1.total).toBe(5);
        });
    });

    describe('getStatistics', () => {
        it('should get event statistics', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Create events with different statuses
            const _pending = await repository.record({
                providerEventId: 'evt_stats_pending',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });

            const processing = await repository.record({
                providerEventId: 'evt_stats_processing',
                provider: 'stripe',
                type: 'invoice.paid',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(processing.id);

            const processed = await repository.record({
                providerEventId: 'evt_stats_processed',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(processed.id);
            await repository.markProcessed(processed.id);

            const failed = await repository.record({
                providerEventId: 'evt_stats_failed',
                provider: 'stripe',
                type: 'subscription.updated',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(failed.id);
            await repository.markFailed(failed.id, 'Test error');

            const stats = await repository.getStatistics(yesterday, tomorrow);

            expect(stats.total).toBe(4);
            expect(stats.pending).toBe(1);
            expect(stats.processing).toBe(1);
            expect(stats.processed).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.byType.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('deleteOldProcessed', () => {
        it('should delete old processed events', async () => {
            const event = await repository.record({
                providerEventId: 'evt_delete_old',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });
            await repository.markProcessing(event.id);
            await repository.markProcessed(event.id);

            const future = new Date();
            future.setDate(future.getDate() + 1);

            const deletedCount = await repository.deleteOldProcessed(future);

            expect(deletedCount).toBe(1);
        });

        it('should not delete pending events', async () => {
            await repository.record({
                providerEventId: 'evt_pending_keep',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });

            const future = new Date();
            future.setDate(future.getDate() + 1);

            const deletedCount = await repository.deleteOldProcessed(future);

            expect(deletedCount).toBe(0);

            const exists = await repository.exists('evt_pending_keep');
            expect(exists).toBe(true);
        });
    });

    // ==================== Dead Letter Queue Tests ====================

    describe('moveToDeadLetter', () => {
        it('should move event to dead letter queue', async () => {
            const deadLetter = await repository.moveToDeadLetter({
                providerEventId: 'evt_dead_123',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: { id: 'pi_failed' },
                error: 'Maximum retries exceeded',
                attempts: 5,
                livemode: true
            });

            expect(deadLetter.id).toBeDefined();
            expect(deadLetter.providerEventId).toBe('evt_dead_123');
            expect(deadLetter.error).toBe('Maximum retries exceeded');
            expect(deadLetter.attempts).toBe(5);
            expect(deadLetter.resolvedAt).toBeNull();
        });
    });

    describe('getDeadLetterEvents', () => {
        beforeEach(async () => {
            await repository.moveToDeadLetter({
                providerEventId: 'evt_dl_1',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                error: 'Error 1',
                attempts: 3,
                livemode: true
            });
            await repository.moveToDeadLetter({
                providerEventId: 'evt_dl_2',
                provider: 'mercadopago',
                type: 'payment',
                payload: {},
                error: 'Error 2',
                attempts: 3,
                livemode: true
            });
        });

        it('should get all dead letter events', async () => {
            const result = await repository.getDeadLetterEvents();

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by provider', async () => {
            const stripeResult = await repository.getDeadLetterEvents({ provider: 'stripe' });
            const mpResult = await repository.getDeadLetterEvents({ provider: 'mercadopago' });

            expect(stripeResult.data).toHaveLength(1);
            expect(mpResult.data).toHaveLength(1);
        });

        it('should filter by resolved status', async () => {
            const dl1 = await repository.getDeadLetterEvents();
            if (dl1.data[0]) {
                await repository.markDeadLetterProcessed(dl1.data[0].id);
            }

            const unresolvedResult = await repository.getDeadLetterEvents({ resolved: false });
            const resolvedResult = await repository.getDeadLetterEvents({ resolved: true });

            expect(unresolvedResult.data).toHaveLength(1);
            expect(resolvedResult.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 3; i++) {
                await repository.moveToDeadLetter({
                    providerEventId: `evt_dl_page_${i}`,
                    provider: 'stripe',
                    type: 'test.event',
                    payload: {},
                    error: 'Error',
                    attempts: 3,
                    livemode: true
                });
            }

            const page1 = await repository.getDeadLetterEvents({ limit: 2, offset: 0 });
            const page2 = await repository.getDeadLetterEvents({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(2);
            expect(page1.total).toBe(5); // 2 from beforeEach + 3 new
        });
    });

    describe('markDeadLetterProcessed', () => {
        it('should mark dead letter event as resolved', async () => {
            const dl = await repository.moveToDeadLetter({
                providerEventId: 'evt_resolve_dl',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                error: 'Error',
                attempts: 3,
                livemode: true
            });

            const resolved = await repository.markDeadLetterProcessed(dl.id);

            expect(resolved.resolvedAt).not.toBeNull();
            expect(resolved.resolvedAt).toBeDefined();
        });
    });

    describe('getDeadLetterEventById', () => {
        it('should get dead letter event by ID', async () => {
            const created = await repository.moveToDeadLetter({
                providerEventId: 'evt_dl_findby',
                provider: 'stripe',
                type: 'invoice.payment_failed',
                payload: {},
                error: 'Payment declined',
                attempts: 3,
                livemode: true
            });

            const found = await repository.getDeadLetterEventById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.error).toBe('Payment declined');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.getDeadLetterEventById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('countUnresolvedDeadLetter', () => {
        it('should count unresolved dead letter events', async () => {
            await repository.moveToDeadLetter({
                providerEventId: 'evt_unres_1',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                error: 'Error 1',
                attempts: 3,
                livemode: true
            });
            await repository.moveToDeadLetter({
                providerEventId: 'evt_unres_2',
                provider: 'stripe',
                type: 'invoice.payment_failed',
                payload: {},
                error: 'Error 2',
                attempts: 3,
                livemode: true
            });
            const resolved = await repository.moveToDeadLetter({
                providerEventId: 'evt_res_1',
                provider: 'stripe',
                type: 'subscription.deleted',
                payload: {},
                error: 'Error 3',
                attempts: 3,
                livemode: true
            });
            await repository.markDeadLetterProcessed(resolved.id);

            const count = await repository.countUnresolvedDeadLetter();

            expect(count).toBe(2);
        });

        it('should return 0 when no unresolved events', async () => {
            const count = await repository.countUnresolvedDeadLetter();
            expect(count).toBe(0);
        });
    });
});
