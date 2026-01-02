import type {
    QZPayCreateCustomerInput,
    QZPayCreateInvoiceInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayCreateSubscriptionInput,
    QZPayCreateVendorInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayCustomerStorage,
    QZPayEntitlement,
    QZPayEntitlementStorage,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayInvoiceStorage,
    QZPayLimit,
    QZPayLimitStorage,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentStorage,
    QZPayPlan,
    QZPayPlanStorage,
    QZPayPrice,
    QZPayPriceStorage,
    QZPayPromoCode,
    QZPayPromoCodeStorage,
    QZPaySetLimitInput,
    QZPayStorageAdapter,
    QZPaySubscription,
    QZPaySubscriptionStorage,
    QZPayUpdateCustomerInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorPayout,
    QZPayVendorStorage
} from '@qazuor/qzpay-core';
/**
 * Drizzle Storage Adapter for QZPay
 *
 * Implements QZPayStorageAdapter interface using Drizzle ORM.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    mapCoreCustomerCreateToDrizzle,
    mapCoreCustomerUpdateToDrizzle,
    mapCoreEntitlementToDrizzle,
    mapCoreGrantEntitlementToDrizzle,
    mapCoreInvoiceCreateToDrizzle,
    mapCoreInvoiceUpdateToDrizzle,
    mapCoreLimitToDrizzle,
    mapCorePlanCreateToDrizzle,
    mapCorePlanUpdateToDrizzle,
    mapCorePriceCreateToDrizzle,
    mapCorePriceUpdateToDrizzle,
    mapCorePromoCodeCreateToDrizzle,
    mapCorePromoCodeUpdateToDrizzle,
    mapCoreSetLimitToDrizzle,
    mapCoreSubscriptionCreateToDrizzle,
    mapCoreSubscriptionUpdateToDrizzle,
    mapCoreUsageRecordToDrizzle,
    mapCoreVendorCreateToDrizzle,
    mapCoreVendorPayoutToDrizzle,
    mapCoreVendorUpdateToDrizzle,
    mapDrizzleCustomerEntitlementToCore,
    mapDrizzleCustomerLimitToCore,
    mapDrizzleCustomerToCore,
    mapDrizzleEntitlementToCore,
    mapDrizzleInvoiceToCore,
    mapDrizzleLimitToCore,
    mapDrizzlePaymentToCore,
    mapDrizzlePlanToCore,
    mapDrizzlePriceToCore,
    mapDrizzlePromoCodeToCore,
    mapDrizzleSubscriptionToCore,
    mapDrizzleUsageRecordToCore,
    mapDrizzleVendorPayoutToCore,
    mapDrizzleVendorToCore
} from '../mappers/index.js';
import {
    type QZPayPaginatedResult as DrizzlePaginatedResult,
    QZPayCustomersRepository,
    QZPayEntitlementsRepository,
    QZPayInvoicesRepository,
    QZPayLimitsRepository,
    QZPayPaymentsRepository,
    QZPayPlansRepository,
    QZPayPricesRepository,
    QZPayPromoCodesRepository,
    QZPaySubscriptionsRepository,
    QZPayUsageRecordsRepository,
    QZPayVendorsRepository
} from '../repositories/index.js';

/**
 * Drizzle storage adapter configuration
 */
export interface QZPayDrizzleStorageConfig {
    /** Database connection */
    db: PostgresJsDatabase;
    /** Whether to use livemode (production) or test mode */
    livemode?: boolean;
}

/**
 * Convert Drizzle paginated result to Core paginated result
 */
function toPaginatedResult<TDrizzle, TCore>(
    result: DrizzlePaginatedResult<TDrizzle>,
    mapper: (item: TDrizzle) => TCore,
    limit: number,
    offset: number
): QZPayPaginatedResult<TCore> {
    return {
        data: result.data.map(mapper),
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.data.length < result.total
    };
}

/**
 * Drizzle implementation of QZPayStorageAdapter
 */
