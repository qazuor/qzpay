/**
 * Usage records repository for QZPay Drizzle
 *
 * Provides metered usage record database operations.
 */
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { billingUsageRecords, type QZPayBillingUsageRecord, type QZPayBillingUsageRecordInsert } from '../schema/index.js';
import { firstOrNull, firstOrThrow, type QZPayPaginatedResult } from './base.repository.js';

/**
 * Usage action values
 */
export type QZPayUsageActionValue = 'increment' | 'set';

/**
 * Usage aggregation options
 */
export interface QZPayUsageAggregationOptions {
    subscriptionId: string;
    metricName: string;
    startDate: Date;
    endDate: Date;
}

/**
 * Usage records repository
 */
export class QZPayUsageRecordsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find usage record by ID
     */
    async findById(id: string): Promise<QZPayBillingUsageRecord | null> {
        const result = await this.db.select().from(billingUsageRecords).where(eq(billingUsageRecords.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new usage record
     */
    async create(input: QZPayBillingUsageRecordInsert): Promise<QZPayBillingUsageRecord> {
        const result = await this.db.insert(billingUsageRecords).values(input).returning();
        return firstOrThrow(result, 'UsageRecord', 'new');
    }

    /**
     * Find usage record by idempotency key
     */
    async findByIdempotencyKey(idempotencyKey: string): Promise<QZPayBillingUsageRecord | null> {
        const result = await this.db
            .select()
            .from(billingUsageRecords)
            .where(eq(billingUsageRecords.idempotencyKey, idempotencyKey))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find usage records by subscription ID
     */
    async findBySubscriptionId(
        subscriptionId: string,
        options: {
            metricName?: string;
            startDate?: Date;
            endDate?: Date;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingUsageRecord>> {
        const { metricName, startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingUsageRecords.subscriptionId, subscriptionId)];

        if (metricName) {
            conditions.push(eq(billingUsageRecords.metricName, metricName));
        }

        if (startDate) {
            conditions.push(gte(billingUsageRecords.timestamp, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingUsageRecords.timestamp, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingUsageRecords)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingUsageRecords)
            .where(and(...conditions))
            .orderBy(sql`${billingUsageRecords.timestamp} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Get total usage for a period
     */
    async getTotalUsage(options: QZPayUsageAggregationOptions): Promise<number> {
        const { subscriptionId, metricName, startDate, endDate } = options;

        const result = await this.db
            .select({
                total: sql<number>`COALESCE(SUM(CASE WHEN action = 'increment' THEN quantity ELSE 0 END), 0)::int`
            })
            .from(billingUsageRecords)
            .where(
                and(
                    eq(billingUsageRecords.subscriptionId, subscriptionId),
                    eq(billingUsageRecords.metricName, metricName),
                    gte(billingUsageRecords.timestamp, startDate),
                    lte(billingUsageRecords.timestamp, endDate)
                )
            );

        // If there's a 'set' action, use the last one
        const setResult = await this.db
            .select({ quantity: billingUsageRecords.quantity })
            .from(billingUsageRecords)
            .where(
                and(
                    eq(billingUsageRecords.subscriptionId, subscriptionId),
                    eq(billingUsageRecords.metricName, metricName),
                    eq(billingUsageRecords.action, 'set'),
                    gte(billingUsageRecords.timestamp, startDate),
                    lte(billingUsageRecords.timestamp, endDate)
                )
            )
            .orderBy(sql`${billingUsageRecords.timestamp} DESC`)
            .limit(1);

        const setRecord = setResult[0];
        if (setRecord) {
            return setRecord.quantity;
        }

        return result[0]?.total ?? 0;
    }

    /**
     * Get usage summary by metric for a subscription
     */
    async getUsageSummaryByMetric(
        subscriptionId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{ metricName: string; total: number; count: number }>> {
        return this.db
            .select({
                metricName: billingUsageRecords.metricName,
                total: sql<number>`SUM(quantity)::int`,
                count: count()
            })
            .from(billingUsageRecords)
            .where(
                and(
                    eq(billingUsageRecords.subscriptionId, subscriptionId),
                    gte(billingUsageRecords.timestamp, startDate),
                    lte(billingUsageRecords.timestamp, endDate)
                )
            )
            .groupBy(billingUsageRecords.metricName)
            .orderBy(sql`SUM(quantity) DESC`);
    }

    /**
     * Get daily usage breakdown
     */
    async getDailyUsage(
        subscriptionId: string,
        metricName: string,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{ date: string; total: number }>> {
        return this.db
            .select({
                date: sql<string>`DATE(timestamp)::text`,
                total: sql<number>`SUM(quantity)::int`
            })
            .from(billingUsageRecords)
            .where(
                and(
                    eq(billingUsageRecords.subscriptionId, subscriptionId),
                    eq(billingUsageRecords.metricName, metricName),
                    gte(billingUsageRecords.timestamp, startDate),
                    lte(billingUsageRecords.timestamp, endDate)
                )
            )
            .groupBy(sql`DATE(timestamp)`)
            .orderBy(sql`DATE(timestamp) ASC`);
    }

    /**
     * Record usage with idempotency
     */
    async recordUsage(input: QZPayBillingUsageRecordInsert): Promise<{ record: QZPayBillingUsageRecord; created: boolean }> {
        // Check for existing idempotency key
        if (input.idempotencyKey) {
            const existing = await this.findByIdempotencyKey(input.idempotencyKey);
            if (existing) {
                return { record: existing, created: false };
            }
        }

        const record = await this.create(input);
        return { record, created: true };
    }

    /**
     * Get unique metrics for a subscription
     */
    async getMetricNames(subscriptionId: string): Promise<string[]> {
        const result = await this.db
            .selectDistinct({ metricName: billingUsageRecords.metricName })
            .from(billingUsageRecords)
            .where(eq(billingUsageRecords.subscriptionId, subscriptionId))
            .orderBy(sql`${billingUsageRecords.metricName} ASC`);

        return result.map((r) => r.metricName);
    }

    /**
     * Delete old usage records (for cleanup)
     */
    async deleteOldRecords(beforeDate: Date): Promise<number> {
        const result = await this.db.delete(billingUsageRecords).where(lte(billingUsageRecords.timestamp, beforeDate)).returning();

        return result.length;
    }

    /**
     * Get usage count for billing period
     */
    async getUsageCountForPeriod(subscriptionId: string, metricName: string, periodStart: Date, periodEnd: Date): Promise<number> {
        const result = await this.db
            .select({ count: count() })
            .from(billingUsageRecords)
            .where(
                and(
                    eq(billingUsageRecords.subscriptionId, subscriptionId),
                    eq(billingUsageRecords.metricName, metricName),
                    gte(billingUsageRecords.timestamp, periodStart),
                    lte(billingUsageRecords.timestamp, periodEnd)
                )
            );

        return result[0]?.count ?? 0;
    }
}
