/**
 * Add-ons repository for QZPay Drizzle
 *
 * Provides add-on specific database operations.
 */
import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingAddon,
    type QZPayBillingAddonInsert,
    type QZPayBillingSubscriptionAddon,
    type QZPayBillingSubscriptionAddonInsert,
    billingAddons,
    billingSubscriptionAddons
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Add-on search options
 */
export interface QZPayAddonSearchOptions {
    query?: string;
    active?: boolean;
    billingInterval?: string;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Subscription add-on search options
 */
export interface QZPaySubscriptionAddonSearchOptions {
    subscriptionId?: string;
    addOnId?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

/**
 * Add-ons repository
 */
export class QZPayAddonsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find add-on by ID
     */
    async findById(id: string): Promise<QZPayBillingAddon | null> {
        const result = await this.db
            .select()
            .from(billingAddons)
            .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find all active add-ons
     */
    async findActive(livemode: boolean): Promise<QZPayBillingAddon[]> {
        return this.db
            .select()
            .from(billingAddons)
            .where(and(eq(billingAddons.active, true), eq(billingAddons.livemode, livemode), isNull(billingAddons.deletedAt)))
            .orderBy(sql`${billingAddons.createdAt} ASC`);
    }

    /**
     * Find add-ons compatible with a plan
     */
    async findByPlanId(planId: string): Promise<QZPayBillingAddon[]> {
        // Get add-ons that have empty compatiblePlanIds (compatible with all) or include the planId
        return this.db
            .select()
            .from(billingAddons)
            .where(
                and(
                    eq(billingAddons.active, true),
                    isNull(billingAddons.deletedAt),
                    or(sql`${billingAddons.compatiblePlanIds} = '{}'`, sql`${planId} = ANY(${billingAddons.compatiblePlanIds})`)
                )
            )
            .orderBy(sql`${billingAddons.name} ASC`);
    }

    /**
     * Create a new add-on
     */
    async create(input: QZPayBillingAddonInsert): Promise<QZPayBillingAddon> {
        const result = await this.db.insert(billingAddons).values(input).returning();
        return firstOrThrow(result, 'AddOn', 'new');
    }

    /**
     * Update an add-on
     */
    async update(id: string, input: Partial<QZPayBillingAddonInsert>): Promise<QZPayBillingAddon> {
        const result = await this.db
            .update(billingAddons)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
            .returning();

        return firstOrThrow(result, 'AddOn', id);
    }

    /**
     * Soft delete an add-on
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingAddons)
            .set({ deletedAt: new Date(), active: false })
            .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`AddOn with id ${id} not found`);
        }
    }

    /**
     * Activate an add-on
     */
    async activate(id: string): Promise<QZPayBillingAddon> {
        const result = await this.db
            .update(billingAddons)
            .set({ active: true, updatedAt: new Date() })
            .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
            .returning();

        return firstOrThrow(result, 'AddOn', id);
    }

    /**
     * Deactivate an add-on
     */
    async deactivate(id: string): Promise<QZPayBillingAddon> {
        const result = await this.db
            .update(billingAddons)
            .set({ active: false, updatedAt: new Date() })
            .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
            .returning();

        return firstOrThrow(result, 'AddOn', id);
    }

    /**
     * Search add-ons
     */
    async search(options: QZPayAddonSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingAddon>> {
        const { query, active, billingInterval, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingAddons.deletedAt)];

        if (active !== undefined) {
            conditions.push(eq(billingAddons.active, active));
        }

        if (billingInterval !== undefined) {
            conditions.push(eq(billingAddons.billingInterval, billingInterval));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingAddons.livemode, livemode));
        }

