/**
 * Subscription polling jobs schema for QZPay billing
 *
 * Stores polling job state for subscription authorization fallback.
 * Used when the provider's subscription webhook delivery is unreliable
 * (e.g., MercadoPago's `subscription_preapproval.created` event that
 * does not arrive reliably). Cron-based pollers consume these rows.
 *
 * See `SPEC-143-billing-testing-coverage/docs/polling-fallback-design.md`.
 */
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { billingSubscriptions } from './subscriptions.schema.js';

/**
 * Billing subscription polling jobs table.
 *
 * Each row represents one polling lifecycle for a single subscription's
 * provider authorization status. After a paid subscription is created
 * and the provider returns a pending status, a job is enqueued here.
 * A cron worker scans `pending` jobs whose `next_poll_at` is due, calls
 * the provider's REST endpoint to fetch current status, and transitions
 * the subscription accordingly. Terminal job statuses (`succeeded`,
 * `failed`, `timeout`, `cancelled`) cause the job to stop being scanned.
 *
 * Optimistic locking via `version` prevents two workers from processing
 * the same job concurrently. A partial unique index on `subscription_id`
 * (where status='pending') prevents enqueuing duplicate active jobs for
 * the same subscription.
 */
export const billingSubscriptionPollingJobs = pgTable(
    'billing_subscription_polling_jobs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        /**
         * Provider identifier, e.g. `mercadopago`. Future-proofed so
         * Stripe or other adapters can opt in to polling if needed.
         */
        provider: varchar('provider', { length: 50 }).notNull(),
        /**
         * Provider-side resource id (e.g. MP preapproval id) that the
         * poller uses to query the provider's REST endpoint.
         */
        providerResourceId: varchar('provider_resource_id', { length: 255 }).notNull(),
        /**
         * Job lifecycle status.
         * - `pending`: cron will pick up when due
         * - `succeeded`: provider returned a terminal authorized state
         * - `failed`: provider returned cancelled/rejected
         * - `timeout`: max_attempts reached without resolution
         * - `cancelled`: cancelled externally (e.g. user cancelled sub mid-flight)
         */
        status: varchar('status', { length: 20 }).notNull().default('pending'),
        attempts: integer('attempts').notNull().default(0),
        maxAttempts: integer('max_attempts').notNull().default(60),
        nextPollAt: timestamp('next_poll_at', { withTimezone: true }).notNull().defaultNow(),
        lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
        /**
         * Raw provider status from the last poll (e.g. `pending`,
         * `authorized`). Useful for diagnostics without joining logs.
         */
        lastProviderStatus: varchar('last_provider_status', { length: 50 }),
        /**
         * Last error message (truncated server-side to avoid bloat).
         * Set when a poll attempt fails (network, 4xx, 5xx).
         */
        lastError: text('last_error'),
        metadata: jsonb('metadata').notNull().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        /**
         * Optimistic lock token. Updated on every state change. Workers
         * must include this in their UPDATE WHERE clause to detect
         * concurrent modifications.
         */
        version: uuid('version').notNull().defaultRandom()
    },
    (table) => ({
        /**
         * Partial index that supports the cron's "find due pending
         * jobs" query. Only rows still pending are scanned, so the
         * per-tick cost is O(k) where k = #pending jobs (NOT a full
         * table scan that would grow with historical job count).
         */
        dueIdx: index('idx_polling_jobs_due').on(table.nextPollAt).where(sql`status = 'pending'`),
        /**
         * Lookup by subscription, e.g. when a webhook arrives and we
         * need to mark the active polling job as `succeeded`.
         */
        subscriptionIdx: index('idx_polling_jobs_subscription').on(table.subscriptionId),
        /**
         * At most one ACTIVE polling job per subscription. Prevents
         * duplicate enqueuing if `schedulePolling()` is called twice
         * concurrently. Historical jobs (succeeded/failed/timeout/
         * cancelled) are NOT constrained — multiple terminal rows per
         * subscription are allowed for audit trail.
         */
        oneActivePerSubscriptionIdx: uniqueIndex('idx_polling_jobs_one_active_per_sub')
            .on(table.subscriptionId)
            .where(sql`status = 'pending'`)
    })
);

/**
 * Type for billing subscription polling job record
 */
export type QZPayBillingSubscriptionPollingJob = typeof billingSubscriptionPollingJobs.$inferSelect;

/**
 * Type for creating a new billing subscription polling job
 */
export type QZPayBillingSubscriptionPollingJobInsert = typeof billingSubscriptionPollingJobs.$inferInsert;

/**
 * Zod schema for validating polling job inserts
 */
export const billingSubscriptionPollingJobInsertSchema = createInsertSchema(billingSubscriptionPollingJobs);

/**
 * Zod schema for validating polling job selects
 */
export const billingSubscriptionPollingJobSelectSchema = createSelectSchema(billingSubscriptionPollingJobs);

/**
 * Type for polling job insert validation
 */
export type QZPayBillingSubscriptionPollingJobInsertInput = z.infer<typeof billingSubscriptionPollingJobInsertSchema>;
