/**
 * Payments schema for QZPay billing
 *
 * Stores payment transaction records.
 */
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
 * Tracks refunds for payments.
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
        providerIdIdx: index('idx_refunds_provider_id').on(table.providerRefundId)
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
