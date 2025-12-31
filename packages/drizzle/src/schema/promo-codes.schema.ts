/**
 * Promo codes schema for QZPay billing
 *
 * Stores promotional code definitions and usage tracking.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

/**
 * Billing promo codes table
 *
 * Defines promotional codes with various discount types and restrictions.
 */
export const billingPromoCodes = pgTable(
    'billing_promo_codes',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        code: varchar('code', { length: 50 }).notNull().unique(),
        type: varchar('type', { length: 50 }).notNull(),
        value: integer('value').notNull(),
        config: jsonb('config').default({}),
        maxUses: integer('max_uses'),
        usedCount: integer('used_count').default(0),
        maxPerCustomer: integer('max_per_customer').default(1),
        validPlans: text('valid_plans').array(),
        newCustomersOnly: boolean('new_customers_only').default(false),
        existingCustomersOnly: boolean('existing_customers_only').default(false),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        combinable: boolean('combinable').default(false),
        active: boolean('active').default(true),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        codeIdx: index('idx_promo_codes_code').on(table.code),
        activeIdx: index('idx_promo_codes_active').on(table.active)
    })
);

/**
 * Billing promo code usage table
 *
 * Tracks which customers have used which promo codes.
 */
export const billingPromoCodeUsage = pgTable(
    'billing_promo_code_usage',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        promoCodeId: uuid('promo_code_id')
            .notNull()
            .references(() => billingPromoCodes.id, { onDelete: 'cascade' }),
        customerId: uuid('customer_id').notNull(),
        subscriptionId: uuid('subscription_id'),
        discountAmount: integer('discount_amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
        livemode: boolean('livemode').notNull().default(true)
    },
    (table) => ({
        codeIdx: index('idx_promo_usage_code').on(table.promoCodeId),
        customerIdx: index('idx_promo_usage_customer').on(table.customerId)
    })
);

/**
 * Type for billing promo code record
 */
export type QZPayBillingPromoCode = typeof billingPromoCodes.$inferSelect;

/**
 * Type for creating a new billing promo code
 */
export type QZPayBillingPromoCodeInsert = typeof billingPromoCodes.$inferInsert;

/**
 * Type for promo code usage record
 */
export type QZPayBillingPromoCodeUsage = typeof billingPromoCodeUsage.$inferSelect;

/**
 * Type for creating promo code usage record
 */
export type QZPayBillingPromoCodeUsageInsert = typeof billingPromoCodeUsage.$inferInsert;

/**
 * Zod schema for validating promo code inserts
 */
export const billingPromoCodeInsertSchema = createInsertSchema(billingPromoCodes);

/**
 * Zod schema for validating promo code selects
 */
export const billingPromoCodeSelectSchema = createSelectSchema(billingPromoCodes);

/**
 * Type for promo code insert validation
 */
export type QZPayBillingPromoCodeInsertInput = z.infer<typeof billingPromoCodeInsertSchema>;
