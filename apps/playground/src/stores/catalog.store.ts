import type { QZPayAddOn, QZPayBillingInterval, QZPayCurrency, QZPayPlan, QZPayPrice, QZPayPromoCode } from '@qazuor/qzpay-core';
/**
 * Catalog Store
 * Manages plans, prices, and other catalog entities
 */
import { create } from 'zustand';

// Re-export data access functions from local-storage adapter
import { exportPlaygroundData, importPlaygroundData } from '../adapters/local-storage.adapter';

// Entitlement definition for the playground
export interface EntitlementDefinition {
    key: string;
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

// Limit definition for the playground
export interface LimitDefinition {
    key: string;
    name: string;
    description: string;
    unit: string; // e.g., "calls", "GB", "members"
    defaultValue: number; // Default limit value (-1 for unlimited)
    createdAt: Date;
    updatedAt: Date;
}

// Product definition for one-time payments
export interface ProductDefinition {
    id: string;
    name: string;
    description: string | null;
    unitAmount: number; // in cents
    currency: QZPayCurrency;
    active: boolean;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

interface CatalogState {
    plans: QZPayPlan[];
    prices: QZPayPrice[];
    addons: QZPayAddOn[];
    promoCodes: QZPayPromoCode[];
    entitlementDefinitions: EntitlementDefinition[];
    limitDefinitions: LimitDefinition[];
    products: ProductDefinition[];
    isLoading: boolean;

