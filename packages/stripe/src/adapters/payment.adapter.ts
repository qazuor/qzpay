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
import { validateStripeCurrency } from '../utils/currency.utils.js';
import { toStripeMetadata } from '../utils/metadata.utils.js';
import { type RetryConfig, withRetry } from '../utils/retry.utils.js';

export class QZPayStripePaymentAdapter implements QZPayPaymentPaymentAdapter {
    constructor(
        private readonly stripe: Stripe,
        private readonly retryConfig?: Partial<RetryConfig>
    ) {}

    /**
     * Create a payment (PaymentIntent) in Stripe
     */
    async create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                // Validate currency is supported by Stripe
                validateStripeCurrency(input.currency);

                const params: Stripe.PaymentIntentCreateParams = {
                    customer: providerCustomerId,
                    amount: input.amount,
                    currency: input.currency.toLowerCase(),
                    metadata: input.metadata ? toStripeMetadata(input.metadata) : {}
                };

                // Set payment method if provided
                if (input.paymentMethodId) {
                    params.payment_method = input.paymentMethodId;
                    params.confirm = true;

                    // Explicitly set payment method types to card only
                    // This prevents Stripe from using automatic_payment_methods which may include redirect-based methods
                    params.payment_method_types = ['card'];

                    // Configure 3DS behavior
                    params.payment_method_options = {
                        card: {
                            request_three_d_secure: 'automatic'
                        }
                    };

                    // Return URL for 3DS redirect (if needed for hosted 3DS)
                    // biome-ignore lint/complexity/useLiteralKeys: Index signature requires bracket notation
                    if (input.metadata?.['return_url']) {
                        // biome-ignore lint/complexity/useLiteralKeys: Index signature requires bracket notation
                        params.return_url = input.metadata['return_url'] as string;
                    }
                }

                const paymentIntent = await this.stripe.paymentIntents.create(params);

                return this.mapPaymentIntent(paymentIntent);
            },
            this.retryConfig,
            'Create payment'
        );
    }

    /**
     * Capture a payment in Stripe
     */
    async capture(providerPaymentId: string): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                const paymentIntent = await this.stripe.paymentIntents.capture(providerPaymentId);
                return this.mapPaymentIntent(paymentIntent);
            },
            this.retryConfig,
            'Capture payment'
        );
    }

    /**
     * Cancel a payment in Stripe
     */
    async cancel(providerPaymentId: string): Promise<void> {
        return withRetry(
            async () => {
                await this.stripe.paymentIntents.cancel(providerPaymentId);
            },
            this.retryConfig,
            'Cancel payment'
        );
    }

    /**
     * Create a refund in Stripe
     */
    async refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund> {
        return withRetry(
            async () => {
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
            },
            this.retryConfig,
            'Refund payment'
        );
    }

    /**
     * Retrieve a payment from Stripe
     */
    async retrieve(providerPaymentId: string): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                const paymentIntent = await this.stripe.paymentIntents.retrieve(providerPaymentId);
                return this.mapPaymentIntent(paymentIntent);
            },
            this.retryConfig,
            'Retrieve payment'
        );
    }

    /**
     * Map Stripe PaymentIntent to QZPay provider payment
     */
    private mapPaymentIntent(paymentIntent: Stripe.PaymentIntent): QZPayProviderPayment {
        const result: QZPayProviderPayment = {
            id: paymentIntent.id,
            status: this.mapPaymentIntentStatus(paymentIntent.status),
            amount: paymentIntent.amount,
            currency: paymentIntent.currency.toUpperCase(),
            metadata: (paymentIntent.metadata as Record<string, string>) ?? {}
        };

        // Include client secret for 3DS authentication
        if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
            if (paymentIntent.client_secret) {
                result.clientSecret = paymentIntent.client_secret;
            }

            // Include next action details if available
            if (paymentIntent.next_action) {
                const nextActionType = paymentIntent.next_action.type;
                const nextAction: { type: string; redirectUrl?: string } = {
                    type: nextActionType
                };

                if (nextActionType === 'redirect_to_url' && paymentIntent.next_action.redirect_to_url?.url) {
                    nextAction.redirectUrl = paymentIntent.next_action.redirect_to_url.url;
                }

                result.nextAction = nextAction;
            }
        }

        return result;
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
}
