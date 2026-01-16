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
- **Error Handling**: Comprehensive error mapping with QZPayMercadoPagoError
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

#### First-time Payment (with token)

```typescript
// Create a payment with a token (generated on frontend)
const payment = await mpAdapter.payments.create('customer_mp_id', {
  amount: 10000, // $100.00 in cents
  currency: 'ARS',
  token: 'card_token_from_frontend', // From MercadoPago.js
  paymentMethodId: 'visa', // or 'master', 'pix', etc.
  saveCard: true // Optional: save card for future use
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

#### Recurring Payment (with saved card)

```typescript
// Charge a previously saved card
// The adapter automatically generates a new token from the card_id
const payment = await mpAdapter.payments.create('customer_mp_id', {
  amount: 10000, // $100.00 in cents
  currency: 'ARS',
  cardId: 'saved_card_id_123', // Previously saved card
  paymentMethodId: 'visa', // Optional
  installments: 1 // Optional
});
```

### Checkout Sessions

```typescript
// Create a checkout session with optional notification URL
const checkout = await mpAdapter.checkout.create(
  {
    mode: 'payment',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    lineItems: [{ priceId: 'price_1', quantity: 1, description: 'Product' }],
    notificationUrl: 'https://example.com/webhooks/mercadopago', // Optional webhook URL
    customerEmail: 'customer@example.com', // Optional
    expiresInMinutes: 30 // Optional expiration
  },
  ['price_1'] // Provider price IDs
);

console.log('Checkout URL:', checkout.url);

// Retrieve checkout session
const session = await mpAdapter.checkout.retrieve(checkout.id);

// Expire a checkout session
await mpAdapter.checkout.expire(checkout.id);
```

**Notification URL**: When provided, MercadoPago will send IPN (Instant Payment Notification) events to this URL for payment status updates. This is useful for tracking payment completion server-side.

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

### Saved Card Service

Unified service for saving and managing payment cards with a consistent API.

```typescript
import { createSavedCardService } from '@qazuor/qzpay-mercadopago';

// Create the service
const cardService = createSavedCardService({
  provider: 'mercadopago',
  mercadopagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  getProviderCustomerId: async (customerId) => {
    // Resolve your local customer ID to MercadoPago customer ID
    const customer = await db.customers.findById(customerId);
    return customer.mercadopagoCustomerId;
  },
});

// Save a card from token (created on frontend with MercadoPago.js)
const card = await cardService.save({
  customerId: 'local_cus_123',
  token: 'card_token_xxx', // From MercadoPago.createCardToken()
  setAsDefault: true, // Note: App must track this separately
});

console.log(`Card saved: ${card.brand} ending in ${card.last4}`);
console.log(`First 6 digits: ${card.firstSixDigits}`); // Available in MercadoPago

// List all saved cards
const cards = await cardService.list('local_cus_123');
cards.forEach((card) => {
  console.log(`${card.brand} ${card.firstSixDigits}****${card.last4}`);
});

// Remove a card
await cardService.remove('local_cus_123', 'card_id_xxx');

// Note: setDefault() throws an error for MercadoPago
// You must track the default card in your application database
```

#### Frontend Integration

```javascript
// Create card token on frontend using MercadoPago.js
const mp = new MercadoPago('PUBLIC_KEY');
const cardForm = mp.cardForm({
  amount: '100.5',
  iframe: true,
  form: {
    id: 'form-checkout',
    cardNumber: {
      id: 'form-checkout__cardNumber',
      placeholder: 'Card number',
    },
    expirationDate: {
      id: 'form-checkout__expirationDate',
      placeholder: 'MM/YY',
    },
    securityCode: {
      id: 'form-checkout__securityCode',
      placeholder: 'CVV',
    },
    cardholderName: {
      id: 'form-checkout__cardholderName',
      placeholder: 'Cardholder name',
    },
    issuer: {
      id: 'form-checkout__issuer',
      placeholder: 'Issuer',
    },
    installments: {
      id: 'form-checkout__installments',
      placeholder: 'Installments',
    },
    identificationType: {
      id: 'form-checkout__identificationType',
      placeholder: 'Document type',
    },
    identificationNumber: {
      id: 'form-checkout__identificationNumber',
      placeholder: 'Document number',
    },
  },
  callbacks: {
    onFormMounted: error => {
      if (error) return console.warn('Form mounted handling error: ', error);
      console.log('Form mounted');
    },
    onSubmit: event => {
      event.preventDefault();
      const { token } = cardForm.getCardFormData();

      // Send token to backend
      fetch('/api/cards/save', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'local_cus_123',
          token: token,
          setAsDefault: true,
        }),
      });
    },
  },
});
```

#### SavedCard Type

```typescript
interface SavedCard {
  id: string;                    // Card ID
  customerId: string;            // Your local customer ID
  providerCustomerId: string;    // MercadoPago customer ID
  provider: 'mercadopago';
  last4: string;                 // Last 4 digits
  brand: string;                 // visa, master, amex, etc.
  expMonth: number;              // 1-12
  expYear: number;               // 4 digits
  isDefault: boolean;            // Always false (track in your DB)
  cardholderName?: string;       // Cardholder name
  firstSixDigits?: string;       // First 6 digits (MercadoPago specific)
  createdAt: Date;               // When the card was saved
}
```

#### Important Notes on Default Payment Method

MercadoPago doesn't have a native concept of default payment method at the API level. This means:

1. The `isDefault` field will always be `false` when listing cards
2. The `setAsDefault()` method will throw an error
3. Your application must track the default card ID in your database

**Example Database Schema:**

```typescript
interface Customer {
  id: string;
  email: string;
  mercadopagoCustomerId: string;
  defaultMercadoPagoCardId?: string; // Track this yourself
}
```

**When Creating Payments:**

```typescript
// Get customer's default card from your database
const customer = await db.customers.findById(customerId);

