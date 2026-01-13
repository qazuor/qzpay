import type { QZPayCustomer, QZPayEntitlement, QZPayLimit, QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
/**
 * API/Developer Template
 *
 * Usage-based API pricing model with rate limits and webhook access.
 * Common for developer tools and API-first businesses.
 */
import type { SeedTemplate } from './index.js';

const now = new Date();

// Entitlement definitions
const entitlementDefinitions: Record<string, QZPayEntitlement> = {
    api_access: {
        id: 'ent_api_access',
        key: 'api_access',
        name: 'API Access',
        description: 'Basic API access',
        createdAt: now,
        updatedAt: now
    },
    webhooks: {
        id: 'ent_webhooks',
        key: 'webhooks',
        name: 'Webhooks',
        description: 'Real-time webhook notifications',
        createdAt: now,
        updatedAt: now
    },
    sdk_access: {
        id: 'ent_sdk_access',
        key: 'sdk_access',
        name: 'SDK Access',
        description: 'Access to official SDK libraries',
        createdAt: now,
        updatedAt: now
    },
    custom_domain: {
        id: 'ent_custom_domain',
        key: 'custom_domain',
        name: 'Custom Domain',
        description: 'Use your own domain for API calls',
        createdAt: now,
        updatedAt: now
    },
    sandbox_environment: {
        id: 'ent_sandbox',
        key: 'sandbox_environment',
        name: 'Sandbox Environment',
        description: 'Separate sandbox for testing',
        createdAt: now,
        updatedAt: now
    }
};

// Limit definitions
const limitDefinitions: Record<string, QZPayLimit> = {
    api_calls_monthly: {
        id: 'lim_api_calls',
        key: 'api_calls_monthly',
        name: 'API Calls (monthly)',
        description: 'Monthly API call limit',
        defaultValue: 1000,
        createdAt: now,
        updatedAt: now
    },
    rate_limit_per_min: {
        id: 'lim_rate_limit',
        key: 'rate_limit_per_min',
        name: 'Rate Limit (req/min)',
        description: 'Maximum requests per minute',
        defaultValue: 10,
        createdAt: now,
        updatedAt: now
    },
    webhook_endpoints: {
        id: 'lim_webhooks',
        key: 'webhook_endpoints',
        name: 'Webhook Endpoints',
        description: 'Number of webhook endpoint URLs',
        defaultValue: 1,
        createdAt: now,
        updatedAt: now
    }
};

// Plans
const plans: Record<string, QZPayPlan> = {
    plan_free: {
        id: 'plan_free',
        name: 'Free',
        description: 'For hobbyists and testing',
        active: true,
        prices: [],
        features: [
            { name: '1,000 API calls/month', included: true },
            { name: 'Rate limit: 10 req/min', included: true },
            { name: 'Community support', included: true }
        ],
        entitlements: ['api_access', 'sandbox_environment'],
        limits: {
            api_calls_monthly: 1000,
            rate_limit_per_min: 10,
            webhook_endpoints: 0
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    plan_developer: {
        id: 'plan_developer',
        name: 'Developer',
        description: 'For indie developers and small projects',
        active: true,
        prices: [],
        features: [
            { name: '50,000 API calls/month', included: true },
            { name: 'Rate limit: 100 req/min', included: true },
            { name: 'Email support', included: true },
            { name: 'Webhooks', included: true }
        ],
        entitlements: ['api_access', 'webhooks', 'sandbox_environment'],
        limits: {
            api_calls_monthly: 50000,
            rate_limit_per_min: 100,
            webhook_endpoints: 3
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    plan_business: {
        id: 'plan_business',
        name: 'Business',
        description: 'For production applications',
        active: true,
        prices: [],
        features: [
            { name: '500,000 API calls/month', included: true },
            { name: 'Rate limit: 1000 req/min', included: true },
            { name: 'Priority support', included: true },
            { name: 'Webhooks & SDK', included: true },
            { name: 'Custom domain', included: true }
        ],
        entitlements: ['api_access', 'webhooks', 'sdk_access', 'custom_domain', 'sandbox_environment'],
        limits: {
            api_calls_monthly: 500000,
            rate_limit_per_min: 1000,
            webhook_endpoints: -1
        },
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

// Prices
const prices: Record<string, QZPayPrice> = {
    price_free: {
        id: 'price_free',
        planId: 'plan_free',
        nickname: 'Free',
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
    price_developer_monthly: {
        id: 'price_developer_monthly',
        planId: 'plan_developer',
        nickname: 'Developer Monthly',
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
    price_business_monthly: {
        id: 'price_business_monthly',
        planId: 'plan_business',
        nickname: 'Business Monthly',
        unitAmount: 14900,
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
    cus_alice: {
        id: 'cus_alice',
        externalId: 'dev_alice_dev',
        email: 'alice@indiehacker.dev',
        name: 'Alice Developer',
        phone: null,
        providerCustomerIds: {},
        metadata: { github: 'alicedev', plan: 'hobby' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_techstartup: {
        id: 'cus_techstartup',
        externalId: 'dev_tech_startup',
        email: 'api@techstartup.com',
        name: 'Tech Startup Inc',
        phone: '+1-555-0200',
        providerCustomerIds: {},
        metadata: { type: 'startup', employees: 15 },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    },
    cus_bigcorp: {
        id: 'cus_bigcorp',
        externalId: 'dev_enterprise_corp',
        email: 'devops@bigcorp.com',
        name: 'BigCorp Engineering',
        phone: '+1-555-0201',
        providerCustomerIds: {},
        metadata: { type: 'enterprise', department: 'engineering' },
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    }
};

export const apiTemplate: SeedTemplate = {
    id: 'api',
    name: 'API/Developer',
    description: 'Usage-based API pricing model with rate limits',
    data: {
        entitlementDefinitions,
        limitDefinitions,
        plans,
        prices,
        customers
    }
};
