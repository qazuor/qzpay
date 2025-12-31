/**
 * Audit logs repository for QZPay Drizzle
 *
 * Provides immutable audit trail database operations.
 * Note: Audit logs should never be updated or deleted.
 */
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type QZPayBillingAuditLog, type QZPayBillingAuditLogInsert, billingAuditLogs } from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Actor type values
 */
export type QZPayActorTypeValue = 'user' | 'system' | 'admin' | 'api' | 'webhook';

/**
 * Entity type values
 */
export type QZPayEntityTypeValue =
    | 'customer'
    | 'subscription'
    | 'payment'
    | 'invoice'
    | 'payment_method'
    | 'promo_code'
    | 'vendor'
    | 'usage_record';

/**
 * Audit log search options
 */
export interface QZPayAuditLogSearchOptions {
    entityType?: QZPayEntityTypeValue;
    entityId?: string;
    action?: string;
    actorType?: QZPayActorTypeValue;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Audit logs repository
 *
 * Note: This repository intentionally does not have update or delete operations
 * because audit logs are immutable.
 */
export class QZPayAuditLogsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Create an audit log entry
     */
    async create(input: QZPayBillingAuditLogInsert): Promise<QZPayBillingAuditLog> {
        const result = await this.db.insert(billingAuditLogs).values(input).returning();
        return firstOrThrow(result, 'AuditLog', 'new');
    }

    /**
     * Create multiple audit log entries
     */
    async createMany(inputs: QZPayBillingAuditLogInsert[]): Promise<QZPayBillingAuditLog[]> {
        if (inputs.length === 0) return [];

        return this.db.insert(billingAuditLogs).values(inputs).returning();
    }

