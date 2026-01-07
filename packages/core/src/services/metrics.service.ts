/**
 * Metrics Service for QZPay
 *
 * Provides calculation functions for business metrics including MRR,
 * churn rate, revenue analysis, and subscription statistics.
 */
import type { QZPayCurrency } from '../constants/index.js';
import type {
    QZPayChurnMetrics,
    QZPayMetrics,
    QZPayMetricsPeriod,
    QZPayMetricsQuery,
    QZPayMrrBreakdown,
    QZPayMrrMetrics,
    QZPayRevenueMetrics,
    QZPaySubscriptionMetrics
} from '../types/metrics.types.js';
import type { QZPayPayment } from '../types/payment.types.js';
import type { QZPayPrice } from '../types/plan.types.js';
import type { QZPaySubscription } from '../types/subscription.types.js';

// ==================== Helper Constants ====================

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30; // Approximation for normalization

// ==================== MRR Calculation ====================

/**
 * Normalize a price to monthly amount
 * Converts any billing interval to monthly equivalent
 */
export function qzpayNormalizePriceToMonthly(unitAmount: number, interval: 'day' | 'week' | 'month' | 'year', intervalCount = 1): number {
    switch (interval) {
        case 'day':
            // Daily price × ~30 days / intervalCount
            return (unitAmount * DAYS_PER_MONTH) / intervalCount;
        case 'week':
            // Weekly price × ~4.3 weeks per month / intervalCount
            return (unitAmount * (DAYS_PER_MONTH / DAYS_PER_WEEK)) / intervalCount;
        case 'month':
            // Monthly price / intervalCount (e.g., quarterly = /3)
            return unitAmount / intervalCount;
        case 'year':
            // Yearly price / 12 / intervalCount
            return unitAmount / (MONTHS_PER_YEAR * intervalCount);
        default:
            return unitAmount;
    }
}

/**
 * Calculate MRR for a single subscription
 */
export function qzpayCalculateSubscriptionMrr(subscription: QZPaySubscription, price: QZPayPrice | null): number {
    if (!price) {
        return 0;
    }

    const normalizedMonthly = qzpayNormalizePriceToMonthly(price.unitAmount, price.billingInterval, price.intervalCount);

    return normalizedMonthly * subscription.quantity;
}

/**
 * Calculate total MRR from active subscriptions
 */
export function qzpayCalculateMrr(
    subscriptions: QZPaySubscription[],
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null,
    currency: QZPayCurrency = 'USD'
): QZPayMrrMetrics {
    const activeStatuses = ['active', 'trialing'];
    const activeSubscriptions = subscriptions.filter((s) => activeStatuses.includes(s.status));

    let currentMrr = 0;

    for (const subscription of activeSubscriptions) {
        const price = getPriceForSubscription(subscription);
        currentMrr += qzpayCalculateSubscriptionMrr(subscription, price);
    }

    // Note: previous MRR and breakdown require historical data
    // These should be calculated by comparing snapshots over time
    return {
        current: Math.round(currentMrr),
        previous: 0, // Requires historical snapshot
        change: 0,
        changePercent: 0,
        currency,
        breakdown: {
            newMrr: 0, // Requires tracking new subscriptions in period
            expansionMrr: 0, // Requires tracking upgrades
            contractionMrr: 0, // Requires tracking downgrades
            churnedMrr: 0, // Requires tracking cancellations
            reactivationMrr: 0 // Requires tracking reactivations
        }
    };
}

/**
 * Calculate MRR with breakdown (requires period comparison)
 */
export function qzpayCalculateMrrWithBreakdown(
    currentSubscriptions: QZPaySubscription[],
    previousSubscriptions: QZPaySubscription[],
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null,
    currency: QZPayCurrency = 'USD'
): QZPayMrrMetrics {
    const activeStatuses = ['active', 'trialing'];

    // Current period MRR
    const currentActive = currentSubscriptions.filter((s) => activeStatuses.includes(s.status));
    let currentMrr = 0;
    for (const sub of currentActive) {
        currentMrr += qzpayCalculateSubscriptionMrr(sub, getPriceForSubscription(sub));
    }

    // Previous period MRR
    const previousActive = previousSubscriptions.filter((s) => activeStatuses.includes(s.status));
    let previousMrr = 0;
    for (const sub of previousActive) {
        previousMrr += qzpayCalculateSubscriptionMrr(sub, getPriceForSubscription(sub));
    }

    // Calculate breakdown
    const breakdown = qzpayCalculateMrrBreakdown(currentSubscriptions, previousSubscriptions, getPriceForSubscription);

    const change = currentMrr - previousMrr;
    const changePercent = previousMrr > 0 ? (change / previousMrr) * 100 : currentMrr > 0 ? 100 : 0;

    return {
        current: Math.round(currentMrr),
        previous: Math.round(previousMrr),
        change: Math.round(change),
        changePercent: Math.round(changePercent * 100) / 100,
        currency,
        breakdown
    };
}

