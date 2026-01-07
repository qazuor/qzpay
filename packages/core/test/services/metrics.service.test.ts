import { describe, expect, it } from 'vitest';
import {
    qzpayCalculateChurnMetrics,
    qzpayCalculateDashboardMetrics,
    qzpayCalculateMrr,
    qzpayCalculateMrrBreakdown,
    qzpayCalculateMrrWithBreakdown,
    qzpayCalculateRevenueMetrics,
    qzpayCalculateSubscriptionMetrics,
    qzpayCalculateSubscriptionMrr,
    qzpayGetCurrentMonthPeriod,
    qzpayGetLastNDaysPeriod,
    qzpayGetMonthPeriod,
    qzpayGetPreviousPeriod,
    qzpayNormalizePriceToMonthly
} from '../../src/services/metrics.service.js';
import type { QZPayPayment } from '../../src/types/payment.types.js';
import type { QZPayPrice } from '../../src/types/plan.types.js';
import type { QZPaySubscription } from '../../src/types/subscription.types.js';

// ==================== Test Fixtures ====================

const createSubscription = (overrides: Partial<QZPaySubscription> = {}): QZPaySubscription => ({
    id: 'sub_1',
    customerId: 'cus_1',
    planId: 'plan_1',
    status: 'active',
    interval: 'month',
    intervalCount: 1,
    quantity: 1,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    trialStart: null,
    trialEnd: null,
    cancelAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    providerSubscriptionIds: {},
    metadata: {},
    livemode: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides
});

const createPrice = (overrides: Partial<QZPayPrice> = {}): QZPayPrice => ({
    id: 'price_1',
    planId: 'plan_1',
    nickname: null,
    currency: 'USD',
    unitAmount: 1000, // $10.00
    billingInterval: 'month',
    intervalCount: 1,
    trialDays: null,
    active: true,
    providerPriceIds: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
});

const createPayment = (overrides: Partial<QZPayPayment> = {}): QZPayPayment => ({
    id: 'pay_1',
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    invoiceId: null,
    amount: 1000,
    currency: 'USD',
    status: 'succeeded',
    paymentMethodId: null,
    providerPaymentIds: {},
    failureCode: null,
    failureMessage: null,
    metadata: {},
    livemode: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    ...overrides
});

// ==================== Tests ====================

