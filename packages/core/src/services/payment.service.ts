/**
 * Payment Service Helpers
 *
 * Business logic for payment processing, retry logic, and grace period management.
 */
import type { QZPayPayment } from '../types/payment.types.js';
import type { QZPaySubscription } from '../types/subscription.types.js';

/**
 * Payment retry configuration
 */
export interface QZPayPaymentRetryConfig {
    /** Days after initial failure to retry (e.g., [1, 3, 5, 7]) */
    retryIntervals: number[];
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Days customer retains access after first failure */
    gracePeriodDays: number;
    /** Whether to notify on each failure */
    notifyOnEachFailure: boolean;
    /** Whether to notify before grace period expires */
    notifyBeforeGraceExpires: boolean;
    /** Days before grace expiration to notify */
    graceExpirationWarningDays: number[];
}

/**
 * Default payment retry configuration
 */
export const QZPAY_DEFAULT_RETRY_CONFIG: QZPayPaymentRetryConfig = {
    retryIntervals: [1, 3, 5, 7],
    maxAttempts: 4,
    gracePeriodDays: 7,
    notifyOnEachFailure: true,
    notifyBeforeGraceExpires: true,
    graceExpirationWarningDays: [2, 1]
};

/**
 * Payment retry state
 */
export interface QZPayPaymentRetryState {
    /** Current retry attempt (0 = first failure) */
    attemptNumber: number;
    /** Date of the first failure */
    firstFailureAt: Date;
    /** Date of the last failure */
    lastFailureAt: Date;
    /** Date of next scheduled retry */
    nextRetryAt: Date | null;
    /** Whether grace period has expired */
    graceExpired: boolean;
    /** Days remaining in grace period */
    graceDaysRemaining: number;
    /** Whether max retries have been reached */
    maxRetriesReached: boolean;
}

/**
 * Create payment retry configuration with defaults
 */
export function qzpayCreatePaymentRetryConfig(config?: Partial<QZPayPaymentRetryConfig>): QZPayPaymentRetryConfig {
    return {
        ...QZPAY_DEFAULT_RETRY_CONFIG,
        ...config
    };
}

/**
 * Calculate next retry date based on attempt number
 */
export function qzpayCalculateNextRetryDate(
    firstFailureAt: Date,
    attemptNumber: number,
    config: QZPayPaymentRetryConfig = QZPAY_DEFAULT_RETRY_CONFIG
): Date | null {
    if (attemptNumber >= config.maxAttempts) {
        return null;
    }

    const intervalIndex = Math.min(attemptNumber, config.retryIntervals.length - 1);
    const daysToAdd = config.retryIntervals[intervalIndex] ?? 1;

    const nextRetry = new Date(firstFailureAt);
    nextRetry.setDate(nextRetry.getDate() + daysToAdd);

    return nextRetry;
}

/**
 * Calculate grace period end date
 */
export function qzpayCalculateGraceEndDate(firstFailureAt: Date, gracePeriodDays: number): Date {
    const graceEnd = new Date(firstFailureAt);
    graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
    return graceEnd;
}

/**
 * Check if grace period has expired
 */
export function qzpayIsGracePeriodExpired(firstFailureAt: Date, gracePeriodDays: number, now: Date = new Date()): boolean {
    const graceEnd = qzpayCalculateGraceEndDate(firstFailureAt, gracePeriodDays);
    return now > graceEnd;
}

/**
 * Calculate days remaining in grace period
 */
