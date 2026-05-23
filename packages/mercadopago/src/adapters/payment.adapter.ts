import { randomUUID } from 'node:crypto';
import type {
    QZPayCreatePaymentInput,
    QZPayPaymentPaymentAdapter,
    QZPayPaymentSearchCriteria,
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
        // Generate idempotency key ONCE per logical create call so that retries
        // hit the same key. MercadoPago treats two calls with the same
        // X-Idempotency-Key (within its dedup window) as the same operation
        // and returns the existing payment instead of creating a duplicate.
        // If the caller provides one (e.g. for end-to-end traceability with
        // their own correlation ID), reuse it; otherwise generate a UUID.
        const idempotencyKey = input.idempotencyKey ?? `qzpay_${randomUUID()}`;

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

                    // Idempotency key is captured outside the retry loop (see
                    // top of create()) so all retries reuse the same value.
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

    /**
     * Search payments by external reference (typed) or preference id (passthrough).
     *
     * Used by polling fallback flows where the polling job has the local
     * checkout/preference id at start-paid time but no payment id (the
     * payment is created later when the user completes checkout).
     *
     * `external_reference` is the recommended typed field — MP propagates
     * the orchestrator-supplied external reference from the preference to
     * every payment. The `checkoutSessionId` criterion is forwarded as
     * `preference_id` via the SDK's untyped passthrough (the SDK's
     * `search()` issues `?<key>=<value>` for any key in the options object,
     * including ones the TS types don't expose); MP's REST endpoint accepts
     * it but the field is not part of the SDK's typed surface.
     *
     * Results are sorted by `date_created DESC` so the most recent attempt
     * appears first — relevant when a user retries with a different card
     * and the same checkout session produced multiple payments.
     */
    async search(criteria: QZPayPaymentSearchCriteria): Promise<QZPayProviderPayment[]> {
        return withRetry(
            async () => {
                try {
                    // Typed concretely so dot-notation access satisfies both
                    // tsc (noPropertyAccessFromIndexSignature) and biome's
                    // useLiteralKeys lint — Record<string, unknown> trips
                    // tsc; bracket access trips biome. The explicit shape
                    // also documents which MP options we set.
                    const options: {
                        sort: 'date_created';
                        criteria: 'desc';
                        external_reference?: string;
                        preference_id?: string;
                    } = {
                        sort: 'date_created',
                        criteria: 'desc'
                    };
                    if (criteria.externalReference) {
                        options.external_reference = criteria.externalReference;
                    }
                    if (criteria.checkoutSessionId) {
                        options.preference_id = criteria.checkoutSessionId;
                    }

                    // Cast: PaymentSearchOptions in the SDK does not expose
                    // every field MP REST accepts (notably preference_id), so
                    // we pass the looser options shape and rely on the SDK's
                    // queryParams: Object.assign forwarding.
                    const response = await this.paymentApi.search({
                        options: options as Parameters<Payment['search']>[0] extends { options?: infer O } ? O : never
                    });

                    const results = response.results ?? [];
                    return results
                        .filter((r): r is typeof r & { id: string | number } => r.id !== undefined)
                        .map((r) => this.mapSearchResultToProviderPayment(r));
                } catch (error) {
                    throw mapMercadoPagoError(error, 'Search payments');
                }
            },
            this.retryConfig,
            'Search payments'
        );
    }

    /**
     * Map a payment-search result row to the QZPay provider payment shape.
     *
     * The search endpoint returns a slimmer object than `paymentApi.get()`
     * (different `PaymentSearchResult` type), so this mapper is kept
     * separate from {@link mapToProviderPayment} which expects the full
     * `Payment` shape. Both produce the same canonical
     * {@link QZPayProviderPayment} for downstream consumers.
     */
    private mapSearchResultToProviderPayment(result: {
        id: string | number;
        status?: string;
        transaction_amount?: number;
        currency_id?: string;
        metadata?: Record<string, unknown> | undefined;
    }): QZPayProviderPayment {
        const status = this.mapStatus(result.status ?? 'pending');
        const transactionAmount = result.transaction_amount ?? 0;
        return {
            id: String(result.id),
            status,
            amount: Math.round(transactionAmount * 100),
            currency: (result.currency_id ?? 'USD').toUpperCase(),
            metadata: this.extractMetadata(result.metadata)
        };
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
