/**
 * Checkouts schema for QZPay billing
 *
 * Stores local checkout session records. Persisted by `billing.checkout.create()`
 * BEFORE the provider call so a process crash between provider create and storage
 * write never leaves an orphan checkout on the provider side without a local trace.
 *
 * Webhook handlers correlate provider events back via `external_reference` (which
 * core sets to the local checkout UUID); the matching provider session id is
 * persisted in `provider_session_ids` after the provider call returns.
 */
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingCustomers } from './customers.schema.js';
import { billingPayments } from './payments.schema.js';
import { billingSubscriptions } from './subscriptions.schema.js';

export const billingCheckouts = pgTable(
    'billing_checkouts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id').references(() => billingCustomers.id, { onDelete: 'set null' }),
        customerEmail: varchar('customer_email', { length: 255 }),
        mode: varchar('mode', { length: 50 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        currency: varchar('currency', { length: 10 }).notNull(),
        lineItems: jsonb('line_items').notNull().default([]),
        successUrl: text('success_url').notNull(),
        cancelUrl: text('cancel_url').notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        paymentId: uuid('payment_id').references(() => billingPayments.id),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id),
        providerSessionIds: jsonb('provider_session_ids').notNull().default({}),
        metadata: jsonb('metadata').default({}),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        completedAt: timestamp('completed_at', { withTimezone: true })
    },
    (table) => ({
        customerIdx: index('idx_checkouts_customer').on(table.customerId),
        statusIdx: index('idx_checkouts_status').on(table.status),
        customerStatusIdx: index('idx_checkouts_customer_status').on(table.customerId, table.status),
        expirationIdx: index('idx_checkouts_expiration').on(table.expiresAt)
    })
);

/**
 * Type for billing checkout record (select shape).
 */
export type QZPayBillingCheckout = typeof billingCheckouts.$inferSelect;

/**
 * Type for inserting a new billing checkout record.
 */
export type QZPayBillingCheckoutInsert = typeof billingCheckouts.$inferInsert;

/**
 * Zod schema for validating checkout inserts.
 */
export const billingCheckoutInsertSchema = createInsertSchema(billingCheckouts);

/**
 * Zod schema for validating checkout selects.
 */
export const billingCheckoutSelectSchema = createSelectSchema(billingCheckouts);

/**
 * Type for checkout insert validation.
 */
export type QZPayBillingCheckoutInsertInput = z.infer<typeof billingCheckoutInsertSchema>;
