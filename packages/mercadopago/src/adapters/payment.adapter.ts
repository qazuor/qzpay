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

export class QZPayMercadoPagoPaymentAdapter implements QZPayPaymentPaymentAdapter {
    private readonly paymentApi: Payment;
    private readonly refundApi: PaymentRefund;

    constructor(client: MercadoPagoConfig) {
        this.paymentApi = new Payment(client);
        this.refundApi = new PaymentRefund(client);
    }

    async create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment> {
        const body: Parameters<Payment['create']>[0]['body'] = {
            transaction_amount: input.amount / 100, // MercadoPago uses decimal, not cents
            payment_method_id: input.paymentMethodId ?? 'pix',
            payer: {
                id: providerCustomerId
            },
            metadata: {
                qzpay_customer_id: providerCustomerId
            }
        };

        const response = await this.paymentApi.create({ body });

        return this.mapToProviderPayment(response);
    }

    async capture(providerPaymentId: string): Promise<QZPayProviderPayment> {
        const response = await this.paymentApi.capture({
            id: Number(providerPaymentId)
        });

        return this.mapToProviderPayment(response);
    }

    async cancel(providerPaymentId: string): Promise<void> {
        await this.paymentApi.cancel({
            id: Number(providerPaymentId)
        });
    }

    async refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund> {
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
    }

    async retrieve(providerPaymentId: string): Promise<QZPayProviderPayment> {
        const response = await this.paymentApi.get({
            id: Number(providerPaymentId)
        });

        return this.mapToProviderPayment(response);
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
