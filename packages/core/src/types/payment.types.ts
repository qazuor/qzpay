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
