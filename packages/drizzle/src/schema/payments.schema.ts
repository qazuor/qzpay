/**
 * Payments schema for QZPay billing
 *
 * Stores payment transaction records.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingCustomers } from './customers.schema.js';
import { billingSubscriptions } from './subscriptions.schema.js';

/**
 * Billing payments table
 *
 * Records all payment transactions including successful payments,
 * failures, and refunds.
 */
export const billingPayments = pgTable(
    'billing_payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'restrict' }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id),
        invoiceId: uuid('invoice_id'),
        amount: integer('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        baseAmount: integer('base_amount'),
        baseCurrency: varchar('base_currency', { length: 3 }),
        exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }),
        status: varchar('status', { length: 50 }).notNull(),
        provider: varchar('provider', { length: 50 }).notNull(),
        providerPaymentIds: jsonb('provider_payment_ids').default({}),
        paymentMethodId: uuid('payment_method_id'),
        refundedAmount: integer('refunded_amount').default(0),
        failureCode: varchar('failure_code', { length: 100 }),
        failureMessage: text('failure_message'),
        idempotencyKey: varchar('idempotency_key', { length: 255 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        customerIdx: index('idx_payments_customer').on(table.customerId),
        subscriptionIdx: index('idx_payments_subscription').on(table.subscriptionId),
        statusIdx: index('idx_payments_status').on(table.status),
        idempotencyIdx: index('idx_payments_idempotency').on(table.idempotencyKey)
    })
);

/**
 * Billing refunds table
 *
 * Tracks refunds for payments. Each row is one settled refund EVENT (not
 * a running total) — `billing.payments.refund()` sums them via
 * `getTotalRefundedAmount()` to derive `refunded` vs `partially_refunded`
 * across multiple tranches (HOS-669).
 */
export const billingRefunds = pgTable(
    'billing_refunds',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        paymentId: uuid('payment_id')
            .notNull()
            .references(() => billingPayments.id, { onDelete: 'restrict' }),
        amount: integer('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        reason: varchar('reason', { length: 100 }),
        providerRefundId: varchar('provider_refund_id', { length: 255 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        paymentIdx: index('idx_refunds_payment').on(table.paymentId),
        /**
         * At most one refund event per PROVIDER refund id. Summing
         * `billing_refunds.amount` (HOS-669) turns a duplicated row into
         * an inflated total that can push a payment to `refunded` after
         * returning only part of the money — a realistic trigger is a
         * caller retrying `payments.refund()` after a network blip hid a
         * successful provider response, so the provider replays the SAME
         * refund id on the retry.
         *
         * Replaces the old plain `idx_refunds_provider_id` lookup index —
         * this partial unique index still serves every equality lookup
         * the old one did, for every row that actually carries a
         * provider id.
         *
         * PARTIAL (`WHERE provider_refund_id IS NOT NULL`) because the
         * column is nullable: a local-only refund with no payment adapter
         * configured has no provider id to deduplicate against, and NULLs
         * must never collide with each other under a UNIQUE constraint.
         *
         * `createRefund()` in `payments.repository.ts` targets this index
         * with `onConflictDoNothing`, so a duplicate write is silently
         * ignored rather than throwing.
         */
        providerRefundIdUniqueIdx: uniqueIndex('idx_refunds_provider_refund_id_unique')
            .on(table.providerRefundId)
            .where(sql`provider_refund_id IS NOT NULL`)
    })
);

/**
 * Type for billing payment record
 */
export type QZPayBillingPayment = typeof billingPayments.$inferSelect;

/**
 * Type for creating a new billing payment
 */
export type QZPayBillingPaymentInsert = typeof billingPayments.$inferInsert;

/**
 * Type for billing refund record
 */
export type QZPayBillingRefund = typeof billingRefunds.$inferSelect;

/**
 * Type for creating a new billing refund
 */
export type QZPayBillingRefundInsert = typeof billingRefunds.$inferInsert;

/**
 * Zod schema for validating payment inserts
 */
export const billingPaymentInsertSchema = createInsertSchema(billingPayments);

/**
 * Zod schema for validating payment selects
 */
export const billingPaymentSelectSchema = createSelectSchema(billingPayments);

/**
 * Type for payment insert validation
 */
export type QZPayBillingPaymentInsertInput = z.infer<typeof billingPaymentInsertSchema>;
