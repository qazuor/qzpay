/**
 * Metrics types for QZPay
 */
import type { QZPayCurrency } from '../constants/index.js';

export interface QZPayMetrics {
    mrr: QZPayMrrMetrics;
    subscriptions: QZPaySubscriptionMetrics;
    revenue: QZPayRevenueMetrics;
    churn: QZPayChurnMetrics;
}

export interface QZPayMrrMetrics {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
    currency: QZPayCurrency;
    breakdown: QZPayMrrBreakdown;
}

export interface QZPayMrrBreakdown {
    newMrr: number;
    expansionMrr: number;
    contractionMrr: number;
    churnedMrr: number;
    reactivationMrr: number;
}

export interface QZPaySubscriptionMetrics {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    total: number;
}

export interface QZPayRevenueMetrics {
    total: number;
    recurring: number;
    oneTime: number;
    refunded: number;
    net: number;
    currency: QZPayCurrency;
    period: QZPayMetricsPeriod;
}

export interface QZPayChurnMetrics {
    rate: number;
    count: number;
    revenue: number;
    currency: QZPayCurrency;
    period: QZPayMetricsPeriod;
}

export interface QZPayMetricsPeriod {
    start: Date;
    end: Date;
}

export interface QZPayMetricsQuery {
    startDate: Date;
    endDate: Date;
    currency?: QZPayCurrency;
    granularity?: 'day' | 'week' | 'month';
}
