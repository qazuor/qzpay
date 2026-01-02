/**
 * Plans repository for QZPay Drizzle
 *
 * Provides plan-specific database operations.
 */
import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type QZPayBillingPlan, type QZPayBillingPlanInsert, billingPlans } from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Plan search options
 */
export interface QZPayPlanSearchOptions {
    query?: string;
    active?: boolean;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Plans repository
 */
export class QZPayPlansRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find plan by ID
     */
    async findById(id: string): Promise<QZPayBillingPlan | null> {
        const result = await this.db
            .select()
            .from(billingPlans)
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find all active plans
     */
    async findActive(livemode: boolean): Promise<QZPayBillingPlan[]> {
        return this.db
            .select()
            .from(billingPlans)
            .where(and(eq(billingPlans.active, true), eq(billingPlans.livemode, livemode), isNull(billingPlans.deletedAt)))
            .orderBy(sql`${billingPlans.createdAt} ASC`);
    }

    /**
     * Create a new plan
     */
    async create(input: QZPayBillingPlanInsert): Promise<QZPayBillingPlan> {
        const result = await this.db.insert(billingPlans).values(input).returning();
        return firstOrThrow(result, 'Plan', 'new');
    }

    /**
     * Update a plan
     */
    async update(id: string, input: Partial<QZPayBillingPlanInsert>): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Soft delete a plan
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingPlans)
            .set({ deletedAt: new Date(), active: false })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Plan with id ${id} not found`);
        }
    }

    /**
     * Activate a plan
     */
    async activate(id: string): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ active: true, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Deactivate a plan
     */
    async deactivate(id: string): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ active: false, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Search plans
     */
    async search(options: QZPayPlanSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingPlan>> {
        const { query, active, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingPlans.deletedAt)];

        if (active !== undefined) {
            conditions.push(eq(billingPlans.active, active));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingPlans.livemode, livemode));
        }

        if (query) {
            const searchPattern = `%${query}%`;
            const searchCondition = or(ilike(billingPlans.name, searchPattern), ilike(billingPlans.description, searchPattern));
            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        // Get count
        const countResult = await this.db
            .select({ count: count() })
            .from(billingPlans)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        // Get data
        const data = await this.db
            .select()
            .from(billingPlans)
            .where(and(...conditions))
            .orderBy(sql`${billingPlans.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Update plan features
     */
    async updateFeatures(id: string, features: unknown[]): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ features, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Update plan entitlements
     */
    async updateEntitlements(id: string, entitlements: string[]): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ entitlements, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Update plan limits
     */
    async updateLimits(id: string, limits: Record<string, number>): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ limits, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Update plan metadata
     */
    async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<QZPayBillingPlan> {
        const result = await this.db
            .update(billingPlans)
            .set({ metadata, updatedAt: new Date() })
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Plan', id);
    }

    /**
     * Count plans
     */
    async count(livemode?: boolean, active?: boolean): Promise<number> {
        const conditions = [isNull(billingPlans.deletedAt)];
        if (livemode !== undefined) {
            conditions.push(eq(billingPlans.livemode, livemode));
        }
        if (active !== undefined) {
            conditions.push(eq(billingPlans.active, active));
        }

        const result = await this.db
            .select({ count: count() })
            .from(billingPlans)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }
}