describe('Metrics Service', () => {
    describe('qzpayNormalizePriceToMonthly', () => {
        it('should normalize daily price to monthly', () => {
            // $1/day * 30 days = $30/month
            const result = qzpayNormalizePriceToMonthly(100, 'day', 1);
            expect(result).toBe(3000);
        });

        it('should normalize weekly price to monthly', () => {
            // $10/week * ~4.3 weeks = ~$43/month
            const result = qzpayNormalizePriceToMonthly(1000, 'week', 1);
            expect(result).toBeCloseTo(4285.7, 0);
        });

        it('should normalize monthly price to monthly', () => {
            const result = qzpayNormalizePriceToMonthly(1000, 'month', 1);
            expect(result).toBe(1000);
        });

        it('should normalize quarterly price to monthly', () => {
            // $30/quarter = $10/month
            const result = qzpayNormalizePriceToMonthly(3000, 'month', 3);
            expect(result).toBe(1000);
        });

        it('should normalize yearly price to monthly', () => {
            // $120/year = $10/month
            const result = qzpayNormalizePriceToMonthly(12000, 'year', 1);
            expect(result).toBe(1000);
        });
    });

    describe('qzpayCalculateSubscriptionMrr', () => {
        it('should calculate MRR for a monthly subscription', () => {
            const subscription = createSubscription({ quantity: 2 });
            const price = createPrice({ unitAmount: 1000 });

            const mrr = qzpayCalculateSubscriptionMrr(subscription, price);
            expect(mrr).toBe(2000); // $20 (2 * $10)
        });

        it('should return 0 if no price provided', () => {
            const subscription = createSubscription();
            const mrr = qzpayCalculateSubscriptionMrr(subscription, null);
            expect(mrr).toBe(0);
        });

        it('should calculate MRR for yearly subscription', () => {
            const subscription = createSubscription({
                interval: 'year',
                intervalCount: 1
            });
            const price = createPrice({
                unitAmount: 12000, // $120/year
                billingInterval: 'year',
                intervalCount: 1
            });

            const mrr = qzpayCalculateSubscriptionMrr(subscription, price);
            expect(mrr).toBe(1000); // $10/month
        });
    });

    describe('qzpayCalculateMrr', () => {
        it('should calculate total MRR from active subscriptions', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: 'active' }),
                createSubscription({ id: 'sub_2', status: 'active' }),
                createSubscription({ id: 'sub_3', status: 'canceled' })
            ];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const result = qzpayCalculateMrr(subscriptions, getPrice);

            expect(result.current).toBe(2000); // 2 active subs * $10
            expect(result.currency).toBe('USD');
        });

        it('should include trialing subscriptions in MRR', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: 'active' }),
                createSubscription({ id: 'sub_2', status: 'trialing' })
            ];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const result = qzpayCalculateMrr(subscriptions, getPrice);

            expect(result.current).toBe(2000); // Both included
        });
    });

    describe('qzpayCalculateMrrBreakdown', () => {
        it('should identify new subscriptions', () => {
            const current = [createSubscription({ id: 'sub_1', status: 'active' })];
            const previous: QZPaySubscription[] = [];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const breakdown = qzpayCalculateMrrBreakdown(current, previous, getPrice);

            expect(breakdown.newMrr).toBe(1000);
            expect(breakdown.churnedMrr).toBe(0);
        });

        it('should identify churned subscriptions', () => {
            const current: QZPaySubscription[] = [];
            const previous = [createSubscription({ id: 'sub_1', status: 'active' })];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const breakdown = qzpayCalculateMrrBreakdown(current, previous, getPrice);

            expect(breakdown.newMrr).toBe(0);
            expect(breakdown.churnedMrr).toBe(1000);
        });

        it('should identify expansion', () => {
            const previous = [createSubscription({ id: 'sub_1', quantity: 1 })];
            const current = [createSubscription({ id: 'sub_1', quantity: 2 })];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const breakdown = qzpayCalculateMrrBreakdown(current, previous, getPrice);

            expect(breakdown.expansionMrr).toBe(1000);
            expect(breakdown.contractionMrr).toBe(0);
        });

        it('should identify contraction', () => {
            const previous = [createSubscription({ id: 'sub_1', quantity: 2 })];
            const current = [createSubscription({ id: 'sub_1', quantity: 1 })];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const breakdown = qzpayCalculateMrrBreakdown(current, previous, getPrice);

            expect(breakdown.contractionMrr).toBe(1000);
            expect(breakdown.expansionMrr).toBe(0);
        });

        it('should identify reactivation', () => {
            const previous = [createSubscription({ id: 'sub_1', status: 'canceled' })];
            const current = [createSubscription({ id: 'sub_1', status: 'active' })];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const breakdown = qzpayCalculateMrrBreakdown(current, previous, getPrice);

            expect(breakdown.reactivationMrr).toBe(1000);
        });
    });

    describe('qzpayCalculateMrrWithBreakdown', () => {
        it('should calculate MRR with full breakdown', () => {
            const previous = [
                createSubscription({ id: 'sub_1', status: 'active', quantity: 1 }),
                createSubscription({ id: 'sub_2', status: 'active', quantity: 1 })
            ];
            const current = [
                createSubscription({ id: 'sub_1', status: 'active', quantity: 2 }), // Expansion
                createSubscription({ id: 'sub_3', status: 'active', quantity: 1 }) // New (sub_2 churned)
            ];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const result = qzpayCalculateMrrWithBreakdown(current, previous, getPrice);

            expect(result.current).toBe(3000); // 2 + 1
            expect(result.previous).toBe(2000); // 1 + 1
            expect(result.change).toBe(1000);
            expect(result.breakdown.newMrr).toBe(1000);
            expect(result.breakdown.expansionMrr).toBe(1000);
            expect(result.breakdown.churnedMrr).toBe(1000);
        });
    });

    describe('qzpayCalculateSubscriptionMetrics', () => {
        it('should count subscriptions by status', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: 'active' }),
                createSubscription({ id: 'sub_2', status: 'active' }),
                createSubscription({ id: 'sub_3', status: 'trialing' }),
                createSubscription({ id: 'sub_4', status: 'past_due' }),
                createSubscription({ id: 'sub_5', status: 'canceled' })
            ];

            const metrics = qzpayCalculateSubscriptionMetrics(subscriptions);

            expect(metrics.active).toBe(2);
            expect(metrics.trialing).toBe(1);
            expect(metrics.pastDue).toBe(1);
            expect(metrics.canceled).toBe(1);
            expect(metrics.total).toBe(5);
        });

        it('should handle empty subscriptions', () => {
            const metrics = qzpayCalculateSubscriptionMetrics([]);

            expect(metrics.active).toBe(0);
            expect(metrics.total).toBe(0);
        });
    });

    describe('qzpayCalculateRevenueMetrics', () => {
        it('should calculate revenue for a period', () => {
            const payments = [
                createPayment({
                    id: 'pay_1',
                    amount: 1000,
                    subscriptionId: 'sub_1',
                    createdAt: new Date('2024-01-15')
                }),
                createPayment({
                    id: 'pay_2',
                    amount: 500,
                    subscriptionId: null,
                    createdAt: new Date('2024-01-20')
                }),
                createPayment({
                    id: 'pay_3',
                    amount: 2000,
                    subscriptionId: 'sub_2',
                    createdAt: new Date('2024-02-15') // Outside period
                })
            ];

            const period = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            const metrics = qzpayCalculateRevenueMetrics(payments, period);

            expect(metrics.recurring).toBe(1000);
            expect(metrics.oneTime).toBe(500);
            expect(metrics.total).toBe(1500);
            expect(metrics.net).toBe(1500);
        });

        it('should only count succeeded payments', () => {
            const payments = [
                createPayment({ id: 'pay_1', amount: 1000, status: 'succeeded' }),
                createPayment({ id: 'pay_2', amount: 500, status: 'pending' as QZPayPayment['status'] })
            ];

            const period = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            const metrics = qzpayCalculateRevenueMetrics(payments, period);

            expect(metrics.total).toBe(1000);
        });
    });

    describe('qzpayCalculateChurnMetrics', () => {
        it('should calculate churn rate', () => {
            // Both subscriptions were active at period start
            // One gets canceled during the period
            const subscriptions = [
                createSubscription({
                    id: 'sub_1',
                    status: 'active',
                    createdAt: new Date('2023-12-01')
                }),
                createSubscription({
                    id: 'sub_2',
                    status: 'active', // Still shows as active at period start
                    createdAt: new Date('2023-12-01'),
                    canceledAt: new Date('2024-01-15')
                })
            ];

            const period = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const metrics = qzpayCalculateChurnMetrics(subscriptions, getPrice, period);

            expect(metrics.count).toBe(1); // 1 canceled in period
            expect(metrics.rate).toBe(50); // 1/2 * 100 (1 churned out of 2 active at start)
            expect(metrics.revenue).toBe(1000);
        });

        it('should return 0 rate when no active subscriptions at start', () => {
            const subscriptions = [
                createSubscription({
                    id: 'sub_1',
                    status: 'canceled',
                    createdAt: new Date('2024-01-15'), // Created after period start
                    canceledAt: new Date('2024-01-20')
                })
            ];

            const period = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const metrics = qzpayCalculateChurnMetrics(subscriptions, getPrice, period);

            expect(metrics.rate).toBe(0);
        });
    });

    describe('qzpayCalculateDashboardMetrics', () => {
        it('should aggregate all metrics', () => {
            const subscriptions = [
                createSubscription({ id: 'sub_1', status: 'active' }),
                createSubscription({ id: 'sub_2', status: 'trialing' })
            ];

            const payments = [createPayment({ id: 'pay_1', amount: 1000, createdAt: new Date() })];

            const price = createPrice({ unitAmount: 1000 });
            const getPrice = () => price;

            const dashboard = qzpayCalculateDashboardMetrics(subscriptions, payments, getPrice);

            expect(dashboard.mrr).toBeDefined();
            expect(dashboard.subscriptions).toBeDefined();
            expect(dashboard.revenue).toBeDefined();
            expect(dashboard.churn).toBeDefined();

            expect(dashboard.mrr.current).toBe(2000);
            expect(dashboard.subscriptions.total).toBe(2);
        });
    });

    describe('Period Helpers', () => {
        describe('qzpayGetPreviousPeriod', () => {
            it('should return previous period of same length', () => {
                const period = {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-31')
                };

                const previous = qzpayGetPreviousPeriod(period);
                const periodDuration = period.end.getTime() - period.start.getTime();
                const previousDuration = previous.end.getTime() - previous.start.getTime();

                // Same duration
                expect(previousDuration).toBe(periodDuration);
                // Previous end should equal current start
                expect(previous.end.getTime()).toBe(period.start.getTime());
            });
        });

        describe('qzpayGetCurrentMonthPeriod', () => {
            it('should return period for current month', () => {
                const period = qzpayGetCurrentMonthPeriod();

                expect(period.start.getDate()).toBe(1);
                expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
            });
        });

        describe('qzpayGetLastNDaysPeriod', () => {
            it('should return period for last N days', () => {
                const period = qzpayGetLastNDaysPeriod(7);

                const diffMs = period.end.getTime() - period.start.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                expect(diffDays).toBeCloseTo(7, 0);
            });
        });

        describe('qzpayGetMonthPeriod', () => {
            it('should return period for specific month', () => {
                const period = qzpayGetMonthPeriod(2024, 0); // January 2024

                expect(period.start.getFullYear()).toBe(2024);
                expect(period.start.getMonth()).toBe(0);
                expect(period.start.getDate()).toBe(1);
                expect(period.end.getDate()).toBe(31);
            });
        });
    });
});
