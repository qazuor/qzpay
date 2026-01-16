# @qazuor/qzpay-core

Core types, services, and utilities for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-core
```

## Features

- **Type System**: Comprehensive TypeScript types for billing entities
- **QZPayBilling**: Main billing class with all operations
- **Services**: Payment, subscription, invoice, checkout, and more
- **Metrics Service**: MRR, churn, and revenue calculations
- **Health Service**: System health monitoring
- **Logger**: Structured logging with customizable providers
- **Input Validation**: Zod-based validation for all create operations
- **Promo Code Validation**: Full validation with plan applicability and usage limits
- **Utilities**: Date, money, validation, and hash helpers
- **Runtime Agnostic**: Works in Node.js, Bun, Deno, and Edge runtimes (no direct `process.env` access)

## Quick Start

```typescript
import { QZPayBilling, createDefaultLogger } from '@qazuor/qzpay-core';

const billing = new QZPayBilling({
  storage: storageAdapter,
  paymentAdapter: paymentAdapter,
  logger: createDefaultLogger({ level: 'info' })
});
```

## Usage

### Customer Operations

```typescript
// Create customer
const customer = await billing.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  externalId: 'user_123'
});

// Get customer
const customer = await billing.customers.get('cus_123');

// Update customer
await billing.customers.update('cus_123', { name: 'Jane Doe' });

// Delete customer
await billing.customers.delete('cus_123');
```

### Subscription Operations

```typescript
// Create subscription
const subscription = await billing.subscriptions.create({
  customerId: 'cus_123',
  priceId: 'price_123',
  trialDays: 14
});

// Get subscription
const sub = await billing.subscriptions.get('sub_123');

// Update subscription (change plan)
await billing.subscriptions.update('sub_123', {
  priceId: 'price_premium'
});

// Cancel subscription
await billing.subscriptions.cancel('sub_123');
```

### Payment Operations

```typescript
// Process a payment
const payment = await billing.payments.process({
  customerId: 'cus_123',
  amount: 2999, // $29.99 in cents
  currency: 'USD',
  paymentMethodId: 'pm_123'
});

// Retrieve payment
const status = await billing.payments.get('pay_123');

// Get payments by customer
const payments = await billing.payments.getByCustomerId('cus_123');

// Record an external payment (already processed by provider)
const recorded = await billing.payments.record({
  id: 'pay_external_123',
  customerId: 'cus_123',
  amount: 2999,
  currency: 'USD',
  status: 'succeeded',
  providerPaymentId: 'pi_xxx',
  provider: 'stripe'
});

// Refund payment
await billing.payments.refund({
  paymentId: 'pay_123',
  amount: 1500, // Optional: partial refund
  reason: 'requested_by_customer'
});
```

### Events

```typescript
billing.on('customer.created', (event) => {
  console.log('Customer created:', event.data);
});

billing.on('subscription.created', (event) => {
  console.log('Subscription created:', event.data);
});

billing.on('payment.succeeded', (event) => {
  console.log('Payment succeeded:', event.data);
});
```

### Metrics

The `billing.metrics` service provides business intelligence and analytics:

```typescript
// Get Monthly Recurring Revenue
const mrr = await billing.metrics.getMrr({ currency: 'USD' });
console.log('Current MRR:', mrr.currentMrr);
console.log('Previous MRR:', mrr.previousMrr);
console.log('Net New MRR:', mrr.netNewMrr);

// Get subscription metrics by status
const subMetrics = await billing.metrics.getSubscriptionMetrics();
console.log('Active:', subMetrics.active);
console.log('Trialing:', subMetrics.trialing);
console.log('Canceled:', subMetrics.canceled);
console.log('Past Due:', subMetrics.pastDue);

// Get revenue metrics for a period
const revenue = await billing.metrics.getRevenueMetrics({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  currency: 'USD'
});
console.log('Total Revenue:', revenue.totalRevenue);
console.log('Refunds:', revenue.totalRefunds);

