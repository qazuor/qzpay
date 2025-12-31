# IDEA-BASE: @qazuor/qzpay

## Vision Statement

**@qazuor/qzpay** (QZPay) is a universal, framework-agnostic billing and payments library for Node.js applications. It provides a complete solution for handling one-time payments, subscriptions, usage-based billing, and marketplace scenarios. The package is designed to be highly configurable, allowing any project to integrate billing functionality without being tied to a specific tech stack.

**Note**: All exports use the `QZPay` prefix (e.g., `QZPayBilling`, `QZPaySubscriptionStatus`, `QZPayStripeAdapter`) to avoid naming collisions with other packages.

---

## Problem Statement

### The Challenge

Developers building SaaS products, e-commerce platforms, or subscription-based services face a common set of challenges:

1. **Repetitive Implementation**: Every project requires implementing similar billing logic (subscriptions, trials, upgrades, promo codes, etc.)
2. **Provider Lock-in**: Code written for Stripe doesn't work with Mercado Pago or other providers
3. **Framework Coupling**: Billing logic often becomes tightly coupled to specific frameworks (NestJS, Express, etc.)
4. **Database Dependency**: Most billing solutions assume a specific database or ORM
5. **Maintenance Burden**: Payment provider APIs change frequently, requiring updates across multiple projects
6. **Compliance Complexity**: PCI compliance, tax calculation, and multi-currency support add significant complexity
7. **Marketplace Complexity**: Split payments, vendor onboarding, and commission management are particularly difficult
8. **Magic Strings**: Comparing statuses with string literals (`status === 'active'`) is error-prone and lacks type safety
9. **Email Responsibility**: Unclear who sends emails (package or application) leads to duplicate or missing notifications

### Target Users

- **Solo developers** building multiple SaaS products
- **Small teams** that want to focus on product features rather than billing infrastructure
- **Agencies** that build projects for clients and need reusable billing solutions
- **Startups** that need to move fast but want enterprise-grade billing

### Real-World Scenarios

The package is designed to support these specific use cases:

#### GEMFolio (E-commerce Marketplace)
- Product sales with variable pricing
- Bundle discounts
- Volume-based discounts (10% off over $X)
- Shipping cost calculation (future)
- Marketplace model with vendor commissions
- Split payments to vendors

#### HOSPEDA (Property Listing Platform)
- Monthly/annual subscriptions for property listings
- One-time service purchases (photo sessions, etc.)
- Subscription add-ons (featured listings, etc.)
- Trial periods (with and without credit card)
- Upgrade/downgrade flows
- Entitlements (custom branding, analytics access)
- Limits (max properties, max photos per property)

#### Asist.IA (AI Bot Platform)
- Monthly/annual subscriptions
- Usage-based billing (message counts)
- Additional bot purchases
- Plugin add-ons
- Initial setup service (one-time)
- Entitlements (priority support, API access)
- Limits (max bots, monthly messages)

---

## Solution Overview

### Core Concept

A modular billing system built on adapter patterns that:

1. **Abstracts payment providers**, Write once, use with Stripe, Mercado Pago, or any future provider
2. **Abstracts storage**, Use with Drizzle, Prisma, or any database through storage adapters
3. **Abstracts frameworks**, Integrate with Hono, NestJS, Express, TanStack Start, or any framework
4. **Provides sensible defaults**, Works out of the box with minimal configuration
5. **Allows deep customization**, Every aspect can be overridden for specific needs
6. **Eliminates magic strings**, All status checks use exported constants with full type safety
7. **Clarifies email responsibility**, Clear system to indicate what package sends vs what project handles

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
│  (NestJS, Hono, Express, TanStack Start, etc.)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @qazuor/qzpay-core                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Customers   │ │Subscriptions│ │  Payments   │ │ Invoices  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Promo Codes │ │ Marketplace │ │  Checkout   │ │  Metrics  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ Constants   │ │Entitlements │ │   Limits    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Payment Adapter │ │ Storage Adapter │ │ Framework Adapter│
│  - Stripe       │ │  - Drizzle      │ │  - Hono         │
│  - MercadoPago  │ │  - Prisma       │ │  - NestJS       │
│  - Bank Transfer│ │  - Custom       │ │  - Express      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Key Features

