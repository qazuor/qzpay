/**
 * Customers schema for QZPay billing
 *
 * Stores billing customer information linked to external user IDs.
 */
import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

/**
 * Billing customers table
 *
 * Links external application users to billing records.
 * Supports multiple payment provider IDs (Stripe, MercadoPago).
 */
export const billingCustomers = pgTable(
    'billing_customers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        externalId: varchar('external_id', { length: 255 }).notNull(),
        email: varchar('email', { length: 255 }).notNull(),
        name: varchar('name', { length: 255 }),
        phone: varchar('phone', { length: 20 }),
        stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
        mpCustomerId: varchar('mp_customer_id', { length: 255 }),
        preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
        segment: varchar('segment', { length: 50 }),
        tier: varchar('tier', { length: 20 }),
        billingAddress: jsonb('billing_address'),
        shippingAddress: jsonb('shipping_address'),
        taxId: varchar('tax_id', { length: 50 }),
        taxIdType: varchar('tax_id_type', { length: 20 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        externalIdIdx: index('idx_customers_external_id').on(table.externalId),
        emailIdx: index('idx_customers_email').on(table.email),
        stripeIdIdx: index('idx_customers_stripe_id').on(table.stripeCustomerId),
        mpIdIdx: index('idx_customers_mp_id').on(table.mpCustomerId)
    })
);

/**
 * Type for billing customer record
 */
export type QZPayBillingCustomer = typeof billingCustomers.$inferSelect;

/**
 * Type for creating a new billing customer
 */
export type QZPayBillingCustomerInsert = typeof billingCustomers.$inferInsert;

/**
 * Zod schema for validating customer inserts
 */
export const billingCustomerInsertSchema = createInsertSchema(billingCustomers);

/**
 * Zod schema for validating customer selects
 */
export const billingCustomerSelectSchema = createSelectSchema(billingCustomers);

/**
 * Type for customer insert validation
 */
export type QZPayBillingCustomerInsertInput = z.infer<typeof billingCustomerInsertSchema>;
