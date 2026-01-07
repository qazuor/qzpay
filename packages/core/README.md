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
// Create payment
const payment = await billing.payments.create({
  customerId: 'cus_123',
  amount: 2999, // $29.99 in cents
  currency: 'USD',
  paymentMethodId: 'pm_123'
});

// Retrieve payment
const status = await billing.payments.get('pay_123');

// Refund payment
await billing.payments.refund('pay_123', { amount: 1500 });
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

```typescript
import { createMetricsService } from '@qazuor/qzpay-core';

const metrics = createMetricsService({ storage });

// Get MRR
const mrr = await metrics.getMRR({ currency: 'USD' });
console.log('Current MRR:', mrr.current);

// Get churn rate
const churn = await metrics.getChurnRate({
  from: new Date('2024-01-01'),
  to: new Date('2024-12-31')
});

// Get revenue metrics
const revenue = await metrics.getRevenueMetrics({
  from: new Date('2024-01-01'),
  to: new Date('2024-12-31'),
  currency: 'USD'
});
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
| `billing.prices` | Price management |
| `billing.promoCodes` | Promotional codes |
| `billing.entitlements` | Feature entitlements |
| `billing.limits` | Usage limits |
| `billing.addons` | Add-on management |

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