### Payment Processing
- [x] One-time payments
- [x] Recurring subscriptions
- [x] Usage-based billing
- [x] Marketplace split payments
- [x] Multi-currency support (provider conversion)
- [x] Bank transfer support (manual validation)

### Subscription Management
- [x] Multiple billing cycles (weekly, monthly, quarterly, annual, custom)
- [x] Free and paid trials
- [x] **Trials without payment method** (no card required for trials)
- [x] Plan upgrades/downgrades (prorated)
- [x] Grace periods (configurable)
- [x] Payment retry logic (configurable)
- [x] Automatic expiration handling
- [x] Admin-granted free access
- [x] **Rich subscription objects with helper methods**

### Entitlements & Limits System
- [x] **Entitlements**: Boolean features per plan (canAccessAnalytics, hasPrioritySupport)
- [x] **Limits**: Numeric restrictions per plan (-1 = unlimited)
- [x] Typed entitlements and limits per project
- [x] Helper methods to access entitlements and limits

### Promotions & Discounts

#### Promo Codes (Manual Entry)
- [x] Percentage discounts
- [x] Fixed amount discounts
- [x] Free shipping codes
- [x] Free period promotions
- [x] Reduced price periods
- [x] **Trial extension codes**
- [x] Configurable restrictions (usage limits, eligibility, dates, combinability)
- [x] Per-customer usage limits

#### Automatic Discounts (Auto-Applied)
- [x] **Minimum purchase discounts** (e.g., 10% off orders > $100)
- [x] **Volume discounts** (e.g., 10% off when buying 3+ items)
- [x] **Category discounts** (e.g., 15% off all rings)
- [x] **First purchase discounts** (e.g., 5% off first order)
- [x] **Free shipping thresholds** (e.g., free shipping over $50)
- [x] **Time-based discounts** (e.g., happy hour, flash sales)
- [x] **Customer segment discounts** (e.g., VIP customers get 10%)
- [x] Stacking rules configuration (combine with promo codes or not)
- [x] Priority ordering for multiple discounts

### Marketplace Features
- [x] Vendor onboarding (Stripe Connect, MP Marketplace)
- [x] Split payments
- [x] Configurable commissions
- [x] Vendor payouts
- [x] Vendor dashboard data

### Notifications
- [x] Event-driven architecture
- [x] Optional built-in email sending
- [x] **Suppress array for project-handled emails**
- [x] **emailSentByPackage indicator in all events**
- [x] Configurable email templates
- [x] Support for custom notification handlers

### Developer Experience
- [x] TypeScript-first with full type safety
- [x] **Exported constants for all status comparisons**
- [x] **CLI for .env.example generation**
- [x] **Environment validation on initialization**
- [x] **Auto-registered routes based on config**
- [x] Comprehensive documentation
- [x] Framework-specific route handlers
- [x] Storage adapters for popular ORMs
- [x] Webhook handling included
- [x] Metrics and reporting API

### UI Components (React)
- [x] Pricing table
- [x] Checkout (embedded mode)
- [x] Subscription management
- [x] Payment history
- [x] Payment method management
- [x] Invoice list
- [x] Usage display
- [x] Upgrade/cancel flows
- [x] Promo code input
- [x] Vendor components
- [x] Admin components
- [x] CSS variables for full customization

---

## Package Structure

