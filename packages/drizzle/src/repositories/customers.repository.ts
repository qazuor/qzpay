/**
 * Customers repository for QZPay Drizzle
 *
 * Provides customer-specific database operations.
 */
import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import {
    type QZPayBillingCustomer,
    type QZPayBillingCustomerEntitlement,
    type QZPayBillingCustomerInsert,
    type QZPayBillingPaymentMethod,
    type QZPayBillingSubscription,
    billingCustomers
} from '../schema/index.js';
import type { QZPayDatabase } from '../utils/connection.js';
import {
    type QZPayPaginatedResult,
    firstOrNull,
    firstOrThrow,
    qzpayValidatePagination,
    updateWithVersionHelper
} from './base.repository.js';

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
 * Options for loading customer relations
 */
export interface QZPayCustomerRelationsOptions {
    subscriptions?: boolean;
    paymentMethods?: boolean;
    entitlements?: boolean;
}

/**
 * Customer with all relations loaded
 */
export interface QZPayCustomerWithRelations extends QZPayBillingCustomer {
    subscriptions?: QZPayBillingSubscription[];
    paymentMethods?: QZPayBillingPaymentMethod[];
    entitlements?: QZPayBillingCustomerEntitlement[];
}

/**
 * Customers repository
 */
export class QZPayCustomersRepository {
    constructor(private readonly db: QZPayDatabase) {}

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
     * Update a customer with optimistic locking
     *
     * Uses version-based optimistic locking to prevent concurrent modifications.
     * The version field is automatically incremented on successful updates.
     *
     * @param id - Customer ID
     * @param expectedVersion - The expected current version UUID
     * @param input - Partial customer data to update
     *
     * @returns The updated customer with new version
     *
     * @throws {QZPayOptimisticLockError} When the version doesn't match (concurrent modification detected)
     * @throws {QZPayEntityNotFoundError} When the customer is not found
     *
     * @example
     * ```typescript
     * // Read customer with current version
     * const customer = await customerRepo.findById('cust-123');
     *
     * // Update with version check
     * const updated = await customerRepo.updateWithVersion(
     *   'cust-123',
     *   customer.version,
     *   { name: 'New Name' }
     * );
     *
     * // If another process updates the customer between read and update,
     * // QZPayOptimisticLockError will be thrown
     * ```
     */
    async updateWithVersion(
        id: string,
        expectedVersion: string,
        input: Partial<QZPayBillingCustomerInsert>
    ): Promise<QZPayBillingCustomer> {
        return updateWithVersionHelper(this.db, billingCustomers, id, expectedVersion, input, {
            entityType: 'Customer',
            entityId: id
        });
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
        const { query, livemode } = options;
        const { limit, offset } = qzpayValidatePagination(options.limit, options.offset);

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

    // ==================== Eager Loading Methods ====================

    /**
     * Find customer by ID with subscriptions preloaded
     *
     * Prevents N+1 queries by eagerly loading subscriptions.
     *
     * @param id - Customer ID
     * @returns Customer with subscriptions or null if not found
     */
    async findByIdWithSubscriptions(id: string): Promise<QZPayCustomerWithRelations | null> {
        const result = await this.db.query?.billingCustomers.findFirst({
            where: and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)),
            with: {
                subscriptions: {
                    where: isNull(billingCustomers.deletedAt)
                }
            }
        });

        return (result ?? null) as QZPayCustomerWithRelations | null;
    }

    /**
     * Find customer by ID with payment methods preloaded
     *
     * Prevents N+1 queries by eagerly loading payment methods.
     *
     * @param id - Customer ID
     * @returns Customer with payment methods or null if not found
     */
    async findByIdWithPaymentMethods(id: string): Promise<QZPayCustomerWithRelations | null> {
        const result = await this.db.query?.billingCustomers.findFirst({
            where: and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)),
            with: {
                paymentMethods: {
                    where: isNull(billingCustomers.deletedAt)
                }
            }
        });

        return (result ?? null) as QZPayCustomerWithRelations | null;
    }

    /**
     * Find customer by ID with flexible relation preloading
     *
     * Prevents N+1 queries by eagerly loading specified relations.
     * Use this method when you need to load multiple relations or customize which relations to load.
     *
     * @param id - Customer ID
     * @param options - Relations to preload (subscriptions, paymentMethods, entitlements)
     * @returns Customer with requested relations or null if not found
     *
     * @example
     * ```typescript
     * // Load customer with subscriptions and payment methods
     * const customer = await repo.findByIdWithRelations('cust_123', {
     *   subscriptions: true,
     *   paymentMethods: true
     * });
     *
     * // Load only entitlements
     * const customer = await repo.findByIdWithRelations('cust_123', {
     *   entitlements: true
     * });
     * ```
     */
    async findByIdWithRelations(id: string, options: QZPayCustomerRelationsOptions = {}): Promise<QZPayCustomerWithRelations | null> {
        const withClause: Record<string, unknown> = {};

        if (options.subscriptions) {
            // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            withClause['subscriptions'] = {
                where: isNull(billingCustomers.deletedAt)
            };
        }

        if (options.paymentMethods) {
            // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            withClause['paymentMethods'] = {
                where: isNull(billingCustomers.deletedAt)
            };
        }

        if (options.entitlements) {
            // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            withClause['entitlements'] = true;
        }

        const result = await this.db.query?.billingCustomers.findFirst({
            where: and(eq(billingCustomers.id, id), isNull(billingCustomers.deletedAt)),
            with: withClause
        });

        return (result ?? null) as QZPayCustomerWithRelations | null;
    }
}
