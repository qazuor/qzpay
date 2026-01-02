/**
 * Subscription Helper - utilities for subscription management and renewal
 */

import type { QZPayBillingInterval, QZPaySubscriptionStatus } from '../constants/index.js';
import { QZPAY_SUBSCRIPTION_STATUS } from '../constants/index.js';
import type { QZPayPrice, QZPaySubscription } from '../types/index.js';
import { qzpayAddInterval, qzpayDaysSince, qzpayDaysUntil } from '../utils/date.utils.js';
import { qzpayCalculateProration } from '../utils/money.utils.js';

/**
 * Subscription renewal info
 */
export interface QZPaySubscriptionRenewalInfo {
    willRenew: boolean;
    renewalDate: Date | null;
    daysUntilRenewal: number | null;
    renewalAmount: number | null;
    currency: string | null;
    isCanceling: boolean;
    cancellationDate: Date | null;
}

/**
 * Subscription status details
 */
export interface QZPaySubscriptionStatusDetails {
    status: QZPaySubscriptionStatus;
    isActive: boolean;
    isTrial: boolean;
    isPastDue: boolean;
    isCanceled: boolean;
    isPaused: boolean;
    isIncomplete: boolean;
    canBeReactivated: boolean;
    requiresPayment: boolean;
}

/**
 * Trial info
 */
export interface QZPayTrialInfo {
    isInTrial: boolean;
    trialStartDate: Date | null;
    trialEndDate: Date | null;
    daysRemaining: number | null;
    daysUsed: number | null;
    totalTrialDays: number | null;
}

/**
 * Period info
 */
export interface QZPayPeriodInfo {
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    daysInPeriod: number;
    daysElapsed: number;
    daysRemaining: number;
    percentComplete: number;
}

/**
 * Proration result
 */
export interface QZPayProrationResult {
    unusedAmount: number;
    newAmount: number;
    creditAmount: number;
    chargeAmount: number;
    effectiveDate: Date;
}

/**
 * Check if subscription is in an active state
 */
export function qzpayIsSubscriptionActive(subscription: QZPaySubscription): boolean {
    const activeStatuses: QZPaySubscriptionStatus[] = [QZPAY_SUBSCRIPTION_STATUS.ACTIVE, QZPAY_SUBSCRIPTION_STATUS.TRIALING];
    return activeStatuses.includes(subscription.status) && subscription.deletedAt === null;
}

/**
 * Check if subscription is in trial
 */
export function qzpayIsSubscriptionInTrial(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.TRIALING && subscription.deletedAt === null;
}

/**
 * Check if subscription is past due
 */
export function qzpayIsSubscriptionPastDue(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.PAST_DUE && subscription.deletedAt === null;
}

/**
 * Check if subscription is canceled
 */
export function qzpayIsSubscriptionCanceled(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.CANCELED;
}

/**
 * Check if subscription is paused
 */
export function qzpayIsSubscriptionPaused(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.PAUSED && subscription.deletedAt === null;
}

/**
 * Check if subscription will renew
 */
export function qzpayWillSubscriptionRenew(subscription: QZPaySubscription): boolean {
    if (!qzpayIsSubscriptionActive(subscription)) {
        return false;
    }

    // Check if scheduled for cancellation
    if (subscription.cancelAtPeriodEnd || subscription.cancelAt !== null) {
        return false;
    }

    return true;
}

/**
 * Check if subscription is scheduled for cancellation
 */
export function qzpayIsSubscriptionScheduledForCancellation(subscription: QZPaySubscription): boolean {
    return subscription.cancelAtPeriodEnd || subscription.cancelAt !== null;
}

/**
 * Get subscription status details
 */
export function qzpayGetSubscriptionStatusDetails(subscription: QZPaySubscription): QZPaySubscriptionStatusDetails {
    const status = subscription.status;

    return {
        status,
        isActive: qzpayIsSubscriptionActive(subscription),
        isTrial: qzpayIsSubscriptionInTrial(subscription),
        isPastDue: qzpayIsSubscriptionPastDue(subscription),
        isCanceled: qzpayIsSubscriptionCanceled(subscription),
        isPaused: qzpayIsSubscriptionPaused(subscription),
        isIncomplete: status === QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE || status === QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
        canBeReactivated: status === QZPAY_SUBSCRIPTION_STATUS.CANCELED || status === QZPAY_SUBSCRIPTION_STATUS.PAUSED,
        requiresPayment:
            status === QZPAY_SUBSCRIPTION_STATUS.PAST_DUE ||
            status === QZPAY_SUBSCRIPTION_STATUS.UNPAID ||
            status === QZPAY_SUBSCRIPTION_STATUS.INCOMPLETE
    };
}

