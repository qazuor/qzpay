# @qazuor/qzpay-stripe

Stripe payment provider adapter for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-stripe stripe
```

## Features

- **Full Stripe Integration**: Customers, subscriptions, payments, invoices
- **Webhook Handling**: Signature verification and event mapping
- **Setup Intents**: Save cards without charging
- **Checkout Sessions**: Hosted checkout pages
- **Connect Ready**: Prepared for marketplace features (v2)

## Usage

### Basic Setup

```typescript
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

const stripeAdapter = new QZPayStripeAdapter({
  client: stripe,
  livemode: true
});
```

### With QZPayBilling

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';

const billing = new QZPayBilling({
  storage: storageAdapter,
  provider: stripeAdapter,
  livemode: true
});
```

### Direct Adapter Usage

```typescript
// Create customer in Stripe
const customer = await stripeAdapter.customers.create({
  email: 'user@example.com',
  name: 'John Doe'
});

// Create subscription
const subscription = await stripeAdapter.subscriptions.create({
  customerId: customer.id,
  priceId: 'price_123'
});
```

### Webhook Handling

```typescript
const event = await stripeAdapter.webhooks.verifyAndParse(
  payload,
  signature,
  webhookSecret
);

if (event) {
  const qzpayEvent = mapStripeEventToQZPayEvent(event);
  // Handle the event
}
```

### Setup Intents (Save Cards)

```typescript
const setupIntent = await stripeAdapter.setupIntents.create({
  customerId: 'cus_123',
  usage: 'off_session'
});

// Use setupIntent.clientSecret in frontend
```

### Checkout Sessions

```typescript
const session = await stripeAdapter.checkout.createSession({
  customerId: 'cus_123',
  priceId: 'price_123',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel'
});

// Redirect to session.url
```

## Configuration

```typescript
interface QZPayStripeConfig {
  client: Stripe;
  livemode: boolean;
  connect?: QZPayStripeConnectConfig; // For marketplace (v2)
}
```

## Adapters

The main adapter provides access to sub-adapters:

- `stripeAdapter.customers` - Customer operations
- `stripeAdapter.subscriptions` - Subscription operations
- `stripeAdapter.payments` - Payment operations
- `stripeAdapter.checkout` - Checkout sessions
- `stripeAdapter.prices` - Price operations
- `stripeAdapter.webhooks` - Webhook handling
- `stripeAdapter.setupIntents` - Setup intents
- `stripeAdapter.vendors` - Vendor operations (marketplace)

## License

MIT
