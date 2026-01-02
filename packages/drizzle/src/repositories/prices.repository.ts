/**
 * Prices repository for QZPay Drizzle
 *
 * Provides price-specific database operations.
 */
import { and, count, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type QZPayBillingPrice, type QZPayBillingPriceInsert, billingPrices } from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Price search options
 */
export interface QZPayPriceSearchOptions {
    planId?: string;
    currency?: string;
    billingInterval?: string;
    active?: boolean;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Prices repository
 */
export class QZPayPricesRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find price by ID
     */
    async findById(id: string): Promise<QZPayBillingPrice | null> {
        const result = await this.db.select().from(billingPrices).where(eq(billingPrices.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find prices by plan ID
     */
    async findByPlanId(planId: string, activeOnly = true): Promise<QZPayBillingPrice[]> {
        const conditions = [eq(billingPrices.planId, planId)];

        if (activeOnly) {
            conditions.push(eq(billingPrices.active, true));
        }

        return this.db
            .select()
            .from(billingPrices)
            .where(and(...conditions))
            .orderBy(sql`${billingPrices.unitAmount} ASC`);
    }

    /**
     * Find price by Stripe price ID
     */
    async findByStripePriceId(stripePriceId: string): Promise<QZPayBillingPrice | null> {
        const result = await this.db.select().from(billingPrices).where(eq(billingPrices.stripePriceId, stripePriceId)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find price by MercadoPago price ID
     */
    async findByMpPriceId(mpPriceId: string): Promise<QZPayBillingPrice | null> {
        const result = await this.db.select().from(billingPrices).where(eq(billingPrices.mpPriceId, mpPriceId)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find price by provider price ID
     */
    async findByProviderPriceId(provider: 'stripe' | 'mercadopago', providerPriceId: string): Promise<QZPayBillingPrice | null> {
        if (provider === 'stripe') {
            return this.findByStripePriceId(providerPriceId);
        }
        return this.findByMpPriceId(providerPriceId);
    }

    /**
     * Create a new price
     */
    async create(input: QZPayBillingPriceInsert): Promise<QZPayBillingPrice> {
        const result = await this.db.insert(billingPrices).values(input).returning();
        return firstOrThrow(result, 'Price', 'new');
    }

    /**
     * Update a price
     */
    async update(id: string, input: Partial<QZPayBillingPriceInsert>): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Update Stripe price ID
     */
    async updateStripePriceId(id: string, stripePriceId: string): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ stripePriceId, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Update MercadoPago price ID
     */
    async updateMpPriceId(id: string, mpPriceId: string): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ mpPriceId, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Update provider price ID
     */
    async updateProviderPriceId(id: string, provider: 'stripe' | 'mercadopago', providerPriceId: string): Promise<QZPayBillingPrice> {
        if (provider === 'stripe') {
            return this.updateStripePriceId(id, providerPriceId);
        }
        return this.updateMpPriceId(id, providerPriceId);
    }

    /**
     * Activate a price
     */
    async activate(id: string): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ active: true, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Deactivate a price
     */
    async deactivate(id: string): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Delete a price (hard delete since prices don't have soft delete)
     */
    async delete(id: string): Promise<void> {
        const result = await this.db.delete(billingPrices).where(eq(billingPrices.id, id)).returning();

        if (result.length === 0) {
            throw new Error(`Price with id ${id} not found`);
        }
    }

    /**
     * Search prices
     */
    async search(options: QZPayPriceSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingPrice>> {
        const { planId, currency, billingInterval, active, livemode, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (planId) {
            conditions.push(eq(billingPrices.planId, planId));
        }

        if (currency) {
            conditions.push(eq(billingPrices.currency, currency));
        }

        if (billingInterval) {
            conditions.push(eq(billingPrices.billingInterval, billingInterval));
        }

        if (active !== undefined) {
            conditions.push(eq(billingPrices.active, active));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingPrices.livemode, livemode));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get count
        const countQuery = this.db.select({ count: count() }).from(billingPrices);
        const countResult = whereClause ? await countQuery.where(whereClause) : await countQuery;

        const total = countResult[0]?.count ?? 0;

        // Get data
        const dataQuery = this.db.select().from(billingPrices);
        const data = whereClause
            ? await dataQuery.where(whereClause).orderBy(sql`${billingPrices.createdAt} DESC`).limit(limit).offset(offset)
            : await dataQuery.orderBy(sql`${billingPrices.createdAt} DESC`).limit(limit).offset(offset);

        return { data, total };
    }

    /**
     * Update price metadata
     */
    async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<QZPayBillingPrice> {
        const result = await this.db
            .update(billingPrices)
            .set({ metadata, updatedAt: new Date() })
            .where(eq(billingPrices.id, id))
            .returning();

        return firstOrThrow(result, 'Price', id);
    }

    /**
     * Count prices
     */
    async count(planId?: string, livemode?: boolean, active?: boolean): Promise<number> {
        const conditions: ReturnType<typeof eq>[] = [];

        if (planId) {
            conditions.push(eq(billingPrices.planId, planId));
        }
        if (livemode !== undefined) {
            conditions.push(eq(billingPrices.livemode, livemode));
        }
        if (active !== undefined) {
            conditions.push(eq(billingPrices.active, active));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const query = this.db.select({ count: count() }).from(billingPrices);
        const result = whereClause ? await query.where(whereClause) : await query;

        return result[0]?.count ?? 0;
    }

    /**
     * Find default price for a plan (lowest amount active price)
     */
    async findDefaultForPlan(planId: string, currency?: string): Promise<QZPayBillingPrice | null> {
        const conditions = [eq(billingPrices.planId, planId), eq(billingPrices.active, true)];

        if (currency) {
            conditions.push(eq(billingPrices.currency, currency));
        }

        const result = await this.db
            .select()
            .from(billingPrices)
            .where(and(...conditions))
            .orderBy(sql`${billingPrices.unitAmount} ASC`)
            .limit(1);

        return firstOrNull(result);
    }
}
