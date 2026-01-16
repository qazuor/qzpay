/**
 * LocalStorage Storage Adapter for QZPay Playground
 *
 * This is a simplified implementation for testing/playground purposes.
 * It uses type assertions to work with the QZPay storage adapter interface
 * while storing data in browser localStorage.
 */
import type { QZPayListOptions, QZPayPaginatedResult, QZPayStorageAdapter } from '@qazuor/qzpay-core';
import { useConfigStore } from '../stores/config.store';

const STORAGE_KEY = 'qzpay_playground_data';

// Use 'any' for internal storage as the playground needs flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface PlaygroundData {
    customers: AnyRecord;
    subscriptions: AnyRecord;
    payments: AnyRecord;
    paymentMethods: AnyRecord;
    invoices: AnyRecord;
    plans: AnyRecord;
    prices: AnyRecord;
    promoCodes: AnyRecord;
    vendors: AnyRecord;
    vendorPayouts: AnyRecord;
    addons: AnyRecord;
    subscriptionAddons: AnyRecord;
    entitlementDefinitions: AnyRecord;
    customerEntitlements: AnyRecord;
    limitDefinitions: AnyRecord;
    customerLimits: AnyRecord;
    usageRecords: AnyRecord;
    products: AnyRecord;
}

function getEmptyData(): PlaygroundData {
    return {
        customers: {},
        subscriptions: {},
        payments: {},
        paymentMethods: {},
        invoices: {},
        plans: {},
        prices: {},
        promoCodes: {},
        vendors: {},
        vendorPayouts: {},
        addons: {},
        subscriptionAddons: {},
        entitlementDefinitions: {},
        customerEntitlements: {},
        limitDefinitions: {},
        customerLimits: {},
        usageRecords: {},
        products: {}
    };
}

let data: PlaygroundData = getEmptyData();

function loadData(): void {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            data = reviveDates(parsed);
        }
    } catch {
        data = getEmptyData();
    }
}

function saveData(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function reviveDates(obj: unknown): PlaygroundData {
    if (obj === null || typeof obj !== 'object') return obj as PlaygroundData;

    // IMPORTANT: Don't spread Date objects - they would lose their methods
    if (obj instanceof Date) return obj as unknown as PlaygroundData;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key of Object.keys(result)) {
        const value = (result as AnyRecord)[key];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            (result as AnyRecord)[key] = new Date(value);
        } else if (value instanceof Date) {
            // Keep Date objects as-is
            (result as AnyRecord)[key] = value;
        } else if (typeof value === 'object' && value !== null) {
            (result as AnyRecord)[key] = reviveDates(value);
        }
    }
    return result as PlaygroundData;
}

let idCounter = 0;
const generateId = (prefix: string): string => `${prefix}_${Date.now()}_${++idCounter}`;

function paginate<T>(items: T[], options?: QZPayListOptions): QZPayPaginatedResult<T> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const paginatedItems = items.slice(offset, offset + limit);
    return {
        data: paginatedItems,
        total: items.length,
        limit,
        offset,
        hasMore: offset + limit < items.length
    };
}

