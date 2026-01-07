/**
 * Hospeda - Plans and Pricing Setup
 *
 * Run this once to create plans in QZPay and Stripe
 */
import billing from './config.js';
import { HOSPEDA_PRICING, type HospedaAddOn, type HospedaPlanTier, type HospedaService } from './types.js';

// Plan IDs (will be set after creation)
export const planIds: Record<HospedaPlanTier, string> = {
    basic: '',
    professional: '',
    agency: ''
};

// Price IDs
export const priceIds: Record<string, string> = {};

// Add-on Plan IDs
export const addOnPlanIds: Record<HospedaAddOn, string> = {
    highlight_plus: '',
    gallery_extended: '',
    stats_pro: '',
    verified_badge: ''
};

// One-time service price IDs
export const servicePriceIds: Record<HospedaService, string> = {
    photo_session: '',
    video_tour: '',
    premium_setup: ''
};

/**
 * Initialize all plans and prices
 * Run this during deployment/setup
 */
export async function initializeHospedaPlans(): Promise<void> {
    console.log('Initializing Hospeda plans...');

    // Create main subscription plans
    const basicPlan = await billing.plans.create({
        name: 'Hospeda Básico',
        description: 'Publica 1 alojamiento con hasta 5 fotos',
        active: true,
        metadata: { tier: 'basic', type: 'subscription' }
    });
    planIds.basic = basicPlan.id;

    const proPlan = await billing.plans.create({
        name: 'Hospeda Profesional',
        description: 'Hasta 5 alojamientos, 15 fotos cada uno, destacado en búsquedas',
        active: true,
        metadata: { tier: 'professional', type: 'subscription' }
    });
    planIds.professional = proPlan.id;

    const agencyPlan = await billing.plans.create({
        name: 'Hospeda Agencia',
        description: 'Alojamientos ilimitados, fotos ilimitadas, badge verificado',
        active: true,
        metadata: { tier: 'agency', type: 'subscription' }
    });
    planIds.agency = agencyPlan.id;

    // Create prices for main plans
    for (const tier of ['basic', 'professional', 'agency'] as const) {
        const pricing = HOSPEDA_PRICING.plans[tier];
        const planId = planIds[tier];

        // Monthly price
        const monthlyPrice = await billing.prices.create({
            planId,
            amount: pricing.monthly,
            currency: 'USD',
            interval: 'month',
            intervalCount: 1,
            metadata: { tier, billing: 'monthly' }
        });
        priceIds[`${tier}_monthly`] = monthlyPrice.id;

        // Yearly price (with discount)
        const yearlyPrice = await billing.prices.create({
            planId,
            amount: pricing.yearly,
            currency: 'USD',
            interval: 'year',
            intervalCount: 1,
            metadata: { tier, billing: 'yearly' }
        });
        priceIds[`${tier}_yearly`] = yearlyPrice.id;
    }

    // Create add-on plans
    const addOnConfigs: Record<HospedaAddOn, { name: string; description: string }> = {
        highlight_plus: {
            name: 'Destacar Plus',
            description: 'Aparece primero en los resultados de búsqueda'
        },
        gallery_extended: {
            name: 'Galería Extendida',
            description: '+10 fotos adicionales por alojamiento'
        },
        stats_pro: {
            name: 'Estadísticas Pro',
            description: 'Analytics detallado de visitas y conversiones'
        },
        verified_badge: {
            name: 'Badge Verificado',
            description: 'Muestra un badge de verificación en tu perfil'
        }
    };

    for (const [key, config] of Object.entries(addOnConfigs)) {
        const addOnKey = key as HospedaAddOn;
        const plan = await billing.plans.create({
            name: config.name,
            description: config.description,
            active: true,
            metadata: { type: 'addon', addonKey: addOnKey }
        });
        addOnPlanIds[addOnKey] = plan.id;

        const price = await billing.prices.create({
            planId: plan.id,
            amount: HOSPEDA_PRICING.addOns[addOnKey],
            currency: 'USD',
            interval: 'month',
            intervalCount: 1
        });
        priceIds[`addon_${addOnKey}`] = price.id;
    }

    // Create one-time service products (using plans without recurring pricing)
    const serviceConfigs: Record<HospedaService, { name: string; description: string }> = {
        photo_session: {
            name: 'Sesión de Fotos Profesional',
            description: 'Fotógrafo profesional visita tu alojamiento'
        },
        video_tour: {
            name: 'Video Tour Profesional',
            description: 'Video profesional con recorrido del alojamiento'
        },
        premium_setup: {
            name: 'Configuración Premium',
            description: 'Asistencia personalizada para configurar tu perfil'
        }
    };

    for (const [key, config] of Object.entries(serviceConfigs)) {
        const serviceKey = key as HospedaService;
        const plan = await billing.plans.create({
            name: config.name,
            description: config.description,
            active: true,
            metadata: { type: 'service', serviceKey }
        });

        // One-time price (no interval)
        const price = await billing.prices.create({
            planId: plan.id,
            amount: HOSPEDA_PRICING.services[serviceKey],
            currency: 'USD'
            // No interval = one-time
        });
        servicePriceIds[serviceKey] = price.id;
    }

    console.log('Hospeda plans initialized successfully!');
    console.log('Plan IDs:', planIds);
    console.log('Price IDs:', priceIds);
    console.log('Add-on Plan IDs:', addOnPlanIds);
    console.log('Service Price IDs:', servicePriceIds);
}

// Export for use in other files
export function getPriceId(tier: HospedaPlanTier, billing: 'monthly' | 'yearly'): string {
    return priceIds[`${tier}_${billing}`];
}

export function getAddOnPriceId(addOn: HospedaAddOn): string {
    return priceIds[`addon_${addOn}`];
}

export function getServicePriceId(service: HospedaService): string {
    return servicePriceIds[service];
}
