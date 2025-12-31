/**
 * Invoices repository for QZPay Drizzle
 *
 * Provides invoice and invoice line database operations.
 */
import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingInvoice,
    type QZPayBillingInvoiceInsert,
    type QZPayBillingInvoiceLine,
    type QZPayBillingInvoiceLineInsert,
    type QZPayBillingInvoicePayment,
    type QZPayBillingInvoicePaymentInsert,
    billingInvoiceLines,
    billingInvoicePayments,
    billingInvoices
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Invoice status values
 */
export type QZPayInvoiceStatusValue = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';

/**
 * Invoice search options
 */
export interface QZPayInvoiceSearchOptions {
    customerId?: string;
    subscriptionId?: string;
    status?: QZPayInvoiceStatusValue | QZPayInvoiceStatusValue[];
    startDate?: Date;
    endDate?: Date;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Invoices repository
 */
export class QZPayInvoicesRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find invoice by ID
     */
    async findById(id: string): Promise<QZPayBillingInvoice | null> {
        const result = await this.db
            .select()
            .from(billingInvoices)
            .where(and(eq(billingInvoices.id, id), isNull(billingInvoices.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new invoice
     */
    async create(input: QZPayBillingInvoiceInsert): Promise<QZPayBillingInvoice> {
        const result = await this.db.insert(billingInvoices).values(input).returning();
        return firstOrThrow(result, 'Invoice', 'new');
    }

    /**
     * Update an invoice
     */
    async update(id: string, input: Partial<QZPayBillingInvoiceInsert>): Promise<QZPayBillingInvoice> {
        const result = await this.db
            .update(billingInvoices)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingInvoices.id, id), isNull(billingInvoices.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Invoice', id);
    }

    /**
     * Find invoice by number
     */
    async findByNumber(number: string): Promise<QZPayBillingInvoice | null> {
        const result = await this.db
            .select()
            .from(billingInvoices)
            .where(and(eq(billingInvoices.number, number), isNull(billingInvoices.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find invoice by Stripe invoice ID
     */
    async findByStripeInvoiceId(stripeInvoiceId: string): Promise<QZPayBillingInvoice | null> {
        const result = await this.db
            .select()
            .from(billingInvoices)
            .where(and(eq(billingInvoices.stripeInvoiceId, stripeInvoiceId), isNull(billingInvoices.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find invoice by MercadoPago invoice ID
     */
    async findByMpInvoiceId(mpInvoiceId: string): Promise<QZPayBillingInvoice | null> {
        const result = await this.db
            .select()
            .from(billingInvoices)
            .where(and(eq(billingInvoices.mpInvoiceId, mpInvoiceId), isNull(billingInvoices.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find invoice by provider invoice ID
     */
    async findByProviderInvoiceId(provider: 'stripe' | 'mercadopago', providerInvoiceId: string): Promise<QZPayBillingInvoice | null> {
        if (provider === 'stripe') {
            return this.findByStripeInvoiceId(providerInvoiceId);
        }
        return this.findByMpInvoiceId(providerInvoiceId);
    }

    /**
     * Find invoices by customer ID
     */
    async findByCustomerId(
        customerId: string,
        options: QZPayInvoiceSearchOptions = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingInvoice>> {
        const { status, startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingInvoices.customerId, customerId), isNull(billingInvoices.deletedAt)];

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingInvoices.status, status));
            } else {
                conditions.push(eq(billingInvoices.status, status));
            }
        }

        if (startDate) {
            conditions.push(gte(billingInvoices.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingInvoices.createdAt, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingInvoices)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingInvoices)
            .where(and(...conditions))
            .orderBy(sql`${billingInvoices.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find invoices by subscription ID
     */
    async findBySubscriptionId(subscriptionId: string): Promise<QZPayBillingInvoice[]> {
        return this.db
            .select()
            .from(billingInvoices)
            .where(and(eq(billingInvoices.subscriptionId, subscriptionId), isNull(billingInvoices.deletedAt)))
            .orderBy(sql`${billingInvoices.createdAt} DESC`);
    }

    /**
     * Find unpaid invoices
     */
    async findUnpaid(livemode = true): Promise<QZPayBillingInvoice[]> {
        return this.db
            .select()
            .from(billingInvoices)
            .where(
                and(
                    inArray(billingInvoices.status, ['open', 'draft']),
                    eq(billingInvoices.livemode, livemode),
                    isNull(billingInvoices.deletedAt)
                )
            )
            .orderBy(sql`${billingInvoices.dueDate} ASC`);
    }

    /**
     * Find overdue invoices
     */
    async findOverdue(livemode = true): Promise<QZPayBillingInvoice[]> {
        return this.db
            .select()
            .from(billingInvoices)
            .where(
                and(
                    eq(billingInvoices.status, 'open'),
                    eq(billingInvoices.livemode, livemode),
                    lte(billingInvoices.dueDate, new Date()),
                    isNull(billingInvoices.deletedAt)
                )
            )
            .orderBy(sql`${billingInvoices.dueDate} ASC`);
    }

    /**
     * Update invoice status
     */
    async updateStatus(
        id: string,
        status: QZPayInvoiceStatusValue,
        additionalData?: Partial<QZPayBillingInvoiceInsert>
    ): Promise<QZPayBillingInvoice> {
        const updateData: Partial<QZPayBillingInvoiceInsert> = {
            status,
            updatedAt: new Date(),
            ...additionalData
        };

        if (status === 'paid' && !additionalData?.paidAt) {
            updateData.paidAt = new Date();
        }

        if (status === 'void' && !additionalData?.voidedAt) {
            updateData.voidedAt = new Date();
        }

        const result = await this.db
            .update(billingInvoices)
            .set(updateData)
            .where(and(eq(billingInvoices.id, id), isNull(billingInvoices.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Invoice', id);
    }

    /**
     * Finalize invoice (move from draft to open)
     */
    async finalize(id: string): Promise<QZPayBillingInvoice> {
        const result = await this.db
            .update(billingInvoices)
            .set({
                status: 'open',
                updatedAt: new Date()
            })
            .where(and(eq(billingInvoices.id, id), eq(billingInvoices.status, 'draft'), isNull(billingInvoices.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Invoice', id);
    }

    /**
     * Search invoices
     */
    async search(options: QZPayInvoiceSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingInvoice>> {
        const { customerId, subscriptionId, status, startDate, endDate, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingInvoices.deletedAt)];

        if (customerId) {
            conditions.push(eq(billingInvoices.customerId, customerId));
        }

        if (subscriptionId) {
            conditions.push(eq(billingInvoices.subscriptionId, subscriptionId));
        }

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingInvoices.status, status));
            } else {
                conditions.push(eq(billingInvoices.status, status));
            }
        }

        if (startDate) {
            conditions.push(gte(billingInvoices.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingInvoices.createdAt, endDate));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingInvoices.livemode, livemode));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingInvoices)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingInvoices)
            .where(and(...conditions))
            .orderBy(sql`${billingInvoices.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Generate next invoice number
     */
    async generateInvoiceNumber(prefix = 'INV'): Promise<string> {
        const pattern = `${prefix}-%`;
        const result = await this.db
            .select({ maxNumber: sql<string>`MAX(number)` })
            .from(billingInvoices)
            .where(sql`number LIKE ${pattern}`);

        const maxNumber = result[0]?.maxNumber;
        if (!maxNumber) {
            return `${prefix}-000001`;
        }

        const currentNum = Number.parseInt(maxNumber.replace(`${prefix}-`, ''), 10);
        const nextNum = currentNum + 1;
        return `${prefix}-${nextNum.toString().padStart(6, '0')}`;
    }

    /**
     * Soft delete an invoice
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingInvoices)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingInvoices.id, id), isNull(billingInvoices.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Invoice with id ${id} not found`);
        }
    }

    // ==================== Invoice Lines ====================

    /**
     * Create invoice line
     */
    async createLine(input: QZPayBillingInvoiceLineInsert): Promise<QZPayBillingInvoiceLine> {
        const result = await this.db.insert(billingInvoiceLines).values(input).returning();
        return firstOrThrow(result, 'InvoiceLine', 'new');
    }

    /**
     * Create multiple invoice lines
     */
    async createLines(inputs: QZPayBillingInvoiceLineInsert[]): Promise<QZPayBillingInvoiceLine[]> {
        if (inputs.length === 0) return [];

        return this.db.insert(billingInvoiceLines).values(inputs).returning();
    }

    /**
     * Find lines by invoice ID
     */
    async findLinesByInvoiceId(invoiceId: string): Promise<QZPayBillingInvoiceLine[]> {
        return this.db.select().from(billingInvoiceLines).where(eq(billingInvoiceLines.invoiceId, invoiceId));
    }

    /**
     * Delete lines by invoice ID
     */
    async deleteLinesByInvoiceId(invoiceId: string): Promise<void> {
        await this.db.delete(billingInvoiceLines).where(eq(billingInvoiceLines.invoiceId, invoiceId));
    }

    // ==================== Invoice Payments ====================

    /**
     * Record invoice payment
     */
    async recordPayment(input: QZPayBillingInvoicePaymentInsert): Promise<QZPayBillingInvoicePayment> {
        const result = await this.db.insert(billingInvoicePayments).values(input).returning();
        return firstOrThrow(result, 'InvoicePayment', 'new');
    }

    /**
     * Find payments for invoice
     */
    async findPaymentsByInvoiceId(invoiceId: string): Promise<QZPayBillingInvoicePayment[]> {
        return this.db
            .select()
            .from(billingInvoicePayments)
            .where(eq(billingInvoicePayments.invoiceId, invoiceId))
            .orderBy(sql`${billingInvoicePayments.appliedAt} DESC`);
    }

    /**
     * Get total paid amount for invoice
     */
    async getTotalPaidAmount(invoiceId: string): Promise<number> {
        const result = await this.db
            .select({ total: sql<number>`COALESCE(SUM(amount_applied), 0)::int` })
            .from(billingInvoicePayments)
            .where(eq(billingInvoicePayments.invoiceId, invoiceId));

        return result[0]?.total ?? 0;
    }

    /**
     * Get invoice with lines
     */
    async findWithLines(id: string): Promise<{ invoice: QZPayBillingInvoice; lines: QZPayBillingInvoiceLine[] } | null> {
        const invoice = await this.findById(id);
        if (!invoice) return null;

        const lines = await this.findLinesByInvoiceId(id);

        return { invoice, lines };
    }
}
