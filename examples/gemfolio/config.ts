/**
 * GemFolio - Multi-Tenant Configuration
 *
 * Each vendor has their own Stripe account, so we need to
 * create adapters dynamically per vendor.
 */
import { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Stripe from 'stripe';
import type { GemFolioVendor } from './types.js';

// Environment
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing: ${name}`);
    return value;
}

// Database (shared across all vendors)
const client = postgres(getEnvVar('DATABASE_URL'));
export const db = drizzle(client);

const isProduction = process.env.NODE_ENV === 'production';

// Platform Stripe account (for GemFolio's own billing, not vendor sales)
export const platformStripe = new Stripe(getEnvVar('STRIPE_SECRET_KEY'), {
    apiVersion: '2024-12-18.acacia'
});

// Cache of vendor billing instances
const vendorBillingCache = new Map<string, QZPayBilling>();

/**
 * Get or create a QZPayBilling instance for a vendor
 *
 * Each vendor has their own Stripe account, so we need separate adapters
 */
export function getVendorBilling(vendor: GemFolioVendor): QZPayBilling {
    // Check cache
    const cached = vendorBillingCache.get(vendor.id);
    if (cached) {
        return cached;
    }

    // Create vendor-specific storage adapter
    // Uses shared DB but scopes queries to vendor
    const storageAdapter = new QZPayDrizzleStorageAdapter({
        db,
        livemode: isProduction
        // In a real implementation, you'd scope all queries by vendorId
    });

    // Create Stripe client for vendor's Connect account
    // Using "on behalf of" to make requests as the connected account
    const vendorStripe = new Stripe(getEnvVar('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-12-18.acacia',
        stripeAccount: vendor.stripeAccountId // This is the key!
    });

    const stripeAdapter = new QZPayStripeAdapter({
        client: vendorStripe,
        livemode: isProduction
    });

    // Create billing instance
    const billing = new QZPayBilling({
        storage: storageAdapter,
        provider: stripeAdapter,
        livemode: isProduction
    });

    // Cache it
    vendorBillingCache.set(vendor.id, billing);

    return billing;
}

/**
 * Clear cached billing instance (e.g., when vendor settings change)
 */
export function clearVendorBillingCache(vendorId: string): void {
    vendorBillingCache.delete(vendorId);
}

/**
 * Create a Stripe instance for a vendor
 * Used for direct Stripe operations not covered by QZPay
 */
export function getVendorStripe(vendor: GemFolioVendor): Stripe {
    return new Stripe(getEnvVar('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-12-18.acacia',
        stripeAccount: vendor.stripeAccountId
    });
}

// Export platform storage for vendor management
export const platformStorage = new QZPayDrizzleStorageAdapter({
    db,
    livemode: isProduction
});
