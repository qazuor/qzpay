/**
 * Invoice type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayCreateInvoiceInput,
    QZPayCurrency,
    QZPayInvoice,
    QZPayInvoiceLine,
    QZPayInvoiceStatus,
    QZPayMetadata
} from '@qazuor/qzpay-core';
import type {
    QZPayBillingInvoice,
    QZPayBillingInvoiceInsert,
    QZPayBillingInvoiceLine,
    QZPayBillingInvoiceLineInsert
} from '../schema/index.js';

/**
 * Map Drizzle invoice to Core invoice
 */
export function mapDrizzleInvoiceToCore(drizzle: QZPayBillingInvoice, lines: QZPayBillingInvoiceLine[] = []): QZPayInvoice {
    const providerInvoiceIds: Record<string, string> = {};

    if (drizzle.stripeInvoiceId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerInvoiceIds['stripe'] = drizzle.stripeInvoiceId;
    }
    if (drizzle.mpInvoiceId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerInvoiceIds['mercadopago'] = drizzle.mpInvoiceId;
    }

    return {
        id: drizzle.id,
        customerId: drizzle.customerId,
        subscriptionId: drizzle.subscriptionId ?? null,
        status: drizzle.status as QZPayInvoiceStatus,
        currency: drizzle.currency as QZPayCurrency,
        subtotal: drizzle.subtotal,
        tax: drizzle.tax ?? 0,
        discount: drizzle.discount ?? 0,
        total: drizzle.total,
        amountPaid: drizzle.amountPaid ?? 0,
        amountDue: drizzle.amountRemaining ?? 0,
        dueDate: drizzle.dueDate ?? null,
        paidAt: drizzle.paidAt ?? null,
        voidedAt: drizzle.voidedAt ?? null,
        periodStart: drizzle.periodStart ?? null,
        periodEnd: drizzle.periodEnd ?? null,
        lines: lines.map(mapDrizzleInvoiceLineToCore),
        providerInvoiceIds,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Drizzle invoice line to Core invoice line
 */
export function mapDrizzleInvoiceLineToCore(drizzle: QZPayBillingInvoiceLine): QZPayInvoiceLine {
    return {
        id: drizzle.id,
        invoiceId: drizzle.invoiceId,
        description: drizzle.description,
        quantity: drizzle.quantity,
        unitAmount: drizzle.unitAmount,
        amount: drizzle.amount,
        priceId: drizzle.priceId ?? null,
        periodStart: drizzle.periodStart ?? null,
        periodEnd: drizzle.periodEnd ?? null,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {}
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCoreInvoiceCreateToDrizzle(
    input: QZPayCreateInvoiceInput & { id: string },
    defaults: {
        livemode: boolean;
        currency: string;
        invoiceNumber: string;
        subtotal: number;
        tax: number;
        discount: number;
        total: number;
    }
): QZPayBillingInvoiceInsert {
    return {
        id: input.id,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId ?? null,
        number: defaults.invoiceNumber,
        status: 'draft',
        currency: defaults.currency,
        subtotal: defaults.subtotal,
        tax: defaults.tax,
        discount: defaults.discount,
        total: defaults.total,
        amountPaid: 0,
        amountRemaining: defaults.total,
        dueDate: input.dueDate ?? null,
        metadata: input.metadata ?? {},
        livemode: defaults.livemode
    };
}

/**
 * Map Core invoice line input to Drizzle insert
 */
export function mapCoreInvoiceLineCreateToDrizzle(
    invoiceId: string,
    currency: string,
    input: QZPayCreateInvoiceInput['lines'][number]
): QZPayBillingInvoiceLineInsert {
    return {
        invoiceId,
        description: input.description,
        quantity: input.quantity,
        unitAmount: input.unitAmount,
        amount: input.quantity * input.unitAmount,
        currency,
        priceId: input.priceId ?? null
    };
}

/**
 * Map Core invoice partial update to Drizzle
 */
export function mapCoreInvoiceUpdateToDrizzle(update: Partial<QZPayInvoice>): Partial<QZPayBillingInvoiceInsert> {
    const result: Partial<QZPayBillingInvoiceInsert> = {};

    if (update.status !== undefined) {
        result.status = update.status;
    }
    if (update.amountPaid !== undefined) {
        result.amountPaid = update.amountPaid;
    }
    if (update.amountDue !== undefined) {
        result.amountRemaining = update.amountDue;
    }
    if (update.paidAt !== undefined) {
        result.paidAt = update.paidAt;
    }
    if (update.voidedAt !== undefined) {
        result.voidedAt = update.voidedAt;
    }
    if (update.metadata !== undefined) {
        result.metadata = update.metadata;
    }

    return result;
}