if (!customer.defaultMercadoPagoCardId) {
  throw new Error('Customer has no default payment method');
}

// Create payment with explicit card ID
// The adapter will automatically generate a new token from the saved card
const payment = await mpAdapter.payments.create(
  customer.mercadopagoCustomerId,
  {
    amount: 1000,
    currency: 'ARS',
    cardId: customer.defaultMercadoPagoCardId, // Use your tracked card ID
  }
);
```

#### Card on File Payment Flow

When using saved cards for recurring payments, QZPay automatically handles token generation:

```typescript
// 1. Customer saves a card (first time)
const savedCard = await mpAdapter.customers.saveCard(
  customer.mercadopagoCustomerId,
  'card_token_from_frontend'
);

// Store card ID in your database
await db.update(customers)
  .set({ defaultMercadoPagoCardId: savedCard.id })
  .where(eq(customers.id, customerId));

// 2. Later, charge the saved card (recurring payment)
// The adapter automatically:
// - Generates a new card token from the saved card_id using CardToken API
// - Uses that token to create the payment
const payment = await mpAdapter.payments.create(
  customer.mercadopagoCustomerId,
  {
    amount: 2999, // $29.99 in cents
    currency: 'ARS',
    cardId: savedCard.id, // Saved card ID
    paymentMethodId: 'visa', // Optional
    installments: 1 // Optional, default 1
  }
);

// 3. The payment is processed with the saved card
console.log(`Payment ${payment.id} - Status: ${payment.status}`);
```

**Technical Details:**

Under the hood, when you provide `cardId`, the adapter:
1. Calls the MercadoPago CardToken API with the `card_id`
2. Receives a new single-use token
3. Uses that token to create the payment
4. Stores the original `card_id` in payment metadata for tracking

This is the recommended MercadoPago flow for Card on File payments.

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

### Saved Cards

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Save card | ✅ PaymentMethod | ✅ Card token |
| List saved cards | ✅ Yes | ✅ Yes |
| Remove card | ✅ Yes | ✅ Yes |
| Default payment method | ✅ Native API support | ❌ Not supported |
| First 6 digits | ❌ No | ✅ Available |

**Workaround for default card**: Track the default card ID in your application database. See the "Saved Card Service" section for implementation details.

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

All MercadoPago adapters now include comprehensive error handling:

```typescript
import { QZPayMercadoPagoError, QZPayErrorCode } from '@qazuor/qzpay-mercadopago';

try {
  const payment = await mpAdapter.payments.create(customerId, {
    amount: 10000,
    currency: 'ARS',
    paymentMethodId: 'visa'
  });
} catch (error) {
  if (error instanceof QZPayMercadoPagoError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Status detail:', error.statusDetail);
    console.log('Original error:', error.originalError);

    switch (error.code) {
      case QZPayErrorCode.CARD_DECLINED:
        // Handle card declined
        // Check error.statusDetail for specific reason
        break;
      case QZPayErrorCode.INSUFFICIENT_FUNDS:
        // Handle insufficient funds
        break;
      case QZPayErrorCode.INVALID_CARD:
        // Handle invalid card details
        break;
      case QZPayErrorCode.AUTHENTICATION_ERROR:
        // Handle API authentication issues
        break;
      case QZPayErrorCode.RATE_LIMIT_ERROR:
        // Implement backoff strategy
        break;
      case QZPayErrorCode.RESOURCE_NOT_FOUND:
        // Handle not found errors
        break;
      default:
        // Handle other provider errors
    }
  }
}
```

### Error Mapping

The adapter maps MercadoPago errors to standardized QZPay error codes:

```typescript
// MercadoPago status_detail -> QZPayErrorCode
const errorMap = {
  'cc_rejected_insufficient_amount': 'insufficient_funds',
  'cc_rejected_bad_filled_card_number': 'invalid_card',
  'cc_rejected_bad_filled_security_code': 'invalid_card',
  'cc_rejected_blacklist': 'card_declined',
  'cc_rejected_high_risk': 'card_declined',
  'cc_rejected_duplicated_payment': 'duplicate_transaction',
  // ... and many more
};

// All adapters wrap operations with error mapping
try {
  return await operation();
} catch (error) {
  throw mapMercadoPagoError(error, 'CustomerAdapter.create');
}
```

### Fixed Issues

1. **Payer Email in Subscriptions**: Now properly fetches and includes customer email when creating preapprovals.
2. **Checkout Prices**: Fixed unit_price and currency_id extraction from price objects.
3. **Try/Catch Coverage**: All adapter methods now have proper error handling.

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
