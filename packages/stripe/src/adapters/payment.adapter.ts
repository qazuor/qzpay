import type {
    QZPayCreatePaymentInput,
    QZPayPaymentPaymentAdapter,
    QZPayProviderPayment,
    QZPayProviderRefund,
    QZPayRefundInput
} from '@qazuor/qzpay-core';
/**
 * Stripe Payment Adapter
 *
 * Implements QZPayPaymentPaymentAdapter for Stripe
 */
import type Stripe from 'stripe';

export class QZPayStripePaymentAdapter implements QZPayPaymentPaymentAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a payment (PaymentIntent) in Stripe
     */
    async create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment> {
        const params: Stripe.PaymentIntentCreateParams = {
            customer: providerCustomerId,
            amount: input.amount,
            currency: input.currency.toLowerCase(),
            metadata: input.metadata ? this.toStripeMetadata(input.metadata) : {}
        };

        // Set payment method if provided
        if (input.paymentMethodId) {
            params.payment_method = input.paymentMethodId;
            params.confirm = true;
        }

        const paymentIntent = await this.stripe.paymentIntents.create(params);

        return this.mapPaymentIntent(paymentIntent);
    }

    /**
     * Capture a payment in Stripe
     */
    async capture(providerPaymentId: string): Promise<QZPayProviderPayment> {
        const paymentIntent = await this.stripe.paymentIntents.capture(providerPaymentId);

        return this.mapPaymentIntent(paymentIntent);
    }

    /**
     * Cancel a payment in Stripe
     */
    async cancel(providerPaymentId: string): Promise<void> {
        await this.stripe.paymentIntents.cancel(providerPaymentId);
    }

    /**
     * Create a refund in Stripe
     */
    async refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund> {
        const params: Stripe.RefundCreateParams = {
            payment_intent: providerPaymentId
        };

        // Set refund amount if partial
        if (input.amount !== undefined) {
            params.amount = input.amount;
        }

        // Set reason if provided
        if (input.reason) {
            params.reason = this.mapRefundReason(input.reason);
        }

        const refund = await this.stripe.refunds.create(params);

        return {
            id: refund.id,
            status: refund.status ?? 'pending',
            amount: refund.amount
        };
    }

    /**
     * Retrieve a payment from Stripe
     */
    async retrieve(providerPaymentId: string): Promise<QZPayProviderPayment> {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(providerPaymentId);

        return this.mapPaymentIntent(paymentIntent);
    }

    /**
     * Map Stripe PaymentIntent to QZPay provider payment
     */
    private mapPaymentIntent(paymentIntent: Stripe.PaymentIntent): QZPayProviderPayment {
        return {
            id: paymentIntent.id,
            status: this.mapPaymentIntentStatus(paymentIntent.status),
            amount: paymentIntent.amount,
            currency: paymentIntent.currency.toUpperCase(),
            metadata: (paymentIntent.metadata as Record<string, string>) ?? {}
        };
    }

    /**
     * Map Stripe PaymentIntent status to string
     */
    private mapPaymentIntentStatus(status: Stripe.PaymentIntent.Status): string {
        const statusMap: Record<Stripe.PaymentIntent.Status, string> = {
            requires_payment_method: 'requires_payment_method',
            requires_confirmation: 'requires_confirmation',
            requires_action: 'requires_action',
            processing: 'processing',
            requires_capture: 'requires_capture',
            canceled: 'canceled',
            succeeded: 'succeeded'
        };

        return statusMap[status] ?? status;
    }

    /**
     * Map QZPay refund reason to Stripe reason
     */
    private mapRefundReason(reason: string): Stripe.RefundCreateParams.Reason {
        const reasonMap: Record<string, Stripe.RefundCreateParams.Reason> = {
            duplicate: 'duplicate',
            fraudulent: 'fraudulent',
            requested_by_customer: 'requested_by_customer'
        };

        return reasonMap[reason] ?? 'requested_by_customer';
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
