/**
 * Basic Stripe Integration Example
 *
 * This example shows how to set up QZPay with Stripe
 * for a simple subscription-based billing system.
 */
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Database connection
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Initialize adapters
const storageAdapter = createQZPayDrizzleAdapter({ db });
const stripeAdapter = createQZPayStripeAdapter({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
});

// Initialize billing
const billing = createQZPayBilling({
    storage: storageAdapter,
    paymentAdapter: stripeAdapter,
    livemode: true
});

async function main() {
    // Create a customer
    const customer = await billing.customers.create({
        email: 'john@example.com',
        name: 'John Doe',
        metadata: { userId: 'user_123' }
    });
    console.log('Customer created:', customer.id);

    // Create a plan (usually done once via admin)
    const plan = await billing.plans.create({
        name: 'Pro Plan',
        description: 'Full access to all features',
        active: true
    });

    // Create a price for the plan
    const price = await billing.prices.create({
        planId: plan.id,
        amount: 2999, // $29.99 in cents
        currency: 'USD',
        interval: 'month',
        intervalCount: 1
    });

    // Create a subscription
    const subscription = await billing.subscriptions.create({
        customerId: customer.id,
        planId: plan.id,
        priceId: price.id
    });
    console.log('Subscription created:', subscription.id);

    // Process a one-time payment
    const payment = await billing.payments.process({
        customerId: customer.id,
        amount: 5000, // $50.00
        currency: 'USD',
        description: 'Setup fee'
    });
    console.log('Payment processed:', payment.id);

    // Create an invoice
    const invoice = await billing.invoices.create({
        customerId: customer.id,
        lines: [
            { description: 'Setup fee', quantity: 1, unitAmount: 5000 },
            { description: 'Pro Plan (first month)', quantity: 1, unitAmount: 2999 }
        ]
    });
    console.log('Invoice created:', invoice.id, 'Total:', invoice.total);
}

main().catch(console.error);