// Get churn metrics
const churn = await billing.metrics.getChurnMetrics({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
console.log('Churn Rate:', churn.churnRate);
console.log('Churned MRR:', churn.churnedMrr);

// Get all dashboard metrics aggregated
const dashboard = await billing.metrics.getDashboard({
  currency: 'USD'
});
console.log('Dashboard:', dashboard);
```

### Health Checks

```typescript
import { createHealthService } from '@qazuor/qzpay-core';

const health = createHealthService({
  storage: storageAdapter,
  paymentAdapter: paymentAdapter,
  logger: logger
});

// Get full health status
const status = await health.getHealthStatus();
console.log('Status:', status.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Components:', status.components);

// Quick health check
const isHealthy = await health.isHealthy();
```

### Structured Logging

```typescript
import { createDefaultLogger, noopLogger } from '@qazuor/qzpay-core';

// Console-based logger with options
// Note: This package does NOT read process.env - you control all configuration
const isProduction = process.env.NODE_ENV === 'production';

const logger = createDefaultLogger({
  level: isProduction ? 'warn' : 'debug',
  colorize: !isProduction, // Disable colors in production
  timestamps: true
});

// Use with billing
const billing = new QZPayBilling({
  storage,
  paymentAdapter,
  logger
});

// Or bring your own logger (pino, winston, etc.)
import pino from 'pino';

const pinoLogger = pino();
const billing = new QZPayBilling({
  storage,
  paymentAdapter,
  logger: {
    debug: (msg, meta) => pinoLogger.debug(meta, msg),
    info: (msg, meta) => pinoLogger.info(meta, msg),
    warn: (msg, meta) => pinoLogger.warn(meta, msg),
    error: (msg, meta) => pinoLogger.error(meta, msg)
  }
});
```

## Services

| Service | Description |
|---------|-------------|
| `billing.customers` | Customer management |
| `billing.subscriptions` | Subscription lifecycle |
| `billing.payments` | Payment processing |
| `billing.invoices` | Invoice management |
| `billing.plans` | Plan configuration |
| `billing.promoCodes` | Promotional codes |
| `billing.entitlements` | Feature entitlements |
| `billing.limits` | Usage limits |
| `billing.addons` | Add-on management |
| `billing.paymentMethods` | Payment method management |
| `billing.metrics` | Business metrics and analytics |

### Entitlements Service

Manage feature access based on subscriptions:

```typescript
// Check if customer has an entitlement
const hasAccess = await billing.entitlements.check('cus_123', 'advanced_analytics');
if (hasAccess) {
  // Show advanced analytics
}

// Get all entitlements for a customer
const entitlements = await billing.entitlements.getByCustomerId('cus_123');

// Grant an entitlement manually
await billing.entitlements.grant('cus_123', 'beta_features', 'manual', 'admin_grant');

// Revoke an entitlement
await billing.entitlements.revoke('cus_123', 'beta_features');
```

### Limits Service

Track and enforce usage limits:

```typescript
// Check if customer is within limit
const result = await billing.limits.check('cus_123', 'api_calls');
console.log('Allowed:', result.allowed);
console.log('Current:', result.currentValue);
console.log('Max:', result.maxValue);
console.log('Remaining:', result.remaining);

// Get all limits for a customer
const limits = await billing.limits.getByCustomerId('cus_123');

// Increment usage
await billing.limits.increment('cus_123', 'api_calls', 1);

// Set a limit value
await billing.limits.set('cus_123', 'api_calls', 10000);

// Record usage (for audit/history)
await billing.limits.recordUsage('cus_123', 'api_calls', 5, 'increment');
```

### Add-ons Service

Manage subscription add-ons:

```typescript
// Create an add-on definition
const addon = await billing.addons.create({
  name: 'Extra Storage',
  unitAmount: 500, // $5.00 in cents
  currency: 'USD',
  billingInterval: 'month',
  compatiblePlanIds: ['plan_pro', 'plan_enterprise']
});

// Get add-ons compatible with a plan
const addons = await billing.addons.getByPlanId('plan_pro');

// Add an add-on to a subscription
const result = await billing.addons.addToSubscription({
  subscriptionId: 'sub_123',
  addOnId: 'addon_extra_storage',
  quantity: 2
});
console.log('Proration amount:', result.prorationAmount);

// Get add-ons attached to a subscription
const subscriptionAddons = await billing.addons.getBySubscriptionId('sub_123');

// Update add-on quantity
await billing.addons.updateSubscriptionAddOn('sub_123', 'addon_extra_storage', {
  quantity: 5
});

// Remove add-on from subscription
await billing.addons.removeFromSubscription('sub_123', 'addon_extra_storage');
```

### Payment Methods Service

Manage customer payment methods:

```typescript
// Create a payment method
const paymentMethod = await billing.paymentMethods.create({
  customerId: 'cus_123',
  type: 'card',
  providerPaymentMethodId: 'pm_xxx',
  provider: 'stripe',
  card: {
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2025
  },
  setAsDefault: true
});

// Get payment methods for a customer
const methods = await billing.paymentMethods.getByCustomerId('cus_123');

// Get the default payment method
const defaultMethod = await billing.paymentMethods.getDefault('cus_123');

// Set a payment method as default
await billing.paymentMethods.setDefault('cus_123', 'pm_456');

// Update a payment method
await billing.paymentMethods.update('pm_123', {
  card: { expMonth: 1, expYear: 2026 }
});

// Delete a payment method
await billing.paymentMethods.delete('pm_123');
```

### Saved Card Service

Unified interface for saving and managing payment cards across providers.

```typescript
import { createSavedCardService } from '@qazuor/qzpay-stripe'; // or '@qazuor/qzpay-mercadopago'

const cardService = createSavedCardService({
  provider: 'stripe',
  stripeSecretKey: 'sk_xxx',
  getProviderCustomerId: async (customerId) => {
    const customer = await db.customers.findById(customerId);
    return customer.stripeCustomerId;
  },
});

// Save a card
const card = await cardService.save({
  customerId: 'local_cus_123',
  paymentMethodId: 'pm_xxx', // From Stripe.js
  setAsDefault: true,
});

// List all cards
const cards = await cardService.list('local_cus_123');

// Set card as default (Stripe only)
await cardService.setDefault('local_cus_123', 'pm_xxx');

// Remove a card
await cardService.remove('local_cus_123', 'pm_xxx');
```

**Provider Differences:**

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Save card | `paymentMethodId` | `token` |
| List cards | ✅ | ✅ |
| Remove card | ✅ | ✅ |
| Set default | ✅ Native | ❌ Track in your DB |

**Note:** MercadoPago doesn't support default payment methods natively. Your application must track the default card ID in its database.

### Subscription Lifecycle Service

Automates subscription renewals, trial conversions, and payment retries.

```typescript
import { createSubscriptionLifecycle } from '@qazuor/qzpay-core';

const lifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 7,
  retryIntervals: [1, 3, 5], // Retry after 1, 3, and 5 days
  trialConversionDays: 0, // Convert immediately when trial ends

  // Process payment callback
  processPayment: async (input) => {
    const result = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      customer: await getStripeCustomerId(input.customerId),
      payment_method: input.paymentMethodId,
      confirm: true,
      off_session: true,
    });
    return {
      success: result.status === 'succeeded',
      paymentId: result.id,
      error: result.last_payment_error?.message,
    };
  },

  // Get default payment method callback
  getDefaultPaymentMethod: async (customerId) => {
    const pm = await db.paymentMethods.findDefault(customerId);
    return pm ? {
      id: pm.id,
      providerPaymentMethodId: pm.stripePaymentMethodId
    } : null;
  },

  // Optional: event callback for logging/notifications
  onEvent: async (event) => {
    console.log(`[${event.type}] Subscription: ${event.subscriptionId}`);

    // Send notifications
    if (event.type === 'subscription.renewal_failed') {
      await sendEmail({
        to: customer.email,
        subject: 'Payment Failed',
        body: 'Your subscription payment failed. Please update your payment method.'
      });
    }
  },
});

