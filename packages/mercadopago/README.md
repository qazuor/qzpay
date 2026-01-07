# @qazuor/qzpay-mercadopago

MercadoPago payment provider adapter for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-mercadopago mercadopago
```

## Features

- **Payment Processing**: Create, capture, cancel payments
- **Subscriptions**: Create and manage recurring payments (preapprovals)
- **3D Secure Support**: Secure card payments with challenge flow
- **Refunds**: Full and partial refunds
- **Webhooks/IPN**: Event handling and HMAC signature verification
- **Multiple Payment Methods**: Credit/debit cards, PIX, bank transfers

## Quick Start

### Basic Setup

```typescript
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

const mpAdapter = createQZPayMercadoPagoAdapter({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET, // Optional
  timeout: 5000 // Optional, default 5000ms
});
```

### With QZPayBilling

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createDrizzleAdapter } from '@qazuor/qzpay-drizzle';

const billing = new QZPayBilling({
  storage: createDrizzleAdapter({ db }),
  paymentAdapter: mpAdapter
});
```

## Usage

### Payment Processing

```typescript
// Create a payment
const payment = await mpAdapter.payments.create('customer_mp_id', {
  amount: 10000, // $100.00 in cents
  currency: 'ARS',
  paymentMethodId: 'visa' // or 'master', 'pix', etc.
});

// Retrieve payment status
const status = await mpAdapter.payments.retrieve(payment.id);

// Capture an authorized payment
await mpAdapter.payments.capture(payment.id);

// Refund a payment (partial or full)
await mpAdapter.payments.refund({ amount: 5000 }, payment.id);

// Cancel a payment
await mpAdapter.payments.cancel(payment.id);
```

### Subscriptions (Preapprovals)

```typescript
// Create a subscription
const subscription = await mpAdapter.subscriptions.create('customer_mp_id', {
  priceId: 'price_plan_basic', // Your plan identifier
  trialDays: 14 // Optional trial period
});

// Retrieve subscription
const sub = await mpAdapter.subscriptions.retrieve(subscription.id);

// Update subscription
await mpAdapter.subscriptions.update(subscription.id, {
  priceId: 'price_plan_premium' // Upgrade/downgrade
});

// Cancel subscription
await mpAdapter.subscriptions.cancel(subscription.id);
```

### 3D Secure

```typescript
import {
  isMP3DSRequired,
  extractMP3DSResult,
  extractMP3DSPaymentInfo
} from '@qazuor/qzpay-mercadopago';

// Handle 3DS in webhook
function handlePaymentWebhook(event: QZPayWebhookEvent) {
  const info = extractMP3DSPaymentInfo(event);

  if (info.requires3DS) {
    // Redirect user to challenge
    const challengeUrl = info.challengeUrl;
    return { action: 'redirect', url: challengeUrl };
  }

  if (info.threeDSecure?.status === 'authenticated') {
    // Payment authenticated successfully
    return { action: 'complete' };
  }

  if (info.threeDSecure?.status === 'failed') {
    // Authentication failed
    return { action: 'failed', reason: '3DS authentication failed' };
  }
}
```

### Webhook/IPN Handling

```typescript
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

const mpAdapter = createQZPayMercadoPagoAdapter({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET!
});

// Verify and parse webhook
app.post('/webhooks/mercadopago', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('x-signature');
  const requestId = c.req.header('x-request-id');

  const event = await mpAdapter.webhooks.verifyAndParse(payload, signature, requestId);

  if (!event) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  switch (event.type) {
    case 'payment.created':
    case 'payment.updated':
      // Handle payment event
      break;
    case 'subscription.created':
    case 'subscription.updated':
      // Handle subscription event
      break;
  }

  return c.json({ received: true });
});
```

## Configuration

```typescript
interface QZPayMercadoPagoConfig {
  /** MercadoPago access token (required) */
  accessToken: string;

  /** Webhook secret for signature verification (optional) */
  webhookSecret?: string;

  /** Request timeout in ms (default: 5000) */
  timeout?: number;

  /** Integrator ID for attribution (optional) */
  integratorId?: string;

  /** Platform ID for marketplace (optional) */
  platformId?: string;
}
```

## API Reference

### Adapters

| Adapter | Description |
|---------|-------------|
| `mpAdapter.customers` | Customer management |
| `mpAdapter.subscriptions` | Subscription/preapproval management |
| `mpAdapter.payments` | Payment operations |
| `mpAdapter.checkout` | Checkout preferences |
| `mpAdapter.prices` | Price management (in-memory) |
| `mpAdapter.webhooks` | Webhook/IPN handling |

---

## Limitations vs Stripe

MercadoPago has some functional differences compared to Stripe that you should be aware of when designing your integration:

### Customer Metadata

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Custom metadata on customers | ✅ Full support | ⚠️ Limited |
| Arbitrary key-value pairs | ✅ Up to 50 keys | ❌ Not supported |
| Searchable metadata | ✅ Yes | ❌ No |

**Workaround**: Store extended customer data in your own database linked by `provider_customer_id`.

### Split Payments (Marketplace)

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Split payments | ✅ Stripe Connect | ⚠️ v2 (prepared) |
| Application fees | ✅ Yes | ⚠️ v2 (prepared) |
| Direct charges | ✅ Yes | ⚠️ v2 (prepared) |
| Destination charges | ✅ Yes | ⚠️ v2 (prepared) |

**Note**: Split payments are prepared in the adapter but not yet implemented. Use the MercadoPago API directly for now:
```typescript
// For split payments, use MercadoPago SDK directly
// See: https://www.mercadopago.com.ar/developers/en/docs/split-payments
```

