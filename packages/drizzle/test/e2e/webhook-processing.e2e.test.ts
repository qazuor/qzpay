/**
 * Webhook Processing E2E Tests
 *
 * Tests complete webhook event flows from receipt through processing
 * including retry handling and event correlation against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { QZPayWebhookEventsRepository } from '../../src/repositories/webhook-events.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Webhook Processing E2E', () => {
    let customersRepo: QZPayCustomersRepository;
    let paymentsRepo: QZPayPaymentsRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let plansRepo: QZPayPlansRepository;
    let webhookEventsRepo: QZPayWebhookEventsRepository;

    let testCustomerId: string;
    let testPlanId: string;
    let testSubscriptionId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        customersRepo = new QZPayCustomersRepository(db);
        paymentsRepo = new QZPayPaymentsRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        plansRepo = new QZPayPlansRepository(db);
        webhookEventsRepo = new QZPayWebhookEventsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create customer
        const customer = await customersRepo.create({
            externalId: 'ext-webhook-customer',
            email: 'webhook@example.com',
            name: 'Webhook Test Customer',
            stripeCustomerId: 'cus_webhook_test',
            livemode: true
        });
        testCustomerId = customer.id;

        // Setup: Create plan
        const plan = await plansRepo.create({
            name: 'Webhook Test Plan',
            active: true,
            livemode: true
        });
        testPlanId = plan.id;

        // Setup: Create subscription
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = await subscriptionsRepo.create({
            customerId: testCustomerId,
            planId: testPlanId,
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            stripeSubscriptionId: 'sub_webhook_test',
            livemode: true
        });
        testSubscriptionId = subscription.id;
    });

    describe('Webhook Event Receipt', () => {
        it('should store incoming webhook event using record method', async () => {
            const event = await webhookEventsRepo.record({
                providerEventId: 'evt_stripe_123',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {
                    id: 'pi_test_123',
                    object: 'payment_intent',
                    amount: 5000,
                    currency: 'usd',
                    customer: 'cus_webhook_test'
                },
                livemode: true
            });

            expect(event.providerEventId).toBe('evt_stripe_123');
            expect(event.status).toBe('pending');
            expect(event.payload).toBeDefined();
        });

        it('should prevent duplicate event processing', async () => {
            // First event
            await webhookEventsRepo.record({
                providerEventId: 'evt_duplicate_test',
                provider: 'stripe',
                type: 'charge.succeeded',
                payload: { id: 'ch_test' },
                livemode: true
            });

            // Try to find duplicate
            const existing = await webhookEventsRepo.findByProviderEventId('evt_duplicate_test');
            expect(existing).not.toBeNull();

            // Check if event exists
            const exists = await webhookEventsRepo.exists('evt_duplicate_test');
            expect(exists).toBe(true);
        });
    });

    describe('Payment Intent Webhook Flow', () => {
        it('should process payment_intent.succeeded webhook', async () => {
            // Step 1: Receive webhook using record method
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_pi_succeeded_001',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {
                    id: 'pi_webhook_payment',
                    object: 'payment_intent',
                    amount: 9900,
                    currency: 'usd',
                    customer: 'cus_webhook_test',
                    metadata: { subscriptionId: testSubscriptionId }
                },
                livemode: true
            });

            // Step 2: Mark as processing
            await webhookEventsRepo.markProcessing(webhookEvent.id);

            // Step 3: Create payment from webhook data
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: testSubscriptionId,
                amount: 9900,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_webhook_payment',
                livemode: true
            });

            expect(payment.status).toBe('succeeded');

            // Step 4: Mark webhook as processed
            const processedEvent = await webhookEventsRepo.markProcessed(webhookEvent.id);

            expect(processedEvent.status).toBe('processed');
            expect(processedEvent.processedAt).not.toBeNull();
        });

        it('should handle payment_intent.payment_failed webhook', async () => {
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_pi_failed_001',
                provider: 'stripe',
                type: 'payment_intent.payment_failed',
                payload: {
                    id: 'pi_failed_payment',
                    object: 'payment_intent',
                    amount: 9900,
                    currency: 'usd',
                    customer: 'cus_webhook_test',
                    last_payment_error: {
                        code: 'card_declined',
                        message: 'Your card was declined'
                    }
                },
                livemode: true
            });

            // Process failed payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: testSubscriptionId,
                amount: 9900,
                currency: 'usd',
                status: 'failed',
                provider: 'stripe',
                providerPaymentId: 'pi_failed_payment',
                failureCode: 'card_declined',
                failureMessage: 'Your card was declined',
                livemode: true
            });

            expect(payment.status).toBe('failed');
            expect(payment.failureCode).toBe('card_declined');

            await webhookEventsRepo.markProcessed(webhookEvent.id);
        });
    });

    describe('Subscription Webhook Flow', () => {
        it('should process customer.subscription.updated webhook', async () => {
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_sub_updated_001',
                provider: 'stripe',
                type: 'customer.subscription.updated',
                payload: {
                    id: 'sub_webhook_test',
                    object: 'subscription',
                    status: 'past_due',
                    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
                },
                livemode: true
            });

            // Update subscription status based on webhook
            const updatedSub = await subscriptionsRepo.updateStatus(testSubscriptionId, 'past_due');
            expect(updatedSub.status).toBe('past_due');

            await webhookEventsRepo.markProcessed(webhookEvent.id);
        });

        it('should process customer.subscription.deleted webhook', async () => {
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_sub_deleted_001',
                provider: 'stripe',
                type: 'customer.subscription.deleted',
                payload: {
                    id: 'sub_webhook_test',
                    object: 'subscription',
                    status: 'canceled',
                    canceled_at: Math.floor(Date.now() / 1000)
                },
                livemode: true
            });

            // Cancel subscription
            const canceledSub = await subscriptionsRepo.updateStatus(testSubscriptionId, 'canceled');
            expect(canceledSub.status).toBe('canceled');

            await webhookEventsRepo.markProcessed(webhookEvent.id);
        });
    });

    describe('Charge Webhook Flow', () => {
        it('should process charge.refunded webhook', async () => {
            // First create the original payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'ch_refund_test',
                livemode: true
            });

            // Receive refund webhook
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_ch_refunded_001',
                provider: 'stripe',
                type: 'charge.refunded',
                payload: {
                    id: 'ch_refund_test',
                    object: 'charge',
                    amount_refunded: 5000,
                    refunds: {
                        data: [
                            {
                                id: 're_webhook_123',
                                amount: 5000,
                                status: 'succeeded'
                            }
                        ]
                    }
                },
                livemode: true
            });

            // Create refund record
            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 5000,
                currency: 'usd',
                reason: 'requested_by_customer',
                status: 'succeeded',
                providerRefundId: 're_webhook_123',
                livemode: true
            });

            // Update payment status
            await paymentsRepo.updateStatus(payment.id, 'refunded', { refundedAmount: 5000 });

            expect(refund.amount).toBe(5000);

            await webhookEventsRepo.markProcessed(webhookEvent.id);
        });
    });

    describe('Webhook Failure Handling', () => {
        it('should mark webhook as failed with error message', async () => {
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'evt_will_fail_001',
                provider: 'stripe',
                type: 'invoice.payment_succeeded',
                payload: { id: 'in_test' },
                livemode: true
            });

            // Simulate processing failure
            const failedEvent = await webhookEventsRepo.markFailed(webhookEvent.id, 'Database connection timeout');

            expect(failedEvent.status).toBe('failed');
            expect(failedEvent.error).toBe('Database connection timeout');
        });

        it('should find pending webhooks for processing', async () => {
            // Create several pending webhooks
            await webhookEventsRepo.record({
                providerEventId: 'evt_pending_1',
                provider: 'stripe',
                type: 'payment_intent.created',
                payload: { id: 'pi_1' },
                livemode: true
            });

            await webhookEventsRepo.record({
                providerEventId: 'evt_pending_2',
                provider: 'stripe',
                type: 'payment_intent.created',
                payload: { id: 'pi_2' },
                livemode: true
            });

            const pendingEvents = await webhookEventsRepo.findPending(100);
            expect(pendingEvents.length).toBeGreaterThanOrEqual(2);
            expect(pendingEvents.every((e) => e.status === 'pending')).toBe(true);
        });

        it('should find failed webhooks for retry', async () => {
            // Create a failed webhook
            const event = await webhookEventsRepo.record({
                providerEventId: 'evt_failed_retry',
                provider: 'stripe',
                type: 'charge.failed',
                payload: { id: 'ch_failed' },
                livemode: true
            });

            await webhookEventsRepo.markFailed(event.id, 'Temporary failure');

            const failedEvents = await webhookEventsRepo.findFailedForRetry(5, 100);
            expect(failedEvents.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Webhook Event Search by Type', () => {
        beforeEach(async () => {
            // Create various webhook events
            await webhookEventsRepo.record({
                providerEventId: 'evt_search_1',
                provider: 'stripe',
                type: 'payment_intent.succeeded',
                payload: {},
                livemode: true
            });

            await webhookEventsRepo.record({
                providerEventId: 'evt_search_2',
                provider: 'stripe',
                type: 'payment_intent.failed',
                payload: {},
                livemode: true
            });

            await webhookEventsRepo.record({
                providerEventId: 'evt_search_3',
                provider: 'mercadopago',
                type: 'payment.created',
                payload: {},
                livemode: true
            });
        });

        it('should find events by type', async () => {
            const result = await webhookEventsRepo.findByType('payment_intent.succeeded', {
                livemode: true
            });

            expect(result.data.length).toBeGreaterThanOrEqual(1);
            expect(result.data.every((e) => e.type === 'payment_intent.succeeded')).toBe(true);
        });

        it('should filter events by provider', async () => {
            const stripeResult = await webhookEventsRepo.findByType('payment_intent.succeeded', {
                provider: 'stripe',
                livemode: true
            });

            expect(stripeResult.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('MercadoPago Webhook Flow', () => {
        it('should process MercadoPago payment notification', async () => {
            const webhookEvent = await webhookEventsRepo.record({
                providerEventId: 'mp_notification_123',
                provider: 'mercadopago',
                type: 'payment',
                payload: {
                    action: 'payment.created',
                    api_version: 'v1',
                    data: { id: 'mp_pay_123456' },
                    date_created: new Date().toISOString(),
                    id: 'mp_notification_123',
                    live_mode: true,
                    type: 'payment',
                    user_id: '123456789'
                },
                livemode: true
            });

            // Process the payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 100000,
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                providerPaymentId: 'mp_pay_123456',
                livemode: true
            });

            await webhookEventsRepo.markProcessed(webhookEvent.id);

            expect(payment.provider).toBe('mercadopago');
        });
    });

    describe('Dead Letter Queue', () => {
        it('should move failed event to dead letter queue', async () => {
            // Move a permanently failed event to dead letter
            await webhookEventsRepo.moveToDeadLetter({
                providerEventId: 'evt_dead_letter_001',
                provider: 'stripe',
                type: 'invoice.payment_failed',
                payload: { id: 'in_failed' },
                error: 'Exceeded maximum retry attempts',
                attempts: 5,
                livemode: true
            });

            const deadLetterCount = await webhookEventsRepo.countUnresolvedDeadLetter();
            expect(deadLetterCount).toBeGreaterThanOrEqual(1);
        });

        it('should retrieve dead letter events', async () => {
            await webhookEventsRepo.moveToDeadLetter({
                providerEventId: 'evt_dead_letter_list',
                provider: 'stripe',
                type: 'customer.deleted',
                payload: { id: 'cus_deleted' },
                error: 'Customer not found in database',
                attempts: 3,
                livemode: true
            });

            const deadLetterEvents = await webhookEventsRepo.getDeadLetterEvents({
                livemode: true
            });

            expect(deadLetterEvents.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Webhook Statistics', () => {
        it('should get webhook processing statistics', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Create some events
            const event1 = await webhookEventsRepo.record({
                providerEventId: 'evt_stats_1',
                provider: 'stripe',
                type: 'charge.succeeded',
                payload: {},
                livemode: true
            });
            await webhookEventsRepo.markProcessed(event1.id);

            const event2 = await webhookEventsRepo.record({
                providerEventId: 'evt_stats_2',
                provider: 'stripe',
                type: 'charge.failed',
                payload: {},
                livemode: true
            });
            await webhookEventsRepo.markFailed(event2.id, 'Test failure');

            const stats = await webhookEventsRepo.getStatistics(yesterday, tomorrow, true);

            expect(stats.total).toBeGreaterThanOrEqual(2);
            expect(stats.processed).toBeGreaterThanOrEqual(1);
            expect(stats.failed).toBeGreaterThanOrEqual(1);
        });
    });
});
