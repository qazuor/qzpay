/**
 * Customer Helper - utilities for customer lifecycle management
 */

import type { QZPayInvoiceStatus, QZPaySubscriptionStatus } from '../constants/index.js';
import { QZPAY_INVOICE_STATUS, QZPAY_SUBSCRIPTION_STATUS } from '../constants/index.js';
import type { QZPayCustomer, QZPayInvoice, QZPayPayment, QZPaySubscription } from '../types/index.js';

/**
 * Customer lifecycle state
 */
export type QZPayCustomerLifecycleState = 'new' | 'trial' | 'active' | 'at_risk' | 'churned' | 'inactive';

/**
 * Customer health indicators
 */
export interface QZPayCustomerHealth {
    state: QZPayCustomerLifecycleState;
    hasActiveSubscription: boolean;
    hasTrialSubscription: boolean;
    hasPastDueSubscription: boolean;
    hasUnpaidInvoices: boolean;
    daysSinceCreation: number;
    subscriptionCount: number;
    totalSpent: number;
    riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Customer statistics
 */
export interface QZPayCustomerStats {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    totalSpent: number;
    averagePaymentAmount: number;
    lifetimeValue: number;
}

/**
 * Check if customer has an active subscription
 */
export function qzpayCustomerHasActiveSubscription(subscriptions: QZPaySubscription[]): boolean {
    return subscriptions.some((sub) => sub.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE && sub.deletedAt === null);
}

/**
 * Check if customer has a trial subscription
 */
export function qzpayCustomerHasTrialSubscription(subscriptions: QZPaySubscription[]): boolean {
    return subscriptions.some((sub) => sub.status === QZPAY_SUBSCRIPTION_STATUS.TRIALING && sub.deletedAt === null);
}

/**
 * Check if customer has a past due subscription
 */
export function qzpayCustomerHasPastDueSubscription(subscriptions: QZPaySubscription[]): boolean {
    return subscriptions.some((sub) => sub.status === QZPAY_SUBSCRIPTION_STATUS.PAST_DUE && sub.deletedAt === null);
}

/**
 * Check if customer has unpaid invoices
 */
export function qzpayCustomerHasUnpaidInvoices(invoices: QZPayInvoice[]): boolean {
    const unpaidStatuses: QZPayInvoiceStatus[] = [QZPAY_INVOICE_STATUS.OPEN, QZPAY_INVOICE_STATUS.UNCOLLECTIBLE];
    return invoices.some((inv) => unpaidStatuses.includes(inv.status));
}

/**
 * Get customer's active subscriptions
 */
export function qzpayGetCustomerActiveSubscriptions(subscriptions: QZPaySubscription[]): QZPaySubscription[] {
    const activeStatuses: QZPaySubscriptionStatus[] = [QZPAY_SUBSCRIPTION_STATUS.ACTIVE, QZPAY_SUBSCRIPTION_STATUS.TRIALING];
    return subscriptions.filter((sub) => activeStatuses.includes(sub.status) && sub.deletedAt === null);
}

/**
 * Get customer's churned subscriptions
 */
export function qzpayGetCustomerChurnedSubscriptions(subscriptions: QZPaySubscription[]): QZPaySubscription[] {
    return subscriptions.filter((sub) => sub.status === QZPAY_SUBSCRIPTION_STATUS.CANCELED && sub.deletedAt === null);
}

/**
 * Calculate customer total spent
 */
export function qzpayCalculateCustomerTotalSpent(payments: QZPayPayment[]): number {
    return payments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Calculate customer lifetime value (LTV)
 */
export function qzpayCalculateCustomerLTV(payments: QZPayPayment[], customer: QZPayCustomer): number {
    const totalSpent = qzpayCalculateCustomerTotalSpent(payments);
    const daysSinceCreation = Math.max(1, qzpayDaysSinceDate(customer.createdAt));
    const monthsActive = daysSinceCreation / 30;

    // Projected annual value based on average monthly spend
    if (monthsActive < 1) {
        return totalSpent * 12;
    }
    return Math.round((totalSpent / monthsActive) * 12);
}

/**
 * Determine customer lifecycle state
 */
export function qzpayGetCustomerLifecycleState(
    customer: QZPayCustomer,
    subscriptions: QZPaySubscription[],
    invoices: QZPayInvoice[]
): QZPayCustomerLifecycleState {
    const daysSinceCreation = qzpayDaysSinceDate(customer.createdAt);

    // New customer (less than 7 days, no subscriptions)
    if (daysSinceCreation < 7 && subscriptions.length === 0) {
        return 'new';
    }

    // Has trial subscription
    if (qzpayCustomerHasTrialSubscription(subscriptions)) {
        return 'trial';
    }

    // Check for at-risk customers (past due subscription or unpaid invoices with active sub)
    if (qzpayCustomerHasPastDueSubscription(subscriptions)) {
        return 'at_risk';
    }

    // Has active subscription
    if (qzpayCustomerHasActiveSubscription(subscriptions)) {
        // Check if at risk due to unpaid invoices
        if (qzpayCustomerHasUnpaidInvoices(invoices)) {
            return 'at_risk';
        }
        return 'active';
    }

    // Has churned subscriptions
    const churnedSubs = qzpayGetCustomerChurnedSubscriptions(subscriptions);
    if (churnedSubs.length > 0) {
        return 'churned';
    }

    // No subscriptions ever
    return 'inactive';
}

/**
 * Determine customer risk level
 */
export function qzpayGetCustomerRiskLevel(
    subscriptions: QZPaySubscription[],
    invoices: QZPayInvoice[],
    payments: QZPayPayment[]
): 'low' | 'medium' | 'high' {
    const failedPayments = payments.filter((p) => p.status === 'failed').length;
    const totalPayments = payments.length;
    const failureRate = totalPayments > 0 ? failedPayments / totalPayments : 0;

    // High risk: past due subscription or >30% payment failure rate
    if (qzpayCustomerHasPastDueSubscription(subscriptions) || failureRate > 0.3) {
        return 'high';
    }

    // Medium risk: unpaid invoices or >10% payment failure rate
    if (qzpayCustomerHasUnpaidInvoices(invoices) || failureRate > 0.1) {
        return 'medium';
    }

    return 'low';
}

/**
 * Get comprehensive customer health assessment
 */
export function qzpayGetCustomerHealth(
    customer: QZPayCustomer,
    subscriptions: QZPaySubscription[],
    invoices: QZPayInvoice[],
    payments: QZPayPayment[]
): QZPayCustomerHealth {
    const state = qzpayGetCustomerLifecycleState(customer, subscriptions, invoices);
    const activeSubscriptions = qzpayGetCustomerActiveSubscriptions(subscriptions);

    return {
        state,
        hasActiveSubscription: qzpayCustomerHasActiveSubscription(subscriptions),
        hasTrialSubscription: qzpayCustomerHasTrialSubscription(subscriptions),
        hasPastDueSubscription: qzpayCustomerHasPastDueSubscription(subscriptions),
        hasUnpaidInvoices: qzpayCustomerHasUnpaidInvoices(invoices),
        daysSinceCreation: qzpayDaysSinceDate(customer.createdAt),
        subscriptionCount: activeSubscriptions.length,
        totalSpent: qzpayCalculateCustomerTotalSpent(payments),
        riskLevel: qzpayGetCustomerRiskLevel(subscriptions, invoices, payments)
    };
}

/**
 * Get customer statistics
 */
export function qzpayGetCustomerStats(
    subscriptions: QZPaySubscription[],
    invoices: QZPayInvoice[],
    payments: QZPayPayment[]
): QZPayCustomerStats {
    const activeSubscriptions = qzpayGetCustomerActiveSubscriptions(subscriptions);
    const successfulPayments = payments.filter((p) => p.status === 'succeeded');
    const failedPayments = payments.filter((p) => p.status === 'failed');
    const paidInvoices = invoices.filter((i) => i.status === QZPAY_INVOICE_STATUS.PAID);
    const unpaidInvoices = invoices.filter(
        (i) => i.status === QZPAY_INVOICE_STATUS.OPEN || i.status === QZPAY_INVOICE_STATUS.UNCOLLECTIBLE
    );

    const totalSpent = qzpayCalculateCustomerTotalSpent(payments);
    const averagePaymentAmount = successfulPayments.length > 0 ? Math.round(totalSpent / successfulPayments.length) : 0;

    return {
        totalSubscriptions: subscriptions.filter((s) => s.deletedAt === null).length,
        activeSubscriptions: activeSubscriptions.length,
        totalPayments: payments.length,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        unpaidInvoices: unpaidInvoices.length,
        totalSpent,
        averagePaymentAmount,
        lifetimeValue: totalSpent // Can be enhanced with projections
    };
}

/**
 * Check if customer is eligible for upgrade offers
 */
export function qzpayIsCustomerEligibleForUpgrade(
    customer: QZPayCustomer,
    subscriptions: QZPaySubscription[],
    payments: QZPayPayment[]
): boolean {
    // Must have active subscription
    if (!qzpayCustomerHasActiveSubscription(subscriptions)) {
        return false;
    }

    // Must have been a customer for at least 30 days
    if (qzpayDaysSinceDate(customer.createdAt) < 30) {
        return false;
    }

    // Must have at least 2 successful payments
    const successfulPayments = payments.filter((p) => p.status === 'succeeded');
    if (successfulPayments.length < 2) {
        return false;
    }

    // No failed payments in the last 3
    const recentPayments = payments.slice(-3);
    const hasRecentFailure = recentPayments.some((p) => p.status === 'failed');
    if (hasRecentFailure) {
        return false;
    }

    return true;
}

/**
 * Check if customer should receive retention offer
 */
export function qzpayShouldOfferRetention(subscriptions: QZPaySubscription[], invoices: QZPayInvoice[]): boolean {
    // Has subscription scheduled for cancellation
    const cancelingSubscription = subscriptions.find(
        (sub) => (sub.cancelAtPeriodEnd || sub.cancelAt !== null) && sub.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE
    );
    if (cancelingSubscription) {
        return true;
    }

    // Has past due subscription
    if (qzpayCustomerHasPastDueSubscription(subscriptions)) {
        return true;
    }

    // Has multiple unpaid invoices
    const unpaidCount = invoices.filter(
        (i) => i.status === QZPAY_INVOICE_STATUS.OPEN || i.status === QZPAY_INVOICE_STATUS.UNCOLLECTIBLE
    ).length;
    if (unpaidCount >= 2) {
        return true;
    }

    return false;
}

/**
 * Helper function: days since a date
 */
function qzpayDaysSinceDate(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
