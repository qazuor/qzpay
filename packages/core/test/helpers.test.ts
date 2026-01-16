/**
 * Tests for helper classes
 */
import { describe, expect, it } from 'vitest';
import { QZPAY_BILLING_INTERVAL, QZPAY_CURRENCY, QZPAY_INVOICE_STATUS, QZPAY_SUBSCRIPTION_STATUS } from '../src/constants/index.js';
// Customer helpers
import {
    qzpayCalculateCustomerTotalSpent,
    qzpayCustomerHasActiveSubscription,
    qzpayCustomerHasPastDueSubscription,
    qzpayCustomerHasTrialSubscription,
    qzpayCustomerHasUnpaidInvoices,
    qzpayGetCustomerActiveSubscriptions,
    qzpayGetCustomerChurnedSubscriptions,
    qzpayGetCustomerHealth,
    qzpayGetCustomerLifecycleState,
    qzpayGetCustomerRiskLevel,
    qzpayGetCustomerStats,
    qzpayIsCustomerEligibleForUpgrade,
    qzpayShouldOfferRetention
} from '../src/helpers/customer.helper.js';
// Plan helpers
import {
    qzpayComparePlans,
    qzpayFindPlansInPriceRange,
    qzpayFindPlansWithFeatures,
    qzpayGetActivePrices,
    qzpayGetAnnualEquivalent,
    qzpayGetCheapestPrice,
    qzpayGetFeatureMatrix,
    qzpayGetIncludedFeatures,
    qzpayGetMonthlyEquivalent,
    qzpayGetPlanLimit,
    qzpayGetPriceByInterval,
    qzpayPlanHasEntitlement,
    qzpayPlanHasFeature,
    qzpayRecommendPlan,
    qzpaySortPlansByFeatures,
    qzpaySortPlansByPrice
} from '../src/helpers/plan.helper.js';

// Subscription helpers
import {
    qzpayCalculateNextBillingDate,
    qzpayCalculateSubscriptionProration,
    qzpayCanPauseSubscription,
    qzpayCanResumeSubscription,
    qzpayCanUpgradeSubscription,
    qzpayGetPeriodInfo,
    qzpayGetRenewalInfo,
    qzpayGetSubscriptionStatusDetails,
    qzpayGetSubscriptionsApproachingRenewal,
    qzpayGetSubscriptionsApproachingTrialEnd,
    qzpayGetTrialInfo,
    qzpayGroupSubscriptionsByStatus,
    qzpayIsSubscriptionActive,
    qzpayIsSubscriptionInTrial,
    qzpaySortSubscriptionsByRenewal,
    qzpayWillSubscriptionRenew
} from '../src/helpers/subscription.helper.js';
import type { QZPayCustomer, QZPayInvoice, QZPayPayment, QZPayPlan, QZPayPrice, QZPaySubscription } from '../src/types/index.js';

