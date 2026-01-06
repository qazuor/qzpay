/**
 * Tests for payment service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayPayment, QZPayPaymentRetryConfig } from '../../src/index.js';
import {
    QZPAY_DEFAULT_RETRY_CONFIG,
    qzpayCalculateGraceEndDate,
    qzpayCalculateNextRetryDate,
    qzpayCalculateRemainingAmount,
    qzpayCreatePaymentRetryConfig,
    qzpayFormatPaymentAmount,
    qzpayGetGraceDaysRemaining,
    qzpayGetPaymentFailureReason,
    qzpayGetRetryState,
    qzpayIsFullRefund,
    qzpayIsGracePeriodExpired,
    qzpayPaymentFailed,
    qzpayPaymentIsPending,
    qzpayPaymentIsRefundable,
    qzpayPaymentSucceeded,
    qzpayPaymentWasRefunded,
    qzpayShouldSendGraceWarning,
    qzpayValidatePaymentAmount,
    qzpayValidateRefundAmount
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createPayment(overrides: Partial<QZPayPayment> = {}): QZPayPayment {
    return {
        id: 'pay_123',
        customerId: 'cus_123',
        amount: 1000,
        currency: 'USD',
        status: 'succeeded',
        paymentMethodId: 'pm_123',
        description: null,
        failureCode: null,
        failureMessage: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

// ==================== Retry Configuration Tests ====================

describe('Payment Retry Configuration', () => {
    describe('qzpayCreatePaymentRetryConfig', () => {
        it('should use default values', () => {
            const config = qzpayCreatePaymentRetryConfig();

            expect(config.maxAttempts).toBe(4);
            expect(config.gracePeriodDays).toBe(7);
            expect(config.retryIntervals).toEqual([1, 3, 5, 7]);
        });

        it('should override defaults', () => {
            const config = qzpayCreatePaymentRetryConfig({
                maxAttempts: 5,
                gracePeriodDays: 14
            });

            expect(config.maxAttempts).toBe(5);
            expect(config.gracePeriodDays).toBe(14);
        });
    });

    describe('qzpayCalculateNextRetryDate', () => {
        it('should calculate next retry date', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const nextRetry = qzpayCalculateNextRetryDate(firstFailure, 0, QZPAY_DEFAULT_RETRY_CONFIG);

            expect(nextRetry).toBeTruthy();
            const expectedDate = new Date('2024-01-02T00:00:00Z'); // +1 day
            expect(nextRetry?.toISOString()).toBe(expectedDate.toISOString());
        });

        it('should return null after max attempts', () => {
            const firstFailure = new Date();
            const nextRetry = qzpayCalculateNextRetryDate(firstFailure, 4, QZPAY_DEFAULT_RETRY_CONFIG);

            expect(nextRetry).toBeNull();
        });

        it('should use correct interval for attempt', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const config: QZPayPaymentRetryConfig = {
                ...QZPAY_DEFAULT_RETRY_CONFIG,
                retryIntervals: [2, 4, 8]
            };

            const retry1 = qzpayCalculateNextRetryDate(firstFailure, 0, config);
            const retry2 = qzpayCalculateNextRetryDate(firstFailure, 1, config);

            expect(retry1?.toISOString()).toBe(new Date('2024-01-03T00:00:00Z').toISOString());
            expect(retry2?.toISOString()).toBe(new Date('2024-01-05T00:00:00Z').toISOString());
        });
    });
});

// ==================== Grace Period Tests ====================

describe('Grace Period Management', () => {
    describe('qzpayCalculateGraceEndDate', () => {
        it('should calculate grace end date', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const graceEnd = qzpayCalculateGraceEndDate(firstFailure, 7);

            expect(graceEnd.toISOString()).toBe(new Date('2024-01-08T00:00:00Z').toISOString());
        });
    });

    describe('qzpayIsGracePeriodExpired', () => {
        it('should return false during grace period', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-05T00:00:00Z');

            expect(qzpayIsGracePeriodExpired(firstFailure, 7, now)).toBe(false);
        });

        it('should return true after grace period', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-10T00:00:00Z');

            expect(qzpayIsGracePeriodExpired(firstFailure, 7, now)).toBe(true);
        });
    });

    describe('qzpayGetGraceDaysRemaining', () => {
        it('should calculate remaining days', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-05T00:00:00Z');

            const remaining = qzpayGetGraceDaysRemaining(firstFailure, 7, now);
            expect(remaining).toBe(3);
        });

        it('should return 0 after grace period', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-10T00:00:00Z');

            const remaining = qzpayGetGraceDaysRemaining(firstFailure, 7, now);
            expect(remaining).toBe(0);
        });
    });

    describe('qzpayShouldSendGraceWarning', () => {
        it('should send warning at configured days', () => {
            const config = QZPAY_DEFAULT_RETRY_CONFIG;

            expect(qzpayShouldSendGraceWarning(2, config, [])).toBe(true);
            expect(qzpayShouldSendGraceWarning(1, config, [])).toBe(true);
        });

        it('should not resend already sent warnings', () => {
            const config = QZPAY_DEFAULT_RETRY_CONFIG;

            expect(qzpayShouldSendGraceWarning(2, config, [2])).toBe(false);
        });

        it('should not send at non-configured days', () => {
            const config = QZPAY_DEFAULT_RETRY_CONFIG;

            expect(qzpayShouldSendGraceWarning(5, config, [])).toBe(false);
        });
    });
});

// ==================== Retry State Tests ====================

describe('Retry State Management', () => {
    describe('qzpayGetRetryState', () => {
        it('should return null for no failed payments', () => {
            const payments = [createPayment({ status: 'succeeded' })];
            const state = qzpayGetRetryState(payments);

            expect(state).toBeNull();
        });

        it('should calculate retry state for failed payments', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const payments = [
                createPayment({ status: 'failed', createdAt: firstFailure }),
                createPayment({ status: 'failed', createdAt: new Date('2024-01-02T00:00:00Z') })
            ];

            const state = qzpayGetRetryState(payments, QZPAY_DEFAULT_RETRY_CONFIG, new Date('2024-01-03T00:00:00Z'));

            expect(state).toBeTruthy();
            expect(state?.attemptNumber).toBe(2);
            expect(state?.firstFailureAt).toEqual(firstFailure);
            expect(state?.maxRetriesReached).toBe(false);
        });

        it('should detect max retries reached', () => {
            const payments = Array(4)
                .fill(null)
                .map((_, i) => createPayment({ status: 'failed', createdAt: new Date(Date.now() + i * 1000) }));

            const state = qzpayGetRetryState(payments);

            expect(state?.maxRetriesReached).toBe(true);
        });

        it('should calculate grace period status', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const payments = [createPayment({ status: 'failed', createdAt: firstFailure })];

            const duringGrace = qzpayGetRetryState(payments, QZPAY_DEFAULT_RETRY_CONFIG, new Date('2024-01-05T00:00:00Z'));
            expect(duringGrace?.graceExpired).toBe(false);
            expect(duringGrace?.graceDaysRemaining).toBe(3);

            const afterGrace = qzpayGetRetryState(payments, QZPAY_DEFAULT_RETRY_CONFIG, new Date('2024-01-10T00:00:00Z'));
            expect(afterGrace?.graceExpired).toBe(true);
            expect(afterGrace?.graceDaysRemaining).toBe(0);
        });
    });
});

// ==================== Payment Status Tests ====================

describe('Payment Status Helpers', () => {
    describe('qzpayPaymentSucceeded', () => {
        it('should return true for succeeded payment', () => {
            const payment = createPayment({ status: 'succeeded' });
            expect(qzpayPaymentSucceeded(payment)).toBe(true);
        });

        it('should return false for other statuses', () => {
            expect(qzpayPaymentSucceeded(createPayment({ status: 'failed' }))).toBe(false);
            expect(qzpayPaymentSucceeded(createPayment({ status: 'pending' }))).toBe(false);
        });
    });

    describe('qzpayPaymentFailed', () => {
        it('should return true for failed payment', () => {
            const payment = createPayment({ status: 'failed' });
            expect(qzpayPaymentFailed(payment)).toBe(true);
        });
    });

    describe('qzpayPaymentIsPending', () => {
        it('should return true for pending payment', () => {
            const payment = createPayment({ status: 'pending' });
            expect(qzpayPaymentIsPending(payment)).toBe(true);
        });
    });

    describe('qzpayPaymentIsRefundable', () => {
        it('should return true for succeeded payment', () => {
            const payment = createPayment({ status: 'succeeded' });
            expect(qzpayPaymentIsRefundable(payment)).toBe(true);
        });

        it('should return false for failed payment', () => {
            const payment = createPayment({ status: 'failed' });
            expect(qzpayPaymentIsRefundable(payment)).toBe(false);
        });
    });

    describe('qzpayPaymentWasRefunded', () => {
        it('should return true for refunded payment', () => {
            const payment = createPayment({ status: 'refunded' });
            expect(qzpayPaymentWasRefunded(payment)).toBe(true);
        });

        it('should return true for partially refunded payment', () => {
            const payment = createPayment({ status: 'partially_refunded' });
            expect(qzpayPaymentWasRefunded(payment)).toBe(true);
        });

        it('should return false for succeeded payment', () => {
            const payment = createPayment({ status: 'succeeded' });
            expect(qzpayPaymentWasRefunded(payment)).toBe(false);
        });
    });

    describe('qzpayGetPaymentFailureReason', () => {
        it('should return failure message if available', () => {
            const payment = createPayment({
                status: 'failed',
                failureMessage: 'Insufficient funds'
            });

            expect(qzpayGetPaymentFailureReason(payment)).toBe('Insufficient funds');
        });

        it('should return failure code if no message', () => {
            const payment = createPayment({
                status: 'failed',
                failureCode: 'card_declined'
            });

            expect(qzpayGetPaymentFailureReason(payment)).toBe('card_declined');
        });

        it('should return null for succeeded payment', () => {
            const payment = createPayment({ status: 'succeeded' });
            expect(qzpayGetPaymentFailureReason(payment)).toBeNull();
        });
    });
});

// ==================== Refund Tests ====================

describe('Refund Helpers', () => {
    describe('qzpayIsFullRefund', () => {
        it('should return true for full refund', () => {
            const payment = createPayment({ amount: 1000 });
            expect(qzpayIsFullRefund(payment, 1000)).toBe(true);
        });

        it('should return true for over-refund', () => {
            const payment = createPayment({ amount: 1000 });
            expect(qzpayIsFullRefund(payment, 1500)).toBe(true);
        });

        it('should return false for partial refund', () => {
            const payment = createPayment({ amount: 1000 });
            expect(qzpayIsFullRefund(payment, 500)).toBe(false);
        });
    });

    describe('qzpayCalculateRemainingAmount', () => {
        it('should calculate remaining amount', () => {
            const payment = createPayment({ amount: 1000 });
            expect(qzpayCalculateRemainingAmount(payment, 300)).toBe(700);
        });

        it('should not go below zero', () => {
            const payment = createPayment({ amount: 1000 });
            expect(qzpayCalculateRemainingAmount(payment, 1500)).toBe(0);
        });
    });
});

// ==================== Formatting Tests ====================

describe('Payment Formatting', () => {
    describe('qzpayFormatPaymentAmount', () => {
        it('should format amount correctly', () => {
            const payment = createPayment({ amount: 1000, currency: 'USD' });
            const formatted = qzpayFormatPaymentAmount(payment);

            expect(formatted).toContain('10');
            expect(formatted).toContain('$');
        });

        it('should handle different currencies', () => {
            const payment = createPayment({ amount: 1000, currency: 'EUR' });
            const formatted = qzpayFormatPaymentAmount(payment);

            expect(formatted).toContain('10');
            expect(formatted).toContain('€');
        });
    });
});

// ==================== Validation Tests ====================

describe('Payment Validation', () => {
    describe('qzpayValidatePaymentAmount', () => {
        it('should validate correct amount', () => {
            const result = qzpayValidatePaymentAmount(1000);

            expect(result.valid).toBe(true);
        });

        it('should reject non-number', () => {
            const result = qzpayValidatePaymentAmount('1000' as unknown as number);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Amount must be a valid number');
        });

        it('should reject zero amount', () => {
            const result = qzpayValidatePaymentAmount(0);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Amount must be greater than zero');
        });

        it('should reject negative amount', () => {
            const result = qzpayValidatePaymentAmount(-100);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Amount must be greater than zero');
        });

        it('should reject non-integer', () => {
            const result = qzpayValidatePaymentAmount(10.5);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Amount must be an integer (in cents)');
        });

        it('should reject amount exceeding max', () => {
            const result = qzpayValidatePaymentAmount(100000000);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Amount exceeds maximum allowed value');
        });
    });

    describe('qzpayValidateRefundAmount', () => {
        it('should validate correct refund amount', () => {
            const payment = createPayment({ amount: 1000 });
            const result = qzpayValidateRefundAmount(payment, 500);

            expect(result.valid).toBe(true);
        });

        it('should reject refund exceeding payment amount', () => {
            const payment = createPayment({ amount: 1000 });
            const result = qzpayValidateRefundAmount(payment, 1500);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Refund amount cannot exceed original payment amount');
        });

        it('should validate full refund', () => {
            const payment = createPayment({ amount: 1000 });
            const result = qzpayValidateRefundAmount(payment, 1000);

            expect(result.valid).toBe(true);
        });
    });
});