/**
 * Get trial information
 */
export function qzpayGetTrialInfo(subscription: QZPaySubscription): QZPayTrialInfo {
    if (subscription.trialStart === null || subscription.trialEnd === null) {
        return {
            isInTrial: false,
            trialStartDate: null,
            trialEndDate: null,
            daysRemaining: null,
            daysUsed: null,
            totalTrialDays: null
        };
    }

    const now = new Date();
    const isInTrial =
        subscription.status === QZPAY_SUBSCRIPTION_STATUS.TRIALING && now >= subscription.trialStart && now <= subscription.trialEnd;

    const totalTrialDays = Math.ceil((subscription.trialEnd.getTime() - subscription.trialStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysUsed = Math.max(0, qzpayDaysSince(subscription.trialStart));
    const daysRemaining = isInTrial ? Math.max(0, qzpayDaysUntil(subscription.trialEnd)) : 0;

    return {
        isInTrial,
        trialStartDate: subscription.trialStart,
        trialEndDate: subscription.trialEnd,
        daysRemaining,
        daysUsed,
        totalTrialDays
    };
}

/**
 * Get current period information
 */
export function qzpayGetPeriodInfo(subscription: QZPaySubscription): QZPayPeriodInfo {
    const { currentPeriodStart, currentPeriodEnd } = subscription;
    const now = new Date();

    const totalMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const elapsedMs = Math.max(0, now.getTime() - currentPeriodStart.getTime());
    const remainingMs = Math.max(0, currentPeriodEnd.getTime() - now.getTime());

    const daysInPeriod = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    const percentComplete = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;

    return {
        currentPeriodStart,
        currentPeriodEnd,
        daysInPeriod,
        daysElapsed,
        daysRemaining,
        percentComplete
    };
}

/**
 * Get renewal information
 */
export function qzpayGetRenewalInfo(subscription: QZPaySubscription, price?: QZPayPrice | null): QZPaySubscriptionRenewalInfo {
    const willRenew = qzpayWillSubscriptionRenew(subscription);
    const isCanceling = qzpayIsSubscriptionScheduledForCancellation(subscription);

    // Determine cancellation date
    let cancellationDate: Date | null = null;
    if (isCanceling) {
        if (subscription.cancelAt) {
            cancellationDate = subscription.cancelAt;
        } else if (subscription.cancelAtPeriodEnd) {
            cancellationDate = subscription.currentPeriodEnd;
        }
    }

    // Determine renewal date and amount
    let renewalDate: Date | null = null;
    let daysUntilRenewal: number | null = null;
    let renewalAmount: number | null = null;
    let currency: string | null = null;

    if (willRenew && qzpayIsSubscriptionActive(subscription)) {
        renewalDate = subscription.currentPeriodEnd;
        daysUntilRenewal = qzpayDaysUntil(renewalDate);

        if (price) {
            renewalAmount = price.unitAmount * subscription.quantity;
            currency = price.currency;
        }
    }

    return {
        willRenew,
        renewalDate,
        daysUntilRenewal,
        renewalAmount,
        currency,
        isCanceling,
        cancellationDate
    };
}

/**
 * Calculate next billing date
 */
export function qzpayCalculateNextBillingDate(currentPeriodEnd: Date, interval: QZPayBillingInterval, intervalCount: number): Date {
    return qzpayAddInterval(currentPeriodEnd, interval, intervalCount);
}

/**
 * Calculate proration for plan change
 */
export function qzpayCalculateSubscriptionProration(
    subscription: QZPaySubscription,
    currentPrice: QZPayPrice,
    newPrice: QZPayPrice
): QZPayProrationResult {
    const now = new Date();
    const periodInfo = qzpayGetPeriodInfo(subscription);

    // Calculate unused amount from current plan
    const currentPeriodAmount = currentPrice.unitAmount * subscription.quantity;
    const unusedAmount = qzpayCalculateProration(currentPeriodAmount, periodInfo.daysInPeriod, periodInfo.daysRemaining);

    // Calculate new amount for remaining period
    const newPeriodAmount = newPrice.unitAmount * subscription.quantity;
    const newAmount = qzpayCalculateProration(newPeriodAmount, periodInfo.daysInPeriod, periodInfo.daysRemaining);

    // Determine credit or charge
    const difference = newAmount - unusedAmount;
    const creditAmount = difference < 0 ? Math.abs(difference) : 0;
    const chargeAmount = difference > 0 ? difference : 0;

    return {
        unusedAmount,
        newAmount,
        creditAmount,
        chargeAmount,
        effectiveDate: now
    };
}

/**
 * Check if subscription can be upgraded
 */
export function qzpayCanUpgradeSubscription(subscription: QZPaySubscription): boolean {
    // Must be active and not canceling
    if (!qzpayIsSubscriptionActive(subscription)) {
        return false;
    }
    if (qzpayIsSubscriptionScheduledForCancellation(subscription)) {
        return false;
    }
    return true;
}

/**
 * Check if subscription can be downgraded
 */
export function qzpayCanDowngradeSubscription(subscription: QZPaySubscription): boolean {
    // Same conditions as upgrade for now
    return qzpayCanUpgradeSubscription(subscription);
}

/**
 * Check if subscription can be paused
 */
export function qzpayCanPauseSubscription(subscription: QZPaySubscription): boolean {
    // Must be active and not in trial
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE && subscription.deletedAt === null;
}

/**
 * Check if subscription can be resumed
 */
export function qzpayCanResumeSubscription(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.PAUSED && subscription.deletedAt === null;
}

/**
 * Check if subscription can be reactivated
 */
export function qzpayCanReactivateSubscription(subscription: QZPaySubscription): boolean {
    return subscription.status === QZPAY_SUBSCRIPTION_STATUS.CANCELED && subscription.deletedAt === null;
}

/**
 * Get subscriptions approaching renewal (within N days)
 */
export function qzpayGetSubscriptionsApproachingRenewal(subscriptions: QZPaySubscription[], daysThreshold = 7): QZPaySubscription[] {
    return subscriptions.filter((sub) => {
        if (!qzpayWillSubscriptionRenew(sub)) {
            return false;
        }
        const daysUntil = qzpayDaysUntil(sub.currentPeriodEnd);
        return daysUntil >= 0 && daysUntil <= daysThreshold;
    });
}

/**
 * Get subscriptions approaching trial end (within N days)
 */
export function qzpayGetSubscriptionsApproachingTrialEnd(subscriptions: QZPaySubscription[], daysThreshold = 3): QZPaySubscription[] {
    return subscriptions.filter((sub) => {
        if (!qzpayIsSubscriptionInTrial(sub) || sub.trialEnd === null) {
            return false;
        }
        const daysUntil = qzpayDaysUntil(sub.trialEnd);
        return daysUntil >= 0 && daysUntil <= daysThreshold;
    });
}

/**
 * Get overdue subscriptions (past current period end but still active)
 */
export function qzpayGetOverdueSubscriptions(subscriptions: QZPaySubscription[]): QZPaySubscription[] {
    const now = new Date();
    return subscriptions.filter((sub) => {
        return qzpayIsSubscriptionActive(sub) && sub.currentPeriodEnd < now;
    });
}

/**
 * Sort subscriptions by renewal date (soonest first)
 */
export function qzpaySortSubscriptionsByRenewal(subscriptions: QZPaySubscription[]): QZPaySubscription[] {
    return [...subscriptions].sort((a, b) => {
        return a.currentPeriodEnd.getTime() - b.currentPeriodEnd.getTime();
    });
}

/**
 * Group subscriptions by status
 */
export function qzpayGroupSubscriptionsByStatus(subscriptions: QZPaySubscription[]): Record<QZPaySubscriptionStatus, QZPaySubscription[]> {
    const groups: Record<string, QZPaySubscription[]> = {};

    for (const sub of subscriptions) {
        if (!groups[sub.status]) {
            groups[sub.status] = [];
        }
        (groups[sub.status] as QZPaySubscription[]).push(sub);
    }

    return groups as Record<QZPaySubscriptionStatus, QZPaySubscription[]>;
}
