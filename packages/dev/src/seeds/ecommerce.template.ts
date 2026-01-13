import type { QZPayCustomer, QZPayEntitlement, QZPayLimit, QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
/**
 * E-commerce/Subscription Box Template
 *
 * Product subscription model with shipping entitlements.
 * Common for subscription boxes and recurring product deliveries.
 */
import type { SeedTemplate } from './index.js';

const now = new Date();

// Entitlement definitions
const entitlementDefinitions: Record<string, QZPayEntitlement> = {
    member_discounts: {
        id: 'ent_member_discounts',
        key: 'member_discounts',
        name: 'Member Discounts',
        description: 'Access to exclusive member discounts on individual products',
        createdAt: now,
        updatedAt: now
    },
    vip_discounts: {
        id: 'ent_vip_discounts',
        key: 'vip_discounts',
        name: 'VIP Discounts',
        description: 'Extra VIP-level discounts on top of member discounts',
        createdAt: now,
        updatedAt: now
    },
    early_access: {
        id: 'ent_early_access',
        key: 'early_access',
        name: 'Early Access',
        description: 'Early access to new products before general release',
        createdAt: now,
        updatedAt: now
    },
    free_shipping: {
        id: 'ent_free_shipping',
        key: 'free_shipping',
        name: 'Free Shipping',
        description: 'Free standard shipping on all orders',
        createdAt: now,
        updatedAt: now
    },
    express_shipping: {
        id: 'ent_express_shipping',
        key: 'express_shipping',
        name: 'Free Express Shipping',
        description: 'Free express shipping on all orders',
        createdAt: now,
        updatedAt: now
    },
    exclusive_items: {
        id: 'ent_exclusive_items',
        key: 'exclusive_items',
        name: 'Exclusive Items',
        description: 'Access to exclusive, limited-edition items',
        createdAt: now,
        updatedAt: now
    }
};

// Limit definitions
const limitDefinitions: Record<string, QZPayLimit> = {
    products_per_box: {
        id: 'lim_products_per_box',
        key: 'products_per_box',
        name: 'Products per Box',
        description: 'Number of products included in each box',
        defaultValue: 4,
        createdAt: now,
        updatedAt: now
    },
    store_discount_percent: {
        id: 'lim_store_discount',
        key: 'store_discount_percent',
        name: 'Store Discount (%)',
        description: 'Discount percentage on the online store',
        defaultValue: 10,
        createdAt: now,
        updatedAt: now
    }
};

// Plans
const plans: Record<string, QZPayPlan> = {
    plan_monthly_box: {
        id: 'plan_monthly_box',
        name: 'Monthly Box',
        description: 'Our curated monthly selection',
        active: true,
        prices: [],
        features: [
            { name: '4-6 products', included: true },
            { name: 'Free shipping', included: true },
            { name: 'Member discounts', included: true }
        ],
        entitlements: ['member_discounts', 'free_shipping'],
        limits: {
            products_per_box: 5,
            store_discount_percent: 10
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    plan_premium_box: {
        id: 'plan_premium_box',
        name: 'Premium Box',
        description: 'Premium selection with exclusive items',
        active: true,
        prices: [],
        features: [
            { name: '8-10 products', included: true },
            { name: 'Free express shipping', included: true },
            { name: 'Exclusive items', included: true },
            { name: 'Early access to new products', included: true },
            { name: 'VIP member discounts', included: true }
        ],
        entitlements: ['member_discounts', 'vip_discounts', 'early_access', 'express_shipping', 'exclusive_items'],
        limits: {
            products_per_box: 9,
            store_discount_percent: 25
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

// Prices
const prices: Record<string, QZPayPrice> = {
    price_monthly_box: {
        id: 'price_monthly_box',
        planId: 'plan_monthly_box',
        nickname: 'Monthly Box',
        unitAmount: 2900,
        currency: 'USD',
        billingInterval: 'month',
        intervalCount: 1,
        trialDays: null,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: now,
        updatedAt: now
    },
    price_premium_box: {
        id: 'price_premium_box',
        planId: 'plan_premium_box',
        nickname: 'Premium Box',
        unitAmount: 4900,
        currency: 'USD',
        billingInterval: 'month',
        intervalCount: 1,
        trialDays: null,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: now,
        updatedAt: now
    }
};

// Customers
const customers: Record<string, QZPayCustomer> = {
    cus_emily: {
        id: 'cus_emily',
        externalId: 'box_emily_r',
        email: 'emily.rodriguez@gmail.com',
        name: 'Emily Rodriguez',
        phone: '+1-555-0301',
        providerCustomerIds: {},
        metadata: { preferences: ['organic', 'vegan'], shirtSize: 'M' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_michael: {
        id: 'cus_michael',
        externalId: 'box_michael_c',
        email: 'mike.chen@yahoo.com',
        name: 'Michael Chen',
        phone: '+1-555-0302',
        providerCustomerIds: {},
        metadata: { preferences: ['tech', 'gadgets'], isGift: false },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_sarah: {
        id: 'cus_sarah',
        externalId: 'box_sarah_premium',
        email: 'sarah.premium@outlook.com',
        name: 'Sarah Premium',
        phone: '+1-555-0303',
        providerCustomerIds: {},
        metadata: { preferences: ['luxury', 'exclusive'], vip: true },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

export const ecommerceTemplate: SeedTemplate = {
    id: 'ecommerce',
    name: 'E-commerce/Subscription Box',
    description: 'Product subscription model with shipping entitlements',
    data: {
        entitlementDefinitions,
        limitDefinitions,
        plans,
        prices,
        customers
    }
};
