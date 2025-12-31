# Data Model Overview

## Introduction

This document provides an overview of the database schema for @qazuor/qzpay. The schema is designed to be database-agnostic through the storage adapter pattern, with a reference implementation using PostgreSQL and Drizzle ORM.

---

## Naming Conventions

- **Table prefix**: All tables use the `billing_` prefix for namespace isolation
- **Primary keys**: UUID type, named `id`
- **Foreign keys**: Named `{entity}_id` (e.g., `customer_id`)
- **Timestamps**: `created_at`, `updated_at`, `deleted_at` (with timezone)
- **Booleans**: Prefixed with `is_` or `has_` when clarifying

---

## Entity Relationship Diagram

```
┌───────────────────────┐       ┌─────────────────────────┐       ┌───────────────────────┐
│   billing_customers   │       │  billing_subscriptions  │       │    billing_payments   │
├───────────────────────┤       ├─────────────────────────┤       ├───────────────────────┤
│ id (PK)               │◄──────│ customer_id (FK)        │       │ id (PK)               │
│ external_id           │       │ id (PK)                 │◄──────│ subscription_id (FK)  │
│ email                 │       │ plan_id                 │       │ customer_id (FK)      │
│ name                  │       │ status                  │       │ amount                │
│ stripe_id             │       │ interval                │       │ currency              │
│ mp_id                 │       │ period_start            │       │ status                │
│ metadata              │       │ period_end              │       │ provider              │
│ version               │       │ trial_end               │       │ provider_id           │
│ created_at            │       │ canceled_at             │       │ refunded_amount       │
│ updated_at            │       │ promo_code_id           │       │ version               │
│ deleted_at            │       │ version                 │       │ metadata              │
│ livemode              │       │ metadata                │       │ created_at            │
└───────────────────────┘       │ created_at              │       │ deleted_at            │
        │                       │ deleted_at              │       │ livemode              │
        │                       │ livemode                │       └───────────────────────┘
        │                       └─────────────────────────┘               │
        │                               │                                 │
        │                               ▼                                 │
        │                       ┌─────────────────────────┐               │
        │                       │    billing_invoices     │               │
        │                       ├─────────────────────────┤               │
        │                       │ id (PK)                 │               │
        └──────────────────────►│ customer_id (FK)        │               │
                                │ subscription_id (FK)    │               │
                                │ number                  │               │
                                │ status                  │               │
                                │ subtotal                │               │
                                │ discount                │               │
                                │ tax                     │               │
                                │ total                   │               │
                                │ currency                │               │
                                │ due_date                │               │
                                │ paid_at                 │               │
                                │ version                 │               │
                                │ metadata                │               │
                                │ created_at              │               │
                                │ deleted_at              │               │
                                │ livemode                │               │
                                └─────────────────────────┘               │
                                        │                                 │
                                        ▼                                 │
                                ┌───────────────────────────────┐         │
                                │  billing_invoice_payments     │◄────────┘
                                ├───────────────────────────────┤
                                │ id (PK)                       │
                                │ invoice_id (FK)               │
                                │ payment_id (FK)               │
                                │ amount_applied                │
                                │ currency                      │
                                │ applied_at                    │
                                │ livemode                      │
                                └───────────────────────────────┘
```

---

## Core Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `billing_customers` | Customer records linked to external users | external_id, email, provider IDs |
| `billing_subscriptions` | Subscription lifecycle | status, plan_id, period dates, trial |
| `billing_payments` | Payment transactions | amount, status, provider, refunds |
| `billing_invoices` | Invoice records | number, status, line items, totals |
| `billing_promo_codes` | Promotional codes | code, type, value, restrictions |
| `billing_vendors` | Marketplace vendors | commission_rate, payout info |

---

## Support Tables

| Table | Description |
|-------|-------------|
| `billing_payment_methods` | Stored payment methods |
| `billing_promo_code_usage` | Promo code redemption tracking |
| `billing_invoice_payments` | Invoice-payment junction |
| `billing_vendor_payouts` | Vendor payout records |
| `billing_audit_logs` | Immutable audit trail |
| `billing_webhook_events` | Webhook processing log |
| `billing_job_executions` | Background job tracking |
| `billing_idempotency_keys` | Idempotency tracking |
| `billing_currencies` | Supported currencies reference |

---

## Multi-Tenancy Support

The schema supports two deployment modes:

### Single-Tenant Mode (Default)

Each installation serves one organization. Schema used as-is.

```typescript
createQZPayBilling({
  tenancy: { mode: 'single' }
});
```

### Multi-Tenant Mode

A `tenant_id` column is automatically added to relevant tables:

| Table | tenant_id Added |
|-------|-----------------|
| billing_customers | Yes |
| billing_subscriptions | Yes |
| billing_payments | Yes |
| billing_invoices | Yes |
| billing_promo_codes | Yes |
| billing_vendors | Yes |

```typescript
createQZPayBilling({
  tenancy: {
    mode: 'multi',
    tenantColumn: 'tenant_id',
    tenantTable: 'tenants',
  }
});
```

---

## Environment Isolation

All tables include a `livemode` boolean column:

- `TRUE` = Production data
- `FALSE` = Test/development data

This allows safe testing without affecting production data.

---

## Related Documents

- [Table Definitions](./TABLES.md)
- [Schema Patterns](./PATTERNS.md)
- [Migrations](./MIGRATIONS.md)
