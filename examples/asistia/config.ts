/**
 * Asistia - QZPay Configuration
 */
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Environment
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing: ${name}`);
    return value;
}

// Database
const client = postgres(getEnvVar('DATABASE_URL'));
export const db = drizzle(client);

const isProduction = process.env.NODE_ENV === 'production';

// Adapters
export const storageAdapter = createQZPayDrizzleAdapter({ db });

export const stripeAdapter = createQZPayStripeAdapter({
    secretKey: getEnvVar('STRIPE_SECRET_KEY'),
    webhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET')
});

// QZPay Billing
export const billing = createQZPayBilling({
    storage: storageAdapter,
    paymentAdapter: stripeAdapter,
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
