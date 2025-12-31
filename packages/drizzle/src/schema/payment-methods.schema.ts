/**
 * Payment methods schema for QZPay billing
 *
 * Stores customer payment method information.
 */
import { boolean, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingCustomers } from './customers.schema.js';

/**
 * Billing payment methods table
 *
 * Stores payment methods (cards, bank accounts) for customers.
 */
export const billingPaymentMethods = pgTable(
    'billing_payment_methods',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'cascade' }),
        provider: varchar('provider', { length: 50 }).notNull(),
        providerPaymentMethodId: varchar('provider_payment_method_id', { length: 255 }).notNull(),
        type: varchar('type', { length: 50 }).notNull(),
        lastFour: varchar('last_four', { length: 4 }),
        brand: varchar('brand', { length: 50 }),
        expMonth: integer('exp_month'),
        expYear: integer('exp_year'),
        isDefault: boolean('is_default').default(false),
        billingDetails: jsonb('billing_details'),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        customerIdx: index('idx_payment_methods_customer').on(table.customerId),
        providerIdIdx: index('idx_payment_methods_provider_id').on(table.providerPaymentMethodId)
    })
);

/**
 * Type for billing payment method record
 */
export type QZPayBillingPaymentMethod = typeof billingPaymentMethods.$inferSelect;

/**
 * Type for creating a new billing payment method
 */
export type QZPayBillingPaymentMethodInsert = typeof billingPaymentMethods.$inferInsert;

/**
 * Zod schema for validating payment method inserts
 */
export const billingPaymentMethodInsertSchema = createInsertSchema(billingPaymentMethods);

/**
 * Zod schema for validating payment method selects
 */
export const billingPaymentMethodSelectSchema = createSelectSchema(billingPaymentMethods);

/**
 * Type for payment method insert validation
 */
export type QZPayBillingPaymentMethodInsertInput = z.infer<typeof billingPaymentMethodInsertSchema>;
