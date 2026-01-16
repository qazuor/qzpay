/**
 * Subscriptions repository for QZPay Drizzle
 *
 * Provides subscription-specific database operations.
 */
import { and, count, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import {
    type QZPayBillingSubscription,
    type QZPayBillingSubscriptionAddon,
    type QZPayBillingSubscriptionInsert,
    billingSubscriptions
} from '../schema/index.js';
import type { QZPayDatabase } from '../utils/connection.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Subscription status values
 */
export type QZPaySubscriptionStatusValue =
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | 'incomplete'
    | 'incomplete_expired';

/**
 * Subscription search options
 */
export interface QZPaySubscriptionSearchOptions {
    customerId?: string;
    status?: QZPaySubscriptionStatusValue | QZPaySubscriptionStatusValue[];
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Subscription with addons loaded
 */
export interface QZPaySubscriptionWithAddons extends QZPayBillingSubscription {
    addons: QZPayBillingSubscriptionAddon[];
}

/**
 * Subscriptions repository
 */
export class QZPaySubscriptionsRepository {
    constructor(private readonly db: QZPayDatabase) {}

    /**
     * Find subscription by ID
     */
    async findById(id: string): Promise<QZPayBillingSubscription | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptions)
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new subscription
     */
    async create(input: QZPayBillingSubscriptionInsert): Promise<QZPayBillingSubscription> {
        const result = await this.db.insert(billingSubscriptions).values(input).returning();
        return firstOrThrow(result, 'Subscription', 'new');
    }

    /**
     * Update a subscription
     */
    async update(id: string, input: Partial<QZPayBillingSubscriptionInsert>): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Find subscription by Stripe subscription ID
     */
    async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<QZPayBillingSubscription | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptions)
            .where(and(eq(billingSubscriptions.stripeSubscriptionId, stripeSubscriptionId), isNull(billingSubscriptions.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find subscription by MercadoPago subscription ID
     */
    async findByMpSubscriptionId(mpSubscriptionId: string): Promise<QZPayBillingSubscription | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptions)
            .where(and(eq(billingSubscriptions.mpSubscriptionId, mpSubscriptionId), isNull(billingSubscriptions.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find subscription by provider subscription ID
     */
    async findByProviderSubscriptionId(
        provider: 'stripe' | 'mercadopago',
        providerSubscriptionId: string
    ): Promise<QZPayBillingSubscription | null> {
        if (provider === 'stripe') {
            return this.findByStripeSubscriptionId(providerSubscriptionId);
        }
        return this.findByMpSubscriptionId(providerSubscriptionId);
    }

    /**
     * Find active subscriptions for customer
     */
    async findActiveByCustomerId(customerId: string): Promise<QZPayBillingSubscription[]> {
        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.customerId, customerId),
                    inArray(billingSubscriptions.status, ['active', 'trialing']),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.createdAt} DESC`);
    }

    /**
     * Find all subscriptions for customer
     */
    async findByCustomerId(
        customerId: string,
        options: { limit?: number; offset?: number; status?: QZPaySubscriptionStatusValue[] } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingSubscription>> {
        const { limit = 100, offset = 0, status } = options;

        const conditions = [eq(billingSubscriptions.customerId, customerId), isNull(billingSubscriptions.deletedAt)];

        if (status && status.length > 0) {
            conditions.push(inArray(billingSubscriptions.status, status));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingSubscriptions)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(sql`${billingSubscriptions.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find subscriptions expiring soon (period ending within N days)
     */
    async findExpiringSoon(days: number, livemode = true): Promise<QZPayBillingSubscription[]> {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.status, 'active'),
                    eq(billingSubscriptions.livemode, livemode),
                    lte(billingSubscriptions.currentPeriodEnd, futureDate),
                    gt(billingSubscriptions.currentPeriodEnd, new Date()),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.currentPeriodEnd} ASC`);
    }

    /**
     * Find trials expiring soon
     */
    async findTrialsExpiringSoon(days: number, livemode = true): Promise<QZPayBillingSubscription[]> {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.status, 'trialing'),
                    eq(billingSubscriptions.livemode, livemode),
                    isNotNull(billingSubscriptions.trialEnd),
                    lte(billingSubscriptions.trialEnd, futureDate),
                    gt(billingSubscriptions.trialEnd, new Date()),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.trialEnd} ASC`);
    }

    /**
     * Find past due subscriptions
     */
    async findPastDue(livemode = true): Promise<QZPayBillingSubscription[]> {
        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.status, 'past_due'),
                    eq(billingSubscriptions.livemode, livemode),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.currentPeriodEnd} ASC`);
    }

    /**
     * Find subscriptions scheduled for cancellation
     */
    async findScheduledForCancellation(livemode = true): Promise<QZPayBillingSubscription[]> {
        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    isNotNull(billingSubscriptions.cancelAt),
                    inArray(billingSubscriptions.status, ['active', 'trialing']),
                    eq(billingSubscriptions.livemode, livemode),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.currentPeriodEnd} ASC`);
    }

    /**
     * Update subscription status
     */
    async updateStatus(
        id: string,
        status: QZPaySubscriptionStatusValue,
        additionalData?: Partial<QZPayBillingSubscriptionInsert>
    ): Promise<QZPayBillingSubscription> {
        const updateData: Partial<QZPayBillingSubscriptionInsert> = {
            status,
            updatedAt: new Date(),
            ...additionalData
        };

        if (status === 'canceled' && !additionalData?.canceledAt) {
            updateData.canceledAt = new Date();
        }

        const result = await this.db
            .update(billingSubscriptions)
            .set(updateData)
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Schedule cancellation at specific date
     */
    async scheduleCancellation(id: string, cancelAt: Date): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({
                cancelAt,
                updatedAt: new Date()
            })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Remove scheduled cancellation
     */
    async removeCancellation(id: string): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({
                cancelAt: null,
                updatedAt: new Date()
            })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Update billing period
     */
    async updateBillingPeriod(id: string, currentPeriodStart: Date, currentPeriodEnd: Date): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({
                currentPeriodStart,
                currentPeriodEnd,
                updatedAt: new Date()
            })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Increment retry count
     */
    async incrementRetryCount(id: string, nextRetryAt?: Date): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({
                retryCount: sql`COALESCE(${billingSubscriptions.retryCount}, 0) + 1`,
                nextRetryAt: nextRetryAt ?? null,
                updatedAt: new Date()
            })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Reset retry count
     */
    async resetRetryCount(id: string): Promise<QZPayBillingSubscription> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({
                retryCount: 0,
                nextRetryAt: null,
                updatedAt: new Date()
            })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Subscription', id);
    }

    /**
     * Find subscriptions needing retry
     */
    async findNeedingRetry(maxRetries: number, livemode = true): Promise<QZPayBillingSubscription[]> {
        return this.db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.status, 'past_due'),
                    eq(billingSubscriptions.livemode, livemode),
                    lt(billingSubscriptions.retryCount, maxRetries),
                    isNotNull(billingSubscriptions.nextRetryAt),
                    lte(billingSubscriptions.nextRetryAt, new Date()),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(sql`${billingSubscriptions.nextRetryAt} ASC`);
    }

    /**
     * Search subscriptions
     */
    async search(options: QZPaySubscriptionSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingSubscription>> {
        const { customerId, status, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingSubscriptions.deletedAt)];

        if (customerId) {
            conditions.push(eq(billingSubscriptions.customerId, customerId));
        }

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingSubscriptions.status, status));
            } else {
                conditions.push(eq(billingSubscriptions.status, status));
            }
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingSubscriptions)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(sql`${billingSubscriptions.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Soft delete a subscription
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingSubscriptions)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Subscription with id ${id} not found`);
        }
    }

    /**
     * Get subscription metrics
     */
    async getMetrics(livemode = true): Promise<{
        total: number;
        active: number;
        trialing: number;
        pastDue: number;
        canceled: number;
    }> {
        const result = await this.db
            .select({
                status: billingSubscriptions.status,
                count: count()
            })
            .from(billingSubscriptions)
            .where(and(eq(billingSubscriptions.livemode, livemode), isNull(billingSubscriptions.deletedAt)))
            .groupBy(billingSubscriptions.status);

        const metrics = {
            total: 0,
            active: 0,
            trialing: 0,
            pastDue: 0,
            canceled: 0
        };

        for (const row of result) {
            metrics.total += row.count;
            switch (row.status) {
                case 'active':
                    metrics.active = row.count;
                    break;
                case 'trialing':
                    metrics.trialing = row.count;
                    break;
                case 'past_due':
                    metrics.pastDue = row.count;
                    break;
                case 'canceled':
                    metrics.canceled = row.count;
                    break;
            }
        }

        return metrics;
    }

    // ==================== Eager Loading Methods ====================

    /**
     * Find subscription by ID with addons preloaded
     *
     * Prevents N+1 queries by eagerly loading subscription addons.
     * This is useful when you need to display or process a subscription with all its addons.
     *
     * @param id - Subscription ID
     * @returns Subscription with addons or null if not found
     *
     * @example
     * ```typescript
     * const subscription = await repo.findByIdWithAddons('sub_123');
     * if (subscription) {
     *   console.log(`Found ${subscription.addons.length} addons`);
     * }
     * ```
     */
    async findByIdWithAddons(id: string): Promise<QZPaySubscriptionWithAddons | null> {
        const result = await this.db.query?.billingSubscriptions.findFirst({
            where: and(eq(billingSubscriptions.id, id), isNull(billingSubscriptions.deletedAt)),
            with: {
                addons: true
            }
        });

        return (result ?? null) as QZPaySubscriptionWithAddons | null;
    }

    /**
     * Find subscriptions by customer ID with addons preloaded
     *
     * Prevents N+1 queries by eagerly loading addons for all subscriptions at once.
     * This is useful when displaying a customer's subscription list with addon details.
     *
     * @param customerId - Customer ID
     * @returns Array of subscriptions with their addons
     *
     * @example
     * ```typescript
     * const subscriptions = await repo.findByCustomerIdWithAddons('cust_123');
     * for (const sub of subscriptions) {
     *   console.log(`Subscription ${sub.id} has ${sub.addons.length} addons`);
     * }
     * ```
     */
    async findByCustomerIdWithAddons(customerId: string): Promise<QZPaySubscriptionWithAddons[]> {
        const result = await this.db.query?.billingSubscriptions.findMany({
            where: and(eq(billingSubscriptions.customerId, customerId), isNull(billingSubscriptions.deletedAt)),
            with: {
                addons: true
            },
            orderBy: sql`${billingSubscriptions.createdAt} DESC`
        });

        return (result ?? []) as QZPaySubscriptionWithAddons[];
    }

    // ==================== Lifecycle Query Methods ====================
    // These methods provide optimized queries for subscription lifecycle operations,
    // avoiding the need to load all subscriptions into memory.

    /**
     * Find active subscriptions that need renewal.
     *
     * Returns subscriptions where:
     * - Status is 'active'
     * - currentPeriodEnd is before the given date
     * - cancelAtPeriodEnd is false
     * - Not soft deleted
     *
     * @param beforeDate - Find subscriptions with period ending before this date
     * @param options - Query options (livemode, limit)
     */
    async findNeedingRenewal(beforeDate: Date, options: { livemode?: boolean; limit?: number } = {}): Promise<QZPayBillingSubscription[]> {
        const { livemode, limit = 100 } = options;

        const conditions = [
            eq(billingSubscriptions.status, 'active'),
            lt(billingSubscriptions.currentPeriodEnd, beforeDate),
            eq(billingSubscriptions.cancelAtPeriodEnd, false),
            isNull(billingSubscriptions.deletedAt)
        ];

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(billingSubscriptions.currentPeriodEnd)
            .limit(limit);
    }

    /**
     * Find subscriptions in trial period that are ending soon.
     *
     * Returns subscriptions where:
     * - Status is 'trialing'
     * - trialEnd is between now and the given future date
     * - Not soft deleted
     *
     * @param withinDate - Find trials ending before this date
     * @param options - Query options (livemode, limit)
     */
    async findTrialsEndingSoon(
        withinDate: Date,
        options: { livemode?: boolean; limit?: number } = {}
    ): Promise<QZPayBillingSubscription[]> {
        const { livemode, limit = 100 } = options;
        const now = new Date();

        const conditions = [
            eq(billingSubscriptions.status, 'trialing'),
            isNotNull(billingSubscriptions.trialEnd),
            gt(billingSubscriptions.trialEnd, now),
            lte(billingSubscriptions.trialEnd, withinDate),
            isNull(billingSubscriptions.deletedAt)
        ];

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(billingSubscriptions.trialEnd)
            .limit(limit);
    }

    /**
     * Find subscriptions in past_due status that need payment retry.
     *
     * Returns subscriptions where:
     * - Status is 'past_due'
     * - nextRetryAt is before the given date (or is null)
     * - gracePeriodEndsAt is after now (still in grace period)
     * - Not soft deleted
     *
     * This is different from `findNeedingRetry(maxRetries, livemode)` which
     * filters by retry count. This method is optimized for lifecycle processing.
     *
     * @param beforeDate - Find subscriptions with next retry before this date
     * @param options - Query options (livemode, limit)
     */
    async findNeedingPaymentRetry(
        beforeDate: Date,
        options: { livemode?: boolean; limit?: number } = {}
    ): Promise<QZPayBillingSubscription[]> {
        const { livemode, limit = 100 } = options;
        const now = new Date();

        const conditions = [
            eq(billingSubscriptions.status, 'past_due'),
            lte(billingSubscriptions.nextRetryAt, beforeDate),
            gt(billingSubscriptions.gracePeriodEndsAt, now),
            isNull(billingSubscriptions.deletedAt)
        ];

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(billingSubscriptions.nextRetryAt)
            .limit(limit);
    }

    /**
     * Find subscriptions with expired grace period.
     *
     * Returns subscriptions where:
     * - Status is 'past_due'
     * - gracePeriodEndsAt is before the given date
     * - Not soft deleted
     *
     * @param beforeDate - Find subscriptions with grace period ending before this date
     * @param options - Query options (livemode, limit)
     */
    async findWithExpiredGracePeriod(
        beforeDate: Date,
        options: { livemode?: boolean; limit?: number } = {}
    ): Promise<QZPayBillingSubscription[]> {
        const { livemode, limit = 100 } = options;

        const conditions = [
            eq(billingSubscriptions.status, 'past_due'),
            isNotNull(billingSubscriptions.gracePeriodEndsAt),
            lt(billingSubscriptions.gracePeriodEndsAt, beforeDate),
            isNull(billingSubscriptions.deletedAt)
        ];

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(billingSubscriptions.gracePeriodEndsAt)
            .limit(limit);
    }

    /**
     * Find subscriptions that should be canceled at period end.
     *
     * Returns subscriptions where:
     * - cancelAtPeriodEnd is true
     * - currentPeriodEnd is before the given date
     * - Status is 'active' or 'trialing'
     * - Not soft deleted
     *
     * This is different from `findScheduledForCancellation(livemode)` which
     * checks for `cancelAt` date. This method is optimized for lifecycle processing.
     *
     * @param beforeDate - Find subscriptions canceling before this date
     * @param options - Query options (livemode, limit)
     */
    async findPendingCancellationAtPeriodEnd(
        beforeDate: Date,
        options: { livemode?: boolean; limit?: number } = {}
    ): Promise<QZPayBillingSubscription[]> {
        const { livemode, limit = 100 } = options;

        const conditions = [
            eq(billingSubscriptions.cancelAtPeriodEnd, true),
            lt(billingSubscriptions.currentPeriodEnd, beforeDate),
            inArray(billingSubscriptions.status, ['active', 'trialing']),
            isNull(billingSubscriptions.deletedAt)
        ];

        if (livemode !== undefined) {
            conditions.push(eq(billingSubscriptions.livemode, livemode));
        }

        return this.db
            .select()
            .from(billingSubscriptions)
            .where(and(...conditions))
            .orderBy(billingSubscriptions.currentPeriodEnd)
            .limit(limit);
    }
}