const ACTIVE_STATUSES = ['active', 'trialing'];

function isActiveStatus(status: string): boolean {
    return ACTIVE_STATUSES.includes(status);
}

interface MrrAccumulator {
    newMrr: number;
    expansionMrr: number;
    contractionMrr: number;
    reactivationMrr: number;
}

function processNewSubscription(current: QZPaySubscription, currentMrr: number, acc: MrrAccumulator): void {
    if (isActiveStatus(current.status)) {
        acc.newMrr += currentMrr;
    }
}

function processExistingSubscription(
    currentMrr: number,
    previousMrr: number,
    wasActive: boolean,
    isActive: boolean,
    acc: MrrAccumulator
): void {
    if (!wasActive && isActive) {
        acc.reactivationMrr += currentMrr;
        return;
    }
    if (wasActive && isActive) {
        const diff = currentMrr - previousMrr;
        if (diff > 0) {
            acc.expansionMrr += diff;
        } else if (diff < 0) {
            acc.contractionMrr += Math.abs(diff);
        }
    }
}

function calculateChurnedMrr(
    previousMap: Map<string, QZPaySubscription>,
    currentMap: Map<string, QZPaySubscription>,
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null
): number {
    let churnedMrr = 0;
    for (const [id, previous] of previousMap) {
        const wasActive = isActiveStatus(previous.status);
        if (!wasActive) continue;

        const current = currentMap.get(id);
        const stillActive = current && isActiveStatus(current.status);
        if (!stillActive) {
            churnedMrr += qzpayCalculateSubscriptionMrr(previous, getPriceForSubscription(previous));
        }
    }
    return churnedMrr;
}

/**
 * Calculate MRR breakdown components
 */
export function qzpayCalculateMrrBreakdown(
    currentSubscriptions: QZPaySubscription[],
    previousSubscriptions: QZPaySubscription[],
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null
): QZPayMrrBreakdown {
    const currentMap = new Map(currentSubscriptions.map((s) => [s.id, s]));
    const previousMap = new Map(previousSubscriptions.map((s) => [s.id, s]));

    const acc: MrrAccumulator = { newMrr: 0, expansionMrr: 0, contractionMrr: 0, reactivationMrr: 0 };

    for (const [id, current] of currentMap) {
        const currentMrr = qzpayCalculateSubscriptionMrr(current, getPriceForSubscription(current));
        const previous = previousMap.get(id);

        if (!previous) {
            processNewSubscription(current, currentMrr, acc);
        } else {
            const previousMrr = qzpayCalculateSubscriptionMrr(previous, getPriceForSubscription(previous));
            processExistingSubscription(currentMrr, previousMrr, isActiveStatus(previous.status), isActiveStatus(current.status), acc);
        }
    }

    const churnedMrr = calculateChurnedMrr(previousMap, currentMap, getPriceForSubscription);

    return {
        newMrr: Math.round(acc.newMrr),
        expansionMrr: Math.round(acc.expansionMrr),
        contractionMrr: Math.round(acc.contractionMrr),
        churnedMrr: Math.round(churnedMrr),
        reactivationMrr: Math.round(acc.reactivationMrr)
    };
}

// ==================== Subscription Metrics ====================

/**
 * Calculate subscription metrics by status
 */
export function qzpayCalculateSubscriptionMetrics(subscriptions: QZPaySubscription[]): QZPaySubscriptionMetrics {
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;

    for (const sub of subscriptions) {
        switch (sub.status) {
            case 'active':
                active++;
                break;
            case 'trialing':
                trialing++;
                break;
            case 'past_due':
                pastDue++;
                break;
            case 'canceled':
                canceled++;
                break;
            // Other statuses (unpaid, incomplete, incomplete_expired) not counted separately
        }
    }

    return {
        active,
        trialing,
        pastDue,
        canceled,
        total: subscriptions.length
    };
}

// ==================== Revenue Metrics ====================

/**
 * Calculate revenue metrics for a period
 */
