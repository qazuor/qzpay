/**
 * Tests for Subscription Lifecycle Service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QZPayStorageAdapter } from '../adapters/storage.adapter.js';
import type { QZPayBilling } from '../billing.js';
import { QZPAY_SUBSCRIPTION_STATUS } from '../constants/index.js';
import type { QZPayPrice, QZPaySubscription } from '../types/index.js';
import { createSubscriptionLifecycle } from './subscription-lifecycle.service.js';
import type {
    LifecycleEvent,
    ProcessPaymentInput,
    ProcessPaymentResult,
    SubscriptionLifecycleConfig
} from './subscription-lifecycle.service.js';

describe('SubscriptionLifecycleService', () => {
    let mockBilling: QZPayBilling;
    let mockStorage: QZPayStorageAdapter;
    let mockProcessPayment: (input: ProcessPaymentInput) => Promise<ProcessPaymentResult>;
    let mockGetDefaultPaymentMethod: (customerId: string) => Promise<{ id: string; providerPaymentMethodId: string } | null>;
    let mockOnEvent: (event: LifecycleEvent) => void;
    let config: SubscriptionLifecycleConfig;

    beforeEach(() => {
        // Mock payment processing
        mockProcessPayment = vi.fn().mockResolvedValue({
            success: true,
            paymentId: 'pay_test123'
        });

        // Mock payment method retrieval
        mockGetDefaultPaymentMethod = vi.fn().mockResolvedValue({
            id: 'pm_test123',
            providerPaymentMethodId: 'pm_stripe_test123'
        });

        // Mock event handler
        mockOnEvent = vi.fn();

        // Mock billing service
        mockBilling = {
            invoices: {
                create: vi.fn().mockResolvedValue({
                    id: 'inv_test123',
                    customerId: 'cus_test123',
                    subscriptionId: 'sub_test123',
                    status: 'draft',
                    currency: 'USD',
                    subtotal: 1000,
                    tax: 0,
                    discount: 0,
                    total: 1000,
                    amountPaid: 0,
                    amountDue: 1000,
                    lines: [],
                    providerInvoiceIds: {},
                    metadata: {},
                    livemode: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            }
        } as unknown as QZPayBilling;

        // Mock storage adapter
        mockStorage = {
            subscriptions: {
                list: vi.fn().mockResolvedValue({
                    data: [],
                    total: 0,
                    limit: 10000,
                    offset: 0,
                    hasMore: false
                }),
                update: vi.fn().mockImplementation((id, input) =>
                    Promise.resolve({
                        id,
                        ...input,
                        customerId: 'cus_test123',
                        planId: 'plan_test123',
                        status: input.status ?? 'active',
                        interval: 'month',
                        intervalCount: 1,
                        quantity: 1,
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: new Date(),
                        trialStart: null,
                        trialEnd: null,
                        cancelAt: null,
                        canceledAt: null,
                        cancelAtPeriodEnd: false,
                        providerSubscriptionIds: {},
                        metadata: input.metadata ?? {},
                        livemode: false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        deletedAt: null
                    } as QZPaySubscription)
                )
            },
            prices: {
                findByPlanId: vi.fn().mockResolvedValue([
                    {
                        id: 'price_test123',
                        planId: 'plan_test123',
                        unitAmount: 1000,
                        currency: 'USD',
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        metadata: {},
                        createdAt: new Date(),
                        updatedAt: new Date()
                    } as QZPayPrice
                ])
            }
        } as unknown as QZPayStorageAdapter;

        // Default config
        config = {
            gracePeriodDays: 7,
            retryIntervals: [1, 3, 5],
            trialConversionDays: 0,
            processPayment: mockProcessPayment,
            getDefaultPaymentMethod: mockGetDefaultPaymentMethod,
            onEvent: mockOnEvent
        };
    });

    describe('processRenewals', () => {
        it('should renew subscriptions with successful payment', async () => {
            const now = new Date();
            const pastDate = new Date(now);
            pastDate.setDate(pastDate.getDate() - 1);

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: pastDate,
                trialStart: null,
                trialEnd: null,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processRenewals(now);

            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockProcessPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cus_test123',
                    amount: 1000,
                    currency: 'USD',
                    metadata: {
                        subscriptionId: 'sub_test123',
                        type: 'renewal'
                    }
                })
            );
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.renewed',
                    subscriptionId: 'sub_test123',
                    customerId: 'cus_test123'
                })
            );
        });

        it('should handle failed renewal payments', async () => {
            mockProcessPayment = vi.fn().mockResolvedValue({
                success: false,
                error: 'Card declined'
            });

            config.processPayment = mockProcessPayment;

            const now = new Date();
            const pastDate = new Date(now);
            pastDate.setDate(pastDate.getDate() - 1);

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: pastDate,
                trialStart: null,
                trialEnd: null,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processRenewals(now);

            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(0);
            expect(result.failed).toBe(1);
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.renewal_failed',
                    subscriptionId: 'sub_test123'
                })
            );
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.entered_grace_period',
                    subscriptionId: 'sub_test123'
                })
            );
        });
    });

    describe('processTrialConversions', () => {
        it('should convert trials with successful payment', async () => {
            const now = new Date();
            const pastDate = new Date(now);
            pastDate.setDate(pastDate.getDate() - 1);

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
                trialStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                trialEnd: pastDate,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processTrialConversions(now);

            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockProcessPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: {
                        subscriptionId: 'sub_test123',
                        type: 'trial_conversion'
                    }
                })
            );
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.trial_converted',
                    subscriptionId: 'sub_test123'
                })
            );
        });

        it('should cancel subscription on failed trial conversion', async () => {
            mockProcessPayment = vi.fn().mockResolvedValue({
                success: false,
                error: 'Card declined'
            });

            config.processPayment = mockProcessPayment;

            const now = new Date();
            const pastDate = new Date(now);
            pastDate.setDate(pastDate.getDate() - 1);

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.TRIALING,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
                trialStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                trialEnd: pastDate,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processTrialConversions(now);

            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(0);
            expect(result.failed).toBe(1);
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.trial_conversion_failed',
                    subscriptionId: 'sub_test123'
                })
            );
            expect(mockStorage.subscriptions.update).toHaveBeenCalledWith(
                'sub_test123',
                expect.objectContaining({
                    status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
                })
            );
        });
    });

    describe('processRetries', () => {
        it('should retry past due subscriptions', async () => {
            const now = new Date();
            const gracePeriodStart = new Date(now);
            gracePeriodStart.setDate(gracePeriodStart.getDate() - 2); // 2 days ago

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
                trialStart: null,
                trialEnd: null,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {
                    gracePeriodStartedAt: gracePeriodStart.toISOString(),
                    retryCount: 0,
                    lastRetryAt: gracePeriodStart.toISOString()
                },
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processRetries(now);

            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockProcessPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: {
                        subscriptionId: 'sub_test123',
                        type: 'retry'
                    }
                })
            );
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.retry_succeeded',
                    subscriptionId: 'sub_test123'
                })
            );
        });
    });

    describe('processCancellations', () => {
        it('should cancel subscriptions after grace period', async () => {
            const now = new Date();
            const gracePeriodStart = new Date(now);
            gracePeriodStart.setDate(gracePeriodStart.getDate() - 8); // 8 days ago (> 7 day grace period)

            const subscription: QZPaySubscription = {
                id: 'sub_test123',
                customerId: 'cus_test123',
                planId: 'plan_test123',
                status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
                interval: 'month',
                intervalCount: 1,
                quantity: 1,
                currentPeriodStart: new Date(now.getTime() - 38 * 24 * 60 * 60 * 1000),
                currentPeriodEnd: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
                trialStart: null,
                trialEnd: null,
                cancelAt: null,
                canceledAt: null,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {},
                metadata: {
                    gracePeriodStartedAt: gracePeriodStart.toISOString(),
                    retryCount: 3 // All retries exhausted
                },
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            mockStorage.subscriptions.list = vi.fn().mockResolvedValue({
                data: [subscription],
                total: 1,
                limit: 10000,
                offset: 0,
                hasMore: false
            });

            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processCancellations(now);

            expect(result.processed).toBe(1);
            expect(mockOnEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription.canceled_nonpayment',
                    subscriptionId: 'sub_test123'
                })
            );
            expect(mockStorage.subscriptions.update).toHaveBeenCalledWith(
                'sub_test123',
                expect.objectContaining({
                    status: QZPAY_SUBSCRIPTION_STATUS.CANCELED
                })
            );
        });
    });

    describe('processAll', () => {
        it('should process all lifecycle operations', async () => {
            const lifecycle = createSubscriptionLifecycle(mockBilling, mockStorage, config);
            const result = await lifecycle.processAll();

            expect(result).toHaveProperty('renewals');
            expect(result).toHaveProperty('trialConversions');
            expect(result).toHaveProperty('retries');
            expect(result).toHaveProperty('cancellations');
        });
    });
});
