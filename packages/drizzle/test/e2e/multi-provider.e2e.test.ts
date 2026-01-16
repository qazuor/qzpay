/**
 * Multi-Provider E2E Tests
 *
 * Tests payment processing across multiple providers (Stripe, MercadoPago)
 * including provider switching and fallback scenarios against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPaymentMethodsRepository } from '../../src/repositories/payment-methods.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { QZPayVendorsRepository } from '../../src/repositories/vendors.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Multi-Provider E2E', () => {
    let customersRepo: QZPayCustomersRepository;
    let paymentsRepo: QZPayPaymentsRepository;
    let paymentMethodsRepo: QZPayPaymentMethodsRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let plansRepo: QZPayPlansRepository;
    let vendorsRepo: QZPayVendorsRepository;

    let testCustomerId: string;
    let testPlanId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        customersRepo = new QZPayCustomersRepository(db);
        paymentsRepo = new QZPayPaymentsRepository(db);
        paymentMethodsRepo = new QZPayPaymentMethodsRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        plansRepo = new QZPayPlansRepository(db);
        vendorsRepo = new QZPayVendorsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create customer
        const customer = await customersRepo.create({
            externalId: 'ext-multi-provider',
            email: 'multi@example.com',
            name: 'Multi Provider Customer',
            livemode: true
        });
        testCustomerId = customer.id;

        // Setup: Create plan
        const plan = await plansRepo.create({
            name: 'Multi-Provider Test Plan',
            active: true,
            livemode: true
        });
        testPlanId = plan.id;
    });

    describe('Multiple Payment Methods', () => {
        it('should store payment methods from different providers', async () => {
            // Stripe card
            const _stripeCard = await paymentMethodsRepo.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_1234',
                type: 'card',
                lastFour: '4242',
                brand: 'visa',
                expMonth: 12,
                expYear: 2030,
                isDefault: true,
                livemode: true
            });

            // MercadoPago card
            const _mpCard = await paymentMethodsRepo.create({
                customerId: testCustomerId,
                provider: 'mercadopago',
                providerPaymentMethodId: 'mp_card_5678',
                type: 'card',
                lastFour: '1234',
                brand: 'mastercard',
                expMonth: 6,
                expYear: 2028,
                isDefault: false,
                livemode: true
            });

            const paymentMethods = await paymentMethodsRepo.findByCustomerId(testCustomerId);
            expect(paymentMethods.data).toHaveLength(2);

            const stripeMethod = paymentMethods.data.find((pm) => pm.provider === 'stripe');
            const mpMethod = paymentMethods.data.find((pm) => pm.provider === 'mercadopago');

            expect(stripeMethod).toBeDefined();
            expect(mpMethod).toBeDefined();
            expect(stripeMethod?.isDefault).toBe(true);
            expect(mpMethod?.isDefault).toBe(false);
        });

        it('should switch default payment method across providers', async () => {
            const stripeCard = await paymentMethodsRepo.create({
                customerId: testCustomerId,
                provider: 'stripe',
                providerPaymentMethodId: 'pm_stripe_default',
                type: 'card',
                lastFour: '4242',
                brand: 'visa',
                expMonth: 12,
                expYear: 2030,
                isDefault: true,
                livemode: true
            });

            const mpCard = await paymentMethodsRepo.create({
                customerId: testCustomerId,
                provider: 'mercadopago',
                providerPaymentMethodId: 'mp_card_new_default',
                type: 'card',
                lastFour: '5678',
                brand: 'mastercard',
                expMonth: 3,
                expYear: 2029,
                isDefault: false,
                livemode: true
            });

            // Switch default to MercadoPago
            await paymentMethodsRepo.setDefault(testCustomerId, mpCard.id);

            const updatedMethods = await paymentMethodsRepo.findByCustomerId(testCustomerId);
            const newDefaultStripe = updatedMethods.data.find((pm) => pm.id === stripeCard.id);
            const newDefaultMp = updatedMethods.data.find((pm) => pm.id === mpCard.id);

            expect(newDefaultStripe?.isDefault).toBe(false);
            expect(newDefaultMp?.isDefault).toBe(true);
        });
    });

    describe('Cross-Provider Payments', () => {
        it('should process payments through Stripe', async () => {
            const stripePayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentIds: { stripe: 'pi_stripe_success' },
                metadata: { source: 'website' },
                livemode: true
            });

            expect(stripePayment.provider).toBe('stripe');
            expect(stripePayment.status).toBe('succeeded');

            const found = await paymentsRepo.findByProviderPaymentId('pi_stripe_success');
            expect(found?.id).toBe(stripePayment.id);
        });

        it('should process payments through MercadoPago', async () => {
            const mpPayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 50000, // 500 ARS
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                providerPaymentIds: { mercadopago: 'mp_payment_12345' },
                metadata: { source: 'mobile_app' },
                livemode: true
            });

            expect(mpPayment.provider).toBe('mercadopago');
            expect(mpPayment.currency).toBe('ars');

            const found = await paymentsRepo.findByProviderPaymentId('mp_payment_12345');
            expect(found?.id).toBe(mpPayment.id);
        });

        it('should track payments by provider', async () => {
            // Create multiple payments
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
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 3000,
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                livemode: true
            });

            const stripePayments = await paymentsRepo.search({ provider: 'stripe' });
            const mpPayments = await paymentsRepo.search({ provider: 'mercadopago' });

            expect(stripePayments.data).toHaveLength(2);
            expect(mpPayments.data).toHaveLength(1);
        });
    });

    describe('Provider Failover', () => {
        it('should handle Stripe payment failure and record for retry', async () => {
            // First attempt with Stripe fails
            const failedPayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.markFailed(failedPayment.id, 'card_declined', 'Card was declined');

            const failed = await paymentsRepo.findById(failedPayment.id);
            expect(failed?.status).toBe('failed');
            expect(failed?.failureCode).toBe('card_declined');
        });

        it('should track retry attempts across providers', async () => {
            const idempotencyKey = `payment_${Date.now()}`;

            // First attempt with Stripe
            const _stripeAttempt = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'failed',
                provider: 'stripe',
                failureCode: 'card_declined',
                metadata: {
                    idempotencyKey,
                    attemptNumber: 1,
                    originalProvider: 'stripe'
                },
                livemode: true
            });

            // Retry with MercadoPago
            const mpRetry = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'mercadopago',
                providerPaymentId: 'mp_retry_success',
                metadata: {
                    idempotencyKey,
                    attemptNumber: 2,
                    originalProvider: 'stripe',
                    retryReason: 'primary_provider_failed'
                },
                livemode: true
            });

            expect(mpRetry.status).toBe('succeeded');
            expect(mpRetry.metadata?.attemptNumber).toBe(2);
        });
    });

    describe('Multi-Currency Support', () => {
        it('should handle USD payments through Stripe', async () => {
            const usdPayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 9999, // $99.99
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            expect(usdPayment.currency).toBe('USD');
            expect(usdPayment.amount).toBe(9999);
        });

        it('should handle ARS payments through MercadoPago', async () => {
            const arsPayment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 999900, // 9,999 ARS
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                livemode: true
            });

            expect(arsPayment.currency).toBe('ars');
            expect(arsPayment.amount).toBe(999900);
        });

        it('should track payments by currency', async () => {
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
                currency: 'eur',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 50000,
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                livemode: true
            });

            // Get all payments and filter by currency
            const allPayments = await paymentsRepo.findByCustomerId(testCustomerId);
            const usdPayments = allPayments.data.filter((p) => p.currency === 'USD');
            const arsPayments = allPayments.data.filter((p) => p.currency === 'ars');
            const eurPayments = allPayments.data.filter((p) => p.currency === 'eur');

            expect(usdPayments).toHaveLength(1);
            expect(arsPayments).toHaveLength(1);
            expect(eurPayments).toHaveLength(1);
        });
    });

    describe('Vendor Multi-Provider Payouts', () => {
        let testVendorId: string;

        beforeEach(async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-multi',
                name: 'Multi-Provider Vendor',
                email: 'vendor-multi@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                stripeAccountId: 'acct_stripe_vendor',
                mpMerchantId: 'mp_merchant_vendor',
                pendingBalance: 100000,
                livemode: true
            });
            testVendorId = vendor.id;
        });

        it('should create payout via Stripe', async () => {
            const stripePayout = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 50000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });

            expect(stripePayout.provider).toBe('stripe');
            expect(stripePayout.amount).toBe(50000);
        });

        it('should create payout via MercadoPago', async () => {
            const mpPayout = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'mercadopago',
                amount: 50000,
                currency: 'ars',
                status: 'pending',
                livemode: true
            });

            expect(mpPayout.provider).toBe('mercadopago');
            expect(mpPayout.currency).toBe('ars');
        });

        it('should track payouts by provider', async () => {
            await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 25000,
                currency: 'USD',
                status: 'succeeded',
                livemode: true
            });

            await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 25000,
                currency: 'USD',
                status: 'succeeded',
                livemode: true
            });

            await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'mercadopago',
                amount: 50000,
                currency: 'ars',
                status: 'succeeded',
                livemode: true
            });

            const payouts = await vendorsRepo.findPayoutsByVendorId(testVendorId);
            expect(payouts.data).toHaveLength(3);

            const stripePayouts = payouts.data.filter((p) => p.provider === 'stripe');
            const mpPayouts = payouts.data.filter((p) => p.provider === 'mercadopago');

            expect(stripePayouts).toHaveLength(2);
            expect(mpPayouts).toHaveLength(1);
        });
    });

    describe('Subscription Provider Assignment', () => {
        it('should create subscription with Stripe provider', async () => {
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
                stripeSubscriptionId: 'sub_stripe_123',
                livemode: true
            });

            expect(subscription.stripeSubscriptionId).toBe('sub_stripe_123');
        });

        it('should find subscription by provider ID', async () => {
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
                stripeSubscriptionId: 'sub_find_test',
                livemode: true
            });

            const found = await subscriptionsRepo.findByStripeSubscriptionId('sub_find_test');
            expect(found?.id).toBe(subscription.id);
        });
    });

    describe('Customer Provider Preferences', () => {
        it('should store customer provider IDs', async () => {
            const customer = await customersRepo.create({
                externalId: 'ext-provider-customer',
                email: 'provider-prefs@example.com',
                name: 'Provider Prefs Customer',
                stripeCustomerId: 'cus_stripe_123',
                mpCustomerId: 'mp_cus_456',
                livemode: true
            });

            expect(customer.stripeCustomerId).toBe('cus_stripe_123');
            expect(customer.mpCustomerId).toBe('mp_cus_456');

            // Find by Stripe ID
            const byStripe = await customersRepo.findByStripeCustomerId('cus_stripe_123');
            expect(byStripe?.id).toBe(customer.id);

            // Find by MercadoPago ID
            const byMp = await customersRepo.findByMpCustomerId('mp_cus_456');
            expect(byMp?.id).toBe(customer.id);
        });

        it('should update customer provider IDs', async () => {
            const customer = await customersRepo.create({
                externalId: 'ext-update-provider',
                email: 'update-provider@example.com',
                name: 'Update Provider Customer',
                livemode: true
            });

            // Link Stripe account
            const withStripe = await customersRepo.updateStripeCustomerId(customer.id, 'cus_new_stripe');
            expect(withStripe.stripeCustomerId).toBe('cus_new_stripe');

            // Link MercadoPago account
            const withMp = await customersRepo.updateMpCustomerId(customer.id, 'mp_cus_new');
            expect(withMp.mpCustomerId).toBe('mp_cus_new');
        });
    });

    describe('Refund Multi-Provider', () => {
        it('should process Stripe refund', async () => {
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_stripe_refund_test',
                livemode: true
            });

            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 5000,
                currency: 'USD',
                reason: 'requested_by_customer',
                status: 'succeeded',
                providerRefundId: 're_stripe_123',
                livemode: true
            });

            expect(refund.providerRefundId).toBe('re_stripe_123');
            expect(refund.status).toBe('succeeded');
        });

        it('should process MercadoPago refund', async () => {
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: 50000,
                currency: 'ars',
                status: 'succeeded',
                provider: 'mercadopago',
                providerPaymentId: 'mp_payment_refund_test',
                livemode: true
            });

            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 50000,
                currency: 'ars',
                reason: 'duplicate',
                status: 'succeeded',
                providerRefundId: 'mp_refund_456',
                livemode: true
            });

            expect(refund.providerRefundId).toBe('mp_refund_456');
            expect(refund.amount).toBe(50000);
        });
    });
});