    // Actions
    loadCatalog: () => void;
    addPlan: (plan: Partial<QZPayPlan> & { name: string }) => QZPayPlan;
    updatePlan: (id: string, updates: Partial<QZPayPlan>) => void;
    deletePlan: (id: string) => void;
    addPrice: (price: Partial<QZPayPrice> & { planId: string; unitAmount: number }) => QZPayPrice;
    updatePrice: (id: string, updates: Partial<QZPayPrice>) => void;
    deletePrice: (id: string) => void;
    addAddon: (
        addon: Partial<QZPayAddOn> & {
            name: string;
            unitAmount: number;
            currency: string;
            billingInterval: QZPayBillingInterval | 'one_time';
        }
    ) => QZPayAddOn;
    updateAddon: (id: string, updates: Partial<QZPayAddOn>) => void;
    deleteAddon: (id: string) => void;
    addPromoCode: (promoCode: Partial<QZPayPromoCode> & { code: string }) => QZPayPromoCode;
    updatePromoCode: (id: string, updates: Partial<QZPayPromoCode>) => void;
    deletePromoCode: (id: string) => void;
    // Entitlement actions
    addEntitlementDefinition: (entitlement: Omit<EntitlementDefinition, 'createdAt' | 'updatedAt'>) => EntitlementDefinition;
    updateEntitlementDefinition: (key: string, updates: Partial<Omit<EntitlementDefinition, 'key' | 'createdAt' | 'updatedAt'>>) => void;
    deleteEntitlementDefinition: (key: string) => void;
    // Limit actions
    addLimitDefinition: (limit: Omit<LimitDefinition, 'createdAt' | 'updatedAt'>) => LimitDefinition;
    updateLimitDefinition: (key: string, updates: Partial<Omit<LimitDefinition, 'key' | 'createdAt' | 'updatedAt'>>) => void;
    deleteLimitDefinition: (key: string) => void;
    // Product actions
    addProduct: (product: Omit<ProductDefinition, 'id' | 'createdAt' | 'updatedAt'>) => ProductDefinition;
    updateProduct: (id: string, updates: Partial<Omit<ProductDefinition, 'id' | 'createdAt' | 'updatedAt'>>) => void;
    deleteProduct: (id: string) => void;
}

let idCounter = 0;
const generateId = (prefix: string): string => `${prefix}_${Date.now()}_${++idCounter}`;

export const useCatalogStore = create<CatalogState>()((set, get) => ({
    plans: [],
    prices: [],
    addons: [],
    promoCodes: [],
    entitlementDefinitions: [],
    limitDefinitions: [],
    products: [],
    isLoading: false,

    loadCatalog: () => {
        const data = exportPlaygroundData();
        set({
            plans: Object.values(data.plans || {}) as QZPayPlan[],
            prices: Object.values(data.prices || {}) as QZPayPrice[],
            addons: Object.values(data.addons || {}) as QZPayAddOn[],
            promoCodes: Object.values(data.promoCodes || {}) as QZPayPromoCode[],
            entitlementDefinitions: Object.values(data.entitlementDefinitions || {}) as EntitlementDefinition[],
            limitDefinitions: Object.values(data.limitDefinitions || {}) as LimitDefinition[],
            products: Object.values(data.products || {}) as ProductDefinition[]
        });
    },

    addPlan: (input) => {
        const now = new Date();
        const plan: QZPayPlan = {
            id: generateId('plan'),
            name: input.name,
            description: input.description ?? null,
            active: input.active ?? true,
            prices: [],
            features: input.features ?? [],
            entitlements: input.entitlements ?? [],
            limits: input.limits ?? {},
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        };

        // Update localStorage
        const data = exportPlaygroundData();
        data.plans[plan.id] = plan;
        importPlaygroundData(data);

        // Update state
        set({ plans: [...get().plans, plan] });
        return plan;
    },

    updatePlan: (id, updates) => {
        const data = exportPlaygroundData();
        if (data.plans[id]) {
            Object.assign(data.plans[id], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                plans: get().plans.map((p) => (p.id === id ? { ...p, ...updates } : p))
            });
        }
    },

    deletePlan: (id) => {
        const data = exportPlaygroundData();
        delete data.plans[id];
        // Also delete associated prices
        Object.keys(data.prices).forEach((priceId) => {
            if ((data.prices[priceId] as QZPayPrice).planId === id) {
                delete data.prices[priceId];
            }
        });
        importPlaygroundData(data);
        set({
            plans: get().plans.filter((p) => p.id !== id),
            prices: get().prices.filter((p) => p.planId !== id)
        });
    },

    addPrice: (input) => {
        const now = new Date();
        const price: QZPayPrice = {
            id: generateId('price'),
            planId: input.planId,
            nickname: input.nickname ?? null,
            currency: input.currency ?? 'USD',
            unitAmount: input.unitAmount,
            billingInterval: input.billingInterval ?? 'month',
            intervalCount: input.intervalCount ?? 1,
            trialDays: input.trialDays ?? null,
            active: input.active ?? true,
            providerPriceIds: {},
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now
        };

        const data = exportPlaygroundData();
        data.prices[price.id] = price;
        importPlaygroundData(data);

        set({ prices: [...get().prices, price] });
        return price;
    },

    updatePrice: (id, updates) => {
        const data = exportPlaygroundData();
        if (data.prices[id]) {
            Object.assign(data.prices[id], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                prices: get().prices.map((p) => (p.id === id ? { ...p, ...updates } : p))
            });
        }
    },

    deletePrice: (id) => {
        const data = exportPlaygroundData();
        delete data.prices[id];
        importPlaygroundData(data);
        set({ prices: get().prices.filter((p) => p.id !== id) });
    },

    addAddon: (input) => {
        const now = new Date();
        const addon: QZPayAddOn = {
            id: generateId('addon'),
            name: input.name,
            description: input.description ?? null,
            unitAmount: input.unitAmount,
            currency: input.currency,
            billingInterval: input.billingInterval,
            billingIntervalCount: input.billingIntervalCount ?? 1,
            active: input.active ?? true,
            allowMultiple: input.allowMultiple ?? false,
            maxQuantity: input.maxQuantity ?? null,
            compatiblePlanIds: input.compatiblePlanIds ?? [],
            entitlements: input.entitlements ?? [],
            limits: input.limits ?? [],
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now
        };

        const data = exportPlaygroundData();
        data.addons[addon.id] = addon;
        importPlaygroundData(data);

        set({ addons: [...get().addons, addon] });
        return addon;
    },

    updateAddon: (id, updates) => {
        const data = exportPlaygroundData();
        if (data.addons[id]) {
            Object.assign(data.addons[id], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                addons: get().addons.map((a) => (a.id === id ? { ...a, ...updates } : a))
            });
        }
    },

    deleteAddon: (id) => {
        const data = exportPlaygroundData();
        delete data.addons[id];
        importPlaygroundData(data);
        set({ addons: get().addons.filter((a) => a.id !== id) });
    },

    addPromoCode: (input) => {
        const now = new Date();
        const promoCode = {
            id: generateId('promo'),
            code: input.code,
            discountType: input.discountType ?? 'percentage',
            discountValue: input.discountValue ?? 0,
            active: input.active ?? true,
            validFrom: input.validFrom ?? now,
            validUntil: input.validUntil ?? null,
            maxRedemptions: input.maxRedemptions ?? null,
            currentRedemptions: 0,
            maxRedemptionsPerCustomer: input.maxRedemptionsPerCustomer ?? null,
            applicablePlanIds: input.applicablePlanIds ?? [],
            applicableProductIds: input.applicableProductIds ?? [],
            stackingMode: input.stackingMode ?? 'none',
            conditions: input.conditions ?? [],
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        } as QZPayPromoCode;

        const data = exportPlaygroundData();
        data.promoCodes[promoCode.id] = promoCode;
        importPlaygroundData(data);

        set({ promoCodes: [...get().promoCodes, promoCode] });
        return promoCode;
    },

