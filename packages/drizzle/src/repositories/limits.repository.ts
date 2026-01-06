/**
 * Limits repository for QZPay Drizzle
 *
 * Provides limit definition and customer limit database operations.
 */
import { and, count, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingCustomerLimit,
    type QZPayBillingCustomerLimitInsert,
    type QZPayBillingLimit,
    type QZPayBillingLimitInsert,
    billingCustomerLimits,
    billingLimits
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Limit search options
 */
export interface QZPayLimitSearchOptions {
    query?: string;
    limit?: number;
    offset?: number;
}

/**
 * Customer limit search options
 */
export interface QZPayCustomerLimitSearchOptions {
    customerId?: string;
    limitKey?: string;
    source?: 'subscription' | 'purchase' | 'manual';
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Limits repository
 */
export class QZPayLimitsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    // ==================== Limit Definitions ====================

    /**
     * Find limit definition by ID
     */
    async findDefinitionById(id: string): Promise<QZPayBillingLimit | null> {
        const result = await this.db.select().from(billingLimits).where(eq(billingLimits.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find limit definition by key
     */
    async findDefinitionByKey(key: string): Promise<QZPayBillingLimit | null> {
        const result = await this.db.select().from(billingLimits).where(eq(billingLimits.key, key)).limit(1);

        return firstOrNull(result);
    }

    /**
     * List all limit definitions
     */
    async listDefinitions(): Promise<QZPayBillingLimit[]> {
        return this.db.select().from(billingLimits).orderBy(sql`${billingLimits.key} ASC`);
    }

    /**
     * Create a limit definition
     */
    async createDefinition(input: QZPayBillingLimitInsert): Promise<QZPayBillingLimit> {
        const result = await this.db.insert(billingLimits).values(input).returning();
        return firstOrThrow(result, 'Limit', 'new');
    }

    /**
     * Update a limit definition
     */
    async updateDefinition(id: string, input: Partial<QZPayBillingLimitInsert>): Promise<QZPayBillingLimit> {
        const result = await this.db
            .update(billingLimits)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(billingLimits.id, id))
            .returning();

        return firstOrThrow(result, 'Limit', id);
    }

    /**
     * Delete a limit definition
     */
    async deleteDefinition(id: string): Promise<void> {
        const result = await this.db.delete(billingLimits).where(eq(billingLimits.id, id)).returning();

        if (result.length === 0) {
            throw new Error(`Limit with id ${id} not found`);
        }
    }

    /**
     * Search limit definitions
     */
    async searchDefinitions(options: QZPayLimitSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingLimit>> {
        const { limit = 100, offset = 0 } = options;

        // Get count
        const countResult = await this.db.select({ count: count() }).from(billingLimits);

        const total = countResult[0]?.count ?? 0;

        // Get data
        const data = await this.db.select().from(billingLimits).orderBy(sql`${billingLimits.key} ASC`).limit(limit).offset(offset);

        return { data, total };
    }

    // ==================== Customer Limits ====================

    /**
     * Set a limit for a customer (create or update)
     */
    async set(input: QZPayBillingCustomerLimitInsert): Promise<QZPayBillingCustomerLimit> {
        // Check if customer already has this limit
        const existing = await this.findByCustomerAndKey(input.customerId, input.limitKey);

        if (existing) {
            // Update existing limit
            const result = await this.db
                .update(billingCustomerLimits)
                .set({
                    maxValue: input.maxValue,
                    resetAt: input.resetAt ?? null,
                    source: input.source,
                    sourceId: input.sourceId ?? null,
                    updatedAt: new Date()
                })
                .where(eq(billingCustomerLimits.id, existing.id))
                .returning();
            return firstOrThrow(result, 'CustomerLimit', existing.id);
        }

        const result = await this.db.insert(billingCustomerLimits).values(input).returning();
        return firstOrThrow(result, 'CustomerLimit', 'new');
    }

    /**
     * Increment current value for a customer limit
     */
    async increment(customerId: string, limitKey: string, incrementBy = 1): Promise<QZPayBillingCustomerLimit> {
        // First check if limit exists
        const existing = await this.findByCustomerAndKey(customerId, limitKey);

        if (!existing) {
            throw new Error(`Customer limit not found for customer ${customerId} and key ${limitKey}`);
        }

        const result = await this.db
            .update(billingCustomerLimits)
            .set({
                currentValue: sql`${billingCustomerLimits.currentValue} + ${incrementBy}`,
                updatedAt: new Date()
            })
            .where(and(eq(billingCustomerLimits.customerId, customerId), eq(billingCustomerLimits.limitKey, limitKey)))
            .returning();

        return firstOrThrow(result, 'CustomerLimit', `${customerId}:${limitKey}`);
    }

    /**
     * Decrement current value for a customer limit
     */
    async decrement(customerId: string, limitKey: string, decrementBy = 1): Promise<QZPayBillingCustomerLimit> {
        const existing = await this.findByCustomerAndKey(customerId, limitKey);

        if (!existing) {
            throw new Error(`Customer limit not found for customer ${customerId} and key ${limitKey}`);
        }

        const newValue = Math.max(0, existing.currentValue - decrementBy);

        const result = await this.db
            .update(billingCustomerLimits)
            .set({
                currentValue: newValue,
                updatedAt: new Date()
            })
            .where(and(eq(billingCustomerLimits.customerId, customerId), eq(billingCustomerLimits.limitKey, limitKey)))
            .returning();

        return firstOrThrow(result, 'CustomerLimit', `${customerId}:${limitKey}`);
    }

    /**
     * Reset current value to 0 for a customer limit
     */
    async resetUsage(customerId: string, limitKey: string): Promise<QZPayBillingCustomerLimit> {
        const result = await this.db
            .update(billingCustomerLimits)
            .set({
                currentValue: 0,
                updatedAt: new Date()
            })
            .where(and(eq(billingCustomerLimits.customerId, customerId), eq(billingCustomerLimits.limitKey, limitKey)))
            .returning();

        return firstOrThrow(result, 'CustomerLimit', `${customerId}:${limitKey}`);
    }

    /**
     * Find customer limit by customer ID and limit key
     */
    async findByCustomerAndKey(customerId: string, limitKey: string): Promise<QZPayBillingCustomerLimit | null> {
        const result = await this.db
            .select()
            .from(billingCustomerLimits)
            .where(and(eq(billingCustomerLimits.customerId, customerId), eq(billingCustomerLimits.limitKey, limitKey)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Check if customer limit is exceeded
     */
    async check(
        customerId: string,
        limitKey: string
    ): Promise<{ exists: boolean; isExceeded: boolean; remaining: number; limit: QZPayBillingCustomerLimit | null }> {
        const customerLimit = await this.findByCustomerAndKey(customerId, limitKey);

        if (!customerLimit) {
            return { exists: false, isExceeded: false, remaining: 0, limit: null };
        }

        const remaining = Math.max(0, customerLimit.maxValue - customerLimit.currentValue);
        const isExceeded = customerLimit.currentValue >= customerLimit.maxValue;

        return { exists: true, isExceeded, remaining, limit: customerLimit };
    }

    /**
     * Find all limits for a customer
     */
    async findByCustomerId(customerId: string): Promise<QZPayBillingCustomerLimit[]> {
        return this.db
            .select()
            .from(billingCustomerLimits)
            .where(eq(billingCustomerLimits.customerId, customerId))
            .orderBy(sql`${billingCustomerLimits.limitKey} ASC`);
    }

    /**
     * Delete a customer limit
     */
    async delete(customerId: string, limitKey: string): Promise<void> {
        const result = await this.db
            .delete(billingCustomerLimits)
            .where(and(eq(billingCustomerLimits.customerId, customerId), eq(billingCustomerLimits.limitKey, limitKey)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Customer limit not found for customer ${customerId} and key ${limitKey}`);
        }
    }

    /**
     * Delete all limits from a source
     */
    async deleteBySource(source: string, sourceId: string): Promise<number> {
        const result = await this.db
            .delete(billingCustomerLimits)
            .where(and(eq(billingCustomerLimits.source, source), eq(billingCustomerLimits.sourceId, sourceId)))
            .returning();

        return result.length;
    }

    /**
     * Search customer limits
     */
    async searchCustomerLimits(options: QZPayCustomerLimitSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingCustomerLimit>> {
        const { customerId, limitKey, source, livemode, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (customerId) {
            conditions.push(eq(billingCustomerLimits.customerId, customerId));
        }

        if (limitKey) {
            conditions.push(eq(billingCustomerLimits.limitKey, limitKey));
        }

        if (source) {
            conditions.push(eq(billingCustomerLimits.source, source));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingCustomerLimits.livemode, livemode));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get count
        const countQuery = this.db.select({ count: count() }).from(billingCustomerLimits);
        const countResult = whereClause ? await countQuery.where(whereClause) : await countQuery;

        const total = countResult[0]?.count ?? 0;

        // Get data
        const dataQuery = this.db.select().from(billingCustomerLimits);
        const data = whereClause
            ? await dataQuery.where(whereClause).orderBy(sql`${billingCustomerLimits.limitKey} ASC`).limit(limit).offset(offset)
            : await dataQuery.orderBy(sql`${billingCustomerLimits.limitKey} ASC`).limit(limit).offset(offset);

        return { data, total };
    }

    /**
     * Find limits that need reset (resetAt has passed)
     */
    async findNeedingReset(livemode: boolean): Promise<QZPayBillingCustomerLimit[]> {
        const now = new Date();

        return this.db
            .select()
            .from(billingCustomerLimits)
            .where(
                and(
                    eq(billingCustomerLimits.livemode, livemode),
                    isNotNull(billingCustomerLimits.resetAt),
                    lte(billingCustomerLimits.resetAt, now)
                )
            );
    }

    /**
     * Reset all limits that need resetting and update their resetAt
     */
    async resetAllExpired(newResetAt: Date): Promise<number> {
        const now = new Date();

        const result = await this.db
            .update(billingCustomerLimits)
            .set({
                currentValue: 0,
                resetAt: newResetAt,
                updatedAt: new Date()
            })
            .where(and(isNotNull(billingCustomerLimits.resetAt), lte(billingCustomerLimits.resetAt, now)))
            .returning();

        return result.length;
    }

    /**
     * Count customer limits
     */
    async countCustomerLimits(customerId: string): Promise<number> {
        const result = await this.db
            .select({ count: count() })
            .from(billingCustomerLimits)
            .where(eq(billingCustomerLimits.customerId, customerId));

        return result[0]?.count ?? 0;
    }

    /**
     * Get usage summary for a customer
     */
    async getUsageSummary(
        customerId: string
    ): Promise<Array<{ limitKey: string; maxValue: number; currentValue: number; remaining: number; percentage: number }>> {
        const limits = await this.findByCustomerId(customerId);

        return limits.map((limit) => ({
            limitKey: limit.limitKey,
            maxValue: limit.maxValue,
            currentValue: limit.currentValue,
            remaining: Math.max(0, limit.maxValue - limit.currentValue),
            percentage: limit.maxValue > 0 ? Math.round((limit.currentValue / limit.maxValue) * 100) : 0
        }));
    }
}
