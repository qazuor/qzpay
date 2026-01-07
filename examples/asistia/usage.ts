/**
 * Asistia - Usage Tracking and Overage Billing
 *
 * Tracks usage metrics and handles overage charges
 */
import billing from './config.js';
import {
    ASISTIA_PLAN_LIMITS,
    ASISTIA_PRICING,
    type AsistiaCustomer,
    type AsistiaPlanTier,
    type AsistiaUsageEvent,
    type AsistiaUsageMetric,
    type AsistiaUsageSummary
} from './types.js';

// In-memory usage cache (use Redis in production)
const usageCache = new Map<string, Map<AsistiaUsageMetric, number>>();

// ==================== Usage Recording ====================

/**
 * Record a usage event
 * Call this every time the customer uses a metered resource
 */
export async function recordUsage(event: AsistiaUsageEvent): Promise<{
    recorded: boolean;
    currentUsage: number;
    limit: number;
    isOverage: boolean;
}> {
    const { customerId, metric, amount } = event;

    // Get customer's plan limits
    const customer = await getCustomerWithUsage(customerId);
    if (!customer) {
        throw new Error('Customer not found');
    }

    const limits = ASISTIA_PLAN_LIMITS[customer.planTier];
    const limit = getMetricLimit(limits, metric);

    // Get current usage
    let currentUsage = await getCurrentUsage(customerId, metric);
    currentUsage += amount;

    // Store updated usage
    await storeUsage(customerId, metric, currentUsage);

    // Check if over limit
    const isOverage = limit !== -1 && currentUsage > limit;

    // Record in QZPay limits system
    await billing.limits.increment(customerId, `usage_${metric}`, amount);

    // If overage, queue for billing
    if (isOverage && limit !== -1) {
        const overageAmount = currentUsage - limit;
        await queueOverageCharge(customerId, metric, overageAmount);
    }

    return {
        recorded: true,
        currentUsage,
        limit,
        isOverage
    };
}

/**
 * Record message usage
 */
export async function recordMessageUsage(customerId: string, messageCount = 1): Promise<void> {
    await recordUsage({
        customerId,
        metric: 'messages',
        amount: messageCount,
        timestamp: new Date()
    });
}

/**
 * Record token usage
 */
export async function recordTokenUsage(customerId: string, tokenCount: number): Promise<void> {
    await recordUsage({
        customerId,
        metric: 'tokens',
        amount: tokenCount,
        timestamp: new Date()
    });
}

/**
 * Record API call usage
 */
export async function recordApiUsage(customerId: string): Promise<void> {
    await recordUsage({
        customerId,
        metric: 'api_calls',
        amount: 1,
        timestamp: new Date()
    });
}

// ==================== Usage Queries ====================

/**
 * Get current usage for a metric
 */
export async function getCurrentUsage(customerId: string, metric: AsistiaUsageMetric): Promise<number> {
    // Check cache first
    const customerCache = usageCache.get(customerId);
    if (customerCache?.has(metric)) {
        return customerCache.get(metric) || 0;
    }

    // Fetch from QZPay limits
    const limit = await billing.limits.get(customerId, `usage_${metric}`);
    return limit?.currentValue || 0;
}

/**
 * Get full usage summary for customer
 */
export async function getUsageSummary(customerId: string): Promise<AsistiaUsageSummary> {
    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new Error('Customer not found');
    }

    const tier = (customer.metadata?.planTier as AsistiaPlanTier) || 'starter';
    const limits = ASISTIA_PLAN_LIMITS[tier];

    // Get current subscription for billing period
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const activeSubscription = subscriptions.find((s) => s.status === 'active');

    const periodStart = activeSubscription?.currentPeriodStart || new Date();
    const periodEnd = activeSubscription?.currentPeriodEnd || new Date();

    // Get usage for each metric
    const [messagesUsed, tokensUsed] = await Promise.all([getCurrentUsage(customerId, 'messages'), getCurrentUsage(customerId, 'tokens')]);

    // Calculate overage
    const messagesLimit = limits.messagesPerMonth;
    const tokensLimit = limits.tokensPerMonth;

    return {
        messages: {
            used: messagesUsed,
            limit: messagesLimit,
            overage: messagesLimit === -1 ? 0 : Math.max(0, messagesUsed - messagesLimit)
        },
        tokens: {
            used: tokensUsed,
            limit: tokensLimit,
            overage: tokensLimit === -1 ? 0 : Math.max(0, tokensUsed - tokensLimit)
        },
        bots: {
            active: Number(customer.metadata?.activeBots) || 0,
            limit: limits.maxBots
        },
        integrations: {
            active: Number(customer.metadata?.activeIntegrations) || 0,
            limit: limits.maxIntegrations
        },
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd
    };
}

/**
 * Check if customer can use a resource
 */
