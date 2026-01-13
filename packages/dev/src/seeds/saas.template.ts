import type { QZPayCustomer, QZPayEntitlement, QZPayLimit, QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
/**
 * SaaS Basic Template
 *
 * Common B2B SaaS with Free, Pro, Enterprise tiers.
 * Includes entitlements, limits, and sample customers.
 */
import type { SeedTemplate } from './index.js';

const now = new Date();

// Entitlement definitions
const entitlementDefinitions: Record<string, QZPayEntitlement> = {
    api_access: {
        id: 'ent_api_access',
        key: 'api_access',
        name: 'API Access',
        description: 'Access to the REST API for integrations',
        createdAt: now,
        updatedAt: now
    },
    priority_support: {
        id: 'ent_priority_support',
        key: 'priority_support',
        name: 'Priority Support',
        description: '24/7 priority customer support',
        createdAt: now,
        updatedAt: now
    },
    advanced_analytics: {
        id: 'ent_advanced_analytics',
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Access to advanced analytics and reporting',
        createdAt: now,
        updatedAt: now
    },
    sso_saml: {
        id: 'ent_sso_saml',
        key: 'sso_saml',
        name: 'SSO & SAML',
        description: 'Single sign-on and SAML authentication',
        createdAt: now,
        updatedAt: now
    },
    custom_branding: {
        id: 'ent_custom_branding',
        key: 'custom_branding',
        name: 'Custom Branding',
        description: 'White-label and custom branding options',
        createdAt: now,
        updatedAt: now
    }
};

// Limit definitions
const limitDefinitions: Record<string, QZPayLimit> = {
    projects: {
        id: 'lim_projects',
        key: 'projects',
        name: 'Projects',
        description: 'Maximum number of projects',
        defaultValue: 1,
        createdAt: now,
        updatedAt: now
    },
    storage_gb: {
        id: 'lim_storage_gb',
        key: 'storage_gb',
        name: 'Storage (GB)',
        description: 'Storage space in gigabytes',
        defaultValue: 1,
        createdAt: now,
        updatedAt: now
    },
    team_members: {
        id: 'lim_team_members',
        key: 'team_members',
        name: 'Team Members',
        description: 'Maximum team members per workspace',
        defaultValue: 1,
        createdAt: now,
        updatedAt: now
    },
    api_calls_monthly: {
        id: 'lim_api_calls',
        key: 'api_calls_monthly',
        name: 'API Calls (monthly)',
        description: 'Monthly API call limit',
        defaultValue: 1000,
        createdAt: now,
        updatedAt: now
    }
};

// Plans
const plans: Record<string, QZPayPlan> = {
    plan_free: {
        id: 'plan_free',
        name: 'Free',
        description: 'Perfect for getting started',
        active: true,
        prices: [],
        features: [
            { name: '1 project', included: true },
            { name: '100 MB storage', included: true },
            { name: 'Community support', included: true },
            { name: 'Basic analytics', included: true }
        ],
        entitlements: [],
        limits: {
            projects: 1,
            storage_gb: 0.1,
            team_members: 1,
            api_calls_monthly: 0
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    plan_pro: {
        id: 'plan_pro',
        name: 'Pro',
        description: 'For growing teams',
        active: true,
        prices: [],
        features: [
            { name: 'Unlimited projects', included: true },
            { name: '10 GB storage', included: true },
            { name: 'Priority support', included: true },
            { name: 'Advanced analytics', included: true },
            { name: 'API access', included: true }
        ],
        entitlements: ['api_access', 'priority_support', 'advanced_analytics'],
        limits: {
            projects: -1,
            storage_gb: 10,
            team_members: 10,
            api_calls_monthly: 50000
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    plan_enterprise: {
        id: 'plan_enterprise',
        name: 'Enterprise',
        description: 'For large organizations',
        active: true,
        prices: [],
        features: [
            { name: 'Unlimited everything', included: true },
            { name: 'Dedicated support', included: true },
            { name: 'Custom analytics', included: true },
            { name: 'SSO & SAML', included: true },
            { name: 'SLA guarantee', included: true }
        ],
        entitlements: ['api_access', 'priority_support', 'advanced_analytics', 'sso_saml', 'custom_branding'],
        limits: {
            projects: -1,
            storage_gb: -1,
            team_members: -1,
            api_calls_monthly: -1
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

// Prices
const prices: Record<string, QZPayPrice> = {
    price_free_monthly: {
        id: 'price_free_monthly',
        planId: 'plan_free',
        nickname: 'Free Monthly',
        unitAmount: 0,
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
    price_pro_monthly: {
        id: 'price_pro_monthly',
        planId: 'plan_pro',
        nickname: 'Pro Monthly',
        unitAmount: 1900,
        currency: 'USD',
        billingInterval: 'month',
        intervalCount: 1,
        trialDays: 14,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: now,
        updatedAt: now
    },
    price_pro_yearly: {
        id: 'price_pro_yearly',
        planId: 'plan_pro',
        nickname: 'Pro Yearly',
        unitAmount: 19000,
        currency: 'USD',
        billingInterval: 'year',
        intervalCount: 1,
        trialDays: 14,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: now,
        updatedAt: now
    },
    price_enterprise_monthly: {
        id: 'price_enterprise_monthly',
        planId: 'plan_enterprise',
        nickname: 'Enterprise Monthly',
        unitAmount: 9900,
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
    price_enterprise_yearly: {
        id: 'price_enterprise_yearly',
        planId: 'plan_enterprise',
        nickname: 'Enterprise Yearly',
        unitAmount: 99000,
        currency: 'USD',
        billingInterval: 'year',
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
    cus_john: {
        id: 'cus_john',
        externalId: 'user_john_doe',
        email: 'john.doe@example.com',
        name: 'John Doe',
        phone: '+1-555-0101',
        providerCustomerIds: {},
        metadata: { company: 'Acme Corp', role: 'CEO' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_jane: {
        id: 'cus_jane',
        externalId: 'user_jane_smith',
        email: 'jane.smith@startup.io',
        name: 'Jane Smith',
        phone: '+1-555-0102',
        providerCustomerIds: {},
        metadata: { company: 'StartupIO', role: 'CTO' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_bob: {
        id: 'cus_bob',
        externalId: 'user_bob_wilson',
        email: 'bob@freelancer.com',
        name: 'Bob Wilson',
        phone: null,
        providerCustomerIds: {},
        metadata: { type: 'freelancer' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

export const saasTemplate: SeedTemplate = {
    id: 'saas',
    name: 'SaaS Basic',
    description: 'Common B2B SaaS with Free, Pro, Enterprise tiers',
    data: {
        entitlementDefinitions,
        limitDefinitions,
        plans,
        prices,
        customers
    }
};