    /**
     * Find audit log by ID
     */
    async findById(id: string): Promise<QZPayBillingAuditLog | null> {
        const result = await this.db.select().from(billingAuditLogs).where(eq(billingAuditLogs.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find audit logs for an entity
     */
    async findByEntity(
        entityType: QZPayEntityTypeValue,
        entityId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingAuditLog>> {
        const { limit = 100, offset = 0 } = options;

        const conditions = [eq(billingAuditLogs.entityType, entityType), eq(billingAuditLogs.entityId, entityId)];

        const countResult = await this.db
            .select({ count: count() })
            .from(billingAuditLogs)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingAuditLogs)
            .where(and(...conditions))
            .orderBy(sql`${billingAuditLogs.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find audit logs by actor
     */
    async findByActor(
        actorType: QZPayActorTypeValue,
        actorId: string,
        options: { startDate?: Date; endDate?: Date; limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingAuditLog>> {
        const { startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingAuditLogs.actorType, actorType), eq(billingAuditLogs.actorId, actorId)];

        if (startDate) {
            conditions.push(gte(billingAuditLogs.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingAuditLogs.createdAt, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingAuditLogs)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingAuditLogs)
            .where(and(...conditions))
            .orderBy(sql`${billingAuditLogs.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find audit logs by action
     */
    async findByAction(
        action: string,
        options: { entityType?: QZPayEntityTypeValue; startDate?: Date; endDate?: Date; limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingAuditLog>> {
        const { entityType, startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingAuditLogs.action, action)];

        if (entityType) {
            conditions.push(eq(billingAuditLogs.entityType, entityType));
        }

        if (startDate) {
            conditions.push(gte(billingAuditLogs.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingAuditLogs.createdAt, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingAuditLogs)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingAuditLogs)
            .where(and(...conditions))
            .orderBy(sql`${billingAuditLogs.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Search audit logs
     */
    async search(options: QZPayAuditLogSearchOptions = {}): Promise<QZPayPaginatedResult<QZPayBillingAuditLog>> {
        const { entityType, entityId, action, actorType, actorId, startDate, endDate, livemode, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (entityType) {
            conditions.push(eq(billingAuditLogs.entityType, entityType));
        }

        if (entityId) {
            conditions.push(eq(billingAuditLogs.entityId, entityId));
        }

        if (action) {
            conditions.push(eq(billingAuditLogs.action, action));
        }

        if (actorType) {
            conditions.push(eq(billingAuditLogs.actorType, actorType));
        }

        if (actorId) {
            conditions.push(eq(billingAuditLogs.actorId, actorId));
        }

        if (startDate) {
            conditions.push(gte(billingAuditLogs.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingAuditLogs.createdAt, endDate));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingAuditLogs.livemode, livemode));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await this.db.select({ count: count() }).from(billingAuditLogs).where(whereClause);

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingAuditLogs)
            .where(whereClause)
            .orderBy(sql`${billingAuditLogs.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Get activity summary for entity
     */
    async getActivitySummary(
        entityType: QZPayEntityTypeValue,
        entityId: string
    ): Promise<Array<{ action: string; count: number; lastOccurred: Date }>> {
        return this.db
            .select({
                action: billingAuditLogs.action,
                count: count(),
                lastOccurred: sql<Date>`MAX(created_at)`
            })
            .from(billingAuditLogs)
            .where(and(eq(billingAuditLogs.entityType, entityType), eq(billingAuditLogs.entityId, entityId)))
            .groupBy(billingAuditLogs.action)
            .orderBy(sql`MAX(created_at) DESC`);
    }

    /**
     * Get recent activity
     */
    async getRecentActivity(
        options: {
            entityType?: QZPayEntityTypeValue;
            livemode?: boolean;
            limit?: number;
        } = {}
    ): Promise<QZPayBillingAuditLog[]> {
        const { entityType, livemode, limit = 50 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (entityType) {
            conditions.push(eq(billingAuditLogs.entityType, entityType));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingAuditLogs.livemode, livemode));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        return this.db.select().from(billingAuditLogs).where(whereClause).orderBy(sql`${billingAuditLogs.createdAt} DESC`).limit(limit);
    }

    /**
     * Get action counts for period
     */
    async getActionCounts(
        startDate: Date,
        endDate: Date,
        livemode = true
    ): Promise<Array<{ action: string; entityType: string; count: number }>> {
        return this.db
            .select({
                action: billingAuditLogs.action,
                entityType: billingAuditLogs.entityType,
                count: count()
            })
            .from(billingAuditLogs)
            .where(
                and(
                    gte(billingAuditLogs.createdAt, startDate),
                    lte(billingAuditLogs.createdAt, endDate),
                    eq(billingAuditLogs.livemode, livemode)
                )
            )
            .groupBy(billingAuditLogs.action, billingAuditLogs.entityType)
            .orderBy(sql`count(*) DESC`);
    }

    /**
     * Log a create action
     */
    async logCreate(params: {
        entityType: QZPayEntityTypeValue;
        entityId: string;
        actorType: QZPayActorTypeValue;
        actorId?: string;
        changes?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
        livemode?: boolean;
    }): Promise<QZPayBillingAuditLog> {
        return this.create({
            entityType: params.entityType,
            entityId: params.entityId,
            action: 'create',
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            changes: params.changes ?? null,
            previousValues: null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            livemode: params.livemode ?? true
        });
    }

    /**
     * Log an update action
     */
    async logUpdate(params: {
        entityType: QZPayEntityTypeValue;
        entityId: string;
        actorType: QZPayActorTypeValue;
        actorId?: string;
        changes: Record<string, unknown>;
        previousValues?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
        livemode?: boolean;
    }): Promise<QZPayBillingAuditLog> {
        return this.create({
            entityType: params.entityType,
            entityId: params.entityId,
            action: 'update',
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            changes: params.changes,
            previousValues: params.previousValues ?? null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            livemode: params.livemode ?? true
        });
    }

    /**
     * Log a delete action
     */
    async logDelete(params: {
        entityType: QZPayEntityTypeValue;
        entityId: string;
        actorType: QZPayActorTypeValue;
        actorId?: string;
        previousValues?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
        livemode?: boolean;
    }): Promise<QZPayBillingAuditLog> {
        return this.create({
            entityType: params.entityType,
            entityId: params.entityId,
            action: 'delete',
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            changes: null,
            previousValues: params.previousValues ?? null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            livemode: params.livemode ?? true
        });
    }

    /**
     * Log a custom action
     */
    async logAction(params: {
        entityType: QZPayEntityTypeValue;
        entityId: string;
        action: string;
        actorType: QZPayActorTypeValue;
        actorId?: string;
        changes?: Record<string, unknown>;
        previousValues?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
        livemode?: boolean;
    }): Promise<QZPayBillingAuditLog> {
        return this.create({
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            changes: params.changes ?? null,
            previousValues: params.previousValues ?? null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            livemode: params.livemode ?? true
        });
    }
}
