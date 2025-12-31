/**
 * Subscription test fixtures
 */
import type { QZPaySubscription, QZPaySubscriptionItem } from '../../src/types/subscription.types.js';

/**
 * Sample subscription item
 */
export const sampleSubscriptionItem: QZPaySubscriptionItem = {
    id: 'si_test_123',
    priceId: 'price_monthly_usd',
    quantity: 1
};

/**
 * Sample active subscription
 */
export const activeSubscription: QZPaySubscription = {
    id: 'sub_test_active',
    customerId: 'cus_test_123',
    planId: 'starter',
    status: 'active',
    currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2024-02-01T00:00:00Z'),
    items: [sampleSubscriptionItem],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
};

/**
 * Sample trialing subscription
 */
export const trialingSubscription: QZPaySubscription = {
    id: 'sub_test_trial',
    customerId: 'cus_test_123',
    planId: 'pro',
    status: 'trialing',
    currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2024-01-15T00:00:00Z'),
    trialStart: new Date('2024-01-01T00:00:00Z'),
    trialEnd: new Date('2024-01-15T00:00:00Z'),
    items: [sampleSubscriptionItem],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
};

/**
 * Sample canceled subscription
 */
export const canceledSubscription: QZPaySubscription = {
    id: 'sub_test_canceled',
    customerId: 'cus_test_123',
    planId: 'starter',
    status: 'canceled',
    currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2024-02-01T00:00:00Z'),
    canceledAt: new Date('2024-01-15T00:00:00Z'),
    cancelAt: new Date('2024-02-01T00:00:00Z'),
    items: [sampleSubscriptionItem],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z')
};

/**
 * Sample past due subscription
 */
export const pastDueSubscription: QZPaySubscription = {
    id: 'sub_test_past_due',
    customerId: 'cus_test_123',
    planId: 'starter',
    status: 'past_due',
    currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2024-02-01T00:00:00Z'),
    items: [sampleSubscriptionItem],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-02-02T00:00:00Z')
};

/**
 * Sample paused subscription
 */
export const pausedSubscription: QZPaySubscription = {
    id: 'sub_test_paused',
    customerId: 'cus_test_123',
    planId: 'starter',
    status: 'paused',
    currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2024-02-01T00:00:00Z'),
    pausedAt: new Date('2024-01-15T00:00:00Z'),
    items: [sampleSubscriptionItem],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z')
};

/**
 * All subscription fixtures by status
 */
export const subscriptionsByStatus = {
    active: activeSubscription,
    trialing: trialingSubscription,
    canceled: canceledSubscription,
    past_due: pastDueSubscription,
    paused: pausedSubscription
};

/**
 * Create a subscription with custom overrides
 */
export function createSubscriptionFixture(overrides?: Partial<QZPaySubscription>): QZPaySubscription {
    return {
        ...activeSubscription,
        id: `sub_test_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

/**
 * Create a subscription item with custom overrides
 */
export function createSubscriptionItemFixture(overrides?: Partial<QZPaySubscriptionItem>): QZPaySubscriptionItem {
    return {
        ...sampleSubscriptionItem,
        id: `si_test_${Date.now()}`,
        ...overrides
    };
}
