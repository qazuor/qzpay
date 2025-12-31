/**
 * Invoice types for QZPay
 */
import type { QZPayCurrency, QZPayInvoiceStatus } from '../constants/index.js';

export interface QZPayInvoice {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    status: QZPayInvoiceStatus;
    currency: QZPayCurrency;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    dueDate: Date | null;
    paidAt: Date | null;
    voidedAt: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    lines: QZPayInvoiceLine[];
    providerInvoiceIds: Record<string, string>;
    metadata: Record<string, unknown>;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface QZPayInvoiceLine {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    unitAmount: number;
    amount: number;
    priceId: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    metadata: Record<string, unknown>;
}

export interface QZPayCreateInvoiceInput {
    customerId: string;
    subscriptionId?: string;
    dueDate?: Date;
    lines: QZPayCreateInvoiceLineInput[];
    metadata?: Record<string, unknown>;
}

export interface QZPayCreateInvoiceLineInput {
    description: string;
    quantity: number;
    unitAmount: number;
    priceId?: string;
}
