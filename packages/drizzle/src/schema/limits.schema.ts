/**
 * Limits schema for QZPay billing
 *
 * Stores limit definitions and customer allocations for usage-based billing.
 */
import { boolean, index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { billingCustomers } from './customers.schema.js';

/**
 * Billing limits table
 *
 * Defines available limits (quotas) that can be assigned to customers.
 * Each limit has a unique key and a default value.
 */
export const billingLimits = pgTable(
    'billing_limits',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        key: varchar('key', { length: 100 }).notNull().unique(),
        name: varchar('name', { length: 255 }).notNull(),
        description: varchar('description', { length: 1000 }),
        defaultValue: integer('default_value').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        keyIdx: index('idx_limits_key').on(table.key)
    })
);

/**
 * Type for billing limit record
 */
export type QZPayBillingLimit = typeof billingLimits.$inferSelect;

/**
 * Type for creating a new billing limit
 */
export type QZPayBillingLimitInsert = typeof billingLimits.$inferInsert;

/**
 * Zod schema for validating limit inserts
 */
export const billingLimitInsertSchema = createInsertSchema(billingLimits);

/**
 * Zod schema for validating limit selects
 */
export const billingLimitSelectSchema = createSelectSchema(billingLimits);

/**
 * Type for limit insert validation
 */
export type QZPayBillingLimitInsertInput = z.infer<typeof billingLimitInsertSchema>;

/**
 * Customer limits table
 *
 * Tracks limit allocations and current usage for each customer.
 * Supports time-based resets and source tracking.
 */
export const billingCustomerLimits = pgTable(
    'billing_customer_limits',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'cascade' }),
        limitKey: varchar('limit_key', { length: 100 }).notNull(),
        maxValue: integer('max_value').notNull(),
        currentValue: integer('current_value').notNull().default(0),
        resetAt: timestamp('reset_at', { withTimezone: true }),
        source: varchar('source', { length: 50 }).notNull(),
        sourceId: uuid('source_id'),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        customerIdIdx: index('idx_customer_limits_customer_id').on(table.customerId),
        limitKeyIdx: index('idx_customer_limits_key').on(table.limitKey),
        customerKeyIdx: index('idx_customer_limits_customer_key').on(table.customerId, table.limitKey),
        resetAtIdx: index('idx_customer_limits_reset_at').on(table.resetAt)
    })
);

/**
 * Type for customer limit record
 */
export type QZPayBillingCustomerLimit = typeof billingCustomerLimits.$inferSelect;

/**
 * Type for creating a new customer limit
 */
export type QZPayBillingCustomerLimitInsert = typeof billingCustomerLimits.$inferInsert;

/**
 * Zod schema for validating customer limit inserts
 */
export const billingCustomerLimitInsertSchema = createInsertSchema(billingCustomerLimits);

/**
 * Zod schema for validating customer limit selects
 */
export const billingCustomerLimitSelectSchema = createSelectSchema(billingCustomerLimits);

/**
 * Type for customer limit insert validation
 */
export type QZPayBillingCustomerLimitInsertInput = z.infer<typeof billingCustomerLimitInsertSchema>;
