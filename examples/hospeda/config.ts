/**
 * Hospeda - QZPay Configuration
 */
import { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Stripe from 'stripe';

// Environment validation
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}

// Database connection
const databaseUrl = getEnvVar('DATABASE_URL');
const client = postgres(databaseUrl);
export const db = drizzle(client);

// Stripe client
const stripeSecretKey = getEnvVar('STRIPE_SECRET_KEY');
export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia'
});

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Initialize storage adapter
export const storageAdapter = new QZPayDrizzleStorageAdapter({
    db,
    livemode: isProduction
});

// Initialize Stripe adapter
export const stripeAdapter = new QZPayStripeAdapter({
    client: stripe,
    livemode: isProduction
});

// Initialize QZPay Billing
export const billing = new QZPayBilling({
    storage: storageAdapter,
    provider: stripeAdapter,
    livemode: isProduction
});

// Webhook secret
export const stripeWebhookSecret = getEnvVar('STRIPE_WEBHOOK_SECRET');

// Event listeners for Hospeda-specific logic
billing.on('subscription.created', async (event) => {
    console.log(`[Hospeda] New subscription: ${event.data.id}`);
    // Update property limits for customer
});

billing.on('subscription.canceled', async (event) => {
    console.log(`[Hospeda] Subscription canceled: ${event.data.id}`);
    // Downgrade customer, hide extra properties
});

billing.on('payment.succeeded', async (event) => {
    console.log(`[Hospeda] Payment succeeded: ${event.data.id}`);
    // If one-time service, trigger fulfillment
});

export default billing;
