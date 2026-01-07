/**
 * Hospeda - Webhook Event Handlers
 *
 * Handle billing events and trigger business logic
 */
import type { QZPayEvent, QZPayPayment, QZPaySubscription } from '@qazuor/qzpay-core';
import billing from './config.js';
import { HOSPEDA_PLAN_LIMITS, type HospedaPlanTier, type HospedaService } from './types.js';

// ==================== Event Registration ====================

export function registerWebhookHandlers(): void {
    // Subscription events
    billing.on('subscription.created', handleSubscriptionCreated);
    billing.on('subscription.updated', handleSubscriptionUpdated);
    billing.on('subscription.canceled', handleSubscriptionCanceled);

    // Payment events
    billing.on('payment.succeeded', handlePaymentSucceeded);
    billing.on('payment.failed', handlePaymentFailed);

    // Invoice events
    billing.on('invoice.paid', handleInvoicePaid);
    billing.on('invoice.payment_failed', handleInvoicePaymentFailed);

    console.log('[Hospeda] Webhook handlers registered');
}

// ==================== Subscription Handlers ====================

async function handleSubscriptionCreated(event: QZPayEvent): Promise<void> {
    const subscription = event.data as QZPaySubscription;
    const customerId = subscription.customerId;

    console.log(`[Hospeda] Subscription created: ${subscription.id} for customer ${customerId}`);

    // Get subscription type
    const tier = subscription.metadata?.tier as HospedaPlanTier | undefined;
    const isAddOn = subscription.metadata?.type === 'addon';

    if (tier && !isAddOn) {
        // Main plan subscription - update customer limits
        await updateCustomerLimits(customerId, tier);

        // Send welcome email
        await sendEmail(customerId, 'welcome', {
            planName: getPlanName(tier),
            limits: HOSPEDA_PLAN_LIMITS[tier]
        });
    } else if (isAddOn) {
        // Add-on subscription
        const addOnKey = subscription.metadata?.addonKey;
        await sendEmail(customerId, 'addon_activated', { addOn: addOnKey });
    }
}

async function handleSubscriptionUpdated(event: QZPayEvent): Promise<void> {
    const subscription = event.data as QZPaySubscription;
    const customerId = subscription.customerId;

    console.log(`[Hospeda] Subscription updated: ${subscription.id}`);

    const tier = subscription.metadata?.tier as HospedaPlanTier | undefined;
    if (tier) {
        await updateCustomerLimits(customerId, tier);
    }
}

async function handleSubscriptionCanceled(event: QZPayEvent): Promise<void> {
    const subscription = event.data as QZPaySubscription;
    const customerId = subscription.customerId;

    console.log(`[Hospeda] Subscription canceled: ${subscription.id}`);

    const isAddOn = subscription.metadata?.type === 'addon';

    if (!isAddOn) {
        // Main plan canceled - downgrade to basic limits
        await updateCustomerLimits(customerId, 'basic');

        // Check if they have properties over limit
        await handlePropertyLimitExceeded(customerId);

        // Send cancellation email
        await sendEmail(customerId, 'subscription_canceled', {
            effectiveDate: subscription.currentPeriodEnd
        });
    }
}

// ==================== Payment Handlers ====================

async function handlePaymentSucceeded(event: QZPayEvent): Promise<void> {
    const payment = event.data as QZPayPayment;

    console.log(`[Hospeda] Payment succeeded: ${payment.id}`);

    // Check if this is a one-time service payment
    const serviceType = payment.metadata?.serviceType as HospedaService | undefined;
    if (serviceType) {
        await fulfillService(payment.customerId, serviceType, payment.metadata?.propertyId);
    }
}

async function handlePaymentFailed(event: QZPayEvent): Promise<void> {
    const payment = event.data as QZPayPayment;

    console.log(`[Hospeda] Payment failed: ${payment.id}`);

    await sendEmail(payment.customerId, 'payment_failed', {
        amount: payment.amount,
        reason: payment.metadata?.failureReason || 'Unknown'
    });
}

// ==================== Invoice Handlers ====================

