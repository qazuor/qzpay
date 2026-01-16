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

## Limitations

### Subscriptions

**Single-Item Subscriptions Only**: This adapter currently supports only one price per subscription. While Stripe allows multiple items per subscription, this adapter is designed for single-item subscriptions to maintain simplicity and align with common use cases.

- **Supported**: Creating and updating subscriptions with one price
- **Not Supported**: Multiple prices in a single subscription
- **Future Support**: Multi-item subscriptions will be added in a future version if needed

If you need multi-item subscriptions, consider using Stripe's API directly or contact the maintainers to discuss your use case.

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

### Saved Card Service

Unified service for saving and managing payment cards with a consistent API.

```typescript
import { createSavedCardService } from '@qazuor/qzpay-stripe';

// Create the service
const cardService = createSavedCardService({
  provider: 'stripe',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  getProviderCustomerId: async (customerId) => {
    // Resolve your local customer ID to Stripe customer ID
    const customer = await db.customers.findById(customerId);
    return customer.stripeCustomerId;
  },
});

// Save a card from PaymentMethod ID (created on frontend with Stripe.js)
const card = await cardService.save({
  customerId: 'local_cus_123',
  paymentMethodId: 'pm_xxx', // From stripe.createPaymentMethod()
  setAsDefault: true,
  metadata: {
    source: 'web-app',
    savedAt: new Date().toISOString(),
  },
});

console.log(`Card saved: ${card.brand} ending in ${card.last4}`);

// List all saved cards
const cards = await cardService.list('local_cus_123');
cards.forEach((card) => {
  console.log(`${card.brand} ****${card.last4} - ${card.isDefault ? 'Default' : 'Not default'}`);
});

// Set a different card as default
await cardService.setDefault('local_cus_123', 'pm_yyy');

// Remove a card
await cardService.remove('local_cus_123', 'pm_xxx');
```

#### Frontend Integration

```javascript
// Create PaymentMethod on frontend using Stripe.js
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: {
    name: 'John Doe',
  },
});

if (error) {
  console.error('Error creating payment method:', error);
} else {
  // Send PaymentMethod ID to backend
  await fetch('/api/cards/save', {
    method: 'POST',
    body: JSON.stringify({
      customerId: 'local_cus_123',
      paymentMethodId: paymentMethod.id,
      setAsDefault: true,
    }),
  });
}
```

#### SavedCard Type

```typescript
interface SavedCard {
  id: string;                    // PaymentMethod ID
  customerId: string;            // Your local customer ID
  providerCustomerId: string;    // Stripe customer ID
  provider: 'stripe';
  last4: string;                 // Last 4 digits
  brand: string;                 // visa, mastercard, amex, etc.
  expMonth: number;              // 1-12
  expYear: number;               // 4 digits
  isDefault: boolean;            // Is default payment method
  cardholderName?: string;       // Cardholder name
  createdAt: Date;               // When the card was saved
}
```

## Configuration

```typescript
interface QZPayStripeConfig {
  client: Stripe;
  livemode: boolean;
  connect?: QZPayStripeConnectConfig; // For marketplace (v2)
}
```

### Invoices

Manage Stripe invoices with comprehensive operations:

```typescript
import { QZPayStripeInvoiceAdapter } from '@qazuor/qzpay-stripe';

const invoiceAdapter = new QZPayStripeInvoiceAdapter(stripe);

// List customer invoices
const invoices = await invoiceAdapter.list('cus_123', {
  limit: 10
});

// Retrieve a specific invoice
const invoice = await invoiceAdapter.retrieve('in_123');

// Mark invoice as paid (outside of Stripe)
const paidInvoice = await invoiceAdapter.markPaid('in_123');

// Finalize a draft invoice
const finalizedInvoice = await invoiceAdapter.finalize('in_draft');

// Void an invoice
const voidedInvoice = await invoiceAdapter.void('in_123');

// Send invoice to customer
const sentInvoice = await invoiceAdapter.send('in_123');
```

#### Invoice Data Structure

```typescript
interface QZPayProviderInvoice {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  status: string; // 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: Date | null;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  metadata: Record<string, string>;
}
```

#### Pagination

```typescript
// Paginate through invoices
const firstPage = await invoiceAdapter.list('cus_123', {
  limit: 10
});

const nextPage = await invoiceAdapter.list('cus_123', {
  limit: 10,
  startingAfter: firstPage[firstPage.length - 1].id
});

const previousPage = await invoiceAdapter.list('cus_123', {
  limit: 10,
  endingBefore: firstPage[0].id
});
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
- `stripeAdapter.invoices` - Invoice operations
- `stripeAdapter.vendors` - Vendor operations (marketplace)

## License

MIT
