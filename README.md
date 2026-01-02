# @qazuor/qzpay

Universal billing and payments library for Node.js applications. Provider-agnostic billing system with support for subscriptions, one-time payments, usage-based billing, and more.

## Features

- **Provider Agnostic**: Switch between Stripe, MercadoPago, or custom providers
- **Full Subscription Lifecycle**: Create, upgrade, downgrade, pause, resume, cancel
- **Usage-Based Billing**: Track and bill based on metered usage
- **Entitlements & Limits**: Feature gating and usage limits per plan
- **Multi-Currency**: Support for multiple currencies
- **Promo Codes**: Percentage, fixed amount, and free trial promotions
- **Webhooks**: Unified webhook handling across providers
- **React Components**: Ready-to-use hooks and UI components
- **Framework Integration**: Hono middleware (NestJS coming soon)
- **Type Safe**: Full TypeScript support with strict typing

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@qazuor/qzpay-core` | Core billing logic, types, and interfaces | Stable |
| `@qazuor/qzpay-stripe` | Stripe payment adapter | Stable |
| `@qazuor/qzpay-drizzle` | Drizzle ORM storage adapter | Stable |
| `@qazuor/qzpay-hono` | Hono framework middleware | Stable |
| `@qazuor/qzpay-react` | React hooks and components | Stable |
| `@qazuor/qzpay-mercadopago` | MercadoPago payment adapter | Planned |
| `@qazuor/qzpay-nestjs` | NestJS module | Planned |

## Installation

```bash
# Core package (required)
pnpm add @qazuor/qzpay-core

# Payment provider (choose one)
pnpm add @qazuor/qzpay-stripe

# Storage adapter (choose one)
pnpm add @qazuor/qzpay-drizzle

# Framework integration (optional)
pnpm add @qazuor/qzpay-hono

# React components (optional)
pnpm add @qazuor/qzpay-react
```

## Quick Start

### 1. Initialize Billing

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createStripeAdapter } from '@qazuor/qzpay-stripe';
import { createDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';

const billing = createQZPayBilling({
  storage: createDrizzleStorageAdapter(db),
  payment: createStripeAdapter({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});
```

### 2. Create a Customer

```typescript
const customer = await billing.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
});
```

### 3. Create a Subscription

```typescript
const subscription = await billing.subscriptions.create({
  customerId: customer.id,
  planId: 'plan_pro',
  priceId: 'price_monthly',
});
```

### 4. Check Entitlements

```typescript
const hasAccess = await billing.entitlements.check(customer.id, 'premium_features');

if (hasAccess) {
  // Grant access to premium features
}
```

## React Integration

```tsx
import { QZPayProvider, useSubscription, useEntitlements } from '@qazuor/qzpay-react';

function App() {
  return (
    <QZPayProvider billing={billing}>
      <SubscriptionManager />
    </QZPayProvider>
  );
}

function SubscriptionManager() {
  const { data: subscription, cancel } = useSubscription({ customerId });
  const { hasEntitlement } = useEntitlements({ customerId });

  return (
    <div>
      {hasEntitlement('premium') && <PremiumFeatures />}
      <button onClick={() => cancel(subscription.id)}>
        Cancel Subscription
      </button>
    </div>
  );
}
```

## Hono Integration

```typescript
import { Hono } from 'hono';
import { createQZPayMiddleware, createWebhookRoutes } from '@qazuor/qzpay-hono';

const app = new Hono();

// Attach billing to context
app.use('*', createQZPayMiddleware({ billing }));

// Webhook handling
app.route('/webhooks', createWebhookRoutes({
  billing,
  paymentAdapter: stripeAdapter,
}));
```

## Documentation

- [Architecture Overview](./docs/03-architecture/OVERVIEW.md)
- [Data Model](./docs/04-data-model/OVERVIEW.md)
- [Implementation Roadmap](./docs/06-implementation/ROADMAP.md)

## Development Status

```
Phase 1: Foundation     ████████████████████ 100%  COMPLETE
Phase 2: Storage        ████████████████████ 100%  COMPLETE
Phase 3: Business Logic ████████████████████ 100%  COMPLETE
Phase 4: Providers      ██████████░░░░░░░░░░  50%  IN PROGRESS
  └─ Stripe             ████████████████████ 100%  COMPLETE
  └─ MercadoPago        ░░░░░░░░░░░░░░░░░░░░   0%  PLANNED
Phase 5: Framework      ██████████░░░░░░░░░░  50%  IN PROGRESS
  └─ Hono               ████████████████████ 100%  COMPLETE
  └─ NestJS             ░░░░░░░░░░░░░░░░░░░░   0%  PLANNED
Phase 6: React          ████████████████████ 100%  COMPLETE
Phase 7: CLI            ░░░░░░░░░░░░░░░░░░░░   0%  PLANNED
Phase 8: Documentation  ░░░░░░░░░░░░░░░░░░░░   0%  PLANNED
```

## Requirements

- Node.js >= 22
- pnpm >= 9

## License

MIT

## Author

qazuor@gmail.com