export function qzpayCalculateRevenueMetrics(
    payments: QZPayPayment[],
    period: QZPayMetricsPeriod,
    currency: QZPayCurrency = 'USD'
): QZPayRevenueMetrics {
    // Filter payments in period that succeeded
    const periodPayments = payments.filter(
        (p) => p.status === 'succeeded' && p.createdAt >= period.start && p.createdAt <= period.end && p.currency === currency
    );

    let recurring = 0;
    let oneTime = 0;
    let refunded = 0;

    for (const payment of periodPayments) {
        if (payment.subscriptionId) {
            recurring += payment.amount;
        } else {
            oneTime += payment.amount;
        }
    }

    // Calculate refunds (assuming refunded payments have 'refunded' status or negative amounts)
    const refundedPayments = payments.filter(
        (p) => (p.status as string) === 'refunded' && p.createdAt >= period.start && p.createdAt <= period.end && p.currency === currency
    );

    for (const payment of refundedPayments) {
        refunded += payment.amount;
    }

    const total = recurring + oneTime;
    const net = total - refunded;

    return {
        total,
        recurring,
        oneTime,
        refunded,
        net,
        currency,
        period
    };
}

// ==================== Churn Metrics ====================

/**
 * Calculate churn metrics for a period
 */
export function qzpayCalculateChurnMetrics(
    subscriptions: QZPaySubscription[],
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null,
    period: QZPayMetricsPeriod,
    currency: QZPayCurrency = 'USD'
): QZPayChurnMetrics {
    // Count subscriptions that were active at period start
    const activeAtStart = subscriptions.filter((s) => s.createdAt <= period.start && ['active', 'trialing'].includes(s.status));

    // Count subscriptions canceled during period
    const canceledInPeriod = subscriptions.filter((s) => s.canceledAt && s.canceledAt >= period.start && s.canceledAt <= period.end);

    const churnCount = canceledInPeriod.length;

    // Calculate churned revenue
    let churnedRevenue = 0;
    for (const sub of canceledInPeriod) {
        churnedRevenue += qzpayCalculateSubscriptionMrr(sub, getPriceForSubscription(sub));
    }

    // Churn rate = (churned / active at start) * 100
    const activeCount = activeAtStart.length;
    const rate = activeCount > 0 ? (churnCount / activeCount) * 100 : 0;

    return {
        rate: Math.round(rate * 100) / 100,
        count: churnCount,
        revenue: Math.round(churnedRevenue),
        currency,
        period
    };
}

// ==================== Dashboard Aggregation ====================

/**
 * Calculate all metrics for dashboard
 */
export function qzpayCalculateDashboardMetrics(
    subscriptions: QZPaySubscription[],
    payments: QZPayPayment[],
    getPriceForSubscription: (subscription: QZPaySubscription) => QZPayPrice | null,
    query?: QZPayMetricsQuery
): QZPayMetrics {
    const now = new Date();
    const defaultQuery: QZPayMetricsQuery = query ?? {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1), // First day of month
        endDate: now,
        currency: 'USD'
    };

    const period: QZPayMetricsPeriod = {
        start: defaultQuery.startDate,
        end: defaultQuery.endDate
    };

    const currency = defaultQuery.currency ?? 'USD';

    return {
        mrr: qzpayCalculateMrr(subscriptions, getPriceForSubscription, currency),
        subscriptions: qzpayCalculateSubscriptionMetrics(subscriptions),
        revenue: qzpayCalculateRevenueMetrics(payments, period, currency),
        churn: qzpayCalculateChurnMetrics(subscriptions, getPriceForSubscription, period, currency)
    };
}

// ==================== Period Helpers ====================

/**
 * Get the previous period for comparison
 */
export function qzpayGetPreviousPeriod(period: QZPayMetricsPeriod): QZPayMetricsPeriod {
    const duration = period.end.getTime() - period.start.getTime();

    return {
        start: new Date(period.start.getTime() - duration),
        end: new Date(period.end.getTime() - duration)
    };
}

/**
 * Get a period for the current month
 */
export function qzpayGetCurrentMonthPeriod(): QZPayMetricsPeriod {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
}

/**
 * Get a period for the last N days
 */
export function qzpayGetLastNDaysPeriod(days: number): QZPayMetricsPeriod {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return { start, end: now };
}

/**
 * Get a period for a specific month
 */
export function qzpayGetMonthPeriod(year: number, month: number): QZPayMetricsPeriod {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return { start, end };
}
