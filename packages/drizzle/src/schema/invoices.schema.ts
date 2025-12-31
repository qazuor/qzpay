/**
 * Invoices schema for QZPay billing
 *
 * Stores invoice records as legal documents.
 */
import { boolean, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingCustomers } from './customers.schema.js';
import { billingSubscriptions } from './subscriptions.schema.js';

/**
 * Billing invoices table
 *
 * Legal invoice documents with line items, discounts, and tax.
 */
export const billingInvoices = pgTable(
    'billing_invoices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'restrict' }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id),
        number: varchar('number', { length: 50 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        subtotal: integer('subtotal').notNull(),
        discount: integer('discount').default(0),
        tax: integer('tax').default(0),
        total: integer('total').notNull(),
        amountPaid: integer('amount_paid').default(0),
        amountRemaining: integer('amount_remaining'),
        currency: varchar('currency', { length: 3 }).notNull(),
        dueDate: timestamp('due_date', { withTimezone: true }),
        paidAt: timestamp('paid_at', { withTimezone: true }),
        voidedAt: timestamp('voided_at', { withTimezone: true }),
        periodStart: timestamp('period_start', { withTimezone: true }),
        periodEnd: timestamp('period_end', { withTimezone: true }),
        stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
        mpInvoiceId: varchar('mp_invoice_id', { length: 255 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        customerIdx: index('idx_invoices_customer').on(table.customerId),
        subscriptionIdx: index('idx_invoices_subscription').on(table.subscriptionId),
        statusIdx: index('idx_invoices_status').on(table.status),
        numberIdx: index('idx_invoices_number').on(table.number),
        dueDateIdx: index('idx_invoices_due_date').on(table.dueDate)
    })
);

/**
 * Billing invoice lines table
 *
 * Individual line items on an invoice.
 */
export const billingInvoiceLines = pgTable(
    'billing_invoice_lines',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        invoiceId: uuid('invoice_id')
            .notNull()
            .references(() => billingInvoices.id, { onDelete: 'cascade' }),
        description: varchar('description', { length: 500 }).notNull(),
        quantity: integer('quantity').notNull().default(1),
        unitAmount: integer('unit_amount').notNull(),
        amount: integer('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        priceId: varchar('price_id', { length: 255 }),
        periodStart: timestamp('period_start', { withTimezone: true }),
        periodEnd: timestamp('period_end', { withTimezone: true }),
        proration: boolean('proration').default(false),
        metadata: jsonb('metadata').default({})
    },
    (table) => ({
        invoiceIdx: index('idx_invoice_lines_invoice').on(table.invoiceId)
    })
);

/**
 * Billing invoice payments junction table
 *
 * Links invoices to payments for partial payment support.
 */
export const billingInvoicePayments = pgTable(
    'billing_invoice_payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        invoiceId: uuid('invoice_id')
            .notNull()
            .references(() => billingInvoices.id, { onDelete: 'cascade' }),
        paymentId: uuid('payment_id').notNull(),
        amountApplied: integer('amount_applied').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
        livemode: boolean('livemode').notNull().default(true)
    },
    (table) => ({
        invoiceIdx: index('idx_invoice_payments_invoice').on(table.invoiceId),
        paymentIdx: index('idx_invoice_payments_payment').on(table.paymentId)
    })
);

/**
 * Type for billing invoice record
 */
export type QZPayBillingInvoice = typeof billingInvoices.$inferSelect;

/**
 * Type for creating a new billing invoice
 */
export type QZPayBillingInvoiceInsert = typeof billingInvoices.$inferInsert;

/**
 * Type for invoice line record
 */
export type QZPayBillingInvoiceLine = typeof billingInvoiceLines.$inferSelect;

/**
 * Type for creating invoice line
 */
export type QZPayBillingInvoiceLineInsert = typeof billingInvoiceLines.$inferInsert;

/**
 * Type for invoice payment record
 */
export type QZPayBillingInvoicePayment = typeof billingInvoicePayments.$inferSelect;

/**
 * Type for creating invoice payment
 */
export type QZPayBillingInvoicePaymentInsert = typeof billingInvoicePayments.$inferInsert;

/**
 * Zod schema for validating invoice inserts
 */
export const billingInvoiceInsertSchema = createInsertSchema(billingInvoices);

/**
 * Zod schema for validating invoice selects
 */
export const billingInvoiceSelectSchema = createSelectSchema(billingInvoices);

/**
 * Type for invoice insert validation
 */
export type QZPayBillingInvoiceInsertInput = z.infer<typeof billingInvoiceInsertSchema>;
