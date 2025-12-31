/**
 * Mock storage adapter for testing
 */
import { vi } from 'vitest';
import type { QZPayStorageAdapter } from '../../src/adapters/storage.adapter.js';
import type { QZPayCustomer } from '../../src/types/customer.types.js';
import type { QZPayInvoice } from '../../src/types/invoice.types.js';
import type { QZPayPayment } from '../../src/types/payment.types.js';
import type { QZPayPlan } from '../../src/types/plan.types.js';
import type { QZPayPromoCode } from '../../src/types/promo-code.types.js';
import type { QZPaySubscription } from '../../src/types/subscription.types.js';
import type { QZPayVendor } from '../../src/types/vendor.types.js';

/**
 * In-memory data stores for testing
 */
export interface QZPayMockStorageData {
    customers: Map<string, QZPayCustomer>;
    subscriptions: Map<string, QZPaySubscription>;
    invoices: Map<string, QZPayInvoice>;
    payments: Map<string, QZPayPayment>;
    promoCodes: Map<string, QZPayPromoCode>;
    plans: Map<string, QZPayPlan>;
    vendors: Map<string, QZPayVendor>;
}

/**
 * Create initial empty data stores
 */
export function createMockStorageData(): QZPayMockStorageData {
    return {
        customers: new Map(),
        subscriptions: new Map(),
        invoices: new Map(),
        payments: new Map(),
        promoCodes: new Map(),
        plans: new Map(),
        vendors: new Map()
    };
}

/**
 * Create a mock storage adapter with in-memory storage
 */
