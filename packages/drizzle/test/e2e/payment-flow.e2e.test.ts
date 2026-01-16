/**
 * Payment Flow E2E Tests
 *
 * Tests complete payment flows from creation through processing,
 * success/failure, and refunds against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPaymentMethodsRepository } from '../../src/repositories/payment-methods.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Payment Flow E2E', () => {
    let paymentsRepo: QZPayPaymentsRepository;
    let customersRepo: QZPayCustomersRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let plansRepo: QZPayPlansRepository;
    let paymentMethodsRepo: QZPayPaymentMethodsRepository;

    let testCustomerId: string;
    let testSubscriptionId: string;
    let testPaymentMethodId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        paymentsRepo = new QZPayPaymentsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        plansRepo = new QZPayPlansRepository(db);
        paymentMethodsRepo = new QZPayPaymentMethodsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create customer
        const customer = await customersRepo.create({
            externalId: 'ext-payment-flow-customer',
            email: 'payment-flow@example.com',
            name: 'Payment Flow Test',
            livemode: true
        });
        testCustomerId = customer.id;

        // Setup: Create payment method
        const paymentMethod = await paymentMethodsRepo.create({
            customerId: testCustomerId,
            provider: 'stripe',
            providerPaymentMethodId: 'pm_test_flow',
            type: 'card',
            lastFour: '4242',
            brand: 'visa',
            expMonth: 12,
            expYear: 2030,
            isDefault: true,
            livemode: true
        });
        testPaymentMethodId = paymentMethod.id;

        // Setup: Create plan and subscription
        const plan = await plansRepo.create({
            name: 'Payment Flow Test Plan',
            active: true,
            livemode: true
        });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = await subscriptionsRepo.create({
            customerId: testCustomerId,
            planId: plan.id,
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            livemode: true
        });
        testSubscriptionId = subscription.id;
    });

    describe('Full Payment Lifecycle', () => {
        it('should process payment from pending to succeeded', async () => {
            // Step 1: Create pending payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: testSubscriptionId,
                paymentMethodId: testPaymentMethodId,
                amount: 9900, // $99.00
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            expect(payment.status).toBe('pending');
            expect(payment.amount).toBe(9900);

            // Step 2: Mark as processing (simulating payment initiation)
            const processingPayment = await paymentsRepo.updateStatus(payment.id, 'processing');
            expect(processingPayment.status).toBe('processing');

            // Step 3: Mark as succeeded (simulating successful payment)
            const succeededPayment = await paymentsRepo.updateStatus(payment.id, 'succeeded', {
                providerPaymentIds: { stripe: 'pi_test_succeeded_123' }
            });
            expect(succeededPayment.status).toBe('succeeded');
            const providerIds = succeededPayment.providerPaymentIds as Record<string, string>;
            expect(providerIds.stripe).toBe('pi_test_succeeded_123');

            // Verify payment can be found by customer
            const customerPayments = await paymentsRepo.findByCustomerId(testCustomerId);
            expect(customerPayments.data).toHaveLength(1);
            expect(customerPayments.data[0].status).toBe('succeeded');
        });

        it('should handle failed payment flow', async () => {
            // Step 1: Create payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: testSubscriptionId,
                paymentMethodId: testPaymentMethodId,
                amount: 5000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            // Step 2: Mark as processing
            await paymentsRepo.updateStatus(payment.id, 'processing');

            // Step 3: Mark as failed
            const failedPayment = await paymentsRepo.markFailed(payment.id, 'card_declined', 'Your card was declined');

            expect(failedPayment.status).toBe('failed');
            expect(failedPayment.failureCode).toBe('card_declined');
            expect(failedPayment.failureMessage).toBe('Your card was declined');

            // Verify search by status
            const failedPayments = await paymentsRepo.search({ status: 'failed' });
            expect(failedPayments.data).toHaveLength(1);
        });
    });

    describe('Refund Flow', () => {
        it('should process full refund', async () => {
            // Step 1: Create and succeed payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 10000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_refund_test',
                livemode: true
            });

            // Step 2: Create full refund
            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 10000,
                currency: 'USD',
                reason: 'requested_by_customer',
                status: 'succeeded',
                providerRefundId: 'rf_test_full',
                livemode: true
            });

            expect(refund.amount).toBe(10000);
            expect(refund.status).toBe('succeeded');

            // Step 3: Update payment status to refunded
            const refundedPayment = await paymentsRepo.updateStatus(payment.id, 'refunded', {
                refundedAmount: 10000
            });

            expect(refundedPayment.status).toBe('refunded');
            expect(refundedPayment.refundedAmount).toBe(10000);

            // Verify refund retrieval
            const paymentData = await paymentsRepo.findWithRefunds(payment.id);
            if (!paymentData) {
                throw new Error('Payment not found');
            }
            const { payment: retrievedPayment, refunds } = paymentData;
            expect(retrievedPayment.status).toBe('refunded');
            expect(refunds).toHaveLength(1);
            expect(refunds[0].amount).toBe(10000);
        });

        it('should process partial refunds', async () => {
            // Step 1: Create succeeded payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 20000, // $200.00
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_partial_refund',
                livemode: true
            });

            // Step 2: First partial refund ($50)
            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 5000,
                currency: 'USD',
                reason: 'requested_by_customer',
                status: 'succeeded',
                providerRefundId: 'rf_partial_1',
                livemode: true
            });

            await paymentsRepo.updateStatus(payment.id, 'partially_refunded', {
                refundedAmount: 5000
            });

            // Step 3: Second partial refund ($30)
            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 3000,
                currency: 'USD',
                reason: 'requested_by_customer',
                status: 'succeeded',
                providerRefundId: 'rf_partial_2',
                livemode: true
            });

            await paymentsRepo.updateRefundedAmount(payment.id, 8000);

            // Verify total refunded
            const totalRefunded = await paymentsRepo.getTotalRefundedAmount(payment.id);
            expect(totalRefunded).toBe(8000);

            // Verify all refunds
            const refunds = await paymentsRepo.findRefundsByPaymentId(payment.id);
            expect(refunds).toHaveLength(2);

            // Verify payment state
            const updatedPayment = await paymentsRepo.findById(payment.id);
            expect(updatedPayment?.refundedAmount).toBe(8000);
            expect(updatedPayment?.status).toBe('partially_refunded');
        });
    });

    describe('Payment Idempotency', () => {
        it('should handle duplicate payments with idempotency key', async () => {
            const idempotencyKey = `payment_${Date.now()}_unique`;

            // First payment creation
            const payment1 = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 7500,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                idempotencyKey,
                livemode: true
            });

            // Verify can find by idempotency key
            const found = await paymentsRepo.findByIdempotencyKey(idempotencyKey);
            expect(found).not.toBeNull();
            expect(found?.id).toBe(payment1.id);
        });
    });

    describe('Subscription Payment Flow', () => {
        it('should record recurring payments for subscription', async () => {
            // Simulate 3 months of recurring payments
            for (let month = 1; month <= 3; month++) {
                const payment = await paymentsRepo.create({
                    customerId: testCustomerId,
                    subscriptionId: testSubscriptionId,
                    paymentMethodId: testPaymentMethodId,
                    amount: 9900,
                    currency: 'USD',
                    status: 'succeeded',
                    provider: 'stripe',
                    providerPaymentId: `pi_recurring_${month}`,
                    metadata: { month, type: 'recurring' },
                    livemode: true
                });

                expect(payment.status).toBe('succeeded');
            }

            // Verify all subscription payments
            const subscriptionPayments = await paymentsRepo.findBySubscriptionId(testSubscriptionId);
            expect(subscriptionPayments).toHaveLength(3);

            // Calculate total amount paid
            const totalPaid = subscriptionPayments.reduce((sum, p) => sum + p.amount, 0);
            expect(totalPaid).toBe(29700); // 3 * $99.00
        });
    });

    describe('Payment Statistics', () => {
        it('should calculate payment statistics correctly', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Create various payments
            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 10000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                refundedAmount: 2000,
                livemode: true
            });

            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 3000,
                currency: 'USD',
                status: 'failed',
                provider: 'stripe',
                livemode: true
            });

            const stats = await paymentsRepo.getStatistics(yesterday, tomorrow, true);

            expect(stats.total).toBe(3);
            expect(stats.succeeded).toBe(2);
            expect(stats.failed).toBe(1);
            expect(stats.totalAmount).toBe(15000);
            expect(stats.refundedAmount).toBe(2000);
        });
    });

    describe('Multi-Provider Payments', () => {
        it('should handle payments from different providers', async () => {
            // Stripe payment
            const stripePayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentIds: { stripe: 'pi_stripe_123' },
                livemode: true
            });

            // MercadoPago payment
            const mpPayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                providerPaymentIds: { mercadopago: 'mp_payment_456' },
                livemode: true
            });

            // Search by provider
            const stripePayments = await paymentsRepo.search({ provider: 'stripe' });
            const mpPayments = await paymentsRepo.search({ provider: 'mercadopago' });

            expect(stripePayments.data).toHaveLength(1);
            expect(mpPayments.data).toHaveLength(1);

            // Find by provider payment ID
            const foundStripe = await paymentsRepo.findByProviderPaymentId('pi_stripe_123');
            const foundMp = await paymentsRepo.findByProviderPaymentId('mp_payment_456');

            expect(foundStripe?.id).toBe(stripePayment.id);
            expect(foundMp?.id).toBe(mpPayment.id);
        });
    });

    describe('Payment Search and Filtering', () => {
        beforeEach(async () => {
            // Create payments with various statuses
            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });
            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 2000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });
            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 3000,
                currency: 'USD',
                status: 'failed',
                provider: 'mercadopago',
                livemode: false
            });
        });

        it('should search by multiple statuses', async () => {
            const result = await paymentsRepo.search({ status: ['succeeded', 'pending'] });
            expect(result.data).toHaveLength(2);
        });

        it('should filter by livemode', async () => {
            const liveResult = await paymentsRepo.search({ livemode: true });
            const testResult = await paymentsRepo.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should search by customer and status combined', async () => {
            const result = await paymentsRepo.findByCustomerId(testCustomerId, { status: 'succeeded' });
            expect(result.data).toHaveLength(1);
            expect(result.data[0].amount).toBe(1000);
        });
    });
});
