/**
 * Asistia - Type Definitions
 */

// Plan tiers
export type AsistiaPlanTier = 'starter' | 'growth' | 'business' | 'enterprise';

// Usage metrics
export type AsistiaUsageMetric = 'messages' | 'tokens' | 'sessions' | 'api_calls';

// Add-ons
export type AsistiaAddOn = 'analytics_pro' | 'api_access' | 'white_label' | 'priority_support';

// One-time services
export type AsistiaService = 'bot_setup' | 'custom_integration' | 'training_session' | 'data_migration';

// Customer with usage tracking
export interface AsistiaCustomer {
    id: string;
    email: string;
    name: string;
    organizationName: string;
    planTier: AsistiaPlanTier;
    activeAddOns: AsistiaAddOn[];
    usage: AsistiaUsageSummary;
}

// Usage summary
export interface AsistiaUsageSummary {
    messages: { used: number; limit: number; overage: number };
    tokens: { used: number; limit: number; overage: number };
    bots: { active: number; limit: number };
    integrations: { active: number; limit: number };
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
}

// Plan limits
export interface AsistiaPlanLimits {
    messagesPerMonth: number;
    tokensPerMonth: number;
    maxBots: number;
    maxIntegrations: number;
    features: {
        customBranding: boolean;
        apiAccess: boolean;
        analytics: 'basic' | 'advanced';
        support: 'email' | 'priority' | 'dedicated';
    };
}

// Plan configuration
export const ASISTIA_PLAN_LIMITS: Record<AsistiaPlanTier, AsistiaPlanLimits> = {
    starter: {
        messagesPerMonth: 1000,
        tokensPerMonth: 100_000,
        maxBots: 1,
        maxIntegrations: 2,
        features: {
            customBranding: false,
            apiAccess: false,
            analytics: 'basic',
            support: 'email'
        }
    },
    growth: {
        messagesPerMonth: 5000,
        tokensPerMonth: 500_000,
        maxBots: 3,
        maxIntegrations: 5,
        features: {
            customBranding: false,
            apiAccess: false,
            analytics: 'basic',
            support: 'email'
        }
    },
    business: {
        messagesPerMonth: 20_000,
        tokensPerMonth: 2_000_000,
        maxBots: 10,
        maxIntegrations: -1, // unlimited
        features: {
            customBranding: false,
            apiAccess: true,
            analytics: 'advanced',
            support: 'priority'
        }
    },
    enterprise: {
        messagesPerMonth: -1, // unlimited
        tokensPerMonth: -1, // custom
        maxBots: -1, // unlimited
        maxIntegrations: -1,
        features: {
            customBranding: true,
            apiAccess: true,
            analytics: 'advanced',
            support: 'dedicated'
        }
    }
};

// Pricing (in cents)
export const ASISTIA_PRICING = {
    plans: {
        starter: { monthly: 1900, yearly: 19000 },
        growth: { monthly: 4900, yearly: 49000 },
        business: { monthly: 14900, yearly: 149000 },
        enterprise: { monthly: 0, yearly: 0 } // Custom pricing
    },
    overage: {
        messagesPer: 1, // $0.01 per message
        tokensPer1k: 2, // $0.002 per 1K tokens (0.2 cents)
        extraBot: 999 // $9.99 per extra bot/month
    },
    addOns: {
        analytics_pro: 1499,
        api_access: 2999,
        white_label: 4999,
        priority_support: 1999
    },
    services: {
        bot_setup: 9900,
        custom_integration: 29900,
        training_session: 14900,
        data_migration: 19900
    }
} as const;

// Usage event for tracking
export interface AsistiaUsageEvent {
    customerId: string;
    metric: AsistiaUsageMetric;
    amount: number;
    timestamp: Date;
    metadata?: Record<string, string>;
}