// Helper to create test data
function createCustomer(overrides: Partial<QZPayCustomer> = {}): QZPayCustomer {
    return {
        id: 'cust_1',
        externalId: 'ext_1',
        email: 'test@example.com',
        name: 'Test User',
        phone: null,
        providerCustomerIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function createSubscription(overrides: Partial<QZPaySubscription> = {}): QZPaySubscription {
    const now = new Date();
    return {
        id: 'sub_1',
        customerId: 'cust_1',
        planId: 'plan_1',
        status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
        interval: QZPAY_BILLING_INTERVAL.MONTH,
        intervalCount: 1,
        quantity: 1,
        currentPeriodStart: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        trialStart: null,
        trialEnd: null,
        cancelAt: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        providerSubscriptionIds: {},
        metadata: {},
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...overrides
    };
}

function createPayment(overrides: Partial<QZPayPayment> = {}): QZPayPayment {
    return {
        id: 'pay_1',
        customerId: 'cust_1',
        subscriptionId: 'sub_1',
        invoiceId: null,
        amount: 1999,
        currency: QZPAY_CURRENCY.USD,
        status: 'succeeded',
        paymentMethodId: null,
        providerPaymentIds: {},
        failureCode: null,
        failureMessage: null,
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function createInvoice(overrides: Partial<QZPayInvoice> = {}): QZPayInvoice {
    return {
        id: 'inv_1',
        customerId: 'cust_1',
        subscriptionId: 'sub_1',
        status: QZPAY_INVOICE_STATUS.PAID,
        currency: QZPAY_CURRENCY.USD,
        subtotal: 1999,
        total: 1999,
        amountPaid: 1999,
        amountDue: 0,
        lines: [],
        periodStart: new Date(),
        periodEnd: new Date(),
        dueDate: new Date(),
        paidAt: new Date(),
        providerInvoiceIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function createPlan(overrides: Partial<QZPayPlan> = {}): QZPayPlan {
    return {
        id: 'plan_1',
        name: 'Basic Plan',
        description: 'A basic plan',
        active: true,
        prices: [],
        features: [
            { name: 'Feature A', included: true },
            { name: 'Feature B', included: true },
            { name: 'Feature C', included: false }
        ],
        entitlements: ['feature-a', 'feature-b'],
        limits: { api_calls: 1000, storage: 5000 },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function createPrice(overrides: Partial<QZPayPrice> = {}): QZPayPrice {
    return {
        id: 'price_1',
        planId: 'plan_1',
        nickname: null,
        currency: QZPAY_CURRENCY.USD,
        unitAmount: 1999,
        billingInterval: QZPAY_BILLING_INTERVAL.MONTH,
        intervalCount: 1,
        trialDays: null,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

describe('Customer Helpers', () => {
    describe('qzpayCustomerHasActiveSubscription', () => {
        it('returns true when customer has active subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            expect(qzpayCustomerHasActiveSubscription(subscriptions)).toBe(true);
        });

        it('returns false when customer has no active subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })];
            expect(qzpayCustomerHasActiveSubscription(subscriptions)).toBe(false);
        });

        it('returns false for deleted subscriptions', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE, deletedAt: new Date() })];
            expect(qzpayCustomerHasActiveSubscription(subscriptions)).toBe(false);
        });
    });

    describe('qzpayCustomerHasTrialSubscription', () => {
        it('returns true when customer has trial subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.TRIALING })];
            expect(qzpayCustomerHasTrialSubscription(subscriptions)).toBe(true);
        });

        it('returns false when customer has no trial subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            expect(qzpayCustomerHasTrialSubscription(subscriptions)).toBe(false);
        });
    });

    describe('qzpayCustomerHasPastDueSubscription', () => {
        it('returns true when customer has past due subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE })];
            expect(qzpayCustomerHasPastDueSubscription(subscriptions)).toBe(true);
        });

        it('returns false when customer has no past due subscription', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            expect(qzpayCustomerHasPastDueSubscription(subscriptions)).toBe(false);
        });
    });

    describe('qzpayCustomerHasUnpaidInvoices', () => {
        it('returns true when customer has open invoices', () => {
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN })];
            expect(qzpayCustomerHasUnpaidInvoices(invoices)).toBe(true);
        });

        it('returns true when customer has uncollectible invoices', () => {
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.UNCOLLECTIBLE })];
            expect(qzpayCustomerHasUnpaidInvoices(invoices)).toBe(true);
        });

        it('returns false when all invoices are paid', () => {
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.PAID })];
            expect(qzpayCustomerHasUnpaidInvoices(invoices)).toBe(false);
        });
    });

    describe('qzpayGetCustomerActiveSubscriptions', () => {
        it('returns only active and trialing subscriptions', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE }),
                createSubscription({ id: 'sub_2', status: QZPAY_SUBSCRIPTION_STATUS.TRIALING }),
                createSubscription({ id: 'sub_3', status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })
            ];
            const active = qzpayGetCustomerActiveSubscriptions(subscriptions);
            expect(active.length).toBe(2);
            expect(active.map((s) => s.id)).toContain('sub_1');
            expect(active.map((s) => s.id)).toContain('sub_2');
        });
    });

    describe('qzpayGetCustomerChurnedSubscriptions', () => {
        it('returns only canceled subscriptions', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE }),
                createSubscription({ id: 'sub_2', status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })
            ];
            const churned = qzpayGetCustomerChurnedSubscriptions(subscriptions);
            expect(churned.length).toBe(1);
            expect(churned[0].id).toBe('sub_2');
        });
    });

    describe('qzpayCalculateCustomerTotalSpent', () => {
        it('sums only successful payments', () => {
            const payments = [
                createPayment({ amount: 1000, status: 'succeeded' }),
                createPayment({ amount: 2000, status: 'succeeded' }),
                createPayment({ amount: 500, status: 'failed' })
            ];
            expect(qzpayCalculateCustomerTotalSpent(payments)).toBe(3000);
        });

        it('returns 0 for no payments', () => {
            expect(qzpayCalculateCustomerTotalSpent([])).toBe(0);
        });
    });

    describe('qzpayGetCustomerLifecycleState', () => {
        it('returns new for new customers without subscriptions', () => {
            const customer = createCustomer({
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            });
            const state = qzpayGetCustomerLifecycleState(customer, [], []);
            expect(state).toBe('new');
        });

        it('returns trial for customers with trialing subscription', () => {
            const customer = createCustomer();
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.TRIALING })];
            const state = qzpayGetCustomerLifecycleState(customer, subscriptions, []);
            expect(state).toBe('trial');
        });

        it('returns active for customers with active subscription', () => {
            const customer = createCustomer();
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const state = qzpayGetCustomerLifecycleState(customer, subscriptions, []);
            expect(state).toBe('active');
        });

        it('returns at_risk for active customers with past due subscription', () => {
            const customer = createCustomer();
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE })];
            const state = qzpayGetCustomerLifecycleState(customer, subscriptions, []);
            expect(state).toBe('at_risk');
        });

        it('returns churned for customers with canceled subscription', () => {
            const customer = createCustomer();
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })];
            const state = qzpayGetCustomerLifecycleState(customer, subscriptions, []);
            expect(state).toBe('churned');
        });

        it('returns inactive for customers without any subscriptions', () => {
            const customer = createCustomer();
            const state = qzpayGetCustomerLifecycleState(customer, [], []);
            expect(state).toBe('inactive');
        });
    });

    describe('qzpayGetCustomerRiskLevel', () => {
        it('returns high for past due subscriptions', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE })];
            const risk = qzpayGetCustomerRiskLevel(subscriptions, [], []);
            expect(risk).toBe('high');
        });

        it('returns high for high payment failure rate', () => {
            const payments = [
                createPayment({ status: 'failed' }),
                createPayment({ status: 'failed' }),
                createPayment({ status: 'succeeded' })
            ];
            const risk = qzpayGetCustomerRiskLevel([], [], payments);
            expect(risk).toBe('high');
        });

        it('returns medium for unpaid invoices', () => {
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN })];
            const risk = qzpayGetCustomerRiskLevel([], invoices, []);
            expect(risk).toBe('medium');
        });

        it('returns low for healthy customers', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const payments = [createPayment({ status: 'succeeded' }), createPayment({ status: 'succeeded' })];
            const risk = qzpayGetCustomerRiskLevel(subscriptions, [], payments);
            expect(risk).toBe('low');
        });
    });

    describe('qzpayGetCustomerHealth', () => {
        it('returns comprehensive health assessment', () => {
            const customer = createCustomer();
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.PAID })];
            const payments = [createPayment({ amount: 1999, status: 'succeeded' }), createPayment({ amount: 1999, status: 'succeeded' })];

            const health = qzpayGetCustomerHealth(customer, subscriptions, invoices, payments);

            expect(health.state).toBe('active');
            expect(health.hasActiveSubscription).toBe(true);
            expect(health.hasTrialSubscription).toBe(false);
            expect(health.hasPastDueSubscription).toBe(false);
            expect(health.hasUnpaidInvoices).toBe(false);
            expect(health.subscriptionCount).toBe(1);
            expect(health.totalSpent).toBe(3998);
            expect(health.riskLevel).toBe('low');
        });
    });

    describe('qzpayGetCustomerStats', () => {
        it('calculates customer statistics', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE }),
                createSubscription({ id: 'sub_2', status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })
            ];
            const invoices = [
                createInvoice({ id: 'inv_1', status: QZPAY_INVOICE_STATUS.PAID }),
                createInvoice({ id: 'inv_2', status: QZPAY_INVOICE_STATUS.OPEN })
            ];
            const payments = [
                createPayment({ amount: 1999, status: 'succeeded' }),
                createPayment({ amount: 2999, status: 'succeeded' }),
                createPayment({ amount: 1999, status: 'failed' })
            ];

            const stats = qzpayGetCustomerStats(subscriptions, invoices, payments);

            expect(stats.totalSubscriptions).toBe(2);
            expect(stats.activeSubscriptions).toBe(1);
            expect(stats.totalPayments).toBe(3);
            expect(stats.successfulPayments).toBe(2);
            expect(stats.failedPayments).toBe(1);
            expect(stats.totalInvoices).toBe(2);
            expect(stats.paidInvoices).toBe(1);
            expect(stats.unpaidInvoices).toBe(1);
            expect(stats.totalSpent).toBe(4998);
            expect(stats.averagePaymentAmount).toBe(2499);
        });
    });

    describe('qzpayIsCustomerEligibleForUpgrade', () => {
        it('returns true for eligible customers', () => {
            const customer = createCustomer({
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
            });
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const payments = [
                createPayment({ status: 'succeeded' }),
                createPayment({ status: 'succeeded' }),
                createPayment({ status: 'succeeded' })
            ];
            expect(qzpayIsCustomerEligibleForUpgrade(customer, subscriptions, payments)).toBe(true);
        });

        it('returns false for new customers', () => {
            const customer = createCustomer({
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
            });
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const payments = [createPayment({ status: 'succeeded' }), createPayment({ status: 'succeeded' })];
            expect(qzpayIsCustomerEligibleForUpgrade(customer, subscriptions, payments)).toBe(false);
        });

        it('returns false for customers with recent failed payments', () => {
            const customer = createCustomer({
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
            });
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const payments = [
                createPayment({ status: 'succeeded' }),
                createPayment({ status: 'succeeded' }),
                createPayment({ status: 'failed' })
            ];
            expect(qzpayIsCustomerEligibleForUpgrade(customer, subscriptions, payments)).toBe(false);
        });
    });

    describe('qzpayShouldOfferRetention', () => {
        it('returns true for subscription scheduled for cancellation', () => {
            const subscriptions = [
                createSubscription({
                    status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                    cancelAtPeriodEnd: true
                })
            ];
            expect(qzpayShouldOfferRetention(subscriptions, [])).toBe(true);
        });

        it('returns true for past due subscriptions', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE })];
            expect(qzpayShouldOfferRetention(subscriptions, [])).toBe(true);
        });

        it('returns true for multiple unpaid invoices', () => {
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }), createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN })];
            expect(qzpayShouldOfferRetention([], invoices)).toBe(true);
        });

        it('returns false for healthy customers', () => {
            const subscriptions = [createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE })];
            const invoices = [createInvoice({ status: QZPAY_INVOICE_STATUS.PAID })];
            expect(qzpayShouldOfferRetention(subscriptions, invoices)).toBe(false);
        });
    });
});

