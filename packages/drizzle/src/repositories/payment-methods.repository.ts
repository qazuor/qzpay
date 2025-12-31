/**
 * Payment methods repository for QZPay Drizzle
 *
 * Provides payment method database operations.
 */
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type QZPayBillingPaymentMethod, type QZPayBillingPaymentMethodInsert, billingPaymentMethods } from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Payment method search options
 */
export interface QZPayPaymentMethodSearchOptions {
    customerId?: string;
    type?: string;
    provider?: 'stripe' | 'mercadopago';
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Payment methods repository
 */
export class QZPayPaymentMethodsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find payment method by ID
     */
    async findById(id: string): Promise<QZPayBillingPaymentMethod | null> {
        const result = await this.db
            .select()
            .from(billingPaymentMethods)
            .where(and(eq(billingPaymentMethods.id, id), isNull(billingPaymentMethods.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new payment method
     */
    async create(input: QZPayBillingPaymentMethodInsert): Promise<QZPayBillingPaymentMethod> {
        const result = await this.db.insert(billingPaymentMethods).values(input).returning();
        return firstOrThrow(result, 'PaymentMethod', 'new');
    }

    /**
     * Update a payment method
     */
    async update(id: string, input: Partial<QZPayBillingPaymentMethodInsert>): Promise<QZPayBillingPaymentMethod> {
        const result = await this.db
            .update(billingPaymentMethods)
            .set(input)
            .where(and(eq(billingPaymentMethods.id, id), isNull(billingPaymentMethods.deletedAt)))
            .returning();

        return firstOrThrow(result, 'PaymentMethod', id);
    }

    /**
     * Find payment method by provider payment method ID
     */
    async findByProviderPaymentMethodId(providerPaymentMethodId: string): Promise<QZPayBillingPaymentMethod | null> {
        const result = await this.db
            .select()
            .from(billingPaymentMethods)
            .where(and(eq(billingPaymentMethods.providerPaymentMethodId, providerPaymentMethodId), isNull(billingPaymentMethods.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find payment methods by customer ID
     */
    async findByCustomerId(
        customerId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingPaymentMethod>> {
        const { limit = 100, offset = 0 } = options;

        const conditions = [eq(billingPaymentMethods.customerId, customerId), isNull(billingPaymentMethods.deletedAt)];

        const countResult = await this.db
            .select({ count: count() })
            .from(billingPaymentMethods)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingPaymentMethods)
            .where(and(...conditions))
            .orderBy(sql`${billingPaymentMethods.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find default payment method for customer
     */
    async findDefaultByCustomerId(customerId: string): Promise<QZPayBillingPaymentMethod | null> {
        const result = await this.db
            .select()
            .from(billingPaymentMethods)
            .where(
                and(
                    eq(billingPaymentMethods.customerId, customerId),
                    eq(billingPaymentMethods.isDefault, true),
                    isNull(billingPaymentMethods.deletedAt)
                )
            )
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Set default payment method for customer
     */
    async setDefault(customerId: string, paymentMethodId: string): Promise<QZPayBillingPaymentMethod> {
        // First, unset all defaults for customer
        await this.db
            .update(billingPaymentMethods)
            .set({ isDefault: false })
            .where(and(eq(billingPaymentMethods.customerId, customerId), isNull(billingPaymentMethods.deletedAt)));

        // Then set the new default
        const result = await this.db
            .update(billingPaymentMethods)
            .set({ isDefault: true })
            .where(and(eq(billingPaymentMethods.id, paymentMethodId), isNull(billingPaymentMethods.deletedAt)))
            .returning();

        return firstOrThrow(result, 'PaymentMethod', paymentMethodId);
    }

    /**
     * Unset default payment method for customer
     */
    async unsetDefault(customerId: string): Promise<void> {
        await this.db
            .update(billingPaymentMethods)
            .set({ isDefault: false })
            .where(and(eq(billingPaymentMethods.customerId, customerId), isNull(billingPaymentMethods.deletedAt)));
    }

    /**
     * Find payment methods expiring soon
     */
    async findExpiringSoon(months: number, livemode = true): Promise<QZPayBillingPaymentMethod[]> {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        let targetMonth = currentMonth + months;
        let targetYear = currentYear;
        while (targetMonth > 12) {
            targetMonth -= 12;
            targetYear += 1;
        }

        return this.db
            .select()
            .from(billingPaymentMethods)
            .where(
                and(
                    eq(billingPaymentMethods.type, 'card'),
                    eq(billingPaymentMethods.livemode, livemode),
                    isNull(billingPaymentMethods.deletedAt),
                    sql`(${billingPaymentMethods.expYear} < ${targetYear} OR (${billingPaymentMethods.expYear} = ${targetYear} AND ${billingPaymentMethods.expMonth} <= ${targetMonth}))`
                )
            )
            .orderBy(sql`${billingPaymentMethods.expYear} ASC, ${billingPaymentMethods.expMonth} ASC`);
    }

    /**
     * Find expired payment methods
     */
    async findExpired(livemode = true): Promise<QZPayBillingPaymentMethod[]> {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        return this.db
            .select()
            .from(billingPaymentMethods)
            .where(
                and(
                    eq(billingPaymentMethods.type, 'card'),
                    eq(billingPaymentMethods.livemode, livemode),
                    isNull(billingPaymentMethods.deletedAt),
                    sql`(${billingPaymentMethods.expYear} < ${currentYear} OR (${billingPaymentMethods.expYear} = ${currentYear} AND ${billingPaymentMethods.expMonth} < ${currentMonth}))`
                )
            );
    }

    /**
     * Search payment methods
     */
    async search(options: QZPayPaymentMethodSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingPaymentMethod>> {
        const { customerId, type, provider, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingPaymentMethods.deletedAt)];

        if (customerId) {
            conditions.push(eq(billingPaymentMethods.customerId, customerId));
        }

        if (type) {
            conditions.push(eq(billingPaymentMethods.type, type));
        }

        if (provider) {
            conditions.push(eq(billingPaymentMethods.provider, provider));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingPaymentMethods.livemode, livemode));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingPaymentMethods)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingPaymentMethods)
            .where(and(...conditions))
            .orderBy(sql`${billingPaymentMethods.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Soft delete a payment method
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingPaymentMethods)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingPaymentMethods.id, id), isNull(billingPaymentMethods.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`PaymentMethod with id ${id} not found`);
        }
    }

    /**
     * Delete all payment methods for customer (soft delete)
     */
    async deleteByCustomerId(customerId: string): Promise<number> {
        const result = await this.db
            .update(billingPaymentMethods)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingPaymentMethods.customerId, customerId), isNull(billingPaymentMethods.deletedAt)))
            .returning();

        return result.length;
    }

    /**
     * Count payment methods for customer
     */
    async countByCustomerId(customerId: string): Promise<number> {
        const result = await this.db
            .select({ count: count() })
            .from(billingPaymentMethods)
            .where(and(eq(billingPaymentMethods.customerId, customerId), isNull(billingPaymentMethods.deletedAt)));

        return result[0]?.count ?? 0;
    }

    /**
     * Check if customer has a valid payment method
     */
    async hasValidPaymentMethod(customerId: string): Promise<boolean> {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const result = await this.db
            .select({ id: billingPaymentMethods.id })
            .from(billingPaymentMethods)
            .where(
                and(
                    eq(billingPaymentMethods.customerId, customerId),
                    isNull(billingPaymentMethods.deletedAt),
                    sql`(${billingPaymentMethods.type} != 'card' OR ${billingPaymentMethods.expYear} > ${currentYear} OR (${billingPaymentMethods.expYear} = ${currentYear} AND ${billingPaymentMethods.expMonth} >= ${currentMonth}))`
                )
            )
            .limit(1);

        return result.length > 0;
    }
}
