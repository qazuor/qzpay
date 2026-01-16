/**
 * Subscription Lifecycle Service
 *
 * Orchestrates subscription renewals, trial conversions, and payment retries.
 * Designed to be called from a cron job or background worker.
 */

import type { QZPayStorageAdapter } from '../adapters/storage.adapter.js';
import type { QZPayBilling } from '../billing.js';
import { QZPAY_SUBSCRIPTION_STATUS } from '../constants/index.js';
import { qzpayCalculateNextBillingDate, qzpayGetOverdueSubscriptions, qzpayIsSubscriptionPastDue } from '../helpers/subscription.helper.js';
import type { QZPayPrice, QZPaySubscription } from '../types/index.js';

/**
 * Configuration for the subscription lifecycle service
 */
export interface SubscriptionLifecycleConfig {
    /**
     * Grace period before canceling due to failed payment (in days)
     */
    gracePeriodDays: number;

    /**
     * Days between payment retries
     * Example: [1, 3, 5] means retry after 1 day, then 3 days, then 5 days
     */
    retryIntervals: number[];

    /**
     * Days before trial end to attempt conversion
     * Use 0 to convert immediately when trial ends
     */
    trialConversionDays: number;

    /**
     * Callback to process actual payment
     * Implement this to call your payment provider
     */
    processPayment: (input: ProcessPaymentInput) => Promise<ProcessPaymentResult>;

    /**
     * Callback to get saved payment method for customer
     * Returns null if customer has no default payment method
     */
    getDefaultPaymentMethod: (customerId: string) => Promise<SavedPaymentMethod | null>;

    /**
     * Optional: callback when lifecycle events occur
     * Use this for logging, analytics, or sending notifications
     */
    onEvent?: (event: LifecycleEvent) => void | Promise<void>;
}

/**
 * Input for processing a payment
 */
export interface ProcessPaymentInput {
    customerId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    metadata: {
        subscriptionId: string;
        type: 'renewal' | 'trial_conversion' | 'retry';
    };
}

/**
 * Result of processing a payment
 */
export interface ProcessPaymentResult {
    success: boolean;
    paymentId?: string;
    error?: string;
}

/**
 * Saved payment method information
 */
export interface SavedPaymentMethod {
    id: string;
    providerPaymentMethodId: string;
}

/**
 * Lifecycle event emitted during processing
 */
export interface LifecycleEvent {
    type:
        | 'subscription.renewed'
        | 'subscription.renewal_failed'
        | 'subscription.trial_converted'
        | 'subscription.trial_conversion_failed'
        | 'subscription.entered_grace_period'
        | 'subscription.canceled_nonpayment'
        | 'subscription.retry_scheduled'
        | 'subscription.retry_succeeded'
        | 'subscription.retry_failed';
    subscriptionId: string;
    customerId: string;
    data: Record<string, unknown>;
    timestamp: Date;
}

/**
 * Result of processing renewals
 */
export interface RenewalResult {
    processed: number;
    succeeded: number;
    failed: number;
    details: Array<{ subscriptionId: string; success: boolean; error?: string }>;
}

/**
 * Result of processing trial conversions
 */
export interface TrialConversionResult {
    processed: number;
    succeeded: number;
    failed: number;
    details: Array<{ subscriptionId: string; success: boolean; error?: string }>;
}

/**
 * Result of processing retries
 */
export interface RetryResult {
    processed: number;
    succeeded: number;
    failed: number;
    details: Array<{ subscriptionId: string; success: boolean; error?: string }>;
}

/**
 * Result of processing cancellations
 */
export interface CancellationResult {
    processed: number;
    details: Array<{ subscriptionId: string; reason: string }>;
}

/**
 * Result of processing all lifecycle operations
 */
export interface ProcessAllResult {
    renewals: RenewalResult;
    trialConversions: TrialConversionResult;
    retries: RetryResult;
    cancellations: CancellationResult;
}

/**
 * Subscription lifecycle service interface
 */
export interface SubscriptionLifecycleService {
    /**
     * Process all subscriptions that need attention
     * Call this from your cron job
     */
    processAll(currentTime?: Date): Promise<ProcessAllResult>;

    /**
     * Process only renewals
     */
    processRenewals(currentTime?: Date): Promise<RenewalResult>;

    /**
     * Process only trial conversions
     */
    processTrialConversions(currentTime?: Date): Promise<TrialConversionResult>;

