/**
 * Configuration Generator
 *
 * Generates the main `qzpay.config.ts` file that initializes the billing system
 * with database connections, payment provider adapters, and event listeners.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase } from '../utils/template.js';

/**
 * Generate the main QZPay configuration file content.
 *
 * Creates a complete `qzpay.config.ts` that includes:
 * - Database connection setup (Drizzle/PostgreSQL or in-memory)
 * - Payment provider initialization (Stripe and/or MercadoPago)
 * - Storage adapter configuration
 * - QZPayBilling instance creation
 * - Event listeners for billing events
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for qzpay.config.ts
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateConfig(config);
 * // Returns TypeScript code with Stripe + Drizzle setup
 * ```
 */
export function generateConfig(config: InitConfig): string {
    const imports = buildImports(config);
    const envVars = buildEnvVars(config);
    const adapters = buildAdapters(config);
    const billing = buildBilling(config);
    const events = buildEventListeners(config);

    return `/**
 * ${config.project.name} - QZPay Configuration
 * ${config.project.description || 'Billing system configuration'}
 */
${imports}

// Environment validation
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(\`Missing environment variable: \${name}\`);
    }
    return value;
}

${envVars}

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

${adapters}

${billing}

${events}

export default billing;
`;
}

/**
 * Build import statements based on selected providers and storage.
 * @internal
 */
function buildImports(config: InitConfig): string {
    const imports: string[] = ["import { QZPayBilling } from '@qazuor/qzpay-core';"];

    if (config.storage.type === 'drizzle') {
        imports.push("import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';");
        imports.push("import { drizzle } from 'drizzle-orm/postgres-js';");
        imports.push("import postgres from 'postgres';");
    }

    if (config.provider.stripe) {
        imports.push("import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';");
        imports.push("import Stripe from 'stripe';");
    }

    if (config.provider.mercadopago) {
        imports.push("import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';");
    }

    return imports.join('\n');
}

/**
 * Build environment variable declarations and client initializations.
 * @internal
 */
function buildEnvVars(config: InitConfig): string {
    const lines: string[] = [];

    if (config.storage.type === 'drizzle') {
        lines.push('// Database connection');
        lines.push("const databaseUrl = getEnvVar('DATABASE_URL');");
        lines.push('const client = postgres(databaseUrl);');
        lines.push('export const db = drizzle(client);');
    }

    if (config.provider.stripe) {
        lines.push('');
        lines.push('// Stripe client');
        lines.push("const stripeSecretKey = getEnvVar('STRIPE_SECRET_KEY');");
        lines.push(`export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia'
});`);
        lines.push("export const stripeWebhookSecret = getEnvVar('STRIPE_WEBHOOK_SECRET');");
    }

    if (config.provider.mercadopago) {
        lines.push('');
        lines.push('// MercadoPago credentials');
        lines.push("const mpAccessToken = getEnvVar('MERCADOPAGO_ACCESS_TOKEN');");
        lines.push("export const mpWebhookSecret = getEnvVar('MERCADOPAGO_WEBHOOK_SECRET');");
    }

    return lines.join('\n');
}

/**
 * Build adapter instantiation code for storage and payment providers.
 * @internal
 */
function buildAdapters(config: InitConfig): string {
    const lines: string[] = [];

    if (config.storage.type === 'drizzle') {
        lines.push('// Storage adapter');
        lines.push(`export const storageAdapter = new QZPayDrizzleStorageAdapter({
    db,
    livemode: isProduction
});`);
    } else {
        lines.push('// In-memory storage (development only)');
        lines.push('// TODO: Replace with a real storage adapter for production');
        lines.push('export const storageAdapter = createInMemoryStorage();');
    }

    if (config.provider.stripe) {
        lines.push('');
        lines.push('// Stripe adapter');
        lines.push(`export const stripeAdapter = new QZPayStripeAdapter({
    client: stripe,
    livemode: isProduction
});`);
    }

    if (config.provider.mercadopago) {
        lines.push('');
        lines.push('// MercadoPago adapter');
        lines.push(`export const mpAdapter = createQZPayMercadoPagoAdapter({
    accessToken: mpAccessToken,
    webhookSecret: mpWebhookSecret
});`);
    }

    return lines.join('\n');
}

/**
 * Build QZPayBilling instance creation code.
 * @internal
 */
function buildBilling(config: InitConfig): string {
    const primaryAdapter = config.provider.stripe ? 'stripeAdapter' : 'mpAdapter';

    return `// Initialize QZPay Billing
export const billing = new QZPayBilling({
    storage: storageAdapter,
    provider: ${primaryAdapter},
    livemode: isProduction
});`;
}

/**
 * Build event listener registrations for billing events.
 * @internal
 */
function buildEventListeners(config: InitConfig): string {
    const name = toPascalCase(config.project.name);

    let listeners = `
// Event listeners for ${name}-specific logic
billing.on('subscription.created', async (event) => {
    console.log(\`[${name}] New subscription: \${event.data.id}\`);
    // TODO: Update customer entitlements based on plan
});

billing.on('subscription.canceled', async (event) => {
    console.log(\`[${name}] Subscription canceled: \${event.data.id}\`);
    // TODO: Handle downgrade or cleanup logic
});

billing.on('payment.succeeded', async (event) => {
    console.log(\`[${name}] Payment succeeded: \${event.data.id}\`);
    // TODO: Trigger fulfillment if one-time payment
});

billing.on('payment.failed', async (event) => {
    console.log(\`[${name}] Payment failed: \${event.data.id}\`);
    // TODO: Send notification to customer
});`;

    if (config.features.usageBased) {
        listeners += `

billing.on('invoice.paid', async (event) => {
    console.log(\`[${name}] Invoice paid: \${event.data.id}\`);
    // TODO: Reset usage counters for new billing period
});`;
    }

    return listeners;
}
