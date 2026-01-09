/**
 * Test fixtures - Mock configurations
 */
import type { FeaturesConfig, InitConfig, PlansConfig, ProviderConfig } from '../../src/types/config.js';

// Base features config
export const baseFeatures: FeaturesConfig = {
    subscriptions: true,
    oneTime: false,
    usageBased: false,
    marketplace: false,
    addons: false
};

// Full features config
export const fullFeatures: FeaturesConfig = {
    subscriptions: true,
    oneTime: true,
    usageBased: true,
    marketplace: true,
    addons: true
};

// Stripe-only provider
export const stripeProvider: ProviderConfig = {
    type: 'stripe',
    stripe: true,
    mercadopago: false
};

// MercadoPago-only provider
export const mercadopagoProvider: ProviderConfig = {
    type: 'mercadopago',
    stripe: false,
    mercadopago: true
};

// Both providers
export const bothProviders: ProviderConfig = {
    type: 'both',
    stripe: true,
    mercadopago: true
};

// Freemium plans
export const freemiumPlans: PlansConfig = {
    tiers: [
        { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
        { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 },
        { name: 'enterprise', displayName: 'Enterprise', monthlyPrice: 9999, yearlyPrice: 99990 }
    ]
};

// Tiered plans
export const tieredPlans: PlansConfig = {
    tiers: [
        { name: 'basic', displayName: 'Basic', monthlyPrice: 999, yearlyPrice: 9990 },
        { name: 'professional', displayName: 'Professional', monthlyPrice: 2999, yearlyPrice: 29990 },
        { name: 'agency', displayName: 'Agency', monthlyPrice: 9999, yearlyPrice: 99990 }
    ]
};

// Minimal config (Stripe + Hono + basic features)
export const minimalConfig: InitConfig = {
    project: {
        name: 'test-billing',
        outputDir: './test-output',
        description: 'Test billing system'
    },
    provider: stripeProvider,
    storage: { type: 'drizzle' },
    framework: { type: 'hono' },
    features: baseFeatures,
    plans: freemiumPlans
};

// Full config (both providers + all features)
export const fullConfig: InitConfig = {
    project: {
        name: 'full-billing',
        outputDir: './full-output',
        description: 'Full billing system with all features'
    },
    provider: bothProviders,
    storage: { type: 'drizzle' },
    framework: { type: 'hono' },
    features: fullFeatures,
    plans: tieredPlans
};

// NestJS config
export const nestjsConfig: InitConfig = {
    project: {
        name: 'nestjs-billing',
        outputDir: './nestjs-output',
        description: 'NestJS billing system'
    },
    provider: stripeProvider,
    storage: { type: 'drizzle' },
    framework: { type: 'nestjs' },
    features: baseFeatures,
    plans: freemiumPlans
};

// Library-only config (no framework)
export const libraryConfig: InitConfig = {
    project: {
        name: 'lib-billing',
        outputDir: './lib-output',
        description: 'Library-only billing'
    },
    provider: mercadopagoProvider,
    storage: { type: 'in-memory' },
    framework: { type: 'none' },
    features: baseFeatures,
    plans: freemiumPlans
};

// MercadoPago + NestJS config
export const mpNestjsConfig: InitConfig = {
    project: {
        name: 'mp-nestjs',
        outputDir: './mp-nestjs-output',
        description: 'MercadoPago NestJS billing'
    },
    provider: mercadopagoProvider,
    storage: { type: 'drizzle' },
    framework: { type: 'nestjs' },
    features: {
        ...baseFeatures,
        oneTime: true
    },
    plans: tieredPlans
};