    /**
     * Process only payment retries
     */
    processRetries(currentTime?: Date): Promise<RetryResult>;

    /**
     * Cancel subscriptions that exceeded grace period
     */
    processCancellations(currentTime?: Date): Promise<CancellationResult>;
}

/**
 * Internal implementation of the subscription lifecycle service
 */
class SubscriptionLifecycleServiceImpl implements SubscriptionLifecycleService {
    constructor(
        private readonly billing: QZPayBilling,
        private readonly storage: QZPayStorageAdapter,
        private readonly config: SubscriptionLifecycleConfig
    ) {}

    /**
     * Emit a lifecycle event
     */
    private async emitEvent(event: LifecycleEvent): Promise<void> {
        if (this.config.onEvent) {
            await this.config.onEvent(event);
        }
    }

    /**
     * Get the price for a subscription
     */
    private async getSubscriptionPrice(subscription: QZPaySubscription): Promise<QZPayPrice | null> {
        const prices = await this.storage.prices.findByPlanId(subscription.planId);
        if (prices.length === 0) {
            return null;
        }

        // Find matching price by interval
        const matchingPrice = prices.find(
            (p) => p.billingInterval === subscription.interval && p.intervalCount === subscription.intervalCount
        );

        return matchingPrice ?? prices[0] ?? null;
    }

    /**
     * Calculate the amount to charge for a subscription
     */
    private calculateSubscriptionAmount(subscription: QZPaySubscription, price: QZPayPrice): number {
        return price.unitAmount * subscription.quantity;
    }

    /**
     * Get the default payment method for a customer
     *
     * @throws Error if no payment method is found
     */
    private async getCustomerPaymentMethod(customerId: string): Promise<SavedPaymentMethod> {
        const paymentMethod = await this.config.getDefaultPaymentMethod(customerId);
        if (!paymentMethod) {
            throw new Error('No default payment method found');
        }
        return paymentMethod;
    }

    /**
     * Get price and calculate amount for a subscription
     *
     * @throws Error if no price is found
     */
    private async getPriceAndCalculateAmount(subscription: QZPaySubscription): Promise<{ price: QZPayPrice; amount: number }> {
        const price = await this.getSubscriptionPrice(subscription);
        if (!price) {
            throw new Error('No price found for subscription plan');
        }
        const amount = this.calculateSubscriptionAmount(subscription, price);
        return { price, amount };
    }

    /**
     * Execute payment for a subscription
     */
    private async executePayment(input: {
        subscription: QZPaySubscription;
        amount: number;
        currency: string;
        paymentMethodId: string;
        paymentType: 'renewal' | 'trial_conversion' | 'retry';
    }): Promise<ProcessPaymentResult> {
        return await this.config.processPayment({
            customerId: input.subscription.customerId,
            amount: input.amount,
            currency: input.currency,
            paymentMethodId: input.paymentMethodId,
            metadata: {
                subscriptionId: input.subscription.id,
                type: input.paymentType
            }
        });
    }

    /**
     * Create invoice for subscription payment
     */
    private async createSubscriptionInvoice(input: {
        subscription: QZPaySubscription;
        price: QZPayPrice;
        description: string;
        paymentId?: string;
        metadata: Record<string, unknown>;
    }): Promise<void> {
        await this.billing.invoices.create({
            customerId: input.subscription.customerId,
            subscriptionId: input.subscription.id,
            lines: [
                {
                    description: input.description,
                    quantity: input.subscription.quantity,
                    unitAmount: input.price.unitAmount,
                    priceId: input.price.id
                }
            ],
            metadata: {
                ...input.metadata,
                paymentId: input.paymentId ?? null
            }
        });
    }

    /**
     * Update subscription to active status after successful payment
     */
    private async updateSubscriptionToActive(input: {
        subscription: QZPaySubscription;
        newPeriodStart: Date;
        newPeriodEnd: Date;
        paymentId?: string;
        additionalMetadata?: Record<string, unknown>;
    }): Promise<void> {
        await this.storage.subscriptions.update(input.subscription.id, {
            currentPeriodStart: input.newPeriodStart,
            currentPeriodEnd: input.newPeriodEnd,
            status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
            metadata: {
                ...input.subscription.metadata,
                ...input.additionalMetadata,
                lastPaymentId: input.paymentId ?? null
            }
        });
    }