// Run from a cron job
const results = await lifecycle.processAll();
console.log('Renewals:', results.renewals);
console.log('Trial conversions:', results.trialConversions);
console.log('Retries:', results.retries);
console.log('Cancellations:', results.cancellations);

// Or run individual operations
await lifecycle.processRenewals();
await lifecycle.processTrialConversions();
await lifecycle.processRetries();
await lifecycle.processCancellations();
```

**Lifecycle Events:**

- `subscription.renewed` - Subscription successfully renewed
- `subscription.renewal_failed` - Renewal payment failed
- `subscription.trial_converted` - Trial converted to paid
- `subscription.trial_conversion_failed` - Trial conversion failed
- `subscription.entered_grace_period` - Entered grace period after failed payment
- `subscription.retry_scheduled` - Payment retry scheduled
- `subscription.retry_succeeded` - Retry payment succeeded
- `subscription.retry_failed` - All retries exhausted
- `subscription.canceled_nonpayment` - Canceled due to non-payment

**Cron Setup Example:**

```typescript
// Run every hour
cron.schedule('0 * * * *', async () => {
  const results = await lifecycle.processAll();
  console.log(`Processed ${results.renewals.processed} renewals`);
});
```

## Utility Functions

### Date Utilities

```typescript
import { addDays, addMonths, startOfMonth, endOfMonth } from '@qazuor/qzpay-core';