describe('Subscription Helpers', () => {
    describe('qzpayIsSubscriptionActive', () => {
        it('returns true for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayIsSubscriptionActive(sub)).toBe(true);
        });

        it('returns true for trialing subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.TRIALING });
            expect(qzpayIsSubscriptionActive(sub)).toBe(true);
        });

        it('returns false for canceled subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.CANCELED });
            expect(qzpayIsSubscriptionActive(sub)).toBe(false);
        });

        it('returns false for deleted subscription', () => {
            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                deletedAt: new Date()
            });
            expect(qzpayIsSubscriptionActive(sub)).toBe(false);
        });
    });

    describe('qzpayIsSubscriptionInTrial', () => {
        it('returns true for trialing subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.TRIALING });
            expect(qzpayIsSubscriptionInTrial(sub)).toBe(true);
        });

        it('returns false for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayIsSubscriptionInTrial(sub)).toBe(false);
        });
    });

    describe('qzpayWillSubscriptionRenew', () => {
        it('returns true for active subscription without cancellation', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayWillSubscriptionRenew(sub)).toBe(true);
        });

        it('returns false for subscription scheduled for cancellation', () => {
            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                cancelAtPeriodEnd: true
            });
            expect(qzpayWillSubscriptionRenew(sub)).toBe(false);
        });

        it('returns false for canceled subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.CANCELED });
            expect(qzpayWillSubscriptionRenew(sub)).toBe(false);
        });
    });

    describe('qzpayGetSubscriptionStatusDetails', () => {
        it('returns correct details for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            const details = qzpayGetSubscriptionStatusDetails(sub);

            expect(details.status).toBe(QZPAY_SUBSCRIPTION_STATUS.ACTIVE);
            expect(details.isActive).toBe(true);
            expect(details.isTrial).toBe(false);
            expect(details.isPastDue).toBe(false);
            expect(details.isCanceled).toBe(false);
            expect(details.isPaused).toBe(false);
            expect(details.isIncomplete).toBe(false);
            expect(details.canBeReactivated).toBe(false);
            expect(details.requiresPayment).toBe(false);
        });

        it('returns correct details for past due subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE });
            const details = qzpayGetSubscriptionStatusDetails(sub);

            expect(details.isPastDue).toBe(true);
            expect(details.requiresPayment).toBe(true);
        });
    });

    describe('qzpayGetTrialInfo', () => {
        it('returns info for subscription in trial', () => {
            const now = new Date();
            const trialStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const trialEnd = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000);

            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                trialStart,
                trialEnd
            });

            const info = qzpayGetTrialInfo(sub);

            expect(info.isInTrial).toBe(true);
            expect(info.trialStartDate).toEqual(trialStart);
            expect(info.trialEndDate).toEqual(trialEnd);
            expect(info.daysRemaining).toBeGreaterThan(0);
            expect(info.daysUsed).toBeGreaterThan(0);
            expect(info.totalTrialDays).toBe(14);
        });

        it('returns empty info for subscription without trial', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            const info = qzpayGetTrialInfo(sub);

            expect(info.isInTrial).toBe(false);
            expect(info.trialStartDate).toBeNull();
            expect(info.trialEndDate).toBeNull();
        });
    });

    describe('qzpayGetPeriodInfo', () => {
        it('calculates period information', () => {
            const now = new Date();
            const start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            const end = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

            const sub = createSubscription({
                currentPeriodStart: start,
                currentPeriodEnd: end
            });

            const info = qzpayGetPeriodInfo(sub);

            expect(info.currentPeriodStart).toEqual(start);
            expect(info.currentPeriodEnd).toEqual(end);
            expect(info.daysInPeriod).toBe(30);
            expect(info.daysElapsed).toBeGreaterThanOrEqual(14);
            expect(info.daysRemaining).toBeGreaterThanOrEqual(14);
            expect(info.percentComplete).toBeGreaterThan(40);
            expect(info.percentComplete).toBeLessThan(60);
        });

        it('throws error when period start and end are the same', () => {
            const now = new Date();
            const sub = createSubscription({
                currentPeriodStart: now,
                currentPeriodEnd: now
            });

            expect(() => qzpayGetPeriodInfo(sub)).toThrow('Cannot calculate proration: period has no days (daysInPeriod <= 0)');
        });

        it('throws error when period end is before start', () => {
            const now = new Date();
            const start = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const end = new Date(now.getTime());

            const sub = createSubscription({
                currentPeriodStart: start,
                currentPeriodEnd: end
            });

            expect(() => qzpayGetPeriodInfo(sub)).toThrow('Cannot calculate proration: period has no days (daysInPeriod <= 0)');
        });
    });

    describe('qzpayGetRenewalInfo', () => {
        it('returns renewal info for active subscription', () => {
            const price = createPrice({ unitAmount: 1999 });
            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                quantity: 2
            });

            const info = qzpayGetRenewalInfo(sub, price);

            expect(info.willRenew).toBe(true);
            expect(info.renewalDate).toEqual(sub.currentPeriodEnd);
            expect(info.daysUntilRenewal).toBeGreaterThan(0);
            expect(info.renewalAmount).toBe(3998);
            expect(info.currency).toBe(QZPAY_CURRENCY.USD);
            expect(info.isCanceling).toBe(false);
        });

        it('returns cancellation info for subscription scheduled for cancellation', () => {
            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                cancelAtPeriodEnd: true
            });

            const info = qzpayGetRenewalInfo(sub, null);

            expect(info.willRenew).toBe(false);
            expect(info.isCanceling).toBe(true);
            expect(info.cancellationDate).toEqual(sub.currentPeriodEnd);
        });
    });

    describe('qzpayCalculateNextBillingDate', () => {
        it('calculates next billing date for monthly', () => {
            const currentEnd = new Date('2024-01-15');
            const nextDate = qzpayCalculateNextBillingDate(currentEnd, QZPAY_BILLING_INTERVAL.MONTH, 1);
            expect(nextDate.getMonth()).toBe(1); // February
        });

        it('calculates next billing date for yearly', () => {
            const currentEnd = new Date('2024-01-15');
            const nextDate = qzpayCalculateNextBillingDate(currentEnd, QZPAY_BILLING_INTERVAL.YEAR, 1);
            expect(nextDate.getFullYear()).toBe(2025);
        });
    });

    describe('qzpayCalculateSubscriptionProration', () => {
        it('calculates proration for upgrade', () => {
            const now = new Date();
            const sub = createSubscription({
                currentPeriodStart: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
            });
            const currentPrice = createPrice({ unitAmount: 1999 });
            const newPrice = createPrice({ unitAmount: 4999 });

            const proration = qzpayCalculateSubscriptionProration(sub, currentPrice, newPrice);

            expect(proration.unusedAmount).toBeGreaterThan(0);
            expect(proration.newAmount).toBeGreaterThan(proration.unusedAmount);
            expect(proration.chargeAmount).toBeGreaterThan(0);
            expect(proration.creditAmount).toBe(0);
        });

        it('calculates proration for downgrade', () => {
            const now = new Date();
            const sub = createSubscription({
                currentPeriodStart: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
            });
            const currentPrice = createPrice({ unitAmount: 4999 });
            const newPrice = createPrice({ unitAmount: 1999 });

            const proration = qzpayCalculateSubscriptionProration(sub, currentPrice, newPrice);

            expect(proration.creditAmount).toBeGreaterThan(0);
            expect(proration.chargeAmount).toBe(0);
        });
    });

    describe('qzpayCanUpgradeSubscription', () => {
        it('returns true for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayCanUpgradeSubscription(sub)).toBe(true);
        });

        it('returns false for canceled subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.CANCELED });
            expect(qzpayCanUpgradeSubscription(sub)).toBe(false);
        });

        it('returns false for subscription scheduled for cancellation', () => {
            const sub = createSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                cancelAtPeriodEnd: true
            });
            expect(qzpayCanUpgradeSubscription(sub)).toBe(false);
        });
    });

    describe('qzpayCanPauseSubscription', () => {
        it('returns true for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayCanPauseSubscription(sub)).toBe(true);
        });

        it('returns false for trialing subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.TRIALING });
            expect(qzpayCanPauseSubscription(sub)).toBe(false);
        });
    });

    describe('qzpayCanResumeSubscription', () => {
        it('returns true for paused subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAUSED });
            expect(qzpayCanResumeSubscription(sub)).toBe(true);
        });

        it('returns false for active subscription', () => {
            const sub = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayCanResumeSubscription(sub)).toBe(false);
        });
    });

    describe('qzpayGetSubscriptionsApproachingRenewal', () => {
        it('returns subscriptions renewing within threshold', () => {
            const now = new Date();
            const subscriptions = [
                createSubscription({
                    id: 'sub_1',
                    currentPeriodEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
                }),
                createSubscription({
                    id: 'sub_2',
                    currentPeriodEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000) // 10 days
                })
            ];

            const approaching = qzpayGetSubscriptionsApproachingRenewal(subscriptions, 7);
            expect(approaching.length).toBe(1);
            expect(approaching[0].id).toBe('sub_1');
        });
    });

    describe('qzpayGetSubscriptionsApproachingTrialEnd', () => {
        it('returns subscriptions with trial ending within threshold', () => {
            const now = new Date();
            const subscriptions = [
                createSubscription({
                    id: 'sub_1',
                    status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                    trialStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
                    trialEnd: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days
                }),
                createSubscription({
                    id: 'sub_2',
                    status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                    trialStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
                    trialEnd: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000) // 9 days
                })
            ];

            const approaching = qzpayGetSubscriptionsApproachingTrialEnd(subscriptions, 3);
            expect(approaching.length).toBe(1);
            expect(approaching[0].id).toBe('sub_1');
        });
    });

    describe('qzpaySortSubscriptionsByRenewal', () => {
        it('sorts subscriptions by renewal date', () => {
            const now = new Date();
            const subscriptions = [
                createSubscription({
                    id: 'sub_2',
                    currentPeriodEnd: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000)
                }),
                createSubscription({
                    id: 'sub_1',
                    currentPeriodEnd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
                })
            ];

            const sorted = qzpaySortSubscriptionsByRenewal(subscriptions);
            expect(sorted[0].id).toBe('sub_1');
            expect(sorted[1].id).toBe('sub_2');
        });
    });

    describe('qzpayGroupSubscriptionsByStatus', () => {
        it('groups subscriptions by status', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE }),
                createSubscription({ id: 'sub_2', status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE }),
                createSubscription({ id: 'sub_3', status: QZPAY_SUBSCRIPTION_STATUS.CANCELED })
            ];

            const groups = qzpayGroupSubscriptionsByStatus(subscriptions);
            expect(groups[QZPAY_SUBSCRIPTION_STATUS.ACTIVE].length).toBe(2);
            expect(groups[QZPAY_SUBSCRIPTION_STATUS.CANCELED].length).toBe(1);
        });
    });
});

