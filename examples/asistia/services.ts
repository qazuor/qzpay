/**
 * Asistia - Business Logic Services
 */
import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import billing from './config.js';
import { getAddOnPriceId, getPriceId, getServicePriceId, planIds } from './plans.js';
import {
    ASISTIA_PLAN_LIMITS,
    type AsistiaAddOn,
    type AsistiaCustomer,
    type AsistiaPlanLimits,
    type AsistiaPlanTier,
    type AsistiaService
} from './types.js';
import { getUsageSummary, resetUsageCounters } from './usage.js';

// ==================== Customer Management ====================

/**
 * Register a new organization
 */
export async function registerOrganization(data: {
    email: string;
    name: string;
    organizationName: string;
    planTier?: AsistiaPlanTier;
    billingCycle?: 'monthly' | 'yearly';
}): Promise<{ customer: QZPayCustomer; subscription?: QZPaySubscription }> {
    const customer = await billing.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
            organizationName: data.organizationName,
            planTier: data.planTier || 'starter',
            activeBots: '0',
            activeIntegrations: '0'
        }
    });

    // Initialize usage limits
    const tier = data.planTier || 'starter';
    const limits = ASISTIA_PLAN_LIMITS[tier];

    await billing.limits.set({
        customerId: customer.id,
        limitKey: 'usage_messages',
        maxValue: limits.messagesPerMonth,
        source: 'plan'
    });

    await billing.limits.set({
        customerId: customer.id,
        limitKey: 'usage_tokens',
        maxValue: limits.tokensPerMonth,
        source: 'plan'
    });

    let subscription: QZPaySubscription | undefined;

    if (data.planTier && data.planTier !== 'enterprise') {
        const priceId = getPriceId(data.planTier, data.billingCycle || 'monthly');
        subscription = await billing.subscriptions.create({
            customerId: customer.id,
            planId: planIds[data.planTier],
            priceId,
            metadata: { tier: data.planTier, billingCycle: data.billingCycle || 'monthly' }
        });
    }

    return { customer, subscription };
}

/**
 * Get organization details
 */
export async function getOrganization(customerId: string): Promise<AsistiaCustomer | null> {
    const customer = await billing.customers.get(customerId);
    if (!customer) return null;

    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const activeSubscription = subscriptions.find((s) => s.status === 'active' || s.status === 'trialing');

    const addOnSubscriptions = subscriptions.filter(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type === 'addon'
    );

    const usage = await getUsageSummary(customerId);

    return {
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        organizationName: (customer.metadata?.organizationName as string) || '',
        planTier: (activeSubscription?.metadata?.tier as AsistiaPlanTier) || 'starter',
        activeAddOns: addOnSubscriptions.map((s) => s.metadata?.addonKey as AsistiaAddOn).filter(Boolean),
        usage
    };
}

// ==================== Plan Management ====================

/**
 * Change subscription plan
 */
