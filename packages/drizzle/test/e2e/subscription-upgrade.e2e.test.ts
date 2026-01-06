/**
 * Subscription Upgrade/Downgrade E2E Tests
 *
 * Tests complete subscription plan change flows including upgrades,
 * downgrades, proration, and billing adjustments against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayInvoicesRepository } from '../../src/repositories/invoices.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPayPricesRepository } from '../../src/repositories/prices.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Subscription Upgrade/Downgrade E2E', () => {
    let customersRepo: QZPayCustomersRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let plansRepo: QZPayPlansRepository;
    let pricesRepo: QZPayPricesRepository;
    let invoicesRepo: QZPayInvoicesRepository;
    let paymentsRepo: QZPayPaymentsRepository;

    let testCustomerId: string;
    let basicPlanId: string;
    let proPlanId: string;
    let enterprisePlanId: string;
    let _basicPriceId: string;
    let _proPriceId: string;
    let _enterprisePriceId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        customersRepo = new QZPayCustomersRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        plansRepo = new QZPayPlansRepository(db);
        pricesRepo = new QZPayPricesRepository(db);
        invoicesRepo = new QZPayInvoicesRepository(db);
        paymentsRepo = new QZPayPaymentsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create customer
        const customer = await customersRepo.create({
            externalId: 'ext-upgrade-customer',
            email: 'upgrade@example.com',
            name: 'Upgrade Test Customer',
            livemode: true
        });
        testCustomerId = customer.id;

        // Setup: Create tiered plans
        const basicPlan = await plansRepo.create({
            name: 'Basic Plan',
            description: 'Entry level plan',
            active: true,
            livemode: true
        });
        basicPlanId = basicPlan.id;

        const proPlan = await plansRepo.create({
            name: 'Pro Plan',
            description: 'Professional plan',
            active: true,
            livemode: true
        });
        proPlanId = proPlan.id;

        const enterprisePlan = await plansRepo.create({
            name: 'Enterprise Plan',
            description: 'Enterprise level plan',
            active: true,
            livemode: true
        });
        enterprisePlanId = enterprisePlan.id;

        // Setup: Create prices for each plan
        const basicPrice = await pricesRepo.create({
            planId: basicPlanId,
            unitAmount: 999, // $9.99/month
            currency: 'usd',
            billingInterval: 'month',
            active: true,
            livemode: true
        });
        _basicPriceId = basicPrice.id;

        const proPrice = await pricesRepo.create({
            planId: proPlanId,
            unitAmount: 2999, // $29.99/month
            currency: 'usd',
            billingInterval: 'month',
            active: true,
            livemode: true
        });
        _proPriceId = proPrice.id;

        const enterprisePrice = await pricesRepo.create({
            planId: enterprisePlanId,
            unitAmount: 9999, // $99.99/month
            currency: 'usd',
            billingInterval: 'month',
            active: true,
            livemode: true
        });
        _enterprisePriceId = enterprisePrice.id;
    });

    describe('Upgrade Flow', () => {
        it('should upgrade from Basic to Pro plan', async () => {
            // Step 1: Create subscription on Basic plan
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: basicPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            expect(subscription.planId).toBe(basicPlanId);
            expect(subscription.status).toBe('active');

            // Step 2: Calculate proration
            const daysInPeriod = 30;
            const daysUsed = 15; // Half month
            const daysRemaining = daysInPeriod - daysUsed;

            const basicDailyRate = 999 / daysInPeriod;
            const proDailyRate = 2999 / daysInPeriod;

            const creditFromBasic = Math.floor(basicDailyRate * daysRemaining); // ~$5 credit
            const chargeForPro = Math.floor(proDailyRate * daysRemaining); // ~$15 charge
            const prorationAmount = chargeForPro - creditFromBasic; // ~$10 difference

            // Step 3: Upgrade subscription using update method
            const upgradedSubscription = await subscriptionsRepo.update(subscription.id, {
                planId: proPlanId
            });

            expect(upgradedSubscription.planId).toBe(proPlanId);
            expect(upgradedSubscription.status).toBe('active');

            // Step 4: Create proration invoice
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                subscriptionId: subscription.id,
                number: 'INV-PRORATE-001',
                status: 'open',
                currency: 'usd',
                subtotal: prorationAmount,
                total: prorationAmount,
                amountPaid: 0,
                metadata: {
                    type: 'proration',
                    fromPlan: 'Basic',
                    toPlan: 'Pro',
                    daysRemaining
                },
                livemode: true
            });

            expect(invoice.subtotal).toBe(prorationAmount);
            expect(invoice.metadata?.type).toBe('proration');

            // Step 5: Verify subscription history
            const history = await subscriptionsRepo.findById(subscription.id);
            expect(history?.planId).toBe(proPlanId);
        });

        it('should upgrade from Basic directly to Enterprise', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: basicPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Skip tier directly to Enterprise
            const upgradedSubscription = await subscriptionsRepo.update(subscription.id, {
                planId: enterprisePlanId
            });

            expect(upgradedSubscription.planId).toBe(enterprisePlanId);
        });
    });

    describe('Downgrade Flow', () => {
        it('should downgrade from Pro to Basic', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Start with Pro plan
            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Downgrade to Basic
            const downgradedSubscription = await subscriptionsRepo.update(subscription.id, {
                planId: basicPlanId
            });

            expect(downgradedSubscription.planId).toBe(basicPlanId);
            expect(downgradedSubscription.status).toBe('active');
        });

        it('should schedule cancellation at period end', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Schedule cancellation for period end
            const scheduledSubscription = await subscriptionsRepo.scheduleCancellation(subscription.id, periodEnd);

            expect(scheduledSubscription.cancelAt).toEqual(periodEnd);
            expect(scheduledSubscription.status).toBe('active'); // Still active until period end
        });

        it('should remove scheduled cancellation', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAt: periodEnd,
                livemode: true
            });

            // Remove the scheduled cancellation
            const updatedSubscription = await subscriptionsRepo.removeCancellation(subscription.id);

            expect(updatedSubscription.cancelAt).toBeNull();
            expect(updatedSubscription.status).toBe('active');
        });
    });

    describe('Immediate Plan Changes', () => {
        it('should process immediate upgrade with payment', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: basicPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Upgrade immediately
            await subscriptionsRepo.update(subscription.id, { planId: proPlanId });

            // Create and pay proration invoice
            const prorationAmount = 2000; // Calculated proration
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                subscriptionId: subscription.id,
                number: 'INV-UPGRADE-001',
                status: 'open',
                currency: 'usd',
                subtotal: prorationAmount,
                total: prorationAmount,
                amountPaid: 0,
                livemode: true
            });

            // Process payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: subscription.id,
                amount: prorationAmount,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_upgrade_123',
                livemode: true
            });

            // Record payment and update invoice status
            await invoicesRepo.recordPayment({
                invoiceId: invoice.id,
                paymentId: payment.id,
                amountApplied: prorationAmount,
                currency: 'usd',
                livemode: true
            });

            await invoicesRepo.updateStatus(invoice.id, 'paid');

            const paidInvoice = await invoicesRepo.findById(invoice.id);
            expect(paidInvoice?.status).toBe('paid');
        });
    });

    describe('Billing Period Management', () => {
        it('should update billing period for renewal', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create monthly subscription
            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Simulate period renewal
            const newPeriodStart = periodEnd;
            const newPeriodEnd = new Date(periodEnd);
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

            const renewedSubscription = await subscriptionsRepo.updateBillingPeriod(subscription.id, newPeriodStart, newPeriodEnd);

            expect(renewedSubscription.currentPeriodStart).toEqual(newPeriodStart);
            expect(renewedSubscription.currentPeriodEnd).toEqual(newPeriodEnd);
        });
    });

    describe('Trial to Paid Conversion', () => {
        it('should convert trial subscription to paid', async () => {
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 14); // 14 day trial

            // Create trial subscription
            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'trialing',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: trialEnd,
                trialEnd,
                livemode: true
            });

            expect(subscription.status).toBe('trialing');

            // Convert to paid (trial ended successfully)
            const paidStart = trialEnd;
            const paidEnd = new Date(trialEnd);
            paidEnd.setMonth(paidEnd.getMonth() + 1);

            await subscriptionsRepo.updateStatus(subscription.id, 'active');
            const activeSubscription = await subscriptionsRepo.updateBillingPeriod(subscription.id, paidStart, paidEnd);

            expect(activeSubscription.currentPeriodStart).toEqual(paidStart);

            // Create first payment
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                subscriptionId: subscription.id,
                amount: 2999,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            expect(payment.status).toBe('succeeded');
        });

        it('should handle trial expiration without payment', async () => {
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 1); // Trial ended yesterday

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'trialing',
                billingInterval: 'month',
                currentPeriodStart: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: trialEnd,
                trialEnd,
                livemode: true
            });

            // Mark as past_due when payment fails
            const pastDueSubscription = await subscriptionsRepo.updateStatus(subscription.id, 'past_due');
            expect(pastDueSubscription.status).toBe('past_due');
        });
    });

    describe('Subscription Retry Logic', () => {
        it('should track retry attempts for failed payments', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'past_due',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            // Increment retry count
            const nextRetry = new Date();
            nextRetry.setDate(nextRetry.getDate() + 3); // Retry in 3 days

            const afterRetry1 = await subscriptionsRepo.incrementRetryCount(subscription.id, nextRetry);
            expect(afterRetry1.retryCount).toBe(1);
            expect(afterRetry1.nextRetryAt).toEqual(nextRetry);

            const afterRetry2 = await subscriptionsRepo.incrementRetryCount(subscription.id);
            expect(afterRetry2.retryCount).toBe(2);
        });

        it('should reset retry count after successful payment', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'past_due',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                retryCount: 3,
                livemode: true
            });

            // Payment succeeds, reset retry count
            await subscriptionsRepo.resetRetryCount(subscription.id);
            await subscriptionsRepo.updateStatus(subscription.id, 'active');

            const activeSubscription = await subscriptionsRepo.findById(subscription.id);
            expect(activeSubscription?.retryCount).toBe(0);
            expect(activeSubscription?.status).toBe('active');
        });

        it('should find subscriptions needing retry', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'past_due',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                retryCount: 2,
                nextRetryAt: new Date(now.getTime() - 1000), // Past retry time
                livemode: true
            });

            const needingRetry = await subscriptionsRepo.findNeedingRetry(5, true);
            expect(needingRetry).toHaveLength(1);
            expect(needingRetry[0].retryCount).toBe(2);
        });
    });

    describe('Finding Subscriptions by Status', () => {
        it('should find subscriptions expiring soon', async () => {
            const now = new Date();
            const soonEnd = new Date(now);
            soonEnd.setDate(soonEnd.getDate() + 5); // Expires in 5 days

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: soonEnd,
                livemode: true
            });

            const expiringSoon = await subscriptionsRepo.findExpiringSoon(7, true);
            expect(expiringSoon).toHaveLength(1);
        });

        it('should find trials expiring soon', async () => {
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 3); // Trial ends in 3 days

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'trialing',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: trialEnd,
                trialEnd,
                livemode: true
            });

            const trialsExpiring = await subscriptionsRepo.findTrialsExpiringSoon(5, true);
            expect(trialsExpiring).toHaveLength(1);
        });

        it('should find past due subscriptions', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'past_due',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            const pastDue = await subscriptionsRepo.findPastDue(true);
            expect(pastDue).toHaveLength(1);
        });

        it('should find subscriptions scheduled for cancellation', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAt: periodEnd,
                livemode: true
            });

            const scheduled = await subscriptionsRepo.findScheduledForCancellation(true);
            expect(scheduled).toHaveLength(1);
        });
    });

    describe('Subscription Metrics', () => {
        it('should get subscription metrics', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create various subscriptions
            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: proPlanId,
                status: 'active',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: basicPlanId,
                status: 'trialing',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                livemode: true
            });

            await subscriptionsRepo.create({
                customerId: testCustomerId,
                planId: enterprisePlanId,
                status: 'canceled',
                billingInterval: 'month',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                canceledAt: now,
                livemode: true
            });

            const metrics = await subscriptionsRepo.getMetrics(true);
            expect(metrics.total).toBe(3);
            expect(metrics.active).toBe(1);
            expect(metrics.trialing).toBe(1);
            expect(metrics.canceled).toBe(1);
        });
    });
});
