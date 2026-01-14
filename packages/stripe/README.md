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
- **Error Mapping**: Comprehensive error handling with QZPay error codes
- **3D Secure (SCA)**: Full support for Strong Customer Authentication
- **Connect Ready**: Prepared for marketplace features (v2)

## Usage

### Basic Setup

```typescript
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';

const stripeAdapter = createQZPayStripeAdapter({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});
```

### With QZPayBilling

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';

const billing = createQZPayBilling({
  storage: storageAdapter,
  paymentAdapter: stripeAdapter,
  livemode: true,
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

### Error Handling

The Stripe adapter now includes comprehensive error mapping:

```typescript
import { mapStripeError, QZPayError } from '@qazuor/qzpay-stripe';

try {
  const payment = await stripeAdapter.payments.create({
    customerId: 'cus_123',
    amount: 2999,
    currency: 'USD'
  });
} catch (error) {
  const qzpayError = mapStripeError(error);

  // Check error code
  switch (qzpayError.code) {
    case 'card_declined':
      // Handle card declined
      break;
    case 'insufficient_funds':
      // Handle insufficient funds
      break;
    case 'authentication_required':
      // Handle 3DS requirement
      break;
    default:
      // Handle other errors
  }
}
```

### 3D Secure (Strong Customer Authentication)

Full support for 3D Secure authentication flow:

```typescript
// Create payment with automatic 3DS handling
const payment = await stripeAdapter.payments.create({
  customerId: 'cus_123',
  amount: 5000,
  currency: 'EUR',
  paymentMethodId: 'pm_card_authenticationRequired'
});

// Check if 3DS is required
if (payment.status === 'requires_action') {
  // Frontend needs to handle authentication
  return {
    clientSecret: payment.clientSecret,
    nextAction: payment.nextAction,
    requiresAction: true
  };
}

// Frontend implementation with Stripe.js
// stripe.confirmCardPayment(clientSecret)
//   .then(result => {
//     if (result.error) {
//       // Authentication failed
//     } else {
//       // Payment succeeded
//     }
//   });
```

### Customer External ID

The adapter now properly handles external customer IDs:

```typescript
// Create customer with external ID
const customer = await stripeAdapter.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  externalId: 'user_12345' // Your internal user ID
});

// External ID is stored in Stripe metadata
// Retrieve customer by external ID
const foundCustomer = await stripeAdapter.customers.getByExternalId('user_12345');
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