    /**
     * Update subscription to past_due and enter grace period
     */
    private async enterGracePeriod(input: {
        subscription: QZPaySubscription;
        error: string;
        now: Date;
    }): Promise<void> {
        await this.storage.subscriptions.update(input.subscription.id, {
            status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE,
            metadata: {
                ...input.subscription.metadata,
                gracePeriodStartedAt: input.now.toISOString(),
                lastRenewalAttempt: input.now.toISOString(),
                renewalError: input.error,
                retryCount: 0
            }
        });
    }

    /**
     * Update subscription after successful retry recovery
     */
    private async updateSubscriptionAfterRetryRecovery(input: {
        subscription: QZPaySubscription;
        newPeriodStart: Date;
        newPeriodEnd: Date;
        paymentId?: string;
        now: Date;
    }): Promise<void> {
        await this.storage.subscriptions.update(input.subscription.id, {
            status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
            currentPeriodStart: input.newPeriodStart,
            currentPeriodEnd: input.newPeriodEnd,
            metadata: {
                ...input.subscription.metadata,
                gracePeriodStartedAt: undefined,
                retryCount: undefined,
                lastRetryAt: undefined,
                renewalError: undefined,
                recoveredAt: input.now.toISOString(),
                recoveryPaymentId: input.paymentId
            }
        });
    }

    /**
     * Process all lifecycle operations
     */
    async processAll(currentTime?: Date): Promise<ProcessAllResult> {
        const [renewals, trialConversions, retries, cancellations] = await Promise.all([
            this.processRenewals(currentTime),
            this.processTrialConversions(currentTime),
            this.processRetries(currentTime),
            this.processCancellations(currentTime)
        ]);

        return {
            renewals,
            trialConversions,
            retries,
            cancellations
        };
    }

    /**
     * Process subscription renewals
     */
    async processRenewals(currentTime?: Date): Promise<RenewalResult> {
        const now = currentTime ?? new Date();
        const result: RenewalResult = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            details: []
        };

        const subscriptionsToRenew = await this.getSubscriptionsToRenew();

        for (const subscription of subscriptionsToRenew) {
            result.processed++;

            try {
                await this.processSuccessfulRenewal(subscription, now);
                result.succeeded++;
                result.details.push({ subscriptionId: subscription.id, success: true });
            } catch (error) {
                await this.processFailedRenewal(subscription, error, now, result);
            }
        }