### Subscription Features

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Trial periods | ✅ Native | ✅ Via preapproval |
| Proration | ✅ Automatic | ❌ Manual handling |
| Pause/resume | ✅ Native | ⚠️ Via status update |
| Multiple items | ✅ Yes | ❌ One price per subscription |
| Quantity changes | ✅ Yes | ❌ Not supported |
| Usage-based billing | ✅ Metered | ❌ Not supported |

**Workaround for proration**: Calculate prorated amounts manually and apply as credits or adjustments.

### Webhook/IPN Differences

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Signature algorithm | HMAC-SHA256 | HMAC-SHA256 |
| Timestamp validation | ✅ 5 min tolerance | ⚠️ Manual |
| Retry mechanism | ✅ Automatic | ✅ Automatic |
| Event types | ~100+ types | ~20 types |
| Test mode events | ✅ Yes | ✅ Yes |

### Payment Methods

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Credit cards | ✅ Global | ✅ Regional (LATAM) |
| Debit cards | ✅ Yes | ✅ Yes |
| Bank transfers | ✅ ACH, SEPA | ✅ Regional |
| PIX (Brazil) | ❌ No | ✅ Yes |
| Boleto (Brazil) | ❌ No | ✅ Yes |
| PSE (Colombia) | ❌ No | ✅ Yes |
| OXXO (Mexico) | ❌ No | ✅ Yes |

### Currency Support

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Multi-currency | ✅ 135+ currencies | ⚠️ Regional currencies |
| Currency conversion | ✅ Automatic | ❌ Local only |

**Supported MercadoPago currencies**: ARS, BRL, CLP, COP, MXN, PEN, UYU, VES

### API Rate Limits

| Provider | Limits |
|----------|--------|
| Stripe | 100 req/sec per key (live), 25 req/sec (test) |
| MercadoPago | Not publicly documented, be conservative |

### Refund Policies

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Partial refunds | ✅ Yes | ✅ Yes |
| Multiple refunds | ✅ Yes | ✅ Yes |
| Refund window | 90 days | Varies by payment method |
| Refund to different card | ❌ No | ❌ No |

## Migration from Stripe

If you're considering migrating from Stripe to MercadoPago (or supporting both), here are key considerations:

### 1. Customer Migration

```typescript
// Stripe customer
const stripeCustomer = await stripe.customers.retrieve('cus_xxx');

// Create in MercadoPago (without metadata)
const mpCustomer = await mpAdapter.customers.create({
  email: stripeCustomer.email,
  name: stripeCustomer.name,
  externalId: `migrated_${stripeCustomer.id}`
});

// Store mapping in your database
await db.insert(customerMappings).values({
  stripeId: stripeCustomer.id,
  mercadoPagoId: mpCustomer,
  metadata: stripeCustomer.metadata // Store locally
});
```

### 2. Subscription Migration

```typescript
// Subscriptions need to be recreated
// MercadoPago preapprovals are different from Stripe subscriptions

const subscription = await mpAdapter.subscriptions.create(mpCustomerId, {
  priceId: yourPriceMapping[stripeSubscription.items[0].price.id]
});

// Handle existing billing cycle manually
```

### 3. Webhook Mapping

| Stripe Event | MercadoPago Event |
|--------------|-------------------|
| `payment_intent.succeeded` | `payment.updated` (status=approved) |
| `payment_intent.payment_failed` | `payment.updated` (status=rejected) |
| `customer.subscription.created` | `subscription_preapproval.created` |
| `customer.subscription.updated` | `subscription_preapproval.updated` |
| `invoice.paid` | `subscription_authorized_payment.created` |

## Best Practices

### 1. Always Store Provider IDs

```typescript
// Store both internal and provider IDs
const customer = await billing.customers.create({
  email: 'user@example.com',
  externalId: 'your_user_123'
});

// customer.providerCustomerId contains MercadoPago ID
await db.update(users)
  .set({ mpCustomerId: customer.providerCustomerId })
  .where(eq(users.id, 'your_user_123'));
```

### 2. Handle 3DS Properly

```typescript
// Always check for 3DS requirement in payment flow
const payment = await mpAdapter.payments.create(customerId, options);

if (payment.status === 'pending' && payment.statusDetail === 'pending_challenge') {
  // Return challenge URL to frontend
  return { status: 'requires_action', challengeUrl: payment.initPoint };
}
```

### 3. Implement Idempotency

```typescript
// Use external_reference for idempotency
const payment = await mpAdapter.payments.create(customerId, {
  amount: 10000,
  currency: 'ARS',
  metadata: {
    orderId: 'order_123',
    idempotencyKey: `payment_${orderId}_${Date.now()}`
  }
});
```

## Error Handling

```typescript
import { QZPayError } from '@qazuor/qzpay-core';

try {
  await mpAdapter.payments.create(customerId, options);
} catch (error) {
  if (error instanceof QZPayError) {
    switch (error.code) {
      case 'PAYMENT_REJECTED':
        // Handle card rejection
        break;
      case 'INSUFFICIENT_FUNDS':
        // Handle insufficient funds
        break;
      case 'RATE_LIMIT':
        // Implement backoff
        break;
      default:
        // Log and handle generic error
    }
  }
}
```

## Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `cc_rejected_insufficient_amount` | Insufficient funds | Ask for different card |
| `cc_rejected_bad_filled_security_code` | Invalid CVV | Re-enter card details |
| `cc_rejected_card_expired` | Card expired | Use different card |
| `cc_rejected_blacklist` | Card blocked | Contact issuer |
| `cc_rejected_other_reason` | Generic rejection | Try different payment method |

## v2 Features (Coming Soon)

- **Split Payments**: Full marketplace support
- **Application Fees**: Platform commission handling
- **Multi-Seller**: Advanced marketplace features
- **Enhanced Webhooks**: More event types

## License

MIT