export function createMockStorageAdapter(data?: QZPayMockStorageData): QZPayStorageAdapter {
    const stores = data ?? createMockStorageData();
    let idCounter = 0;

    const generateId = (prefix: string): string => `${prefix}_${++idCounter}`;

    return {
        customers: {
            create: vi.fn(async (input) => {
                const customer: QZPayCustomer = {
                    id: generateId('cus'),
                    email: input.email,
                    name: input.name,
                    externalId: input.externalId,
                    metadata: input.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.customers.set(customer.id, customer);
                return customer;
            }),
            findById: vi.fn(async (id) => stores.customers.get(id) ?? null),
            findByExternalId: vi.fn(async (externalId) => {
                for (const customer of stores.customers.values()) {
                    if (customer.externalId === externalId) {
                        return customer;
                    }
                }
                return null;
            }),
            findByEmail: vi.fn(async (email) => {
                for (const customer of stores.customers.values()) {
                    if (customer.email === email) {
                        return customer;
                    }
                }
                return null;
            }),
            update: vi.fn(async (id, input) => {
                const customer = stores.customers.get(id);
                if (!customer) return null;
                const updated = { ...customer, ...input, updatedAt: new Date() };
                stores.customers.set(id, updated);
                return updated;
            }),
            delete: vi.fn(async (id) => {
                stores.customers.delete(id);
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.customers.values()),
                total: stores.customers.size
            }))
        },
        subscriptions: {
            create: vi.fn(async (input) => {
                const subscription: QZPaySubscription = {
                    id: generateId('sub'),
                    customerId: input.customerId,
                    planId: input.planId,
                    status: 'active',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    items: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.subscriptions.set(subscription.id, subscription);
                return subscription;
            }),
            findById: vi.fn(async (id) => stores.subscriptions.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                const results: QZPaySubscription[] = [];
                for (const sub of stores.subscriptions.values()) {
                    if (sub.customerId === customerId) {
                        results.push(sub);
                    }
                }
                return results;
            }),
            findActiveByCustomerId: vi.fn(async (customerId) => {
                for (const sub of stores.subscriptions.values()) {
                    if (sub.customerId === customerId && sub.status === 'active') {
                        return sub;
                    }
                }
                return null;
            }),
            update: vi.fn(async (id, input) => {
                const sub = stores.subscriptions.get(id);
                if (!sub) return null;
                const updated = { ...sub, ...input, updatedAt: new Date() };
                stores.subscriptions.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.subscriptions.values()),
                total: stores.subscriptions.size
            }))
        },
        invoices: {
            create: vi.fn(async (input) => {
                const invoice: QZPayInvoice = {
                    id: generateId('inv'),
                    customerId: input.customerId,
                    subscriptionId: input.subscriptionId,
                    status: 'draft',
                    currency: 'USD',
                    subtotal: input.subtotal ?? 0,
                    tax: input.tax ?? 0,
                    total: input.total ?? 0,
                    lines: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.invoices.set(invoice.id, invoice);
                return invoice;
            }),
            findById: vi.fn(async (id) => stores.invoices.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                const results: QZPayInvoice[] = [];
                for (const inv of stores.invoices.values()) {
                    if (inv.customerId === customerId) {
                        results.push(inv);
                    }
                }
                return results;
            }),
            findBySubscriptionId: vi.fn(async (subscriptionId) => {
                const results: QZPayInvoice[] = [];
                for (const inv of stores.invoices.values()) {
                    if (inv.subscriptionId === subscriptionId) {
                        results.push(inv);
                    }
                }
                return results;
            }),
            update: vi.fn(async (id, input) => {
                const inv = stores.invoices.get(id);
                if (!inv) return null;
                const updated = { ...inv, ...input, updatedAt: new Date() };
                stores.invoices.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.invoices.values()),
                total: stores.invoices.size
            }))
        },
        payments: {
            create: vi.fn(async (input) => {
                const payment: QZPayPayment = {
                    id: generateId('pay'),
                    customerId: input.customerId,
                    amount: input.amount,
                    currency: input.currency ?? 'USD',
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.payments.set(payment.id, payment);
                return payment;
            }),
            findById: vi.fn(async (id) => stores.payments.get(id) ?? null),
            findByCustomerId: vi.fn(async (customerId) => {
                const results: QZPayPayment[] = [];
                for (const pay of stores.payments.values()) {
                    if (pay.customerId === customerId) {
                        results.push(pay);
                    }
                }
                return results;
            }),
            findByInvoiceId: vi.fn(async (invoiceId) => {
                const results: QZPayPayment[] = [];
                for (const pay of stores.payments.values()) {
                    if (pay.invoiceId === invoiceId) {
                        results.push(pay);
                    }
                }
                return results;
            }),
            update: vi.fn(async (id, input) => {
                const pay = stores.payments.get(id);
                if (!pay) return null;
                const updated = { ...pay, ...input, updatedAt: new Date() };
                stores.payments.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.payments.values()),
                total: stores.payments.size
            }))
        },
        promoCodes: {
            create: vi.fn(async (input) => {
                const promoCode: QZPayPromoCode = {
                    id: generateId('promo'),
                    code: input.code,
                    discountType: input.discountType,
                    discountValue: input.discountValue,
                    active: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.promoCodes.set(promoCode.id, promoCode);
                return promoCode;
            }),
            findById: vi.fn(async (id) => stores.promoCodes.get(id) ?? null),
            findByCode: vi.fn(async (code) => {
                for (const promo of stores.promoCodes.values()) {
                    if (promo.code === code) {
                        return promo;
                    }
                }
                return null;
            }),
            update: vi.fn(async (id, input) => {
                const promo = stores.promoCodes.get(id);
                if (!promo) return null;
                const updated = { ...promo, ...input, updatedAt: new Date() };
                stores.promoCodes.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.promoCodes.values()),
                total: stores.promoCodes.size
            }))
        },
        plans: {
            create: vi.fn(async (input) => {
                const plan: QZPayPlan = {
                    id: generateId('plan'),
                    name: input.name,
                    description: input.description,
                    active: true,
                    prices: input.prices ?? [],
                    metadata: input.metadata ?? {}
                };
                stores.plans.set(plan.id, plan);
                return plan;
            }),
            findById: vi.fn(async (id) => stores.plans.get(id) ?? null),
            update: vi.fn(async (id, input) => {
                const plan = stores.plans.get(id);
                if (!plan) return null;
                const updated = { ...plan, ...input };
                stores.plans.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.plans.values()),
                total: stores.plans.size
            }))
        },
        usageRecords: {
            create: vi.fn(async () => ({})),
            findBySubscriptionId: vi.fn(async () => []),
            aggregate: vi.fn(async () => ({}))
        },
        vendors: {
            create: vi.fn(async (input) => {
                const vendor: QZPayVendor = {
                    id: generateId('vendor'),
                    name: input.name,
                    email: input.email,
                    status: 'pending',
                    commissionPercent: input.commissionPercent ?? 10,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                stores.vendors.set(vendor.id, vendor);
                return vendor;
            }),
            findById: vi.fn(async (id) => stores.vendors.get(id) ?? null),
            update: vi.fn(async (id, input) => {
                const vendor = stores.vendors.get(id);
                if (!vendor) return null;
                const updated = { ...vendor, ...input, updatedAt: new Date() };
                stores.vendors.set(id, updated);
                return updated;
            }),
            list: vi.fn(async () => ({
                data: Array.from(stores.vendors.values()),
                total: stores.vendors.size
            }))
        },
        events: {
            create: vi.fn(async () => ({})),
            findById: vi.fn(async () => null),
            list: vi.fn(async () => ({ data: [], total: 0 }))
        }
    };
}

/**
 * Reset all mock functions in a storage adapter
 */
export function resetMockStorageAdapter(adapter: QZPayStorageAdapter): void {
    for (const service of Object.values(adapter)) {
        for (const method of Object.values(service)) {
            if (typeof method === 'function' && 'mockClear' in method) {
                (method as ReturnType<typeof vi.fn>).mockClear();
            }
        }
    }
}
