/**
 * Promo codes repository for QZPay Drizzle
 *
 * Provides promo code and usage database operations.
 */
import { and, count, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingPromoCode,
    type QZPayBillingPromoCodeInsert,
    type QZPayBillingPromoCodeUsage,
    type QZPayBillingPromoCodeUsageInsert,
    billingPromoCodeUsage,
    billingPromoCodes
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Discount type values
 */
export type QZPayDiscountTypeValue = 'percentage' | 'fixed_amount';

/**
 * Promo codes repository
 */
export class QZPayPromoCodesRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find promo code by ID
     */
    async findById(id: string): Promise<QZPayBillingPromoCode | null> {
        const result = await this.db.select().from(billingPromoCodes).where(eq(billingPromoCodes.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new promo code
     */
    async create(input: QZPayBillingPromoCodeInsert): Promise<QZPayBillingPromoCode> {
        const result = await this.db.insert(billingPromoCodes).values(input).returning();
        return firstOrThrow(result, 'PromoCode', 'new');
    }

    /**
     * Update a promo code
     */
    async update(id: string, input: Partial<QZPayBillingPromoCodeInsert>): Promise<QZPayBillingPromoCode> {
        const result = await this.db.update(billingPromoCodes).set(input).where(eq(billingPromoCodes.id, id)).returning();

        return firstOrThrow(result, 'PromoCode', id);
    }

    /**
     * Find promo code by code string
     */
    async findByCode(code: string, livemode = true): Promise<QZPayBillingPromoCode | null> {
        const result = await this.db
            .select()
            .from(billingPromoCodes)
            .where(and(eq(billingPromoCodes.code, code.toUpperCase()), eq(billingPromoCodes.livemode, livemode)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find active promo codes
     */
    async findActive(livemode = true): Promise<QZPayBillingPromoCode[]> {
        const now = new Date();

        return this.db
            .select()
            .from(billingPromoCodes)
            .where(
                and(
                    eq(billingPromoCodes.active, true),
                    eq(billingPromoCodes.livemode, livemode),
                    or(isNull(billingPromoCodes.expiresAt), gt(billingPromoCodes.expiresAt, now)),
                    or(isNull(billingPromoCodes.startsAt), lte(billingPromoCodes.startsAt, now))
                )
            )
            .orderBy(sql`${billingPromoCodes.createdAt} DESC`);
    }

    /**
     * Validate promo code basic rules (sync validation)
     */
    private validatePromoCodeRules(promoCode: QZPayBillingPromoCode): string | null {
        const now = new Date();

        if (!promoCode.active) return 'Promo code is not active';
        if (promoCode.expiresAt && promoCode.expiresAt < now) return 'Promo code has expired';
        if (promoCode.startsAt && promoCode.startsAt > now) return 'Promo code is not yet valid';
        if (promoCode.maxUses !== null && promoCode.usedCount !== null && promoCode.usedCount >= promoCode.maxUses) {
            return 'Promo code has reached maximum uses';
        }

        return null;
    }

    /**
     * Check if promo code is valid
     */
    async isValid(code: string, customerId?: string, livemode = true): Promise<boolean> {
        const promoCode = await this.findByCode(code, livemode);
        if (!promoCode) return false;

        const ruleError = this.validatePromoCodeRules(promoCode);
        if (ruleError) return false;

        // Check new customers only
        if (promoCode.newCustomersOnly && customerId) {
            const usage = await this.findUsageByCustomerId(customerId);
            if (usage.length > 0) return false;
        }

        return true;
    }

    /**
     * Validate and get promo code with discount info
     */
    async validateAndGet(
        code: string,
        customerId?: string,
        livemode = true
    ): Promise<{
        valid: boolean;
        promoCode?: QZPayBillingPromoCode;
        error?: string;
    }> {
        const promoCode = await this.findByCode(code, livemode);
        if (!promoCode) {
            return { valid: false, error: 'Promo code not found' };
        }

        const ruleError = this.validatePromoCodeRules(promoCode);
        if (ruleError) {
            return { valid: false, error: ruleError };
        }

        if (promoCode.newCustomersOnly && customerId) {
            const usage = await this.findUsageByCustomerId(customerId);
            if (usage.length > 0) {
                return { valid: false, error: 'Promo code is only valid for new customers' };
            }
        }

        return { valid: true, promoCode };
    }

    /**
     * Increment usage count
     */
    async incrementUsage(id: string): Promise<QZPayBillingPromoCode> {
        const result = await this.db
            .update(billingPromoCodes)
            .set({
                usedCount: sql`COALESCE(${billingPromoCodes.usedCount}, 0) + 1`
            })
            .where(eq(billingPromoCodes.id, id))
            .returning();

        return firstOrThrow(result, 'PromoCode', id);
    }

    /**
     * Deactivate promo code
     */
    async deactivate(id: string): Promise<QZPayBillingPromoCode> {
        const result = await this.db.update(billingPromoCodes).set({ active: false }).where(eq(billingPromoCodes.id, id)).returning();

        return firstOrThrow(result, 'PromoCode', id);
    }

    /**
     * Find expired but still active promo codes
     */
    async findExpiredActive(livemode = true): Promise<QZPayBillingPromoCode[]> {
        return this.db
            .select()
            .from(billingPromoCodes)
            .where(
                and(
                    eq(billingPromoCodes.active, true),
                    eq(billingPromoCodes.livemode, livemode),
                    lt(billingPromoCodes.expiresAt, new Date())
                )
            );
    }

    /**
     * Search promo codes
     */
    async search(options: {
        active?: boolean;
        type?: string;
        livemode?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<QZPayPaginatedResult<QZPayBillingPromoCode>> {
        const { active, type, livemode, limit = 100, offset = 0 } = options;

        const conditions: ReturnType<typeof eq>[] = [];

        if (active !== undefined) {
            conditions.push(eq(billingPromoCodes.active, active));
        }

        if (type) {
            conditions.push(eq(billingPromoCodes.type, type));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingPromoCodes.livemode, livemode));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await this.db.select({ count: count() }).from(billingPromoCodes).where(whereClause);

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingPromoCodes)
            .where(whereClause)
            .orderBy(sql`${billingPromoCodes.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    // ==================== Promo Code Usage ====================

    /**
     * Record promo code usage
     */
    async recordUsage(input: QZPayBillingPromoCodeUsageInsert): Promise<QZPayBillingPromoCodeUsage> {
        const result = await this.db.insert(billingPromoCodeUsage).values(input).returning();

        // Increment usage count on the promo code
        await this.incrementUsage(input.promoCodeId);

        return firstOrThrow(result, 'PromoCodeUsage', 'new');
    }

    /**
     * Find usage by promo code ID
     */
    async findUsageByPromoCodeId(promoCodeId: string): Promise<QZPayBillingPromoCodeUsage[]> {
        return this.db
            .select()
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.promoCodeId, promoCodeId))
            .orderBy(sql`${billingPromoCodeUsage.usedAt} DESC`);
    }

    /**
     * Find usage by customer ID
     */
    async findUsageByCustomerId(customerId: string): Promise<QZPayBillingPromoCodeUsage[]> {
        return this.db
            .select()
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.customerId, customerId))
            .orderBy(sql`${billingPromoCodeUsage.usedAt} DESC`);
    }

    /**
     * Check if customer has used a promo code
     */
    async hasCustomerUsedCode(promoCodeId: string, customerId: string): Promise<boolean> {
        const result = await this.db
            .select({ id: billingPromoCodeUsage.id })
            .from(billingPromoCodeUsage)
            .where(and(eq(billingPromoCodeUsage.promoCodeId, promoCodeId), eq(billingPromoCodeUsage.customerId, customerId)))
            .limit(1);

        return result.length > 0;
    }

    /**
     * Get usage count for promo code
     */
    async getUsageCount(promoCodeId: string): Promise<number> {
        const result = await this.db
            .select({ count: count() })
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.promoCodeId, promoCodeId));

        return result[0]?.count ?? 0;
    }

    /**
     * Get total discount given by promo code
     */
    async getTotalDiscountGiven(promoCodeId: string): Promise<number> {
        const result = await this.db
            .select({ total: sql<number>`COALESCE(SUM(discount_amount), 0)::int` })
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.promoCodeId, promoCodeId));

        return result[0]?.total ?? 0;
    }
}