export class QZPayDrizzleStorageAdapter implements QZPayStorageAdapter {
    private readonly db: PostgresJsDatabase;
    private readonly livemode: boolean;

    // Repositories
    private readonly customersRepo: QZPayCustomersRepository;
    private readonly subscriptionsRepo: QZPaySubscriptionsRepository;
    private readonly paymentsRepo: QZPayPaymentsRepository;
    private readonly invoicesRepo: QZPayInvoicesRepository;
    private readonly plansRepo: QZPayPlansRepository;
    private readonly pricesRepo: QZPayPricesRepository;
    private readonly promoCodesRepo: QZPayPromoCodesRepository;
    private readonly vendorsRepo: QZPayVendorsRepository;
    private readonly entitlementsRepo: QZPayEntitlementsRepository;
    private readonly limitsRepo: QZPayLimitsRepository;
    private readonly usageRecordsRepo: QZPayUsageRecordsRepository;

    // Storage implementations
    public readonly customers: QZPayCustomerStorage;
    public readonly subscriptions: QZPaySubscriptionStorage;
    public readonly payments: QZPayPaymentStorage;
    public readonly invoices: QZPayInvoiceStorage;
    public readonly plans: QZPayPlanStorage;
    public readonly prices: QZPayPriceStorage;
    public readonly promoCodes: QZPayPromoCodeStorage;
    public readonly vendors: QZPayVendorStorage;
    public readonly entitlements: QZPayEntitlementStorage;
    public readonly limits: QZPayLimitStorage;

    constructor(config: QZPayDrizzleStorageConfig) {
        this.db = config.db;
        this.livemode = config.livemode ?? true;

        // Initialize repositories
        this.customersRepo = new QZPayCustomersRepository(this.db);
        this.subscriptionsRepo = new QZPaySubscriptionsRepository(this.db);
        this.paymentsRepo = new QZPayPaymentsRepository(this.db);
        this.invoicesRepo = new QZPayInvoicesRepository(this.db);
        this.plansRepo = new QZPayPlansRepository(this.db);
        this.pricesRepo = new QZPayPricesRepository(this.db);
        this.promoCodesRepo = new QZPayPromoCodesRepository(this.db);
        this.vendorsRepo = new QZPayVendorsRepository(this.db);
        this.entitlementsRepo = new QZPayEntitlementsRepository(this.db);
        this.limitsRepo = new QZPayLimitsRepository(this.db);
        this.usageRecordsRepo = new QZPayUsageRecordsRepository(this.db);

        // Initialize storage implementations
        this.customers = this.createCustomerStorage();
        this.subscriptions = this.createSubscriptionStorage();
        this.payments = this.createPaymentStorage();
        this.invoices = this.createInvoiceStorage();
        this.plans = this.createPlanStorage();
        this.prices = this.createPriceStorage();
        this.promoCodes = this.createPromoCodeStorage();
        this.vendors = this.createVendorStorage();
        this.entitlements = this.createEntitlementStorage();
        this.limits = this.createLimitStorage();
    }

