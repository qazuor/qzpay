/**
 * In-Memory Storage Adapter for QZPay
 *
 * A complete storage adapter implementation that keeps data in memory.
 * Useful for testing, development, and demos without requiring a database.
 *
 * @example
 * ```typescript
 * import { createMemoryStorageAdapter } from '@qazuor/qzpay-dev';
 *
 * const { adapter, reset, seed, getData } = createMemoryStorageAdapter();
 *
 * const billing = new QZPayBilling({
 *   payment: createMockPaymentAdapter().adapter,
 *   storage: adapter,
 * });
 *
 * // Reset all data
 * reset();
 *
 * // Get current data (for debugging)
 * console.log(getData());
 * ```
 */
import type {
    QZPayAddOn,
    QZPayAddOnFilters,
    QZPayAddOnOrderBy,
    QZPayCheckoutFilters,
    QZPayCheckoutOrderBy,
    QZPayCheckoutSession,
    QZPayCreateAddOnInput,
    QZPayCreateCustomerInput,
    QZPayCreateInvoiceInput,
    QZPayCreatePaymentMethodInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayCreateRefundInput,
    QZPayCreateSubscriptionInput,
    QZPayCreateVendorInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerFilters,
    QZPayCustomerLimit,
    QZPayCustomerOrderBy,
    QZPayEntitlement,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayInvoiceFilters,
    QZPayInvoiceOrderBy,
    QZPayLimit,
    QZPayListAllOptions,
    QZPayListOptions,
    QZPayMetadata,
    QZPayOneOrMany,
    QZPayOrderDirection,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentFilters,
    QZPayPaymentMethod,
    QZPayPaymentMethodFilters,
    QZPayPaymentMethodOrderBy,
    QZPayPaymentOrderBy,
    QZPayPlan,
    QZPayPlanFilters,
    QZPayPlanOrderBy,
    QZPayPrice,
    QZPayPriceFilters,
    QZPayPriceOrderBy,
    QZPayPromoCode,
    QZPayPromoCodeFilters,
    QZPayPromoCodeOrderBy,
    QZPayRefund,
    QZPaySetLimitInput,
    QZPaySourceType,
    QZPayStorageAdapter,
    QZPaySubscription,
    QZPaySubscriptionAddOn,
    QZPaySubscriptionFilters,
    QZPaySubscriptionOrderBy,
    QZPayUpdateAddOnInput,
    QZPayUpdateCustomerInput,
    QZPayUpdatePaymentMethodInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorFilters,
    QZPayVendorOrderBy,
    QZPayVendorPayout
} from '@qazuor/qzpay-core';

/**
 * Configuration options for the memory storage adapter
 */
export interface MemoryStorageAdapterConfig {
    /**
     * Function to get the current time. Useful for time simulation in tests.
     * Defaults to () => new Date()
     */
    getCurrentTime?: () => Date;
}

/**
 * Internal data structure for memory storage
 */
export interface MemoryStorageData {
    customers: Map<string, QZPayCustomer>;
    subscriptions: Map<string, QZPaySubscription>;
    payments: Map<string, QZPayPayment>;
    /** Individual refund events, keyed by refund id. Multiple entries can share a `paymentId`. */
    refunds: Map<string, QZPayRefund>;
    paymentMethods: Map<string, QZPayPaymentMethod>;
    invoices: Map<string, QZPayInvoice>;
    plans: Map<string, QZPayPlan>;
    prices: Map<string, QZPayPrice>;
    promoCodes: Map<string, QZPayPromoCode>;
    vendors: Map<string, QZPayVendor>;
    vendorPayouts: Map<string, QZPayVendorPayout>;
    addons: Map<string, QZPayAddOn>;
    subscriptionAddons: Map<string, QZPaySubscriptionAddOn>;
    entitlementDefinitions: Map<string, QZPayEntitlement>;
    customerEntitlements: Map<string, QZPayCustomerEntitlement>;
    limitDefinitions: Map<string, QZPayLimit>;
    customerLimits: Map<string, QZPayCustomerLimit>;
    usageRecords: Map<string, QZPayUsageRecord>;
    checkouts: Map<string, QZPayCheckoutSession>;
}

/**
 * Serializable data format for import/export
 */
export interface MemoryStorageSnapshot {
    customers?: Record<string, QZPayCustomer>;
    subscriptions?: Record<string, QZPaySubscription>;
    payments?: Record<string, QZPayPayment>;
    paymentMethods?: Record<string, QZPayPaymentMethod>;
    invoices?: Record<string, QZPayInvoice>;
    plans?: Record<string, QZPayPlan>;
    prices?: Record<string, QZPayPrice>;
    promoCodes?: Record<string, QZPayPromoCode>;
    vendors?: Record<string, QZPayVendor>;
    vendorPayouts?: Record<string, QZPayVendorPayout>;
    addons?: Record<string, QZPayAddOn>;
    subscriptionAddons?: Record<string, QZPaySubscriptionAddOn>;
    entitlementDefinitions?: Record<string, QZPayEntitlement>;
    customerEntitlements?: Record<string, QZPayCustomerEntitlement>;
    limitDefinitions?: Record<string, QZPayLimit>;
    customerLimits?: Record<string, QZPayCustomerLimit>;
    usageRecords?: Record<string, QZPayUsageRecord>;
    checkouts?: Record<string, QZPayCheckoutSession>;
}

let idCounter = 0;
const generateId = (prefix: string): string => `mock_${prefix}_${++idCounter}`;

/**
 * Rows collected per internal "page" when `listAll` is called without a
 * `batchSize`. The in-memory adapter has no real pagination cost, so this
 * only exists to keep the option meaningful across adapters — it is not
 * read anywhere in this file.
 */
const LIST_ALL_DEFAULT_BATCH_SIZE = 200;

/**
 * Raised when a `listAll` result would exceed the caller's `maxItems` cap.
 *
 * Mirrors `QZPayListAllLimitExceededError` from
 * `packages/drizzle/src/utils/collect-all.ts` (same name, same message
 * shape) so callers that branch on `error.name` behave identically against
 * either storage adapter. Duplicated rather than imported: this package has
 * no dependency on `@qazuor/qzpay-drizzle` and this adapter must not
 * introduce one.
 */
export class QZPayListAllLimitExceededError extends Error {
    /** Entity being listed, e.g. `subscriptions`. */
    readonly entity: string;
    /** The cap that was exceeded. */
    readonly maxItems: number;
    /** Total rows the query matched. */
    readonly total: number;

    constructor(params: { entity: string; maxItems: number; total: number }) {
        super(
            `Listing all ${params.entity} exceeded maxItems=${params.maxItems} (matched ${params.total}). Raise maxItems, or narrow the query with filters.`
        );
        this.name = 'QZPayListAllLimitExceededError';
        this.entity = params.entity;
        this.maxItems = params.maxItems;
        this.total = params.total;
    }
}

/**
 * Case-insensitive partial match across one or more text fields, mirroring
 * the Drizzle adapter's `ilike(column, '%query%')` filter.
 *
 * An absent `query` filter matches everything, exactly like the Drizzle
 * adapter's `if (query) { ... }` guard.
 */