```
@qazuor/qzpay (monorepo)
├── packages/
│   ├── core/                 # @qazuor/qzpay-core
│   │   ├── src/
│   │   │   ├── billing.ts           # createQZPayBilling() factory
│   │   │   ├── constants/           # Exported constants with QZPay prefix
│   │   │   │   ├── subscription-status.ts    # QZPaySubscriptionStatus
│   │   │   │   ├── payment-status.ts         # QZPayPaymentStatus
│   │   │   │   ├── billing-event.ts          # QZPayBillingEvent
│   │   │   │   ├── discount-type.ts          # QZPayDiscountTypeBase, QZPayPromoCodeType, QZPayAutomaticDiscountType, QZPayDiscountType
│   │   │   │   ├── discount-stacking-mode.ts # QZPayDiscountStackingMode
│   │   │   │   ├── discount-condition.ts     # QZPayDiscountCondition
│   │   │   │   ├── day-of-week.ts            # QZPayDayOfWeek
│   │   │   │   ├── currency.ts               # QZPayCurrency
│   │   │   │   └── index.ts
│   │   │   ├── customers/           # Customer management
│   │   │   ├── subscriptions/       # Subscription logic + helpers
│   │   │   ├── plans/               # Plans with entitlements/limits
│   │   │   ├── payments/            # Payment processing
│   │   │   ├── invoices/            # Invoice generation
│   │   │   ├── promo-codes/         # Promo code logic
│   │   │   ├── automatic-discounts/ # Automatic discounts logic
│   │   │   ├── marketplace/         # Marketplace features
│   │   │   ├── checkout/            # Checkout flows
│   │   │   ├── metrics/             # Reporting and analytics
│   │   │   ├── notifications/       # Event emission and emails
│   │   │   ├── jobs/                # Background job definitions
│   │   │   ├── types/               # TypeScript definitions
│   │   │   ├── utils/               # Shared utilities
│   │   │   └── bin/                 # CLI tools
│   │   └── package.json
│   │
│   ├── stripe/               # @qazuor/qzpay-stripe
│   │   └── src/
│   │       ├── adapter.ts           # createQZPayStripeAdapter() factory
│   │       ├── connect.ts           # createQZPayStripeConnectAdapter()
│   │       ├── webhooks.ts          # Webhook handlers
│   │       └── types.ts
│   │
│   ├── mercadopago/          # @qazuor/qzpay-mercadopago
│   │   └── src/
│   │       ├── adapter.ts           # createQZPayMercadoPagoAdapter()
│   │       ├── marketplace.ts       # createQZPayMPMarketplaceAdapter()
│   │       ├── webhooks.ts          # Webhook handlers
│   │       └── types.ts
│   │
│   ├── drizzle/              # @qazuor/qzpay-drizzle
│   │   └── src/
│   │       ├── storage.ts           # createQZPayDrizzleStorage() factory
│   │       ├── schema.ts            # Table definitions
│   │       ├── migrations/          # Migration files
│   │       └── types.ts
│   │
│   ├── resend/               # @qazuor/qzpay-resend
│   │   └── src/
│   │       ├── adapter.ts           # createQZPayResendAdapter() factory
│   │       └── types.ts
│   │
│   ├── react/                # @qazuor/qzpay-react
│   │   └── src/
│   │       ├── components/          # UI components with QZPay prefix
│   │       ├── hooks/               # React hooks (useQZPaySubscription, etc.)
│   │       ├── context/             # QZPayBillingProvider
│   │       ├── styles/              # CSS variables and defaults
│   │       └── types.ts
│   │
│   ├── hono/                 # @qazuor/qzpay-hono
│   │   └── src/
│   │       ├── routes.ts            # createQZPayBillingRoutes() factory
│   │       ├── middleware.ts        # Auth and validation
│   │       └── types.ts
│   │
│   ├── nestjs/               # @qazuor/qzpay-nestjs
│   │   └── src/
│   │       ├── module.ts            # QZPayBillingModule
│   │       ├── controllers/         # Route controllers
│   │       ├── decorators/          # @InjectQZPayBilling, etc.
│   │       └── types.ts
│   │
│   └── docs/                 # @qazuor/qzpay-docs
│       └── src/
│           ├── app/                 # Documentation site
│           └── content/             # MDX content
│
├── docs/                     # Project documentation
├── examples/                 # Example implementations
└── scripts/                  # Build and release scripts
```

---

## Technical Decisions