    /**
     * Execute operations within a database transaction
     */
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        return this.db.transaction(async () => {
            return fn();
        });
    }

    // ==================== Customer Storage ====================

    private createCustomerStorage(): QZPayCustomerStorage {
        const repo = this.customersRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreateCustomerInput): Promise<QZPayCustomer> {
                const id = crypto.randomUUID();
                const inputWithId = { ...input, id } as QZPayCreateCustomerInput & { id: string };
                const drizzleInput = mapCoreCustomerCreateToDrizzle(inputWithId, livemode);
                const result = await repo.create(drizzleInput);
                return mapDrizzleCustomerToCore(result);
            },

            async update(id: string, input: QZPayUpdateCustomerInput): Promise<QZPayCustomer> {
                const drizzleInput = mapCoreCustomerUpdateToDrizzle(input);
                const result = await repo.update(id, drizzleInput);
                return mapDrizzleCustomerToCore(result);
            },

            async delete(id: string): Promise<void> {
                await repo.softDelete(id);
            },

            async findById(id: string): Promise<QZPayCustomer | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzleCustomerToCore(result) : null;
            },

            async findByExternalId(externalId: string): Promise<QZPayCustomer | null> {
                const result = await repo.findByExternalId(externalId, livemode);
                return result ? mapDrizzleCustomerToCore(result) : null;
            },

            async findByEmail(email: string): Promise<QZPayCustomer | null> {
                const results = await repo.findByEmail(email, livemode);
                return results[0] ? mapDrizzleCustomerToCore(results[0]) : null;
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayCustomer>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzleCustomerToCore, limit, offset);
            }
        };
    }

    // ==================== Subscription Storage ====================

    private createSubscriptionStorage(): QZPaySubscriptionStorage {
        const repo = this.subscriptionsRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreateSubscriptionInput & { id: string }): Promise<QZPaySubscription> {
                const now = new Date();
                const drizzleInput = mapCoreSubscriptionCreateToDrizzle(input, {
                    livemode,
                    billingInterval: 'month',
                    intervalCount: 1,
                    currentPeriodStart: now,
                    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                });
                const result = await repo.create(drizzleInput);
                return mapDrizzleSubscriptionToCore(result);
            },

            async update(id: string, input: QZPayUpdateSubscriptionInput): Promise<QZPaySubscription> {
                const drizzleInput = mapCoreSubscriptionUpdateToDrizzle(input);
                const result = await repo.update(id, drizzleInput);
                return mapDrizzleSubscriptionToCore(result);
            },

            async delete(id: string): Promise<void> {
                await repo.softDelete(id);
            },

            async findById(id: string): Promise<QZPaySubscription | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzleSubscriptionToCore(result) : null;
            },

            async findByCustomerId(customerId: string): Promise<QZPaySubscription[]> {
                const result = await repo.findByCustomerId(customerId);
                return result.data.map(mapDrizzleSubscriptionToCore);
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPaySubscription>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzleSubscriptionToCore, limit, offset);
            }
        };
    }

    // ==================== Payment Storage ====================

    private createPaymentStorage(): QZPayPaymentStorage {
        const repo = this.paymentsRepo;
        const livemode = this.livemode;

        return {
            async create(payment: QZPayPayment): Promise<QZPayPayment> {
                const result = await repo.create({
                    id: payment.id,
                    customerId: payment.customerId,
                    subscriptionId: payment.subscriptionId ?? null,
                    invoiceId: payment.invoiceId ?? null,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: payment.status,
                    provider: 'stripe',
                    metadata: payment.metadata ?? {},
                    livemode
                });
                return mapDrizzlePaymentToCore(result);
            },

            async update(id: string, payment: Partial<QZPayPayment>): Promise<QZPayPayment> {
                const updateData: Record<string, unknown> = {};
                // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
                if (payment.status !== undefined) updateData['status'] = payment.status;
                // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
                if (payment.metadata !== undefined) updateData['metadata'] = payment.metadata;

                const result = await repo.update(id, updateData);
                return mapDrizzlePaymentToCore(result);
            },

            async findById(id: string): Promise<QZPayPayment | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzlePaymentToCore(result) : null;
            },

            async findByCustomerId(customerId: string): Promise<QZPayPayment[]> {
                const result = await repo.findByCustomerId(customerId);
                return result.data.map(mapDrizzlePaymentToCore);
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPayment>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzlePaymentToCore, limit, offset);
            }
        };
    }

    // ==================== Invoice Storage ====================

    private createInvoiceStorage(): QZPayInvoiceStorage {
        const repo = this.invoicesRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreateInvoiceInput & { id: string }): Promise<QZPayInvoice> {
                const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
                const invoiceNumber = `INV-${Date.now()}`;
                const currency = 'usd';

                const drizzleInput = mapCoreInvoiceCreateToDrizzle(input, {
                    livemode,
                    currency,
                    invoiceNumber,
                    subtotal,
                    tax: 0,
                    discount: 0,
                    total: subtotal
                });
                const result = await repo.create(drizzleInput);

                const lines = await Promise.all(
                    input.lines.map(async (line) => {
                        return repo.createLine({
                            invoiceId: result.id,
                            description: line.description,
                            quantity: line.quantity,
                            unitAmount: line.unitAmount,
                            amount: line.quantity * line.unitAmount,
                            currency,
                            priceId: line.priceId ?? null
                        });
                    })
                );

                return mapDrizzleInvoiceToCore(result, lines);
            },

            async update(id: string, invoice: Partial<QZPayInvoice>): Promise<QZPayInvoice> {
                const drizzleInput = mapCoreInvoiceUpdateToDrizzle(invoice);
                const result = await repo.update(id, drizzleInput);
                const lines = await repo.findLinesByInvoiceId(id);
                return mapDrizzleInvoiceToCore(result, lines);
            },

            async findById(id: string): Promise<QZPayInvoice | null> {
                const result = await repo.findById(id);
                if (!result) return null;
                const lines = await repo.findLinesByInvoiceId(id);
                return mapDrizzleInvoiceToCore(result, lines);
            },

            async findByCustomerId(customerId: string): Promise<QZPayInvoice[]> {
                const result = await repo.findByCustomerId(customerId);
                return Promise.all(
                    result.data.map(async (invoice) => {
                        const lines = await repo.findLinesByInvoiceId(invoice.id);
                        return mapDrizzleInvoiceToCore(invoice, lines);
                    })
                );
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayInvoice>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                const invoicesWithLines = await Promise.all(
                    result.data.map(async (invoice) => {
                        const lines = await repo.findLinesByInvoiceId(invoice.id);
                        return mapDrizzleInvoiceToCore(invoice, lines);
                    })
                );
                return {
                    data: invoicesWithLines,
                    total: result.total,
                    limit,
                    offset,
                    hasMore: offset + result.data.length < result.total
                };
            }
        };
    }

    // ==================== Plan Storage ====================

    private createPlanStorage(): QZPayPlanStorage {
        const repo = this.plansRepo;
        const pricesRepo = this.pricesRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreatePlanInput & { id: string }): Promise<QZPayPlan> {
                const drizzleInput = mapCorePlanCreateToDrizzle(input, livemode);
                const result = await repo.create(drizzleInput);
                return mapDrizzlePlanToCore(result, []);
            },

            async update(id: string, plan: Partial<QZPayPlan>): Promise<QZPayPlan> {
                const drizzleInput = mapCorePlanUpdateToDrizzle(plan);
                const result = await repo.update(id, drizzleInput);
                const prices = await pricesRepo.findByPlanId(id);
                return mapDrizzlePlanToCore(result, prices);
            },

            async delete(id: string): Promise<void> {
                await repo.softDelete(id);
            },

            async findById(id: string): Promise<QZPayPlan | null> {
                const result = await repo.findById(id);
                if (!result) return null;
                const prices = await pricesRepo.findByPlanId(id);
                return mapDrizzlePlanToCore(result, prices);
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPlan>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                const plansWithPrices = await Promise.all(
                    result.data.map(async (plan) => {
                        const prices = await pricesRepo.findByPlanId(plan.id);
                        return mapDrizzlePlanToCore(plan, prices);
                    })
                );
                return {
                    data: plansWithPrices,
                    total: result.total,
                    limit,
                    offset,
                    hasMore: offset + result.data.length < result.total
                };
            }
        };
    }

    // ==================== Price Storage ====================

    private createPriceStorage(): QZPayPriceStorage {
        const repo = this.pricesRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreatePriceInput & { id: string }): Promise<QZPayPrice> {
                const drizzleInput = mapCorePriceCreateToDrizzle(input, livemode);
                const result = await repo.create(drizzleInput);
                return mapDrizzlePriceToCore(result);
            },

            async update(id: string, price: Partial<QZPayPrice>): Promise<QZPayPrice> {
                const drizzleInput = mapCorePriceUpdateToDrizzle(price);
                const result = await repo.update(id, drizzleInput);
                return mapDrizzlePriceToCore(result);
            },

            async delete(id: string): Promise<void> {
                await repo.delete(id);
            },

            async findById(id: string): Promise<QZPayPrice | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzlePriceToCore(result) : null;
            },

            async findByPlanId(planId: string): Promise<QZPayPrice[]> {
                const result = await repo.findByPlanId(planId);
                return result.map(mapDrizzlePriceToCore);
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPrice>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzlePriceToCore, limit, offset);
            }
        };
    }

    // ==================== Promo Code Storage ====================

    private createPromoCodeStorage(): QZPayPromoCodeStorage {
        const repo = this.promoCodesRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreatePromoCodeInput & { id: string }): Promise<QZPayPromoCode> {
                const drizzleInput = mapCorePromoCodeCreateToDrizzle(input, livemode);
                const result = await repo.create(drizzleInput);
                return mapDrizzlePromoCodeToCore(result);
            },

            async update(id: string, promoCode: Partial<QZPayPromoCode>): Promise<QZPayPromoCode> {
                const drizzleInput = mapCorePromoCodeUpdateToDrizzle(promoCode);
                const result = await repo.update(id, drizzleInput);
                return mapDrizzlePromoCodeToCore(result);
            },

            async delete(id: string): Promise<void> {
                await repo.update(id, { active: false });
            },

            async findById(id: string): Promise<QZPayPromoCode | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzlePromoCodeToCore(result) : null;
            },

            async findByCode(code: string): Promise<QZPayPromoCode | null> {
                const result = await repo.findByCode(code, livemode);
                return result ? mapDrizzlePromoCodeToCore(result) : null;
            },

            async incrementRedemptions(id: string): Promise<void> {
                await repo.incrementUsage(id);
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPromoCode>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzlePromoCodeToCore, limit, offset);
            }
        };
    }

    // ==================== Vendor Storage ====================

    private createVendorStorage(): QZPayVendorStorage {
        const repo = this.vendorsRepo;
        const livemode = this.livemode;

        return {
            async create(input: QZPayCreateVendorInput & { id: string }): Promise<QZPayVendor> {
                const drizzleInput = mapCoreVendorCreateToDrizzle(input, livemode);
                const result = await repo.create(drizzleInput);
                return mapDrizzleVendorToCore(result);
            },

            async update(id: string, input: QZPayUpdateVendorInput): Promise<QZPayVendor> {
                const drizzleInput = mapCoreVendorUpdateToDrizzle(input);
                const result = await repo.update(id, drizzleInput);
                return mapDrizzleVendorToCore(result);
            },

            async delete(id: string): Promise<void> {
                await repo.softDelete(id);
            },

            async findById(id: string): Promise<QZPayVendor | null> {
                const result = await repo.findById(id);
                return result ? mapDrizzleVendorToCore(result) : null;
            },

            async findByExternalId(externalId: string): Promise<QZPayVendor | null> {
                const result = await repo.findByExternalId(externalId, livemode);
                return result ? mapDrizzleVendorToCore(result) : null;
            },

            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayVendor>> {
                const limit = options?.limit ?? 20;
                const offset = options?.offset ?? 0;
                const result = await repo.search({ livemode, limit, offset });
                return toPaginatedResult(result, mapDrizzleVendorToCore, limit, offset);
            },

            async createPayout(payout: QZPayVendorPayout): Promise<QZPayVendorPayout> {
                const provider = Object.keys(payout.providerPayoutIds)[0] ?? 'stripe';
                const drizzleInput = mapCoreVendorPayoutToDrizzle(payout, provider);
                const result = await repo.createPayout({
                    ...drizzleInput,
                    livemode
                });
                return mapDrizzleVendorPayoutToCore(result);
            },

            async findPayoutsByVendorId(vendorId: string): Promise<QZPayVendorPayout[]> {
                const result = await repo.findPayoutsByVendorId(vendorId);
                return result.data.map(mapDrizzleVendorPayoutToCore);
            }
        };
    }

    // ==================== Entitlement Storage ====================

    private createEntitlementStorage(): QZPayEntitlementStorage {
        const repo = this.entitlementsRepo;
        const livemode = this.livemode;

        return {
            async createDefinition(entitlement: QZPayEntitlement): Promise<QZPayEntitlement> {
                const drizzleInput = mapCoreEntitlementToDrizzle(entitlement);
                const result = await repo.createDefinition(drizzleInput);
                return mapDrizzleEntitlementToCore(result);
            },

            async findDefinitionByKey(key: string): Promise<QZPayEntitlement | null> {
                const result = await repo.findDefinitionByKey(key);
                return result ? mapDrizzleEntitlementToCore(result) : null;
            },

            async listDefinitions(): Promise<QZPayEntitlement[]> {
                const result = await repo.listDefinitions();
                return result.map(mapDrizzleEntitlementToCore);
            },

            async grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement> {
                const drizzleInput = mapCoreGrantEntitlementToDrizzle(input, livemode);
                const result = await repo.grant(drizzleInput);
                return mapDrizzleCustomerEntitlementToCore(result);
            },

            async revoke(customerId: string, entitlementKey: string): Promise<void> {
                await repo.revoke(customerId, entitlementKey);
            },

            async findByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]> {
                const result = await repo.findByCustomerId(customerId);
                return result.map(mapDrizzleCustomerEntitlementToCore);
            },

            async check(customerId: string, entitlementKey: string): Promise<boolean> {
                return repo.check(customerId, entitlementKey);
            }
        };
    }

    // ==================== Limit Storage ====================

    private createLimitStorage(): QZPayLimitStorage {
        const repo = this.limitsRepo;
        const usageRepo = this.usageRecordsRepo;
        const livemode = this.livemode;

        return {
            async createDefinition(limit: QZPayLimit): Promise<QZPayLimit> {
                const drizzleInput = mapCoreLimitToDrizzle(limit);
                const result = await repo.createDefinition(drizzleInput);
                return mapDrizzleLimitToCore(result);
            },

            async findDefinitionByKey(key: string): Promise<QZPayLimit | null> {
                const result = await repo.findDefinitionByKey(key);
                return result ? mapDrizzleLimitToCore(result) : null;
            },

            async listDefinitions(): Promise<QZPayLimit[]> {
                const result = await repo.listDefinitions();
                return result.map(mapDrizzleLimitToCore);
            },

            async set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit> {
                const drizzleInput = mapCoreSetLimitToDrizzle(input, livemode);
                const result = await repo.set(drizzleInput);
                return mapDrizzleCustomerLimitToCore(result);
            },

            async increment(input: QZPayIncrementLimitInput): Promise<QZPayCustomerLimit> {
                const result = await repo.increment(input.customerId, input.limitKey, input.incrementBy);
                return mapDrizzleCustomerLimitToCore(result);
            },

            async findByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]> {
                const result = await repo.findByCustomerId(customerId);
                return result.map(mapDrizzleCustomerLimitToCore);
            },

            async check(customerId: string, limitKey: string): Promise<QZPayCustomerLimit | null> {
                const result = await repo.check(customerId, limitKey);
                if (!result.exists || !result.limit) return null;
                return mapDrizzleCustomerLimitToCore(result.limit);
            },

            async recordUsage(record: QZPayUsageRecord): Promise<QZPayUsageRecord> {
                const drizzleInput = mapCoreUsageRecordToDrizzle(record, record.customerId);
                const result = await usageRepo.create({
                    ...drizzleInput,
                    livemode
                });
                return mapDrizzleUsageRecordToCore(result);
            }
        };
    }
}
