/**
 * Subscription with Helper Methods
 *
 * Wraps a plain QZPaySubscription object with convenient helper methods
 * as documented in the functional requirements.
 */

import { QZPAY_SUBSCRIPTION_STATUS } from '../constants/index.js';
import type { QZPayCustomerEntitlement } from '../types/entitlements.types.js';
import type { QZPayCustomerLimit } from '../types/limits.types.js';
import type { QZPaySubscription } from '../types/subscription.types.js';
import {
    qzpayGetPeriodInfo,
    qzpayGetRenewalInfo,
    qzpayGetTrialInfo,
    qzpayIsSubscriptionActive,
    qzpayIsSubscriptionCanceled,
    qzpayIsSubscriptionInTrial,
    qzpayIsSubscriptionPastDue,
    qzpayIsSubscriptionPaused,
    qzpayIsSubscriptionScheduledForCancellation
} from './subscription.helper.js';

/**
 * Grace period configuration
 */
export interface QZPayGracePeriodConfig {
    /** Number of days in grace period after payment failure */
    gracePeriodDays: number;
}

/**
 * Extended subscription with helper methods
 */
export interface QZPaySubscriptionWithHelpers extends QZPaySubscription {
    /**
     * Check if subscription grants access to the product
     * Returns true if: active, trialing, or past_due within grace period
     */
    hasAccess(): boolean;

    /**
     * Check if subscription status is 'active'
     */
    isActive(): boolean;

    /**
     * Check if subscription is in trial period
     */
    isTrial(): boolean;

    /**
     * Check if subscription is past due
     */
    isPastDue(): boolean;

    /**
     * Check if subscription is canceled
     */
    isCanceled(): boolean;

    /**
     * Check if subscription is paused
     */
    isPaused(): boolean;

    /**
     * Check if subscription is in grace period (past due but within allowed days)
     */
    isInGracePeriod(): boolean;

    /**
     * Check if subscription will be canceled (at period end or specific date)
     */
    willCancel(): boolean;

    /**
     * Get days until next renewal
     * Returns null if subscription won't renew
     */
    daysUntilRenewal(): number | null;

    /**
     * Get days until trial ends
     * Returns null if not in trial
     */
    daysUntilTrialEnd(): number | null;

    /**
     * Get days remaining in current period
     */
    daysRemaining(): number;

    /**
     * Get days remaining in grace period
     * Returns null if not in grace period
     */
    daysRemainingInGrace(): number | null;

    /**
     * Check if subscription has a payment method attached
     */
    hasPaymentMethod(): boolean;

    /**
     * Get entitlements for this subscription
     * Must be populated via setEntitlements()
     */
    getEntitlements(): QZPayCustomerEntitlement[];

    /**
     * Get limits for this subscription
     * Must be populated via setLimits()
     */
    getLimits(): QZPayCustomerLimit[];

    /**
     * Set entitlements (used internally by billing service)
     */
    setEntitlements(entitlements: QZPayCustomerEntitlement[]): void;

    /**
     * Set limits (used internally by billing service)
     */
    setLimits(limits: QZPayCustomerLimit[]): void;

    /**
     * Get the underlying plain subscription object
     */
    toPlainObject(): QZPaySubscription;
}

/**
 * Default grace period configuration
 */
const DEFAULT_GRACE_PERIOD_DAYS = 7;

/**
 * Create a subscription with helper methods
 */
export function qzpayCreateSubscriptionWithHelpers(
    subscription: QZPaySubscription,
    config?: Partial<QZPayGracePeriodConfig>
): QZPaySubscriptionWithHelpers {
    const gracePeriodDays = config?.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;

    // Internal state for entitlements and limits
    let _entitlements: QZPayCustomerEntitlement[] = [];
    let _limits: QZPayCustomerLimit[] = [];

    // Create the wrapped subscription object
    const wrapped: QZPaySubscriptionWithHelpers = {
        // Spread all original properties
        ...subscription,

        hasAccess(): boolean {
            // Active or trialing always have access
            if (qzpayIsSubscriptionActive(subscription)) {
                return true;
            }

            // Past due within grace period has access
            if (qzpayIsSubscriptionPastDue(subscription)) {
                return this.isInGracePeriod();
            }

            return false;
        },

        isActive(): boolean {
            return subscription.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE && subscription.deletedAt === null;
        },

        isTrial(): boolean {
            return qzpayIsSubscriptionInTrial(subscription);
        },

        isPastDue(): boolean {
            return qzpayIsSubscriptionPastDue(subscription);
        },

        isCanceled(): boolean {
            return qzpayIsSubscriptionCanceled(subscription);
        },

        isPaused(): boolean {
            return qzpayIsSubscriptionPaused(subscription);
        },

        isInGracePeriod(): boolean {
            if (!qzpayIsSubscriptionPastDue(subscription)) {
                return false;
            }

            // Calculate days since the current period ended
            const now = new Date();
            const periodEnd = subscription.currentPeriodEnd;
            const daysSincePeriodEnd = Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));

            return daysSincePeriodEnd <= gracePeriodDays;
        },

        willCancel(): boolean {
            return qzpayIsSubscriptionScheduledForCancellation(subscription);
        },

        daysUntilRenewal(): number | null {
            const renewalInfo = qzpayGetRenewalInfo(subscription);
            return renewalInfo.daysUntilRenewal;
        },

        daysUntilTrialEnd(): number | null {
            const trialInfo = qzpayGetTrialInfo(subscription);
            return trialInfo.daysRemaining;
        },

        daysRemaining(): number {
            const periodInfo = qzpayGetPeriodInfo(subscription);
            return periodInfo.daysRemaining;
        },

        daysRemainingInGrace(): number | null {
            if (!this.isInGracePeriod()) {
                return null;
            }

            const now = new Date();
            const periodEnd = subscription.currentPeriodEnd;
            const daysSincePeriodEnd = Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));

            return Math.max(0, gracePeriodDays - daysSincePeriodEnd);
        },

        hasPaymentMethod(): boolean {
            // Check if any provider has a payment method attached
            // This is determined by the presence of provider subscription IDs
            // as subscriptions typically require a payment method
            return Object.keys(subscription.providerSubscriptionIds).length > 0;
        },

        getEntitlements(): QZPayCustomerEntitlement[] {
            return [..._entitlements];
        },

        getLimits(): QZPayCustomerLimit[] {
            return [..._limits];
        },

        setEntitlements(entitlements: QZPayCustomerEntitlement[]): void {
            _entitlements = [...entitlements];
        },

        setLimits(limits: QZPayCustomerLimit[]): void {
            _limits = [...limits];
        },

        toPlainObject(): QZPaySubscription {
            return { ...subscription };
        }
    };

    return wrapped;
}

/**
 * Check if an object is a QZPaySubscriptionWithHelpers
 */
export function qzpayIsSubscriptionWithHelpers(obj: unknown): obj is QZPaySubscriptionWithHelpers {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        'hasAccess' in obj &&
        typeof (obj as QZPaySubscriptionWithHelpers).hasAccess === 'function'
    );
}

/**
 * Ensure a subscription has helpers attached
 * If already wrapped, returns as-is
 * If plain subscription, wraps it
 */
export function qzpayEnsureSubscriptionHelpers(
    subscription: QZPaySubscription | QZPaySubscriptionWithHelpers,
    config?: Partial<QZPayGracePeriodConfig>
): QZPaySubscriptionWithHelpers {
    if (qzpayIsSubscriptionWithHelpers(subscription)) {
        return subscription;
    }
    return qzpayCreateSubscriptionWithHelpers(subscription, config);
}