export async function changePlan(
    customerId: string,
    newTier: AsistiaPlanTier,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<QZPaySubscription> {
    if (newTier === 'enterprise') {
        throw new Error('Enterprise plan requires custom setup. Contact sales.');
    }

    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const currentSubscription = subscriptions.find(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type !== 'addon'
    );

    const newPriceId = getPriceId(newTier, billingCycle);
    const newLimits = ASISTIA_PLAN_LIMITS[newTier];

    // Update limits
    await billing.limits.set({
        customerId,
        limitKey: 'usage_messages',
        maxValue: newLimits.messagesPerMonth,
        source: 'plan'
    });

    await billing.limits.set({
        customerId,
        limitKey: 'usage_tokens',
        maxValue: newLimits.tokensPerMonth,
        source: 'plan'
    });

    // Update customer metadata
    await billing.customers.update(customerId, {
        metadata: { planTier: newTier }
    });

    if (currentSubscription) {
        return billing.subscriptions.update(currentSubscription.id, {
            priceId: newPriceId,
            metadata: { tier: newTier, billingCycle }
        });
    }

    return billing.subscriptions.create({
        customerId,
        planId: planIds[newTier],
        priceId: newPriceId,
        metadata: { tier: newTier, billingCycle }
    });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(customerId: string, cancelAtPeriodEnd = true): Promise<void> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const activeSubscription = subscriptions.find(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type !== 'addon'
    );

    if (activeSubscription) {
        await billing.subscriptions.cancel(activeSubscription.id, { cancelAtPeriodEnd });
    }
}

/**
 * Get plan limits for customer (including add-on bonuses)
 */
export async function getPlanLimits(customerId: string): Promise<AsistiaPlanLimits> {
    const org = await getOrganization(customerId);
    if (!org) {
        return ASISTIA_PLAN_LIMITS.starter;
    }

    const baseLimits = { ...ASISTIA_PLAN_LIMITS[org.planTier] };

    // Apply add-on bonuses
    if (org.activeAddOns.includes('analytics_pro')) {
        baseLimits.features.analytics = 'advanced';
    }
    if (org.activeAddOns.includes('api_access')) {
        baseLimits.features.apiAccess = true;
    }
    if (org.activeAddOns.includes('white_label')) {
        baseLimits.features.customBranding = true;
    }
    if (org.activeAddOns.includes('priority_support')) {
        baseLimits.features.support = 'priority';
    }

    return baseLimits;
}

// ==================== Add-on Management ====================

/**
 * Subscribe to add-on
 */
export async function subscribeToAddOn(customerId: string, addOn: AsistiaAddOn): Promise<QZPaySubscription> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const existing = subscriptions.find((s) => s.metadata?.addonKey === addOn && s.status === 'active');

    if (existing) {
        throw new Error(`Already subscribed to ${addOn}`);
    }

    const priceId = getAddOnPriceId(addOn);

    return billing.subscriptions.create({
        customerId,
        planId: '',
        priceId,
        metadata: { type: 'addon', addonKey: addOn }
    });
}

/**
 * Cancel add-on
 */
export async function cancelAddOn(customerId: string, addOn: AsistiaAddOn): Promise<void> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const addOnSubscription = subscriptions.find((s) => s.metadata?.addonKey === addOn && s.status === 'active');

    if (addOnSubscription) {
        await billing.subscriptions.cancel(addOnSubscription.id, { cancelAtPeriodEnd: true });
    }
}

// ==================== One-time Services ====================

/**
 * Purchase a service
 */
export async function purchaseService(
    customerId: string,
    service: AsistiaService,
    metadata?: Record<string, string>
): Promise<{ paymentId: string; invoiceId: string }> {
    const priceId = getServicePriceId(service);
    const price = await billing.prices.get(priceId);

    if (!price) {
        throw new Error(`Service not found: ${service}`);
    }

    const serviceNames: Record<AsistiaService, string> = {
        bot_setup: 'Bot Setup',
        custom_integration: 'Custom Integration',
        training_session: 'Training Session',
        data_migration: 'Data Migration'
    };

    const invoice = await billing.invoices.create({
        customerId,
        lines: [
            {
                description: serviceNames[service],
                quantity: 1,
                unitAmount: price.amount
            }
        ],
        metadata: { serviceType: service, ...metadata }
    });

    const payment = await billing.payments.process({
        customerId,
        amount: invoice.total,
        currency: 'USD',
        description: `Asistia - ${serviceNames[service]}`,
        metadata: { invoiceId: invoice.id, serviceType: service }
    });

    return { paymentId: payment.id, invoiceId: invoice.id };
}

// ==================== Billing Period Management ====================

/**
 * Handle new billing period (called from webhook)
 */
export async function handleNewBillingPeriod(customerId: string): Promise<void> {
    // Reset usage counters
    await resetUsageCounters(customerId);

    console.log(`[Asistia] New billing period started for ${customerId}`);
}

/**
 * Get billing history
 */
export async function getBillingHistory(customerId: string) {
    const [invoices, payments, subscriptions] = await Promise.all([
        billing.invoices.listByCustomer(customerId),
        billing.payments.listByCustomer(customerId),
        billing.subscriptions.listByCustomer(customerId)
    ]);

    return {
        invoices,
        payments,
        subscriptions,
        summary: {
            totalPaid: payments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0),
            activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
            monthlyRecurring: subscriptions.filter((s) => s.status === 'active').reduce((sum, s) => sum + (s.amount || 0), 0)
        }
    };
}
