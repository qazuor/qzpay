/**
 * Plans Generator
 *
 * Generates the `plans.ts` file that creates subscription plans,
 * prices, add-ons, and services in the payment provider.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase, toScreamingSnake } from '../utils/template.js';

/**
 * Generate `plans.ts` file content for plan initialization.
 *
 * Creates a script that when executed will:
 * - Create subscription plans for each tier
 * - Create monthly and yearly prices for paid tiers
 * - Create add-on products and prices (if enabled)
 * - Create one-time service products (if enabled)
 * - Export helper functions to retrieve price IDs
 *
 * The generated file should be run once after setup:
 * `npx tsx plans.ts`
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for plan initialization
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: true, usageBased: false, marketplace: false, addons: true },
 *   plans: { tiers: [
 *     { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
 *     { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 }
 *   ]}
 * };
 *
 * const content = generatePlans(config);
 * // Returns initialization script with plan creation code
 * ```
 */
export function generatePlans(config: InitConfig): string {
    const name = config.project.name;
    const pascal = toPascalCase(name);
    const screaming = toScreamingSnake(name);
    const tiers = config.plans.tiers;

    let content = `/**
 * ${pascal} - Plan Initialization
 *
 * Run this file to create plans in your payment provider:
 *   npx tsx plans.ts
 */
import { billing } from './qzpay.config.js';
import { ${screaming}_PRICING } from './types.js';

// Plan IDs (populated after initialization)
export const planIds: Record<string, string> = {};
export const priceIds: Record<string, { monthly?: string; yearly?: string }> = {};
`;

    if (config.features.addons) {
        content += `export const addOnPlanIds: Record<string, string> = {};
export const addOnPriceIds: Record<string, string> = {};
`;
    }

    if (config.features.oneTime) {
        content += `export const servicePlanIds: Record<string, string> = {};
export const servicePriceIds: Record<string, string> = {};
`;
    }

    content += `
/**
 * Initialize all plans in the billing system
 */
export async function initialize${pascal}Plans(): Promise<void> {
    console.log('Initializing ${pascal} plans...');

    // Create main subscription plans
${tiers.map((t) => generatePlanCreation(t, pascal, screaming)).join('\n\n')}
`;

    if (config.features.addons) {
        content += `
    // Create add-on plans
    console.log('Creating add-on plans...');

    for (const [addOnKey, price] of Object.entries(${screaming}_PRICING.addOns)) {
        const addOn = await billing.plans.create({
            name: addOnKey.replace('addon_', '').replace(/_/g, ' '),
            description: \`${pascal} add-on: \${addOnKey}\`,
            metadata: { type: 'addon', key: addOnKey }
        });
        addOnPlanIds[addOnKey] = addOn.id;

        const addOnPrice = await billing.prices.create({
            planId: addOn.id,
            unitAmount: price,
            currency: 'USD',
            billingInterval: 'month',
            metadata: { addOn: addOnKey }
        });
        addOnPriceIds[addOnKey] = addOnPrice.id;

        console.log(\`  Add-on \${addOnKey}: plan=\${addOn.id}, price=\${addOnPrice.id}\`);
    }
`;
    }

    if (config.features.oneTime) {
        content += `
    // Create one-time service products
    console.log('Creating service products...');

    for (const [serviceKey, price] of Object.entries(${screaming}_PRICING.services)) {
        const service = await billing.plans.create({
            name: serviceKey.replace('service_', '').replace(/_/g, ' '),
            description: \`${pascal} service: \${serviceKey}\`,
            metadata: { type: 'service', key: serviceKey }
        });
        servicePlanIds[serviceKey] = service.id;

        // One-time prices have no interval
        const servicePrice = await billing.prices.create({
            planId: service.id,
            unitAmount: price,
            currency: 'USD',
            metadata: { service: serviceKey, oneTime: true }
        });
        servicePriceIds[serviceKey] = servicePrice.id;

        console.log(\`  Service \${serviceKey}: plan=\${service.id}, price=\${servicePrice.id}\`);
    }
`;
    }

    content += `
    console.log('\\n${pascal} plans initialized successfully!');
    console.log('\\nPlan IDs:', planIds);
    console.log('Price IDs:', priceIds);
}

// Helper functions
export function getPriceId(tier: string, interval: 'monthly' | 'yearly'): string | undefined {
    return priceIds[tier]?.[interval];
}
`;

    if (config.features.addons) {
        content += `
export function getAddOnPriceId(addOn: string): string | undefined {
    return addOnPriceIds[addOn];
}
`;
    }

    if (config.features.oneTime) {
        content += `
export function getServicePriceId(service: string): string | undefined {
    return servicePriceIds[service];
}
`;
    }

    content += `
// Run initialization when executed directly
initialize${pascal}Plans().catch(console.error);
`;

    return content;
}

/**
 * Generate plan and price creation code for a single tier.
 *
 * Creates code that:
 * - Creates a plan in the billing system
 * - Creates monthly price (if monthlyPrice > 0)
 * - Creates yearly price (if yearlyPrice > 0)
 *
 * @internal
 */
function generatePlanCreation(
    tier: { name: string; displayName: string; monthlyPrice: number; yearlyPrice: number },
    pascal: string,
    screaming: string
): string {
    return `    // ${tier.displayName} plan
    const ${tier.name}Plan = await billing.plans.create({
        name: '${tier.displayName}',
        description: '${pascal} ${tier.displayName} plan',
        metadata: { tier: '${tier.name}' }
    });
    planIds['${tier.name}'] = ${tier.name}Plan.id;
    priceIds['${tier.name}'] = {};

    ${
        tier.monthlyPrice > 0
            ? `const ${tier.name}Monthly = await billing.prices.create({
        planId: ${tier.name}Plan.id,
        unitAmount: ${screaming}_PRICING.plans.${tier.name}.monthly,
        currency: 'USD',
        billingInterval: 'month',
        metadata: { tier: '${tier.name}', interval: 'monthly' }
    });
    priceIds['${tier.name}'].monthly = ${tier.name}Monthly.id;`
            : '// Free tier - no monthly price'
    }

    ${
        tier.yearlyPrice > 0
            ? `const ${tier.name}Yearly = await billing.prices.create({
        planId: ${tier.name}Plan.id,
        unitAmount: ${screaming}_PRICING.plans.${tier.name}.yearly,
        currency: 'USD',
        billingInterval: 'year',
        metadata: { tier: '${tier.name}', interval: 'yearly' }
    });
    priceIds['${tier.name}'].yearly = ${tier.name}Yearly.id;`
            : '// Free tier - no yearly price'
    }

    console.log(\`  ${tier.displayName}: plan=\${${tier.name}Plan.id}\`);`;
}
