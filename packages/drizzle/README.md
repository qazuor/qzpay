# @qazuor/qzpay-drizzle

Drizzle ORM storage adapter for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-drizzle drizzle-orm postgres
```

## Features

- **PostgreSQL Schema**: Complete billing schema
- **Repositories**: CRUD operations for all entities
- **Transactions**: Transaction support
- **Type Safety**: Full TypeScript support
- **Migrations**: Schema migration helpers

## Usage

### Basic Setup

```typescript
import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const storageAdapter = createQZPayDrizzleAdapter({ db });
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

### Direct Repository Usage

```typescript
import { QZPayCustomersRepository } from '@qazuor/qzpay-drizzle';

const customersRepo = new QZPayCustomersRepository(db);

// Create customer
const customer = await customersRepo.create({
  email: 'user@example.com',
  name: 'John Doe',
  livemode: true
});

// Find customer
const found = await customersRepo.findById(customer.id);
```

### Schema Import

```typescript
import {
  billingCustomers,
  billingSubscriptions,
  billingPayments,
  billingInvoices,
  billingPlans,
  billingPrices
} from '@qazuor/qzpay-drizzle/schema';
```

### Transactions

```typescript
await storageAdapter.transaction(async () => {
  // All operations in this block are transactional
  const customer = await billing.customers.create({ ... });
  const subscription = await billing.subscriptions.create({ ... });
});
```

## Schema Tables

- `billing_customers` - Customer data
- `billing_subscriptions` - Subscription records
- `billing_payments` - Payment transactions
- `billing_invoices` - Invoice records
- `billing_invoice_lines` - Invoice line items
- `billing_plans` - Plan definitions
- `billing_prices` - Price configurations
- `billing_customer_limits` - Usage limits
- `billing_customer_entitlements` - Feature entitlements
- `billing_events` - Event log

## Repositories

- `QZPayCustomersRepository`
- `QZPaySubscriptionsRepository`
- `QZPayPaymentsRepository`
- `QZPayInvoicesRepository`
- `QZPayPlansRepository`
- `QZPayPricesRepository`
- `QZPayLimitsRepository`
- `QZPayEntitlementsRepository`
- `QZPayEventsRepository`

## Migrations

Create migrations using Drizzle Kit:

```bash
npx drizzle-kit generate:pg --schema=./node_modules/@qazuor/qzpay-drizzle/dist/schema
```

Or copy the schema to your project and customize.

## License

MIT