export function qzpayGetGraceDaysRemaining(firstFailureAt: Date, gracePeriodDays: number, now: Date = new Date()): number {
    const graceEnd = qzpayCalculateGraceEndDate(firstFailureAt, gracePeriodDays);
    const msRemaining = graceEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

/**
 * Get payment retry state from payment history
 */
export function qzpayGetRetryState(
    payments: QZPayPayment[],
    config: QZPayPaymentRetryConfig = QZPAY_DEFAULT_RETRY_CONFIG,
    now: Date = new Date()
): QZPayPaymentRetryState | null {
    // Find failed payments sorted by date
    const failedPayments = payments.filter((p) => p.status === 'failed').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (failedPayments.length === 0) {
        return null;
    }

    const firstFailure = failedPayments[0];
    if (!firstFailure) {
        return null;
    }

    const lastFailure = failedPayments[failedPayments.length - 1];
    if (!lastFailure) {
        return null;
    }

    const attemptNumber = failedPayments.length;
    const firstFailureAt = firstFailure.createdAt;
    const lastFailureAt = lastFailure.createdAt;
    const nextRetryAt = qzpayCalculateNextRetryDate(firstFailureAt, attemptNumber, config);
    const graceExpired = qzpayIsGracePeriodExpired(firstFailureAt, config.gracePeriodDays, now);
    const graceDaysRemaining = qzpayGetGraceDaysRemaining(firstFailureAt, config.gracePeriodDays, now);
    const maxRetriesReached = attemptNumber >= config.maxAttempts;

    return {
        attemptNumber,
        firstFailureAt,
        lastFailureAt,
        nextRetryAt,
        graceExpired,
        graceDaysRemaining,
        maxRetriesReached
    };
}

/**
 * Check if subscription should have access during payment failure
 */
export function qzpayHasAccessDuringGrace(subscription: QZPaySubscription, retryState: QZPayPaymentRetryState | null): boolean {
    // Active subscriptions always have access
    if (subscription.status === 'active' || subscription.status === 'trialing') {
        return true;
    }

    // Past due subscriptions have access if grace period hasn't expired
    if (subscription.status === 'past_due' && retryState) {
        return !retryState.graceExpired;
    }

    return false;
}

/**
 * Determine if a grace warning notification should be sent
 */
export function qzpayShouldSendGraceWarning(
    graceDaysRemaining: number,
    config: QZPayPaymentRetryConfig = QZPAY_DEFAULT_RETRY_CONFIG,
    alreadySentWarnings: number[] = []
): boolean {
    if (!config.notifyBeforeGraceExpires) {
        return false;
    }

    return config.graceExpirationWarningDays.some(
        (warningDay) => graceDaysRemaining === warningDay && !alreadySentWarnings.includes(warningDay)
    );
}

/**
 * Payment amount helpers
 */

/**
 * Check if payment is a full refund
 */
export function qzpayIsFullRefund(payment: QZPayPayment, refundAmount: number): boolean {
    return refundAmount >= payment.amount;
}

/**
 * Calculate remaining amount after refund
 */
export function qzpayCalculateRemainingAmount(payment: QZPayPayment, refundAmount: number): number {
    return Math.max(0, payment.amount - refundAmount);
}

/**
 * Payment status helpers
 */

/**
 * Check if payment succeeded
 */
export function qzpayPaymentSucceeded(payment: QZPayPayment): boolean {
    return payment.status === 'succeeded';
}

/**
 * Check if payment failed
 */
export function qzpayPaymentFailed(payment: QZPayPayment): boolean {
    return payment.status === 'failed';
}

/**
 * Check if payment is pending
 */
export function qzpayPaymentIsPending(payment: QZPayPayment): boolean {
    return payment.status === 'pending';
}

/**
 * Check if payment is refundable
 */
export function qzpayPaymentIsRefundable(payment: QZPayPayment): boolean {
    return payment.status === 'succeeded';
}

/**
 * Check if payment was refunded (fully or partially)
 */
export function qzpayPaymentWasRefunded(payment: QZPayPayment): boolean {
    return payment.status === 'refunded' || payment.status === 'partially_refunded';
}

/**
 * Get payment failure reason
 */
export function qzpayGetPaymentFailureReason(payment: QZPayPayment): string | null {
    if (payment.status !== 'failed') {
        return null;
    }
    return payment.failureMessage ?? payment.failureCode ?? 'Unknown error';
}

/**
 * Format payment amount for display
 */
export function qzpayFormatPaymentAmount(payment: QZPayPayment): string {
    const amount = payment.amount / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: payment.currency
    }).format(amount);
}

/**
 * Payment validation helpers
 */

/**
 * Validate payment amount
 */
export function qzpayValidatePaymentAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
        return { valid: false, error: 'Amount must be a valid number' };
    }
    if (amount <= 0) {
        return { valid: false, error: 'Amount must be greater than zero' };
    }
    if (!Number.isInteger(amount)) {
        return { valid: false, error: 'Amount must be an integer (in cents)' };
    }
    if (amount > 99999999) {
        return { valid: false, error: 'Amount exceeds maximum allowed value' };
    }
    return { valid: true };
}

/**
 * Validate refund amount against payment
 */
export function qzpayValidateRefundAmount(payment: QZPayPayment, refundAmount: number): { valid: boolean; error?: string } {
    const amountValidation = qzpayValidatePaymentAmount(refundAmount);
    if (!amountValidation.valid) {
        return amountValidation;
    }
    if (refundAmount > payment.amount) {
        return { valid: false, error: 'Refund amount cannot exceed original payment amount' };
    }
    return { valid: true };
}
