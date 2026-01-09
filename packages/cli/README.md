# @qazuor/qzpay-cli

CLI for scaffolding QZPay billing setups. Generate production-ready billing code with interactive prompts.

## Features

- Interactive project scaffolding with beautiful prompts
- Support for Stripe and MercadoPago payment providers
- Framework integrations: Hono, NestJS, or library-only
- Multiple billing models: subscriptions, one-time payments, usage-based, marketplace
- TypeScript-first with full type definitions
- Ready-to-run generated code

## Installation

```bash
# Global installation
npm install -g @qazuor/qzpay-cli

# Or use directly with npx
npx @qazuor/qzpay-cli init

# Or with pnpm
pnpm dlx @qazuor/qzpay-cli init
```

## Quick Start

```bash
# Run the interactive setup
qzpay init

# Or specify output directory
qzpay init -d ./my-billing
```

## Command Reference

### `qzpay init`

Scaffold a complete QZPay billing setup with interactive prompts.

```bash
qzpay init [options]

Options:
  -d, --dir <directory>  Output directory (default: ".")
  -y, --yes              Skip prompts and use defaults
  -h, --help             Display help
```

## Interactive Prompts

The CLI guides you through these configuration steps:

### 1. Project Info

```
◆  Project name
│  my-billing
│
◆  Output directory
│  ./billing
│
◆  Project description (optional)
│  Billing system for my SaaS
```

### 2. Payment Provider

```
◆  Payment provider
│  ○ Stripe (Recommended for most use cases)
│  ○ MercadoPago (Best for Latin America)
│  ○ Both (Multi-provider setup)
```

### 3. Storage Adapter

```
◆  Storage adapter
│  ○ Drizzle (PostgreSQL) - Production-ready
│  ○ In-memory - Development/testing only
```

### 4. Framework

```
◆  Framework integration
│  ○ Hono - Fast, lightweight web framework
│  ○ NestJS - Enterprise Node.js framework
│  ○ Library only - No HTTP layer
```

### 5. Features

```
◆  Features to include (multi-select)
│  ◼ Subscriptions - Recurring billing
│  ◻ One-time payments - Single purchases
│  ◻ Usage-based billing - Metered usage
│  ◻ Marketplace - Multi-vendor support
│  ◻ Add-ons - Subscription add-ons
```

### 6. Plan Structure

```
◆  Use predefined plan structure?
│  Yes
│
◆  Plan structure
│  ○ Freemium (Free + Pro + Enterprise)
│  ○ Tiered (Basic + Professional + Agency)
│  ○ Usage-based (Starter + Growth + Business + Enterprise)
```

Or define custom plans with name, display name, monthly price, and yearly price.

## Generated Files

Based on your selections, the CLI generates:

### Core Files (Always Generated)

| File | Description |
|------|-------------|
| `qzpay.config.ts` | Database connection, payment provider setup, QZPayBilling initialization, event listeners |
| `.env.example` | Template with all required environment variables |
| `types.ts` | TypeScript types: plan tiers, limits, pricing constants, customer interface |
| `plans.ts` | Plan initialization script with price creation |
| `services.ts` | Business logic: customer registration, subscriptions, payments |

### Framework-Specific Files

#### Hono

| File | Description |
|------|-------------|
| `routes.ts` | API routes with middleware, billing routes, custom endpoints |
| `webhooks.ts` | Webhook handlers for payment events |

#### NestJS

| File | Description |
|------|-------------|
| `billing.module.ts` | Dynamic NestJS module with `forRoot` and `forRootAsync` |
| `billing.service.ts` | Injectable service wrapping QZPayBilling |
| `webhooks.controller.ts` | Controller for webhook endpoints |
| `webhooks.ts` | Webhook handler functions |

## Example Output

### Generated `qzpay.config.ts`

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Stripe from 'stripe';

// Environment validation
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing: ${name}`);
    return value;
}

// Database
const client = postgres(getEnvVar('DATABASE_URL'));
export const db = drizzle(client);

// Stripe
export const stripe = new Stripe(getEnvVar('STRIPE_SECRET_KEY'), {
    apiVersion: '2024-12-18.acacia'
});

// Adapters
export const storageAdapter = new QZPayDrizzleStorageAdapter({ db, livemode: process.env.NODE_ENV === 'production' });
export const stripeAdapter = new QZPayStripeAdapter({ client: stripe, livemode: process.env.NODE_ENV === 'production' });

// Billing instance
export const billing = new QZPayBilling({
    storage: storageAdapter,
    provider: stripeAdapter,
    livemode: process.env.NODE_ENV === 'production'
});

// Event listeners
billing.on('subscription.created', async (event) => {
    console.log(`New subscription: ${event.data.id}`);
});

export default billing;
```

### Generated `types.ts`

