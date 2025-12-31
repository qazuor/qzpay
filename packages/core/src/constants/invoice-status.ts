/**
 * Invoice status constants
 */
export const QZPAY_INVOICE_STATUS = {
    DRAFT: 'draft',
    OPEN: 'open',
    PAID: 'paid',
    VOID: 'void',
    UNCOLLECTIBLE: 'uncollectible'
} as const;

export type QZPayInvoiceStatus = (typeof QZPAY_INVOICE_STATUS)[keyof typeof QZPAY_INVOICE_STATUS];

export const QZPAY_INVOICE_STATUS_VALUES = Object.values(QZPAY_INVOICE_STATUS) as readonly QZPayInvoiceStatus[];
