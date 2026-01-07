# @qazuor/qzpay

[![npm version](https://img.shields.io/npm/v/@qazuor/qzpay-core.svg)](https://www.npmjs.com/package/@qazuor/qzpay-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)

Universal billing and payments library for Node.js applications. Provider-agnostic billing system with support for subscriptions, one-time payments, usage-based billing, and more.

## Why @qazuor/qzpay?

- **Unified API**: One consistent interface for Stripe and MercadoPago
- **Framework Agnostic**: Works with Hono, NestJS, or any Node.js framework
- **Runtime Agnostic**: Works in Node.js, Bun, Deno, and Edge runtimes
- **Type Safe**: Full TypeScript support with strict typing
- **Production Ready**: Comprehensive test coverage (90%+), security tests included
- **Extensible**: Easy to add custom payment providers or storage adapters
- **No Hidden Dependencies**: Does not read `process.env` directly - you control all configuration

## Features

- **Provider Agnostic**: Switch between Stripe, MercadoPago, or custom providers
- **Full Subscription Lifecycle**: Create, upgrade, downgrade, pause, resume, cancel
- **Usage-Based Billing**: Track and bill based on metered usage
- **Entitlements & Limits**: Feature gating and usage limits per plan
- **Multi-Currency**: Support for multiple currencies
- **Promo Codes**: Percentage, fixed amount, and free trial promotions
- **Webhooks**: Unified webhook handling with signature verification across providers
- **3D Secure**: Built-in support for 3DS authentication
- **React Components**: Ready-to-use hooks and UI components
- **Framework Integration**: Hono middleware and NestJS module

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@qazuor/qzpay-core`](./packages/core) | Core billing logic, types, and interfaces | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-core) |
| [`@qazuor/qzpay-stripe`](./packages/stripe) | Stripe payment adapter | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-stripe) |
| [`@qazuor/qzpay-mercadopago`](./packages/mercadopago) | MercadoPago payment adapter | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-mercadopago) |
| [`@qazuor/qzpay-drizzle`](./packages/drizzle) | Drizzle ORM storage adapter | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-drizzle) |
| [`@qazuor/qzpay-hono`](./packages/hono) | Hono framework middleware | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-hono) |
| [`@qazuor/qzpay-nestjs`](./packages/nestjs) | NestJS module | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-nestjs) |
| [`@qazuor/qzpay-react`](./packages/react) | React hooks and components | ![npm](https://img.shields.io/npm/v/@qazuor/qzpay-react) |

## Installation

```bash
# Core package (required)
pnpm add @qazuor/qzpay-core

# Payment provider (choose one or both)
pnpm add @qazuor/qzpay-stripe
pnpm add @qazuor/qzpay-mercadopago

# Storage adapter (required)
pnpm add @qazuor/qzpay-drizzle

# Framework integration (optional - choose one)
pnpm add @qazuor/qzpay-hono    # For Hono
pnpm add @qazuor/qzpay-nestjs  # For NestJS

# React components (optional)
pnpm add @qazuor/qzpay-react
```

## Quick Start

### 1. Initialize Billing with Stripe

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createStripeAdapter } from '@qazuor/qzpay-stripe';
import { createDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';

// You read environment variables and pass them explicitly
// The package never accesses process.env directly
const billing = createQZPayBilling({
  storage: createDrizzleStorageAdapter(db),
  payment: createStripeAdapter({
    secretKey: process.env.STRIPE_SECRET_KEY!, // You pass this
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!, // You pass this
  }),
});
```

### 2. Initialize Billing with MercadoPago

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';

// Same pattern - you control all configuration
const billing = createQZPayBilling({
  storage: createDrizzleStorageAdapter(db),
  payment: createMercadoPagoAdapter({
    accessToken: process.env.MP_ACCESS_TOKEN!, // You pass this
    webhookSecret: process.env.MP_WEBHOOK_SECRET!, // You pass this
  }),
});
```

### 3. Create a Customer

```typescript
const customer = await billing.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  metadata: { source: 'web' },
});
```

### 4. Create a Subscription

```typescript
const subscription = await billing.subscriptions.create({
  customerId: customer.id,
  planId: 'plan_pro',
  priceId: 'price_monthly',
});
```

### 5. Process a One-Time Payment

```typescript
const payment = await billing.payments.create({
  customerId: customer.id,
  amount: 9900, // $99.00 in cents
  currency: 'USD',
  description: 'Premium upgrade',
});
```

### 6. Check Entitlements

```typescript
const hasAccess = await billing.entitlements.check(customer.id, 'premium_features');

if (hasAccess) {
  // Grant access to premium features
}
```

### 7. Track Usage

```typescript
// Record usage
await billing.usage.record({
  customerId: customer.id,
  featureId: 'api_calls',
  quantity: 100,
});

