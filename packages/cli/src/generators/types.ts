/**
 * Types Generator
 *
 * Generates the `types.ts` file with TypeScript type definitions for
 * plan tiers, customers, limits, pricing, and feature-specific types.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase, toScreamingSnake } from '../utils/template.js';

/**
 * Generate `types.ts` file content with TypeScript definitions.
 *
 * Creates comprehensive type definitions including:
 * - Plan tier union type (e.g., `'free' | 'pro' | 'enterprise'`)
 * - Tier display name constants
 * - Customer interface with plan and metadata
 * - Plan limits interface and constants
 * - Pricing constants in cents
 * - Add-on types (if enabled)
 * - Service types (if one-time payments enabled)
 * - Usage metric types (if usage-based billing enabled)
 * - Vendor interface (if marketplace enabled)
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript type definitions
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: true },
 *   plans: { tiers: [
 *     { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
 *     { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 }
 *   ]}
 * };
 *
 * const content = generateTypes(config);
 * // Returns: export type MyBillingPlanTier = 'free' | 'pro'; ...
 * ```
 */
export function generateTypes(config: InitConfig): string {
    const name = config.project.name;
    const pascal = toPascalCase(name);
    const screaming = toScreamingSnake(name);
    const tiers = config.plans.tiers;

    let content = `/**
 * ${pascal} - Type Definitions
 */

// Plan tiers
export type ${pascal}PlanTier = ${tiers.map((t) => `'${t.name}'`).join(' | ')};

// Plan tier display names
export const ${screaming}_TIER_NAMES: Record<${pascal}PlanTier, string> = {
${tiers.map((t) => `    ${t.name}: '${t.displayName}'`).join(',\n')}
};
`;

    if (config.features.addons) {
        content += `
// Add-ons
export type ${pascal}AddOn = 'addon_extra_users' | 'addon_priority_support' | 'addon_custom_branding';

export const ${screaming}_ADDON_NAMES: Record<${pascal}AddOn, string> = {
    addon_extra_users: 'Extra Users',
    addon_priority_support: 'Priority Support',
    addon_custom_branding: 'Custom Branding'
};
`;
    }

    if (config.features.oneTime) {
        content += `
// One-time services
export type ${pascal}Service = 'service_setup' | 'service_migration' | 'service_consultation';

export const ${screaming}_SERVICE_NAMES: Record<${pascal}Service, string> = {
    service_setup: 'Initial Setup',
    service_migration: 'Data Migration',
    service_consultation: 'Expert Consultation'
};
`;
    }

    content += `
// Customer with ${name}-specific metadata
export interface ${pascal}Customer {
    id: string;
    email: string;
    name: string;
    planTier: ${pascal}PlanTier;
    subscriptionId?: string;
${config.features.addons ? `    activeAddOns: ${pascal}AddOn[];` : ''}
    createdAt: Date;
    metadata?: Record<string, unknown>;
}

// Plan limits configuration
export interface ${pascal}PlanLimits {
    // Define your plan-specific limits
    maxItems: number;
    maxUsers: number;
    storageGb: number;
    apiRequestsPerMonth: number;
    features: {
        analytics: boolean;
        customBranding: boolean;
        prioritySupport: boolean;
        apiAccess: boolean;
    };
}

// Plan limits by tier
export const ${screaming}_PLAN_LIMITS: Record<${pascal}PlanTier, ${pascal}PlanLimits> = {
${tiers.map((t, i) => generateTierLimits(t.name, i, tiers.length)).join(',\n')}
};

// Pricing configuration (in cents)
export const ${screaming}_PRICING = {
    plans: {
${tiers.map((t) => `        ${t.name}: { monthly: ${t.monthlyPrice}, yearly: ${t.yearlyPrice} }`).join(',\n')}
    }${
        config.features.addons
            ? `,
    addOns: {
        addon_extra_users: 499,
        addon_priority_support: 1999,
        addon_custom_branding: 999
    }`
            : ''
    }${
        config.features.oneTime
            ? `,
    services: {
        service_setup: 9900,
        service_migration: 29900,
        service_consultation: 19900
    }`
            : ''
    }
} as const;
`;

    if (config.features.usageBased) {
        content += `
// Usage metrics
export type ${pascal}UsageMetric = 'api_calls' | 'storage_bytes' | 'active_users';

export interface ${pascal}UsageSummary {
    customerId: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    metrics: Record<${pascal}UsageMetric, {
        used: number;
        limit: number;
        overage: number;
    }>;
}
`;
    }

    if (config.features.marketplace) {
        content += `
// Marketplace vendor
export interface ${pascal}Vendor {
    id: string;
    email: string;
    name: string;
    stripeAccountId?: string;
    webhookSecret?: string;
    onboarded: boolean;
    createdAt: Date;
}
`;
    }

    return content;
}

/**
 * Generate limit values for a single plan tier.
 *
 * Automatically scales limits based on tier position:
 * - First tier (free): minimal limits
 * - Middle tiers: scaled limits
 * - Last tier (enterprise): unlimited (-1)
 *
 * @internal
 */
function generateTierLimits(tierName: string, index: number, total: number): string {
    const isEnterprise = tierName === 'enterprise' || index === total - 1;
    const isFree = tierName === 'free' || index === 0;

    const multiplier = index + 1;
    const maxItems = isEnterprise ? -1 : isFree ? 5 : 10 * multiplier;
    const maxUsers = isEnterprise ? -1 : isFree ? 1 : 5 * multiplier;
    const storageGb = isEnterprise ? -1 : isFree ? 1 : 10 * multiplier;
    const apiRequests = isEnterprise ? -1 : isFree ? 1000 : 10000 * multiplier;

    return `    ${tierName}: {
        maxItems: ${maxItems},
        maxUsers: ${maxUsers},
        storageGb: ${storageGb},
        apiRequestsPerMonth: ${apiRequests},
        features: {
            analytics: ${!isFree},
            customBranding: ${isEnterprise || index >= total - 2},
            prioritySupport: ${isEnterprise},
            apiAccess: ${!isFree}
        }
    }`;
}
