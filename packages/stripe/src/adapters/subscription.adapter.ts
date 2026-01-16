import type {
    QZPayCreateSubscriptionInput,
    QZPayPaymentSubscriptionAdapter,
    QZPayProviderSubscription,
    QZPayUpdateSubscriptionInput
} from '@qazuor/qzpay-core';
/**
 * Stripe Subscription Adapter
 *
 * Implements QZPayPaymentSubscriptionAdapter for Stripe
 *
 * LIMITATION: Stripe subscriptions support multiple items, but this adapter
 * currently handles only single-item subscriptions (1 price per subscription).
 * Multi-item subscriptions will be supported in a future version.
 */
import type Stripe from 'stripe';
import { toStripeMetadata } from '../utils/metadata.utils.js';
import { type RetryConfig, withRetry } from '../utils/retry.utils.js';

export class QZPayStripeSubscriptionAdapter implements QZPayPaymentSubscriptionAdapter {
    constructor(
        private readonly stripe: Stripe,
        private readonly retryConfig?: Partial<RetryConfig>
    ) {}

    /**
     * Create a subscription in Stripe
     */
    async create(
        providerCustomerId: string,
        input: QZPayCreateSubscriptionInput,
        providerPriceId: string
    ): Promise<QZPayProviderSubscription> {
        return withRetry(
            async () => {
                const params: Stripe.SubscriptionCreateParams = {
                    customer: providerCustomerId,
                    items: [{ price: providerPriceId, quantity: input.quantity ?? 1 }],
                    metadata: input.metadata ? toStripeMetadata(input.metadata) : {}
                };

                // Handle trial period
                if (input.trialDays !== undefined && input.trialDays > 0) {
                    params.trial_period_days = input.trialDays;
                }

                const subscription = await this.stripe.subscriptions.create(params);

                return this.mapSubscription(subscription);
            },
            this.retryConfig,
            'Create subscription'
        );
    }

    /**
     * Update a subscription in Stripe
     */
    async update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription> {
        return withRetry(
            async () => {
                const params: Stripe.SubscriptionUpdateParams = {};

                if (input.metadata !== undefined) {
                    params.metadata = toStripeMetadata(input.metadata);
                }

                if (input.prorationBehavior !== undefined) {
                    params.proration_behavior = input.prorationBehavior;
                }

                if (input.cancelAt !== undefined) {
                    params.cancel_at = Math.floor(input.cancelAt.getTime() / 1000);
                }

                // Handle plan change
                if (input.planId !== undefined) {
                    const subscription = await this.stripe.subscriptions.retrieve(providerSubscriptionId);

                    // Validate that subscription has items
                    if (!subscription.items.data.length) {
                        throw new Error('Subscription has no items to update');
                    }

                    const currentItem = subscription.items.data[0];
                    if (!currentItem) {
                        throw new Error('Subscription has no items to update');
                    }

                    params.items = [
                        {
                            id: currentItem.id,
                            price: input.planId, // planId maps to priceId in Stripe
                            quantity: input.quantity ?? currentItem.quantity ?? 1
                        }
                    ];
                }

                const subscription = await this.stripe.subscriptions.update(providerSubscriptionId, params);

                return this.mapSubscription(subscription);
            },
            this.retryConfig,
            'Update subscription'
        );
    }

    /**
     * Cancel a subscription in Stripe
     */
    async cancel(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
        return withRetry(
            async () => {
                if (cancelAtPeriodEnd) {
                    await this.stripe.subscriptions.update(providerSubscriptionId, {
                        cancel_at_period_end: true
                    });
                } else {
                    await this.stripe.subscriptions.cancel(providerSubscriptionId);
                }
            },
            this.retryConfig,
            'Cancel subscription'
        );
    }

    /**
     * Pause a subscription in Stripe
     * Note: Stripe uses "pause_collection" to pause billing
     */
    async pause(providerSubscriptionId: string): Promise<void> {
        return withRetry(
            async () => {
                await this.stripe.subscriptions.update(providerSubscriptionId, {
                    pause_collection: {
                        behavior: 'void'
                    }
                });
            },
            this.retryConfig,
            'Pause subscription'
        );
    }

    /**
     * Resume a paused subscription in Stripe
     */
    async resume(providerSubscriptionId: string): Promise<void> {
        return withRetry(
            async () => {
                await this.stripe.subscriptions.update(providerSubscriptionId, {
                    pause_collection: ''
                });
            },
            this.retryConfig,
            'Resume subscription'
        );
    }

    /**
     * Retrieve a subscription from Stripe
     */
    async retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription> {
        return withRetry(
            async () => {
                const subscription = await this.stripe.subscriptions.retrieve(providerSubscriptionId);
                return this.mapSubscription(subscription);
            },
            this.retryConfig,
            'Retrieve subscription'
        );
    }

    /**
     * Map Stripe subscription to QZPay provider subscription
     */
    private mapSubscription(subscription: Stripe.Subscription): QZPayProviderSubscription {
        return {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            metadata: (subscription.metadata as Record<string, string>) ?? {}
        };
    }
}