// Check limits
const limit = await billing.limits.check(customer.id, 'api_calls');
if (!limit.exceeded) {
  // Allow the operation
}
```

## Framework Integration

### Hono

```typescript
import { Hono } from 'hono';
import {
  createQZPayMiddleware,
  createBillingRoutes,
  createWebhookRoutes
} from '@qazuor/qzpay-hono';

const app = new Hono();

// Attach billing to context
app.use('*', createQZPayMiddleware({ billing }));

// Mount billing API routes
app.route('/api/billing', createBillingRoutes());

// Webhook handling (separate route without auth)
app.route('/webhooks', createWebhookRoutes({
  billing,
  paymentAdapter: stripeAdapter,
}));
```

### NestJS

```typescript
import { Module } from '@nestjs/common';
import { QZPayModule } from '@qazuor/qzpay-nestjs';

@Module({
  imports: [
    QZPayModule.forRoot({
      billing,
      paymentAdapter: stripeAdapter,
    }),
  ],
})
export class AppModule {}
```

Use guards to protect routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireEntitlement, RequireSubscription } from '@qazuor/qzpay-nestjs';

@Controller('premium')
@UseGuards(SubscriptionGuard)
export class PremiumController {
  @Get('features')
  @RequireEntitlement('premium_features')
  getPremiumFeatures() {
    return { features: ['feature1', 'feature2'] };
  }
}
```

## React Integration

```tsx
import {
  QZPayProvider,
  useSubscription,
  useEntitlements,
  PricingTable,
  SubscriptionStatus
} from '@qazuor/qzpay-react';

function App() {
  return (
    <QZPayProvider billing={billing}>
      <PricingPage />
    </QZPayProvider>
  );
}

function PricingPage() {
  const { data: subscription, cancel } = useSubscription({ customerId });
  const { hasEntitlement } = useEntitlements({ customerId });

  return (
    <div>
      <SubscriptionStatus subscription={subscription} />

      {hasEntitlement('premium') && <PremiumFeatures />}

      <PricingTable
        plans={plans}
        onSelect={(planId) => handleSubscribe(planId)}
      />

      {subscription && (
        <button onClick={() => cancel(subscription.id)}>
          Cancel Subscription
        </button>
      )}
    </div>
  );
}
```

## Webhook Handling

Both Stripe and MercadoPago webhooks are handled through a unified interface with signature verification:

```typescript
// Stripe webhooks
app.post('/webhooks/stripe', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('stripe-signature')!;

  const event = stripeAdapter.webhook.constructEvent(payload, signature);

  switch (event.type) {
    case 'payment.succeeded':
      await handlePaymentSuccess(event.data);
      break;
    case 'subscription.updated':
      await handleSubscriptionUpdate(event.data);
      break;
  }

  return c.json({ received: true });
});

// MercadoPago webhooks (IPN)
app.post('/webhooks/mercadopago', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('x-signature')!;

  const event = mpAdapter.webhook.constructEvent(payload, signature);

  // Handle events with the same unified interface
  switch (event.type) {
    case 'payment.succeeded':
      await handlePaymentSuccess(event.data);
      break;
  }

  return c.json({ received: true });
});
```

## Provider Comparison

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| One-time Payments | Yes | Yes |
| Subscriptions | Yes | Yes |
| Usage-based Billing | Yes | No |
| Webhook Signature | Yes | Yes (HMAC) |
| 3D Secure | Yes | Yes |
| Customer Portal | Yes | No |
| Split Payments | Yes | No* |
| Setup Intents | Yes | No |

*MercadoPago split payments planned for v2.0

## Documentation

- [Core Package](./packages/core/README.md) - Types, interfaces, and core services
- [Stripe Adapter](./packages/stripe/README.md) - Stripe integration guide
- [MercadoPago Adapter](./packages/mercadopago/README.md) - MercadoPago integration guide
- [Drizzle Storage](./packages/drizzle/README.md) - Database schema and migrations
- [Hono Integration](./packages/hono/README.md) - Hono middleware guide
- [NestJS Integration](./packages/nestjs/README.md) - NestJS module guide
- [React Components](./packages/react/README.md) - React hooks and components

### Architecture

- [Architecture Overview](./docs/03-architecture/OVERVIEW.md)
- [Data Model](./docs/04-data-model/OVERVIEW.md)
- [API Reference](./docs/05-api/OVERVIEW.md)

## Requirements

- Node.js >= 22
- pnpm >= 9
- PostgreSQL (for Drizzle storage adapter)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/qazuor/qzpay.git
cd qzpay

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## License

[MIT](./LICENSE)

## Author

qazuor@gmail.com

---

Made with care by the qazuor team