        return result;
    }

    /**
     * Get subscriptions that need renewal
     */
    private async getSubscriptionsToRenew(): Promise<QZPaySubscription[]> {
        const allSubscriptions = await this.storage.subscriptions.list({ limit: 10000 });
        return qzpayGetOverdueSubscriptions(allSubscriptions.data).filter(
            (sub) => sub.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE && !sub.cancelAtPeriodEnd
        );
    }

    /**
     * Process a successful renewal
     */
    private async processSuccessfulRenewal(subscription: QZPaySubscription, now: Date): Promise<void> {
        const paymentMethod = await this.getCustomerPaymentMethod(subscription.customerId);
        const { price, amount } = await this.getPriceAndCalculateAmount(subscription);

        const paymentResult = await this.executePayment({
            subscription,
            amount,
            currency: price.currency,
            paymentMethodId: paymentMethod.providerPaymentMethodId,
            paymentType: 'renewal'
        });

        if (!paymentResult.success) {
            throw new Error(paymentResult.error ?? 'Payment failed');
        }

        const newPeriodStart = subscription.currentPeriodEnd;
        const newPeriodEnd = qzpayCalculateNextBillingDate(newPeriodStart, subscription.interval, subscription.intervalCount);

        await this.updateSubscriptionToActive({
            subscription,
            newPeriodStart,
            newPeriodEnd,
            ...(paymentResult.paymentId && { paymentId: paymentResult.paymentId }),
            additionalMetadata: { lastRenewalAt: now.toISOString() }
        });

        await this.createSubscriptionInvoice({
            subscription,
            price,
            description: `Subscription renewal - ${subscription.planId}`,
            ...(paymentResult.paymentId && { paymentId: paymentResult.paymentId }),
            metadata: { renewalDate: now.toISOString() }
        });

        await this.emitEvent({
            type: 'subscription.renewed',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: {
                amount,
                currency: price.currency,
                paymentId: paymentResult.paymentId,
                newPeriodEnd: newPeriodEnd.toISOString()
            },
            timestamp: now
        });
    }

    /**
     * Process a failed renewal
     */
    private async processFailedRenewal(subscription: QZPaySubscription, error: unknown, now: Date, result: RenewalResult): Promise<void> {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.details.push({ subscriptionId: subscription.id, success: false, error: errorMessage });

        await this.enterGracePeriod({ subscription, error: errorMessage, now });

        await this.emitEvent({
            type: 'subscription.renewal_failed',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: { error: errorMessage },
            timestamp: now
        });

        await this.emitEvent({
            type: 'subscription.entered_grace_period',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: { gracePeriodDays: this.config.gracePeriodDays },
            timestamp: now
        });
    }

    /**
     * Process trial conversions
     */
    async processTrialConversions(currentTime?: Date): Promise<TrialConversionResult> {
        const now = currentTime ?? new Date();
        const result: TrialConversionResult = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            details: []
        };

        const subscriptionsToConvert = await this.getSubscriptionsToConvert(now);

        for (const subscription of subscriptionsToConvert) {
            result.processed++;

            try {
                await this.processSuccessfulTrialConversion(subscription, now);
                result.succeeded++;
                result.details.push({ subscriptionId: subscription.id, success: true });
            } catch (error) {
                await this.processFailedTrialConversion(subscription, error, now, result);
            }
        }

        return result;
    }

    /**
     * Get subscriptions ready for trial conversion
     */
    private async getSubscriptionsToConvert(now: Date): Promise<QZPaySubscription[]> {
        const allSubscriptions = await this.storage.subscriptions.list({ limit: 10000 });
        return allSubscriptions.data.filter((sub) => {
            if (sub.status !== QZPAY_SUBSCRIPTION_STATUS.TRIALING || !sub.trialEnd) {
                return false;
            }
            const msUntilEnd = sub.trialEnd.getTime() - now.getTime();
            const daysUntilEnd = msUntilEnd / (1000 * 60 * 60 * 24);
            return daysUntilEnd <= this.config.trialConversionDays;
        });
    }

    /**
     * Process a successful trial conversion
     */
    private async processSuccessfulTrialConversion(subscription: QZPaySubscription, now: Date): Promise<void> {
        const paymentMethod = await this.getCustomerPaymentMethod(subscription.customerId);
        const { price, amount } = await this.getPriceAndCalculateAmount(subscription);

        const paymentResult = await this.executePayment({
            subscription,
            amount,
            currency: price.currency,
            paymentMethodId: paymentMethod.providerPaymentMethodId,
            paymentType: 'trial_conversion'
        });

        if (!paymentResult.success) {
            throw new Error(paymentResult.error ?? 'Payment failed');
        }

        const newPeriodStart = now;
        const newPeriodEnd = qzpayCalculateNextBillingDate(newPeriodStart, subscription.interval, subscription.intervalCount);

        await this.storage.subscriptions.update(subscription.id, {
            status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
            metadata: {
                ...subscription.metadata,
                trialConvertedAt: now.toISOString(),
                firstPaymentId: paymentResult.paymentId
            }
        });

        await this.createSubscriptionInvoice({
            subscription,
            price,
            description: `Trial conversion - ${subscription.planId}`,
            ...(paymentResult.paymentId && { paymentId: paymentResult.paymentId }),
            metadata: { trialConversionDate: now.toISOString() }
        });

        await this.emitEvent({
            type: 'subscription.trial_converted',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: {
                amount,
                currency: price.currency,
                paymentId: paymentResult.paymentId,
                newPeriodEnd: newPeriodEnd.toISOString()
            },
            timestamp: now
        });
    }

    /**
     * Process a failed trial conversion
     */
    private async processFailedTrialConversion(
        subscription: QZPaySubscription,
        error: unknown,
        now: Date,
        result: TrialConversionResult
    ): Promise<void> {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.details.push({ subscriptionId: subscription.id, success: false, error: errorMessage });

        await this.storage.subscriptions.update(subscription.id, {
            status: QZPAY_SUBSCRIPTION_STATUS.CANCELED,
            canceledAt: now,
            metadata: {
                ...subscription.metadata,
                trialConversionError: errorMessage,
                cancelReason: 'Trial conversion payment failed'
            }
        });

        await this.emitEvent({
            type: 'subscription.trial_conversion_failed',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: { error: errorMessage },
            timestamp: now
        });
    }

    /**
     * Process payment retries
     */
    async processRetries(currentTime?: Date): Promise<RetryResult> {
        const now = currentTime ?? new Date();
        const result: RetryResult = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            details: []
        };

        const subscriptionsToRetry = await this.getSubscriptionsToRetry(now);

        for (const subscription of subscriptionsToRetry) {
            result.processed++;

            try {
                await this.processSuccessfulRetry(subscription, now);
                result.succeeded++;
                result.details.push({ subscriptionId: subscription.id, success: true });
            } catch (error) {
                await this.processFailedRetry(subscription, error, now, result);
            }
        }

        return result;
    }

    /**
     * Get subscriptions ready for payment retry
     */
    private async getSubscriptionsToRetry(now: Date): Promise<QZPaySubscription[]> {
        const allSubscriptions = await this.storage.subscriptions.list({ limit: 10000 });
        const pastDueSubscriptions = allSubscriptions.data.filter((sub) => qzpayIsSubscriptionPastDue(sub));

        return pastDueSubscriptions.filter((subscription) => {
            const metadata = this.getRetryMetadata(subscription);
            if (!metadata.gracePeriodStartedAt || !metadata.lastRetryAt) {
                return false;
            }

            const retryInterval = this.config.retryIntervals[metadata.retryCount];
            if (!retryInterval) {
                return false;
            }

            const nextRetryDate = new Date(metadata.lastRetryAt);
            nextRetryDate.setDate(nextRetryDate.getDate() + retryInterval);

            return now >= nextRetryDate;
        });
    }

    /**
     * Extract retry metadata from subscription
     */
    private getRetryMetadata(subscription: QZPaySubscription): {
        gracePeriodStartedAt: Date | null;
        retryCount: number;
        lastRetryAt: Date | null;
    } {
        const metadata = subscription.metadata as {
            gracePeriodStartedAt?: string;
            retryCount?: number;
            lastRetryAt?: string;
        };

        const gracePeriodStartedAt = metadata.gracePeriodStartedAt ? new Date(metadata.gracePeriodStartedAt) : null;
        const retryCount = metadata.retryCount ?? 0;
        const lastRetryAt = metadata.lastRetryAt ? new Date(metadata.lastRetryAt) : gracePeriodStartedAt;

        return { gracePeriodStartedAt, retryCount, lastRetryAt };
    }

    /**
     * Process a successful payment retry
     */
    private async processSuccessfulRetry(subscription: QZPaySubscription, now: Date): Promise<void> {
        const paymentMethod = await this.getCustomerPaymentMethod(subscription.customerId);
        const { price, amount } = await this.getPriceAndCalculateAmount(subscription);
        const retryCount = this.getRetryMetadata(subscription).retryCount;

        const paymentResult = await this.executePayment({
            subscription,
            amount,
            currency: price.currency,
            paymentMethodId: paymentMethod.providerPaymentMethodId,
            paymentType: 'retry'
        });

        if (!paymentResult.success) {
            throw new Error(paymentResult.error ?? 'Payment failed');
        }

        const newPeriodStart = subscription.currentPeriodEnd;
        const newPeriodEnd = qzpayCalculateNextBillingDate(newPeriodStart, subscription.interval, subscription.intervalCount);

        await this.updateSubscriptionAfterRetryRecovery({
            subscription,
            newPeriodStart,
            newPeriodEnd,
            ...(paymentResult.paymentId && { paymentId: paymentResult.paymentId }),
            now
        });

        await this.createSubscriptionInvoice({
            subscription,
            price,
            description: `Payment retry - ${subscription.planId}`,
            ...(paymentResult.paymentId && { paymentId: paymentResult.paymentId }),
            metadata: {
                retryDate: now.toISOString(),
                retryAttempt: retryCount + 1
            }
        });

        await this.emitEvent({
            type: 'subscription.retry_succeeded',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: {
                amount,
                currency: price.currency,
                paymentId: paymentResult.paymentId,
                retryAttempt: retryCount + 1
            },
            timestamp: now
        });
    }

    /**
     * Process a failed payment retry
     */
    private async processFailedRetry(subscription: QZPaySubscription, error: unknown, now: Date, result: RetryResult): Promise<void> {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.details.push({ subscriptionId: subscription.id, success: false, error: errorMessage });

        const retryCount = this.getRetryMetadata(subscription).retryCount;
        const newRetryCount = retryCount + 1;
        const hasMoreRetries = newRetryCount < this.config.retryIntervals.length;

        await this.storage.subscriptions.update(subscription.id, {
            metadata: {
                ...subscription.metadata,
                retryCount: newRetryCount,
                lastRetryAt: now.toISOString(),
                lastRetryError: errorMessage
            }
        });

        if (hasMoreRetries) {
            await this.emitEvent({
                type: 'subscription.retry_scheduled',
                subscriptionId: subscription.id,
                customerId: subscription.customerId,
                data: {
                    retryAttempt: newRetryCount,
                    nextRetryInterval: this.config.retryIntervals[newRetryCount],
                    error: errorMessage
                },
                timestamp: now
            });
        } else {
            await this.emitEvent({
                type: 'subscription.retry_failed',
                subscriptionId: subscription.id,
                customerId: subscription.customerId,
                data: {
                    retryAttempt: newRetryCount,
                    error: errorMessage,
                    maxRetriesReached: true
                },
                timestamp: now
            });
        }
    }

    /**
     * Cancel subscriptions that exceeded grace period
     */
    async processCancellations(currentTime?: Date): Promise<CancellationResult> {
        const now = currentTime ?? new Date();
        const result: CancellationResult = {
            processed: 0,
            details: []
        };

        // Get all past_due subscriptions
        const allSubscriptions = await this.storage.subscriptions.list({ limit: 10000 });
        const pastDueSubscriptions = allSubscriptions.data.filter((sub) => qzpayIsSubscriptionPastDue(sub));

        for (const subscription of pastDueSubscriptions) {
            const metadata = subscription.metadata as {
                gracePeriodStartedAt?: string;
                retryCount?: number;
            };

            const gracePeriodStartedAt = metadata.gracePeriodStartedAt ? new Date(metadata.gracePeriodStartedAt) : null;
            const retryCount = metadata.retryCount ?? 0;

            if (!gracePeriodStartedAt) {
                continue;
            }

            // Check if grace period has expired
            const gracePeriodEndDate = new Date(gracePeriodStartedAt);
            gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + this.config.gracePeriodDays);

            const hasMoreRetries = retryCount < this.config.retryIntervals.length;

            // Only cancel if grace period expired AND no more retries
            if (now >= gracePeriodEndDate && !hasMoreRetries) {
                result.processed++;

                await this.storage.subscriptions.update(subscription.id, {
                    status: QZPAY_SUBSCRIPTION_STATUS.CANCELED,
                    canceledAt: now,
                    metadata: {
                        ...subscription.metadata,
                        cancelReason: 'Payment failed - grace period expired',
                        gracePeriodEndedAt: now.toISOString()
                    }
                });

                result.details.push({
                    subscriptionId: subscription.id,
                    reason: 'Payment failed - grace period expired'
                });

                await this.emitEvent({
                    type: 'subscription.canceled_nonpayment',
                    subscriptionId: subscription.id,
                    customerId: subscription.customerId,
                    data: {
                        gracePeriodDays: this.config.gracePeriodDays,
                        gracePeriodStartedAt: gracePeriodStartedAt.toISOString(),
                        gracePeriodEndedAt: now.toISOString()
                    },
                    timestamp: now
                });
            }
        }

        return result;
    }
}

