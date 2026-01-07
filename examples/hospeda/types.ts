/**
 * Hospeda - Type Definitions
 */

// Plan tiers
export type HospedaPlanTier = 'basic' | 'professional' | 'agency';

// Monthly add-ons
export type HospedaAddOn = 'highlight_plus' | 'gallery_extended' | 'stats_pro' | 'verified_badge';

// One-time services
export type HospedaService = 'photo_session' | 'video_tour' | 'premium_setup';

// Customer with Hospeda-specific metadata
export interface HospedaCustomer {
    id: string;
    email: string;
    name: string;
    // Hospeda-specific
    propertyCount: number;
    planTier: HospedaPlanTier;
    activeAddOns: HospedaAddOn[];
    verified: boolean;
}

// Property (alojamiento)
export interface HospedaProperty {
    id: string;
    ownerId: string;
    name: string;
    description: string;
    photos: string[];
    maxPhotos: number;
    highlighted: boolean;
    verified: boolean;
}

// Plan limits
export interface HospedaPlanLimits {
    maxProperties: number;
    maxPhotosPerProperty: number;
    highlighted: boolean;
    verifiedBadge: boolean;
    analytics: 'basic' | 'advanced';
}

// Plan configuration
export const HOSPEDA_PLAN_LIMITS: Record<HospedaPlanTier, HospedaPlanLimits> = {
    basic: {
        maxProperties: 1,
        maxPhotosPerProperty: 5,
        highlighted: false,
        verifiedBadge: false,
        analytics: 'basic'
    },
    professional: {
        maxProperties: 5,
        maxPhotosPerProperty: 15,
        highlighted: true,
        verifiedBadge: false,
        analytics: 'advanced'
    },
    agency: {
        maxProperties: -1, // unlimited
        maxPhotosPerProperty: -1, // unlimited
        highlighted: true,
        verifiedBadge: true,
        analytics: 'advanced'
    }
};

// Pricing (in cents)
export const HOSPEDA_PRICING = {
    plans: {
        basic: { monthly: 999, yearly: 9990 },
        professional: { monthly: 2999, yearly: 29990 },
        agency: { monthly: 9999, yearly: 99990 }
    },
    addOns: {
        highlight_plus: 499,
        gallery_extended: 299,
        stats_pro: 799,
        verified_badge: 999
    },
    services: {
        photo_session: 14900,
        video_tour: 29900,
        premium_setup: 4900
    }
} as const;
