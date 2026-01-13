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
    QZPayCreateAddOnInput,
    QZPayCreateCustomerInput,
    QZPayCreateInvoiceInput,
    QZPayCreatePaymentMethodInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayCreateSubscriptionInput,
    QZPayCreateVendorInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEntitlement,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayLimit,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentMethod,
    QZPayPlan,
    QZPayPrice,
    QZPayPromoCode,
    QZPaySetLimitInput,
    QZPayStorageAdapter,
    QZPaySubscription,
    QZPaySubscriptionAddOn,
    QZPayUpdateAddOnInput,
    QZPayUpdateCustomerInput,
    QZPayUpdatePaymentMethodInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
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
}

let idCounter = 0;
const generateId = (prefix: string): string => `mock_${prefix}_${++idCounter}`;

/**
 * Helper to apply pagination to a list
 */
function paginate<T>(items: T[], options?: QZPayListOptions): QZPayPaginatedResult<T> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const data = items.slice(offset, offset + limit);
    return {
        data,
        total: items.length,
        limit,
        offset,
        hasMore: offset + limit < items.length
    };
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
        usageRecords: new Map()
    };

    const reset = (): void => {
        data.customers.clear();
        data.subscriptions.clear();
        data.payments.clear();
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
        usageRecords: Object.fromEntries(data.usageRecords)
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayCustomer>> {
                return paginate(Array.from(data.customers.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPaySubscription>> {
                return paginate(Array.from(data.subscriptions.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPayment>> {
                return paginate(Array.from(data.payments.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPaymentMethod>> {
                return paginate(Array.from(data.paymentMethods.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayInvoice>> {
                return paginate(Array.from(data.invoices.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPlan>> {
                return paginate(Array.from(data.plans.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPrice>> {
                return paginate(Array.from(data.prices.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPromoCode>> {
                return paginate(Array.from(data.promoCodes.values()), options);
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayVendor>> {
                return paginate(Array.from(data.vendors.values()), options);
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
                    sourceId: null
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
                    sourceId: null
                };
                const key = `${input.customerId}:${input.limitKey}`;
                data.customerLimits.set(key, cl);
                return cl;
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
            async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayAddOn>> {
                return paginate(Array.from(data.addons.values()), options);
            },
            async addToSubscription(input: {
                id: string;
                subscriptionId: string;
                addOnId: string;
                quantity: number;
                unitAmount: number;
                currency: string;
                metadata?: Record<string, unknown>;
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
