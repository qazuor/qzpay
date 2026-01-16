/**
 * Subscriptions schema for QZPay billing
 *
 * Stores subscription records with complete lifecycle data.
 */
import { boolean, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingCustomers } from './customers.schema.js';
import { billingPromoCodes } from './promo-codes.schema.js';

/**
 * Billing subscriptions table
 *
 * Tracks subscription lifecycle from creation to cancellation.
 * Supports trials, grace periods, and payment retries.
 */
export const billingSubscriptions = pgTable(
    'billing_subscriptions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'restrict' }),
        planId: varchar('plan_id', { length: 255 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        billingInterval: varchar('billing_interval', { length: 50 }).notNull(),
        intervalCount: integer('interval_count').default(1),
        currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
        currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
        trialStart: timestamp('trial_start', { withTimezone: true }),
        trialEnd: timestamp('trial_end', { withTimezone: true }),
        trialConverted: boolean('trial_converted').default(false),
        trialConvertedAt: timestamp('trial_converted_at', { withTimezone: true }),
        cancelAt: timestamp('cancel_at', { withTimezone: true }),
        canceledAt: timestamp('canceled_at', { withTimezone: true }),
        cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
        endedAt: timestamp('ended_at', { withTimezone: true }),
        promoCodeId: uuid('promo_code_id').references(() => billingPromoCodes.id),
        defaultPaymentMethodId: uuid('default_payment_method_id'),
        gracePeriodEndsAt: timestamp('grace_period_ends_at', { withTimezone: true }),
        retryCount: integer('retry_count').default(0),
        nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
        stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
        mpSubscriptionId: varchar('mp_subscription_id', { length: 255 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        // Basic indexes
        customerIdx: index('idx_subscriptions_customer').on(table.customerId),
        statusIdx: index('idx_subscriptions_status').on(table.status),
        customerStatusIdx: index('idx_subscriptions_customer_status').on(table.customerId, table.status),
        stripeIdIdx: index('idx_subscriptions_stripe_id').on(table.stripeSubscriptionId),
        mpIdIdx: index('idx_subscriptions_mp_id').on(table.mpSubscriptionId),
        renewalIdx: index('idx_subscriptions_renewal').on(table.currentPeriodEnd),

        // Lifecycle optimization indexes
        // Supports findNeedingRenewal() query
        lifecycleRenewalIdx: index('idx_subscriptions_lifecycle_renewal').on(
            table.status,
            table.livemode,
            table.currentPeriodEnd,
            table.cancelAtPeriodEnd
        ),
        // Supports findNeedingRetry() query
        lifecycleRetryIdx: index('idx_subscriptions_lifecycle_retry').on(table.status, table.nextRetryAt, table.gracePeriodEndsAt),
        // Supports findWithExpiredGracePeriod() query
        lifecycleGraceIdx: index('idx_subscriptions_lifecycle_grace').on(table.status, table.gracePeriodEndsAt),
        // Supports findTrialsEndingSoon() query
        lifecycleTrialIdx: index('idx_subscriptions_lifecycle_trial').on(table.status, table.trialEnd),
        // Supports findScheduledForCancellation() query
        lifecycleCancelIdx: index('idx_subscriptions_lifecycle_cancel').on(table.cancelAtPeriodEnd, table.status, table.currentPeriodEnd)
    })
);

/**
 * Type for billing subscription record
 */
export type QZPayBillingSubscription = typeof billingSubscriptions.$inferSelect;

/**
 * Type for creating a new billing subscription
 */
export type QZPayBillingSubscriptionInsert = typeof billingSubscriptions.$inferInsert;

/**
 * Zod schema for validating subscription inserts
 */
export const billingSubscriptionInsertSchema = createInsertSchema(billingSubscriptions);

/**
 * Zod schema for validating subscription selects
 */
export const billingSubscriptionSelectSchema = createSelectSchema(billingSubscriptions);

/**
 * Type for subscription insert validation
 */
export type QZPayBillingSubscriptionInsertInput = z.infer<typeof billingSubscriptionInsertSchema>;
