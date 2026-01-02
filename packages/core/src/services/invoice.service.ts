/**
 * Invoice Service Helpers
 *
 * Business logic for invoice generation, finalization, and calculations.
 */

import type { QZPayCurrency } from '../constants/index.js';
import type { QZPayCreateInvoiceLineInput, QZPayInvoice, QZPayInvoiceLine } from '../types/invoice.types.js';

/**
 * Invoice number configuration
 */
export interface QZPayInvoiceNumberConfig {
    /** Prefix for invoice numbers (default: "INV") */
    prefix: string;
    /** Include year in number (default: true) */
    includeYear: boolean;
    /** Reset sequence annually (default: true) */
    resetAnnually: boolean;
    /** Minimum sequence digits (zero-padded, default: 6) */
    sequenceDigits: number;
    /** Separator character (default: "-") */
    separator: string;
    /** Include tenant prefix for multi-tenant (default: false) */
    includeTenantPrefix: boolean;
}

/**
 * Default invoice number configuration
 */
export const QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG: QZPayInvoiceNumberConfig = {
    prefix: 'INV',
    includeYear: true,
    resetAnnually: true,
    sequenceDigits: 6,
    separator: '-',
    includeTenantPrefix: false
};

/**
 * Invoice calculation result
 */
export interface QZPayInvoiceCalculation {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amountDue: number;
}

/**
 * Line item calculation
 */
export interface QZPayLineItemCalculation {
    quantity: number;
    unitAmount: number;
    amount: number;
}

/**
 * Create invoice number configuration with defaults
 */
export function qzpayCreateInvoiceNumberConfig(config?: Partial<QZPayInvoiceNumberConfig>): QZPayInvoiceNumberConfig {
    return {
        ...QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG,
        ...config
    };
}

/**
 * Generate invoice number from sequence
 */
export function qzpayGenerateInvoiceNumber(
    sequence: number,
    config: QZPayInvoiceNumberConfig = QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG,
    tenantId?: string,
    year?: number
): string {
    const parts: string[] = [];

    if (config.includeTenantPrefix && tenantId) {
        parts.push(tenantId.toUpperCase());
    }

    parts.push(config.prefix);

    if (config.includeYear) {
        const invoiceYear = year ?? new Date().getFullYear();
        parts.push(String(invoiceYear));
    }

    const paddedSequence = String(sequence).padStart(config.sequenceDigits, '0');
    parts.push(paddedSequence);

    return parts.join(config.separator);
}

/**
 * Calculate line item amount
 */
export function qzpayCalculateLineItemAmount(lineItem: QZPayCreateInvoiceLineInput): QZPayLineItemCalculation {
    const amount = lineItem.quantity * lineItem.unitAmount;
    return {
        quantity: lineItem.quantity,
        unitAmount: lineItem.unitAmount,
        amount
    };
}

/**
 * Calculate invoice totals from line items
 */
export function qzpayCalculateInvoiceTotals(
    lines: QZPayInvoiceLine[],
    taxRate = 0,
    discountAmount = 0,
    amountPaid = 0
): QZPayInvoiceCalculation {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = Math.round(discountedSubtotal * (taxRate / 100));
    const total = discountedSubtotal + tax;
    const amountDue = Math.max(0, total - amountPaid);

    return {
        subtotal,
        tax,
        discount: discountAmount,
        total,
        amountDue
    };
}

/**
 * Create invoice lines from input
 */
export function qzpayCreateInvoiceLines(invoiceId: string, lineInputs: QZPayCreateInvoiceLineInput[]): QZPayInvoiceLine[] {
    return lineInputs.map((input, index) => {
        const { amount } = qzpayCalculateLineItemAmount(input);
        return {
            id: `${invoiceId}_line_${index}`,
            invoiceId,
            description: input.description,
            quantity: input.quantity,
            unitAmount: input.unitAmount,
            amount,
            priceId: input.priceId ?? null,
            periodStart: null,
            periodEnd: null,
            metadata: {}
        };
    });
}

/**
 * Invoice status helpers
 */

/**
 * Check if invoice is draft
 */
export function qzpayInvoiceIsDraft(invoice: QZPayInvoice): boolean {
    return invoice.status === 'draft';
}

/**
 * Check if invoice is open (awaiting payment)
 */
export function qzpayInvoiceIsOpen(invoice: QZPayInvoice): boolean {
    return invoice.status === 'open';
}

/**
 * Check if invoice is paid
 */
export function qzpayInvoiceIsPaid(invoice: QZPayInvoice): boolean {
    return invoice.status === 'paid';
}

/**
 * Check if invoice is void
 */
export function qzpayInvoiceIsVoid(invoice: QZPayInvoice): boolean {
    return invoice.status === 'void';
}

/**
 * Check if invoice is uncollectible
 */
export function qzpayInvoiceIsUncollectible(invoice: QZPayInvoice): boolean {
    return invoice.status === 'uncollectible';
}

/**
 * Check if invoice can be finalized
 */
export function qzpayInvoiceCanBeFinalized(invoice: QZPayInvoice): { canFinalize: boolean; error?: string } {
    if (invoice.status !== 'draft') {
        return { canFinalize: false, error: 'Only draft invoices can be finalized' };
    }
    if (invoice.lines.length === 0) {
        return { canFinalize: false, error: 'Invoice must have at least one line item' };
    }
    if (invoice.total <= 0) {
        return { canFinalize: false, error: 'Invoice total must be greater than zero' };
    }
    return { canFinalize: true };
}

/**
 * Check if invoice can be voided
 */