export async function canUse(
    customerId: string,
    metric: AsistiaUsageMetric,
    amount = 1
): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
    const customer = await getCustomerWithUsage(customerId);
    if (!customer) {
        return { allowed: false, reason: 'Customer not found' };
    }

    const limits = ASISTIA_PLAN_LIMITS[customer.planTier];
    const limit = getMetricLimit(limits, metric);

    // Unlimited
    if (limit === -1) {
        return { allowed: true };
    }

    const currentUsage = await getCurrentUsage(customerId, metric);

    // Check if overage billing is enabled for this customer
    const allowOverage = customer.planTier !== 'starter'; // Starter can't go over

    if (currentUsage + amount > limit) {
        if (allowOverage) {
            return { allowed: true }; // Will be charged overage
        }
        return {
            allowed: false,
            reason: `${metric} limit reached (${currentUsage}/${limit})`,
            upgradeRequired: true
        };
    }

    return { allowed: true };
}

// ==================== Overage Billing ====================

// Pending overage charges (batch and bill at end of period)
const pendingOverage = new Map<string, Map<AsistiaUsageMetric, number>>();

/**
 * Queue overage charge for end-of-period billing
 */
async function queueOverageCharge(customerId: string, metric: AsistiaUsageMetric, amount: number): Promise<void> {
    if (!pendingOverage.has(customerId)) {
        pendingOverage.set(customerId, new Map());
    }

    const customerOverage = pendingOverage.get(customerId)!;
    const current = customerOverage.get(metric) || 0;
    customerOverage.set(metric, current + amount);

    console.log(`[Asistia] Queued overage for ${customerId}: ${amount} ${metric}`);
}

/**
 * Bill pending overage charges
 * Call this at the end of each billing period (via webhook or cron)
 */
export async function billPendingOverage(customerId: string): Promise<{ charged: boolean; total: number }> {
    const customerOverage = pendingOverage.get(customerId);
    if (!customerOverage || customerOverage.size === 0) {
        return { charged: false, total: 0 };
    }

    const lines: Array<{ description: string; quantity: number; unitAmount: number }> = [];

    // Messages overage
    const messagesOverage = customerOverage.get('messages') || 0;
    if (messagesOverage > 0) {
        lines.push({
            description: `Mensajes adicionales (${messagesOverage} mensajes)`,
            quantity: messagesOverage,
            unitAmount: ASISTIA_PRICING.overage.messagesPer
        });
    }

    // Tokens overage (billed per 1K)
    const tokensOverage = customerOverage.get('tokens') || 0;
    if (tokensOverage > 0) {
        const tokensIn1k = Math.ceil(tokensOverage / 1000);
        lines.push({
            description: `Tokens adicionales (${tokensOverage.toLocaleString()} tokens)`,
            quantity: tokensIn1k,
            unitAmount: ASISTIA_PRICING.overage.tokensPer1k
        });
    }

    if (lines.length === 0) {
        return { charged: false, total: 0 };
    }

    // Create invoice for overage
    const invoice = await billing.invoices.create({
        customerId,
        lines,
        metadata: { type: 'overage', period: new Date().toISOString().substring(0, 7) }
    });

    // Process payment
    await billing.payments.process({
        customerId,
        amount: invoice.total,
        currency: 'USD',
        description: 'Asistia - Cargos por uso adicional',
        metadata: { invoiceId: invoice.id, type: 'overage' }
    });

    // Clear pending overage
    pendingOverage.delete(customerId);

    console.log(`[Asistia] Billed overage for ${customerId}: $${(invoice.total / 100).toFixed(2)}`);

    return { charged: true, total: invoice.total };
}

/**
 * Reset usage counters (call at start of new billing period)
 */
export async function resetUsageCounters(customerId: string): Promise<void> {
    // Reset all usage limits
    const metrics: AsistiaUsageMetric[] = ['messages', 'tokens', 'sessions', 'api_calls'];

    for (const metric of metrics) {
        await billing.limits.reset(customerId, `usage_${metric}`);
    }

    // Clear cache
    usageCache.delete(customerId);

    console.log(`[Asistia] Reset usage counters for ${customerId}`);
}

// ==================== Helper Functions ====================

function getMetricLimit(limits: (typeof ASISTIA_PLAN_LIMITS)['starter'], metric: AsistiaUsageMetric): number {
    switch (metric) {
        case 'messages':
            return limits.messagesPerMonth;
        case 'tokens':
            return limits.tokensPerMonth;
        case 'api_calls':
            return limits.features.apiAccess ? -1 : 0;
        default:
            return -1;
    }
}

async function storeUsage(customerId: string, metric: AsistiaUsageMetric, value: number): Promise<void> {
    if (!usageCache.has(customerId)) {
        usageCache.set(customerId, new Map());
    }
    usageCache.get(customerId)?.set(metric, value);
}

async function getCustomerWithUsage(customerId: string): Promise<AsistiaCustomer | null> {
    const customer = await billing.customers.get(customerId);
    if (!customer) return null;

    const usage = await getUsageSummary(customerId);

    return {
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        organizationName: (customer.metadata?.organizationName as string) || '',
        planTier: (customer.metadata?.planTier as AsistiaPlanTier) || 'starter',
        activeAddOns: [],
        usage
    };
}
