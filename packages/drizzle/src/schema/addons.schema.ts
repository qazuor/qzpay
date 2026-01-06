/**
 * Add-ons schema for QZPay billing
 *
 * Stores add-on definitions and subscription add-on associations.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingSubscriptions } from './subscriptions.schema.js';

/**
 * Billing add-ons table
 *
 * Defines add-on products that can be purchased alongside subscriptions.
 * Add-ons can be one-time or recurring, and can grant entitlements/limits.
 */
export const billingAddons = pgTable(
    'billing_addons',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description'),
        active: boolean('active').notNull().default(true),
        unitAmount: integer('unit_amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        billingInterval: varchar('billing_interval', { length: 50 }).notNull(),
        billingIntervalCount: integer('billing_interval_count').notNull().default(1),
        compatiblePlanIds: text('compatible_plan_ids').array().notNull().default([]),
        allowMultiple: boolean('allow_multiple').notNull().default(false),
        maxQuantity: integer('max_quantity'),
        entitlements: text('entitlements').array().notNull().default([]),
        limits: jsonb('limits').notNull().default([]),
        metadata: jsonb('metadata').notNull().default({}),
        livemode: boolean('livemode').notNull().default(true),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        activeIdx: index('idx_addons_active').on(table.active),
        livemodeIdx: index('idx_addons_livemode').on(table.livemode),
        billingIntervalIdx: index('idx_addons_billing_interval').on(table.billingInterval)
    })
);

/**
 * Type for billing add-on record
 */
export type QZPayBillingAddon = typeof billingAddons.$inferSelect;

/**
 * Type for creating a new billing add-on
 */
export type QZPayBillingAddonInsert = typeof billingAddons.$inferInsert;

/**
 * Zod schema for validating add-on inserts
 */
export const billingAddonInsertSchema = createInsertSchema(billingAddons);

/**
 * Zod schema for validating add-on selects
 */
export const billingAddonSelectSchema = createSelectSchema(billingAddons);

/**
 * Type for add-on insert validation
 */
export type QZPayBillingAddonInsertInput = z.infer<typeof billingAddonInsertSchema>;

/**
 * Billing subscription add-ons table
 *
 * Tracks add-ons attached to subscriptions with quantity and pricing.
 */
export const billingSubscriptionAddons = pgTable(
    'billing_subscription_addons',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        addOnId: uuid('addon_id')
            .notNull()
            .references(() => billingAddons.id, { onDelete: 'restrict' }),
        quantity: integer('quantity').notNull().default(1),
        unitAmount: integer('unit_amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        status: varchar('status', { length: 50 }).notNull().default('active'),
        addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
        canceledAt: timestamp('canceled_at', { withTimezone: true }),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        metadata: jsonb('metadata').notNull().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        subscriptionIdx: index('idx_subscription_addons_subscription').on(table.subscriptionId),
        addonIdx: index('idx_subscription_addons_addon').on(table.addOnId),
        statusIdx: index('idx_subscription_addons_status').on(table.status),
        subscriptionAddonIdx: index('idx_subscription_addons_composite').on(table.subscriptionId, table.addOnId)
    })
);

/**
 * Type for billing subscription add-on record
 */
export type QZPayBillingSubscriptionAddon = typeof billingSubscriptionAddons.$inferSelect;

/**
 * Type for creating a new billing subscription add-on
 */
export type QZPayBillingSubscriptionAddonInsert = typeof billingSubscriptionAddons.$inferInsert;

/**
 * Zod schema for validating subscription add-on inserts
 */
export const billingSubscriptionAddonInsertSchema = createInsertSchema(billingSubscriptionAddons);

/**
 * Zod schema for validating subscription add-on selects
 */
export const billingSubscriptionAddonSelectSchema = createSelectSchema(billingSubscriptionAddons);

/**
 * Type for subscription add-on insert validation
 */
export type QZPayBillingSubscriptionAddonInsertInput = z.infer<typeof billingSubscriptionAddonInsertSchema>;
