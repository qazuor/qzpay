/**
 * Asistia - Plans and Pricing Setup
 */
import billing from './config.js';
import { ASISTIA_PRICING, type AsistiaAddOn, type AsistiaPlanTier, type AsistiaService } from './types.js';

// Plan IDs
export const planIds: Record<AsistiaPlanTier, string> = {
    starter: '',
    growth: '',
    business: '',
    enterprise: ''
};

// Price IDs
export const priceIds: Record<string, string> = {};

// Add-on Plan IDs
export const addOnPlanIds: Record<AsistiaAddOn, string> = {
    analytics_pro: '',
    api_access: '',
    white_label: '',
    priority_support: ''
};

// Service Price IDs
export const servicePriceIds: Record<AsistiaService, string> = {
    bot_setup: '',
    custom_integration: '',
    training_session: '',
    data_migration: ''
};

// Metered price IDs for overage
export const meteredPriceIds = {
    messages_overage: '',
    tokens_overage: '',
    extra_bots: ''
};

/**
 * Initialize all plans and prices
 */
export async function initializeAsistiaPlans(): Promise<void> {
    console.log('Initializing Asistia plans...');

    // Create main plans
    const planConfigs: Record<AsistiaPlanTier, { name: string; description: string }> = {
        starter: {
            name: 'Starter',
            description: '1,000 mensajes/mes, 1 bot, ideal para empezar'
        },
        growth: {
            name: 'Growth',
            description: '5,000 mensajes/mes, 3 bots, para equipos en crecimiento'
        },
        business: {
            name: 'Business',
            description: '20,000 mensajes/mes, 10 bots, integraciones ilimitadas'
        },
        enterprise: {
            name: 'Enterprise',
            description: 'Uso ilimitado, soporte dedicado, configuración custom'
        }
    };

    for (const [tier, config] of Object.entries(planConfigs)) {
        const plan = await billing.plans.create({
            name: `Asistia ${config.name}`,
            description: config.description,
            active: tier !== 'enterprise', // Enterprise is custom
            metadata: { tier, type: 'subscription' }
        });
        planIds[tier as AsistiaPlanTier] = plan.id;

        const pricing = ASISTIA_PRICING.plans[tier as AsistiaPlanTier];

        if (pricing.monthly > 0) {
            // Monthly price
            const monthlyPrice = await billing.prices.create({
                planId: plan.id,
                amount: pricing.monthly,
                currency: 'USD',
                interval: 'month',
                intervalCount: 1,
                metadata: { tier, billing: 'monthly' }
            });
            priceIds[`${tier}_monthly`] = monthlyPrice.id;

            // Yearly price
            const yearlyPrice = await billing.prices.create({
                planId: plan.id,
                amount: pricing.yearly,
                currency: 'USD',
                interval: 'year',
                intervalCount: 1,
                metadata: { tier, billing: 'yearly' }
            });
            priceIds[`${tier}_yearly`] = yearlyPrice.id;
        }
    }

    // Create metered prices for overage
    const overagePlan = await billing.plans.create({
        name: 'Asistia Usage',
        description: 'Overage charges',
        active: true,
        metadata: { type: 'metered' }
    });

    // Messages overage - $0.01 per message
    const messagesPrice = await billing.prices.create({
        planId: overagePlan.id,
        amount: ASISTIA_PRICING.overage.messagesPer,
        currency: 'USD',
        metadata: { type: 'overage', metric: 'messages' }
    });
    meteredPriceIds.messages_overage = messagesPrice.id;

    // Tokens overage - $0.002 per 1K tokens
    const tokensPrice = await billing.prices.create({
        planId: overagePlan.id,
        amount: ASISTIA_PRICING.overage.tokensPer1k,
        currency: 'USD',
        metadata: { type: 'overage', metric: 'tokens', unit: '1000' }
    });
    meteredPriceIds.tokens_overage = tokensPrice.id;

    // Create add-on plans
    const addOnConfigs: Record<AsistiaAddOn, { name: string; description: string }> = {
        analytics_pro: {
            name: 'Analytics Pro',
            description: 'Dashboard avanzado con métricas detalladas'
        },
        api_access: {
            name: 'API Access',
            description: 'Acceso completo a la API REST'
        },
        white_label: {
            name: 'White Label',
            description: 'Elimina el branding de Asistia'
        },
        priority_support: {
            name: 'Priority Support',
            description: 'Soporte prioritario 24/7'
        }
    };

    for (const [key, config] of Object.entries(addOnConfigs)) {
        const addOnKey = key as AsistiaAddOn;
        const plan = await billing.plans.create({
            name: config.name,
            description: config.description,
            active: true,
            metadata: { type: 'addon', addonKey: addOnKey }
        });
        addOnPlanIds[addOnKey] = plan.id;

        const price = await billing.prices.create({
            planId: plan.id,
            amount: ASISTIA_PRICING.addOns[addOnKey],
            currency: 'USD',
            interval: 'month',
            intervalCount: 1
        });
        priceIds[`addon_${addOnKey}`] = price.id;
    }

    // Create one-time services
    const serviceConfigs: Record<AsistiaService, { name: string; description: string }> = {
        bot_setup: {
            name: 'Bot Setup',
            description: 'Configuración inicial de tu bot'
        },
        custom_integration: {
            name: 'Custom Integration',
            description: 'Integración personalizada con tu sistema'
        },
        training_session: {
            name: 'Training Session',
            description: 'Sesión de entrenamiento 1:1'
        },
        data_migration: {
            name: 'Data Migration',
            description: 'Migración de datos desde otra plataforma'
        }
    };

    for (const [key, config] of Object.entries(serviceConfigs)) {
        const serviceKey = key as AsistiaService;
        const plan = await billing.plans.create({
            name: config.name,
            description: config.description,
            active: true,
            metadata: { type: 'service', serviceKey }
        });

        const price = await billing.prices.create({
            planId: plan.id,
            amount: ASISTIA_PRICING.services[serviceKey],
            currency: 'USD'
        });
        servicePriceIds[serviceKey] = price.id;
    }

    console.log('Asistia plans initialized!');
}

// Helper functions
export function getPriceId(tier: AsistiaPlanTier, billing: 'monthly' | 'yearly'): string {
    return priceIds[`${tier}_${billing}`];
}

export function getAddOnPriceId(addOn: AsistiaAddOn): string {
    return priceIds[`addon_${addOn}`];
}

export function getServicePriceId(service: AsistiaService): string {
    return servicePriceIds[service];
}
