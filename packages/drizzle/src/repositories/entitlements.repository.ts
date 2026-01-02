/**
 * Entitlements repository for QZPay Drizzle
 *
 * Provides entitlement definition and customer entitlement database operations.
 */
import { and, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingCustomerEntitlement,
    type QZPayBillingCustomerEntitlementInsert,
    type QZPayBillingEntitlement,
    type QZPayBillingEntitlementInsert,
    billingCustomerEntitlements,
    billingEntitlements
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Entitlement search options
 */
export interface QZPayEntitlementSearchOptions {
    query?: string;
    limit?: number;
    offset?: number;
}

/**
 * Customer entitlement search options
 */
export interface QZPayCustomerEntitlementSearchOptions {
    customerId?: string;
    entitlementKey?: string;
    source?: 'subscription' | 'purchase' | 'manual';
    includeExpired?: boolean;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Entitlements repository
 */
export class QZPayEntitlementsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    // ==================== Entitlement Definitions ====================

    /**
     * Find entitlement definition by ID
     */
    async findDefinitionById(id: string): Promise<QZPayBillingEntitlement | null> {
        const result = await this.db.select().from(billingEntitlements).where(eq(billingEntitlements.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find entitlement definition by key
     */
    async findDefinitionByKey(key: string): Promise<QZPayBillingEntitlement | null> {
        const result = await this.db.select().from(billingEntitlements).where(eq(billingEntitlements.key, key)).limit(1);

        return firstOrNull(result);
    }

    /**
     * List all entitlement definitions
     */
    async listDefinitions(): Promise<QZPayBillingEntitlement[]> {
        return this.db.select().from(billingEntitlements).orderBy(sql`${billingEntitlements.key} ASC`);
    }

    /**
     * Create an entitlement definition
     */
    async createDefinition(input: QZPayBillingEntitlementInsert): Promise<QZPayBillingEntitlement> {
        const result = await this.db.insert(billingEntitlements).values(input).returning();
        return firstOrThrow(result, 'Entitlement', 'new');
    }

    /**
     * Update an entitlement definition
     */
    async updateDefinition(id: string, input: Partial<QZPayBillingEntitlementInsert>): Promise<QZPayBillingEntitlement> {
        const result = await this.db
            .update(billingEntitlements)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(billingEntitlements.id, id))
            .returning();

        return firstOrThrow(result, 'Entitlement', id);
    }

    /**
     * Delete an entitlement definition (cascades to customer entitlements)
     */
    async deleteDefinition(id: string): Promise<void> {
        const result = await this.db.delete(billingEntitlements).where(eq(billingEntitlements.id, id)).returning();

        if (result.length === 0) {
            throw new Error(`Entitlement with id ${id} not found`);
        }
    }

    /**
     * Search entitlement definitions
     */
    async searchDefinitions(options: QZPayEntitlementSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingEntitlement>> {
        const { limit = 100, offset = 0 } = options;

        // Get count
        const countResult = await this.db.select({ count: count() }).from(billingEntitlements);

        const total = countResult[0]?.count ?? 0;

        // Get data
        const data = await this.db
            .select()
            .from(billingEntitlements)
            .orderBy(sql`${billingEntitlements.key} ASC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    // ==================== Customer Entitlements ====================

    /**
     * Grant an entitlement to a customer
     */
    async grant(input: QZPayBillingCustomerEntitlementInsert): Promise<QZPayBillingCustomerEntitlement> {
        // Check if customer already has this entitlement (active)
        const existing = await this.findActiveGrant(input.customerId, input.entitlementKey);

        if (existing) {
            // Update expiration if new grant has later expiration
            if (!input.expiresAt || (existing.expiresAt && input.expiresAt > existing.expiresAt)) {
                const result = await this.db
                    .update(billingCustomerEntitlements)
                    .set({
                        expiresAt: input.expiresAt ?? null,
                        source: input.source,
                        sourceId: input.sourceId ?? null
                    })
                    .where(eq(billingCustomerEntitlements.id, existing.id))
                    .returning();
                return firstOrThrow(result, 'CustomerEntitlement', existing.id);
            }
            return existing;
        }

        const result = await this.db.insert(billingCustomerEntitlements).values(input).returning();
        return firstOrThrow(result, 'CustomerEntitlement', 'new');
    }

    /**
     * Revoke an entitlement from a customer
     */
    async revoke(customerId: string, entitlementKey: string): Promise<void> {
        await this.db
            .delete(billingCustomerEntitlements)
            .where(
                and(eq(billingCustomerEntitlements.customerId, customerId), eq(billingCustomerEntitlements.entitlementKey, entitlementKey))
            );
    }

    /**
     * Revoke all entitlements from a source (e.g., when subscription ends)
     */
    async revokeBySource(source: string, sourceId: string): Promise<number> {
        const result = await this.db
            .delete(billingCustomerEntitlements)
            .where(and(eq(billingCustomerEntitlements.source, source), eq(billingCustomerEntitlements.sourceId, sourceId)))
            .returning();

        return result.length;
    }

    /**
     * Find active grant for a customer and entitlement
     */
    async findActiveGrant(customerId: string, entitlementKey: string): Promise<QZPayBillingCustomerEntitlement | null> {
        const now = new Date();

        const result = await this.db
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.customerId, customerId),
                    eq(billingCustomerEntitlements.entitlementKey, entitlementKey),
                    or(isNull(billingCustomerEntitlements.expiresAt), gt(billingCustomerEntitlements.expiresAt, now))
                )
            )
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Check if customer has an entitlement
     */
    async check(customerId: string, entitlementKey: string): Promise<boolean> {
        const grant = await this.findActiveGrant(customerId, entitlementKey);
        return grant !== null;
    }

    /**
     * Find all entitlements for a customer
     */
    async findByCustomerId(customerId: string, includeExpired = false): Promise<QZPayBillingCustomerEntitlement[]> {
        const customerCondition = eq(billingCustomerEntitlements.customerId, customerId);

        if (!includeExpired) {
            const now = new Date();
            const notExpiredCondition = or(isNull(billingCustomerEntitlements.expiresAt), gt(billingCustomerEntitlements.expiresAt, now));
            return this.db
                .select()
                .from(billingCustomerEntitlements)
                .where(and(customerCondition, notExpiredCondition))
                .orderBy(sql`${billingCustomerEntitlements.entitlementKey} ASC`);
        }

        return this.db
            .select()
            .from(billingCustomerEntitlements)
            .where(customerCondition)
            .orderBy(sql`${billingCustomerEntitlements.entitlementKey} ASC`);
    }

    /**
     * Find all customers with a specific entitlement
     */
    async findCustomersByEntitlement(entitlementKey: string): Promise<QZPayBillingCustomerEntitlement[]> {
        const now = new Date();

        return this.db
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.entitlementKey, entitlementKey),
                    or(isNull(billingCustomerEntitlements.expiresAt), gt(billingCustomerEntitlements.expiresAt, now))
                )
            );
    }

    /**
     * Search customer entitlements
     */
    async searchCustomerEntitlements(
        options: QZPayCustomerEntitlementSearchOptions
    ): Promise<QZPayPaginatedResult<QZPayBillingCustomerEntitlement>> {
        const { customerId, entitlementKey, source, includeExpired, livemode, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (customerId) {
            conditions.push(eq(billingCustomerEntitlements.customerId, customerId));
        }

        if (entitlementKey) {
            conditions.push(eq(billingCustomerEntitlements.entitlementKey, entitlementKey));
        }

        if (source) {
            conditions.push(eq(billingCustomerEntitlements.source, source));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingCustomerEntitlements.livemode, livemode));
        }

        if (!includeExpired) {
            const now = new Date();
            const expirationCondition = or(isNull(billingCustomerEntitlements.expiresAt), gt(billingCustomerEntitlements.expiresAt, now));
            if (expirationCondition) {
                conditions.push(expirationCondition);
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get count
        const countQuery = this.db.select({ count: count() }).from(billingCustomerEntitlements);
        const countResult = whereClause ? await countQuery.where(whereClause) : await countQuery;

        const total = countResult[0]?.count ?? 0;

        // Get data
        const dataQuery = this.db.select().from(billingCustomerEntitlements);
        const data = whereClause
            ? await dataQuery.where(whereClause).orderBy(sql`${billingCustomerEntitlements.grantedAt} DESC`).limit(limit).offset(offset)
            : await dataQuery.orderBy(sql`${billingCustomerEntitlements.grantedAt} DESC`).limit(limit).offset(offset);

        return { data, total };
    }

    /**
     * Count customer entitlements
     */
    async countCustomerEntitlements(customerId: string, includeExpired = false): Promise<number> {
        const customerCondition = eq(billingCustomerEntitlements.customerId, customerId);

        const whereClause = includeExpired
            ? customerCondition
            : and(
                  customerCondition,
                  or(isNull(billingCustomerEntitlements.expiresAt), gt(billingCustomerEntitlements.expiresAt, new Date()))
              );

        const result = await this.db.select({ count: count() }).from(billingCustomerEntitlements).where(whereClause);

        return result[0]?.count ?? 0;
    }

    /**
     * Find expiring entitlements (for notifications)
     */
    async findExpiringSoon(days: number, livemode: boolean): Promise<QZPayBillingCustomerEntitlement[]> {
        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        return this.db
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.livemode, livemode),
                    gt(billingCustomerEntitlements.expiresAt, now),
                    sql`${billingCustomerEntitlements.expiresAt} <= ${futureDate}`
                )
            )
            .orderBy(sql`${billingCustomerEntitlements.expiresAt} ASC`);
    }

    /**
     * Clean up expired entitlements
     */
    async deleteExpired(): Promise<number> {
        const now = new Date();

        const result = await this.db
            .delete(billingCustomerEntitlements)
            .where(sql`${billingCustomerEntitlements.expiresAt} <= ${now}`)
            .returning();

        return result.length;
    }
}