async function handleInvoicePaid(event: QZPayEvent): Promise<void> {
    console.log(`[Hospeda] Invoice paid: ${event.data.id}`);
    // Invoice paid, subscription is active
}

async function handleInvoicePaymentFailed(event: QZPayEvent): Promise<void> {
    console.log(`[Hospeda] Invoice payment failed: ${event.data.id}`);

    // Send dunning email
    await sendEmail(event.data.customerId, 'invoice_payment_failed', {
        invoiceId: event.data.id,
        retryDate: getNextRetryDate()
    });
}

// ==================== Business Logic Helpers ====================

async function updateCustomerLimits(customerId: string, tier: HospedaPlanTier): Promise<void> {
    const limits = HOSPEDA_PLAN_LIMITS[tier];

    // Update limits in QZPay
    if (limits.maxProperties !== -1) {
        await billing.limits.set({
            customerId,
            limitKey: 'max_properties',
            maxValue: limits.maxProperties,
            source: 'plan'
        });
    }

    if (limits.maxPhotosPerProperty !== -1) {
        await billing.limits.set({
            customerId,
            limitKey: 'max_photos_per_property',
            maxValue: limits.maxPhotosPerProperty,
            source: 'plan'
        });
    }

    // Update entitlements
    await billing.entitlements.grant({
        customerId,
        featureKey: 'highlighted',
        value: limits.highlighted
    });

    await billing.entitlements.grant({
        customerId,
        featureKey: 'verified_badge',
        value: limits.verifiedBadge
    });

    await billing.entitlements.grant({
        customerId,
        featureKey: 'analytics',
        value: limits.analytics
    });

    console.log(`[Hospeda] Updated limits for customer ${customerId} to tier ${tier}`);
}

async function handlePropertyLimitExceeded(customerId: string): Promise<void> {
    // This would check the database and hide/unpublish properties over the limit
    console.log(`[Hospeda] Checking property limits for ${customerId}`);
    // Implementation depends on your property management system
}

async function fulfillService(customerId: string, service: HospedaService, propertyId?: string): Promise<void> {
    console.log(`[Hospeda] Fulfilling service ${service} for customer ${customerId}`);

    switch (service) {
        case 'photo_session':
            // Create task for photographer
            await createServiceTask(customerId, 'Schedule photo session', propertyId);
            await sendEmail(customerId, 'service_purchased', {
                service: 'Sesión de Fotos',
                nextSteps: 'Te contactaremos en 24-48 horas para coordinar la visita.'
            });
            break;

        case 'video_tour':
            // Create task for videographer
            await createServiceTask(customerId, 'Schedule video tour', propertyId);
            await sendEmail(customerId, 'service_purchased', {
                service: 'Video Tour',
                nextSteps: 'Te contactaremos en 24-48 horas para coordinar la grabación.'
            });
            break;

        case 'premium_setup':
            // Create task for support team
            await createServiceTask(customerId, 'Premium setup assistance', propertyId);
            await sendEmail(customerId, 'service_purchased', {
                service: 'Configuración Premium',
                nextSteps: 'Un especialista te contactará en las próximas horas.'
            });
            break;
    }
}

// ==================== Placeholder Functions ====================
// These would connect to your actual systems

async function sendEmail(customerId: string, template: string, data: Record<string, unknown>): Promise<void> {
    console.log(`[Hospeda] Sending email to ${customerId}: ${template}`, data);
    // Integration with your email service (SendGrid, Resend, etc.)
}

async function createServiceTask(customerId: string, task: string, propertyId?: string): Promise<void> {
    console.log(`[Hospeda] Creating task: ${task} for ${customerId}, property: ${propertyId}`);
    // Integration with your task management system
}

function getPlanName(tier: HospedaPlanTier): string {
    const names: Record<HospedaPlanTier, string> = {
        basic: 'Hospeda Básico',
        professional: 'Hospeda Profesional',
        agency: 'Hospeda Agencia'
    };
    return names[tier];
}

function getNextRetryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 3); // Retry in 3 days
    return date;
}