describe('Plan Helpers', () => {
    describe('qzpayGetActivePrices', () => {
        it('returns only active prices', () => {
            const plan = createPlan({
                prices: [
                    createPrice({ id: 'price_1', active: true }),
                    createPrice({ id: 'price_2', active: false }),
                    createPrice({ id: 'price_3', active: true })
                ]
            });

            const active = qzpayGetActivePrices(plan);
            expect(active.length).toBe(2);
        });
    });

    describe('qzpayGetPriceByInterval', () => {
        it('returns price matching interval', () => {
            const plan = createPlan({
                prices: [
                    createPrice({ id: 'price_month', billingInterval: QZPAY_BILLING_INTERVAL.MONTH }),
                    createPrice({ id: 'price_year', billingInterval: QZPAY_BILLING_INTERVAL.YEAR })
                ]
            });

            const monthlyPrice = qzpayGetPriceByInterval(plan, QZPAY_BILLING_INTERVAL.MONTH);
            expect(monthlyPrice?.id).toBe('price_month');
        });

        it('returns null if no matching price', () => {
            const plan = createPlan({
                prices: [createPrice({ billingInterval: QZPAY_BILLING_INTERVAL.MONTH })]
            });

            const weeklyPrice = qzpayGetPriceByInterval(plan, QZPAY_BILLING_INTERVAL.WEEK);
            expect(weeklyPrice).toBeNull();
        });
    });

    describe('qzpayGetCheapestPrice', () => {
        it('returns cheapest price by monthly equivalent', () => {
            const plan = createPlan({
                prices: [
                    createPrice({
                        id: 'price_month',
                        unitAmount: 1999,
                        billingInterval: QZPAY_BILLING_INTERVAL.MONTH
                    }),
                    createPrice({
                        id: 'price_year',
                        unitAmount: 19990, // ~$1666/month
                        billingInterval: QZPAY_BILLING_INTERVAL.YEAR
                    })
                ]
            });

            const cheapest = qzpayGetCheapestPrice(plan);
            expect(cheapest?.id).toBe('price_year');
        });
    });

    describe('qzpayGetMonthlyEquivalent', () => {
        it('calculates monthly equivalent for yearly price', () => {
            const price = createPrice({
                unitAmount: 12000,
                billingInterval: QZPAY_BILLING_INTERVAL.YEAR,
                intervalCount: 1
            });

            const monthly = qzpayGetMonthlyEquivalent(price);
            expect(monthly).toBe(1000);
        });

        it('calculates monthly equivalent for weekly price', () => {
            const price = createPrice({
                unitAmount: 500,
                billingInterval: QZPAY_BILLING_INTERVAL.WEEK,
                intervalCount: 1
            });

            const monthly = qzpayGetMonthlyEquivalent(price);
            expect(monthly).toBe(2165); // 500 * 4.33
        });
    });

    describe('qzpayGetAnnualEquivalent', () => {
        it('calculates annual equivalent for monthly price', () => {
            const price = createPrice({
                unitAmount: 1000,
                billingInterval: QZPAY_BILLING_INTERVAL.MONTH,
                intervalCount: 1
            });

            const annual = qzpayGetAnnualEquivalent(price);
            expect(annual).toBe(12000);
        });
    });

    describe('qzpayPlanHasFeature', () => {
        it('returns true when plan has feature', () => {
            const plan = createPlan({
                features: [{ name: 'API Access', included: true }]
            });

            expect(qzpayPlanHasFeature(plan, 'API Access')).toBe(true);
            expect(qzpayPlanHasFeature(plan, 'api access')).toBe(true); // Case insensitive
        });

        it('returns false when feature not included', () => {
            const plan = createPlan({
                features: [{ name: 'API Access', included: false }]
            });

            expect(qzpayPlanHasFeature(plan, 'API Access')).toBe(false);
        });
    });

    describe('qzpayPlanHasEntitlement', () => {
        it('returns true when plan has entitlement', () => {
            const plan = createPlan({
                entitlements: ['api-access', 'premium-support']
            });

            expect(qzpayPlanHasEntitlement(plan, 'api-access')).toBe(true);
        });

        it('returns false when plan lacks entitlement', () => {
            const plan = createPlan({
                entitlements: ['basic-access']
            });

            expect(qzpayPlanHasEntitlement(plan, 'premium-support')).toBe(false);
        });
    });

    describe('qzpayGetIncludedFeatures', () => {
        it('returns only included features', () => {
            const plan = createPlan({
                features: [
                    { name: 'Feature A', included: true },
                    { name: 'Feature B', included: false },
                    { name: 'Feature C', included: true }
                ]
            });

            const included = qzpayGetIncludedFeatures(plan);
            expect(included.length).toBe(2);
            expect(included.map((f) => f.name)).toContain('Feature A');
            expect(included.map((f) => f.name)).toContain('Feature C');
        });
    });

    describe('qzpayGetPlanLimit', () => {
        it('returns limit value when exists', () => {
            const plan = createPlan({
                limits: { api_calls: 1000, storage: 5000 }
            });

            expect(qzpayGetPlanLimit(plan, 'api_calls')).toBe(1000);
        });

        it('returns null when limit not exists', () => {
            const plan = createPlan({
                limits: { api_calls: 1000 }
            });

            expect(qzpayGetPlanLimit(plan, 'unknown')).toBeNull();
        });
    });

    describe('qzpayComparePlans', () => {
        it('detects upgrade correctly', () => {
            const basicPlan = createPlan({
                id: 'basic',
                features: [{ name: 'Feature A', included: true }],
                entitlements: ['basic'],
                prices: [createPrice({ unitAmount: 999 })]
            });

            const proPlan = createPlan({
                id: 'pro',
                features: [
                    { name: 'Feature A', included: true },
                    { name: 'Feature B', included: true }
                ],
                entitlements: ['basic', 'premium'],
                prices: [createPrice({ unitAmount: 2999 })]
            });

            const comparison = qzpayComparePlans(basicPlan, proPlan);

            expect(comparison.isUpgrade).toBe(true);
            expect(comparison.isDowngrade).toBe(false);
            expect(comparison.priceDifference).toBe(2000);
            expect(comparison.featuresGained).toContain('Feature B');
            expect(comparison.entitlementsGained).toContain('premium');
        });

        it('detects downgrade correctly', () => {
            const proPlan = createPlan({
                id: 'pro',
                features: [
                    { name: 'Feature A', included: true },
                    { name: 'Feature B', included: true }
                ],
                entitlements: ['basic', 'premium'],
                prices: [createPrice({ unitAmount: 2999 })]
            });

            const basicPlan = createPlan({
                id: 'basic',
                features: [{ name: 'Feature A', included: true }],
                entitlements: ['basic'],
                prices: [createPrice({ unitAmount: 999 })]
            });

            const comparison = qzpayComparePlans(proPlan, basicPlan);

            expect(comparison.isDowngrade).toBe(true);
            expect(comparison.isUpgrade).toBe(false);
            expect(comparison.priceDifference).toBe(-2000);
            expect(comparison.featuresLost).toContain('Feature B');
            expect(comparison.entitlementsLost).toContain('premium');
        });
    });

    describe('qzpayFindPlansWithFeatures', () => {
        it('finds plans with all required features', () => {
            const plans = [
                createPlan({
                    id: 'basic',
                    features: [{ name: 'Feature A', included: true }]
                }),
                createPlan({
                    id: 'pro',
                    features: [
                        { name: 'Feature A', included: true },
                        { name: 'Feature B', included: true }
                    ]
                })
            ];

            const found = qzpayFindPlansWithFeatures(plans, ['Feature A', 'Feature B']);
            expect(found.length).toBe(1);
            expect(found[0].id).toBe('pro');
        });
    });

    describe('qzpayFindPlansInPriceRange', () => {
        it('finds plans within price range', () => {
            const plans = [
                createPlan({
                    id: 'cheap',
                    prices: [createPrice({ unitAmount: 500 })]
                }),
                createPlan({
                    id: 'mid',
                    prices: [createPrice({ unitAmount: 1500 })]
                }),
                createPlan({
                    id: 'expensive',
                    prices: [createPrice({ unitAmount: 5000 })]
                })
            ];

            const found = qzpayFindPlansInPriceRange(plans, 1000, 2000);
            expect(found.length).toBe(1);
            expect(found[0].id).toBe('mid');
        });
    });

    describe('qzpaySortPlansByPrice', () => {
        it('sorts plans by price ascending', () => {
            const plans = [
                createPlan({
                    id: 'expensive',
                    prices: [createPrice({ unitAmount: 5000 })]
                }),
                createPlan({
                    id: 'cheap',
                    prices: [createPrice({ unitAmount: 500 })]
                })
            ];

            const sorted = qzpaySortPlansByPrice(plans);
            expect(sorted[0].id).toBe('cheap');
            expect(sorted[1].id).toBe('expensive');
        });
    });

    describe('qzpaySortPlansByFeatures', () => {
        it('sorts plans by feature count descending', () => {
            const plans = [
                createPlan({
                    id: 'basic',
                    features: [{ name: 'Feature A', included: true }]
                }),
                createPlan({
                    id: 'pro',
                    features: [
                        { name: 'Feature A', included: true },
                        { name: 'Feature B', included: true },
                        { name: 'Feature C', included: true }
                    ]
                })
            ];

            const sorted = qzpaySortPlansByFeatures(plans);
            expect(sorted[0].id).toBe('pro');
            expect(sorted[1].id).toBe('basic');
        });
    });

    describe('qzpayRecommendPlan', () => {
        it('recommends plan matching requirements', () => {
            const plans = [
                createPlan({
                    id: 'basic',
                    features: [{ name: 'Feature A', included: true }],
                    prices: [createPrice({ unitAmount: 999 })]
                }),
                createPlan({
                    id: 'pro',
                    features: [
                        { name: 'Feature A', included: true },
                        { name: 'Feature B', included: true }
                    ],
                    prices: [createPrice({ unitAmount: 1999 })]
                })
            ];

            const recommendation = qzpayRecommendPlan(
                plans,
                ['Feature A'], // Required
                ['Feature B'], // Desired
                3000 // Max monthly price
            );

            expect(recommendation).not.toBeNull();
            expect(recommendation?.plan.id).toBe('pro');
            expect(recommendation?.matchedFeatures).toContain('Feature A');
            expect(recommendation?.matchedFeatures).toContain('Feature B');
        });

        it('returns null when no plans match', () => {
            const plans = [
                createPlan({
                    id: 'basic',
                    features: [{ name: 'Feature A', included: true }],
                    prices: [createPrice({ unitAmount: 999 })]
                })
            ];

            const recommendation = qzpayRecommendPlan(
                plans,
                ['Feature A'],
                [],
                500 // Max price too low
            );

            expect(recommendation).toBeNull();
        });
    });

    describe('qzpayGetFeatureMatrix', () => {
        it('creates feature comparison matrix', () => {
            const plans = [
                createPlan({
                    id: 'basic',
                    features: [
                        { name: 'Feature A', included: true },
                        { name: 'Feature B', included: false }
                    ]
                }),
                createPlan({
                    id: 'pro',
                    features: [
                        { name: 'Feature A', included: true },
                        { name: 'Feature B', included: true }
                    ]
                })
            ];

            const matrix = qzpayGetFeatureMatrix(plans);

            expect(matrix.get('Feature A')?.get('basic')).toBe(true);
            expect(matrix.get('Feature A')?.get('pro')).toBe(true);
            expect(matrix.get('Feature B')?.get('basic')).toBe(false);
            expect(matrix.get('Feature B')?.get('pro')).toBe(true);
        });
    });
});