const nextMonth = addMonths(new Date(), 1);
const periodStart = startOfMonth(new Date());
const periodEnd = endOfMonth(new Date());
```

### Money Utilities

```typescript
import { formatMoney, centsToDecimal, decimalToCents } from '@qazuor/qzpay-core';

const formatted = formatMoney(2999, 'USD'); // '$29.99'
const decimal = centsToDecimal(2999); // 29.99
const cents = decimalToCents(29.99); // 2999
```

### Validation Utilities

```typescript
import { isValidEmail, isValidCurrency, isValidAmount } from '@qazuor/qzpay-core';

isValidEmail('user@example.com'); // true
isValidCurrency('USD'); // true
isValidAmount(100); // true
isValidAmount(-50); // false
```

### Input Validation

All create operations now include comprehensive Zod validation:

```typescript
// Customer creation with validation
try {
  const customer = await billing.customers.create({
    email: 'invalid-email', // Will throw validation error
    name: 'John Doe'
  });
} catch (error) {
  // error.code === 'VALIDATION_ERROR'
  // error.details contains validation failure info
}

// Payment with validation
await billing.payments.process({
  customerId: 'cus_123',
  amount: -100, // Will throw validation error (negative amount)
  currency: 'INVALID' // Will throw validation error (invalid currency)
});

// Invoice creation with validation
await billing.invoices.create({
  customerId: 'cus_123',
  items: [] // Will throw validation error (empty items array)
});
```

### Promo Code Validation

Promo codes are validated against multiple criteria:

```typescript
// The system automatically validates:
// 1. Plan applicability
const promoCode = await billing.promoCodes.create({
  code: 'SUMMER2024',
  discountType: 'percentage',
  discountValue: 20,
  applicablePlans: ['plan_premium', 'plan_enterprise'] // Only works for these plans
});

// 2. Per-customer usage limits
await billing.promoCodes.validate({
  code: 'SUMMER2024',
  customerId: 'cus_123',
  planId: 'plan_basic' // Will fail if not in applicablePlans
});

// 3. Date ranges
await billing.promoCodes.create({
  code: 'NEWYEAR2024',
  validFrom: new Date('2024-01-01'),
  validTo: new Date('2024-01-31') // Only valid in January
});

// 4. Max uses and active status
await billing.promoCodes.create({
  code: 'LIMITED',
  maxUses: 100, // Can only be used 100 times total
  maxUsesPerCustomer: 1, // Each customer can use it once
  active: true // Must be active
});
```

## Types

### Core Types

```typescript
import type {
  // Entities
  QZPayCustomer,
  QZPaySubscription,
  QZPayPayment,
  QZPayInvoice,
  QZPayPlan,
  QZPayPrice,
  QZPayPromoCode,
  QZPayAddon,

  // Inputs
  QZPayCreateCustomerInput,
  QZPayCreateSubscriptionInput,
  QZPayCreatePaymentInput,
  QZPayCreateInvoiceInput,

  // Events
  QZPayWebhookEvent,
  QZPayBillingEvent,

  // Config
  QZPayBillingConfig,
  QZPayLogger,
  QZPayLogLevel
} from '@qazuor/qzpay-core';
```

### Adapter Interfaces

```typescript
import type {
  QZPayPaymentAdapter,
  QZPayStorageAdapter,
  QZPayPaymentCustomerAdapter,
  QZPayPaymentSubscriptionAdapter,
  QZPayPaymentPaymentAdapter,
  QZPayWebhookAdapter
} from '@qazuor/qzpay-core';
```

## Architecture

```
@qazuor/qzpay-core
├── QZPayBilling          # Main billing orchestrator
├── Adapters              # Abstract interfaces for providers
│   ├── Storage           # Database operations
│   └── Payment           # Payment provider operations
├── Services
│   ├── metrics.service   # MRR, churn, revenue
│   ├── health.service    # System health
│   ├── checkout.service  # Checkout flows
│   ├── discount.service  # Discount calculations
│   └── ...
├── Utils
│   ├── default-logger    # Console logger
│   ├── date.utils        # Date helpers
│   ├── money.utils       # Money formatting
│   └── validation.utils  # Input validation
└── Types                 # TypeScript definitions
```

## License

MIT
