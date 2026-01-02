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
 */
import type Stripe from 'stripe';

export class QZPayStripeSubscriptionAdapter implements QZPayPaymentSubscriptionAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a subscription in Stripe
     */
    async create(
        providerCustomerId: string,
        input: QZPayCreateSubscriptionInput,
        providerPriceId: string
    ): Promise<QZPayProviderSubscription> {
        const params: Stripe.SubscriptionCreateParams = {
            customer: providerCustomerId,
            items: [{ price: providerPriceId, quantity: input.quantity ?? 1 }],
            metadata: input.metadata ? this.toStripeMetadata(input.metadata) : {}
        };

        // Handle trial period
        if (input.trialDays !== undefined && input.trialDays > 0) {
            params.trial_period_days = input.trialDays;
        }

        const subscription = await this.stripe.subscriptions.create(params);

        return this.mapSubscription(subscription);
    }

    /**
     * Update a subscription in Stripe
     */
    async update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription> {
        const params: Stripe.SubscriptionUpdateParams = {};

        if (input.metadata !== undefined) {
            params.metadata = this.toStripeMetadata(input.metadata);
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
            const currentItem = subscription.items.data[0];

            if (currentItem) {
                params.items = [
                    {
                        id: currentItem.id,
                        price: input.planId, // planId maps to priceId in Stripe
                        quantity: input.quantity ?? currentItem.quantity ?? 1
                    }
                ];
            }
        }

        const subscription = await this.stripe.subscriptions.update(providerSubscriptionId, params);

        return this.mapSubscription(subscription);
    }

    /**
     * Cancel a subscription in Stripe
     */
    async cancel(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
        if (cancelAtPeriodEnd) {
            await this.stripe.subscriptions.update(providerSubscriptionId, {
                cancel_at_period_end: true
            });
        } else {
            await this.stripe.subscriptions.cancel(providerSubscriptionId);
        }
    }

    /**
     * Pause a subscription in Stripe
     * Note: Stripe uses "pause_collection" to pause billing
     */
    async pause(providerSubscriptionId: string): Promise<void> {
        await this.stripe.subscriptions.update(providerSubscriptionId, {
            pause_collection: {
                behavior: 'void'
            }
        });
    }

    /**
     * Resume a paused subscription in Stripe
     */
    async resume(providerSubscriptionId: string): Promise<void> {
        await this.stripe.subscriptions.update(providerSubscriptionId, {
            pause_collection: ''
        });
    }

    /**
     * Retrieve a subscription from Stripe
     */
    async retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription> {
        const subscription = await this.stripe.subscriptions.retrieve(providerSubscriptionId);

        return this.mapSubscription(subscription);
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

    /**
     * Convert metadata to Stripe-compatible format
     */
    private toStripeMetadata(metadata: Record<string, unknown>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }
}