    updatePromoCode: (id, updates) => {
        const data = exportPlaygroundData();
        if (data.promoCodes[id]) {
            Object.assign(data.promoCodes[id], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                promoCodes: get().promoCodes.map((p) => (p.id === id ? { ...p, ...updates } : p))
            });
        }
    },

    deletePromoCode: (id) => {
        const data = exportPlaygroundData();
        delete data.promoCodes[id];
        importPlaygroundData(data);
        set({ promoCodes: get().promoCodes.filter((p) => p.id !== id) });
    },

    // Entitlement definition actions
    addEntitlementDefinition: (input) => {
        const now = new Date();
        const entitlement: EntitlementDefinition = {
            key: input.key,
            name: input.name,
            description: input.description,
            createdAt: now,
            updatedAt: now
        };

        const data = exportPlaygroundData();
        data.entitlementDefinitions[entitlement.key] = entitlement;
        importPlaygroundData(data);

        set({ entitlementDefinitions: [...get().entitlementDefinitions, entitlement] });
        return entitlement;
    },

    updateEntitlementDefinition: (key, updates) => {
        const data = exportPlaygroundData();
        if (data.entitlementDefinitions[key]) {
            Object.assign(data.entitlementDefinitions[key], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                entitlementDefinitions: get().entitlementDefinitions.map((e) =>
                    e.key === key ? { ...e, ...updates, updatedAt: new Date() } : e
                )
            });
        }
    },

    deleteEntitlementDefinition: (key) => {
        const data = exportPlaygroundData();
        delete data.entitlementDefinitions[key];
        // Also remove from plans that use this entitlement
        Object.values(data.plans).forEach((plan: QZPayPlan) => {
            if (plan.entitlements?.includes(key)) {
                plan.entitlements = plan.entitlements.filter((e) => e !== key);
            }
        });
        importPlaygroundData(data);
        set({
            entitlementDefinitions: get().entitlementDefinitions.filter((e) => e.key !== key),
            plans: get().plans.map((p) => ({
                ...p,
                entitlements: p.entitlements?.filter((e) => e !== key) ?? []
            }))
        });
    },

    // Limit definition actions
    addLimitDefinition: (input) => {
        const now = new Date();
        const limit: LimitDefinition = {
            key: input.key,
            name: input.name,
            description: input.description,
            unit: input.unit,
            defaultValue: input.defaultValue,
            createdAt: now,
            updatedAt: now
        };

        const data = exportPlaygroundData();
        data.limitDefinitions[limit.key] = limit;
        importPlaygroundData(data);

        set({ limitDefinitions: [...get().limitDefinitions, limit] });
        return limit;
    },

    updateLimitDefinition: (key, updates) => {
        const data = exportPlaygroundData();
        if (data.limitDefinitions[key]) {
            Object.assign(data.limitDefinitions[key], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                limitDefinitions: get().limitDefinitions.map((l) => (l.key === key ? { ...l, ...updates, updatedAt: new Date() } : l))
            });
        }
    },

    deleteLimitDefinition: (key) => {
        const data = exportPlaygroundData();
        delete data.limitDefinitions[key];
        // Also remove from plans that use this limit
        Object.values(data.plans).forEach((plan: QZPayPlan) => {
            if (plan.limits && key in plan.limits) {
                delete plan.limits[key];
            }
        });
        importPlaygroundData(data);
        set({
            limitDefinitions: get().limitDefinitions.filter((l) => l.key !== key),
            plans: get().plans.map((p) => {
                const newLimits = { ...p.limits };
                delete newLimits[key];
                return { ...p, limits: newLimits };
            })
        });
    },

    // Product actions
    addProduct: (input) => {
        const now = new Date();
        const product: ProductDefinition = {
            id: generateId('product'),
            name: input.name,
            description: input.description,
            unitAmount: input.unitAmount,
            currency: input.currency,
            active: input.active,
            metadata: input.metadata,
            createdAt: now,
            updatedAt: now
        };

        const data = exportPlaygroundData();
        if (!data.products) data.products = {};
        data.products[product.id] = product;
        importPlaygroundData(data);

        set({ products: [...get().products, product] });
        return product;
    },

    updateProduct: (id, updates) => {
        const data = exportPlaygroundData();
        if (data.products?.[id]) {
            Object.assign(data.products[id], updates, { updatedAt: new Date() });
            importPlaygroundData(data);
            set({
                products: get().products.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p))
            });
        }
    },

    deleteProduct: (id) => {
        const data = exportPlaygroundData();
        if (data.products) {
            delete data.products[id];
        }
        importPlaygroundData(data);
        set({ products: get().products.filter((p) => p.id !== id) });
    }
}));