/**
 * Create a subscription lifecycle service
 *
 * @param billing - QZPayBilling instance
 * @param storage - QZPayStorageAdapter instance
 * @param config - Configuration for the lifecycle service
 * @returns SubscriptionLifecycleService instance
 *
 * @example
 * ```typescript
 * const lifecycle = createSubscriptionLifecycle(billing, storage, {
 *   gracePeriodDays: 7,
 *   retryIntervals: [1, 3, 5],
 *   trialConversionDays: 0,
 *   processPayment: async (input) => {
 *     const result = await stripe.paymentIntents.create({
 *       amount: input.amount,
 *       currency: input.currency,
 *       customer: providerCustomerId,
 *       payment_method: input.paymentMethodId,
 *       confirm: true,
 *     });
 *     return {
 *       success: result.status === 'succeeded',
 *       paymentId: result.id,
 *     };
 *   },
 *   getDefaultPaymentMethod: async (customerId) => {
 *     const pm = await db.paymentMethods.findDefault(customerId);
 *     return pm ? { id: pm.id, providerPaymentMethodId: pm.stripePaymentMethodId } : null;
 *   },
 * });
 *
 * // In your cron job
 * const results = await lifecycle.processAll();
 * ```
 */
export function createSubscriptionLifecycle(
    billing: QZPayBilling,
    storage: QZPayStorageAdapter,
    config: SubscriptionLifecycleConfig
): SubscriptionLifecycleService {
    return new SubscriptionLifecycleServiceImpl(billing, storage, config);
}
