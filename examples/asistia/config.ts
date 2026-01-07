/**
 * Asistia - QZPay Configuration
 */
import { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Stripe from 'stripe';

// Environment
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing: ${name}`);
    return value;
}

// Database
const client = postgres(getEnvVar('DATABASE_URL'));
export const db = drizzle(client);

// Stripe
export const stripe = new Stripe(getEnvVar('STRIPE_SECRET_KEY'), {
    apiVersion: '2024-12-18.acacia'
});

const isProduction = process.env.NODE_ENV === 'production';

// Adapters
export const storageAdapter = new QZPayDrizzleStorageAdapter({
    db,
    livemode: isProduction
});

export const stripeAdapter = new QZPayStripeAdapter({
    client: stripe,
    livemode: isProduction
});

// QZPay Billing
export const billing = new QZPayBilling({
    storage: storageAdapter,
    provider: stripeAdapter,
    livemode: isProduction
});

export const stripeWebhookSecret = getEnvVar('STRIPE_WEBHOOK_SECRET');

// Event listeners
billing.on('subscription.created', async (event) => {
    console.log(`[Asistia] New subscription: ${event.data.id}`);
});

billing.on('invoice.paid', async (event) => {
    console.log(`[Asistia] Invoice paid: ${event.data.id}`);
    // Reset usage counters for new billing period
});

billing.on('payment.succeeded', async (event) => {
    console.log(`[Asistia] Payment: ${event.data.id}`);
});

export default billing;
