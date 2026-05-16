/**
 * Checkouts repository for QZPay Drizzle
 *
 * Provides checkout session database operations. Mirrors the patterns used by
 * QZPaySubscriptionsRepository (basic CRUD + search) without the lifecycle /
 * metrics methods that don't apply to short-lived session records.
 */
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type QZPayBillingCheckout, type QZPayBillingCheckoutInsert, billingCheckouts } from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Checkout status values
 */
export type QZPayCheckoutStatusValue = 'open' | 'complete' | 'expired';

/**
 * Checkout search options
 */
export interface QZPayCheckoutSearchOptions {
    customerId?: string;
    status?: QZPayCheckoutStatusValue | QZPayCheckoutStatusValue[];
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Checkouts repository
 */
export class QZPayCheckoutsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find a checkout by ID.
     */
    async findById(id: string): Promise<QZPayBillingCheckout | null> {
        const result = await this.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Insert a new checkout.
     */
    async create(input: QZPayBillingCheckoutInsert): Promise<QZPayBillingCheckout> {
        const result = await this.db.insert(billingCheckouts).values(input).returning();
        return firstOrThrow(result, 'Checkout', 'new');
    }

    /**
     * Partial update.
     */
    async update(id: string, input: Partial<QZPayBillingCheckoutInsert>): Promise<QZPayBillingCheckout> {
        const result = await this.db.update(billingCheckouts).set(input).where(eq(billingCheckouts.id, id)).returning();

        return firstOrThrow(result, 'Checkout', id);
    }

    /**
     * List all checkouts for a customer, newest first.
     */
    async findByCustomerId(
        customerId: string,
        options: { limit?: number; offset?: number; status?: QZPayCheckoutStatusValue[] } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingCheckout>> {
        const { limit = 100, offset = 0, status } = options;

        const conditions = [eq(billingCheckouts.customerId, customerId)];
        if (status && status.length > 0) {
            conditions.push(inArray(billingCheckouts.status, status));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingCheckouts)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingCheckouts)
            .where(and(...conditions))
            .orderBy(sql`${billingCheckouts.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Paginated search across all checkouts.
     */
    async search(options: QZPayCheckoutSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingCheckout>> {
        const { customerId, status, livemode, limit = 100, offset = 0 } = options;

        const conditions = [];

        if (customerId) {
            conditions.push(eq(billingCheckouts.customerId, customerId));
        }

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingCheckouts.status, status));
            } else {
                conditions.push(eq(billingCheckouts.status, status));
            }
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingCheckouts.livemode, livemode));
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await this.db.select({ count: count() }).from(billingCheckouts).where(where);

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingCheckouts)
            .where(where)
            .orderBy(sql`${billingCheckouts.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }
}
