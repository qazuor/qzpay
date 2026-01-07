/**
 * GemFolio - Vendor Store Management
 */
import { platformStripe } from './config.js';
import type { GemFolioVendor, GemFolioVendorSettings } from './types.js';

// In-memory store (use database in production)
const vendors = new Map<string, GemFolioVendor>();
const vendorsBySlug = new Map<string, GemFolioVendor>();

/**
 * Create a new vendor account
 * This creates a Stripe Connect account for them
 */
export async function createVendor(data: {
    email: string;
    businessName: string;
    slug: string;
    country: string;
    settings: Partial<GemFolioVendorSettings>;
}): Promise<GemFolioVendor> {
    // Check slug availability
    if (vendorsBySlug.has(data.slug)) {
        throw new Error('Slug already taken');
    }

    // Create Stripe Connect Express account
    // Express accounts are the easiest - Stripe handles onboarding
    const account = await platformStripe.accounts.create({
        type: 'express',
        email: data.email,
        business_type: 'individual',
        country: data.country,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
        },
        business_profile: {
            name: data.businessName
        },
        metadata: {
            gemfolio_slug: data.slug
        }
    });

    const vendor: GemFolioVendor = {
        id: `vendor_${Date.now()}`,
        email: data.email,
        businessName: data.businessName,
        slug: data.slug,
        stripeAccountId: account.id,
        webhookSecret: '', // Will be set after webhook creation
        currency: getCurrencyForCountry(data.country),
        active: false, // Active after Stripe onboarding complete
        createdAt: new Date(),
        settings: {
            storeName: data.businessName,
            storeDescription: data.settings.storeDescription,
            logo: data.settings.logo,
            primaryColor: data.settings.primaryColor || '#6366f1',
            contactEmail: data.email,
            shippingEnabled: data.settings.shippingEnabled ?? false,
            taxRate: data.settings.taxRate
        }
    };

    vendors.set(vendor.id, vendor);
    vendorsBySlug.set(vendor.slug, vendor);

    return vendor;
}

/**
 * Get Stripe onboarding link for vendor
 * Vendor needs to complete this to start accepting payments
 */
export async function getOnboardingLink(vendorId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const vendor = vendors.get(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const accountLink = await platformStripe.accountLinks.create({
        account: vendor.stripeAccountId,
        type: 'account_onboarding',
        return_url: returnUrl,
        refresh_url: refreshUrl
    });

    return accountLink.url;
}

/**
 * Check if vendor's Stripe account is ready
 */
export async function checkVendorStatus(vendorId: string): Promise<{
    ready: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirements: string[];
}> {
    const vendor = vendors.get(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const account = await platformStripe.accounts.retrieve(vendor.stripeAccountId);

    const ready = account.charges_enabled && account.payouts_enabled;

    // Update vendor status
    if (ready && !vendor.active) {
        vendor.active = true;
        vendors.set(vendorId, vendor);
    }

    return {
        ready,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        requirements: account.requirements?.currently_due || []
    };
}

/**
 * Get vendor by ID
 */
export function getVendor(vendorId: string): GemFolioVendor | undefined {
    return vendors.get(vendorId);
}

/**
 * Get vendor by slug (for public store URLs)
 */
export function getVendorBySlug(slug: string): GemFolioVendor | undefined {
    return vendorsBySlug.get(slug);
}

/**
 * Update vendor settings
 */
export function updateVendorSettings(vendorId: string, settings: Partial<GemFolioVendorSettings>): GemFolioVendor {
    const vendor = vendors.get(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    vendor.settings = { ...vendor.settings, ...settings };
    vendors.set(vendorId, vendor);

    return vendor;
}

/**
 * List all vendors
 */
export function listVendors(): GemFolioVendor[] {
    return Array.from(vendors.values());
}

/**
 * Get dashboard link for vendor's Stripe Express dashboard
 */
export async function getDashboardLink(vendorId: string): Promise<string> {
    const vendor = vendors.get(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const loginLink = await platformStripe.accounts.createLoginLink(vendor.stripeAccountId);

    return loginLink.url;
}

// Helper
function getCurrencyForCountry(country: string): string {
    const currencyMap: Record<string, string> = {
        US: 'USD',
        AR: 'ARS',
        MX: 'MXN',
        ES: 'EUR',
        GB: 'GBP',
        BR: 'BRL'
        // Add more as needed
    };
    return currencyMap[country] || 'USD';
}
