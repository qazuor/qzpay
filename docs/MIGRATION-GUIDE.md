# Migration Guide

Guide for migrating to QZPay from direct Stripe/MercadoPago integrations or other billing libraries.

## Table of Contents

1. [Overview](#overview)
2. [Migration from Stripe SDK](#migration-from-stripe-sdk)
3. [Migration from MercadoPago SDK](#migration-from-mercadopago-sdk)
4. [Migration from Other Libraries](#migration-from-other-libraries)
5. [Migration Checklist](#migration-checklist)
6. [Common Patterns](#common-patterns)

---

## Overview

### Why Migrate to QZPay?

| Benefit | Description |
|---------|-------------|
| **Provider Abstraction** | Switch between Stripe/MercadoPago without code changes |
| **Unified API** | Same API for all providers |
| **Type Safety** | Full TypeScript support with inference |
| **Framework Integrations** | Ready-to-use Hono/NestJS integrations |
| **React Components** | Pre-built hooks and components |
| **Observability** | Built-in logging, health checks, and metrics |

### Migration Effort Estimate

| Current Setup | Complexity | Estimated Time |
|---------------|------------|----------------|
| Direct Stripe SDK | Low | 1-2 days |
| Direct MercadoPago SDK | Low | 1-2 days |
| Custom billing system | Medium | 3-5 days |
| Other billing library | Medium | 2-4 days |

---

## Migration from Stripe SDK

### Before (Direct Stripe)

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create customer
const customer = await stripe.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  metadata: { externalId: 'user_123' }
});

// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: 'price_xxx' }],
  trial_period_days: 14
});

// Webhook handling
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

  switch (event.type) {
    case 'customer.subscription.created':
      // Handle subscription
      break;
    case 'invoice.paid':
      // Handle payment
      break;
  }

  res.json({ received: true });
});
```

### After (QZPay)

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import Stripe from 'stripe';

// Setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripeAdapter = createQZPayStripeAdapter({ client: stripe });
const storage = createQZPayDrizzleStorage({ db });

const billing = new QZPayBilling({
  storage,
  paymentAdapter: stripeAdapter
});

// Create customer (same concepts, unified API)
const customer = await billing.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  externalId: 'user_123'
});

// Create subscription
const subscription = await billing.subscriptions.create({
  customerId: customer.id,
  priceId: 'price_xxx',
  trialDays: 14
});

// Event-based handling (cleaner)
billing.on('subscription.created', async (event) => {
  // Handle subscription
});

billing.on('payment.succeeded', async (event) => {
  // Handle payment
});
```

### Key Differences

| Stripe SDK | QZPay | Notes |
|------------|-------|-------|
| `stripe.customers.create()` | `billing.customers.create()` | Same concept |
| `customer.id` (Stripe ID) | `customer.id` (Internal ID) | QZPay manages mapping |
| `stripe.subscriptions.create({ customer, items })` | `billing.subscriptions.create({ customerId, priceId })` | Simplified API |
| `stripe.webhooks.constructEvent()` | Event emitter + webhook routes | More flexible |
| Manual DB sync | Automatic persistence | Storage adapter handles sync |

---

## Migration from MercadoPago SDK

### Before (Direct MercadoPago)

```typescript
import { MercadoPagoConfig, Customer, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// Create customer
const customerClient = new Customer(client);
const customer = await customerClient.create({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe'
});

// Create payment
const paymentClient = new Payment(client);
const payment = await paymentClient.create({
  body: {
    transaction_amount: 29.99,
    token: paymentMethodToken,
    payer: { id: customer.id }
  }
});

// IPN webhook handling
app.post('/webhooks/mercadopago', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const payment = await paymentClient.get({ id: data.id });
    // Handle payment status
  }

  res.sendStatus(200);
});
```

### After (QZPay)

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';

// Setup
const mpAdapter = createQZPayMercadoPagoAdapter({
  accessToken: process.env.MP_ACCESS_TOKEN,
  webhookSecret: process.env.MP_WEBHOOK_SECRET
});
const storage = createQZPayDrizzleStorage({ db });

const billing = new QZPayBilling({
  storage,
  paymentAdapter: mpAdapter
});

// Create customer (unified API)
const customer = await billing.customers.create({
  email: 'user@example.com',
  name: 'John Doe'
});

// Create payment
const payment = await billing.payments.create({
  customerId: customer.id,
  amount: 2999, // cents
  currency: 'ARS',
  paymentMethodId: paymentMethodToken
});

// Event handling
billing.on('payment.succeeded', async (event) => {
  // Handle successful payment
});

billing.on('payment.failed', async (event) => {
  // Handle failed payment
});
```

### MercadoPago-Specific Considerations

1. **Customer Metadata**: MercadoPago has limited metadata support
   - QZPay stores additional data in local database
   - See [MercadoPago Limitations](/packages/mercadopago/README.md#limitations-vs-stripe)

2. **3D Secure**: Requires manual handling
   ```typescript
   import { isMP3DSRequired, extractMP3DSPaymentInfo } from '@qazuor/qzpay-mercadopago';

   billing.on('payment.requires_action', async (event) => {
     const info = extractMP3DSPaymentInfo(event);
     if (info.requires3DS) {
       // Redirect to info.challengeUrl
     }
   });
   ```

3. **Subscriptions**: Called "Preapprovals" in MP
   - QZPay abstracts this difference
   - Same API as Stripe subscriptions

---

## Migration from Other Libraries

### From Lemon Squeezy

```typescript
// Before (Lemon Squeezy)
import { createCheckout, getCustomer } from '@lemonsqueezy/lemonsqueezy.js';

