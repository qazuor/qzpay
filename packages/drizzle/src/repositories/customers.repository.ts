/**
 * Customers repository for QZPay Drizzle
 *
 * Provides customer-specific database operations.
 */
import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { billingCustomers, type QZPayBillingCustomer, type QZPayBillingCustomerInsert } from '../schema/index.js';
import { firstOrNull, firstOrThrow, type QZPayPaginatedResult } from './base.repository.js';

/**
 * Customer search options
 */
export interface QZPayCustomerSearchOptions {
    query?: string;
    livemode?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Customers repository
 */
export class QZPayCustomersRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Find customer by ID
     */
    async findById(id: string): Promise<QZPayBillingCustomer | null> {
        const result = await this.db
            .select()
            .from(billingCustomers)
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find customer by external ID
     */
    async findByExternalId(externalId: string, livemode: boolean): Promise<QZPayBillingCustomer | null> {
        const result = await this.db
            .select()
            .from(billingCustomers)
            .where(
                and(
                    eq(billingCustomers.externalId, externalId),
                    eq(billingCustomers.livemode, livemode),
                    isNull(billingCustomers.deletedAt)
                )
            )
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find customer by Stripe customer ID
     */
    async findByStripeCustomerId(stripeCustomerId: string): Promise<QZPayBillingCustomer | null> {
        const result = await this.db
            .select()
            .from(billingCustomers)
            .where(and(eq(billingCustomers.stripeCustomerId, stripeCustomerId), isNull(billingCustomers.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find customer by MercadoPago customer ID
     */
    async findByMpCustomerId(mpCustomerId: string): Promise<QZPayBillingCustomer | null> {
        const result = await this.db
            .select()
            .from(billingCustomers)
            .where(and(eq(billingCustomers.mpCustomerId, mpCustomerId), isNull(billingCustomers.deletedAt)))
            .limit(1);

        return firstOrNull(result);
    }

    /**
     * Find customer by provider customer ID (any provider)
     */
    async findByProviderCustomerId(provider: 'stripe' | 'mercadopago', providerCustomerId: string): Promise<QZPayBillingCustomer | null> {
        if (provider === 'stripe') {
            return this.findByStripeCustomerId(providerCustomerId);
        }
        return this.findByMpCustomerId(providerCustomerId);
    }

    /**
     * Find customers by email
     */
    async findByEmail(email: string, livemode: boolean): Promise<QZPayBillingCustomer[]> {
        return this.db
            .select()
            .from(billingCustomers)
            .where(
                and(
                    eq(billingCustomers.email, email.toLowerCase()),
                    eq(billingCustomers.livemode, livemode),
                    isNull(billingCustomers.deletedAt)
                )
            );
    }

    /**
     * Create a new customer
     */
    async create(input: QZPayBillingCustomerInsert): Promise<QZPayBillingCustomer> {
        const result = await this.db.insert(billingCustomers).values(input).returning();
        return firstOrThrow(result, 'Customer', 'new');
    }

    /**
     * Update a customer
     */
    async update(id: string, input: Partial<QZPayBillingCustomerInsert>): Promise<QZPayBillingCustomer> {
        const result = await this.db
            .update(billingCustomers)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Customer', id);
    }

    /**
     * Update Stripe customer ID
     */
    async updateStripeCustomerId(id: string, stripeCustomerId: string): Promise<QZPayBillingCustomer> {
        const result = await this.db
            .update(billingCustomers)
            .set({ stripeCustomerId, updatedAt: new Date() })
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Customer', id);
    }

    /**
     * Update MercadoPago customer ID
     */
    async updateMpCustomerId(id: string, mpCustomerId: string): Promise<QZPayBillingCustomer> {
        const result = await this.db
            .update(billingCustomers)
            .set({ mpCustomerId, updatedAt: new Date() })
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Customer', id);
    }

    /**
     * Update provider customer ID
     */
    async updateProviderCustomerId(
        id: string,
        provider: 'stripe' | 'mercadopago',
        providerCustomerId: string
    ): Promise<QZPayBillingCustomer> {
        if (provider === 'stripe') {
            return this.updateStripeCustomerId(id, providerCustomerId);
        }
        return this.updateMpCustomerId(id, providerCustomerId);
    }

    /**
     * Soft delete a customer
     */
    async softDelete(id: string): Promise<void> {
        const result = await this.db
            .update(billingCustomers)
            .set({ deletedAt: new Date() })
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .returning();

        if (result.length === 0) {
            throw new Error(`Customer with id ${id} not found`);
        }
    }

    /**
     * Search customers by query (email, name, external ID)
     */
    async search(options: QZPayCustomerSearchOptions): Promise<QZPayPaginatedResult<QZPayBillingCustomer>> {
        const { query, livemode, limit = 100, offset = 0 } = options;

        const conditions = [isNull(billingCustomers.deletedAt)];

        if (livemode !== undefined) {
            conditions.push(eq(billingCustomers.livemode, livemode));
        }

        if (query) {
            const searchPattern = `%${query}%`;
            const searchCondition = or(
                ilike(billingCustomers.email, searchPattern),
                ilike(billingCustomers.name, searchPattern),
                ilike(billingCustomers.externalId, searchPattern)
            );
            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        // Get count
        const countResult = await this.db
            .select({ count: count() })
            .from(billingCustomers)
            .where(and(...conditions));

        const total = countResult[0]?.count ?? 0;

        // Get data
        const data = await this.db
            .select()
            .from(billingCustomers)
            .where(and(...conditions))
            .orderBy(sql`${billingCustomers.createdAt} DESC`)
            .limit(limit)
            .offset(offset);

        return { data, total };
    }

    /**
     * Update customer metadata
     */
    async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<QZPayBillingCustomer> {
        const result = await this.db
            .update(billingCustomers)
            .set({ metadata, updatedAt: new Date() })
            .where(and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)))
            .returning();

        return firstOrThrow(result, 'Customer', id);
    }

    /**
     * Count customers
     */
    async count(livemode?: boolean): Promise<number> {
        const conditions = [isNull(billingCustomers.deletedAt)];
        if (livemode !== undefined) {
            conditions.push(eq(billingCustomers.livemode, livemode));
        }

        const result = await this.db
            .select({ count: count() })
            .from(billingCustomers)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }

    /**
     * Check if external ID exists
     */
    async externalIdExists(externalId: string, livemode: boolean): Promise<boolean> {
        const result = await this.db
            .select({ id: billingCustomers.id })
            .from(billingCustomers)
            .where(
                and(
                    eq(billingCustomers.externalId, externalId),
                    eq(billingCustomers.livemode, livemode),
                    isNull(billingCustomers.deletedAt)
                )
            )
            .limit(1);

        return result.length > 0;
    }
}
