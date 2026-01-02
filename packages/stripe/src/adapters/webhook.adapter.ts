import type { QZPayPaymentWebhookAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
/**
 * Stripe Webhook Adapter
 *
 * Implements QZPayPaymentWebhookAdapter for Stripe webhooks
 */
import type Stripe from 'stripe';

export class QZPayStripeWebhookAdapter implements QZPayPaymentWebhookAdapter {
    constructor(
        private readonly stripe: Stripe,
        private readonly webhookSecret: string
    ) {}

    /**
     * Construct and verify a webhook event from Stripe
     */
    constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent {
        const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

        return {
            id: event.id,
            type: event.type,
            data: event.data.object,
            created: new Date(event.created * 1000)
        };
    }

    /**
     * Verify webhook signature
     */
    verifySignature(payload: string | Buffer, signature: string): boolean {
        try {
            this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Map Stripe webhook event type to QZPay billing event
 */
export function mapStripeEventToQZPayEvent(stripeEventType: string): string | null {
    const eventMap: Record<string, string> = {
        // Customer events
        'customer.created': 'customer.created',
        'customer.updated': 'customer.updated',
        'customer.deleted': 'customer.deleted',

        // Subscription events
        'customer.subscription.created': 'subscription.created',
        'customer.subscription.updated': 'subscription.updated',
        'customer.subscription.deleted': 'subscription.canceled',
        'customer.subscription.paused': 'subscription.paused',
        'customer.subscription.resumed': 'subscription.resumed',
        'customer.subscription.trial_will_end': 'subscription.trial_ending',

        // Invoice events
        'invoice.created': 'invoice.created',
        'invoice.finalized': 'invoice.finalized',
        'invoice.paid': 'invoice.paid',
        'invoice.payment_failed': 'invoice.payment_failed',
        'invoice.payment_action_required': 'invoice.payment_action_required',
        'invoice.voided': 'invoice.voided',

        // Payment events
        'payment_intent.succeeded': 'payment.succeeded',
        'payment_intent.payment_failed': 'payment.failed',
        'payment_intent.canceled': 'payment.canceled',
        'payment_intent.requires_action': 'payment.requires_action',

        // Refund events
        'charge.refunded': 'refund.created',
        'charge.refund.updated': 'refund.updated',

        // Checkout events
        'checkout.session.completed': 'checkout.completed',
        'checkout.session.expired': 'checkout.expired',
        'checkout.session.async_payment_succeeded': 'checkout.async_payment_succeeded',
        'checkout.session.async_payment_failed': 'checkout.async_payment_failed',

        // Payment method events
        'payment_method.attached': 'payment_method.attached',
        'payment_method.detached': 'payment_method.detached',
        'payment_method.updated': 'payment_method.updated',

        // Connect/Marketplace events
        'account.updated': 'vendor.updated',
        'payout.paid': 'payout.paid',
        'payout.failed': 'payout.failed'
    };

    return eventMap[stripeEventType] ?? null;
}

/**
 * Extract relevant data from Stripe webhook event
 */
export function extractStripeEventData(event: QZPayWebhookEvent): {
    entityType: string;
    entityId: string;
    customerId?: string;
    subscriptionId?: string;
    invoiceId?: string;
    paymentIntentId?: string;
} {
    const data = event.data as Record<string, unknown>;
    const eventType = event.type;

    // Determine entity type from event
    const entityType = eventType.split('.')[0] ?? 'unknown';
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const entityId = (data['id'] as string) ?? '';

    const result: {
        entityType: string;
        entityId: string;
        customerId?: string;
        subscriptionId?: string;
        invoiceId?: string;
        paymentIntentId?: string;
    } = {
        entityType,
        entityId
    };

    // Extract customer ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const customer = data['customer'];
    if (customer) {
        result.customerId = typeof customer === 'string' ? customer : (customer as { id: string })?.id;
    }

    // Extract subscription ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const subscription = data['subscription'];
    if (subscription) {
        result.subscriptionId = typeof subscription === 'string' ? subscription : (subscription as { id: string })?.id;
    }

    // Extract invoice ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const invoice = data['invoice'];
    if (invoice) {
        result.invoiceId = typeof invoice === 'string' ? invoice : (invoice as { id: string })?.id;
    }

    // Extract payment intent ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const paymentIntent = data['payment_intent'];
    if (paymentIntent) {
        result.paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent as { id: string })?.id;
    }

    return result;
}
