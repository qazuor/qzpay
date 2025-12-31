/**
 * Plan test fixtures
 */
import type { QZPayPlan, QZPayPrice } from '../../src/types/plan.types.js';

/**
 * Sample prices
 */
export const monthlyPriceUSD: QZPayPrice = {
    id: 'price_monthly_usd',
    amount: 999, // $9.99
    currency: 'USD',
    interval: 'month',
    intervalCount: 1,
    active: true
};

export const yearlyPriceUSD: QZPayPrice = {
    id: 'price_yearly_usd',
    amount: 9900, // $99.00 (save ~17%)
    currency: 'USD',
    interval: 'year',
    intervalCount: 1,
    active: true
};

export const monthlyPriceEUR: QZPayPrice = {
    id: 'price_monthly_eur',
    amount: 899,
    currency: 'EUR',
    interval: 'month',
    intervalCount: 1,
    active: true
};

/**
 * Sample plans
 */
export const freePlan: QZPayPlan = {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    active: true,
    prices: [],
    features: ['Up to 100 items', 'Basic support', 'Community access'],
    metadata: {
        tier: 'free',
        trialDays: 0
    }
};

export const starterPlan: QZPayPlan = {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals',
    active: true,
    prices: [monthlyPriceUSD, yearlyPriceUSD],
    features: ['Up to 1,000 items', 'Email support', 'API access'],
    limits: {
        items: 1000,
        apiCalls: 10000
    },
    metadata: {
        tier: 'starter',
        trialDays: 14
    }
};

export const proPlan: QZPayPlan = {
    id: 'pro',
    name: 'Professional',
    description: 'For growing teams',
    active: true,
    prices: [
        { ...monthlyPriceUSD, id: 'price_pro_monthly', amount: 2999 },
        { ...yearlyPriceUSD, id: 'price_pro_yearly', amount: 29900 }
    ],
    features: ['Unlimited items', 'Priority support', 'Advanced API access', 'Team collaboration'],
    limits: {
        items: -1, // unlimited
        apiCalls: 100000,
        teamMembers: 10
    },
    metadata: {
        tier: 'pro',
        trialDays: 14
    }
};

export const enterprisePlan: QZPayPlan = {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    active: true,
    prices: [], // Custom pricing
    features: ['Everything in Pro', 'Dedicated support', 'SLA guarantee', 'Custom integrations', 'On-premise option'],
    limits: {
        items: -1,
        apiCalls: -1,
        teamMembers: -1
    },
    metadata: {
        tier: 'enterprise',
        trialDays: 30,
        contactSales: true
    }
};

/**
 * All sample plans
 */
export const allPlans: QZPayPlan[] = [freePlan, starterPlan, proPlan, enterprisePlan];

/**
 * Active paid plans only
 */
export const paidPlans: QZPayPlan[] = [starterPlan, proPlan, enterprisePlan];

/**
 * Create a plan with custom overrides
 */
export function createPlanFixture(overrides?: Partial<QZPayPlan>): QZPayPlan {
    return {
        ...starterPlan,
        id: `plan_test_${Date.now()}`,
        ...overrides
    };
}

/**
 * Create a price with custom overrides
 */
export function createPriceFixture(overrides?: Partial<QZPayPrice>): QZPayPrice {
    return {
        ...monthlyPriceUSD,
        id: `price_test_${Date.now()}`,
        ...overrides
    };
}