const checkout = await createCheckout({
  storeId: STORE_ID,
  variantId: VARIANT_ID,
  checkoutData: { email: 'user@example.com' }
});

// After (QZPay)
const session = await billing.checkout.createSession({
  customerId: customer.id,
  priceId: 'price_xxx',
  successUrl: '/success',
  cancelUrl: '/cancel'
});
```

### From Paddle

```typescript
// Before (Paddle)
import Paddle from '@paddle/paddle-node-sdk';

const paddle = new Paddle('...');
const subscription = await paddle.subscriptions.create({...});

// After (QZPay)
const subscription = await billing.subscriptions.create({
  customerId: customer.id,
  priceId: 'price_xxx'
});
```

### From Custom Implementation

If you have a custom billing implementation:

1. **Map your entities** to QZPay types:
   ```typescript
   // Your types -> QZPay types
   interface YourCustomer { ... }
   interface QZPayCustomer { ... }
   ```

2. **Create migration script** for existing data:
   ```typescript
   async function migrateCustomers(db: DrizzleDB) {
     const oldCustomers = await db.select().from(yourCustomersTable);

     for (const old of oldCustomers) {
       await billing.customers.create({
         email: old.email,
         name: old.fullName,
         externalId: old.id,
         metadata: {
           migratedAt: new Date().toISOString(),
           legacyId: old.id
         }
       });
     }
   }
   ```

3. **Update webhook endpoints** to use QZPay handlers

4. **Replace API calls** incrementally

---

## Migration Checklist

### Pre-Migration

- [ ] Audit current billing code and identify all touchpoints
- [ ] Document current webhook handlers and events
- [ ] List all customer-facing billing features
- [ ] Set up QZPay in development environment
- [ ] Create database schema (run migrations)

### Data Migration

- [ ] Export existing customer data
- [ ] Map customer IDs between systems
- [ ] Migrate subscription data
- [ ] Migrate payment history (for reference)
- [ ] Verify data integrity

### Code Migration

- [ ] Replace SDK initialization with QZPay setup
- [ ] Update customer creation/update code
- [ ] Update subscription management code
- [ ] Update payment processing code
- [ ] Update webhook handlers
- [ ] Update frontend checkout flows

### Testing

- [ ] Test customer operations (CRUD)
- [ ] Test subscription lifecycle (create, update, cancel)
- [ ] Test payment flows (success, failure, refund)
- [ ] Test webhook processing
- [ ] Test error handling
- [ ] Load test with expected volume

### Deployment

- [ ] Configure production environment variables
- [ ] Set up webhook endpoints with provider
- [ ] Deploy with feature flag (gradual rollout)
- [ ] Monitor for errors
- [ ] Keep old system as fallback

### Post-Migration

- [ ] Remove old billing code
- [ ] Update documentation
- [ ] Train team on new system
- [ ] Archive old webhook endpoints

---

## Common Patterns

### Gradual Migration with Feature Flags

```typescript
import { isFeatureEnabled } from './features';

async function createSubscription(customerId: string, planId: string) {
  if (isFeatureEnabled('qzpay-billing')) {
    // New QZPay implementation
    return billing.subscriptions.create({
      customerId,
      priceId: planId
    });
  } else {
    // Legacy Stripe implementation
    return stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }]
    });
  }
}
```

### ID Mapping

```typescript
// Store mapping between old and new IDs
interface IdMapping {
  oldStripeCustomerId: string;
  newQZPayCustomerId: string;
}

// During migration
const mapping = await db.select().from(idMappings).where(
  eq(idMappings.oldStripeCustomerId, stripeCustomerId)
);

const qzpayCustomer = await billing.customers.get(mapping.newQZPayCustomerId);
```

### Webhook Coexistence

```typescript
// Handle webhooks from both systems during migration
app.post('/webhooks/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);

  if (isUsingQZPay(event.data.object.customer)) {
    // Already migrated - QZPay handles this via its own webhooks
    return res.json({ received: true });
  }

  // Legacy handling
  await handleLegacyStripeEvent(event);
  res.json({ received: true });
});
```

### Database Schema Coexistence

```typescript
// Run QZPay migrations alongside existing tables
// QZPay uses 'billing_' prefix by default

// Your existing tables
export const users = pgTable('users', { ... });
export const subscriptions = pgTable('subscriptions', { ... }); // Legacy

// QZPay tables (from @qazuor/qzpay-drizzle)
// billing_customers, billing_subscriptions, etc.
```

---

## Need Help?

- [Documentation](/docs)
- [Examples](/examples)
- [GitHub Issues](https://github.com/qazuor/qzpay/issues)
- [Error Catalog](/docs/05-api/ERROR-CATALOG.md)
