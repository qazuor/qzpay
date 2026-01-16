import type { QZPayCreateCheckoutInput, QZPayPaymentCheckoutAdapter, QZPayProviderCheckout } from '@qazuor/qzpay-core';
/**
 * Stripe Checkout Adapter
 *
 * Implements QZPayPaymentCheckoutAdapter for Stripe Checkout Sessions
 */
import type Stripe from 'stripe';
import { toStripeMetadata } from '../utils/metadata.utils.js';

export class QZPayStripeCheckoutAdapter implements QZPayPaymentCheckoutAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a Checkout Session in Stripe
     */
    async create(input: QZPayCreateCheckoutInput, providerPriceIds: string[]): Promise<QZPayProviderCheckout> {
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = providerPriceIds.map((priceId, index) => ({
            price: priceId,
            quantity: input.lineItems[index]?.quantity ?? 1
        }));

        const params: Stripe.Checkout.SessionCreateParams = {
            line_items: lineItems,
            mode: input.mode === 'subscription' ? 'subscription' : 'payment',
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            metadata: input.metadata ? toStripeMetadata(input.metadata) : {}
        };

        // Set customer if provided
        if (input.customerId) {
            params.customer = input.customerId;
        } else if (input.customerEmail) {
            params.customer_email = input.customerEmail;
        }

        // Set expires at if provided (in minutes from now)
        if (input.expiresInMinutes !== undefined && input.expiresInMinutes > 0) {
            const expiresAt = Math.floor(Date.now() / 1000) + input.expiresInMinutes * 60;
            params.expires_at = expiresAt;
        }

        // Enable promotion codes if allowed
        if (input.allowPromoCodes) {
            params.allow_promotion_codes = true;
        }

        const session = await this.stripe.checkout.sessions.create(params);

        return this.mapSession(session);
    }

    /**
     * Retrieve a Checkout Session from Stripe
     */
    async retrieve(providerSessionId: string): Promise<QZPayProviderCheckout> {
        const session = await this.stripe.checkout.sessions.retrieve(providerSessionId, {
            expand: ['payment_intent', 'subscription']
        });

        return this.mapSession(session);
    }

    /**
     * Expire a Checkout Session in Stripe
     */
    async expire(providerSessionId: string): Promise<void> {
        await this.stripe.checkout.sessions.expire(providerSessionId);
    }

    /**
     * Map Stripe Checkout Session to QZPay provider checkout
     */
    private mapSession(session: Stripe.Checkout.Session): QZPayProviderCheckout {
        let paymentIntentId: string | null = null;
        let subscriptionId: string | null = null;

        if (session.payment_intent) {
            paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        }

        if (session.subscription) {
            subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        }

        return {
            id: session.id,
            url: session.url ?? '',
            status: session.status ?? 'open',
            paymentIntentId,
            subscriptionId,
            customerId: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
            metadata: (session.metadata as Record<string, string>) ?? {}
        };
    }
}
