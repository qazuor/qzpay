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

### QZPayCustomersRepository

```typescript
// Methods
findById(id: string): Promise<Customer | null>
findByExternalId(externalId: string): Promise<Customer | null>
findByEmail(email: string): Promise<Customer | null>
create(data: CreateCustomerInput): Promise<Customer>
update(id: string, data: UpdateCustomerInput): Promise<Customer | null>
delete(id: string): Promise<void>
list(options?: ListOptions): Promise<PaginatedResult<Customer>>
```

### QZPaySubscriptionsRepository

```typescript
// Methods
findById(id: string): Promise<Subscription | null>
findByCustomerId(customerId: string): Promise<Subscription[]>
findActiveByCustomerId(customerId: string): Promise<Subscription | null>
create(data: CreateSubscriptionInput): Promise<Subscription>
update(id: string, data: UpdateSubscriptionInput): Promise<Subscription>
list(options?: ListOptions): Promise<PaginatedResult<Subscription>>

// Lifecycle query methods (for automated processing)
findExpiringSoon(beforeDate: Date, options?): Promise<Subscription[]>
findInTrialEndingSoon(beforeDate: Date, options?): Promise<Subscription[]>
findPastDueInGracePeriod(now: Date, options?): Promise<Subscription[]>
findNeedingPaymentRetry(beforeDate: Date, options?): Promise<Subscription[]>
findPendingCancellationAtPeriodEnd(beforeDate: Date, options?): Promise<Subscription[]>
```

### QZPayPaymentsRepository

```typescript
// Methods
findById(id: string): Promise<Payment | null>
findByCustomerId(customerId: string): Promise<Payment[]>
findByInvoiceId(invoiceId: string): Promise<Payment[]>
create(data: CreatePaymentInput): Promise<Payment>
update(id: string, data: UpdatePaymentInput): Promise<Payment>
list(options?: ListOptions): Promise<PaginatedResult<Payment>>
```

### QZPayInvoicesRepository

```typescript
// Methods
findById(id: string): Promise<Invoice | null>
findByCustomerId(customerId: string): Promise<Invoice[]>
findBySubscriptionId(subscriptionId: string): Promise<Invoice[]>
create(data: CreateInvoiceInput): Promise<Invoice>
update(id: string, data: UpdateInvoiceInput): Promise<Invoice>
list(options?: ListOptions): Promise<PaginatedResult<Invoice>>
```

### Other Repositories

- `QZPayPlansRepository` - Plan CRUD operations
- `QZPayPricesRepository` - Price configurations
- `QZPayLimitsRepository` - Usage limit tracking
- `QZPayEntitlementsRepository` - Feature entitlements
- `QZPayAddonsRepository` - Add-on management
- `QZPayPaymentMethodsRepository` - Payment method storage
- `QZPayPromoCodesRepository` - Promotional codes
- `QZPayEventsRepository` - Event logging

## Schema Details

### billing_customers

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| external_id | VARCHAR | Your app's user ID |
| email | VARCHAR | Customer email |
| name | VARCHAR | Customer name |
| phone | VARCHAR | Phone number |
| provider_customer_ids | JSONB | Provider IDs (stripe, mercadopago) |
| metadata | JSONB | Custom metadata |
| livemode | BOOLEAN | Live vs test mode |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### billing_subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| plan_id | VARCHAR | Plan identifier |
| status | VARCHAR | active, trialing, past_due, canceled, paused |
| current_period_start | TIMESTAMP | Billing period start |
| current_period_end | TIMESTAMP | Billing period end |
| trial_end | TIMESTAMP | Trial end date |
| cancel_at | TIMESTAMP | Scheduled cancellation |
| cancel_at_period_end | BOOLEAN | Cancel at end of period |
| canceled_at | TIMESTAMP | When canceled |
| grace_period_ends_at | TIMESTAMP | Grace period end |
| next_retry_at | TIMESTAMP | Next payment retry |
| retry_count | INTEGER | Number of retry attempts |
| metadata | JSONB | Custom metadata |
| livemode | BOOLEAN | Live vs test mode |

### billing_payments

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| invoice_id | UUID | FK to invoices |
| subscription_id | UUID | FK to subscriptions |
| amount | INTEGER | Amount in cents |
| currency | VARCHAR | Currency code |
| status | VARCHAR | pending, succeeded, failed, refunded |
| idempotency_key | VARCHAR | Prevents duplicate payments |
| provider_payment_ids | JSONB | Provider payment IDs |
| failure_code | VARCHAR | Error code if failed |
| failure_message | TEXT | Error message |

### Table Relationships

```
billing_customers
├── billing_subscriptions (1:N)
│   ├── billing_payments (1:N)
│   └── billing_subscription_addons (1:N)
├── billing_invoices (1:N)
│   └── billing_invoice_lines (1:N)
├── billing_payments (1:N)
├── billing_payment_methods (1:N)
├── billing_customer_limits (1:N)
└── billing_customer_entitlements (1:N)

billing_plans
├── billing_prices (1:N)
└── billing_addons (M:N via compatible_plan_ids)
```

## Transactions

Use transactions for operations that need to be atomic:

```typescript
import { qzpayWithTransaction } from '@qazuor/qzpay-drizzle';

// Using the transaction utility
await qzpayWithTransaction(db, async (tx) => {
  // All operations use the transaction
  const customer = await customersRepo.create({ ... }, tx);
  const subscription = await subscriptionsRepo.create({
    customerId: customer.id,
    ...
  }, tx);

  // If any operation fails, all changes are rolled back
});

// Or via the storage adapter
await storageAdapter.transaction(async () => {
  const customer = await billing.customers.create({ ... });
  const subscription = await billing.subscriptions.create({
    customerId: customer.id,
    ...
  });
});
```

## Migrations

Create migrations using Drizzle Kit:

```bash
npx drizzle-kit generate:pg --schema=./node_modules/@qazuor/qzpay-drizzle/dist/schema
```

Or copy the schema to your project and customize.

## License

MIT