        if (query) {
            const searchPattern = `%${query}%`;
            const searchCondition = or(ilike(billingAddons.name, searchPattern), ilike(billingAddons.description, searchPattern));
            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        // Get count
        const countResult = await this.db
            .select({ count: count() })
            .from(billingAddons)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        // Get data
        const data = await this.db
            .select()
            .from(billingAddons)
            .where(and(...conditions))
            .orderBy(sql`${billingAddons.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Count add-ons
     */
    async count(livemode?: boolean, active?: boolean): Promise<number> {
        const conditions = [isNull(billingAddons.deletedAt)];
        if (livemode !== undefined) {
            conditions.push(eq(billingAddons.livemode, livemode));
        }
        if (active !== undefined) {
            conditions.push(eq(billingAddons.active, active));
        }

        const result = await this.db
            .select({ count: count() })
            .from(billingAddons)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }

    // ==================== Subscription Add-on Methods ====================

    /**
     * Add an add-on to a subscription
     */
    async addToSubscription(input: QZPayBillingSubscriptionAddonInsert): Promise<QZPayBillingSubscriptionAddon> {
        const result = await this.db.insert(billingSubscriptionAddons).values(input).returning();
        return firstOrThrow(result, 'SubscriptionAddOn', 'new');
    }

    /**
     * Find subscription add-on by ID
     */
    async findSubscriptionAddonById(id: string): Promise<QZPayBillingSubscriptionAddon | null> {
        const result = await this.db.select().from(billingSubscriptionAddons).where(eq(billingSubscriptionAddons.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find a specific add-on attached to a subscription
     */
    async findSubscriptionAddon(subscriptionId: string, addOnId: string): Promise<QZPayBillingSubscriptionAddon | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptionAddons)
            .where(
                and(
                    eq(billingSubscriptionAddons.subscriptionId, subscriptionId),
                    eq(billingSubscriptionAddons.addOnId, addOnId),
                    eq(billingSubscriptionAddons.status, 'active')
                )
            )
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find all add-ons for a subscription
     */
    async findBySubscriptionId(subscriptionId: string): Promise<QZPayBillingSubscriptionAddon[]> {
        return this.db
            .select()
            .from(billingSubscriptionAddons)
            .where(eq(billingSubscriptionAddons.subscriptionId, subscriptionId))
            .orderBy(sql`${billingSubscriptionAddons.addedAt} ASC`);
    }

    /**
     * Find active add-ons for a subscription
     */
    async findActiveBySubscriptionId(subscriptionId: string): Promise<QZPayBillingSubscriptionAddon[]> {
        return this.db
            .select()
            .from(billingSubscriptionAddons)
            .where(and(eq(billingSubscriptionAddons.subscriptionId, subscriptionId), eq(billingSubscriptionAddons.status, 'active')))
            .orderBy(sql`${billingSubscriptionAddons.addedAt} ASC`);
    }

    /**
     * Update a subscription add-on
     */
    async updateSubscriptionAddon(
        subscriptionId: string,
        addOnId: string,
        input: Partial<QZPayBillingSubscriptionAddonInsert>
    ): Promise<QZPayBillingSubscriptionAddon> {
        const result = await this.db
            .update(billingSubscriptionAddons)
            .set({ ...input, updatedAt: new Date() })
            .where(
                and(
                    eq(billingSubscriptionAddons.subscriptionId, subscriptionId),
                    eq(billingSubscriptionAddons.addOnId, addOnId),
                    eq(billingSubscriptionAddons.status, 'active')
                )
            )
            .returning();

        return firstOrThrow(result, 'SubscriptionAddOn', `${subscriptionId}:${addOnId}`);
    }

    /**
     * Remove an add-on from a subscription (cancel)
     */
    async removeFromSubscription(subscriptionId: string, addOnId: string): Promise<void> {
        const result = await this.db
            .update(billingSubscriptionAddons)
            .set({
                status: 'canceled',
                canceledAt: new Date(),
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(billingSubscriptionAddons.subscriptionId, subscriptionId),
                    eq(billingSubscriptionAddons.addOnId, addOnId),
                    eq(billingSubscriptionAddons.status, 'active')
                )
            )
            .returning();

        if (result.length === 0) {
            throw new Error(`SubscriptionAddOn for subscription ${subscriptionId} and addon ${addOnId} not found`);
        }
    }

    /**
     * Search subscription add-ons
     */
    async searchSubscriptionAddons(
        options: QZPaySubscriptionAddonSearchOptions
    ): Promise<QZPayPaginatedResult<QZPayBillingSubscriptionAddon>> {
        const { subscriptionId, addOnId, status, limit = 100, offset = 0 } = options;

        const conditions = [];

        if (subscriptionId) {
            conditions.push(eq(billingSubscriptionAddons.subscriptionId, subscriptionId));
        }

        if (addOnId) {
            conditions.push(eq(billingSubscriptionAddons.addOnId, addOnId));
        }

        if (status) {
            conditions.push(eq(billingSubscriptionAddons.status, status));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get count
        const countQuery = this.db.select({ count: count() }).from(billingSubscriptionAddons);
        const countResult = whereClause ? await countQuery.where(whereClause) : await countQuery;

        const total = countResult[0]?.count ?? 0;

        // Get data
        const dataQuery = this.db.select().from(billingSubscriptionAddons);
        const data = whereClause
            ? await dataQuery.where(whereClause).orderBy(sql`${billingSubscriptionAddons.addedAt} DESC`).limit(limit).offset(offset)
            : await dataQuery.orderBy(sql`${billingSubscriptionAddons.addedAt} DESC`).limit(limit).offset(offset);

        return { data, total };
    }

    /**
     * Count subscription add-ons for a subscription
     */
    async countBySubscriptionId(subscriptionId: string, status?: string): Promise<number> {
        const conditions = [eq(billingSubscriptionAddons.subscriptionId, subscriptionId)];
        if (status) {
            conditions.push(eq(billingSubscriptionAddons.status, status));
        }

        const result = await this.db
            .select({ count: count() })
            .from(billingSubscriptionAddons)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }

    /**
     * Calculate total add-on amount for a subscription
     */
    async calculateTotalAmount(subscriptionId: string): Promise<{ amount: number; currency: string }> {
        const addons = await this.findActiveBySubscriptionId(subscriptionId);

        if (addons.length === 0) {
            return { amount: 0, currency: 'USD' };
        }

        const total = addons.reduce((sum, addon) => sum + addon.unitAmount * addon.quantity, 0);
        const currency = addons[0]?.currency ?? 'USD';

        return { amount: total, currency };
    }
}
