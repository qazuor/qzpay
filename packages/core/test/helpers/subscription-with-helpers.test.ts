/**
 * Tests for Subscription with Helper Methods
 */
import { describe, expect, it } from 'vitest';
import { QZPAY_BILLING_INTERVAL, QZPAY_SUBSCRIPTION_STATUS } from '../../src/constants/index.js';
import {
    type QZPaySubscriptionWithHelpers,
    qzpayCreateSubscriptionWithHelpers,
    qzpayEnsureSubscriptionHelpers,
    qzpayIsSubscriptionWithHelpers
} from '../../src/helpers/subscription-with-helpers.js';
import type { QZPaySubscription } from '../../src/types/subscription.types.js';

/**
 * Create a mock subscription for testing
 */
function createMockSubscription(overrides: Partial<QZPaySubscription> = {}): QZPaySubscription {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
        id: 'sub_test_123',
        customerId: 'cus_test_456',
        planId: 'plan_test_789',
        status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
        quantity: 1,
        currentPeriodStart: now,
        currentPeriodEnd: thirtyDaysFromNow,
        cancelAt: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
        metadata: {},
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        providerSubscriptionIds: {},
        billingInterval: QZPAY_BILLING_INTERVAL.MONTH,
        ...overrides
    };
}

describe('Subscription With Helpers', () => {
    describe('qzpayCreateSubscriptionWithHelpers', () => {
        it('should create a subscription with helper methods', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers).toBeDefined();
            expect(typeof withHelpers.hasAccess).toBe('function');
            expect(typeof withHelpers.isActive).toBe('function');
            expect(typeof withHelpers.isTrial).toBe('function');
            expect(typeof withHelpers.isPastDue).toBe('function');
            expect(typeof withHelpers.isCanceled).toBe('function');
            expect(typeof withHelpers.isPaused).toBe('function');
            expect(typeof withHelpers.isInGracePeriod).toBe('function');
            expect(typeof withHelpers.willCancel).toBe('function');
            expect(typeof withHelpers.daysUntilRenewal).toBe('function');
            expect(typeof withHelpers.daysUntilTrialEnd).toBe('function');
            expect(typeof withHelpers.daysRemaining).toBe('function');
            expect(typeof withHelpers.daysRemainingInGrace).toBe('function');
            expect(typeof withHelpers.hasPaymentMethod).toBe('function');
            expect(typeof withHelpers.getEntitlements).toBe('function');
            expect(typeof withHelpers.getLimits).toBe('function');
            expect(typeof withHelpers.setEntitlements).toBe('function');
            expect(typeof withHelpers.setLimits).toBe('function');
            expect(typeof withHelpers.toPlainObject).toBe('function');
        });

        it('should preserve original subscription properties', () => {
            const subscription = createMockSubscription({
                id: 'sub_preserve_123',
                customerId: 'cus_preserve_456',
                metadata: { key: 'value' }
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.id).toBe('sub_preserve_123');
            expect(withHelpers.customerId).toBe('cus_preserve_456');
            expect(withHelpers.metadata).toEqual({ key: 'value' });
        });
    });

    describe('hasAccess', () => {
        it('should return true for active subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasAccess()).toBe(true);
        });

        it('should return true for trialing subscription', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                trialStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                trialEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasAccess()).toBe(true);
        });

        it('should return true for past_due within grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 7 });

            expect(withHelpers.hasAccess()).toBe(true);
        });

        it('should return false for past_due outside grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 7 });

            expect(withHelpers.hasAccess()).toBe(false);
        });

        it('should return false for canceled subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasAccess()).toBe(false);
        });

        it('should return false for paused subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAUSED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasAccess()).toBe(false);
        });
    });

    describe('isActive', () => {
        it('should return true for active subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isActive()).toBe(true);
        });

        it('should return false for deleted subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                deletedAt: new Date()
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isActive()).toBe(false);
        });

        it('should return false for non-active status', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isActive()).toBe(false);
        });
    });

    describe('isTrial', () => {
        it('should return true for subscription in trial', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                trialStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                trialEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isTrial()).toBe(true);
        });

        it('should return false for subscription not in trial', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isTrial()).toBe(false);
        });
    });

    describe('isPastDue', () => {
        it('should return true for past_due subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isPastDue()).toBe(true);
        });

        it('should return false for active subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isPastDue()).toBe(false);
        });
    });

    describe('isCanceled', () => {
        it('should return true for canceled subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isCanceled()).toBe(true);
        });

        it('should return false for active subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isCanceled()).toBe(false);
        });
    });

    describe('isPaused', () => {
        it('should return true for paused subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAUSED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isPaused()).toBe(true);
        });

        it('should return false for active subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isPaused()).toBe(false);
        });
    });

    describe('isInGracePeriod', () => {
        it('should return true when past_due and within grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 7 });

            expect(withHelpers.isInGracePeriod()).toBe(true);
        });

        it('should return false when past_due but outside grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 7 });

            expect(withHelpers.isInGracePeriod()).toBe(false);
        });

        it('should return false when not past_due', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.isInGracePeriod()).toBe(false);
        });
    });

    describe('willCancel', () => {
        it('should return true for subscription scheduled to cancel at period end', () => {
            const subscription = createMockSubscription({
                cancelAtPeriodEnd: true
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.willCancel()).toBe(true);
        });

        it('should return false for subscription not scheduled to cancel', () => {
            const subscription = createMockSubscription({
                cancelAtPeriodEnd: false
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.willCancel()).toBe(false);
        });
    });

    describe('daysUntilRenewal', () => {
        it('should return days until renewal', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                currentPeriodEnd: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            const days = withHelpers.daysUntilRenewal();
            expect(days).toBeGreaterThanOrEqual(14);
            expect(days).toBeLessThanOrEqual(16);
        });

        it('should return null for canceled subscription', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.daysUntilRenewal()).toBeNull();
        });
    });

    describe('daysUntilTrialEnd', () => {
        it('should return days until trial ends', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                trialStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                trialEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            const days = withHelpers.daysUntilTrialEnd();
            expect(days).toBeGreaterThanOrEqual(6);
            expect(days).toBeLessThanOrEqual(8);
        });

        it('should return null when not in trial', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.daysUntilTrialEnd()).toBeNull();
        });
    });

    describe('daysRemaining', () => {
        it('should return days remaining in current period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                currentPeriodEnd: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000) // 20 days from now
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            const days = withHelpers.daysRemaining();
            expect(days).toBeGreaterThanOrEqual(19);
            expect(days).toBeLessThanOrEqual(21);
        });
    });

    describe('daysRemainingInGrace', () => {
        it('should return days remaining in grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 7 });

            const days = withHelpers.daysRemainingInGrace();
            expect(days).toBeGreaterThanOrEqual(3);
            expect(days).toBeLessThanOrEqual(5);
        });

        it('should return null when not in grace period', () => {
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.daysRemainingInGrace()).toBeNull();
        });
    });

    describe('hasPaymentMethod', () => {
        it('should return true when provider subscription IDs exist', () => {
            const subscription = createMockSubscription({
                providerSubscriptionIds: { stripe: 'sub_stripe_123' }
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasPaymentMethod()).toBe(true);
        });

        it('should return false when no provider subscription IDs', () => {
            const subscription = createMockSubscription({
                providerSubscriptionIds: {}
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.hasPaymentMethod()).toBe(false);
        });
    });

    describe('entitlements and limits', () => {
        it('should manage entitlements', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.getEntitlements()).toEqual([]);

            const entitlements = [
                {
                    id: 'ent_1',
                    customerId: 'cus_test_456',
                    entitlementKey: 'feature_a',
                    source: 'subscription' as const,
                    sourceId: 'sub_test_123',
                    grantedAt: new Date(),
                    expiresAt: null,
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            withHelpers.setEntitlements(entitlements);

            expect(withHelpers.getEntitlements()).toHaveLength(1);
            expect(withHelpers.getEntitlements()[0].entitlementKey).toBe('feature_a');
        });

        it('should manage limits', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(withHelpers.getLimits()).toEqual([]);

            const limits = [
                {
                    id: 'lim_1',
                    customerId: 'cus_test_456',
                    limitKey: 'api_calls',
                    currentValue: 50,
                    maxValue: 1000,
                    resetPeriod: 'monthly' as const,
                    lastResetAt: new Date(),
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            withHelpers.setLimits(limits);

            expect(withHelpers.getLimits()).toHaveLength(1);
            expect(withHelpers.getLimits()[0].limitKey).toBe('api_calls');
        });

        it('should return copies of entitlements and limits', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            const entitlements = [
                {
                    id: 'ent_1',
                    customerId: 'cus_test_456',
                    entitlementKey: 'feature_a',
                    source: 'subscription' as const,
                    sourceId: 'sub_test_123',
                    grantedAt: new Date(),
                    expiresAt: null,
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            withHelpers.setEntitlements(entitlements);

            const retrieved = withHelpers.getEntitlements();
            retrieved.push({
                id: 'ent_2',
                customerId: 'cus_test_456',
                entitlementKey: 'feature_b',
                source: 'manual' as const,
                sourceId: null,
                grantedAt: new Date(),
                expiresAt: null,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Original should not be modified
            expect(withHelpers.getEntitlements()).toHaveLength(1);
        });
    });

    describe('toPlainObject', () => {
        it('should return plain subscription without helper methods', () => {
            const subscription = createMockSubscription({
                id: 'sub_plain_123',
                metadata: { test: true }
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);
            const plain = withHelpers.toPlainObject();

            expect(plain.id).toBe('sub_plain_123');
            expect(plain.metadata).toEqual({ test: true });
            expect((plain as unknown as QZPaySubscriptionWithHelpers).hasAccess).toBeUndefined();
            expect((plain as unknown as QZPaySubscriptionWithHelpers).isActive).toBeUndefined();
        });
    });

    describe('qzpayIsSubscriptionWithHelpers', () => {
        it('should return true for subscription with helpers', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            expect(qzpayIsSubscriptionWithHelpers(withHelpers)).toBe(true);
        });

        it('should return false for plain subscription', () => {
            const subscription = createMockSubscription();

            expect(qzpayIsSubscriptionWithHelpers(subscription)).toBe(false);
        });

        it('should return false for null', () => {
            expect(qzpayIsSubscriptionWithHelpers(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(qzpayIsSubscriptionWithHelpers(undefined)).toBe(false);
        });
    });

    describe('qzpayEnsureSubscriptionHelpers', () => {
        it('should return same object if already has helpers', () => {
            const subscription = createMockSubscription();
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);
            const ensured = qzpayEnsureSubscriptionHelpers(withHelpers);

            expect(ensured).toBe(withHelpers);
        });

        it('should wrap plain subscription with helpers', () => {
            const subscription = createMockSubscription();
            const ensured = qzpayEnsureSubscriptionHelpers(subscription);

            expect(qzpayIsSubscriptionWithHelpers(ensured)).toBe(true);
            expect(typeof ensured.hasAccess).toBe('function');
        });
    });

    describe('grace period configuration', () => {
        it('should use default grace period of 7 days', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription);

            // Default is 7 days, so 5 days ago should be in grace
            expect(withHelpers.isInGracePeriod()).toBe(true);
        });

        it('should use custom grace period', () => {
            const now = new Date();
            const subscription = createMockSubscription({
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                currentPeriodEnd: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            });
            const withHelpers = qzpayCreateSubscriptionWithHelpers(subscription, { gracePeriodDays: 3 });

            // Custom is 3 days, so 5 days ago should NOT be in grace
            expect(withHelpers.isInGracePeriod()).toBe(false);
        });
    });
});