function matchesQuery(query: string | undefined, ...fields: (string | null | undefined)[]): boolean {
    if (!query) return true;
    const needle = query.toLowerCase();
    return fields.some((field) => field?.toLowerCase().includes(needle));
}

/**
 * `QZPayOneOrMany<T>` filter match: a scalar filter is an equality check, an
 * array filter is a membership check (mirrors Drizzle's `eq`/`inArray`
 * branch on `Array.isArray(status)`). An absent filter matches everything.
 */
function matchesOneOrMany<T>(filterValue: QZPayOneOrMany<T> | undefined, actual: T): boolean {
    if (filterValue === undefined) return true;
    if (Array.isArray(filterValue)) return (filterValue as T[]).includes(actual);
    return filterValue === actual;
}

/** Exact-equality filter. An absent filter matches everything. */
function matchesEquality<T>(filterValue: T | undefined, actual: T): boolean {
    return filterValue === undefined || filterValue === actual;
}

/** Inclusive `[startDate, endDate]` range filter over a `Date` field. */
function matchesDateRange(startDate: Date | undefined, endDate: Date | undefined, actual: Date): boolean {
    if (startDate && actual < startDate) return false;
    if (endDate && actual > endDate) return false;
    return true;
}

/** Compares two values of the same orderable field for `sortItems`. */
function compareOrderableValues(a: unknown, b: unknown): number {
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
}

/**
 * Sorts a list by `orderBy`/`orderDirection`, defaulting to `createdAt desc`
 * — the same default the Drizzle adapter's `resolveOrderBy` applies.
 *
 * Returns a new array; the input is never mutated.
 */
