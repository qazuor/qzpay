/**
 * Hospeda - Business Logic Services
 */
import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import billing from './config.js';
import { getAddOnPriceId, getPriceId, getServicePriceId, planIds } from './plans.js';
import {
    HOSPEDA_PLAN_LIMITS,
    type HospedaAddOn,
    type HospedaCustomer,
    type HospedaPlanLimits,
    type HospedaPlanTier,
    type HospedaService
} from './types.js';

// ==================== Customer Management ====================

/**
 * Register a new property owner
 */
export async function registerOwner(data: {
    email: string;
    name: string;
    planTier?: HospedaPlanTier;
    billingCycle?: 'monthly' | 'yearly';
}): Promise<{ customer: QZPayCustomer; subscription?: QZPaySubscription }> {
    // Create customer
    const customer = await billing.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
            propertyCount: '0',
            planTier: data.planTier || 'basic',
            verified: 'false'
        }
    });

    let subscription: QZPaySubscription | undefined;

    // Create subscription if plan specified
    if (data.planTier) {
        const priceId = getPriceId(data.planTier, data.billingCycle || 'monthly');
        subscription = await billing.subscriptions.create({
            customerId: customer.id,
            planId: planIds[data.planTier],
            priceId,
            metadata: {
                tier: data.planTier,
                billingCycle: data.billingCycle || 'monthly'
            }
        });
    }

    return { customer, subscription };
}

/**
 * Get customer with Hospeda-specific data
 */
export async function getOwner(customerId: string): Promise<HospedaCustomer | null> {
    const customer = await billing.customers.get(customerId);
    if (!customer) return null;

    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const activeSubscription = subscriptions.find((s) => s.status === 'active' || s.status === 'trialing');

    // Get active add-ons
    const addOnSubscriptions = subscriptions.filter(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type === 'addon'
    );

    const activeAddOns = addOnSubscriptions.map((s) => s.metadata?.addonKey as HospedaAddOn).filter(Boolean);

    return {
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        propertyCount: Number(customer.metadata?.propertyCount) || 0,
        planTier: (activeSubscription?.metadata?.tier as HospedaPlanTier) || 'basic',
        activeAddOns,
        verified: customer.metadata?.verified === 'true'
    };
}

// ==================== Plan Management ====================

/**
 * Upgrade or downgrade subscription
 */
export async function changePlan(
    customerId: string,
    newTier: HospedaPlanTier,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<QZPaySubscription> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const currentSubscription = subscriptions.find(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type !== 'addon'
    );

    const newPriceId = getPriceId(newTier, billingCycle);

    if (currentSubscription) {
        // Update existing subscription
        return billing.subscriptions.update(currentSubscription.id, {
            priceId: newPriceId,
            metadata: {
                ...currentSubscription.metadata,
                tier: newTier,
                billingCycle
            }
        });
    }
    // Create new subscription
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
export async function cancelPlan(customerId: string, cancelAtPeriodEnd = true): Promise<void> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const activeSubscription = subscriptions.find(
        (s) => (s.status === 'active' || s.status === 'trialing') && s.metadata?.type !== 'addon'
    );

    if (activeSubscription) {
        await billing.subscriptions.cancel(activeSubscription.id, { cancelAtPeriodEnd });
    }
}

/**
 * Get current plan limits for customer
 */
export async function getPlanLimits(customerId: string): Promise<HospedaPlanLimits> {
    const owner = await getOwner(customerId);
    if (!owner) {
        return HOSPEDA_PLAN_LIMITS.basic;
    }

    const baseLimits = { ...HOSPEDA_PLAN_LIMITS[owner.planTier] };

    // Apply add-on bonuses
    if (owner.activeAddOns.includes('highlight_plus')) {
        baseLimits.highlighted = true;
    }
    if (owner.activeAddOns.includes('gallery_extended')) {
        baseLimits.maxPhotosPerProperty = baseLimits.maxPhotosPerProperty === -1 ? -1 : baseLimits.maxPhotosPerProperty + 10;
    }
    if (owner.activeAddOns.includes('stats_pro')) {
        baseLimits.analytics = 'advanced';
    }
    if (owner.activeAddOns.includes('verified_badge')) {
        baseLimits.verifiedBadge = true;
    }

    return baseLimits;
}

// ==================== Add-on Management ====================

/**
 * Subscribe to an add-on
 */
export async function subscribeToAddOn(customerId: string, addOn: HospedaAddOn): Promise<QZPaySubscription> {
    const priceId = getAddOnPriceId(addOn);

    // Check if already subscribed
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const existing = subscriptions.find((s) => s.metadata?.addonKey === addOn && s.status === 'active');

    if (existing) {
        throw new Error(`Already subscribed to ${addOn}`);
    }

    return billing.subscriptions.create({
        customerId,
        planId: '', // Will use price's plan
        priceId,
        metadata: { type: 'addon', addonKey: addOn }
    });
}

/**
 * Cancel an add-on subscription
 */
export async function cancelAddOn(customerId: string, addOn: HospedaAddOn): Promise<void> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);
    const addOnSubscription = subscriptions.find((s) => s.metadata?.addonKey === addOn && s.status === 'active');

    if (addOnSubscription) {
        await billing.subscriptions.cancel(addOnSubscription.id, { cancelAtPeriodEnd: true });
    }
}

/**
 * List all add-ons for a customer
 */
export async function listCustomerAddOns(customerId: string): Promise<Array<{ addOn: HospedaAddOn; subscription: QZPaySubscription }>> {
    const subscriptions = await billing.subscriptions.listByCustomer(customerId);

    return subscriptions
        .filter((s) => s.metadata?.type === 'addon' && (s.status === 'active' || s.status === 'trialing'))
        .map((s) => ({
            addOn: s.metadata?.addonKey as HospedaAddOn,
            subscription: s
        }));
}

// ==================== One-time Services ====================

/**
 * Purchase a one-time service
 */
export async function purchaseService(
    customerId: string,
    service: HospedaService,
    propertyId?: string
): Promise<{ paymentId: string; invoiceId: string }> {
    const priceId = getServicePriceId(service);

    // Get price details
    const price = await billing.prices.get(priceId);
    if (!price) {
        throw new Error(`Service price not found: ${service}`);
    }

    // Create invoice with line item
    const invoice = await billing.invoices.create({
        customerId,
        lines: [
            {
                description: getServiceDescription(service),
                quantity: 1,
                unitAmount: price.amount
            }
        ],
        metadata: {
            serviceType: service,
            propertyId: propertyId || ''
        }
    });

    // Process payment
    const payment = await billing.payments.process({
        customerId,
        amount: invoice.total,
        currency: 'USD',
        description: `Hospeda - ${getServiceDescription(service)}`,
        metadata: {
            invoiceId: invoice.id,
            serviceType: service,
            propertyId: propertyId || ''
        }
    });

    return {
        paymentId: payment.id,
        invoiceId: invoice.id
    };
}

function getServiceDescription(service: HospedaService): string {
    const descriptions: Record<HospedaService, string> = {
        photo_session: 'Sesión de Fotos Profesional',
        video_tour: 'Video Tour Profesional',
        premium_setup: 'Configuración Premium'
    };
    return descriptions[service];
}

// ==================== Billing History ====================

/**
 * Get customer billing history
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
            pendingInvoices: invoices.filter((i) => i.status === 'open').length
        }
    };
}
