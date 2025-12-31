/**
 * Payment types for QZPay
 */
import type { QZPayCurrency, QZPayPaymentStatus } from '../constants/index.js';

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
    metadata: Record<string, unknown>;
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
    metadata?: Record<string, unknown>;
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
