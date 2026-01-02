/**
 * Webhook events repository for QZPay Drizzle
 *
 * Provides webhook event processing and dead letter queue database operations.
 */
import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    billingWebhookDeadLetter,
    billingWebhookEvents,
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookDeadLetterInsert,
    type QZPayBillingWebhookEvent,
    type QZPayBillingWebhookEventInsert
} from '../schema/index.js';
import { firstOrNull, firstOrThrow, type QZPayPaginatedResult } from './base.repository.js';

/**
 * Webhook event status values
 */
export type QZPayWebhookStatusValue = 'pending' | 'processing' | 'processed' | 'failed';

/**
 * Provider values
 */
export type QZPayProviderValue = 'stripe' | 'mercadopago';

/**
 * Webhook events repository
 */
export class QZPayWebhookEventsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find webhook event by ID
     */
    async findById(id: string): Promise<QZPayBillingWebhookEvent | null> {
        const result = await this.db.select().from(billingWebhookEvents).where(eq(billingWebhookEvents.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new webhook event
     */
    async create(input: QZPayBillingWebhookEventInsert): Promise<QZPayBillingWebhookEvent> {
        const result = await this.db.insert(billingWebhookEvents).values(input).returning();
        return firstOrThrow(result, 'WebhookEvent', 'new');
    }

    /**
     * Check if event already exists (for idempotency)
     */
    async exists(providerEventId: string): Promise<boolean> {
        const result = await this.db
            .select({ id: billingWebhookEvents.id })
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId))
            .limit(1);

        return result.length > 0;
    }

    /**
     * Find event by provider event ID
     */
    async findByProviderEventId(providerEventId: string): Promise<QZPayBillingWebhookEvent | null> {
        const result = await this.db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Record a new webhook event
     */
    async record(event: {
        providerEventId: string;
        provider: QZPayProviderValue;
        type: string;
        payload: unknown;
        livemode?: boolean;
    }): Promise<QZPayBillingWebhookEvent> {
        const input: QZPayBillingWebhookEventInsert = {
            providerEventId: event.providerEventId,
            provider: event.provider,
            type: event.type,
            payload: event.payload,
            status: 'pending',
            livemode: event.livemode ?? true
        };

        return this.create(input);
    }

    /**
     * Mark event as processing
     */
    async markProcessing(id: string): Promise<QZPayBillingWebhookEvent> {
        const result = await this.db
            .update(billingWebhookEvents)
            .set({
                status: 'processing',
                attempts: sql`COALESCE(${billingWebhookEvents.attempts}, 0) + 1`
            })
            .where(eq(billingWebhookEvents.id, id))
            .returning();

        return firstOrThrow(result, 'WebhookEvent', id);
    }

    /**
     * Mark event as processed
     */
    async markProcessed(id: string): Promise<QZPayBillingWebhookEvent> {
        const result = await this.db
            .update(billingWebhookEvents)
            .set({
                status: 'processed',
                processedAt: new Date()
            })
            .where(eq(billingWebhookEvents.id, id))
            .returning();

        return firstOrThrow(result, 'WebhookEvent', id);
    }

    /**
     * Mark event as failed
     */
    async markFailed(id: string, error: string): Promise<QZPayBillingWebhookEvent> {
        const result = await this.db
            .update(billingWebhookEvents)
            .set({
                status: 'failed',
                error
            })
            .where(eq(billingWebhookEvents.id, id))
            .returning();

        return firstOrThrow(result, 'WebhookEvent', id);
    }

    /**
     * Find pending events
     */
    async findPending(limit = 100): Promise<QZPayBillingWebhookEvent[]> {
        return this.db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.status, 'pending'))
            .orderBy(sql`${billingWebhookEvents.createdAt} ASC`)
            .limit(limit);
    }

    /**
     * Find failed events for retry
     */
    async findFailedForRetry(maxAttempts: number, limit = 100): Promise<QZPayBillingWebhookEvent[]> {
        return this.db
            .select()
            .from(billingWebhookEvents)
            .where(and(eq(billingWebhookEvents.status, 'failed'), sql`COALESCE(${billingWebhookEvents.attempts}, 0) < ${maxAttempts}`))
            .orderBy(sql`${billingWebhookEvents.createdAt} ASC`)
            .limit(limit);
    }

    /**
     * Find events by type
     */
    async findByType(
        type: string,
        options: {
            status?: QZPayWebhookStatusValue;
            provider?: QZPayProviderValue;
            startDate?: Date;
            endDate?: Date;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingWebhookEvent>> {
        const { status, provider, startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingWebhookEvents.type, type)];

        if (status) {
            conditions.push(eq(billingWebhookEvents.status, status));
        }

        if (provider) {
            conditions.push(eq(billingWebhookEvents.provider, provider));
        }

        if (startDate) {
            conditions.push(gte(billingWebhookEvents.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingWebhookEvents.createdAt, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingWebhookEvents)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingWebhookEvents)
            .where(and(...conditions))
            .orderBy(sql`${billingWebhookEvents.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Get event statistics
     */
    async getStatistics(
        startDate: Date,
        endDate: Date
    ): Promise<{
        total: number;
        pending: number;
        processing: number;
        processed: number;
        failed: number;
        byType: Array<{ type: string; count: number }>;
    }> {
        const conditions = [gte(billingWebhookEvents.createdAt, startDate), lte(billingWebhookEvents.createdAt, endDate)];

        const statusResult = await this.db
            .select({
                status: billingWebhookEvents.status,
                count: count()
            })
            .from(billingWebhookEvents)
            .where(and(...conditions))
            .groupBy(billingWebhookEvents.status);

        const typeResult = await this.db
            .select({
                type: billingWebhookEvents.type,
                count: count()
            })
            .from(billingWebhookEvents)
            .where(and(...conditions))
            .groupBy(billingWebhookEvents.type)
            .orderBy(sql`count(*) DESC`)
            .limit(10);

        const stats = {
            total: 0,
            pending: 0,
            processing: 0,
            processed: 0,
            failed: 0,
            byType: typeResult
        };

        for (const row of statusResult) {
            stats.total += row.count;
            switch (row.status) {
                case 'pending':
                    stats.pending = row.count;
                    break;
                case 'processing':
                    stats.processing = row.count;
                    break;
                case 'processed':
                    stats.processed = row.count;
                    break;
                case 'failed':
                    stats.failed = row.count;
                    break;
            }
        }

        return stats;
    }

    /**
     * Delete old processed events (for cleanup)
     */
    async deleteOldProcessed(beforeDate: Date): Promise<number> {
        const result = await this.db
            .delete(billingWebhookEvents)
            .where(and(eq(billingWebhookEvents.status, 'processed'), lte(billingWebhookEvents.processedAt, beforeDate)))
            .returning();

        return result.length;
    }

    // ==================== Dead Letter Queue ====================

    /**
     * Move event to dead letter queue
     */
    async moveToDeadLetter(event: {
        providerEventId: string;
        provider: QZPayProviderValue;
        type: string;
        payload: unknown;
        error: string;
        attempts: number;
        livemode?: boolean;
    }): Promise<QZPayBillingWebhookDeadLetter> {
        const input: QZPayBillingWebhookDeadLetterInsert = {
            providerEventId: event.providerEventId,
            provider: event.provider,
            type: event.type,
            payload: event.payload,
            error: event.error,
            attempts: event.attempts,
            livemode: event.livemode ?? true
        };

        const result = await this.db.insert(billingWebhookDeadLetter).values(input).returning();

        return firstOrThrow(result, 'WebhookDeadLetter', 'new');
    }

    /**
     * Get dead letter events
     */
    async getDeadLetterEvents(
        options: { resolved?: boolean; provider?: QZPayProviderValue; limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingWebhookDeadLetter>> {
        const { resolved, provider, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (resolved === true) {
            conditions.push(sql`${billingWebhookDeadLetter.resolvedAt} IS NOT NULL`);
        } else if (resolved === false) {
            conditions.push(isNull(billingWebhookDeadLetter.resolvedAt));
        }

        if (provider) {
            conditions.push(eq(billingWebhookDeadLetter.provider, provider));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await this.db.select({ count: count() }).from(billingWebhookDeadLetter).where(whereClause);

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingWebhookDeadLetter)
            .where(whereClause)
            .orderBy(sql`${billingWebhookDeadLetter.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Mark dead letter event as resolved
     */
    async markDeadLetterProcessed(id: string): Promise<QZPayBillingWebhookDeadLetter> {
        const result = await this.db
            .update(billingWebhookDeadLetter)
            .set({ resolvedAt: new Date() })
            .where(eq(billingWebhookDeadLetter.id, id))
            .returning();

        return firstOrThrow(result, 'WebhookDeadLetter', id);
    }

    /**
     * Get dead letter event by ID
     */
    async getDeadLetterEventById(id: string): Promise<QZPayBillingWebhookDeadLetter | null> {
        const result = await this.db.select().from(billingWebhookDeadLetter).where(eq(billingWebhookDeadLetter.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Count unresolved dead letter events
     */
    async countUnresolvedDeadLetter(): Promise<number> {
        const result = await this.db
            .select({ count: count() })
            .from(billingWebhookDeadLetter)
            .where(isNull(billingWebhookDeadLetter.resolvedAt));

        return result[0]?.count ?? 0;
    }
}