### Why Exported Constants with QZPay Prefix?

Instead of:
```typescript
// Error-prone, no autocomplete, typos possible
if (subscription.status === 'active') { ... }
```

We use:
```typescript
// Type-safe, autocomplete, no typos, distinctive naming
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) { ... }
```

**Why the QZPay prefix?**
- Avoids collisions with other packages (e.g., another package's `Currency`)
- Instantly recognizable as QZPay exports
- Allows clean imports without aliasing

**Benefits**:
- Full TypeScript autocomplete
- No magic strings
- Refactoring-safe
- Self-documenting code
- Tree-shakeable

### Why Entitlements AND Limits?

**Entitlements** are boolean feature flags:
```typescript
interface MyEntitlements extends QZPayEntitlements {
  canAccessAnalytics: boolean;
  hasAPIAccess: boolean;
  hasPrioritySupport: boolean;
}
```

**Limits** are numeric restrictions:
```typescript
interface MyLimits extends QZPayLimits {
  maxProjects: number;      // -1 = unlimited
  maxUsersPerProject: number;
  monthlyAPIRequests: number;
}
```

**Why separate them?**
- Different checking logic (boolean vs numeric)
- Different UI patterns (checkmarks vs progress bars)
- Clearer semantics for developers
- Easier to extend per project

### Why Subscription Helpers?

Instead of scattered logic:
```typescript
// Checking access manually
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';

const hasAccess =
  subscription.status === QZPaySubscriptionStatus.ACTIVE ||
  subscription.status === QZPaySubscriptionStatus.TRIALING ||
  (subscription.status === QZPaySubscriptionStatus.PAST_DUE && isWithinGracePeriod(subscription));
```

We provide helpers:
```typescript
// Clean, tested, maintained
import type { QZPaySubscription } from '@qazuor/qzpay-core';

const hasAccess = subscription.hasAccess();
const entitlements = subscription.getEntitlements<MyEntitlements>();
const limits = subscription.getLimits<MyLimits>();
```

**Available helpers**:
- Methods: `isActive()`, `isTrial()`, `hasAccess()`, `isInGracePeriod()`, `willCancel()`
- Methods: `daysUntilRenewal()`, `daysUntilTrialEnd()`
- Methods: `getEntitlements<T extends QZPayEntitlements>()`, `getLimits<T extends QZPayLimits>()`
- Properties: `hasPaymentMethod`, `defaultPaymentMethod` (pre-calculated)

### Why Trial Without Payment Method?

Many SaaS products offer trials without requiring a credit card. This increases conversion by:
- Reducing friction to start trial
- Building trust before asking for payment
- Allowing evaluation without commitment

Configuration:
```typescript
const plan: QZPayPlan = {
  id: 'pro',
  trial: {
    days: 14,
    requiresPaymentMethod: false  // No card required
  }
};
```

### Why Email Suppress System?

Problem: Some projects want to send their own branded emails, not use package defaults.

Solution: Suppress array + emailSentByPackage indicator:

```typescript
import { createQZPayBilling, QZPayBillingEvent } from '@qazuor/qzpay-core';
import type { QZPayBilling, QZPayBillingEventPayload } from '@qazuor/qzpay-core';

const billing: QZPayBilling = createQZPayBilling({
  notifications: {
    // These events won't trigger package emails
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
    ],
  },
});

// In event handler
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event: QZPayBillingEventPayload) => {
  // Check if package already sent email
  if (!event.emailSentByPackage) {
    // Project handles the email
    await sendCustomEmail(event.customer, event.daysLeft);
  }
});
```

### Why Auto-Registered Routes?

Problem: Manually setting up webhook routes for each provider is tedious and error-prone.

Solution: Routes auto-register based on configured adapters:

```typescript
import { createQZPayBillingRoutes } from '@qazuor/qzpay-hono';
import type { QZPayBillingRoutes } from '@qazuor/qzpay-hono';

// If Stripe adapter configured, registers POST /billing/webhooks/stripe
// If MP adapter configured, registers POST /billing/webhooks/mercadopago
// Always registers POST /billing/jobs/run-due
const billingRoutes: QZPayBillingRoutes = createQZPayBillingRoutes(billing, { basePath: '/billing' });
app.route('/', billingRoutes);
```

### Why CLI for Environment?

Problem: Developers forget which environment variables are needed for which adapters.

Solution: CLI generates .env.example with only needed variables:

```bash
npx @qazuor/qzpay-cli env:generate --adapters stripe,mercadopago,resend
# Generates .env.example with variables for configured adapters
```

Package validates on initialization:
```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';

// Throws: QZPayEnvironmentError: Missing required environment variable: STRIPE_SECRET_KEY
//         This is required because you configured a Stripe payment adapter.
const billing = createQZPayBilling({ /* config */ });
```

**Environment auto-detection warning**: If environment variables exist but adapters aren't configured, QZPay shows a warning:

```typescript
// Console warning:
// ⚠️  QZPay: Found STRIPE_SECRET_KEY in environment but no Stripe adapter configured.
//    Use createQZPayBillingFromEnv() to auto-configure, or add createQZPayStripeAdapter() manually.
```

### Why Postinstall Message Instead of Auto-Execute?

Problem: Should the CLI run automatically after `npm install` or `pnpm install`?

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Auto-execute CLI | Seamless setup | Security concerns, breaks CI/CD |
| postinstall script | Runs automatically | Can fail in restricted environments |
| prepare script | Doesn't run in CI | Confusing for developers |
| Message only | Safe, informative | Requires manual step |

**Decision: Message only on postinstall**

We chose to show an informative message without auto-executing anything:

```javascript
// packages/core/scripts/postinstall.js
#!/usr/bin/env node

const isCI = process.env.CI || process.env.CONTINUOUS_INTEGRATION;

if (!isCI) {
  console.log(`
┌─────────────────────────────────────────────────────┐
│  @qazuor/qzpay installed successfully! 📦           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Quick start:                                       │
│  npx @qazuor/qzpay-cli env:generate                 │
│                                                     │
│  Documentation:                                     │
│  https://github.com/qazuor/qzpay                    │
│                                                     │
└─────────────────────────────────────────────────────┘
`);
}
```

**package.json:**
```json
{
  "name": "@qazuor/qzpay-core",
  "scripts": {
    "postinstall": "node ./scripts/postinstall.js"
  }
}
```

**Why this approach?**

1. **Security**: Users distrust packages that auto-execute code. Many organizations audit postinstall scripts.

2. **CI/CD Compatibility**: Auto-executing a CLI that expects user input or modifies files breaks automated builds.

3. **No Silent Failures**: An auto-executed script that fails silently is worse than no script at all.

4. **Explicit Over Implicit**: Developers should consciously run the CLI, understanding what it does.

5. **Environment Detection**: Skips message in CI environments (`CI=true`) to keep logs clean.

6. **Works with npm, pnpm, yarn, bun**: All package managers support postinstall scripts.

**Alternative for Projects Wanting Auto-Setup:**

Projects can add their own postinstall if they want automatic setup:

```json
{
  "scripts": {
    "postinstall": "npx @qazuor/qzpay-cli env:check --silent || true"
  }
}
```

The `--silent` flag suppresses output, and `|| true` prevents failure from breaking install.

### Why Promo Codes AND Automatic Discounts?

Problem: Users expect two types of discounts:
1. **Promo Codes**: User enters a code to get a discount (marketing campaigns, referrals)
2. **Automatic Discounts**: Discounts apply automatically based on conditions (bulk orders, first purchase)

These are fundamentally different:

| Aspect | Promo Codes | Automatic Discounts |
|--------|-------------|---------------------|
| Trigger | User enters code | Conditions met automatically |
| Discovery | Marketing, sharing | Shown in cart automatically |
| Psychology | "I found a deal!" | "I'm getting a deal!" |
| Tracking | By code usage | By rule triggers |
| Examples | VERANO20, BIENVENIDA | "10% off orders > $100" |

**Configuration:**

```typescript
import {
  createQZPayBilling,
  QZPayPromoCodeType,         // For promo codes
  QZPayAutomaticDiscountType, // For automatic discounts
  QZPayDiscountStackingMode,
  QZPayDayOfWeek,
} from '@qazuor/qzpay-core';

const billing = createQZPayBilling({
  // Promo Codes - user enters manually (use QZPayPromoCodeType)
  promoCodes: {
    VERANO20: {
      code: 'VERANO20',
      type: QZPayPromoCodeType.PERCENTAGE,
      value: 20,
      description: '20% summer discount',
    } as QZPayPromoCode,
  },

  // Automatic Discounts - applied automatically (use QZPayAutomaticDiscountType)
  automaticDiscounts: {
    bulkOrder: {
      id: 'bulk-order-10',
      name: '10% off orders over $100',
      type: QZPayAutomaticDiscountType.PERCENTAGE,
      value: 10,
      conditions: {
        minPurchaseAmount: 10000, // $100 in cents
      },
      stackable: true, // Can combine with promo codes
      priority: 1,
    } as QZPayAutomaticDiscount,
    firstPurchase: {
      id: 'first-purchase',
      name: '5% off your first order',
      type: QZPayAutomaticDiscountType.PERCENTAGE,
      value: 5,
      conditions: {
        isFirstPurchase: true,
      },
      stackable: true,
      priority: 2,
    } as QZPayAutomaticDiscount,
    freeShipping: {
      id: 'free-shipping-50',
      name: 'Free shipping over $50',
      type: QZPayAutomaticDiscountType.FREE_SHIPPING,
      value: 0,
      conditions: {
        minPurchaseAmount: 5000,
      },
    } as QZPayAutomaticDiscount,
    happyHour: {
      id: 'happy-hour',
      name: 'Happy Hour - 15% off',
      type: QZPayAutomaticDiscountType.PERCENTAGE,
      value: 15,
      conditions: {
        schedule: {
          days: [QZPayDayOfWeek.FRIDAY, QZPayDayOfWeek.SATURDAY],
          hours: { from: 18, to: 21 },
          timezone: 'America/Argentina/Buenos_Aires',
        },
      },
    } as QZPayAutomaticDiscount,
  },

  // Stacking rules
  discountStacking: {
    mode: QZPayDiscountStackingMode.ALL_STACKABLE,
    maxStackedDiscounts: 3,
  } as QZPayDiscountStackingConfig,
});
```

**Alternative: Auto-configure from environment:**

```typescript
import { createQZPayBillingFromEnv } from '@qazuor/qzpay-core';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import type { QZPayBilling } from '@qazuor/qzpay-core';

// Auto-detects STRIPE_SECRET_KEY, MP_ACCESS_TOKEN, RESEND_API_KEY
// and configures the appropriate adapters automatically
const billing: QZPayBilling = createQZPayBillingFromEnv({
  storage: createQZPayDrizzleStorage({ db }),
  plans: PLANS,
  // ... other options
});
```

**Condition Types (QZPayDiscountCondition enum):**

```typescript
import { QZPayDiscountCondition, QZPayDayOfWeek } from '@qazuor/qzpay-core';

// QZPayDiscountCondition enum values:
export const QZPayDiscountCondition = {
  // Amount-based
  MIN_PURCHASE_AMOUNT: 'minPurchaseAmount',
  MAX_PURCHASE_AMOUNT: 'maxPurchaseAmount',

  // Quantity-based
  MIN_QUANTITY: 'minQuantity',
  MIN_QUANTITY_PER_PRODUCT: 'minQuantityPerProduct',

  // Customer-based
  IS_FIRST_PURCHASE: 'isFirstPurchase',
  CUSTOMER_SEGMENTS: 'customerSegments',
  REGISTERED_AFTER: 'registeredAfter',

  // Product-based
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  EXCLUDE_PRODUCTS: 'excludeProducts',
  EXCLUDE_CATEGORIES: 'excludeCategories',

  // Time-based
  SCHEDULE: 'schedule',
  VALID_FROM: 'validFrom',
  VALID_UNTIL: 'validUntil',

  // Usage-based
  MAX_REDEMPTIONS: 'maxRedemptions',
} as const;

// QZPayDayOfWeek enum:
export const QZPayDayOfWeek = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday',
} as const;

// Interface for conditions
export interface QZPayDiscountConditions {
  [QZPayDiscountCondition.MIN_PURCHASE_AMOUNT]?: number;
  [QZPayDiscountCondition.MAX_PURCHASE_AMOUNT]?: number;
  [QZPayDiscountCondition.MIN_QUANTITY]?: number;
  [QZPayDiscountCondition.IS_FIRST_PURCHASE]?: boolean;
  [QZPayDiscountCondition.CUSTOMER_SEGMENTS]?: string[];
  [QZPayDiscountCondition.CATEGORIES]?: string[];
  [QZPayDiscountCondition.SCHEDULE]?: QZPayScheduleCondition;
  // ... etc
}

export interface QZPayScheduleCondition {
  days?: QZPayDayOfWeekValue[];
  hours?: { from: number; to: number };
  timezone?: string;
}

export type QZPayDayOfWeekValue = (typeof QZPayDayOfWeek)[keyof typeof QZPayDayOfWeek];
```

**Stacking Modes (QZPayDiscountStackingMode enum):**

```typescript
export const QZPayDiscountStackingMode = {
  BEST_DISCOUNT: 'best_discount',      // Only highest discount applies
  ALL_STACKABLE: 'all_stackable',      // All stackable discounts combine
  AUTOMATIC_FIRST: 'automatic_first',  // Automatic first, then promo if compatible
} as const;
```

1. **BEST_DISCOUNT**: Only the highest discount applies (either automatic OR promo code)
2. **ALL_STACKABLE**: All discounts marked `stackable: true` apply together
3. **AUTOMATIC_FIRST**: Automatic discounts always apply, promo code only if compatible

**Discount Type Hierarchy:**

```typescript
// Base - shared by both promo codes and automatic discounts
export const QZPayDiscountTypeBase = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_PERIOD: 'free_period',
  REDUCED_PERIOD: 'reduced_period',
} as const;

// For manual promo codes applied by customers
export const QZPayPromoCodeType = {
  ...QZPayDiscountTypeBase,
  TRIAL_EXTENSION: 'trial_extension',
} as const;

// For system-applied automatic discounts
export const QZPayAutomaticDiscountType = {
  ...QZPayDiscountTypeBase,
  VOLUME: 'volume',
  AMOUNT_THRESHOLD: 'amount_threshold',
  FREE_SHIPPING: 'free_shipping',
} as const;

// Unified type for generic discount handling
export const QZPayDiscountType = {
  ...QZPayPromoCodeType,
  ...QZPayAutomaticDiscountType,
} as const;

// TypeScript types
export type QZPayDiscountTypeBaseType = typeof QZPayDiscountTypeBase[keyof typeof QZPayDiscountTypeBase];
export type QZPayPromoCodeTypeType = typeof QZPayPromoCodeType[keyof typeof QZPayPromoCodeType];
export type QZPayAutomaticDiscountTypeType = typeof QZPayAutomaticDiscountType[keyof typeof QZPayAutomaticDiscountType];
export type QZPayDiscountTypeValue = typeof QZPayDiscountType[keyof typeof QZPayDiscountType];
```

**Usage:**
- Use `QZPayPromoCodeType` when creating promo codes
- Use `QZPayAutomaticDiscountType` when creating automatic discounts
- Use `QZPayDiscountType` for generic discount handling or validation

**UI Display:**

```
Subtotal:                    $150.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Automatic discounts:
  ✓ 10% off orders > $100    -$15.00
  ✓ Free shipping            -$5.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Promo code:
  VERANO20 (20%)             -$30.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                       $100.00
```

### Why Adapter Pattern?

The adapter pattern allows the core billing logic to remain completely decoupled from:

1. **Payment Providers**: The same code works with Stripe, Mercado Pago, or any future provider
2. **Databases**: Switch from Drizzle to Prisma without changing business logic
3. **Frameworks**: Integrate with any Node.js framework through route adapters

### Why Monorepo?

- **Tree-shaking**: Only install what you need (`@qazuor/qzpay-stripe` without `@qazuor/qzpay-mercadopago`)
- **Independent versioning**: Update adapters independently
- **Clear boundaries**: Each package has a single responsibility
- **Easier testing**: Test packages in isolation

### Why React for UI?

React has the largest ecosystem and adoption. However, the components are designed to be:
- **Headless-compatible**: Use the hooks without the UI
- **Style-agnostic**: CSS variables allow full customization
- **Portable logic**: The hook logic could be adapted to Vue/Svelte

### Why Events Over Direct Actions?

The event-driven architecture allows:
- **Flexibility**: Apps decide how to respond to billing events
- **Extensibility**: Add custom behavior without modifying core
- **Testing**: Easy to mock and test event handlers
- **Decoupling**: Email sending, logging, analytics are all separate concerns
- **Clarity**: emailSentByPackage indicates package actions clearly

---

## Key Design Principles

### 1. No Magic Strings
Every comparison uses exported constants with QZPay prefix. Never `=== 'active'`, always `=== QZPaySubscriptionStatus.ACTIVE`.

### 2. Type Everything
All entitlements, limits, events, and configurations are fully typed. Projects extend base interfaces.

### 3. Explicit Over Implicit
Configuration is explicit. Routes only register if adapter is configured. Emails only send if not suppressed.

### 4. Rich Objects
Subscriptions include helper methods. Plans include entitlements and limits. Events include context.

### 5. Framework Agnostic
Core has zero framework dependencies. Adapters bridge to specific frameworks.

### 6. Project Controls Emails
Package provides defaults. Projects can suppress and handle their own emails. Clear indicator of what happened.

---

## Success Metrics

### Developer Experience
- [ ] First integration under 30 minutes
- [ ] Clear, comprehensive documentation
- [ ] TypeScript autocompletion for all APIs
- [ ] Zero-config defaults that just work
- [ ] No magic strings in project code

### Reliability
- [ ] 100% test coverage for core billing logic
- [ ] Comprehensive webhook handling
- [ ] Graceful error handling and retries
- [ ] Audit logging for all financial operations

### Performance
- [ ] Minimal bundle size per package
- [ ] No unnecessary dependencies
- [ ] Efficient database queries
- [ ] Lazy loading for UI components

---

## Out of Scope (For Now)

The following features are explicitly out of scope for the initial release but designed to be added later:

1. **Fiscal invoicing** (AFIP integration, etc.)
2. **Shipping calculation**
3. **Inventory management**
4. **Tax calculation by jurisdiction**
5. **Vue/Svelte UI components**
6. **GraphQL API**
7. **Admin dashboard application**
8. **Mobile SDKs**

---

## Timeline and Milestones

See `docs/planning/IMPLEMENTATION-PLAN.md` for detailed task breakdown.

### Phase 1: Foundation
Core architecture, types, constants, and basic payment processing

### Phase 2: Subscriptions
Complete subscription lifecycle management with helpers and entitlements

### Phase 3: Advanced Features
Promo codes, marketplace, metrics

### Phase 4: UI Components
React components with full customization

### Phase 5: Framework Adapters
Hono, NestJS with auto-registration

### Phase 6: CLI Tools
Environment generation and validation

### Phase 7: Documentation and Polish
Docs site, examples, and final testing

---

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Mercado Pago API Documentation](https://www.mercadopago.com.ar/developers/es/docs)
- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Mercado Pago Marketplace](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/integration-configuration/integrate-marketplace)

---

*Document Version: 1.1*
*Last Updated: 2024-12-26*
*Author: @qazuor*
