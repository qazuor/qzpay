/**
 * Idempotency keys schema for QZPay billing
 *
 * Stores idempotency keys for preventing duplicate operations.
 */
import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * Billing idempotency keys table
 *
 * Stores results of operations to prevent duplicates.
 * Keys expire after 24 hours by default.
 */
export const billingIdempotencyKeys = pgTable(
    'billing_idempotency_keys',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        key: varchar('key', { length: 255 }).notNull().unique(),
        operation: varchar('operation', { length: 100 }).notNull(),
        requestParams: jsonb('request_params'),
        responseBody: jsonb('response_body'),
        statusCode: varchar('status_code', { length: 10 }),
        livemode: boolean('livemode').notNull().default(true),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        keyIdx: index('idx_idempotency_key').on(table.key),
        expiresIdx: index('idx_idempotency_expires').on(table.expiresAt)
    })
);

/**
 * Type for idempotency key record
 */
export type QZPayBillingIdempotencyKey = typeof billingIdempotencyKeys.$inferSelect;

/**
 * Type for creating idempotency key
 */
export type QZPayBillingIdempotencyKeyInsert = typeof billingIdempotencyKeys.$inferInsert;

/**
 * Zod schema for validating idempotency key inserts
 */
export const billingIdempotencyKeyInsertSchema = createInsertSchema(billingIdempotencyKeys);

/**
 * Zod schema for validating idempotency key selects
 */
export const billingIdempotencyKeySelectSchema = createSelectSchema(billingIdempotencyKeys);
