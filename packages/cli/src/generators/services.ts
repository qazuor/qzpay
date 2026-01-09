/**
 * Services Generator
 *
 * Generates the `services.ts` file with business logic functions for
 * customer management, subscriptions, payments, and feature-specific operations.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase, toScreamingSnake } from '../utils/template.js';

/**
 * Generate `services.ts` file content with business logic.
 *
 * Creates service functions organized by domain:
 * - **Customer Management**: register, get, limits
 * - **Subscription Management**: subscribe, change plan, cancel
 * - **Add-on Management** (if enabled): add, remove add-ons
 * - **One-time Purchases** (if enabled): purchase services
 * - **Usage Tracking** (if enabled): track, check limits, summaries
 * - **Payment Management**: history, invoices
 *
 * All functions are async and use the billing instance from config.
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code with service functions
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: true, marketplace: false, addons: false },
 *   plans: { tiers: [{ name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 }] }
 * };
 *
 * const content = generateServices(config);
 * // Returns services with subscription + usage tracking functions
 * ```
 */
export function generateServices(config: InitConfig): string {
    const name = config.project.name;
    const pascal = toPascalCase(name);
    const screaming = toScreamingSnake(name);

    let imports = `/**
 * ${pascal} - Business Logic Services
 */
import { billing } from './qzpay.config.js';
import type { ${pascal}Customer, ${pascal}PlanTier, ${pascal}PlanLimits } from './types.js';
import { ${screaming}_PLAN_LIMITS } from './types.js';
import { getPriceId`;

    if (config.features.addons) {
        imports += ', getAddOnPriceId';
    }
    if (config.features.oneTime) {
        imports += ', getServicePriceId';
    }

    imports += ` } from './plans.js';
`;

    let content = `${imports}
// ============================================================================
// Customer Management
// ============================================================================

/**
 * Register a new customer
 */
export async function registerCustomer(data: {
    email: string;
    name: string;
    planTier?: ${pascal}PlanTier;
}): Promise<${pascal}Customer> {
    const customer = await billing.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
            planTier: data.planTier || '${config.plans.tiers[0]?.name || 'free'}',
            registeredAt: new Date().toISOString()
        }
    });

    return {
        id: customer.id,
        email: customer.email,
        name: customer.name || data.name,
        planTier: (customer.metadata?.planTier as ${pascal}PlanTier) || '${config.plans.tiers[0]?.name || 'free'}',
${config.features.addons ? '        activeAddOns: [],\n' : ''}        createdAt: customer.createdAt || new Date(),
        metadata: customer.metadata
    };
}

/**
 * Get customer by ID with enriched data
 */
export async function getCustomer(customerId: string): Promise<${pascal}Customer | null> {
    const customer = await billing.customers.get(customerId);
    if (!customer) return null;

    const subscriptions = await billing.subscriptions.list({ customerId });
    const activeSubscription = subscriptions.find((s) => s.status === 'active');

    return {
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        planTier: (customer.metadata?.planTier as ${pascal}PlanTier) || '${config.plans.tiers[0]?.name || 'free'}',
        subscriptionId: activeSubscription?.id,
${config.features.addons ? '        activeAddOns: (customer.metadata?.activeAddOns as string[]) || [],\n' : ''}        createdAt: customer.createdAt || new Date(),
        metadata: customer.metadata
    };
}

/**
 * Get plan limits for a customer
 */
export function getCustomerLimits(planTier: ${pascal}PlanTier): ${pascal}PlanLimits {
    return ${screaming}_PLAN_LIMITS[planTier];
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Subscribe customer to a plan
 */
export async function subscribeToPlan(
    customerId: string,
    planTier: ${pascal}PlanTier,
    interval: 'monthly' | 'yearly' = 'monthly'
): Promise<{ subscriptionId: string; checkoutUrl?: string }> {
    const priceId = getPriceId(planTier, interval);
    if (!priceId) {
        throw new Error(\`No price found for tier \${planTier} with interval \${interval}\`);
    }

    // Create checkout session for the subscription
    const checkout = await billing.checkout.createSession({
        customerId,
        priceId,
        mode: 'subscription',
        successUrl: \`\${process.env.APP_URL || 'http://localhost:3000'}/billing/success\`,
        cancelUrl: \`\${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel\`
    });

    return {
        subscriptionId: checkout.subscriptionId || '',
        checkoutUrl: checkout.url
    };
}

/**
 * Change customer's plan tier
 */
export async function changePlan(
    customerId: string,
    newTier: ${pascal}PlanTier,
    interval: 'monthly' | 'yearly' = 'monthly'
): Promise<void> {
    const customer = await getCustomer(customerId);
    if (!customer?.subscriptionId) {
        throw new Error('Customer has no active subscription');
    }

    const newPriceId = getPriceId(newTier, interval);
    if (!newPriceId) {
        throw new Error(\`No price found for tier \${newTier}\`);
    }

    await billing.subscriptions.changePlan(customer.subscriptionId, newPriceId);

    // Update customer metadata
    await billing.customers.update(customerId, {
        metadata: { ...customer.metadata, planTier: newTier }
    });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
    customerId: string,
    immediately = false
): Promise<void> {
    const customer = await getCustomer(customerId);
    if (!customer?.subscriptionId) {
        throw new Error('Customer has no active subscription');
    }

    await billing.subscriptions.cancel(customer.subscriptionId, {
        cancelAtPeriodEnd: !immediately
    });
}
`;

    if (config.features.addons) {
        content += `
// ============================================================================
// Add-on Management
// ============================================================================

/**
 * Add an add-on to customer's subscription
 */
export async function addAddOn(
    customerId: string,
    addOnKey: string
): Promise<void> {
    const customer = await getCustomer(customerId);
    if (!customer?.subscriptionId) {
        throw new Error('Customer has no active subscription');
    }

    const addOnPriceId = getAddOnPriceId(addOnKey);
    if (!addOnPriceId) {
        throw new Error(\`Add-on not found: \${addOnKey}\`);
    }

    await billing.addons.addToSubscription(customer.subscriptionId, addOnPriceId);

    // Update customer metadata
    const activeAddOns = [...(customer.activeAddOns || [])];
    if (!activeAddOns.includes(addOnKey)) {
        activeAddOns.push(addOnKey);
        await billing.customers.update(customerId, {
            metadata: { ...customer.metadata, activeAddOns }
        });
    }
}

/**
 * Remove an add-on from customer's subscription
 */
export async function removeAddOn(
    customerId: string,
    addOnKey: string
): Promise<void> {
    const customer = await getCustomer(customerId);
    if (!customer?.subscriptionId) {
        throw new Error('Customer has no active subscription');
    }

    const addOnPriceId = getAddOnPriceId(addOnKey);
    if (!addOnPriceId) {
        throw new Error(\`Add-on not found: \${addOnKey}\`);
    }

    await billing.addons.removeFromSubscription(customer.subscriptionId, addOnPriceId);

    // Update customer metadata
    const activeAddOns = (customer.activeAddOns || []).filter((a) => a !== addOnKey);
    await billing.customers.update(customerId, {
        metadata: { ...customer.metadata, activeAddOns }
    });
}
`;
    }

    if (config.features.oneTime) {
        content += `
// ============================================================================
// One-time Purchases
// ============================================================================

/**
 * Purchase a one-time service
 */
export async function purchaseService(
    customerId: string,
    serviceKey: string
): Promise<{ paymentId: string; checkoutUrl?: string }> {
    const servicePriceId = getServicePriceId(serviceKey);
    if (!servicePriceId) {
        throw new Error(\`Service not found: \${serviceKey}\`);
    }

    const checkout = await billing.checkout.createSession({
        customerId,
        priceId: servicePriceId,
        mode: 'payment',
        successUrl: \`\${process.env.APP_URL || 'http://localhost:3000'}/billing/success\`,
        cancelUrl: \`\${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel\`
    });

    return {
        paymentId: checkout.paymentId || '',
        checkoutUrl: checkout.url
    };
}
`;
    }

    if (config.features.usageBased) {
        content += `
// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Track usage for a customer
 */
export async function trackUsage(
    customerId: string,
    metric: string,
    quantity: number
): Promise<void> {
    await billing.limits.recordUsage(customerId, metric, quantity);
}

/**
 * Check if customer has exceeded their usage limit
 */
export async function checkUsageLimit(
    customerId: string,
    metric: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
    const result = await billing.limits.check(customerId, metric);
    return {
        allowed: result.allowed,
        used: result.used || 0,
        limit: result.limit || 0
    };
}

/**
 * Get usage summary for a customer
 */
export async function getUsageSummary(customerId: string): Promise<Record<string, { used: number; limit: number }>> {
    const limits = await billing.limits.getByCustomerId(customerId);
    const summary: Record<string, { used: number; limit: number }> = {};

    for (const limit of limits) {
        summary[limit.metric] = {
            used: limit.used || 0,
            limit: limit.limit || 0
        };
    }

    return summary;
}
`;
    }

    // Always add payment management
    content += `
// ============================================================================
// Payment Management
// ============================================================================

/**
 * Get payment history for a customer
 */
export async function getPaymentHistory(customerId: string): Promise<Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
}>> {
    const payments = await billing.payments.list({ customerId });
    return payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt || new Date()
    }));
}

/**
 * Get invoices for a customer
 */
export async function getInvoices(customerId: string): Promise<Array<{
    id: string;
    amount: number;
    status: string;
    dueDate?: Date;
    paidAt?: Date;
}>> {
    const invoices = await billing.invoices.list({ customerId });
    return invoices.map((i) => ({
        id: i.id,
        amount: i.total || 0,
        status: i.status,
        dueDate: i.dueDate,
        paidAt: i.paidAt
    }));
}
`;

    return content;
}
