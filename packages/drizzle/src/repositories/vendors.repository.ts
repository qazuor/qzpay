/**
 * Vendors repository for QZPay Drizzle
 *
 * Provides marketplace vendor and payout database operations.
 */
import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    billingVendorPayouts,
    billingVendors,
    type QZPayBillingVendor,
    type QZPayBillingVendorInsert,
    type QZPayBillingVendorPayout,
    type QZPayBillingVendorPayoutInsert
} from '../schema/index.js';
import { firstOrNull, firstOrThrow, type QZPayPaginatedResult } from './base.repository.js';

/**
 * Onboarding status values
 */
export type QZPayOnboardingStatusValue = 'pending' | 'in_progress' | 'completed' | 'rejected';

/**
 * Payout status values
 */
export type QZPayPayoutStatusValue = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';

/**
 * Vendors repository
 */
export class QZPayVendorsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find vendor by ID
     */
    async findById(id: string): Promise<QZPayBillingVendor | null> {
        const result = await this.db
            .select()
            .from(billingVendors)
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new vendor
     */
    async create(input: QZPayBillingVendorInsert): Promise<QZPayBillingVendor> {
        const result = await this.db.insert(billingVendors).values(input).returning();
        return firstOrThrow(result, 'Vendor', 'new');
    }

    /**
     * Update a vendor
     */
    async update(id: string, input: Partial<QZPayBillingVendorInsert>): Promise<QZPayBillingVendor> {
        const result = await this.db
            .update(billingVendors)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Vendor', id);
    }

    /**
     * Find vendor by external ID
     */
    async findByExternalId(externalId: string, livemode = true): Promise<QZPayBillingVendor | null> {
        const result = await this.db
            .select()
            .from(billingVendors)
            .where(and(eq(billingVendors.externalId, externalId), eq(billingVendors.livemode, livemode), isNull(billingVendors.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find vendor by Stripe account ID
     */
    async findByStripeAccountId(stripeAccountId: string): Promise<QZPayBillingVendor | null> {
        const result = await this.db
            .select()
            .from(billingVendors)
            .where(and(eq(billingVendors.stripeAccountId, stripeAccountId), isNull(billingVendors.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find vendor by MercadoPago merchant ID
     */
    async findByMpMerchantId(mpMerchantId: string): Promise<QZPayBillingVendor | null> {
        const result = await this.db
            .select()
            .from(billingVendors)
            .where(and(eq(billingVendors.mpMerchantId, mpMerchantId), isNull(billingVendors.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find vendors by onboarding status
     */
    async findByOnboardingStatus(status: QZPayOnboardingStatusValue, livemode = true): Promise<QZPayBillingVendor[]> {
        return this.db
            .select()
            .from(billingVendors)
            .where(
                and(eq(billingVendors.onboardingStatus, status), eq(billingVendors.livemode, livemode), isNull(billingVendors.deletedAt))
            )
            .orderBy(sql`${billingVendors.createdAt} DESC`);
    }

    /**
     * Find vendors that can receive payments
     */
    async findPaymentReady(livemode = true): Promise<QZPayBillingVendor[]> {
        return this.db
            .select()
            .from(billingVendors)
            .where(
                and(eq(billingVendors.canReceivePayments, true), eq(billingVendors.livemode, livemode), isNull(billingVendors.deletedAt))
            )
            .orderBy(sql`${billingVendors.name} ASC`);
    }

    /**
     * Update onboarding status
     */
    async updateOnboardingStatus(
        id: string,
        status: QZPayOnboardingStatusValue,
        canReceivePayments?: boolean
    ): Promise<QZPayBillingVendor> {
        const updateData: Partial<QZPayBillingVendorInsert> = {
            onboardingStatus: status,
            updatedAt: new Date()
        };

        if (canReceivePayments !== undefined) {
            updateData.canReceivePayments = canReceivePayments;
        }

        // If completed, enable payments
        if (status === 'completed' && canReceivePayments === undefined) {
            updateData.canReceivePayments = true;
        }

        const result = await this.db
            .update(billingVendors)
            .set(updateData)
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Vendor', id);
    }

    /**
     * Update Stripe account ID
     */
    async updateStripeAccountId(id: string, stripeAccountId: string): Promise<QZPayBillingVendor> {
        const result = await this.db
            .update(billingVendors)
            .set({
                stripeAccountId,
                updatedAt: new Date()
            })
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Vendor', id);
    }

    /**
     * Update pending balance
     */
    async updatePendingBalance(id: string, amount: number): Promise<QZPayBillingVendor> {
        const result = await this.db
            .update(billingVendors)
            .set({
                pendingBalance: amount,
                updatedAt: new Date()
            })
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Vendor', id);
    }

    /**
     * Add to pending balance
     */
    async addToPendingBalance(id: string, amount: number): Promise<QZPayBillingVendor> {
        const result = await this.db
            .update(billingVendors)
            .set({
                pendingBalance: sql`COALESCE(${billingVendors.pendingBalance}, 0) + ${amount}`,
                updatedAt: new Date()
            })
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Vendor', id);
    }

    /**
     * Soft delete a vendor
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingVendors)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingVendors.id, id), isNull(billingVendors.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Vendor with id ${id} not found`);
        }
    }

    /**
     * Search vendors
     */
    async search(options: {
        query?: string;
        onboardingStatus?: QZPayOnboardingStatusValue;
        canReceivePayments?: boolean;
        livemode?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<QZPayPaginatedResult<QZPayBillingVendor>> {
        const { onboardingStatus, canReceivePayments, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingVendors.deletedAt)];

        if (onboardingStatus) {
            conditions.push(eq(billingVendors.onboardingStatus, onboardingStatus));
        }

        if (canReceivePayments !== undefined) {
            conditions.push(eq(billingVendors.canReceivePayments, canReceivePayments));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingVendors.livemode, livemode));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingVendors)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingVendors)
            .where(and(...conditions))
            .orderBy(sql`${billingVendors.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    // ==================== Vendor Payouts ====================

    /**
     * Create payout record
     */
    async createPayout(input: QZPayBillingVendorPayoutInsert): Promise<QZPayBillingVendorPayout> {
        const result = await this.db.insert(billingVendorPayouts).values(input).returning();
        return firstOrThrow(result, 'VendorPayout', 'new');
    }

    /**
     * Find payout by ID
     */
    async findPayoutById(id: string): Promise<QZPayBillingVendorPayout | null> {
        const result = await this.db.select().from(billingVendorPayouts).where(eq(billingVendorPayouts.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find payout by provider payout ID
     */
    async findPayoutByProviderPayoutId(providerPayoutId: string): Promise<QZPayBillingVendorPayout | null> {
        const result = await this.db
            .select()
            .from(billingVendorPayouts)
            .where(eq(billingVendorPayouts.providerPayoutId, providerPayoutId))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find payouts by vendor ID
     */
    async findPayoutsByVendorId(
        vendorId: string,
        options: { status?: QZPayPayoutStatusValue[]; limit?: number; offset?: number } = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingVendorPayout>> {
        const { status, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingVendorPayouts.vendorId, vendorId)];

        if (status && status.length > 0) {
            conditions.push(inArray(billingVendorPayouts.status, status));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingVendorPayouts)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingVendorPayouts)
            .where(and(...conditions))
            .orderBy(sql`${billingVendorPayouts.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Update payout status
     */
    async updatePayoutStatus(
        id: string,
        status: QZPayPayoutStatusValue,
        additionalData?: {
            paidAt?: Date;
            failureCode?: string;
            failureMessage?: string;
        }
    ): Promise<QZPayBillingVendorPayout> {
        const updateData: Partial<QZPayBillingVendorPayoutInsert> = {
            status,
            ...additionalData
        };

        if (status === 'succeeded' && !additionalData?.paidAt) {
            updateData.paidAt = new Date();
        }

        const result = await this.db.update(billingVendorPayouts).set(updateData).where(eq(billingVendorPayouts.id, id)).returning();

        return firstOrThrow(result, 'VendorPayout', id);
    }

    /**
     * Get payout totals for vendor
     */
    async getPayoutTotalsForVendor(
        vendorId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalPaid: number;
        totalPending: number;
        totalFailed: number;
    }> {
        const conditions = [eq(billingVendorPayouts.vendorId, vendorId)];

        if (startDate) {
            conditions.push(gte(billingVendorPayouts.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingVendorPayouts.createdAt, endDate));
        }

        const result = await this.db
            .select({
                totalPaid: sql<number>`COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0)::int`,
                totalPending: sql<number>`COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END), 0)::int`,
                totalFailed: sql<number>`COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0)::int`
            })
            .from(billingVendorPayouts)
            .where(and(...conditions));

        return result[0] ?? { totalPaid: 0, totalPending: 0, totalFailed: 0 };
    }
}
