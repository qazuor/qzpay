/**
 * Subscriptions schema for QZPay billing
 *
 * Stores subscription records with complete lifecycle data.
 */
import { sql } from 'drizzle-orm';
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
        /**
         * Free-form discriminator for the product/business line this
         * subscription belongs to — a consuming app with several distinct
         * offerings uses it to keep them apart. QZPay itself has no opinion
         * on the value set: the consuming application defines and
         * interprets its own domain values.
         *
         * **There is no default, deliberately.** There used to be one, and it
         * held one specific application's product line — which a generic
         * payments package has no business knowing. Worse, it did not do what
         * a default appears to do here: a caller that omitted the column did
         * not get "no domain", it got that one. An application's secondary
         * product lines were therefore filed under its primary one, in every
         * row, without a single line of code being wrong. That is not a
         * hypothetical — it is what this default did in production, across two
         * databases, for as long as those product lines had existed.
         *
         * With the column `NOT NULL` and no default, an omitted write is a
         * `NOT NULL` violation at the first insert: loud, immediate, and
         * impossible to mistake for a correct row. State the domain on every
         * write; `QZPayCreateSubscriptionInput.productDomain` is required for
         * the same reason.
         *
         * **Upgrading does not by itself change an existing database.**
         * Dropping the default here changes the DDL emitted for a NEW
         * database; a database created before this version keeps its column
         * default until the consumer runs `ALTER TABLE billing_subscriptions
         * ALTER COLUMN product_domain DROP DEFAULT`. Until that migration
         * runs, an omitted write still silently succeeds. Verify every write
         * states the domain BEFORE dropping it — afterwards, one that does not
         * takes down the checkout it sits in.
         */
        productDomain: varchar('product_domain', { length: 32 }).notNull(),
        /**
         * Plan change scheduled to apply at a future point in time
         * (typically `current_period_end`). Stored as JSONB so the
         * shape can evolve without a migration; conforms to
         * `QZPayScheduledPlanChange` in qzpay-core. Null when no
         * change is pending. The application-level scheduler (cron)
         * owns the lifecycle — qzpay-drizzle provides storage only.
         */
        scheduledPlanChange: jsonb('scheduled_plan_change'),
        /**
         * Countdown of remaining billing cycles for a multi-cycle promo
         * effect (see `billingPromoCodes.durationCycles`). Null when no
         * limited-duration effect is active (either no effect, an
         * effect that applies forever, or a non-discount effect kind).
         * Decremented by the consuming application's renewal logic
         * after each confirmed charge; QZPay provides storage only.
         */
        promoEffectRemainingCycles: integer('promo_effect_remaining_cycles'),
        /**
         * Start of a complimentary ("courtesy") window granted to a
         * subscriber who is already paying — the point the gift begins,
         * which is normally the end of the period they already paid for
         * rather than the instant it was granted. Null when no gift was
         * given. QZPay provides storage only; the consuming application
         * decides when a window opens and what it entitles.
         */
        courtesyStartsAt: timestamp('courtesy_starts_at', { withTimezone: true }),
        /**
         * End of the complimentary window opened by
         * {@link billingSubscriptions.courtesyStartsAt}. Null when no gift
         * was given. The three courtesy columns are written together: a
         * window with an end but no start (or vice versa) is a half-written
         * record, and a consumer that treats it as live would hand out free
         * entitlements.
         */
        courtesyEndsAt: timestamp('courtesy_ends_at', { withTimezone: true }),
        /**
         * How many billing cycles the complimentary window covers, kept for
         * display and audit — the window's authority is the start/end pair
         * above, not this count. Null when no gift was given.
         */
        courtesyCyclesGranted: integer('courtesy_cycles_granted'),
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
        productDomainIdx: index('idx_subscriptions_product_domain').on(table.productDomain),

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
        lifecycleCancelIdx: index('idx_subscriptions_lifecycle_cancel').on(table.cancelAtPeriodEnd, table.status, table.currentPeriodEnd),
        // Partial index for the scheduled-plan-change cron query —
        // only rows with a pending scheduled change need to be
        // scanned, so a partial index keeps the per-tick cost O(k)
        // where k = #pending changes (NOT O(n) full table scan).
        lifecyclePendingPlanChangeIdx: index('idx_subscriptions_pending_plan_change')
            .on(table.scheduledPlanChange)
            .where(sql`scheduled_plan_change IS NOT NULL AND (scheduled_plan_change->>'status') = 'pending'`),
        // Partial index for the courtesy-expiry cron query — only rows
        // inside a complimentary window can expire, and they are a small
        // minority of the table, so indexing just those keeps the per-tick
        // cost proportional to #open gifts rather than #subscriptions.
        lifecycleCourtesyExpiryIdx: index('idx_subscriptions_courtesy_expiry')
            .on(table.courtesyEndsAt)
            .where(sql`courtesy_ends_at IS NOT NULL`)
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
