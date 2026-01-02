/**
 * Entitlements schema for QZPay billing
 *
 * Stores entitlement definitions and customer grants for feature access control.
 */
import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { billingCustomers } from './customers.schema.js';

/**
 * Billing entitlements table
 *
 * Defines available entitlements (features) that can be granted to customers.
 * Each entitlement has a unique key used for access checks.
 */
export const billingEntitlements = pgTable(
    'billing_entitlements',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        key: varchar('key', { length: 100 }).notNull().unique(),
        name: varchar('name', { length: 255 }).notNull(),
        description: varchar('description', { length: 1000 }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        keyIdx: index('idx_entitlements_key').on(table.key)
    })
);

/**
 * Type for billing entitlement record
 */
export type QZPayBillingEntitlement = typeof billingEntitlements.$inferSelect;

/**
 * Type for creating a new billing entitlement
 */
export type QZPayBillingEntitlementInsert = typeof billingEntitlements.$inferInsert;

/**
 * Zod schema for validating entitlement inserts
 */
export const billingEntitlementInsertSchema = createInsertSchema(billingEntitlements);

/**
 * Zod schema for validating entitlement selects
 */
export const billingEntitlementSelectSchema = createSelectSchema(billingEntitlements);

/**
 * Type for entitlement insert validation
 */
export type QZPayBillingEntitlementInsertInput = z.infer<typeof billingEntitlementInsertSchema>;

/**
 * Customer entitlements table
 *
 * Tracks which entitlements are granted to which customers.
 * Supports time-limited grants and source tracking (subscription, purchase, manual).
 */
export const billingCustomerEntitlements = pgTable(
    'billing_customer_entitlements',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'cascade' }),
        entitlementKey: varchar('entitlement_key', { length: 100 }).notNull(),
        grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        source: varchar('source', { length: 50 }).notNull(),
        sourceId: uuid('source_id'),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        customerIdIdx: index('idx_customer_entitlements_customer_id').on(table.customerId),
        entitlementKeyIdx: index('idx_customer_entitlements_key').on(table.entitlementKey),
        customerKeyIdx: index('idx_customer_entitlements_customer_key').on(table.customerId, table.entitlementKey),
        expiresAtIdx: index('idx_customer_entitlements_expires_at').on(table.expiresAt)
    })
);

/**
 * Type for customer entitlement record
 */
export type QZPayBillingCustomerEntitlement = typeof billingCustomerEntitlements.$inferSelect;

/**
 * Type for creating a new customer entitlement
 */
export type QZPayBillingCustomerEntitlementInsert = typeof billingCustomerEntitlements.$inferInsert;

/**
 * Zod schema for validating customer entitlement inserts
 */
export const billingCustomerEntitlementInsertSchema = createInsertSchema(billingCustomerEntitlements);

/**
 * Zod schema for validating customer entitlement selects
 */
export const billingCustomerEntitlementSelectSchema = createSelectSchema(billingCustomerEntitlements);

/**
 * Type for customer entitlement insert validation
 */
export type QZPayBillingCustomerEntitlementInsertInput = z.infer<typeof billingCustomerEntitlementInsertSchema>;