// Initialize data on load
loadData();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLocalStorageAdapter(): QZPayStorageAdapter {
    // Use simulated time from config store when time simulation is enabled
    const now = () => useConfigStore.getState().getCurrentTime();

    // Helper to create base entity with common fields
    const createEntity = (prefix: string, input: AnyRecord) => ({
        id: input.id ?? generateId(prefix),
        ...input,
        livemode: false,
        createdAt: now(),
        updatedAt: now()
    });

    return {
        customers: {
            async create(input) {
                const customer = createEntity('cus', {
                    ...input,
                    providerCustomerIds: {},
                    deletedAt: null
                });
                data.customers[customer.id] = customer;
                saveData();
                return customer;
            },

            async update(id, input) {
                const customer = data.customers[id];
                if (!customer) throw new Error(`Customer ${id} not found`);
                Object.assign(customer, input, { updatedAt: now() });
                saveData();
                return customer;
            },

            async delete(id) {
                delete data.customers[id];
                saveData();
            },

            async findById(id) {
                return data.customers[id] ?? null;
            },

            async findByExternalId(externalId) {
                return Object.values(data.customers).find((c: AnyRecord) => c.externalId === externalId) ?? null;
            },

            async findByEmail(email) {
                return Object.values(data.customers).find((c: AnyRecord) => c.email === email) ?? null;
            },

            async list(options) {
                return paginate(Object.values(data.customers), options);
            }
        },

        subscriptions: {
            async create(input) {
                const n = now();
                const hasTrial = input.trialDays && input.trialDays > 0;
                const trialEnd = hasTrial ? new Date(n.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : null;

                // If there's a trial, the current period ends at trial end
                // Otherwise, it ends after the billing interval (default 30 days for month)
                const currentPeriodEnd = hasTrial ? trialEnd! : new Date(n.getTime() + 30 * 24 * 60 * 60 * 1000);

                const subscription = createEntity('sub', {
                    ...input,
                    status: hasTrial ? 'trialing' : 'active',
                    interval: 'month',
                    intervalCount: 1,
                    quantity: input.quantity ?? 1,
                    currentPeriodStart: n,
                    currentPeriodEnd,
                    trialStart: hasTrial ? n : null,
                    trialEnd,
                    cancelAt: null,
                    canceledAt: null,
                    cancelAtPeriodEnd: false,
                    providerSubscriptionIds: {},
                    deletedAt: null
                });
                data.subscriptions[subscription.id] = subscription;

                // Grant entitlements and limits from the plan to the customer
                const plan = data.plans[input.planId] as AnyRecord | undefined;
                if (plan && input.customerId) {
                    // Grant entitlements from plan
                    const planEntitlements = (plan.entitlements || []) as string[];
                    for (const entitlementKey of planEntitlements) {
                        const key = `${input.customerId}:${entitlementKey}`;
                        data.customerEntitlements[key] = {
                            customerId: input.customerId,
                            entitlementKey,
                            grantedAt: n,
                            expiresAt: null,
                            source: 'subscription',
                            sourceId: subscription.id
                        };
                    }

                    // Set limits from plan
                    const planLimits = (plan.limits || {}) as Record<string, number>;
                    for (const [limitKey, maxValue] of Object.entries(planLimits)) {
                        const key = `${input.customerId}:${limitKey}`;
                        data.customerLimits[key] = {
                            customerId: input.customerId,
                            limitKey,
                            maxValue,
                            currentUsage: 0,
                            resetAt: null,
                            source: 'subscription',
                            sourceId: subscription.id
                        };
                    }
                }

                saveData();
                return subscription;
            },

            async update(id, input) {
                const subscription = data.subscriptions[id] as AnyRecord;
                if (!subscription) throw new Error(`Subscription ${id} not found`);

                const wasActive = subscription.status === 'active' || subscription.status === 'trialing';
                Object.assign(subscription, input, { updatedAt: now() });
                const isNowCanceled = subscription.status === 'canceled';

                // If subscription was just canceled, revoke entitlements and limits
                if (wasActive && isNowCanceled && subscription.customerId) {
                    // Remove entitlements granted by this subscription
                    for (const key of Object.keys(data.customerEntitlements)) {
                        const entitlement = data.customerEntitlements[key] as AnyRecord;
                        if (entitlement.sourceId === id && entitlement.source === 'subscription') {
                            delete data.customerEntitlements[key];
                        }
                    }

                    // Remove limits set by this subscription
                    for (const key of Object.keys(data.customerLimits)) {
                        const limit = data.customerLimits[key] as AnyRecord;
                        if (limit.sourceId === id && limit.source === 'subscription') {
                            delete data.customerLimits[key];
                        }
                    }
                }

                saveData();
                return subscription;
            },

            async delete(id) {
                delete data.subscriptions[id];
                saveData();
            },

            async findById(id) {
                return data.subscriptions[id] ?? null;
            },

            async findByCustomerId(customerId) {
                return Object.values(data.subscriptions).filter((s: AnyRecord) => s.customerId === customerId);
            },

            async list(options) {
                return paginate(Object.values(data.subscriptions), options);
            }
        },

        payments: {
            async create(payment) {
                data.payments[payment.id] = payment;
                saveData();
                return payment;
            },

            async update(id, updates) {
                const payment = data.payments[id];
                if (!payment) throw new Error(`Payment ${id} not found`);
                Object.assign(payment, updates);
                saveData();
                return payment;
            },

            async findById(id) {
                return data.payments[id] ?? null;
            },

            async findByCustomerId(customerId) {
                return Object.values(data.payments).filter((p: AnyRecord) => p.customerId === customerId);
            },

            async list(options) {
                return paginate(Object.values(data.payments), options);
            }
        },

        paymentMethods: {
            async create(input) {
                const paymentMethod = createEntity('pm', {
                    ...input,
                    status: 'active',
                    card: null,
                    bankAccount: null
                });
                data.paymentMethods[paymentMethod.id] = paymentMethod;
                saveData();
                return paymentMethod;
            },

            async update(id, input) {
                const pm = data.paymentMethods[id];
                if (!pm) throw new Error(`PaymentMethod ${id} not found`);
                Object.assign(pm, input, { updatedAt: now() });
                saveData();
                return pm;
            },

            async delete(id) {
                delete data.paymentMethods[id];
                saveData();
            },

            async findById(id) {
                return data.paymentMethods[id] ?? null;
            },

            async findByCustomerId(customerId) {
                return Object.values(data.paymentMethods).filter((pm: AnyRecord) => pm.customerId === customerId);
            },

            async findDefaultByCustomerId(customerId) {
                return Object.values(data.paymentMethods).find((pm: AnyRecord) => pm.customerId === customerId && pm.isDefault) ?? null;
            },

            async setDefault(customerId, paymentMethodId) {
                for (const pm of Object.values(data.paymentMethods) as AnyRecord[]) {
                    if (pm.customerId === customerId) {
                        pm.isDefault = pm.id === paymentMethodId;
                    }
                }
                saveData();
            },

            async list(options) {
                return paginate(Object.values(data.paymentMethods), options);
            }
        },

        invoices: {
            async create(input) {
                const lines = input.lines ?? [];
                const subtotal = lines.reduce((sum: number, line: AnyRecord) => sum + line.quantity * line.unitAmount, 0);
                const invoice = createEntity('inv', {
                    ...input,
                    status: 'draft',
                    currency: 'usd',
                    subtotal,
                    tax: 0,
                    discount: 0,
                    total: subtotal,
                    amountPaid: 0,
                    amountDue: subtotal,
                    periodStart: null,
                    periodEnd: null,
                    paidAt: null,
                    voidedAt: null,
                    lines: lines.map((line: AnyRecord, idx: number) => ({
                        id: `li_${Date.now()}_${idx}`,
                        invoiceId: input.id,
                        ...line,
                        amount: line.quantity * line.unitAmount
                    })),
                    providerInvoiceIds: {}
                });
                data.invoices[invoice.id] = invoice;
                saveData();
                return invoice;
            },

            async update(id, updates) {
                const invoice = data.invoices[id];
                if (!invoice) throw new Error(`Invoice ${id} not found`);
                Object.assign(invoice, updates, { updatedAt: now() });
                saveData();
                return invoice;
            },

            async findById(id) {
                return data.invoices[id] ?? null;
            },

            async findByCustomerId(customerId) {
                return Object.values(data.invoices).filter((i: AnyRecord) => i.customerId === customerId);
            },

            async list(options) {
                return paginate(Object.values(data.invoices), options);
            }
        },

        plans: {
            async create(input) {
                const plan = createEntity('plan', {
                    ...input,
                    active: true,
                    prices: [],
                    features: input.features ?? [],
                    entitlements: input.entitlements ?? [],
                    limits: input.limits ?? {},
                    deletedAt: null
                });
                data.plans[plan.id] = plan;
                saveData();
                return plan;
            },

            async update(id, updates) {
                const plan = data.plans[id];
                if (!plan) throw new Error(`Plan ${id} not found`);
                Object.assign(plan, updates, { updatedAt: now() });
                saveData();
                return plan;
            },

            async delete(id) {
                delete data.plans[id];
                saveData();
            },

            async findById(id) {
                return data.plans[id] ?? null;
            },

            async list(options) {
                return paginate(Object.values(data.plans), options);
            }
        },

        prices: {
            async create(input) {
                const price = createEntity('price', {
                    ...input,
                    nickname: null,
                    unitAmount: input.unitAmount ?? input.amount ?? 0,
                    billingInterval: input.billingInterval ?? input.interval ?? 'month',
                    active: true,
                    providerPriceIds: {}
                });
                data.prices[price.id] = price;
                saveData();
                return price;
            },

            async update(id, updates) {
                const price = data.prices[id];
                if (!price) throw new Error(`Price ${id} not found`);
                Object.assign(price, updates, { updatedAt: now() });
                saveData();
                return price;
            },

            async delete(id) {
                delete data.prices[id];
                saveData();
            },

            async findById(id) {
                return data.prices[id] ?? null;
            },

            async findByPlanId(planId) {
                return Object.values(data.prices).filter((p: AnyRecord) => p.planId === planId);
            },

            async list(options) {
                return paginate(Object.values(data.prices), options);
            }
        },

        promoCodes: {
            async create(input) {
                const promoCode = createEntity('promo', {
                    ...input,
                    stackingMode: 'none',
                    conditions: [],
                    currentRedemptions: 0,
                    maxRedemptionsPerCustomer: null,
                    applicableProductIds: [],
                    active: true,
                    deletedAt: null
                });
                data.promoCodes[promoCode.id] = promoCode;
                saveData();
                return promoCode;
            },

            async update(id, updates) {
                const promoCode = data.promoCodes[id];
                if (!promoCode) throw new Error(`PromoCode ${id} not found`);
                Object.assign(promoCode, updates, { updatedAt: now() });
                saveData();
                return promoCode;
            },

            async delete(id) {
                delete data.promoCodes[id];
                saveData();
            },

            async findById(id) {
                return data.promoCodes[id] ?? null;
            },

            async findByCode(code) {
                // Debug: log available promo codes and search
                const promoCodes = Object.values(data.promoCodes);
                console.log('[QZPay Debug] findByCode:', {
                    searchingFor: code,
                    availableCodes: promoCodes.map((p: AnyRecord) => p.code),
                    totalPromoCodes: promoCodes.length
                });
                const found = promoCodes.find((p: AnyRecord) => p.code === code) ?? null;
                console.log('[QZPay Debug] findByCode result:', found ? 'Found' : 'Not found');
                return found;
            },

            async incrementRedemptions(id) {
                const promoCode = data.promoCodes[id];
                if (promoCode) {
                    promoCode.currentRedemptions = (promoCode.currentRedemptions ?? 0) + 1;
                    saveData();
                }
            },

            async list(options) {
                return paginate(Object.values(data.promoCodes), options);
            }
        },

        vendors: {
            async create(input) {
                const vendor = createEntity('vendor', {
                    ...input,
                    status: 'pending',
                    providerVendorIds: {}
                });
                data.vendors[vendor.id] = vendor;
                saveData();
                return vendor;
            },

            async update(id, input) {
                const vendor = data.vendors[id];
                if (!vendor) throw new Error(`Vendor ${id} not found`);
                Object.assign(vendor, input, { updatedAt: now() });
                saveData();
                return vendor;
            },

            async delete(id) {
                delete data.vendors[id];
                saveData();
            },

            async findById(id) {
                return data.vendors[id] ?? null;
            },

            async findByExternalId(externalId) {
                return Object.values(data.vendors).find((v: AnyRecord) => v.externalId === externalId) ?? null;
            },

            async list(options) {
                return paginate(Object.values(data.vendors), options);
            },

            async createPayout(payout) {
                data.vendorPayouts[payout.id] = payout;
                saveData();
                return payout;
            },

            async findPayoutsByVendorId(vendorId) {
                return Object.values(data.vendorPayouts).filter((p: AnyRecord) => p.vendorId === vendorId);
            }
        },

        entitlements: {
            async createDefinition(entitlement) {
                data.entitlementDefinitions[entitlement.key] = entitlement;
                saveData();
                return entitlement;
            },

            async findDefinitionByKey(key) {
                return data.entitlementDefinitions[key] ?? null;
            },

            async listDefinitions() {
                return Object.values(data.entitlementDefinitions);
            },

            async grant(input) {
                const key = `${input.customerId}:${input.entitlementKey}`;
                const entitlement = {
                    customerId: input.customerId,
                    entitlementKey: input.entitlementKey,
                    grantedAt: now(),
                    expiresAt: input.expiresAt ?? null,
                    source: input.source ?? 'manual',
                    sourceId: null
                };
                data.customerEntitlements[key] = entitlement;
                saveData();
                return entitlement;
            },

            async revoke(customerId, entitlementKey) {
                const key = `${customerId}:${entitlementKey}`;
                delete data.customerEntitlements[key];
                saveData();
            },

            async findByCustomerId(customerId) {
                return Object.values(data.customerEntitlements).filter((e: AnyRecord) => e.customerId === customerId);
            },

            async check(customerId, entitlementKey) {
                const key = `${customerId}:${entitlementKey}`;
                const entitlement = data.customerEntitlements[key] as AnyRecord | undefined;
                if (!entitlement) return false;
                if (entitlement.expiresAt && new Date(entitlement.expiresAt) < now()) return false;
                return true;
            }
        },

        limits: {
            async createDefinition(limit) {
                data.limitDefinitions[limit.key] = limit;
                saveData();
                return limit;
            },

            async findDefinitionByKey(key) {
                return data.limitDefinitions[key] ?? null;
            },

            async listDefinitions() {
                return Object.values(data.limitDefinitions);
            },

            async set(input) {
                const key = `${input.customerId}:${input.limitKey}`;
                const limit = {
                    customerId: input.customerId,
                    limitKey: input.limitKey,
                    maxValue: input.maxValue,
                    currentValue: 0,
                    resetAt: input.resetAt ?? null,
                    source: 'manual',
                    sourceId: null
                };
                data.customerLimits[key] = limit;
                saveData();
                return limit;
            },

            async increment(input) {
                const key = `${input.customerId}:${input.limitKey}`;
                const limit = data.customerLimits[key];
                if (!limit) throw new Error(`Limit ${input.limitKey} not found for customer ${input.customerId}`);
                limit.currentValue += input.incrementBy ?? 1;
                saveData();
                return limit;
            },

            async findByCustomerId(customerId) {
                return Object.values(data.customerLimits).filter((l: AnyRecord) => l.customerId === customerId);
            },

            async check(customerId, limitKey) {
                const key = `${customerId}:${limitKey}`;
                return data.customerLimits[key] ?? null;
            },

            async recordUsage(record) {
                const id = generateId('usage');
                const storedRecord = { ...record, id };
                data.usageRecords[id] = storedRecord;
                saveData();
                return storedRecord;
            }
        },

        addons: {
            async create(input) {
                const addon = createEntity('addon', {
                    ...input,
                    active: true
                });
                data.addons[addon.id] = addon;
                saveData();
                return addon;
            },

            async update(id, input) {
                const addon = data.addons[id];
                if (!addon) throw new Error(`AddOn ${id} not found`);
                Object.assign(addon, input, { updatedAt: now() });
                saveData();
                return addon;
            },

            async delete(id) {
                delete data.addons[id];
                saveData();
            },

            async findById(id) {
                return data.addons[id] ?? null;
            },

            async findByPlanId(planId) {
                return Object.values(data.addons).filter(
                    (a: AnyRecord) => !a.compatiblePlanIds?.length || a.compatiblePlanIds.includes(planId)
                );
            },

            async list(options) {
                return paginate(Object.values(data.addons), options);
            },

            async addToSubscription(input) {
                const subscriptionAddon = createEntity('subaddon', {
                    ...input,
                    status: 'active',
                    addedAt: now(),
                    canceledAt: null,
                    expiresAt: null
                });
                data.subscriptionAddons[subscriptionAddon.id] = subscriptionAddon;
                saveData();
                return subscriptionAddon;
            },

            async removeFromSubscription(subscriptionId, addOnId) {
                const key = Object.keys(data.subscriptionAddons).find((k) => {
                    const sa = data.subscriptionAddons[k] as AnyRecord;
                    return sa.subscriptionId === subscriptionId && sa.addOnId === addOnId;
                });
                if (key) {
                    delete data.subscriptionAddons[key];
                    saveData();
                }
            },

            async updateSubscriptionAddOn(subscriptionId, addOnId, input) {
                const addon = Object.values(data.subscriptionAddons).find(
                    (a: AnyRecord) => a.subscriptionId === subscriptionId && a.addOnId === addOnId
                ) as AnyRecord | undefined;
                if (!addon) throw new Error('Subscription addon not found');
                Object.assign(addon, input, { updatedAt: now() });
                saveData();
                return addon;
            },

            async findBySubscriptionId(subscriptionId) {
                return Object.values(data.subscriptionAddons).filter((a: AnyRecord) => a.subscriptionId === subscriptionId);
            },

            async findSubscriptionAddOn(subscriptionId, addOnId) {
                return (
                    Object.values(data.subscriptionAddons).find(
                        (a: AnyRecord) => a.subscriptionId === subscriptionId && a.addOnId === addOnId
                    ) ?? null
                );
            }
        },

        async transaction<T>(fn: () => Promise<T>): Promise<T> {
            return fn();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
}

/**
 * Clear all playground data from localStorage
 */
export function clearPlaygroundStorage(): void {
    data = getEmptyData();
    saveData();
}

/**
 * Export all playground data
 */
export function exportPlaygroundData(): PlaygroundData {
    return JSON.parse(JSON.stringify(data));
}

/**
 * Import playground data
 */
export function importPlaygroundData(newData: PlaygroundData): void {
    data = reviveDates(newData);
    saveData();
}

/**
 * Save a payment method directly to storage
 */
export function savePaymentMethod(paymentMethod: {
    id: string;
    customerId: string;
    type: string;
    card?: {
        last4: string;
        brand: string;
        expMonth: number;
        expYear: number;
    };
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
}): void {
    data.paymentMethods[paymentMethod.id] = {
        ...paymentMethod,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    saveData();
}
