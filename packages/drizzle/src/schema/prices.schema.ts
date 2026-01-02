/**
 * Prices schema for QZPay billing
 *
 * Stores price configurations for plans (monthly, yearly, etc.)
 */
import { boolean, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { billingPlans } from './plans.schema.js';

/**
 * Billing prices table
 *
 * Each plan can have multiple prices (different currencies, intervals).
 * Supports provider-specific price IDs for Stripe, MercadoPago, etc.
 */
export const billingPrices = pgTable(
    'billing_prices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planId: uuid('plan_id')
            .notNull()
            .references(() => billingPlans.id, { onDelete: 'cascade' }),
        nickname: varchar('nickname', { length: 255 }),
        currency: varchar('currency', { length: 3 }).notNull(),
        unitAmount: integer('unit_amount').notNull(),
        billingInterval: varchar('billing_interval', { length: 50 }).notNull(),
        intervalCount: integer('interval_count').notNull().default(1),
        trialDays: integer('trial_days'),
        active: boolean('active').notNull().default(true),
        stripePriceId: varchar('stripe_price_id', { length: 255 }),
        mpPriceId: varchar('mp_price_id', { length: 255 }),
        metadata: jsonb('metadata').notNull().default({}),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        planIdIdx: index('idx_prices_plan_id').on(table.planId),
        activeIdx: index('idx_prices_active').on(table.active),
        stripePriceIdIdx: index('idx_prices_stripe_price_id').on(table.stripePriceId),
        mpPriceIdIdx: index('idx_prices_mp_price_id').on(table.mpPriceId),
        currencyIntervalIdx: index('idx_prices_currency_interval').on(table.currency, table.billingInterval)
    })
);

/**
 * Type for billing price record
 */
export type QZPayBillingPrice = typeof billingPrices.$inferSelect;

/**
 * Type for creating a new billing price
 */
export type QZPayBillingPriceInsert = typeof billingPrices.$inferInsert;

/**
 * Zod schema for validating price inserts
 */
export const billingPriceInsertSchema = createInsertSchema(billingPrices);

/**
 * Zod schema for validating price selects
 */
export const billingPriceSelectSchema = createSelectSchema(billingPrices);

/**
 * Type for price insert validation
 */
export type QZPayBillingPriceInsertInput = z.infer<typeof billingPriceInsertSchema>;
