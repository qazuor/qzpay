/**
 * Webhook events schema for QZPay billing
 *
 * Stores webhook event processing records.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * Billing webhook events table
 *
 * Records processed webhook events for idempotency.
 */
export const billingWebhookEvents = pgTable(
    'billing_webhook_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
        provider: varchar('provider', { length: 50 }).notNull(),
        type: varchar('type', { length: 100 }).notNull(),
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        payload: jsonb('payload').notNull(),
        processedAt: timestamp('processed_at', { withTimezone: true }),
        error: text('error'),
        attempts: integer('attempts').default(0),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        providerIdIdx: index('idx_webhook_events_provider_id').on(table.providerEventId),
        typeIdx: index('idx_webhook_events_type').on(table.type),
        statusIdx: index('idx_webhook_events_status').on(table.status)
    })
);

/**
 * Billing webhook dead letter queue table
 *
 * Failed webhook events that need manual intervention.
 */
export const billingWebhookDeadLetter = pgTable(
    'billing_webhook_dead_letter',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
        provider: varchar('provider', { length: 50 }).notNull(),
        type: varchar('type', { length: 100 }).notNull(),
        payload: jsonb('payload').notNull(),
        error: text('error').notNull(),
        attempts: integer('attempts').notNull(),
        resolvedAt: timestamp('resolved_at', { withTimezone: true }),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        providerIdIdx: index('idx_dead_letter_provider_id').on(table.providerEventId),
        resolvedIdx: index('idx_dead_letter_resolved').on(table.resolvedAt)
    })
);

/**
 * Type for webhook event record
 */
export type QZPayBillingWebhookEvent = typeof billingWebhookEvents.$inferSelect;

/**
 * Type for creating webhook event
 */
export type QZPayBillingWebhookEventInsert = typeof billingWebhookEvents.$inferInsert;

/**
 * Type for dead letter record
 */
export type QZPayBillingWebhookDeadLetter = typeof billingWebhookDeadLetter.$inferSelect;

/**
 * Type for creating dead letter
 */
export type QZPayBillingWebhookDeadLetterInsert = typeof billingWebhookDeadLetter.$inferInsert;

/**
 * Zod schema for validating webhook event inserts
 */
export const billingWebhookEventInsertSchema = createInsertSchema(billingWebhookEvents);

/**
 * Zod schema for validating webhook event selects
 */
export const billingWebhookEventSelectSchema = createSelectSchema(billingWebhookEvents);
