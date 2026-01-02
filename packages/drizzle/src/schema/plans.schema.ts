/**
 * Plans schema for QZPay billing
 *
 * Stores subscription plan definitions with features, entitlements, and limits.
 */
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
        livemode: boolean('livemode').notNull().default(true),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        activeIdx: index('idx_plans_active').on(table.active),
        livemodeIdx: index('idx_plans_livemode').on(table.livemode)
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