```typescript
// Plan tiers
export type MyBillingPlanTier = 'free' | 'pro' | 'enterprise';

// Customer interface
export interface MyBillingCustomer {
    id: string;
    email: string;
    name: string;
    planTier: MyBillingPlanTier;
    createdAt: Date;
}

// Plan limits
export const MY_BILLING_PLAN_LIMITS: Record<MyBillingPlanTier, MyBillingPlanLimits> = {
    free: { maxItems: 5, maxUsers: 1, features: { analytics: false } },
    pro: { maxItems: 50, maxUsers: 10, features: { analytics: true } },
    enterprise: { maxItems: -1, maxUsers: -1, features: { analytics: true } }
};

// Pricing (in cents)
export const MY_BILLING_PRICING = {
    plans: {
        free: { monthly: 0, yearly: 0 },
        pro: { monthly: 1999, yearly: 19990 },
        enterprise: { monthly: 9999, yearly: 99990 }
    }
} as const;
```

## Complete Workflow Example

```bash
# 1. Create new billing project
qzpay init -d ./my-saas-billing

# 2. Navigate to directory
cd my-saas-billing

# 3. Copy environment template
cp .env.example .env

# 4. Edit .env with your credentials
# DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 5. Install dependencies (in your project)
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-drizzle
pnpm add stripe drizzle-orm postgres

# 6. Run database migrations
pnpm drizzle-kit push

# 7. Initialize plans in Stripe
npx tsx plans.ts

# 8. Start the server (Hono)
npx tsx routes.ts

# Server running on http://localhost:3000
# Webhooks: POST http://localhost:3000/webhooks/stripe
```

## Configuration by Use Case

### SaaS with Subscriptions

```
Provider: Stripe
Storage: Drizzle
Framework: Hono
Features: Subscriptions, Add-ons
Plans: Freemium (Free + Pro + Enterprise)
```

### E-commerce in Latin America

```
Provider: MercadoPago
Storage: Drizzle
Framework: NestJS
Features: One-time payments
Plans: Custom (single product pricing)
```

### Usage-Based API

```
Provider: Stripe
Storage: Drizzle
Framework: Hono
Features: Subscriptions, Usage-based billing
Plans: Usage-based (Starter + Growth + Business + Enterprise)
```

### Multi-Vendor Marketplace

```
Provider: Both (Stripe for vendors, MercadoPago for buyers)
Storage: Drizzle
Framework: Hono
Features: Subscriptions, Marketplace
Plans: Tiered (for vendors)
```

## Troubleshooting

### "Missing environment variable" error

Ensure all required variables are set in your `.env` file. Check `.env.example` for the complete list.

### Webhook signature verification fails

1. Make sure `STRIPE_WEBHOOK_SECRET` matches your Stripe dashboard
2. For local development, use Stripe CLI: `stripe listen --forward-to localhost:3000/webhooks/stripe`

### Plans not creating

1. Verify your Stripe API key is valid
2. Check if you're using test vs live keys
3. Run `plans.ts` with `DEBUG=*` for verbose output

### TypeScript errors after generation

1. Install all peer dependencies
2. Run `pnpm typecheck` to see specific errors
3. Ensure TypeScript version >= 5.0

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Drizzle | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Stripe | Stripe publishable key (frontend) |
| `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago | MercadoPago access token |
| `MERCADOPAGO_WEBHOOK_SECRET` | MercadoPago | MercadoPago webhook secret |
| `PORT` | Hono/NestJS | Server port (default: 3000) |
| `NODE_ENV` | All | Environment: development/production |
| `JWT_SECRET` | Hono/NestJS | JWT signing secret |

## API Reference

### Generated Service Functions

```typescript
// Customer management
registerCustomer({ email, name, planTier? }): Promise<Customer>
getCustomer(customerId): Promise<Customer | null>
getCustomerLimits(planTier): PlanLimits

// Subscriptions
subscribeToPlan(customerId, planTier, interval?): Promise<{ subscriptionId, checkoutUrl }>
changePlan(customerId, newTier, interval?): Promise<void>
cancelSubscription(customerId, immediately?): Promise<void>

// Add-ons (if enabled)
addAddOn(customerId, addOnKey): Promise<void>
removeAddOn(customerId, addOnKey): Promise<void>

// One-time (if enabled)
purchaseService(customerId, serviceKey): Promise<{ paymentId, checkoutUrl }>

// Usage tracking (if enabled)
trackUsage(customerId, metric, quantity): Promise<void>
checkUsageLimit(customerId, metric): Promise<{ allowed, used, limit }>
getUsageSummary(customerId): Promise<UsageSummary>

// Payments
getPaymentHistory(customerId): Promise<Payment[]>
getInvoices(customerId): Promise<Invoice[]>
```

## Related Packages

- [@qazuor/qzpay-core](../core) - Core billing library
- [@qazuor/qzpay-stripe](../stripe) - Stripe payment adapter
- [@qazuor/qzpay-mercadopago](../mercadopago) - MercadoPago payment adapter
- [@qazuor/qzpay-drizzle](../drizzle) - Drizzle ORM storage adapter
- [@qazuor/qzpay-hono](../hono) - Hono framework integration
- [@qazuor/qzpay-nestjs](../nestjs) - NestJS framework integration
- [@qazuor/qzpay-react](../react) - React hooks and components

## License

MIT
