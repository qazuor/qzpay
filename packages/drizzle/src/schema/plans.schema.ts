/**
 * Plans schema for QZPay billing
 *
 * Stores subscription plan definitions with features, entitlements, and limits.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

/**
 * Billing plans table
 *
 * Defines subscription plans that customers can subscribe to.
 * Each plan can have multiple prices (monthly, yearly, etc.)
 */
export const billingPlans = pgTable(
    'billing_plans',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description'),
        active: boolean('active').notNull().default(true),
        features: jsonb('features').notNull().default([]),
        entitlements: text('entitlements').array().notNull().default([]),
        limits: jsonb('limits').notNull().default({}),
        metadata: jsonb('metadata').notNull().default({}),
        displayName: varchar('display_name', { length: 255 }).notNull(),
        monthlyPriceArs: integer('monthly_price_ars').notNull(),
        annualPriceArs: integer('annual_price_ars'),
        /**
         * Free-form discriminator for the product/business line this plan
         * belongs to (see `billingSubscriptions.productDomain` for the
         * matching field on subscriptions). QZPay has no opinion on the
         * value set; the consuming application defines and interprets its
         * own domain values, e.g. to exclude plans in one domain from a
         * public listing scoped to another.
         *
         * **There is no default, deliberately**, for the reasons spelled out
         * on `billingSubscriptions.productDomain`: the one there used to be
         * named a specific application's product line inside a generic
         * payments package, and a plan that omitted the column was not filed
         * under "no domain" — it was filed under that one. Every plan write
         * states its own domain, and one that does not is a `NOT NULL`
         * violation rather than a plausible wrong row.
         *
         * The same upgrade caveat applies: an existing database keeps its
         * column default until the consumer runs `ALTER TABLE billing_plans
         * ALTER COLUMN product_domain DROP DEFAULT`.
         */
        productDomain: varchar('product_domain', { length: 32 }).notNull(),
        livemode: boolean('livemode').notNull().default(true),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        activeIdx: index('idx_plans_active').on(table.active),
        livemodeIdx: index('idx_plans_livemode').on(table.livemode),
        productDomainIdx: index('idx_plans_product_domain').on(table.productDomain)
    })
);

/**
 * Type for billing plan record
 */
export type QZPayBillingPlan = typeof billingPlans.$inferSelect;

/**
 * Type for creating a new billing plan
 */
export type QZPayBillingPlanInsert = typeof billingPlans.$inferInsert;

/**
 * Zod schema for validating plan inserts
 */
export const billingPlanInsertSchema = createInsertSchema(billingPlans);

/**
 * Zod schema for validating plan selects
 */
export const billingPlanSelectSchema = createSelectSchema(billingPlans);

/**
 * Type for plan insert validation
 */
export type QZPayBillingPlanInsertInput = z.infer<typeof billingPlanInsertSchema>;