export function qzpayInvoiceCanBeVoided(invoice: QZPayInvoice): { canVoid: boolean; error?: string } {
    if (invoice.status === 'paid') {
        return { canVoid: false, error: 'Paid invoices cannot be voided. Use refund instead.' };
    }
    if (invoice.status === 'void') {
        return { canVoid: false, error: 'Invoice is already voided' };
    }
    return { canVoid: true };
}

/**
 * Check if invoice can be modified
 */
export function qzpayInvoiceCanBeModified(invoice: QZPayInvoice): boolean {
    return invoice.status === 'draft';
}

/**
 * Check if invoice is past due
 */
export function qzpayInvoiceIsPastDue(invoice: QZPayInvoice, now: Date = new Date()): boolean {
    if (invoice.status !== 'open') {
        return false;
    }
    if (!invoice.dueDate) {
        return false;
    }
    return now > invoice.dueDate;
}

/**
 * Get days until invoice is due
 */
export function qzpayGetDaysUntilDue(invoice: QZPayInvoice, now: Date = new Date()): number | null {
    if (!invoice.dueDate) {
        return null;
    }
    const msUntilDue = invoice.dueDate.getTime() - now.getTime();
    return Math.ceil(msUntilDue / (1000 * 60 * 60 * 24));
}

/**
 * Check if invoice has outstanding balance
 */
export function qzpayInvoiceHasOutstandingBalance(invoice: QZPayInvoice): boolean {
    return invoice.amountDue > 0 && invoice.status === 'open';
}

/**
 * Invoice period helpers
 */

/**
 * Get billing period description
 */
export function qzpayGetInvoicePeriodDescription(invoice: QZPayInvoice): string | null {
    if (!invoice.periodStart || !invoice.periodEnd) {
        return null;
    }

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`;
}

/**
 * Get invoice period in days
 */
export function qzpayGetInvoicePeriodDays(invoice: QZPayInvoice): number | null {
    if (!invoice.periodStart || !invoice.periodEnd) {
        return null;
    }

    const msDiff = invoice.periodEnd.getTime() - invoice.periodStart.getTime();
    return Math.ceil(msDiff / (1000 * 60 * 60 * 24));
}

/**
 * Format invoice amount for display
 */
export function qzpayFormatInvoiceAmount(amount: number, currency: QZPayCurrency): string {
    const displayAmount = amount / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
    }).format(displayAmount);
}

/**
 * Invoice validation helpers
 */

/**
 * Validate line item input
 */
export function qzpayValidateLineItem(lineItem: QZPayCreateInvoiceLineInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!lineItem.description || lineItem.description.trim().length === 0) {
        errors.push('Line item description is required');
    }

    if (typeof lineItem.quantity !== 'number' || lineItem.quantity <= 0) {
        errors.push('Quantity must be a positive number');
    }

    if (typeof lineItem.unitAmount !== 'number' || lineItem.unitAmount < 0) {
        errors.push('Unit amount must be a non-negative number');
    }

    if (!Number.isInteger(lineItem.unitAmount)) {
        errors.push('Unit amount must be an integer (in cents)');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate invoice line items
 */
export function qzpayValidateInvoiceLines(lines: QZPayCreateInvoiceLineInput[]): { valid: boolean; errors: string[] } {
    if (!lines || lines.length === 0) {
        return { valid: false, errors: ['At least one line item is required'] };
    }

    const allErrors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line) {
            const result = qzpayValidateLineItem(line);
            if (!result.valid) {
                allErrors.push(...result.errors.map((e) => `Line ${i + 1}: ${e}`));
            }
        }
    }

    return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Proration helpers
 */

/**
 * Calculate proration amount for plan change (for invoice generation)
 */
export function qzpayCalculateInvoiceProration(
    currentPlanPrice: number,
    newPlanPrice: number,
    daysRemaining: number,
    totalDaysInPeriod: number
): { unusedCredit: number; newPlanProrated: number; netAmount: number } {
    const unusedRatio = daysRemaining / totalDaysInPeriod;
    const unusedCredit = Math.round(currentPlanPrice * unusedRatio);
    const newPlanProrated = Math.round(newPlanPrice * unusedRatio);
    const netAmount = newPlanProrated - unusedCredit;

    return {
        unusedCredit,
        newPlanProrated,
        netAmount
    };
}

/**
 * Create proration line items for plan change
 */
export function qzpayCreateProrationLineItems(
    invoiceId: string,
    currentPlanName: string,
    newPlanName: string,
    proration: { unusedCredit: number; newPlanProrated: number },
    periodStart: Date,
    periodEnd: Date
): QZPayInvoiceLine[] {
    const lines: QZPayInvoiceLine[] = [];

    // Credit for unused time on current plan
    if (proration.unusedCredit > 0) {
        lines.push({
            id: `${invoiceId}_proration_credit`,
            invoiceId,
            description: `Unused time on ${currentPlanName}`,
            quantity: 1,
            unitAmount: -proration.unusedCredit,
            amount: -proration.unusedCredit,
            priceId: null,
            periodStart,
            periodEnd,
            metadata: { proration: true, type: 'credit' }
        });
    }

    // Charge for remaining time on new plan
    if (proration.newPlanProrated > 0) {
        lines.push({
            id: `${invoiceId}_proration_charge`,
            invoiceId,
            description: `Remaining time on ${newPlanName}`,
            quantity: 1,
            unitAmount: proration.newPlanProrated,
            amount: proration.newPlanProrated,
            priceId: null,
            periodStart,
            periodEnd,
            metadata: { proration: true, type: 'charge' }
        });
    }

    return lines;
}
