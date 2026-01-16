import type {
    QZPayCreatePaymentInput,
    QZPayPaymentPaymentAdapter,
    QZPayProviderPayment,
    QZPayProviderRefund,
    QZPayRefundInput
} from '@qazuor/qzpay-core';
/**
 * MercadoPago Payment Adapter
 */
import { type MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';
import type { QZPayMPSplitPaymentConfig, QZPayMPSplitPaymentResult } from '../types.js';
import { MERCADOPAGO_PAYMENT_STATUS } from '../types.js';
import { mapMercadoPagoError } from '../utils/error-mapper.js';
import { type RetryConfig, withRetry } from '../utils/retry.utils.js';
import { sanitizeEmail } from '../utils/sanitize.utils.js';
import { QZPayMercadoPagoCardTokenAdapterImpl } from './card-token.adapter.js';

export class QZPayMercadoPagoPaymentAdapter implements QZPayPaymentPaymentAdapter {
    private readonly paymentApi: Payment;
    private readonly refundApi: PaymentRefund;
    private readonly cardTokenAdapter: QZPayMercadoPagoCardTokenAdapterImpl;

    constructor(
        client: MercadoPagoConfig,
        private readonly retryConfig?: Partial<RetryConfig>
    ) {
        this.paymentApi = new Payment(client);
        this.refundApi = new PaymentRefund(client);
        this.cardTokenAdapter = new QZPayMercadoPagoCardTokenAdapterImpl(client);
    }

    async create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                try {
                    // Determine payment method based on input
                    const paymentMethodId = input.paymentMethodId;

                    // Build payer object - email is required for card payments
                    // Note: payer.id is only used when NOT using a token (for saved cards flow)
                    // For token payments, we only need the email and identification
                    const payer: {
                        id?: string;
                        email?: string;
                        identification?: { type: string; number: string };
                    } = {};
                    if (input.payerEmail) {
                        // Sanitize email before sending to MercadoPago
                        payer.email = sanitizeEmail(input.payerEmail);
                    }
                    // Add identification if provided (required for some countries like Argentina)
                    if (input.payerIdentification) {
                        payer.identification = {
                            type: input.payerIdentification.type,
                            // Trim identification number to remove whitespace
                            number: input.payerIdentification.number.trim()
                        };
                    }
                    // Only set payer.id if not using a token (to avoid conflicts)
                    if (!input.token) {
                        payer.id = providerCustomerId;
                    }

                    // Build base payment body
                    const body: Parameters<Payment['create']>[0]['body'] = {
                        transaction_amount: input.amount / 100, // MercadoPago uses decimal, not cents
                        description: 'QZPay Payment',
                        payer,
                        metadata: {
                            qzpay_customer_id: providerCustomerId,
                            ...(input.metadata as Record<string, string> | undefined)
                        }
                    };

                    // Card payment with token (first payment - tokenization)
                    if (input.token) {
                        body.token = input.token;
                        body.installments = input.installments ?? 1;
                        if (paymentMethodId) {
                            body.payment_method_id = paymentMethodId;
                        }
                    }
                    // Recurring payment with saved card_id
                    // For saved cards in MercadoPago, we need to generate a new token from the card_id
                    // using the CardToken API
                    else if (input.cardId) {
                        // Generate a new token from the saved card ID
                        const cardToken = await this.cardTokenAdapter.create(input.cardId);

                        // Use the generated token for the payment
                        body.token = cardToken;
                        body.installments = input.installments ?? 1;
                        if (paymentMethodId) {
                            body.payment_method_id = paymentMethodId;
                        }

                        // Store the original card_id in metadata for tracking
                        body.metadata = {
                            ...body.metadata,
                            saved_card_id: input.cardId
                        };
                    }
                    // Fallback to account_money if no card/token
                    else {
                        body.payment_method_id = paymentMethodId ?? 'account_money';
                    }

                    // Add idempotency key to prevent duplicate payments
                    const idempotencyKey = `qzpay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    const response = await this.paymentApi.create({
                        body,
                        requestOptions: {
                            idempotencyKey
                        }
                    });

                    return this.mapToProviderPayment(response);
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Create payment');
                }
            },
            this.retryConfig,
            'Create payment'
        );
    }

    async capture(providerPaymentId: string): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                try {
                    const response = await this.paymentApi.capture({
                        id: Number(providerPaymentId)
                    });

                    return this.mapToProviderPayment(response);
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Capture payment');
                }
            },
            this.retryConfig,
            'Capture payment'
        );
    }

    async cancel(providerPaymentId: string): Promise<void> {
        return withRetry(
            async () => {
                try {
                    await this.paymentApi.cancel({
                        id: Number(providerPaymentId)
                    });
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Cancel payment');
                }
            },
            this.retryConfig,
            'Cancel payment'
        );
    }

    async refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund> {
        return withRetry(
            async () => {
                try {
                    const body: Parameters<PaymentRefund['create']>[0]['body'] = {};

                    if (input.amount) {
                        body.amount = input.amount / 100;
                    }

                    const response = await this.refundApi.create({
                        payment_id: Number(providerPaymentId),
                        body
                    });

                    return {
                        id: String(response.id),
                        status: response.status ?? 'pending',
                        amount: Math.round((response.amount ?? 0) * 100) // Convert back to cents
                    };
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Refund payment');
                }
            },
            this.retryConfig,
            'Refund payment'
        );
    }

    async retrieve(providerPaymentId: string): Promise<QZPayProviderPayment> {
        return withRetry(
            async () => {
                try {
                    const response = await this.paymentApi.get({
                        id: Number(providerPaymentId)
                    });

                    return this.mapToProviderPayment(response);
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Retrieve payment');
                }
            },
            this.retryConfig,
            'Retrieve payment'
        );
    }

    private mapToProviderPayment(payment: Awaited<ReturnType<Payment['get']>>): QZPayProviderPayment {
        const status = this.mapStatus(payment.status ?? 'pending');
        const transactionAmount = payment.transaction_amount ?? 0;

        return {
            id: String(payment.id),
            status,
            amount: Math.round(transactionAmount * 100), // Convert to cents
            currency: (payment.currency_id ?? 'USD').toUpperCase(),
            metadata: this.extractMetadata(payment.metadata)
        };
    }

    private mapStatus(mpStatus: string): string {
        const statusMap: Record<string, string> = MERCADOPAGO_PAYMENT_STATUS;
        return statusMap[mpStatus] ?? mpStatus;
    }

    private extractMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> {
        if (!metadata) return {};
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }

    // ==================== v2 Marketplace Methods (Prepared) ====================

    /**
     * Create a split payment (marketplace)
     *
     * @remarks
     * Split payments allow distributing funds to multiple recipients (vendors)
     * in a marketplace scenario. This will be fully implemented in v2.
     *
     * For now, use the MercadoPago API directly for split payments:
     * https://www.mercadopago.com.ar/developers/en/docs/split-payments/integration-configuration/create-split-payment
     *
     * @param _config - Split payment configuration (not implemented yet)
     * @throws Error indicating this feature is planned for v2
     *
     * @example
     * ```typescript
     * // v2 usage example:
     * const result = await adapter.createSplitPayment({
     *     payment: { amount: 10000, currency: 'ARS' },
     *     disbursements: [
     *         { amount: 8500, collectorId: 'seller_123', reference: 'order_456' },
     *         { amount: 1500, collectorId: 'platform_fee', reference: 'fee_456' }
     *     ]
     * });
     * ```
     */
    async createSplitPayment(_config: QZPayMPSplitPaymentConfig): Promise<QZPayMPSplitPaymentResult> {
        // TODO v2: Implement split payment creation
        // This requires:
        // 1. Creating the primary payment
        // 2. Setting up disbursements to multiple collectors
        // 3. Handling the complex response with multiple statuses
        throw new Error(
            'Split payments will be available in v2. ' +
                'For now, use the MercadoPago API directly: ' +
                'https://www.mercadopago.com.ar/developers/en/docs/split-payments'
        );
    }
}
