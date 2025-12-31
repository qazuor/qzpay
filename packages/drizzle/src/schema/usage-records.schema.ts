/**
 * Usage records schema for QZPay billing
 *
 * Stores metered usage records for usage-based billing.
 */
import { boolean, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { billingSubscriptions } from './subscriptions.schema.js';

/**
 * Billing usage records table
 *
 * Records metered usage for usage-based billing models.
 */
export const billingUsageRecords = pgTable(
    'billing_usage_records',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        metricName: varchar('metric_name', { length: 100 }).notNull(),
        quantity: integer('quantity').notNull(),
        action: varchar('action', { length: 20 }).notNull().default('increment'),
        timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
        idempotencyKey: varchar('idempotency_key', { length: 255 }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        subscriptionIdx: index('idx_usage_records_subscription').on(table.subscriptionId),
        metricIdx: index('idx_usage_records_metric').on(table.metricName),
        timestampIdx: index('idx_usage_records_timestamp').on(table.timestamp),
        idempotencyIdx: index('idx_usage_records_idempotency').on(table.idempotencyKey)
    })
);

/**
 * Type for usage record
 */
export type QZPayBillingUsageRecord = typeof billingUsageRecords.$inferSelect;

/**
 * Type for creating usage record
 */
export type QZPayBillingUsageRecordInsert = typeof billingUsageRecords.$inferInsert;

/**
 * Zod schema for validating usage record inserts
 */
export const billingUsageRecordInsertSchema = createInsertSchema(billingUsageRecords);

/**
 * Zod schema for validating usage record selects
 */
export const billingUsageRecordSelectSchema = createSelectSchema(billingUsageRecords);