function sortItems<T>(items: T[], orderBy: string | undefined, orderDirection: QZPayOrderDirection | undefined): T[] {
    const key = orderBy ?? 'createdAt';
    const direction = orderDirection ?? 'desc';
    // Domain types (`QZPayCustomer`, `QZPaySubscription`, ...) declare no
    // index signature, so a keyed lookup needs this cast — the key always
    // comes from a `TOrderBy` union that is itself a key of the entity, so
    // the lookup is safe despite the generic `T` not proving it statically.
    const sorted = [...items].sort((a, b) =>
        compareOrderableValues((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
    return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Applies pagination to an already filtered + sorted list, for `list()`.
 *
 * `limit` is required by `QZPayListOptions`; `offset` defaults to 0.
 */
function paginateList<T>(items: T[], options: { limit: number; offset?: number }): QZPayPaginatedResult<T> {
    const limit = options.limit;
    const offset = options.offset ?? 0;
    const data = items.slice(offset, offset + limit);
    return {
        data,
        total: items.length,
        limit,
        offset,
        hasMore: offset + data.length < items.length
    };
}

/**
 * Returns every item of an already filtered + sorted list, for `listAll()`.
 *
 * Throws {@link QZPayListAllLimitExceededError} when the result exceeds
 * `maxItems`, instead of silently truncating — see the type's doc comment
 * in `@qazuor/qzpay-core`'s `list-options.ts` for why that matters.
 *
 * `batchSize` has no pagination cost to pay against an in-memory array, but
 * it is still validated the same way the Drizzle adapter's `collectAllPages`
 * validates it, so a caller that passes a nonsensical value fails the same
 * way against either adapter.
 */
function collectAllItems<T>(params: {
    entity: string;
    items: T[];
    batchSize?: number | undefined;
    maxItems?: number | undefined;
}): T[] {
    const { entity, items, maxItems } = params;
    const batchSize = params.batchSize ?? LIST_ALL_DEFAULT_BATCH_SIZE;

    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new RangeError(`batchSize must be a positive integer, received ${batchSize}`);
    }

    if (maxItems !== undefined && items.length > maxItems) {
        throw new QZPayListAllLimitExceededError({ entity, maxItems, total: items.length });
    }
    return items;
}

/* ------------------------------------------------------------------ *
 * Per-entity filter predicates
 *
 * Each mirrors the equivalent `search()` method's `conditions.push(...)`
 * branches in `packages/drizzle/src/repositories/*.repository.ts`, so a
 * filter behaves identically regardless of which storage adapter is under
 * test. An absent filters object (or an absent individual filter) matches
 * everything, same as the Drizzle adapter's `if (filters.x !== undefined)`
 * guards.
 * ------------------------------------------------------------------ */

/**
 * Subscription filter predicate.
 *
 * Extracted so `list` and `listAll` share one definition — they each carried an
 * inline copy, which is how a filter comes to behave differently depending on
 * which of the two you called.
 */
function subscriptionMatchesFilters(subscription: QZPaySubscription, filters?: QZPaySubscriptionFilters): boolean {
    if (!filters) return true;
    return (
        matchesEquality(filters.customerId, subscription.customerId) &&
        matchesEquality(filters.planId, subscription.planId) &&
        matchesOneOrMany(filters.status, subscription.status)
    );
}

function paymentMatchesFilters(payment: QZPayPayment, filters?: QZPayPaymentFilters): boolean {
    if (!filters) return true;
    // `provider` is not a field on the core `QZPayPayment` type — the Drizzle
    // adapter derives it from the first key of `providerPaymentIds`
    // (`mapCorePaymentToDrizzle`, with an 'unknown' fallback), so the same
    // derivation is used here for fidelity with that adapter's filter.
    const provider = Object.keys(payment.providerPaymentIds)[0] ?? 'unknown';
    return (
        matchesEquality(filters.customerId, payment.customerId) &&
        matchesEquality(filters.subscriptionId, payment.subscriptionId ?? undefined) &&
        matchesOneOrMany(filters.status, payment.status) &&
        matchesEquality(filters.provider, provider) &&
        matchesDateRange(filters.startDate, filters.endDate, payment.createdAt) &&
        (filters.minAmount === undefined || payment.amount >= filters.minAmount) &&
        (filters.maxAmount === undefined || payment.amount <= filters.maxAmount)
    );
}

function paymentMethodMatchesFilters(pm: QZPayPaymentMethod, filters?: QZPayPaymentMethodFilters): boolean {
    if (!filters) return true;
    // Same derivation as `paymentMatchesFilters` above, mirroring
    // `mapCorePaymentMethodCreateToDrizzle`'s `providerPaymentMethodIds` map.
    const provider = Object.keys(pm.providerPaymentMethodIds)[0] ?? 'unknown';
    return (
        matchesEquality(filters.customerId, pm.customerId) &&
        matchesEquality(filters.type, pm.type) &&
        matchesEquality(filters.provider, provider)
    );
}

function checkoutMatchesFilters(checkout: QZPayCheckoutSession, filters?: QZPayCheckoutFilters): boolean {
    if (!filters) return true;
    return matchesEquality(filters.customerId, checkout.customerId ?? undefined) && matchesOneOrMany(filters.status, checkout.status);
}

function invoiceMatchesFilters(invoice: QZPayInvoice, filters?: QZPayInvoiceFilters): boolean {
    if (!filters) return true;
    return (
        matchesEquality(filters.customerId, invoice.customerId) &&
        matchesEquality(filters.subscriptionId, invoice.subscriptionId ?? undefined) &&
        matchesOneOrMany(filters.status, invoice.status) &&
        matchesDateRange(filters.startDate, filters.endDate, invoice.createdAt)
    );
}

function planMatchesFilters(plan: QZPayPlan, filters?: QZPayPlanFilters): boolean {
    if (!filters) return true;
    return matchesQuery(filters.query, plan.name, plan.description) && matchesEquality(filters.active, plan.active);
}

function priceMatchesFilters(price: QZPayPrice, filters?: QZPayPriceFilters): boolean {
    if (!filters) return true;
    return (
        matchesEquality(filters.planId, price.planId) &&
        matchesEquality(filters.currency, price.currency) &&
        matchesEquality(filters.billingInterval, price.billingInterval) &&
        matchesEquality(filters.active, price.active)
    );
}

function promoCodeMatchesFilters(promo: QZPayPromoCode, filters?: QZPayPromoCodeFilters): boolean {
    if (!filters) return true;
    // The Drizzle schema's `type` column IS the promo code's discount type
    // (`mapCorePromoCodeCreateToDrizzle` writes `type: input.discountType`,
    // `mapDrizzlePromoCodeToCore` reads `discountType: drizzle.type`), so
    // the `type` filter is matched against `discountType` here.
    return matchesEquality(filters.active, promo.active) && matchesEquality(filters.type, promo.discountType);
}

function vendorMatchesFilters(vendor: QZPayVendor, filters?: QZPayVendorFilters): boolean {
    if (!filters) return true;
    // `onboardingStatus` filters the Drizzle row's `onboarding_status`
    // column, which `mapDrizzleVendorToCore` maps onto the core vendor's
    // `status` field (`status: drizzle.onboardingStatus as QZPayVendorStatus`)
    // — so `status` is what carries that value here too.
    //
    // `canReceivePayments` is now part of `QZPayVendor`, so it is filtered on
    // the vendor's real value. It used to live only on the Drizzle row, which
    // left this adapter unable to honour the filter at all.
    return (
        matchesQuery(filters.query, vendor.name, vendor.externalId) &&
        (filters.onboardingStatus === undefined || filters.onboardingStatus === vendor.status) &&
        matchesEquality(filters.canReceivePayments, vendor.canReceivePayments)
    );
}

function addOnMatchesFilters(addOn: QZPayAddOn, filters?: QZPayAddOnFilters): boolean {
    if (!filters) return true;
    return (
        matchesQuery(filters.query, addOn.name, addOn.description) &&
        matchesEquality(filters.active, addOn.active) &&
        (filters.billingInterval === undefined || filters.billingInterval === addOn.billingInterval)
    );
}

/**
 * Create a memory storage adapter for testing and development
 */
export function createMemoryStorageAdapter(config?: MemoryStorageAdapterConfig): {
    adapter: QZPayStorageAdapter;
    reset: () => void;
    seed: (snapshot: Partial<MemoryStorageSnapshot>) => void;
    getData: () => MemoryStorageData;
    getSnapshot: () => MemoryStorageSnapshot;
} {
    const getCurrentTime = config?.getCurrentTime ?? (() => new Date());

    const data: MemoryStorageData = {
        customers: new Map(),
        subscriptions: new Map(),
        payments: new Map(),
        refunds: new Map(),
        paymentMethods: new Map(),
        invoices: new Map(),
        plans: new Map(),
        prices: new Map(),
        promoCodes: new Map(),
        vendors: new Map(),
        vendorPayouts: new Map(),
        addons: new Map(),
        subscriptionAddons: new Map(),
        entitlementDefinitions: new Map(),
        customerEntitlements: new Map(),
        limitDefinitions: new Map(),
        customerLimits: new Map(),
        usageRecords: new Map(),
        checkouts: new Map()
    };

    const reset = (): void => {
        data.customers.clear();
        data.subscriptions.clear();
        data.payments.clear();
        data.refunds.clear();
        data.paymentMethods.clear();
        data.invoices.clear();
        data.plans.clear();
        data.prices.clear();
        data.promoCodes.clear();
        data.vendors.clear();
        data.vendorPayouts.clear();
        data.addons.clear();
        data.subscriptionAddons.clear();
        data.entitlementDefinitions.clear();
        data.customerEntitlements.clear();
        data.limitDefinitions.clear();
        data.customerLimits.clear();
        data.usageRecords.clear();
        data.checkouts.clear();
        idCounter = 0;
    };

    const seed = (snapshot: Partial<MemoryStorageSnapshot>): void => {
        if (snapshot.customers) {
            for (const [id, customer] of Object.entries(snapshot.customers)) {
                data.customers.set(id, customer);
            }
        }
        if (snapshot.subscriptions) {
            for (const [id, sub] of Object.entries(snapshot.subscriptions)) {
                data.subscriptions.set(id, sub);
            }
        }
        if (snapshot.payments) {
            for (const [id, payment] of Object.entries(snapshot.payments)) {
                data.payments.set(id, payment);
            }
        }
        if (snapshot.paymentMethods) {
            for (const [id, pm] of Object.entries(snapshot.paymentMethods)) {
                data.paymentMethods.set(id, pm);
            }
        }
        if (snapshot.invoices) {
            for (const [id, inv] of Object.entries(snapshot.invoices)) {
                data.invoices.set(id, inv);
            }
        }
        if (snapshot.plans) {
            for (const [id, plan] of Object.entries(snapshot.plans)) {
                data.plans.set(id, plan);
            }
        }
        if (snapshot.prices) {
            for (const [id, price] of Object.entries(snapshot.prices)) {
                data.prices.set(id, price);
            }
        }
        if (snapshot.promoCodes) {
            for (const [id, promo] of Object.entries(snapshot.promoCodes)) {
                data.promoCodes.set(id, promo);
            }
        }
        if (snapshot.vendors) {
            for (const [id, vendor] of Object.entries(snapshot.vendors)) {
                data.vendors.set(id, vendor);
            }
        }
        if (snapshot.vendorPayouts) {
            for (const [id, payout] of Object.entries(snapshot.vendorPayouts)) {
                data.vendorPayouts.set(id, payout);
            }
        }
        if (snapshot.addons) {
            for (const [id, addon] of Object.entries(snapshot.addons)) {
                data.addons.set(id, addon);
            }
        }
        if (snapshot.subscriptionAddons) {
            for (const [id, subAddon] of Object.entries(snapshot.subscriptionAddons)) {
                data.subscriptionAddons.set(id, subAddon);
            }
        }
        if (snapshot.entitlementDefinitions) {
            for (const [id, ent] of Object.entries(snapshot.entitlementDefinitions)) {
                data.entitlementDefinitions.set(id, ent);
            }
        }
        if (snapshot.customerEntitlements) {
            for (const [key, ce] of Object.entries(snapshot.customerEntitlements)) {
                data.customerEntitlements.set(key, ce);
            }
        }
        if (snapshot.limitDefinitions) {
            for (const [id, lim] of Object.entries(snapshot.limitDefinitions)) {
                data.limitDefinitions.set(id, lim);
            }
        }
        if (snapshot.customerLimits) {
            for (const [key, cl] of Object.entries(snapshot.customerLimits)) {
                data.customerLimits.set(key, cl);
            }
        }
        if (snapshot.usageRecords) {
            for (const [id, rec] of Object.entries(snapshot.usageRecords)) {
                data.usageRecords.set(id, rec);
            }
        }
        if (snapshot.checkouts) {
            for (const [id, checkout] of Object.entries(snapshot.checkouts)) {
                data.checkouts.set(id, checkout);
            }
        }
    };

    const getData = (): MemoryStorageData => data;

    const getSnapshot = (): MemoryStorageSnapshot => ({
        customers: Object.fromEntries(data.customers),
        subscriptions: Object.fromEntries(data.subscriptions),
        payments: Object.fromEntries(data.payments),
        paymentMethods: Object.fromEntries(data.paymentMethods),
        invoices: Object.fromEntries(data.invoices),
        plans: Object.fromEntries(data.plans),
        prices: Object.fromEntries(data.prices),
        promoCodes: Object.fromEntries(data.promoCodes),
        vendors: Object.fromEntries(data.vendors),
        vendorPayouts: Object.fromEntries(data.vendorPayouts),
        addons: Object.fromEntries(data.addons),
        subscriptionAddons: Object.fromEntries(data.subscriptionAddons),
        entitlementDefinitions: Object.fromEntries(data.entitlementDefinitions),
        customerEntitlements: Object.fromEntries(data.customerEntitlements),
        limitDefinitions: Object.fromEntries(data.limitDefinitions),
        customerLimits: Object.fromEntries(data.customerLimits),
        usageRecords: Object.fromEntries(data.usageRecords),
        checkouts: Object.fromEntries(data.checkouts)
    });

    const adapter: QZPayStorageAdapter = {
        customers: {
            async create(input: QZPayCreateCustomerInput): Promise<QZPayCustomer> {
                const now = getCurrentTime();
                const customer: QZPayCustomer = {
                    id: generateId('cus'),
                    externalId: input.externalId,
                    email: input.email,
                    name: input.name ?? null,
                    phone: input.phone ?? null,
                    providerCustomerIds: {},
                    metadata: input.metadata ?? {},
                    livemode: false,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                data.customers.set(customer.id, customer);
                return customer;
            },
            async update(id: string, input: QZPayUpdateCustomerInput): Promise<QZPayCustomer> {
                const customer = data.customers.get(id);
                if (!customer) throw new Error(`Customer ${id} not found`);
                const updated: QZPayCustomer = {
                    ...customer,
                    ...input,
                    updatedAt: getCurrentTime()
                };
                data.customers.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.customers.delete(id);
            },
            async findById(id: string): Promise<QZPayCustomer | null> {
                return data.customers.get(id) ?? null;
            },
            async findByExternalId(externalId: string): Promise<QZPayCustomer | null> {
                for (const customer of data.customers.values()) {
                    if (customer.externalId === externalId) return customer;
                }
                return null;
            },
            async findByEmail(email: string): Promise<QZPayCustomer | null> {
                for (const customer of data.customers.values()) {
                    if (customer.email === email) return customer;
                }
                return null;
            },
            async list(
                options: QZPayListOptions<QZPayCustomerFilters, QZPayCustomerOrderBy>
            ): Promise<QZPayPaginatedResult<QZPayCustomer>> {
                const filtered = Array.from(data.customers.values()).filter((customer) =>
                    matchesQuery(options.filters?.query, customer.email, customer.name, customer.externalId)
                );
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayCustomerFilters, QZPayCustomerOrderBy>): Promise<QZPayCustomer[]> {
                const filtered = Array.from(data.customers.values()).filter((customer) =>
                    matchesQuery(options?.filters?.query, customer.email, customer.name, customer.externalId)
                );
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'customers', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        subscriptions: {
            async create(input: QZPayCreateSubscriptionInput & { id: string }): Promise<QZPaySubscription> {
                const now = getCurrentTime();
                const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                const subscription: QZPaySubscription = {
                    id: input.id,
                    customerId: input.customerId,
                    planId: input.planId,
                    status: input.trialDays && input.trialDays > 0 ? 'trialing' : 'active',
                    interval: 'month',
                    intervalCount: 1,
                    quantity: input.quantity ?? 1,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    trialStart: input.trialDays ? now : null,
                    trialEnd: input.trialDays ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : null,
                    cancelAt: null,
                    canceledAt: null,
                    cancelAtPeriodEnd: false,
                    providerSubscriptionIds: {},
                    metadata: input.metadata ?? {},
                    scheduledPlanChange: null,
                    livemode: false,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                data.subscriptions.set(subscription.id, subscription);
                return subscription;
            },
            async update(id: string, input: QZPayUpdateSubscriptionInput): Promise<QZPaySubscription> {
                const sub = data.subscriptions.get(id);
                if (!sub) throw new Error(`Subscription ${id} not found`);
                const updated: QZPaySubscription = {
                    ...sub,
                    ...input,
                    updatedAt: getCurrentTime()
                };
                data.subscriptions.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.subscriptions.delete(id);
            },
            async findById(id: string): Promise<QZPaySubscription | null> {
                return data.subscriptions.get(id) ?? null;
            },
            async findByCustomerId(customerId: string): Promise<QZPaySubscription[]> {
                return Array.from(data.subscriptions.values()).filter((s) => s.customerId === customerId);
            },
            async list(
                options: QZPayListOptions<QZPaySubscriptionFilters, QZPaySubscriptionOrderBy>
            ): Promise<QZPayPaginatedResult<QZPaySubscription>> {
                const filtered = Array.from(data.subscriptions.values()).filter((sub) => subscriptionMatchesFilters(sub, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPaySubscriptionFilters, QZPaySubscriptionOrderBy>): Promise<QZPaySubscription[]> {
                const filtered = Array.from(data.subscriptions.values()).filter((sub) => subscriptionMatchesFilters(sub, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({
                    entity: 'subscriptions',
                    items: sorted,
                    batchSize: options?.batchSize,
                    maxItems: options?.maxItems
                });
            }
        },

        payments: {
            async create(payment: QZPayPayment): Promise<QZPayPayment> {
                data.payments.set(payment.id, payment);
                return payment;
            },
            async update(id: string, updates: Partial<QZPayPayment>): Promise<QZPayPayment> {
                const payment = data.payments.get(id);
                if (!payment) throw new Error(`Payment ${id} not found`);
                const updated: QZPayPayment = {
                    ...payment,
                    ...updates,
                    updatedAt: getCurrentTime()
                };
                data.payments.set(id, updated);
                return updated;
            },
            async findById(id: string): Promise<QZPayPayment | null> {
                return data.payments.get(id) ?? null;
            },
            async findByCustomerId(customerId: string): Promise<QZPayPayment[]> {
                return Array.from(data.payments.values()).filter((p) => p.customerId === customerId);
            },
            async list(options: QZPayListOptions<QZPayPaymentFilters, QZPayPaymentOrderBy>): Promise<QZPayPaginatedResult<QZPayPayment>> {
                const filtered = Array.from(data.payments.values()).filter((payment) => paymentMatchesFilters(payment, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayPaymentFilters, QZPayPaymentOrderBy>): Promise<QZPayPayment[]> {
                const filtered = Array.from(data.payments.values()).filter((payment) => paymentMatchesFilters(payment, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'payments', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            },
            async createRefund(input: QZPayCreateRefundInput): Promise<void> {
                // Idempotent by providerRefundId (HOS-669): mirrors the
                // partial UNIQUE constraint the Drizzle adapter enforces at
                // the DB layer (idx_refunds_provider_refund_id_unique). A
                // second settled event for the SAME provider refund id —
                // e.g. a retried `payments.refund()` call after a network
                // blip hid a successful provider response — is silently
                // ignored instead of inserted, so it cannot inflate
                // `getTotalRefundedAmount()`'s total. A refund with no
                // `providerRefundId` (local-only, no payment adapter
                // configured) has nothing to deduplicate against and
                // always inserts.
                if (input.providerRefundId) {
                    for (const existing of data.refunds.values()) {
                        if (Object.values(existing.providerRefundIds).includes(input.providerRefundId)) {
                            return;
                        }
                    }
                }

                const refund: QZPayRefund = {
                    id: generateId('refund'),
                    paymentId: input.paymentId,
                    amount: input.amount,
                    currency: input.currency,
                    reason: input.reason ?? null,
                    status: input.status,
                    // `QZPayCreateRefundInput` carries a single provider-side id without
                    // the provider name that keys `providerRefundIds` elsewhere (e.g.
                    // `payment.providerPaymentIds`); 'unknown' mirrors the same fallback
                    // `mapCorePaymentToDrizzle` uses when a provider name isn't resolvable.
                    providerRefundIds: input.providerRefundId ? { unknown: input.providerRefundId } : {},
                    createdAt: getCurrentTime()
                };
                data.refunds.set(refund.id, refund);
            },
            async getTotalRefundedAmount(paymentId: string): Promise<number> {
                let total = 0;
                for (const refund of data.refunds.values()) {
                    if (refund.paymentId === paymentId && refund.status === 'succeeded') {
                        total += refund.amount;
                    }
                }
                return total;
            },
            async hasRefundForProviderRefundId(providerRefundId: string): Promise<boolean> {
                for (const refund of data.refunds.values()) {
                    if (Object.values(refund.providerRefundIds).includes(providerRefundId)) {
                        return true;
                    }
                }
                return false;
            }
        },

        paymentMethods: {
            async create(input: QZPayCreatePaymentMethodInput & { id: string }): Promise<QZPayPaymentMethod> {
                const now = getCurrentTime();
                const pm: QZPayPaymentMethod = {
                    id: input.id,
                    customerId: input.customerId,
                    type: input.type,
                    status: 'active',
                    isDefault: input.setAsDefault ?? false,
                    card: null,
                    bankAccount: null,
                    billingDetails: input.billingDetails
                        ? {
                              name: input.billingDetails.name ?? null,
                              email: input.billingDetails.email ?? null,
                              phone: input.billingDetails.phone ?? null,
                              address: input.billingDetails.address ?? null
                          }
                        : null,
                    providerPaymentMethodIds: {
                        [input.provider]: input.providerPaymentMethodId
                    },
                    metadata: input.metadata ?? {},
                    livemode: false,
                    createdAt: now,
                    updatedAt: now
                };
                data.paymentMethods.set(pm.id, pm);
                return pm;
            },
            async update(id: string, input: QZPayUpdatePaymentMethodInput): Promise<QZPayPaymentMethod> {
                const pm = data.paymentMethods.get(id);
                if (!pm) throw new Error(`Payment method ${id} not found`);
                const updated: QZPayPaymentMethod = {
                    ...pm,
                    metadata: input.metadata ?? pm.metadata,
                    billingDetails: input.billingDetails
                        ? {
                              name: input.billingDetails.name ?? pm.billingDetails?.name ?? null,
                              email: input.billingDetails.email ?? pm.billingDetails?.email ?? null,
                              phone: input.billingDetails.phone ?? pm.billingDetails?.phone ?? null,
                              address: input.billingDetails.address ?? pm.billingDetails?.address ?? null
                          }
                        : pm.billingDetails,
                    updatedAt: getCurrentTime()
                };
                data.paymentMethods.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.paymentMethods.delete(id);
            },
            async findById(id: string): Promise<QZPayPaymentMethod | null> {
                return data.paymentMethods.get(id) ?? null;
            },
            async findByCustomerId(customerId: string): Promise<QZPayPaymentMethod[]> {
                return Array.from(data.paymentMethods.values()).filter((pm) => pm.customerId === customerId);
            },
            async findDefaultByCustomerId(customerId: string): Promise<QZPayPaymentMethod | null> {
                for (const pm of data.paymentMethods.values()) {
                    if (pm.customerId === customerId && pm.isDefault) return pm;
                }
                return null;
            },
            async setDefault(customerId: string, paymentMethodId: string): Promise<void> {
                for (const pm of data.paymentMethods.values()) {
                    if (pm.customerId === customerId) {
                        pm.isDefault = pm.id === paymentMethodId;
                    }
                }
            },
            async list(
                options: QZPayListOptions<QZPayPaymentMethodFilters, QZPayPaymentMethodOrderBy>
            ): Promise<QZPayPaginatedResult<QZPayPaymentMethod>> {
                const filtered = Array.from(data.paymentMethods.values()).filter((pm) => paymentMethodMatchesFilters(pm, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(
                options?: QZPayListAllOptions<QZPayPaymentMethodFilters, QZPayPaymentMethodOrderBy>
            ): Promise<QZPayPaymentMethod[]> {
                const filtered = Array.from(data.paymentMethods.values()).filter((pm) => paymentMethodMatchesFilters(pm, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({
                    entity: 'paymentMethods',
                    items: sorted,
                    batchSize: options?.batchSize,
                    maxItems: options?.maxItems
                });
            }
        },

        invoices: {
            async create(input: QZPayCreateInvoiceInput & { id: string }): Promise<QZPayInvoice> {
                const now = getCurrentTime();
                const lines = input.lines.map((line) => ({
                    id: generateId('invl'),
                    invoiceId: input.id,
                    description: line.description,
                    quantity: line.quantity,
                    unitAmount: line.unitAmount,
                    amount: line.quantity * line.unitAmount,
                    priceId: line.priceId ?? null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                }));
                const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
                const invoice: QZPayInvoice = {
                    id: input.id,
                    customerId: input.customerId,
                    subscriptionId: input.subscriptionId ?? null,
                    status: 'draft',
                    currency: 'USD',
                    subtotal,
                    tax: 0,
                    discount: 0,
                    total: subtotal,
                    amountPaid: 0,
                    amountDue: subtotal,
                    dueDate: input.dueDate ?? null,
                    paidAt: null,
                    voidedAt: null,
                    periodStart: null,
                    periodEnd: null,
                    lines,
                    providerInvoiceIds: {},
                    metadata: input.metadata ?? {},
                    livemode: false,
                    createdAt: now,
                    updatedAt: now
                };
                data.invoices.set(invoice.id, invoice);
                return invoice;
            },
            async update(id: string, updates: Partial<QZPayInvoice>): Promise<QZPayInvoice> {
                const inv = data.invoices.get(id);
                if (!inv) throw new Error(`Invoice ${id} not found`);
                const updated: QZPayInvoice = {
                    ...inv,
                    ...updates,
                    updatedAt: getCurrentTime()
                };
                data.invoices.set(id, updated);
                return updated;
            },
            async findById(id: string): Promise<QZPayInvoice | null> {
                return data.invoices.get(id) ?? null;
            },
            async findByCustomerId(customerId: string): Promise<QZPayInvoice[]> {
                return Array.from(data.invoices.values()).filter((i) => i.customerId === customerId);
            },
            async list(options: QZPayListOptions<QZPayInvoiceFilters, QZPayInvoiceOrderBy>): Promise<QZPayPaginatedResult<QZPayInvoice>> {
                const filtered = Array.from(data.invoices.values()).filter((invoice) => invoiceMatchesFilters(invoice, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayInvoiceFilters, QZPayInvoiceOrderBy>): Promise<QZPayInvoice[]> {
                const filtered = Array.from(data.invoices.values()).filter((invoice) => invoiceMatchesFilters(invoice, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'invoices', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        plans: {
            async create(input: QZPayCreatePlanInput & { id: string }): Promise<QZPayPlan> {
                const now = getCurrentTime();
                const plan: QZPayPlan = {
                    id: input.id,
                    name: input.name,
                    description: input.description ?? null,
                    active: true,
                    prices: [],
                    features: input.features ?? [],
                    entitlements: input.entitlements ?? [],
                    limits: input.limits ?? {},
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                data.plans.set(plan.id, plan);
                return plan;
            },
            async update(id: string, updates: Partial<QZPayPlan>): Promise<QZPayPlan> {
                const plan = data.plans.get(id);
                if (!plan) throw new Error(`Plan ${id} not found`);
                const updated: QZPayPlan = {
                    ...plan,
                    ...updates,
                    updatedAt: getCurrentTime()
                };
                data.plans.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.plans.delete(id);
            },
            async findById(id: string): Promise<QZPayPlan | null> {
                return data.plans.get(id) ?? null;
            },
            async list(options: QZPayListOptions<QZPayPlanFilters, QZPayPlanOrderBy>): Promise<QZPayPaginatedResult<QZPayPlan>> {
                const filtered = Array.from(data.plans.values()).filter((plan) => planMatchesFilters(plan, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayPlanFilters, QZPayPlanOrderBy>): Promise<QZPayPlan[]> {
                const filtered = Array.from(data.plans.values()).filter((plan) => planMatchesFilters(plan, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'plans', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        prices: {
            async create(input: QZPayCreatePriceInput & { id: string }): Promise<QZPayPrice> {
                const now = getCurrentTime();
                const price: QZPayPrice = {
                    id: input.id,
                    planId: input.planId,
                    nickname: input.nickname ?? null,
                    currency: input.currency,
                    unitAmount: input.unitAmount,
                    billingInterval: input.billingInterval,
                    intervalCount: input.intervalCount ?? 1,
                    trialDays: input.trialDays ?? null,
                    active: true,
                    providerPriceIds: {},
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now
                };
                data.prices.set(price.id, price);
                return price;
            },
            async update(id: string, updates: Partial<QZPayPrice>): Promise<QZPayPrice> {
                const price = data.prices.get(id);
                if (!price) throw new Error(`Price ${id} not found`);
                const updated: QZPayPrice = {
                    ...price,
                    ...updates,
                    updatedAt: getCurrentTime()
                };
                data.prices.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.prices.delete(id);
            },
            async findById(id: string): Promise<QZPayPrice | null> {
                return data.prices.get(id) ?? null;
            },
            async findByPlanId(planId: string): Promise<QZPayPrice[]> {
                return Array.from(data.prices.values()).filter((p) => p.planId === planId);
            },
            async list(options: QZPayListOptions<QZPayPriceFilters, QZPayPriceOrderBy>): Promise<QZPayPaginatedResult<QZPayPrice>> {
                const filtered = Array.from(data.prices.values()).filter((price) => priceMatchesFilters(price, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayPriceFilters, QZPayPriceOrderBy>): Promise<QZPayPrice[]> {
                const filtered = Array.from(data.prices.values()).filter((price) => priceMatchesFilters(price, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'prices', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        promoCodes: {
            async create(input: QZPayCreatePromoCodeInput & { id: string }): Promise<QZPayPromoCode> {
                const now = getCurrentTime();
                const promo: QZPayPromoCode = {
                    id: input.id,
                    code: input.code,
                    discountType: input.discountType,
                    discountValue: input.discountValue,
                    currency: input.currency ?? null,
                    stackingMode: input.stackingMode ?? 'none',
                    conditions: input.conditions ?? [],
                    maxRedemptions: input.maxRedemptions ?? null,
                    currentRedemptions: 0,
                    maxRedemptionsPerCustomer: input.maxRedemptionsPerCustomer ?? null,
                    applicablePlanIds: input.applicablePlanIds ?? [],
                    applicableProductIds: input.applicableProductIds ?? [],
                    validFrom: input.validFrom ?? now,
                    validUntil: input.validUntil ?? null,
                    active: true,
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                data.promoCodes.set(promo.id, promo);
                return promo;
            },
            async update(id: string, updates: Partial<QZPayPromoCode>): Promise<QZPayPromoCode> {
                const promo = data.promoCodes.get(id);
                if (!promo) throw new Error(`Promo code ${id} not found`);
                const updated: QZPayPromoCode = {
                    ...promo,
                    ...updates,
                    updatedAt: getCurrentTime()
                };
                data.promoCodes.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.promoCodes.delete(id);
            },
            async findById(id: string): Promise<QZPayPromoCode | null> {
                return data.promoCodes.get(id) ?? null;
            },
            async findByCode(code: string): Promise<QZPayPromoCode | null> {
                for (const promo of data.promoCodes.values()) {
                    if (promo.code === code) return promo;
                }
                return null;
            },
            async incrementRedemptions(id: string): Promise<void> {
                const promo = data.promoCodes.get(id);
                if (promo) {
                    promo.currentRedemptions += 1;
                }
            },
            // SPEC-123 A4: in-memory analogue of the conditional-UPDATE
            // promo-code increment. Returns null when the increment would
            // exceed maxRedemptions (treated as "limit reached").
            async atomicIncrementRedemptions(id: string): Promise<QZPayPromoCode | null> {
                const promo = data.promoCodes.get(id);
                if (!promo) return null;
                if (promo.maxRedemptions !== null && promo.currentRedemptions >= promo.maxRedemptions) {
                    return null;
                }
                promo.currentRedemptions += 1;
                promo.updatedAt = getCurrentTime();
                return promo;
            },
            async list(
                options: QZPayListOptions<QZPayPromoCodeFilters, QZPayPromoCodeOrderBy>
            ): Promise<QZPayPaginatedResult<QZPayPromoCode>> {
                const filtered = Array.from(data.promoCodes.values()).filter((promo) => promoCodeMatchesFilters(promo, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayPromoCodeFilters, QZPayPromoCodeOrderBy>): Promise<QZPayPromoCode[]> {
                const filtered = Array.from(data.promoCodes.values()).filter((promo) => promoCodeMatchesFilters(promo, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'promoCodes', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        vendors: {
            async create(input: QZPayCreateVendorInput & { id: string }): Promise<QZPayVendor> {
                const now = getCurrentTime();
                const vendor: QZPayVendor = {
                    id: input.id,
                    externalId: input.externalId,
                    name: input.name,
                    email: input.email,
                    status: 'pending',
                    // Matches the Drizzle adapter: a freshly created vendor has
                    // not completed onboarding, so it cannot be paid yet.
                    canReceivePayments: false,
                    commissionRate: input.commissionRate ?? 10,
                    payoutSchedule: input.payoutSchedule ?? { interval: 'monthly', dayOfMonth: 1 },
                    providerAccountIds: {},
                    metadata: input.metadata ?? {},
                    livemode: false,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                data.vendors.set(vendor.id, vendor);
                return vendor;
            },
            async update(id: string, input: QZPayUpdateVendorInput): Promise<QZPayVendor> {
                const vendor = data.vendors.get(id);
                if (!vendor) throw new Error(`Vendor ${id} not found`);
                const updated: QZPayVendor = {
                    ...vendor,
                    ...input,
                    updatedAt: getCurrentTime()
                };
                data.vendors.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.vendors.delete(id);
            },
            async findById(id: string): Promise<QZPayVendor | null> {
                return data.vendors.get(id) ?? null;
            },
            async findByExternalId(externalId: string): Promise<QZPayVendor | null> {
                for (const vendor of data.vendors.values()) {
                    if (vendor.externalId === externalId) return vendor;
                }
                return null;
            },
            async list(options: QZPayListOptions<QZPayVendorFilters, QZPayVendorOrderBy>): Promise<QZPayPaginatedResult<QZPayVendor>> {
                const filtered = Array.from(data.vendors.values()).filter((vendor) => vendorMatchesFilters(vendor, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayVendorFilters, QZPayVendorOrderBy>): Promise<QZPayVendor[]> {
                const filtered = Array.from(data.vendors.values()).filter((vendor) => vendorMatchesFilters(vendor, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'vendors', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            },
            async createPayout(payout: QZPayVendorPayout): Promise<QZPayVendorPayout> {
                data.vendorPayouts.set(payout.id, payout);
                return payout;
            },
            async findPayoutsByVendorId(vendorId: string): Promise<QZPayVendorPayout[]> {
                return Array.from(data.vendorPayouts.values()).filter((p) => p.vendorId === vendorId);
            }
        },

        entitlements: {
            async createDefinition(entitlement: QZPayEntitlement): Promise<QZPayEntitlement> {
                data.entitlementDefinitions.set(entitlement.key, entitlement);
                return entitlement;
            },
            async findDefinitionByKey(key: string): Promise<QZPayEntitlement | null> {
                return data.entitlementDefinitions.get(key) ?? null;
            },
            async listDefinitions(): Promise<QZPayEntitlement[]> {
                return Array.from(data.entitlementDefinitions.values());
            },
            async grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement> {
                const ce: QZPayCustomerEntitlement = {
                    customerId: input.customerId,
                    entitlementKey: input.entitlementKey,
                    grantedAt: getCurrentTime(),
                    expiresAt: input.expiresAt ?? null,
                    source: input.source ?? 'manual',
                    sourceId: input.sourceId ?? null
                };
                const key = `${input.customerId}:${input.entitlementKey}`;
                data.customerEntitlements.set(key, ce);
                return ce;
            },
            async revoke(customerId: string, entitlementKey: string): Promise<void> {
                const key = `${customerId}:${entitlementKey}`;
                data.customerEntitlements.delete(key);
            },
            async findByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]> {
                return Array.from(data.customerEntitlements.values()).filter((ce) => ce.customerId === customerId);
            },
            async check(customerId: string, entitlementKey: string): Promise<boolean> {
                const key = `${customerId}:${entitlementKey}`;
                const ce = data.customerEntitlements.get(key);
                if (!ce) return false;
                if (ce.expiresAt && ce.expiresAt < getCurrentTime()) return false;
                return true;
            },
            async revokeBySource(source: QZPaySourceType, sourceId: string): Promise<number> {
                let count = 0;
                for (const [key, ce] of data.customerEntitlements.entries()) {
                    if (ce.source === source && ce.sourceId === sourceId) {
                        data.customerEntitlements.delete(key);
                        count++;
                    }
                }
                return count;
            }
        },

        limits: {
            async createDefinition(limit: QZPayLimit): Promise<QZPayLimit> {
                data.limitDefinitions.set(limit.key, limit);
                return limit;
            },
            async findDefinitionByKey(key: string): Promise<QZPayLimit | null> {
                return data.limitDefinitions.get(key) ?? null;
            },
            async listDefinitions(): Promise<QZPayLimit[]> {
                return Array.from(data.limitDefinitions.values());
            },
            async set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit> {
                const cl: QZPayCustomerLimit = {
                    customerId: input.customerId,
                    limitKey: input.limitKey,
                    maxValue: input.maxValue,
                    currentValue: 0,
                    resetAt: input.resetAt ?? null,
                    source: input.source ?? 'manual',
                    sourceId: input.sourceId ?? null
                };
                const key = `${input.customerId}:${input.limitKey}`;
                data.customerLimits.set(key, cl);
                return cl;
            },
            async delete(customerId: string, limitKey: string): Promise<void> {
                const key = `${customerId}:${limitKey}`;
                data.customerLimits.delete(key);
            },
            async deleteBySource(source: QZPaySourceType, sourceId: string): Promise<number> {
                let count = 0;
                for (const [key, cl] of data.customerLimits.entries()) {
                    if (cl.source === source && cl.sourceId === sourceId) {
                        data.customerLimits.delete(key);
                        count++;
                    }
                }
                return count;
            },
            async increment(input: QZPayIncrementLimitInput): Promise<QZPayCustomerLimit> {
                const key = `${input.customerId}:${input.limitKey}`;
                const cl = data.customerLimits.get(key);
                if (!cl) throw new Error(`Customer limit ${key} not found`);
                cl.currentValue += input.incrementBy ?? 1;
                return cl;
            },
            async findByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]> {
                return Array.from(data.customerLimits.values()).filter((cl) => cl.customerId === customerId);
            },
            async check(customerId: string, limitKey: string): Promise<QZPayCustomerLimit | null> {
                const key = `${customerId}:${limitKey}`;
                return data.customerLimits.get(key) ?? null;
            },
            async recordUsage(record: QZPayUsageRecord): Promise<QZPayUsageRecord> {
                data.usageRecords.set(record.id, record);
                return record;
            }
        },

        addons: {
            async create(input: QZPayCreateAddOnInput & { id: string }): Promise<QZPayAddOn> {
                const now = getCurrentTime();
                const addon: QZPayAddOn = {
                    id: input.id,
                    name: input.name,
                    description: input.description ?? null,
                    active: true,
                    unitAmount: input.unitAmount,
                    currency: input.currency,
                    billingInterval: input.billingInterval,
                    billingIntervalCount: input.billingIntervalCount ?? 1,
                    compatiblePlanIds: input.compatiblePlanIds ?? [],
                    allowMultiple: input.allowMultiple ?? true,
                    maxQuantity: input.maxQuantity ?? null,
                    entitlements: input.entitlements ?? [],
                    limits: input.limits ?? [],
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now
                };
                data.addons.set(addon.id, addon);
                return addon;
            },
            async update(id: string, input: QZPayUpdateAddOnInput): Promise<QZPayAddOn> {
                const addon = data.addons.get(id);
                if (!addon) throw new Error(`Add-on ${id} not found`);
                const updated: QZPayAddOn = {
                    ...addon,
                    ...input,
                    updatedAt: getCurrentTime()
                };
                data.addons.set(id, updated);
                return updated;
            },
            async delete(id: string): Promise<void> {
                data.addons.delete(id);
            },
            async findById(id: string): Promise<QZPayAddOn | null> {
                return data.addons.get(id) ?? null;
            },
            async findByPlanId(planId: string): Promise<QZPayAddOn[]> {
                return Array.from(data.addons.values()).filter((a) => a.compatiblePlanIds.includes(planId));
            },
            async list(options: QZPayListOptions<QZPayAddOnFilters, QZPayAddOnOrderBy>): Promise<QZPayPaginatedResult<QZPayAddOn>> {
                const filtered = Array.from(data.addons.values()).filter((addon) => addOnMatchesFilters(addon, options.filters));
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayAddOnFilters, QZPayAddOnOrderBy>): Promise<QZPayAddOn[]> {
                const filtered = Array.from(data.addons.values()).filter((addon) => addOnMatchesFilters(addon, options?.filters));
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'addons', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            },
            async addToSubscription(input: {
                id: string;
                subscriptionId: string;
                addOnId: string;
                quantity: number;
                unitAmount: number;
                currency: string;
                metadata?: QZPayMetadata;
            }): Promise<QZPaySubscriptionAddOn> {
                const now = getCurrentTime();
                const subAddon: QZPaySubscriptionAddOn = {
                    id: input.id,
                    subscriptionId: input.subscriptionId,
                    addOnId: input.addOnId,
                    quantity: input.quantity,
                    unitAmount: input.unitAmount,
                    currency: input.currency,
                    status: 'active',
                    addedAt: now,
                    canceledAt: null,
                    expiresAt: null,
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now
                };
                data.subscriptionAddons.set(input.id, subAddon);
                return subAddon;
            },
            async removeFromSubscription(subscriptionId: string, addOnId: string): Promise<void> {
                for (const [key, subAddon] of data.subscriptionAddons) {
                    if (subAddon.subscriptionId === subscriptionId && subAddon.addOnId === addOnId) {
                        data.subscriptionAddons.delete(key);
                        break;
                    }
                }
            },
            async updateSubscriptionAddOn(
                subscriptionId: string,
                addOnId: string,
                input: Partial<QZPaySubscriptionAddOn>
            ): Promise<QZPaySubscriptionAddOn> {
                for (const subAddon of data.subscriptionAddons.values()) {
                    if (subAddon.subscriptionId === subscriptionId && subAddon.addOnId === addOnId) {
                        Object.assign(subAddon, input, { updatedAt: getCurrentTime() });
                        return subAddon;
                    }
                }
                throw new Error('Subscription add-on not found');
            },
            async findBySubscriptionId(subscriptionId: string): Promise<QZPaySubscriptionAddOn[]> {
                return Array.from(data.subscriptionAddons.values()).filter((sa) => sa.subscriptionId === subscriptionId);
            },
            async findSubscriptionAddOn(subscriptionId: string, addOnId: string): Promise<QZPaySubscriptionAddOn | null> {
                for (const subAddon of data.subscriptionAddons.values()) {
                    if (subAddon.subscriptionId === subscriptionId && subAddon.addOnId === addOnId) {
                        return subAddon;
                    }
                }
                return null;
            }
        },

        checkouts: {
            async create(session: QZPayCheckoutSession): Promise<QZPayCheckoutSession> {
                if (data.checkouts.has(session.id)) {
                    throw new Error(`Checkout ${session.id} already exists`);
                }
                data.checkouts.set(session.id, session);
                return session;
            },
            async update(id: string, input: Partial<QZPayCheckoutSession>): Promise<QZPayCheckoutSession> {
                const checkout = data.checkouts.get(id);
                if (!checkout) {
                    throw new Error(`Checkout ${id} not found`);
                }
                const updated: QZPayCheckoutSession = { ...checkout, ...input };
                data.checkouts.set(id, updated);
                return updated;
            },
            async findById(id: string): Promise<QZPayCheckoutSession | null> {
                return data.checkouts.get(id) ?? null;
            },
            async findByCustomerId(customerId: string): Promise<QZPayCheckoutSession[]> {
                return Array.from(data.checkouts.values()).filter((c) => c.customerId === customerId);
            },
            async list(
                options: QZPayListOptions<QZPayCheckoutFilters, QZPayCheckoutOrderBy>
            ): Promise<QZPayPaginatedResult<QZPayCheckoutSession>> {
                const filtered = Array.from(data.checkouts.values()).filter((checkout) =>
                    checkoutMatchesFilters(checkout, options.filters)
                );
                const sorted = sortItems(filtered, options.orderBy, options.orderDirection);
                return paginateList(sorted, options);
            },
            async listAll(options?: QZPayListAllOptions<QZPayCheckoutFilters, QZPayCheckoutOrderBy>): Promise<QZPayCheckoutSession[]> {
                const filtered = Array.from(data.checkouts.values()).filter((checkout) =>
                    checkoutMatchesFilters(checkout, options?.filters)
                );
                const sorted = sortItems(filtered, options?.orderBy, options?.orderDirection);
                return collectAllItems({ entity: 'checkouts', items: sorted, batchSize: options?.batchSize, maxItems: options?.maxItems });
            }
        },

        async transaction<T>(fn: () => Promise<T>): Promise<T> {
            // In-memory storage doesn't need real transactions
            return fn();
        }
    };

    return {
        adapter,
        reset,
        seed,
        getData,
        getSnapshot
    };
}
