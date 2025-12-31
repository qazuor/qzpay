# Architecture Overview

## System Architecture

@qazuor/qzpay follows a modular, adapter-based architecture that enables maximum flexibility while maintaining a clean, consistent API.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Consumer Application                          │
│                    (NestJS, Hono, Express, TanStack, etc.)              │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │     Framework Adapter Layer    │
                        │   (Hono, NestJS, Express...)   │
                        └───────────────┬───────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────┐
│                                                                            │
│                            @qazuor/qzpay-core                              │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                       QZPayBillingSystem                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │   │
│  │  │  Customers  │ │Subscriptions│ │  Payments   │ │   Invoices    │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘ │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │   │
│  │  │ PromoCodes  │ │ Marketplace │ │  Checkout   │ │   Metrics     │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘ │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │   │
│  │  │    Jobs     │ │   Events    │ │Entitlements │                   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                    ┌───────────────┴───────────────┐                       │
│                    │        Adapter Interfaces      │                       │
│                    └───────────────┬───────────────┘                       │
│                                    │                                       │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Payment Adapter   │   │   Storage Adapter   │   │    Email Adapter    │
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │  ┌───────────────┐  │
│  │    Stripe     │  │   │  │    Drizzle    │  │   │  │    Resend     │  │
│  ├───────────────┤  │   │  ├───────────────┤  │   │  ├───────────────┤  │
│  │  MercadoPago  │  │   │  │    Prisma     │  │   │  │   SendGrid    │  │
│  ├───────────────┤  │   │  ├───────────────┤  │   │  ├───────────────┤  │
│  │ BankTransfer  │  │   │  │    Custom     │  │   │  │    Custom     │  │
│  └───────────────┘  │   │  └───────────────┘  │   │  └───────────────┘  │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## Core Principles

### 1. No Magic Strings

All comparisons use exported constants:

```typescript
// Error-prone
if (subscription.status === 'active') { ... }

// Type-safe with autocomplete
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) { ... }
```

### 2. Adapter Pattern

The core billing logic is completely decoupled from:
- **Payment Providers**: Same code works with Stripe, Mercado Pago, or any future provider
- **Databases**: Switch from Drizzle to Prisma without changing business logic
- **Frameworks**: Integrate with any Node.js framework through route adapters

### 3. Type Everything

All entitlements, limits, events, and configurations are fully typed:

```typescript
interface MyEntitlements extends QZPayEntitlements {
  canAccessAnalytics: boolean;
  hasAPIAccess: boolean;
}

interface MyLimits extends QZPayLimits {
  maxProjects: number;      // -1 = unlimited
  maxUsersPerProject: number;
}
```

### 4. Explicit Over Implicit

Configuration is explicit:
- Routes only register if adapter is configured
- Emails only send if not suppressed
- No hidden behaviors

### 5. Rich Objects

Subscriptions include helper methods:

```typescript
const subscription = await billing.subscriptions.get(id);

subscription.hasAccess();           // true if active/trialing/grace
subscription.getEntitlements<T>();  // typed entitlements
subscription.getLimits<T>();        // typed limits
subscription.daysUntilRenewal();    // convenience methods
```

---

## Package Structure

```
@qazuor/qzpay (monorepo)
├── packages/
│   ├── core/           # @qazuor/qzpay-core - Business logic
│   │   ├── src/
│   │   │   ├── billing.ts        # Main factory
│   │   │   ├── constants/        # QZPay* constants
│   │   │   ├── services/         # Business logic
│   │   │   ├── types/            # TypeScript types
│   │   │   └── adapters/         # Adapter interfaces
│   │   └── package.json
│   │
│   ├── stripe/         # @qazuor/qzpay-stripe
│   │   └── src/
│   │       ├── adapter.ts        # Stripe payment adapter
│   │       ├── connect.ts        # Stripe Connect
│   │       └── webhooks.ts       # Webhook handlers
│   │
│   ├── mercadopago/    # @qazuor/qzpay-mercadopago
│   │   └── src/
│   │       ├── adapter.ts        # MP payment adapter
│   │       ├── marketplace.ts    # MP Marketplace
│   │       └── webhooks.ts       # Webhook handlers
│   │
│   ├── drizzle/        # @qazuor/qzpay-drizzle
│   │   └── src/
│   │       ├── storage.ts        # Storage adapter
│   │       ├── schema.ts         # Table definitions
│   │       └── migrations/       # Migration files
│   │
│   ├── react/          # @qazuor/qzpay-react
│   │   └── src/
│   │       ├── components/       # UI components
│   │       ├── hooks/            # React hooks
│   │       └── context/          # Provider
│   │
│   ├── hono/           # @qazuor/qzpay-hono
│   │   └── src/
│   │       ├── routes.ts         # Route handlers
│   │       └── middleware.ts     # Auth middleware
│   │
│   └── nestjs/         # @qazuor/qzpay-nestjs
│       └── src/
│           ├── module.ts         # NestJS module
│           └── controllers/      # Route controllers
│
├── docs/               # Documentation
└── examples/           # Example implementations
```

---

## Data Flow

### Subscription Creation Flow

```
1. Client Request
   │
   ▼
2. Framework Adapter (Hono/NestJS)
   │  - Validates input with Zod
   │  - Authenticates user
   │
   ▼
3. QZPayBilling.subscriptions.create()
   │  - Checks idempotency key
   │  - Validates plan exists
   │  - Validates promo code (if provided)
   │
   ▼
4. Storage Adapter
   │  - Wraps in transaction
   │  - Creates subscription record
   │
   ▼
5. Payment Adapter (if payment required)
   │  - Creates subscription in Stripe/MP
   │  - Processes first payment
   │
   ▼
6. Event Emission
   │  - Emits SUBSCRIPTION_CREATED
   │  - Triggers notification (if not suppressed)
   │
   ▼
7. Response to Client
```

---

## Related Documents

- [Design Patterns](./PATTERNS.md)
- [Security](./SECURITY.md)
- [Resilience](./RESILIENCE.md)
- [Observability](./OBSERVABILITY.md)
