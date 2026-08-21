/**
 * Payment types for QZPay
 */
import type { QZPayCurrency, QZPayPaymentStatus } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayPayment {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    invoiceId: string | null;
    amount: number;
    currency: QZPayCurrency;
    status: QZPayPaymentStatus;
    paymentMethodId: string | null;
    providerPaymentIds: Record<string, string>;
    failureCode: string | null;
    failureMessage: string | null;
    metadata: QZPayMetadata;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface QZPayCreatePaymentInput {
    customerId: string;
    amount: number;
    currency: QZPayCurrency;
    paymentMethodId?: string;
    subscriptionId?: string;
    invoiceId?: string;
    metadata?: QZPayMetadata;
    /** Card token for providers that require tokenization (e.g., MercadoPago) */
    token?: string;
    /** Saved card ID for recurring payments without re-tokenization */
    cardId?: string;
    /** Number of installments for card payments */
    installments?: number;
    /** Flag to save card after payment (Card on File flow) */
    saveCard?: boolean;
    /** Payer email for providers that require it (e.g., MercadoPago) */
    payerEmail?: string;
    /** Payer identification for providers that require it (e.g., MercadoPago in Argentina) */
    payerIdentification?: {
        type: string;
        number: string;
    };
    /**
     * Idempotency key forwarded to the provider as `X-Idempotency-Key`.
     *
     * When the caller passes a stable key, retries against the same logical
     * operation will be deduplicated by the provider (returning the original
     * payment instead of creating a new one). If omitted, the adapter
     * generates a UUID once per `create()` call and reuses it across all
     * retry attempts.
     */
    idempotencyKey?: string;
}

export interface QZPayRefundInput {
    paymentId: string;
    amount?: number;
    reason?: string;
}

export interface QZPayRefund {
    id: string;
    paymentId: string;
    amount: number;
    currency: QZPayCurrency;
    reason: string | null;
    status: 'pending' | 'succeeded' | 'failed';
    providerRefundIds: Record<string, string>;
    createdAt: Date;
}

/**
 * Input for persisting one individual refund event against a payment.
 *
 * A payment can be refunded across several calls (e.g. two 50% tranches
 * that together add up to a full refund). Each settled call to
 * `payments.refund()` persists one of these records via
 * `storage.payments.createRefund()`, and `storage.payments.getTotalRefundedAmount()`
 * sums them to determine whether the payment is now fully or partially
 * refunded — comparing an ACCUMULATED total against `payment.amount`
 * instead of only the most recent event's amount.
 */
export interface QZPayCreateRefundInput {
    /** Payment this refund event applies to. */
    paymentId: string;
    /** Amount refunded by THIS event, in minor units (cents/centavos). */
    amount: number;
    currency: QZPayCurrency;
    /** Settlement state of this individual refund event. */
    status: 'pending' | 'succeeded' | 'failed';
    reason?: string;
    /** Provider-side refund identifier, when a provider processed this event. */
    providerRefundId?: string;
    livemode: boolean;
    metadata?: QZPayMetadata;
}
