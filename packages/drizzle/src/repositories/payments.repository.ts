/**
 * Payments repository for QZPay Drizzle
 *
 * Provides payment and refund database operations.
 */
import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingPayment,
    type QZPayBillingPaymentInsert,
    type QZPayBillingRefund,
    type QZPayBillingRefundInsert,
    billingPayments,
    billingRefunds
} from '../schema/index.js';
import { type QZPayPaginatedResult, firstOrNull, firstOrThrow } from './base.repository.js';

/**
 * Payment status values
 */
export type QZPayPaymentStatusValue = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded';

/**
 * Payment search options
 */
export interface QZPayPaymentSearchOptions {
    customerId?: string;
    subscriptionId?: string;
    status?: QZPayPaymentStatusValue | QZPayPaymentStatusValue[];
    provider?: 'stripe' | 'mercadopago';
    startDate?: Date;
    endDate?: Date;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Payments repository
 */
export class QZPayPaymentsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find payment by ID
     */
    async findById(id: string): Promise<QZPayBillingPayment | null> {
        const result = await this.db
            .select()
            .from(billingPayments)
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Create a new payment
     */
    async create(input: QZPayBillingPaymentInsert): Promise<QZPayBillingPayment> {
        const result = await this.db.insert(billingPayments).values(input).returning();
        return firstOrThrow(result, 'Payment', 'new');
    }

    /**
     * Update a payment
     */
    async update(id: string, input: Partial<QZPayBillingPaymentInsert>): Promise<QZPayBillingPayment> {
        const result = await this.db
            .update(billingPayments)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Payment', id);
    }

    /**
     * Find payment by provider payment ID
     * Searches within the providerPaymentIds JSONB object for any matching value
     */
    async findByProviderPaymentId(providerPaymentId: string): Promise<QZPayBillingPayment | null> {
        const result = await this.db
            .select()
            .from(billingPayments)
            .where(
                and(
                    // Use JSONB contains operator to check if any value in the object matches
                    sql`EXISTS (
                        SELECT 1 FROM jsonb_each_text(${billingPayments.providerPaymentIds})
                        WHERE value = ${providerPaymentId}
                    )`,
                    isNull(billingPayments.deletedAt)
                )
            )
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find payment by idempotency key
     */
    async findByIdempotencyKey(idempotencyKey: string): Promise<QZPayBillingPayment | null> {
        const result = await this.db
            .select()
            .from(billingPayments)
            .where(and(eq(billingPayments.idempotencyKey, idempotencyKey), isNull(billingPayments.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find payments by customer ID
     */
    async findByCustomerId(
        customerId: string,
        options: QZPayPaymentSearchOptions = {}
    ): Promise<QZPayPaginatedResult<QZPayBillingPayment>> {
        const { status, startDate, endDate, limit = 100, offset = 0 } = options;

        const conditions = [eq(billingPayments.customerId, customerId), isNull(billingPayments.deletedAt)];

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingPayments.status, status));
            } else {
                conditions.push(eq(billingPayments.status, status));
            }
        }

        if (startDate) {
            conditions.push(gte(billingPayments.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingPayments.createdAt, endDate));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingPayments)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingPayments)
            .where(and(...conditions))
            .orderBy(sql`${billingPayments.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Find payments by subscription ID
     */
    async findBySubscriptionId(subscriptionId: string): Promise<QZPayBillingPayment[]> {
        return this.db
            .select()
            .from(billingPayments)
            .where(and(eq(billingPayments.subscriptionId, subscriptionId), isNull(billingPayments.deletedAt)))
            .orderBy(sql`${billingPayments.createdAt} DESC`);
    }

    /**
     * Find payments by invoice ID
     */
    async findByInvoiceId(invoiceId: string): Promise<QZPayBillingPayment[]> {
        return this.db
            .select()
            .from(billingPayments)
            .where(and(eq(billingPayments.invoiceId, invoiceId), isNull(billingPayments.deletedAt)))
            .orderBy(sql`${billingPayments.createdAt} DESC`);
    }

    /**
     * Update payment status
     */
    async updateStatus(
        id: string,
        status: QZPayPaymentStatusValue,
        additionalData?: Partial<QZPayBillingPaymentInsert>
    ): Promise<QZPayBillingPayment> {
        const updateData: Partial<QZPayBillingPaymentInsert> = {
            status,
            updatedAt: new Date(),
            ...additionalData
        };

        const result = await this.db
            .update(billingPayments)
            .set(updateData)
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Payment', id);
    }

    /**
     * Mark payment as failed
     */
    async markFailed(id: string, failureCode: string, failureMessage: string): Promise<QZPayBillingPayment> {
        const result = await this.db
            .update(billingPayments)
            .set({
                status: 'failed',
                failureCode,
                failureMessage,
                updatedAt: new Date()
            })
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Payment', id);
    }

    /**
     * Update refunded amount
     */
    async updateRefundedAmount(id: string, refundedAmount: number): Promise<QZPayBillingPayment> {
        const result = await this.db
            .update(billingPayments)
            .set({
                refundedAmount,
                updatedAt: new Date()
            })
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Payment', id);
    }

    /**
     * Search payments
     */
    async search(options: QZPayPaymentSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingPayment>> {
        const { customerId, subscriptionId, status, provider, startDate, endDate, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingPayments.deletedAt)];

        if (customerId) {
            conditions.push(eq(billingPayments.customerId, customerId));
        }

        if (subscriptionId) {
            conditions.push(eq(billingPayments.subscriptionId, subscriptionId));
        }

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(inArray(billingPayments.status, status));
            } else {
                conditions.push(eq(billingPayments.status, status));
            }
        }

        if (provider) {
            conditions.push(eq(billingPayments.provider, provider));
        }

        if (startDate) {
            conditions.push(gte(billingPayments.createdAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(billingPayments.createdAt, endDate));
        }

        if (livemode !== undefined) {
            conditions.push(eq(billingPayments.livemode, livemode));
        }

        const countResult = await this.db
            .select({ count: count() })
            .from(billingPayments)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        const data = await this.db
            .select()
            .from(billingPayments)
            .where(and(...conditions))
            .orderBy(sql`${billingPayments.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Get payment statistics
     */
    async getStatistics(
        startDate: Date,
        endDate: Date,
        livemode = true
    ): Promise<{
        total: number;
        succeeded: number;
        failed: number;
        totalAmount: number;
        refundedAmount: number;
    }> {
        const conditions = [
            gte(billingPayments.createdAt, startDate),
            lte(billingPayments.createdAt, endDate),
            eq(billingPayments.livemode, livemode),
            isNull(billingPayments.deletedAt)
        ];

        const statusResult = await this.db
            .select({
                status: billingPayments.status,
                count: count(),
                totalAmount: sql<number>`COALESCE(SUM(amount), 0)::int`,
                totalRefunded: sql<number>`COALESCE(SUM(refunded_amount), 0)::int`
            })
            .from(billingPayments)
            .where(and(...conditions))
            .groupBy(billingPayments.status);

        const stats = {
            total: 0,
            succeeded: 0,
            failed: 0,
            totalAmount: 0,
            refundedAmount: 0
        };

        for (const row of statusResult) {
            stats.total += row.count;
            if (row.status === 'succeeded' || row.status === 'refunded' || row.status === 'partially_refunded') {
                stats.succeeded += row.count;
                stats.totalAmount += row.totalAmount;
                stats.refundedAmount += row.totalRefunded;
            } else if (row.status === 'failed') {
                stats.failed = row.count;
            }
        }

        return stats;
    }

    /**
     * Soft delete a payment
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingPayments)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingPayments.id, id), isNull(billingPayments.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Payment with id ${id} not found`);
        }
    }

    // ==================== Refunds ====================

    /**
     * Create a refund
     */
    async createRefund(input: QZPayBillingRefundInsert): Promise<QZPayBillingRefund> {
        const result = await this.db.insert(billingRefunds).values(input).returning();
        return firstOrThrow(result, 'Refund', 'new');
    }

    /**
     * Find refund by ID
     */
    async findRefundById(id: string): Promise<QZPayBillingRefund | null> {
        const result = await this.db.select().from(billingRefunds).where(eq(billingRefunds.id, id)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find refund by provider refund ID
     */
    async findRefundByProviderRefundId(providerRefundId: string): Promise<QZPayBillingRefund | null> {
        const result = await this.db.select().from(billingRefunds).where(eq(billingRefunds.providerRefundId, providerRefundId)).limit(1);

        return firstOrNull(result);
    }

    /**
     * Find refunds for payment
     */
    async findRefundsByPaymentId(paymentId: string): Promise<QZPayBillingRefund[]> {
        return this.db
            .select()
            .from(billingRefunds)
            .where(eq(billingRefunds.paymentId, paymentId))
            .orderBy(sql`${billingRefunds.createdAt} DESC`);
    }

    /**
     * Get total refunded amount for payment
     */
    async getTotalRefundedAmount(paymentId: string): Promise<number> {
        const result = await this.db
            .select({ total: sql<number>`COALESCE(SUM(amount), 0)::int` })
            .from(billingRefunds)
            .where(eq(billingRefunds.paymentId, paymentId));

        return result[0]?.total ?? 0;
    }

    /**
     * Get payment with refunds
     */
    async findWithRefunds(id: string): Promise<{ payment: QZPayBillingPayment; refunds: QZPayBillingRefund[] } | null> {
        const payment = await this.findById(id);
        if (!payment) return null;

        const refunds = await this.findRefundsByPaymentId(id);

        return { payment, refunds };
    }
}
