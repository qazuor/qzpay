/**
 * GemFolio - Multi-Tenant Configuration
 *
 * Each vendor has their own Stripe account, so we need to
 * create adapters dynamically per vendor.
 */
import { createQZPayBilling, type QZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
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
    const storageAdapter = createQZPayDrizzleAdapter({ db });

    // Create Stripe adapter for vendor's Connect account
    // Note: For multi-tenant with Connect, you may need custom configuration
    const stripeAdapter = createQZPayStripeAdapter({
        secretKey: getEnvVar('STRIPE_SECRET_KEY'),
        webhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET'),
        // For Connect accounts, additional configuration may be needed
    });

    // Create billing instance
    const billing = createQZPayBilling({
        storage: storageAdapter,
        paymentAdapter: stripeAdapter,
        livemode: isProduction,
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
export const platformStorage = createQZPayDrizzleAdapter({ db });
