/**
 * Audit logs schema for QZPay billing
 *
 * Immutable audit trail for all financial operations.
 */
import { boolean, index, inet, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * Billing audit logs table
 *
 * Immutable record of all changes to billing entities.
 * This table should never have UPDATE or DELETE operations.
 */
export const billingAuditLogs = pgTable(
    'billing_audit_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        entityType: varchar('entity_type', { length: 50 }).notNull(),
        entityId: uuid('entity_id').notNull(),
        action: varchar('action', { length: 100 }).notNull(),
        actorType: varchar('actor_type', { length: 50 }).notNull(),
        actorId: varchar('actor_id', { length: 255 }),
        changes: jsonb('changes'),
        previousValues: jsonb('previous_values'),
        ipAddress: inet('ip_address'),
        userAgent: text('user_agent'),
        livemode: boolean('livemode').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
        actionIdx: index('idx_audit_logs_action').on(table.action),
        actorIdx: index('idx_audit_logs_actor').on(table.actorType, table.actorId),
        createdIdx: index('idx_audit_logs_created').on(table.createdAt)
    })
);

/**
 * Type for audit log record
 */
export type QZPayBillingAuditLog = typeof billingAuditLogs.$inferSelect;

/**
 * Type for creating audit log
 */
export type QZPayBillingAuditLogInsert = typeof billingAuditLogs.$inferInsert;

/**
 * Zod schema for validating audit log inserts
 */
export const billingAuditLogInsertSchema = createInsertSchema(billingAuditLogs);

/**
 * Zod schema for validating audit log selects
 */
export const billingAuditLogSelectSchema = createSelectSchema(billingAuditLogs);
