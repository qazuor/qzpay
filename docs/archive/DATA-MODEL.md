# Data Model

## Overview

This document defines the database schema for @qazuor/qzpay. The schema is designed to be database-agnostic through the storage adapter pattern, but the reference implementation uses PostgreSQL with Drizzle ORM.

---

## Multi-Tenancy Schema Variations

@qazuor/qzpay supports two deployment modes with different schema requirements:

### Single-Tenant Mode (Default)

In single-tenant mode, each installation serves one organization. The schema shown in this document is used as-is, without any `tenant_id` columns.

```typescript
createQZPayBilling({
  tenancy: { mode: 'single' }
});
```

### Multi-Tenant Mode

In multi-tenant mode, a `tenant_id` column is automatically added to the following tables:

| Table | tenant_id | Notes |
|-------|-----------|-------|
| billing_customers | UUID NOT NULL | FK to tenants table |
| billing_subscriptions | UUID NOT NULL | Inherited from customer |
| billing_payments | UUID NOT NULL | Inherited from customer |
| billing_invoices | UUID NOT NULL | Inherited from customer |
| billing_promo_codes | UUID NOT NULL | Tenant-specific promos |
| billing_vendors | UUID NOT NULL | Tenant-specific vendors |
| billing_payment_methods | UUID NOT NULL | Inherited from customer |
| billing_customer_discounts | UUID NOT NULL | Inherited from customer |

**Schema Generator:**

```typescript
// Multi-tenant schema generation
createQZPayBillingSchema({
  tenancy: {
    mode: 'multi',
    tenantColumn: 'tenant_id',
    tenantTable: 'tenants', // Reference table
  }
});

// Generates:
// tenant_id UUID NOT NULL REFERENCES tenants(id)
// Indexes on tenant_id for all tables
// Updated unique constraints to include tenant_id
```

**Unique Constraints in Multi-Tenant Mode:**

When `tenancy.mode = 'multi'`, unique constraints must include `tenant_id` to allow each tenant to have their own unique values. The system automatically generates the correct constraint based on the mode.

**Complete List of Affected Constraints:**

| Table | Single-Tenant Constraint | Multi-Tenant Constraint | Purpose |
|-------|--------------------------|-------------------------|---------|
| `billing_customers` | `UNIQUE (external_id, livemode)` | `UNIQUE (tenant_id, external_id, livemode)` | Each tenant can have customer with same external_id per environment |
| `billing_invoices` | `UNIQUE (number, livemode)` | `UNIQUE (tenant_id, number, livemode)` | Each tenant can have invoice #INV-0001 per environment |
| `billing_promo_codes` | `UNIQUE (code)` | `UNIQUE (tenant_id, code)` | Each tenant can have promo code "SALE20" |
| `billing_vendors` | `UNIQUE (external_id)` | `UNIQUE (tenant_id, external_id)` | Each tenant can have vendor with same external_id |
| `billing_idempotency_keys` | `UNIQUE (key)` | `UNIQUE (tenant_id, key)` | Idempotency per tenant |
| `billing_credit_notes` | `UNIQUE (number, livemode)` | `UNIQUE (tenant_id, number, livemode)` | Each tenant can have credit note #CN-0001 per environment |
| `billing_plans` | `UNIQUE (plan_id)` | `UNIQUE (tenant_id, plan_id)` | Each tenant can define plan "pro" |
| `billing_automatic_discounts` | `UNIQUE (discount_id)` | `UNIQUE (tenant_id, discount_id)` | Each tenant can have discount "summer-sale" |
| `billing_addon_definitions` | `UNIQUE (addon_id)` | `UNIQUE (tenant_id, addon_id)` | Each tenant can define addon "extra-users" |
| `billing_webhook_processing` | `UNIQUE (webhook_id)` | `UNIQUE (tenant_id, webhook_id)` | Webhook tracking per tenant |

**Constraints that DO NOT need tenant_id:**

These constraints already include tenant-specific foreign keys (subscription_id, customer_id, etc.) that implicitly scope to a tenant:

| Table | Constraint | Why No tenant_id Needed |
|-------|------------|-------------------------|
| `billing_promo_code_usage` | `UNIQUE (promo_code_id, customer_id, subscription_id)` | promo_code_id and customer_id are tenant-specific |
| `billing_invoice_payments` | `UNIQUE (invoice_id, payment_id)` | invoice_id and payment_id are tenant-specific |
| `billing_usage_records` | `UNIQUE (subscription_id, metric_name, period_start)` | subscription_id is tenant-specific |
| `billing_usage_reports` | `UNIQUE (subscription_id, idempotency_key)` | subscription_id is tenant-specific |
| `billing_subscription_addons` | `UNIQUE (subscription_id, addon_id, status)` | subscription_id is tenant-specific |
| `billing_exchange_rates` | `UNIQUE (from_currency, to_currency, is_manual_override)` | Exchange rates are global (shared across tenants) |

**Implementation Notes:**

```typescript
// The schema generator checks tenancy mode and creates appropriate constraint
if (config.tenancy.mode === 'multi') {
  // Generates: UNIQUE (tenant_id, external_id, livemode)
  // Adds: tenant_id UUID NOT NULL REFERENCES billing_tenants(id)
  // Adds: CREATE INDEX idx_<table>_tenant_id ON <table>(tenant_id)
} else {
  // Generates: UNIQUE (external_id, livemode)
  // No tenant_id column added
}
```

> **IMPORTANT**: All SQL examples in this document show the **single-tenant** schema. For multi-tenant mode, the system automatically:
> 1. Adds `tenant_id UUID NOT NULL` column to each table
> 2. Adds foreign key to `billing_tenants(id)`
> 3. Updates unique constraints to include `tenant_id`
> 4. Adds index on `tenant_id` for query performance
> 5. Enables Row Level Security (RLS) if configured

---

## 1.5 Currency Foreign Key Pattern

All fields storing currency codes MUST reference the `billing_currencies` table to ensure data integrity. This prevents invalid currency codes from being inserted and enables consistent currency management across the system.

### Tables with Currency FK

| Table | Field(s) | FK Reference | Purpose |
|-------|----------|--------------|---------|
| `billing_payments` | `currency`, `base_currency` | `billing_currencies(code)` | Payment and reporting currencies |
| `billing_subscriptions` | `currency` | `billing_currencies(code)` | Subscription billing currency |
| `billing_invoices` | `currency` | `billing_currencies(code)` | Invoice currency |
| `billing_invoice_line_items` | `currency` | `billing_currencies(code)` | Line item currency |
| `billing_credit_notes` | `currency` | `billing_currencies(code)` | Credit note currency |
| `billing_vendor_payouts` | `currency` | `billing_currencies(code)` | Payout currency |
| `billing_disputes` | `currency` | `billing_currencies(code)` | Dispute amount currency |
| `billing_promo_code_analytics` | `currency` | `billing_currencies(code)` | Analytics reporting currency |
| `billing_vendor_analytics` | `currency` | `billing_currencies(code)` | Vendor analytics currency |
| `billing_exchange_rates` | `from_currency`, `to_currency` | `billing_currencies(code)` | Exchange rate currency pair |
| `billing_pricing_snapshots` | `final_currency` | `billing_currencies(code)` | Snapshot currency |
| `billing_currency_conversions` | `final_currency` | `billing_currencies(code)` | Conversion target currency |

### Tables WITHOUT Currency FK (Intentional)

| Table | Field | Reason |
|-------|-------|--------|
| `billing_promo_codes` | `min_order_currency` | Optional field, null allowed, stored in config JSON |
| `billing_plans` | prices JSONB | Currency embedded in JSON structure (e.g., `{ "USD": 2900 }`) |
| `billing_plan_versions` | prices JSONB | Same as plans, historical pricing in JSON |

### Currency Validation Pattern

```sql
-- All currency fields follow this pattern:
currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code)

-- With optional index for reporting queries:
CREATE INDEX idx_<table>_currency ON <table>(currency);
```

```typescript
// Drizzle pattern:
currency: varchar('currency', { length: 3 })
  .notNull()
  .references(() => currencies.code),
```

### Adding New Currency Support

To add a new currency, insert into `billing_currencies`:

```sql
INSERT INTO billing_currencies (code, name, symbol, decimal_places, is_active)
VALUES ('BRL', 'Brazilian Real', 'R$', 2, TRUE);
```

All tables with currency FK will automatically accept the new currency code.

---

## 1.6 Timestamp Field Patterns

All timestamp fields with `DEFAULT NOW()` MUST include `NOT NULL` to ensure data integrity and proper auditing.

### Required Pattern

**SQL Pattern:**
```sql
-- CORRECT: All timestamps with DEFAULT NOW() must have NOT NULL
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

-- INCORRECT: Missing NOT NULL allows invalid NULL values
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- ❌ Wrong
```

**Drizzle Pattern:**
```typescript
// CORRECT: Include .notNull() before .defaultNow()
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

// INCORRECT: Missing .notNull()
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),  // ❌ Wrong
```

### Timestamp Fields Reference

| Field Name | Pattern | Notes |
|------------|---------|-------|
| `created_at` | `NOT NULL DEFAULT NOW()` | Record creation time, never changes |
| `updated_at` | `NOT NULL DEFAULT NOW()` | Last modification, update via trigger |
| `used_at` | `NOT NULL DEFAULT NOW()` | When promo code was used |
| `applied_at` | `NOT NULL DEFAULT NOW()` | When discount/payment was applied |
| `added_at` | `NOT NULL DEFAULT NOW()` | When addon was added |
| `captured_at` | `NOT NULL DEFAULT NOW()` | When pricing snapshot was captured |
| `requested_at` | `NOT NULL DEFAULT NOW()` | When export was requested |
| `detected_at` | `NOT NULL DEFAULT NOW()` | When anomaly was detected |
| `scheduled_for` | `NOT NULL DEFAULT NOW()` | Job scheduling time |
| `valid_from` | `NOT NULL DEFAULT NOW()` | Discount validity start |

### Nullable Timestamps (No Default)

These timestamps are intentionally nullable because they represent events that may or may not occur:

| Field Name | Purpose |
|------------|---------|
| `deleted_at` | Soft delete timestamp (null = not deleted) |
| `paid_at` | When invoice was paid (null = not paid yet) |
| `canceled_at` | When subscription was canceled |
| `trial_end` | When trial ends (null = no trial) |
| `expires_at` | Expiration time (null = no expiration) |
| `completed_at` | When job completed (null = not completed) |
| `resolved_at` | When issue was resolved (null = unresolved) |

### Timezone Handling

All timestamp fields in the billing system use `TIMESTAMP WITH TIME ZONE` (timestamptz) for consistent, timezone-aware date/time handling.

#### Storage Behavior

PostgreSQL's `TIMESTAMP WITH TIME ZONE` works as follows:

1. **Input Conversion:** When inserting a timestamp, PostgreSQL converts it to UTC for storage
2. **Storage Format:** All timestamps are stored internally as UTC (no timezone offset stored)
3. **Output Conversion:** When selecting, PostgreSQL converts from UTC to the session's timezone
4. **Comparison Safety:** All comparisons are done in UTC, preventing timezone-related bugs

```sql
-- Example: These two inserts store the SAME UTC value
SET timezone = 'America/New_York';
INSERT INTO billing_invoices (due_date) VALUES ('2025-01-15 10:00:00');
-- Stored as: 2025-01-15 15:00:00 UTC

SET timezone = 'UTC';
INSERT INTO billing_invoices (due_date) VALUES ('2025-01-15 15:00:00');
-- Stored as: 2025-01-15 15:00:00 UTC (identical)
```

#### Application Guidelines

**Rule 1: Always Use UTC in Application Code**

```typescript
// CORRECT: Use UTC for all internal operations
const now = new Date(); // JavaScript Date is always UTC internally
const periodEnd = new Date(Date.UTC(2025, 0, 15, 0, 0, 0)); // Explicit UTC

// INCORRECT: Never use local timezone for business logic
const localDate = new Date('2025-01-15'); // Ambiguous - depends on runtime timezone
```

**Rule 2: Convert to User Timezone Only for Display**

```typescript
// Application layer - display formatting only
function formatForUser(utcDate: Date, userTimezone: string): string {
  return utcDate.toLocaleString('en-US', { timeZone: userTimezone });
}

// Example usage
const invoice = await getInvoice(id);
const displayDate = formatForUser(invoice.dueDate, customer.metadata.timezone || 'UTC');
```

**Rule 3: Billing Cycles Use UTC Midnight**

All billing period boundaries (current_period_start, current_period_end) use UTC midnight (00:00:00 UTC) to ensure:
- Consistent billing across all customer timezones
- No ambiguity in period calculations
- Predictable renewal times for batch processing

```sql
-- Billing period always starts/ends at UTC midnight
current_period_start = '2025-01-01 00:00:00+00'  -- UTC midnight
current_period_end = '2025-02-01 00:00:00+00'    -- UTC midnight (exclusive)
```

**Rule 4: DST-Safe Date Arithmetic**

For recurring billing, always use date arithmetic (add months/days), never hour arithmetic:

```typescript
// CORRECT: Add calendar months (DST-safe)
function getNextBillingDate(current: Date, intervalMonths: number): Date {
  const next = new Date(current);
  next.setUTCMonth(next.getUTCMonth() + intervalMonths);
  return next;
}

// INCORRECT: Adding hours can cause DST drift
function badNextBillingDate(current: Date): Date {
  return new Date(current.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days in ms - WRONG
}
```

#### Query Patterns

**Get records for a specific UTC day:**
```sql
-- All invoices due on January 15, 2025 (UTC)
SELECT * FROM billing_invoices
WHERE due_date >= '2025-01-15 00:00:00+00'
  AND due_date < '2025-01-16 00:00:00+00';
```

**Get records in a time window:**
```sql
-- Subscriptions renewing in the next 24 hours
SELECT * FROM billing_subscriptions
WHERE current_period_end >= NOW()
  AND current_period_end < NOW() + INTERVAL '24 hours'
  AND status = 'active'
  AND deleted_at IS NULL;
```

**Get records for user's local date (application converts):**
```sql
-- Application passes UTC boundaries calculated from user's timezone
-- Example: User in America/New_York wants "today's" invoices
-- Application calculates: today_start_utc = '2025-01-15 05:00:00+00' (midnight EST = 5am UTC)
--                         today_end_utc = '2025-01-16 05:00:00+00'
SELECT * FROM billing_invoices
WHERE due_date >= $1  -- today_start_utc
  AND due_date < $2;  -- today_end_utc
```

#### Customer Timezone Storage

Store customer timezone preference in metadata for display purposes:

```typescript
// Customer metadata schema
interface CustomerMetadata {
  timezone?: string;  // IANA timezone (e.g., 'America/New_York', 'Europe/London')
  // ... other metadata
}

// Example customer record
{
  "id": "cust_123",
  "email": "user@example.com",
  "metadata": {
    "timezone": "America/Los_Angeles"
  }
}
```

#### Drizzle ORM Pattern

Always use `withTimezone: true` for all timestamp fields:

```typescript
// CORRECT: All timestamps are timezone-aware
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
dueDate: timestamp('due_date', { withTimezone: true }),

// INCORRECT: Never use timestamps without timezone
createdAt: timestamp('created_at').notNull().defaultNow(),  // ❌ Wrong - loses timezone info
```

#### Summary Table

| Scenario | Approach |
|----------|----------|
| Storing dates | Always use `TIMESTAMP WITH TIME ZONE` |
| Application internal | Always work in UTC |
| Display to user | Convert to user's timezone at presentation layer |
| Billing periods | Use UTC midnight boundaries |
| Date arithmetic | Use calendar operations (add months), not milliseconds |
| Comparing dates | Let PostgreSQL handle in UTC |
| User timezone | Store in customer.metadata.timezone |

## 1.7 ON DELETE Referential Action Patterns

Foreign keys must use the correct `ON DELETE` action to preserve data integrity and audit trails.

### RESTRICT Pattern (Default for Historical Data)

Use `ON DELETE RESTRICT` for tables that:
- Contain historical/audit data that must be preserved
- Are immutable records (analytics, snapshots, logs)
- Use soft delete patterns (status field, deleted_at)

**SQL Pattern:**
```sql
-- RESTRICT: Prevents deletion of parent if children exist
-- Use soft delete (status='removed', active=false) instead of hard delete
subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE RESTRICT
```

**Drizzle Pattern:**
```typescript
// RESTRICT: Preserve history. Use soft delete pattern.
subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),
```

### Tables Using ON DELETE RESTRICT

| Table | FK Column | Parent Table | Reason |
|-------|-----------|--------------|--------|
| `billing_subscription_addons` | `subscription_id` | `billing_subscriptions` | Preserve addon history for billing/audit |
| `billing_customer_discounts` | `customer_id` | `billing_customers` | Preserve discount history for billing/audit |
| `billing_promo_code_analytics` | `promo_code_id` | `billing_promo_codes` | Analytics are immutable audit records |
| `billing_vendor_analytics` | `vendor_id` | `billing_vendors` | Analytics are immutable audit records |
| `billing_pricing_snapshots` | `subscription_id` | `billing_subscriptions` | Pricing history for audit/legal compliance |

### Soft Delete Patterns by Table

| Table | Soft Delete Field | Value When Deleted |
|-------|-------------------|-------------------|
| `billing_subscription_addons` | `status` | `'removed'` |
| `billing_customer_discounts` | `active` | `false` |
| `billing_promo_code_analytics` | N/A | Immutable (never delete) |
| `billing_vendor_analytics` | N/A | Immutable (never delete) |
| `billing_pricing_snapshots` | N/A | Immutable (never delete) |

### Soft Delete Unique Constraint Pattern

When tables use soft delete (`deleted_at` timestamp), unique constraints must be converted to **partial indexes** to allow re-creation of soft-deleted records.

**Problem:**

```sql
-- Standard unique constraint:
UNIQUE (tenant_id, external_id, livemode)

-- Issue: After soft delete, cannot recreate:
INSERT INTO billing_customers (external_id) VALUES ('user_123'); -- OK
UPDATE billing_customers SET deleted_at = NOW() WHERE external_id = 'user_123'; -- Soft delete
INSERT INTO billing_customers (external_id) VALUES ('user_123'); -- FAILS! Unique violation
```

**Solution: Partial Indexes**

```sql
-- Replace UNIQUE constraint with partial index that excludes soft-deleted records:
CREATE UNIQUE INDEX idx_customers_external_id_active
ON billing_customers(tenant_id, external_id, livemode)
WHERE deleted_at IS NULL;

-- Now re-creation works:
INSERT INTO billing_customers (external_id) VALUES ('user_123'); -- OK (deleted_at = NULL)
UPDATE billing_customers SET deleted_at = NOW() WHERE external_id = 'user_123'; -- Soft delete
INSERT INTO billing_customers (external_id) VALUES ('user_123'); -- OK! Different because deleted_at != NULL
```

**Tables Requiring Partial Index Pattern:**

| Table | Original Constraint | Partial Index |
|-------|---------------------|---------------|
| `billing_customers` | `UNIQUE (tenant_id, external_id, livemode)` | `WHERE deleted_at IS NULL` |
| `billing_vendors` | `UNIQUE (tenant_id, external_id)` | `WHERE deleted_at IS NULL` |
| `billing_promo_codes` | `UNIQUE (tenant_id, code)` | `WHERE deleted_at IS NULL` |
| `billing_plans` | `UNIQUE (tenant_id, plan_id)` | `WHERE deleted_at IS NULL` |
| `billing_addon_definitions` | `UNIQUE (tenant_id, addon_id)` | `WHERE deleted_at IS NULL` |

**Drizzle Implementation:**

```typescript
// In schema definition, use index instead of unique():
import { index, pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const customers = pgTable('billing_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  livemode: boolean('livemode').notNull().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // ... other fields
}, (table) => ({
  // Partial unique index for soft delete compatibility
  externalIdActiveIdx: index('idx_customers_external_id_active')
    .on(table.tenantId, table.externalId, table.livemode)
    .where(sql`deleted_at IS NULL`),
}));
```

### Soft Delete Query Patterns

ALL queries MUST include `deleted_at IS NULL` filter by default. The storage adapter provides helper methods:

```typescript
// packages/core/src/adapters/storage.adapter.ts

export interface SoftDeleteQueryOptions {
  /** Include soft-deleted records (default: false) */
  includeDeleted?: boolean;
  /** Only return soft-deleted records (default: false) */
  onlyDeleted?: boolean;
}

export interface QZPayCustomerCollection {
  /**
   * Find active customers (excludes soft-deleted)
   * This is the DEFAULT method - always filters deleted_at IS NULL
   */
  find(filter: CustomerFilter): Promise<Customer[]>;

  /**
   * Find including soft-deleted records
   * Use for admin views, audit trails, data recovery
   */
  findIncludingDeleted(filter: CustomerFilter): Promise<Customer[]>;

  /**
   * Find only soft-deleted records
   * Use for "trash" views, permanent deletion workflows
   */
  findDeleted(filter: CustomerFilter): Promise<Customer[]>;

  /**
   * Soft delete a customer
   * Sets deleted_at = NOW(), does NOT remove record
   */
  softDelete(id: string): Promise<void>;

  /**
   * Restore a soft-deleted customer
   * Sets deleted_at = NULL
   */
  restore(id: string): Promise<void>;

  /**
   * Permanently delete (use with caution, for compliance/GDPR)
   * Requires special permission, logged in audit trail
   */
  hardDelete(id: string): Promise<void>;
}
```

**SQL Query Examples:**

```sql
-- Default query (active only):
SELECT * FROM billing_customers
WHERE customer_id = $1
  AND deleted_at IS NULL;

-- Include soft-deleted:
SELECT * FROM billing_customers
WHERE customer_id = $1;
-- No deleted_at filter

-- Only soft-deleted:
SELECT * FROM billing_customers
WHERE customer_id = $1
  AND deleted_at IS NOT NULL;
```

### Foreign Key References to Soft-Deleted Parents

When a parent record is soft-deleted, child records remain pointing to it. This is intentional for audit purposes:

```sql
-- Payment references soft-deleted customer:
SELECT p.*, c.email, c.deleted_at AS customer_deleted_at
FROM billing_payments p
JOIN billing_customers c ON p.customer_id = c.id
WHERE p.id = $1;

-- The join still works, and we can see customer was deleted
-- This is important for financial audits
```

**Rules:**
1. Foreign key references to soft-deleted parents are VALID (no constraint violation)
2. Queries should check parent `deleted_at` when business logic requires
3. For customer-facing views, filter out records with deleted parents
4. For admin/audit views, show all records with deletion status indicated

### CASCADE Pattern (Use Sparingly)

Use `ON DELETE CASCADE` only when:
- Child records have no meaning without parent
- No audit/historical value exists
- Cascading deletion is explicitly desired

**Example (not used in this schema):**
```sql
-- CASCADE: Only if child data is meaningless without parent
-- WARNING: Loses historical data permanently
session_id UUID REFERENCES sessions(id) ON DELETE CASCADE
```

> **IMPORTANT**: This schema does NOT use CASCADE for any billing data. All tables use RESTRICT or SET NULL.

### SET NULL Pattern (For Optional Relationships)

Use `ON DELETE SET NULL` for nullable FKs where:
- The relationship is optional (child can exist without parent reference)
- Deleting parent should preserve child record but clear the reference
- Historical context is maintained through other fields (timestamps, metadata)

**SQL Pattern:**
```sql
-- SET NULL: Clears reference but preserves child record
-- Use for optional relationships where child has independent value
promo_code_id UUID REFERENCES billing_promo_codes(id) ON DELETE SET NULL
```

**Drizzle Pattern:**
```typescript
// SET NULL: Preserves record, clears optional reference
promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, { onDelete: 'set null' }),
```

### Complete Foreign Key Inventory

This is the authoritative list of ALL foreign key relationships in the schema with their deletion behavior.

#### Core Entity FKs (RESTRICT - Required Relationships)

These FKs link to core billable entities. Parent cannot be deleted if children exist.

| Child Table | FK Column | Parent Table | Nullable | ON DELETE | Reason |
|-------------|-----------|--------------|----------|-----------|--------|
| `billing_subscriptions` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with active subscriptions |
| `billing_payments` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with payment history |
| `billing_invoices` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with invoices |
| `billing_invoice_payments` | `invoice_id` | `billing_invoices` | NOT NULL | RESTRICT | Invoice cannot be deleted with payment applications |
| `billing_invoice_payments` | `payment_id` | `billing_payments` | NOT NULL | RESTRICT | Payment cannot be deleted with invoice applications |
| `billing_subscription_addons` | `subscription_id` | `billing_subscriptions` | NOT NULL | RESTRICT | Subscription cannot be deleted with addon history |
| `billing_promo_code_usage` | `promo_code_id` | `billing_promo_codes` | NOT NULL | RESTRICT | Promo code cannot be deleted with usage records |
| `billing_promo_code_usage` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with promo usage |
| `billing_customer_discounts` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with discount history |
| `billing_automatic_discount_usage` | `automatic_discount_id` | `billing_automatic_discounts` | NOT NULL | RESTRICT | Discount cannot be deleted with usage records |
| `billing_vendor_payouts` | `vendor_id` | `billing_vendors` | NOT NULL | RESTRICT | Vendor cannot be deleted with payout history |
| `billing_promo_code_analytics` | `promo_code_id` | `billing_promo_codes` | NOT NULL | RESTRICT | Analytics are immutable audit records |
| `billing_vendor_analytics` | `vendor_id` | `billing_vendors` | NOT NULL | RESTRICT | Analytics are immutable audit records |
| `billing_pricing_snapshots` | `subscription_id` | `billing_subscriptions` | NOT NULL | RESTRICT | Pricing history for audit/legal compliance |
| `billing_credit_notes` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with credit notes |
| `billing_disputes` | `payment_id` | `billing_payments` | NOT NULL | RESTRICT | Payment cannot be deleted with dispute records |
| `billing_disputes` | `customer_id` | `billing_customers` | NOT NULL | RESTRICT | Customer cannot be deleted with disputes |

#### Optional Relationship FKs (SET NULL - Nullable References)

These FKs represent optional relationships. Parent deletion clears the reference but preserves the child record.

| Child Table | FK Column | Parent Table | Nullable | ON DELETE | Reason |
|-------------|-----------|--------------|----------|-----------|--------|
| `billing_subscriptions` | `promo_code_id` | `billing_promo_codes` | NULL OK | SET NULL | Subscription valid without promo; preserve sub if promo deleted |
| `billing_subscriptions` | `locked_plan_version_id` | `billing_plan_versions` | NULL OK | SET NULL | Plan version is snapshot; subscription continues without it |
| `billing_payments` | `subscription_id` | `billing_subscriptions` | NULL OK | SET NULL | One-time payments have no subscription; preserve payment record |
| `billing_payments` | `vendor_id` | `billing_vendors` | NULL OK | SET NULL | Platform payments have no vendor; preserve payment if vendor deleted |
| `billing_invoices` | `subscription_id` | `billing_subscriptions` | NULL OK | SET NULL | One-time invoices have no subscription; preserve invoice |
| `billing_promo_code_usage` | `subscription_id` | `billing_subscriptions` | NULL OK | SET NULL | Usage may be for one-time purchase; preserve usage record |
| `billing_promo_code_usage` | `payment_id` | `billing_payments` | NULL OK | SET NULL | Usage tracked before payment; preserve if payment deleted |
| `billing_automatic_discount_usage` | `customer_id` | `billing_customers` | NULL OK | SET NULL | Guest checkout may have no customer; preserve usage |
| `billing_automatic_discount_usage` | `payment_id` | `billing_payments` | NULL OK | SET NULL | Discount applied before payment; preserve if payment deleted |
| `billing_credit_notes` | `invoice_id` | `billing_invoices` | NULL OK | SET NULL | Credit may not relate to specific invoice; preserve credit note |
| `billing_credit_notes` | `payment_id` | `billing_payments` | NULL OK | SET NULL | Credit may come from refund; preserve credit note |
| `billing_credit_notes` | `applied_to_invoice_id` | `billing_invoices` | NULL OK | SET NULL | Credit may be unapplied; preserve credit note |

#### Reference Table FKs (RESTRICT - Data Integrity)

These FKs link to reference/lookup tables. Parent cannot be deleted if used.

| Child Table | FK Column | Parent Table | Nullable | ON DELETE | Reason |
|-------------|-----------|--------------|----------|-----------|--------|
| `billing_payments` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_payments` | `base_currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_invoices` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_invoice_payments` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_vendor_payouts` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_credit_notes` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_disputes` | `currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_exchange_rates` | `from_currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |
| `billing_exchange_rates` | `to_currency` | `billing_currencies` | NOT NULL | RESTRICT | Cannot delete currency in use |

### Decision Matrix: Choosing ON DELETE Action

Use this matrix to determine the correct ON DELETE action:

```
Is the FK required (NOT NULL)?
├─ YES → Can parent be safely deleted?
│        ├─ NO (historical/audit data) → RESTRICT
│        └─ YES (transient data) → CASCADE (rare, avoid for billing)
│
└─ NO (nullable) → Should child survive parent deletion?
                   ├─ YES (independent value) → SET NULL
                   └─ NO (meaningless without parent) → CASCADE (avoid for billing)
```

**Summary Rules:**
1. **Required FK (NOT NULL)** → Always use RESTRICT
2. **Optional FK (nullable)** → Use SET NULL
3. **Never use CASCADE** for billing/financial data
4. **Reference tables** (currencies, etc.) → Always RESTRICT

### Implementation Notes

1. **Always prefer RESTRICT over CASCADE** for billing/financial data
2. **Use SET NULL for optional relationships** to preserve child records
3. **Implement soft delete** in application code, not database cascades
4. **Document the reason** in SQL comment when choosing ON DELETE action
5. **Analytics tables are immutable**: Never delete, only aggregate/archive
6. **When in doubt, use RESTRICT** - it's always safer to prevent deletion

---

## 1.8 Optimistic Locking Pattern

Tables with concurrent update scenarios require a `version` field for optimistic locking to prevent race conditions and data loss.

### The Problem

Without version control, concurrent updates can overwrite each other:

```
Process A: Reads invoice (amount_remaining: 100, version: 1)
Process B: Reads invoice (amount_remaining: 100, version: 1)
Process A: Applies $50 payment → UPDATE amount_remaining = 50
Process B: Applies $30 payment → UPDATE amount_remaining = 70  ← OVERWRITES Process A!

Result: Customer paid $80 but system shows $70 remaining. $50 payment LOST.
```

### The Solution

Add `version INTEGER NOT NULL DEFAULT 1` and include it in UPDATE conditions:

**SQL Pattern:**
```sql
-- Optimistic locking: prevents concurrent update conflicts
-- Application must include "WHERE version = X" and increment on update
version INTEGER NOT NULL DEFAULT 1,
```

**Drizzle Pattern:**
```typescript
// Optimistic locking: prevents concurrent update conflicts
// Application must include "WHERE version = X" and increment on update
version: integer('version').notNull().default(1),
```

**Application Usage Pattern:**
```typescript
// Read current state
const invoice = await db.query.invoices.findFirst({
  where: eq(invoices.id, invoiceId)
});

// Attempt update with version check
const result = await db
  .update(invoices)
  .set({
    amountPaid: newAmount,
    version: invoice.version + 1,
    updatedAt: new Date()
  })
  .where(
    and(
      eq(invoices.id, invoiceId),
      eq(invoices.version, invoice.version)  // Version check
    )
  );

// Check if update succeeded (rowCount > 0)
if (result.rowCount === 0) {
  throw new OptimisticLockError('Invoice was modified by another process');
}
```

### Tables Requiring Optimistic Locking

| Table | `version` Field | Concurrent Update Scenarios |
|-------|-----------------|---------------------------|
| `billing_invoices` | ✅ Required | Partial payments, status changes, amount adjustments |
| `billing_promo_codes` | ✅ Required | `used_count` increments from multiple redemptions |
| `billing_plans` | ✅ Required | Price updates, feature/limit changes |
| `billing_payment_methods` | ✅ Required | `is_default` changes, metadata updates |

### Implementation Requirements

1. **Always include version in WHERE clause** when updating these tables
2. **Always increment version** in the SET clause: `version = version + 1`
3. **Always check rowCount** after update to detect conflicts
4. **Implement retry logic** with exponential backoff for conflicts:

```typescript
async function updateWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OptimisticLockError && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 100); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

5. **Log conflicts** for monitoring and debugging:

```typescript
logger.warn('Optimistic lock conflict', {
  table: 'billing_invoices',
  id: invoiceId,
  attemptedVersion: invoice.version,
  operation: 'apply_payment'
});
```

---

## 1.9 SQL COMMENT Documentation Standard

All database objects (tables, columns, constraints, indexes) should include SQL `COMMENT` statements to provide self-documenting schema metadata. This documentation is queryable and visible in database tools, making the schema self-explanatory.

### Why COMMENT Statements Matter

1. **Self-Documenting Schema:** Comments are stored in PostgreSQL's system catalog and visible in any database tool
2. **Developer Onboarding:** New developers can understand schema purpose directly in the database
3. **API Generation:** Tools like PostgREST and Hasura use column comments for API documentation
4. **Audit Compliance:** Auditors can verify data purpose and constraints directly in the database
5. **Migration Safety:** Comments explain why constraints exist, preventing accidental removal

### Required COMMENT Patterns

#### Table Comments

Every table MUST have a COMMENT explaining its purpose and key relationships:

```sql
COMMENT ON TABLE billing_subscriptions IS
'Customer subscriptions to billing plans. Core entity linking customers to their active or historical plan enrollments. Related to: billing_customers (owner), billing_plans (plan definition), billing_payments (charges), billing_invoices (billing documents).';

COMMENT ON TABLE billing_promo_code_usage IS
'Tracks promo code redemptions by customers. Records when, where, and how much discount was applied. Immutable audit record - never updated after creation.';

COMMENT ON TABLE billing_audit_logs IS
'Immutable audit trail for all billing operations. Append-only table - rows are never updated or deleted. Used for compliance, debugging, and security analysis.';
```

#### Column Comments

Columns with non-obvious purposes, business rules, or constraints MUST have COMMENT:

```sql
-- Business logic columns
COMMENT ON COLUMN billing_subscriptions.renewal_count IS
'Number of successful renewals. Incremented on each period renewal payment. Used for retention/LTV analytics. Never decremented.';

COMMENT ON COLUMN billing_payments.amount_available IS
'Remaining amount available for application to invoices. Generated column: amount - amount_applied - refunded_amount. Read-only.';

COMMENT ON COLUMN billing_invoices.line_items IS
'JSONB array of invoice line items. Each item must have: description (string), quantity (number), unit_price (string as decimal), total (string as decimal). Validated by CHECK constraint.';

-- Timestamp columns with specific semantics
COMMENT ON COLUMN billing_promo_code_usage.used_at IS
'When the promo code was applied. Indexed (DESC) for time-based analytics. Immutable after creation.';

COMMENT ON COLUMN billing_subscriptions.canceled_at IS
'When cancellation was requested. NULL if not canceled. Subscription remains active until current_period_end.';

-- Foreign key columns with business context
COMMENT ON COLUMN billing_subscriptions.locked_plan_version_id IS
'Optional reference to a specific plan version for grandfathering. When set, subscription uses this version''s pricing/features instead of current plan. NULL means use current plan terms.';

-- Enum-like columns
COMMENT ON COLUMN billing_payments.status IS
'Payment lifecycle status. Values: pending (awaiting processing), processing (in progress), succeeded (completed), failed (declined/error), refunded (fully refunded), partially_refunded, canceled (voided before processing).';
```

#### Constraint Comments

Complex constraints MUST have COMMENT explaining the business rule:

```sql
COMMENT ON CONSTRAINT chk_invoice_discount_limit ON billing_invoices IS
'Discount cannot exceed subtotal. Business rule: you cannot discount more than the original amount.';

COMMENT ON CONSTRAINT chk_vendor_commission_rate ON billing_vendors IS
'Commission rate must be between 0 (0%) and 1 (100%). Edge cases: 0 for special agreements, 1 for internal vendors.';

COMMENT ON CONSTRAINT uq_webhook_delivery_event_endpoint ON billing_webhook_deliveries IS
'Ensures each event is delivered to each endpoint exactly once per environment. Retries update the existing record.';

COMMENT ON CONSTRAINT chk_invoice_line_items_is_array ON billing_invoices IS
'Ensures line_items is a valid JSONB array. Application layer validates individual item structure.';
```

#### Index Comments

Indexes with non-obvious purposes MUST have COMMENT:

```sql
COMMENT ON INDEX idx_subscriptions_renewal_count IS
'Partial index for renewal analytics. Excludes soft-deleted subscriptions. Used for: customer segmentation by loyalty, cohort retention analysis, LTV calculations.';

COMMENT ON INDEX idx_payments_pending_retry IS
'Partial index for payment retry job. Only indexes failed payments with retry scheduled. Columns: next_retry_at for job scheduling.';

COMMENT ON INDEX idx_promo_usage_used_at IS
'B-tree DESC index for time-based analytics queries. Enables efficient monthly reports, trending analysis, and recent usage dashboards.';

COMMENT ON INDEX idx_audit_logs_request_id IS
'Partial index for request correlation. Only indexes rows with request_id (HTTP-initiated events). System events and background jobs have NULL request_id.';
```

### Comment Content Guidelines

| Element | Required Content |
|---------|------------------|
| Table | Purpose, key relationships, mutability (append-only, soft-delete, etc.) |
| Column (business) | What it represents, how it's used, update rules |
| Column (timestamp) | When it's set, whether it's immutable, index status |
| Column (FK) | Business context, NULL meaning, deletion behavior |
| Column (enum-like) | All valid values with descriptions |
| Column (generated) | Formula explanation, that it's read-only |
| Constraint (CHECK) | Business rule being enforced |
| Constraint (UNIQUE) | Why uniqueness matters, scope (per-tenant, per-env) |
| Index | Query patterns supported, partial index conditions, columns included |

### Migration Pattern for Adding Comments

```typescript
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Add COMMENT statements to database objects.
 * Comments are metadata-only changes - no table locks, instant apply.
 */
export async function addSchemaComments(db: PostgresJsDatabase) {
  // Table comments
  await db.execute(sql`
    COMMENT ON TABLE billing_subscriptions IS
    'Customer subscriptions to billing plans. Core entity linking customers to their active or historical plan enrollments.';
  `);

  // Column comments
  await db.execute(sql`
    COMMENT ON COLUMN billing_subscriptions.renewal_count IS
    'Number of successful renewals. Incremented on each period renewal payment. Used for retention/LTV analytics.';
  `);

  // Constraint comments
  await db.execute(sql`
    COMMENT ON CONSTRAINT chk_invoice_discount_limit ON billing_invoices IS
    'Discount cannot exceed subtotal. Business rule: you cannot discount more than the original amount.';
  `);

  // Index comments
  await db.execute(sql`
    COMMENT ON INDEX idx_promo_usage_used_at IS
    'B-tree DESC index for time-based analytics queries.';
  `);
}
```

### Querying Comments

Comments are stored in PostgreSQL's system catalog and can be queried:

```sql
-- Get all table comments
SELECT
  c.relname AS table_name,
  d.description AS comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'billing_%'
ORDER BY c.relname;

-- Get column comments for a specific table
SELECT
  a.attname AS column_name,
  d.description AS comment
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
WHERE n.nspname = 'public'
  AND c.relname = 'billing_subscriptions'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- Get constraint comments
SELECT
  conname AS constraint_name,
  d.description AS comment
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
LEFT JOIN pg_description d ON d.objoid = con.oid
WHERE c.relname = 'billing_invoices';
```

### Implementation Priority

Comments should be added in this order during implementation:

1. **Phase 1 (Critical Tables):** billing_customers, billing_subscriptions, billing_payments, billing_invoices
2. **Phase 2 (Supporting Tables):** billing_promo_codes, billing_vendors, billing_plans, billing_payment_methods
3. **Phase 3 (Analytics/Audit):** billing_audit_logs, billing_webhook_events, billing_job_executions
4. **Phase 4 (All Remaining):** All other billing_* tables

### Drizzle Integration Note

Drizzle ORM doesn't have native COMMENT support in schema definitions. Comments must be added via raw SQL in migrations or a separate documentation migration. Use JSDoc comments in Drizzle schema for TypeScript-level documentation, and SQL COMMENT for database-level documentation:

```typescript
// Drizzle schema - JSDoc for TypeScript
export const subscriptions = pgTable('billing_subscriptions', {
  /**
   * Number of successful renewals.
   * @see SQL COMMENT for full documentation
   */
  renewalCount: integer('renewal_count').notNull().default(0),
});

// Migration - SQL COMMENT for database
await db.execute(sql`
  COMMENT ON COLUMN billing_subscriptions.renewal_count IS
  'Number of successful renewals. Incremented on each period renewal payment. Used for retention/LTV analytics.';
`);
```

---

## 1.10 Pagination Patterns

All list endpoints and queries that can return large result sets MUST implement pagination. This section documents the required patterns for consistent, performant pagination across the billing system.

### Pagination Strategy Selection

| Strategy | Use When | Tables |
|----------|----------|--------|
| **Cursor-based** | Large tables, real-time data, infinite scroll | billing_payments, billing_invoices, billing_audit_logs, billing_webhook_events, billing_usage_records |
| **Offset-based** | Small tables, admin UI with page numbers | billing_plans, billing_currencies, billing_promo_codes (active only) |

**Default:** Use cursor-based pagination unless the table is guaranteed to be small (<1000 rows).

### Cursor-Based Pagination (Recommended)

Cursor-based pagination uses an opaque cursor (typically the last item's ID or timestamp) to fetch the next page. This approach:
- Provides consistent results even when data changes
- Performs well regardless of page depth (no OFFSET scan)
- Works with real-time data (new inserts don't shift pages)

#### SQL Pattern

```sql
-- First page: Get newest 20 payments for a customer
SELECT *
FROM billing_payments
WHERE customer_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page: Use cursor from last item (created_at, id)
SELECT *
FROM billing_payments
WHERE customer_id = $1
  AND deleted_at IS NULL
  AND (created_at, id) < ($cursor_created_at, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Why use (created_at, id)?**
- `created_at` alone can have duplicates (multiple payments in same millisecond)
- Adding `id` (UUID) ensures uniqueness
- Compound cursor guarantees stable ordering

#### Required Index for Cursor Pagination

```sql
-- Index for cursor-based pagination on payments
-- Covers: customer filtering + cursor ordering
CREATE INDEX idx_payments_customer_cursor
  ON billing_payments(customer_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Index for invoice pagination
CREATE INDEX idx_invoices_customer_cursor
  ON billing_invoices(customer_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Index for audit log pagination (high-volume table)
CREATE INDEX idx_audit_logs_cursor
  ON billing_audit_logs(created_at DESC, id DESC);
```

#### TypeScript Implementation

```typescript
import { sql, desc, lt, and, eq } from 'drizzle-orm';

/**
 * Cursor for pagination. Encoded as base64 JSON for URL safety.
 */
interface PaginationCursor {
  createdAt: string;  // ISO 8601 timestamp
  id: string;         // UUID
}

/**
 * Pagination request parameters.
 */
interface PaginationParams {
  /** Number of items per page (default: 20, max: 100) */
  limit?: number;
  /** Cursor from previous response (omit for first page) */
  cursor?: string;
  /** Sort direction (default: desc for most recent first) */
  direction?: 'asc' | 'desc';
}

/**
 * Pagination response metadata.
 */
interface PaginationMeta {
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether more pages exist */
  hasMore: boolean;
  /** Number of items in current page */
  count: number;
}

/**
 * Paginated response wrapper.
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Encode cursor to URL-safe string.
 */
function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

/**
 * Decode cursor from URL-safe string.
 * Returns null if invalid.
 */
function decodeCursor(encoded: string): PaginationCursor | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed.createdAt && parsed.id) {
      return parsed as PaginationCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get paginated payments for a customer.
 *
 * @example
 * // First page
 * const page1 = await getCustomerPayments(db, 'cust_123', { limit: 20 });
 *
 * // Next page
 * const page2 = await getCustomerPayments(db, 'cust_123', {
 *   limit: 20,
 *   cursor: page1.pagination.nextCursor
 * });
 */
async function getCustomerPayments(
  db: PostgresJsDatabase,
  customerId: string,
  params: PaginationParams = {}
): Promise<PaginatedResponse<Payment>> {
  const limit = Math.min(params.limit ?? 20, 100);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;

  // Build query with optional cursor condition
  let query = db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.customerId, customerId),
        isNull(payments.deletedAt),
        // Cursor condition: get items AFTER the cursor position
        cursor
          ? sql`(${payments.createdAt}, ${payments.id}) < (${cursor.createdAt}, ${cursor.id})`
          : undefined
      )
    )
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(limit + 1);  // Fetch one extra to detect hasMore

  const results = await query;

  // Check if there are more pages
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;

  // Build next cursor from last item
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem
    ? encodeCursor({
        createdAt: lastItem.createdAt.toISOString(),
        id: lastItem.id
      })
    : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      count: data.length
    }
  };
}
```

#### API Response Format

```typescript
// GET /api/customers/:id/payments?limit=20&cursor=eyJjcmVhdGVkQXQiOi...

{
  "data": [
    { "id": "pay_abc", "amount": "99.99", "createdAt": "2025-01-15T10:30:00Z", ... },
    { "id": "pay_def", "amount": "49.99", "createdAt": "2025-01-14T15:45:00Z", ... },
    // ... 18 more items
  ],
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTE0VDE1OjQ1OjAwWiIsImlkIjoicGF5X2RlZiJ9",
    "hasMore": true,
    "count": 20
  }
}
```

### Offset-Based Pagination (Limited Use)

Offset-based pagination uses LIMIT/OFFSET for traditional page numbers. Use ONLY for:
- Admin interfaces with explicit page numbers
- Small, static reference tables
- Export/reporting tools (not user-facing)

#### SQL Pattern

```sql
-- Get page 3 (items 41-60) of plans
SELECT *
FROM billing_plans
WHERE deleted_at IS NULL
ORDER BY name ASC
LIMIT 20 OFFSET 40;

-- Always include total count for UI
SELECT COUNT(*) FROM billing_plans WHERE deleted_at IS NULL;
```

**Warning:** OFFSET scans and discards rows, becoming slower with deeper pages.

#### TypeScript Implementation

```typescript
/**
 * Offset-based pagination for small tables only.
 * WARNING: Do not use for tables with >1000 rows.
 */
interface OffsetPaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  pageSize?: number;
}

interface OffsetPaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether previous page exists */
  hasPrevious: boolean;
  /** Whether next page exists */
  hasNext: boolean;
}

/**
 * Get paginated list of plans (small table, offset OK).
 */
async function getPlans(
  db: PostgresJsDatabase,
  params: OffsetPaginationParams = {}
): Promise<PaginatedResponse<Plan> & { pagination: OffsetPaginationMeta }> {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.min(params.pageSize ?? 20, 100);
  const offset = (page - 1) * pageSize;

  // Get items for current page
  const data = await db
    .select()
    .from(plans)
    .where(isNull(plans.deletedAt))
    .orderBy(asc(plans.name))
    .limit(pageSize)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(plans)
    .where(isNull(plans.deletedAt));

  const totalItems = Number(count);
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    }
  };
}
```

### Pagination Limits

All pagination MUST enforce limits to prevent abuse:

| Parameter | Default | Maximum | Reason |
|-----------|---------|---------|--------|
| `limit` / `pageSize` | 20 | 100 | Prevent memory exhaustion |
| `page` (offset) | 1 | 1000 | Prevent deep offset scans |

```typescript
// Enforce limits at API layer
const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
const page = Math.min(Math.max(params.page ?? 1, 1), 1000);
```

### Tables Requiring Pagination

The following tables MUST have pagination for any list query:

| Table | Strategy | Cursor Columns | Index Required |
|-------|----------|----------------|----------------|
| billing_payments | Cursor | (created_at, id) | idx_payments_customer_cursor |
| billing_invoices | Cursor | (created_at, id) | idx_invoices_customer_cursor |
| billing_audit_logs | Cursor | (created_at, id) | idx_audit_logs_cursor |
| billing_webhook_events | Cursor | (created_at, id) | idx_webhook_events_cursor |
| billing_usage_records | Cursor | (period_start, id) | idx_usage_records_cursor |
| billing_promo_code_usage | Cursor | (used_at, id) | idx_promo_usage_cursor |
| billing_subscriptions | Cursor | (created_at, id) | idx_subscriptions_customer_cursor |
| billing_customer_discounts | Cursor | (created_at, id) | idx_customer_discounts_cursor |
| billing_plans | Offset | N/A | Primary key sufficient |
| billing_currencies | Offset | N/A | Primary key sufficient |

### Drizzle Helper Functions

```typescript
import { sql, desc, asc, and, isNull } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';

/**
 * Generic cursor pagination helper.
 * Works with any table that has createdAt and id columns.
 */
async function paginateWithCursor<T extends PgTable>(
  db: PostgresJsDatabase,
  table: T,
  options: {
    where?: SQL;
    cursor?: PaginationCursor;
    limit?: number;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<PaginatedResponse<T['$inferSelect']>> {
  const limit = Math.min(options.limit ?? 20, 100);
  const dir = options.orderDirection ?? 'desc';

  const orderFn = dir === 'desc' ? desc : asc;
  const comparator = dir === 'desc' ? '<' : '>';

  let whereClause = options.where;

  if (options.cursor) {
    const cursorCondition = sql`(${table.createdAt}, ${table.id}) ${sql.raw(comparator)} (${options.cursor.createdAt}, ${options.cursor.id})`;
    whereClause = whereClause
      ? and(whereClause, cursorCondition)
      : cursorCondition;
  }

  const results = await db
    .select()
    .from(table)
    .where(whereClause)
    .orderBy(orderFn(table.createdAt), orderFn(table.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const lastItem = data[data.length - 1];

  return {
    data,
    pagination: {
      nextCursor: hasMore && lastItem
        ? encodeCursor({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id })
        : null,
      hasMore,
      count: data.length
    }
  };
}
```

### Performance Considerations

1. **Always use indexes:** Cursor pagination requires a composite index on (filter_column, sort_column, id)
2. **Fetch limit+1:** To detect hasMore without a separate COUNT query
3. **Avoid COUNT on large tables:** Use hasMore instead of totalCount for cursor pagination
4. **Use covering indexes:** Include frequently selected columns in index for Index-Only Scans
5. **Test with production data volumes:** Pagination performance degrades differently at scale

---

## 1.11 Soft Delete Pattern

All billing tables that support deletion use soft delete via a `deleted_at` timestamp column. This pattern preserves data for audit trails, compliance, and potential recovery while logically removing records from active queries.

### Tables Using Soft Delete

| Table | Has deleted_at | Reason |
|-------|----------------|--------|
| billing_customers | ✅ Yes | Customer data must be preserved for invoices, payments |
| billing_subscriptions | ✅ Yes | Subscription history for analytics, compliance |
| billing_payments | ✅ Yes | Payment records are legal documents |
| billing_invoices | ✅ Yes | Invoices are legal documents, cannot be hard deleted |
| billing_payment_methods | ✅ Yes | Payment method history for audit |
| billing_promo_codes | ✅ Yes | Promo code usage history |
| billing_plans | ✅ Yes | Plan history for grandfathered subscriptions |
| billing_vendors | ✅ Yes | Vendor commission history |
| billing_audit_logs | ❌ No | Append-only, never deleted |
| billing_webhook_events | ❌ No | Append-only event log |
| billing_currencies | ❌ No | Reference data, use `active` flag instead |

### Soft Delete Column Definition

```sql
-- Standard soft delete column definition
deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

-- NULL = active record
-- NOT NULL = deleted at specified timestamp
```

```typescript
// Drizzle schema
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

### Protection Trigger: Prevent Accidental Hard Deletes

To prevent accidental `DELETE FROM` statements that would permanently remove data, implement a protection trigger that converts hard deletes to soft deletes:

#### SQL Trigger Definition

```sql
-- Function to convert DELETE to soft delete (UPDATE deleted_at)
CREATE OR REPLACE FUNCTION billing_soft_delete_protection()
RETURNS TRIGGER AS $$
BEGIN
  -- If deleted_at is already set, this is a legitimate cleanup of old soft-deleted records
  -- Allow the hard delete in this case (for data retention cleanup jobs)
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;  -- Allow hard delete of already soft-deleted records
  END IF;

  -- For active records, convert DELETE to soft delete
  -- This prevents accidental data loss
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
  ) USING OLD.id;

  -- Log the prevented hard delete for monitoring
  RAISE NOTICE 'Hard DELETE prevented on %.%. Record soft-deleted instead. id=%',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id;

  -- Return NULL to cancel the original DELETE
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with soft delete
CREATE TRIGGER trg_customers_soft_delete
  BEFORE DELETE ON billing_customers
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_subscriptions_soft_delete
  BEFORE DELETE ON billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_payments_soft_delete
  BEFORE DELETE ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_invoices_soft_delete
  BEFORE DELETE ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_payment_methods_soft_delete
  BEFORE DELETE ON billing_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_promo_codes_soft_delete
  BEFORE DELETE ON billing_promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_plans_soft_delete
  BEFORE DELETE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();

CREATE TRIGGER trg_vendors_soft_delete
  BEFORE DELETE ON billing_vendors
  FOR EACH ROW
  EXECUTE FUNCTION billing_soft_delete_protection();
```

#### Trigger Behavior Summary

| Scenario | Trigger Behavior | Result |
|----------|------------------|--------|
| DELETE on active record (deleted_at IS NULL) | Converts to UPDATE SET deleted_at = NOW() | Record soft-deleted |
| DELETE on soft-deleted record (deleted_at IS NOT NULL) | Allows DELETE | Record permanently removed |
| UPDATE SET deleted_at = NOW() | No trigger (not a DELETE) | Record soft-deleted |

### Application-Level Soft Delete

The recommended approach is to use application-level soft delete functions. The trigger serves as a safety net.

#### TypeScript Implementation

```typescript
import { eq, isNull, sql } from 'drizzle-orm';

/**
 * Soft delete a record by setting deleted_at timestamp.
 * This is the preferred method for deleting records.
 *
 * @param db - Database connection
 * @param table - Drizzle table reference
 * @param id - Record ID to soft delete
 * @returns Updated record with deleted_at set
 */
async function softDelete<T extends PgTableWithColumns<any>>(
  db: PostgresJsDatabase,
  table: T,
  id: string
): Promise<T['$inferSelect'] | null> {
  const [deleted] = await db
    .update(table)
    .set({ deletedAt: sql`NOW()` })
    .where(eq(table.id, id))
    .returning();

  return deleted ?? null;
}

/**
 * Soft delete a customer and log the action.
 *
 * @example
 * await softDeleteCustomer(db, 'cust_123', 'admin_456', 'Customer requested account deletion');
 */
async function softDeleteCustomer(
  db: PostgresJsDatabase,
  customerId: string,
  deletedBy: string,
  reason: string
): Promise<Customer | null> {
  return await db.transaction(async (tx) => {
    // Soft delete the customer
    const [customer] = await tx
      .update(customers)
      .set({
        deletedAt: sql`NOW()`,
        metadata: sql`metadata || jsonb_build_object('deleted_by', ${deletedBy}, 'deletion_reason', ${reason})`
      })
      .where(
        and(
          eq(customers.id, customerId),
          isNull(customers.deletedAt)  // Only delete if not already deleted
        )
      )
      .returning();

    if (!customer) {
      return null;  // Customer not found or already deleted
    }

    // Log the deletion in audit log
    await tx.insert(auditLogs).values({
      entityType: 'customer',
      entityId: customerId,
      action: 'soft_delete',
      actorId: deletedBy,
      changes: { reason },
      createdAt: sql`NOW()`
    });

    return customer;
  });
}

/**
 * Restore a soft-deleted record.
 *
 * @param db - Database connection
 * @param table - Drizzle table reference
 * @param id - Record ID to restore
 * @returns Restored record with deleted_at cleared
 */
async function restore<T extends PgTableWithColumns<any>>(
  db: PostgresJsDatabase,
  table: T,
  id: string
): Promise<T['$inferSelect'] | null> {
  const [restored] = await db
    .update(table)
    .set({ deletedAt: null })
    .where(
      and(
        eq(table.id, id),
        sql`deleted_at IS NOT NULL`  // Only restore if currently deleted
      )
    )
    .returning();

  return restored ?? null;
}
```

### Query Patterns for Soft Delete

All queries MUST filter out soft-deleted records by default:

```typescript
// CORRECT: Always filter deleted records
const activeCustomers = await db
  .select()
  .from(customers)
  .where(isNull(customers.deletedAt));

// CORRECT: Include deleted records explicitly when needed
const allCustomers = await db
  .select()
  .from(customers);  // No filter = includes deleted

// CORRECT: Query only deleted records (for admin restore UI)
const deletedCustomers = await db
  .select()
  .from(customers)
  .where(sql`deleted_at IS NOT NULL`);
```

### Index Pattern for Soft Delete

Partial indexes should exclude soft-deleted records for better performance:

```sql
-- Partial index excluding soft-deleted records
CREATE INDEX idx_customers_email_active
  ON billing_customers(email)
  WHERE deleted_at IS NULL;

-- Unique constraint only on active records
CREATE UNIQUE INDEX uq_customers_external_id_active
  ON billing_customers(external_id, livemode)
  WHERE deleted_at IS NULL;
```

### Data Retention and Hard Delete

For compliance with data retention policies (e.g., GDPR right to erasure), implement a separate cleanup job that hard-deletes soft-deleted records after the retention period:

```typescript
/**
 * Permanently delete records that have been soft-deleted for longer than retention period.
 * The trigger allows hard delete when deleted_at IS NOT NULL.
 *
 * @param db - Database connection
 * @param retentionDays - Number of days to keep soft-deleted records (default: 90)
 */
async function cleanupSoftDeletedRecords(
  db: PostgresJsDatabase,
  retentionDays: number = 90
): Promise<{ table: string; deleted: number }[]> {
  const cutoffDate = sql`NOW() - INTERVAL '${retentionDays} days'`;
  const results: { table: string; deleted: number }[] = [];

  // Tables to clean up (in dependency order - children before parents)
  const tables = [
    { name: 'billing_promo_code_usage', ref: promoCodeUsage },
    { name: 'billing_customer_discounts', ref: customerDiscounts },
    { name: 'billing_subscription_addons', ref: subscriptionAddons },
    { name: 'billing_payments', ref: payments },
    { name: 'billing_invoices', ref: invoices },
    { name: 'billing_subscriptions', ref: subscriptions },
    { name: 'billing_payment_methods', ref: paymentMethods },
    { name: 'billing_customers', ref: customers },
  ];

  for (const table of tables) {
    const result = await db
      .delete(table.ref)
      .where(
        and(
          sql`deleted_at IS NOT NULL`,
          sql`deleted_at < ${cutoffDate}`
        )
      );

    results.push({ table: table.name, deleted: result.rowCount ?? 0 });
  }

  return results;
}
```

### Summary

| Component | Purpose |
|-----------|---------|
| `deleted_at` column | Timestamp when record was soft-deleted (NULL = active) |
| Protection trigger | Converts accidental DELETE to soft delete |
| `softDelete()` function | Application-level soft delete with audit logging |
| `restore()` function | Restore soft-deleted records |
| Partial indexes | Exclude deleted records from indexes |
| Cleanup job | Hard delete after retention period |

---

## 1.12 Auto-Update Timestamp Pattern

All tables with an `updated_at` column MUST use a trigger to automatically update this timestamp on every UPDATE operation. This ensures consistent tracking of record modifications without relying on application code.

### Tables with updated_at Column

| Table | Has updated_at | Trigger Required |
|-------|----------------|------------------|
| billing_customers | ✅ Yes | ✅ Yes |
| billing_subscriptions | ✅ Yes | ✅ Yes |
| billing_payments | ✅ Yes | ✅ Yes |
| billing_invoices | ✅ Yes | ✅ Yes |
| billing_payment_methods | ✅ Yes | ✅ Yes |
| billing_promo_codes | ✅ Yes | ✅ Yes |
| billing_plans | ✅ Yes | ✅ Yes |
| billing_vendors | ✅ Yes | ✅ Yes |
| billing_automatic_discounts | ✅ Yes | ✅ Yes |
| billing_customer_discounts | ✅ Yes | ✅ Yes |
| billing_subscription_addons | ✅ Yes | ✅ Yes |
| billing_webhook_endpoints | ✅ Yes | ✅ Yes |
| billing_webhook_deliveries | ✅ Yes | ✅ Yes |
| billing_exchange_rates | ✅ Yes | ✅ Yes |
| billing_audit_logs | ❌ No | N/A (append-only) |
| billing_promo_code_usage | ❌ No | N/A (immutable) |
| billing_pricing_snapshots | ❌ No | N/A (immutable) |

### Column Definition

```sql
-- Standard updated_at column definition
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

-- Must be NOT NULL with DEFAULT NOW()
-- Value set automatically on INSERT by DEFAULT
-- Value updated automatically on UPDATE by trigger
```

```typescript
// Drizzle schema
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

### Trigger Function Definition

```sql
-- Function to automatically set updated_at to current timestamp
-- This function is reusable across all tables
CREATE OR REPLACE FUNCTION billing_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set updated_at to current timestamp
  -- NEW refers to the row being inserted/updated
  NEW.updated_at = NOW();

  -- Return the modified row
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION billing_set_updated_at() IS
'Trigger function to automatically update the updated_at timestamp on row modification. Applied to all billing tables with updated_at column.';
```

### Trigger Creation for All Tables

```sql
-- billing_customers
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_subscriptions
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_payments
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_invoices
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_payment_methods
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON billing_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_promo_codes
CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON billing_promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_plans
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_vendors
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON billing_vendors
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_automatic_discounts
CREATE TRIGGER trg_automatic_discounts_updated_at
  BEFORE UPDATE ON billing_automatic_discounts
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_customer_discounts
CREATE TRIGGER trg_customer_discounts_updated_at
  BEFORE UPDATE ON billing_customer_discounts
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_subscription_addons
CREATE TRIGGER trg_subscription_addons_updated_at
  BEFORE UPDATE ON billing_subscription_addons
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_webhook_endpoints
CREATE TRIGGER trg_webhook_endpoints_updated_at
  BEFORE UPDATE ON billing_webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_webhook_deliveries
CREATE TRIGGER trg_webhook_deliveries_updated_at
  BEFORE UPDATE ON billing_webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();

-- billing_exchange_rates
CREATE TRIGGER trg_exchange_rates_updated_at
  BEFORE UPDATE ON billing_exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION billing_set_updated_at();
```

### Trigger Behavior

| Operation | updated_at Behavior | Notes |
|-----------|---------------------|-------|
| INSERT | Set to NOW() by DEFAULT | No trigger needed for INSERT |
| UPDATE | Set to NOW() by trigger | Automatic, cannot be overridden |
| UPDATE (no changes) | Still updated | Even if data is identical |

### Application Code Behavior

With the trigger in place, application code does NOT need to set `updated_at`:

```typescript
// CORRECT: Don't set updated_at, trigger handles it
await db
  .update(customers)
  .set({
    name: 'New Name',
    // updated_at is NOT included - trigger sets it
  })
  .where(eq(customers.id, customerId));

// INCORRECT: Don't manually set updated_at
await db
  .update(customers)
  .set({
    name: 'New Name',
    updatedAt: new Date(),  // ❌ Unnecessary - trigger overwrites anyway
  })
  .where(eq(customers.id, customerId));
```

### Query Patterns Using updated_at

```typescript
// Get recently modified customers (last 24 hours)
const recentlyModified = await db
  .select()
  .from(customers)
  .where(
    and(
      isNull(customers.deletedAt),
      sql`updated_at >= NOW() - INTERVAL '24 hours'`
    )
  )
  .orderBy(desc(customers.updatedAt));

// Check if record was modified since last fetch (optimistic locking support)
const customer = await db
  .select()
  .from(customers)
  .where(
    and(
      eq(customers.id, customerId),
      eq(customers.updatedAt, lastKnownUpdatedAt)  // Verify not changed
    )
  );

if (!customer) {
  throw new Error('Record was modified by another process');
}

// Sync changed records since last sync
const changedSince = await db
  .select()
  .from(subscriptions)
  .where(sql`updated_at > ${lastSyncTimestamp}`)
  .orderBy(asc(subscriptions.updatedAt));
```

### Index for updated_at Queries

For tables that frequently query by modification time, add an index:

```sql
-- Index for "recently modified" queries
CREATE INDEX idx_customers_updated_at
  ON billing_customers(updated_at DESC)
  WHERE deleted_at IS NULL;

-- Index for subscription sync queries
CREATE INDEX idx_subscriptions_updated_at
  ON billing_subscriptions(updated_at ASC)
  WHERE deleted_at IS NULL;
```

### Migration Script

```typescript
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Migration: Add updated_at triggers to all billing tables.
 *
 * Purpose: Ensure updated_at is automatically maintained on all updates
 * Impact: Minimal (trigger adds ~microseconds to each UPDATE)
 * Rollback: DROP FUNCTION billing_set_updated_at() CASCADE;
 */
export async function addUpdatedAtTriggers(db: PostgresJsDatabase) {
  // Create the trigger function
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION billing_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Tables that need the trigger
  const tables = [
    'billing_customers',
    'billing_subscriptions',
    'billing_payments',
    'billing_invoices',
    'billing_payment_methods',
    'billing_promo_codes',
    'billing_plans',
    'billing_vendors',
    'billing_automatic_discounts',
    'billing_customer_discounts',
    'billing_subscription_addons',
    'billing_webhook_endpoints',
    'billing_webhook_deliveries',
    'billing_exchange_rates',
  ];

  // Create trigger for each table
  for (const table of tables) {
    const triggerName = `trg_${table.replace('billing_', '')}_updated_at`;

    // Drop existing trigger if any (idempotent)
    await db.execute(sql.raw(`
      DROP TRIGGER IF EXISTS ${triggerName} ON ${table};
    `));

    // Create trigger
    await db.execute(sql.raw(`
      CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION billing_set_updated_at();
    `));
  }

  // Add function comment
  await db.execute(sql`
    COMMENT ON FUNCTION billing_set_updated_at() IS
    'Trigger function to automatically update updated_at timestamp on row modification.';
  `);
}

/**
 * Rollback: Remove all updated_at triggers.
 * CASCADE removes all dependent triggers.
 */
export async function removeUpdatedAtTriggers(db: PostgresJsDatabase) {
  await db.execute(sql`
    DROP FUNCTION IF EXISTS billing_set_updated_at() CASCADE;
  `);
}
```

### Why Trigger Instead of Application Code?

| Approach | Pros | Cons |
|----------|------|------|
| **Trigger (Recommended)** | Consistent, can't be forgotten, works for direct SQL | Slight overhead (~μs per UPDATE) |
| Application code | No DB overhead | Easy to forget, inconsistent, bypassed by direct SQL |
| Drizzle middleware | TypeScript-level consistency | Bypassed by raw SQL, more complex |

### Summary

| Component | Purpose |
|-----------|---------|
| `updated_at` column | Tracks last modification time |
| `billing_set_updated_at()` | Reusable trigger function |
| `trg_*_updated_at` triggers | Per-table triggers |
| Index on updated_at | Performance for "recently modified" queries |

---

## 1.13 Table Partitioning

High-volume tables should be partitioned to maintain query performance and simplify data retention. PostgreSQL's declarative partitioning enables transparent partition management without application changes.

### Tables Recommended for Partitioning

| Table | Expected Growth | Partition Strategy | Partition Key |
|-------|-----------------|-------------------|---------------|
| billing_audit_logs | 1M+ rows/month | RANGE by month | created_at |
| billing_webhook_events | 500K+ rows/month | RANGE by month | created_at |
| billing_usage_records | 1M+ rows/month | RANGE by month | period_start |
| billing_job_executions | 100K+ rows/month | RANGE by month | started_at |
| billing_webhook_deliveries | 500K+ rows/month | RANGE by month | created_at |

### When to Implement Partitioning

Partitioning should be implemented when:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Table size | > 10 million rows | Implement partitioning |
| Monthly growth | > 500K rows/month | Plan for partitioning |
| Query performance | Full scans > 1 second | Implement partitioning |
| Retention requirement | Data older than 1 year deleted | Implement partitioning |

**Note:** Partitioning adds complexity. Don't partition tables that won't reach these thresholds.

### Partitioned Table Definition

#### billing_audit_logs (Partitioned)

```sql
-- Parent table (partitioned)
CREATE TABLE billing_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Entity reference
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  -- Action details
  action VARCHAR(50) NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255),

  -- Change data
  changes JSONB NOT NULL DEFAULT '{}',
  previous_state JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamp (partition key)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Primary key must include partition key
  PRIMARY KEY (id, created_at),

  CONSTRAINT chk_actor_type CHECK (
    actor_type IN ('user', 'admin', 'system', 'webhook', 'job', 'api_key')
  )
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
-- Naming convention: {table}_{year}_{month}
CREATE TABLE billing_audit_logs_2025_01 PARTITION OF billing_audit_logs
  FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');

CREATE TABLE billing_audit_logs_2025_02 PARTITION OF billing_audit_logs
  FOR VALUES FROM ('2025-02-01 00:00:00+00') TO ('2025-03-01 00:00:00+00');

CREATE TABLE billing_audit_logs_2025_03 PARTITION OF billing_audit_logs
  FOR VALUES FROM ('2025-03-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');

-- Continue for each month...

-- Default partition for data outside defined ranges (safety net)
CREATE TABLE billing_audit_logs_default PARTITION OF billing_audit_logs DEFAULT;

-- Indexes are created on the parent and automatically applied to partitions
CREATE INDEX idx_audit_logs_entity ON billing_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON billing_audit_logs(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_logs_request ON billing_audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_logs_livemode ON billing_audit_logs(livemode, created_at DESC);
```

#### billing_webhook_events (Partitioned)

```sql
CREATE TABLE billing_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  provider VARCHAR(30) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,

  payload JSONB NOT NULL,

  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id, created_at),

  CONSTRAINT chk_provider CHECK (provider IN ('stripe', 'mercadopago'))
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE billing_webhook_events_2025_01 PARTITION OF billing_webhook_events
  FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');

-- Continue for each month...
CREATE TABLE billing_webhook_events_default PARTITION OF billing_webhook_events DEFAULT;

-- Indexes
CREATE INDEX idx_webhook_events_provider ON billing_webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_type ON billing_webhook_events(event_type);
CREATE INDEX idx_webhook_events_unprocessed ON billing_webhook_events(created_at)
  WHERE processed = FALSE;
```

#### billing_usage_records (Partitioned)

```sql
CREATE TABLE billing_usage_records (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  subscription_id UUID NOT NULL,
  feature_key VARCHAR(100) NOT NULL,

  quantity DECIMAL(19, 8) NOT NULL,

  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  metadata JSONB DEFAULT '{}',

  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Partition by period_start (aligns with billing cycles)
  PRIMARY KEY (id, period_start),

  CONSTRAINT chk_period CHECK (period_end > period_start)
) PARTITION BY RANGE (period_start);

-- Monthly partitions
CREATE TABLE billing_usage_records_2025_01 PARTITION OF billing_usage_records
  FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');

-- Continue for each month...
CREATE TABLE billing_usage_records_default PARTITION OF billing_usage_records DEFAULT;

-- Indexes
CREATE INDEX idx_usage_records_subscription ON billing_usage_records(subscription_id, period_start);
CREATE INDEX idx_usage_records_feature ON billing_usage_records(feature_key, period_start);
```

### Partition Management

#### Automatic Partition Creation

Create partitions ahead of time to avoid insert failures:

```typescript
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Tables that use monthly partitioning.
 */
const PARTITIONED_TABLES = [
  { name: 'billing_audit_logs', partitionKey: 'created_at' },
  { name: 'billing_webhook_events', partitionKey: 'created_at' },
  { name: 'billing_usage_records', partitionKey: 'period_start' },
  { name: 'billing_job_executions', partitionKey: 'started_at' },
  { name: 'billing_webhook_deliveries', partitionKey: 'created_at' },
] as const;

/**
 * Create partitions for the next N months.
 * Run this monthly via cron job (e.g., on the 1st of each month).
 *
 * @param db - Database connection
 * @param monthsAhead - Number of months to create partitions for (default: 3)
 */
export async function createFuturePartitions(
  db: PostgresJsDatabase,
  monthsAhead: number = 3
): Promise<{ table: string; partition: string; created: boolean }[]> {
  const results: { table: string; partition: string; created: boolean }[] = [];
  const now = new Date();

  for (let i = 0; i <= monthsAhead; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const nextMonth = new Date(year, date.getMonth() + 1, 1);
    const nextYear = nextMonth.getFullYear();
    const nextMonthStr = String(nextMonth.getMonth() + 1).padStart(2, '0');

    for (const table of PARTITIONED_TABLES) {
      const partitionName = `${table.name}_${year}_${month}`;

      // Check if partition exists
      const [exists] = await db.execute(sql`
        SELECT 1 FROM pg_class WHERE relname = ${partitionName}
      `);

      if (!exists) {
        // Create partition
        const rangeStart = `${year}-${month}-01 00:00:00+00`;
        const rangeEnd = `${nextYear}-${nextMonthStr}-01 00:00:00+00`;

        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${partitionName}
          PARTITION OF ${table.name}
          FOR VALUES FROM ('${rangeStart}') TO ('${rangeEnd}')
        `));

        results.push({ table: table.name, partition: partitionName, created: true });
      } else {
        results.push({ table: table.name, partition: partitionName, created: false });
      }
    }
  }

  return results;
}

/**
 * Cron job to create partitions (run monthly).
 *
 * @example
 * // In your job scheduler (e.g., node-cron, pg_cron, or external scheduler)
 * // Run on the 1st of each month at 00:00 UTC
 * cron.schedule('0 0 1 * *', async () => {
 *   await createFuturePartitions(db, 3);
 * });
 */
```

#### Data Retention via Partition Drop

Dropping old partitions is much faster than DELETE statements:

```typescript
/**
 * Drop partitions older than retention period.
 * This is MUCH faster than DELETE and doesn't bloat the table.
 *
 * @param db - Database connection
 * @param retentionMonths - Keep data for this many months (default: 12)
 */
export async function dropOldPartitions(
  db: PostgresJsDatabase,
  retentionMonths: number = 12
): Promise<{ partition: string; dropped: boolean }[]> {
  const results: { partition: string; dropped: boolean }[] = [];

  // Calculate cutoff date
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const cutoffYear = cutoff.getFullYear();
  const cutoffMonth = cutoff.getMonth() + 1;

  for (const table of PARTITIONED_TABLES) {
    // Find partitions older than cutoff
    const partitions = await db.execute(sql`
      SELECT inhrelid::regclass::text AS partition_name
      FROM pg_inherits
      WHERE inhparent = ${table.name}::regclass
    `);

    for (const row of partitions) {
      const partitionName = row.partition_name as string;
      // Extract year and month from partition name (e.g., billing_audit_logs_2024_01)
      const match = partitionName.match(/_(\d{4})_(\d{2})$/);

      if (match) {
        const partYear = parseInt(match[1]);
        const partMonth = parseInt(match[2]);

        // Check if partition is older than cutoff
        if (partYear < cutoffYear || (partYear === cutoffYear && partMonth < cutoffMonth)) {
          // Drop the partition
          await db.execute(sql.raw(`DROP TABLE IF EXISTS ${partitionName}`));
          results.push({ partition: partitionName, dropped: true });
        }
      }
    }
  }

  return results;
}

/**
 * Cron job to drop old partitions (run monthly).
 *
 * @example
 * // Run on the 2nd of each month at 02:00 UTC (after partition creation)
 * cron.schedule('0 2 2 * *', async () => {
 *   await dropOldPartitions(db, 12);  // Keep 12 months of data
 * });
 */
```

### Query Behavior with Partitions

PostgreSQL automatically routes queries to relevant partitions (partition pruning):

```sql
-- This query only scans the January 2025 partition
SELECT * FROM billing_audit_logs
WHERE created_at >= '2025-01-01' AND created_at < '2025-02-01';

-- EXPLAIN shows partition pruning
EXPLAIN SELECT * FROM billing_audit_logs
WHERE created_at >= '2025-01-15' AND created_at < '2025-01-20';
-- Output: Scans only billing_audit_logs_2025_01

-- Query across multiple months scans only those partitions
SELECT COUNT(*) FROM billing_audit_logs
WHERE created_at >= '2025-01-01' AND created_at < '2025-04-01';
-- Scans: billing_audit_logs_2025_01, _2025_02, _2025_03
```

### Drizzle ORM with Partitioned Tables

Drizzle works transparently with partitioned tables:

```typescript
// Define schema for the parent table (same as non-partitioned)
export const auditLogs = pgTable('billing_audit_logs', {
  id: uuid('id').notNull().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  actorType: varchar('actor_type', { length: 20 }).notNull(),
  actorId: varchar('actor_id', { length: 255 }),
  changes: jsonb('changes').notNull().default({}),
  previousState: jsonb('previous_state'),
  ipAddress: text('ip_address'),  // Note: Drizzle doesn't have inet type
  userAgent: text('user_agent'),
  requestId: uuid('request_id'),
  livemode: boolean('livemode').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Composite primary key including partition key
  pk: primaryKey({ columns: [table.id, table.createdAt] }),
}));

// Queries work the same way
const recentLogs = await db
  .select()
  .from(auditLogs)
  .where(
    and(
      eq(auditLogs.entityType, 'subscription'),
      sql`created_at >= NOW() - INTERVAL '7 days'`
    )
  )
  .orderBy(desc(auditLogs.createdAt))
  .limit(100);
```

### Migration: Converting to Partitioned Table

Converting an existing table to partitioned requires data migration:

```typescript
/**
 * Migration: Convert billing_audit_logs to partitioned table.
 *
 * WARNING: This migration requires downtime or careful planning.
 * Steps:
 * 1. Create new partitioned table
 * 2. Copy data from old table
 * 3. Rename tables
 * 4. Update indexes
 */
export async function migrateToPartitionedAuditLogs(db: PostgresJsDatabase) {
  await db.transaction(async (tx) => {
    // 1. Create new partitioned table with different name
    await tx.execute(sql`
      CREATE TABLE billing_audit_logs_partitioned (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        actor_type VARCHAR(20) NOT NULL,
        actor_id VARCHAR(255),
        changes JSONB NOT NULL DEFAULT '{}',
        previous_state JSONB,
        ip_address INET,
        user_agent TEXT,
        request_id UUID,
        livemode BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);

    // 2. Create partitions for existing data range
    // (Determine range from existing data)
    const [minMax] = await tx.execute(sql`
      SELECT
        DATE_TRUNC('month', MIN(created_at)) AS min_month,
        DATE_TRUNC('month', MAX(created_at)) AS max_month
      FROM billing_audit_logs
    `);

    // Create partitions for each month in range
    // ... (loop through months and create partitions)

    // 3. Copy data (may take time for large tables)
    await tx.execute(sql`
      INSERT INTO billing_audit_logs_partitioned
      SELECT * FROM billing_audit_logs
    `);

    // 4. Rename tables atomically
    await tx.execute(sql`
      ALTER TABLE billing_audit_logs RENAME TO billing_audit_logs_old;
      ALTER TABLE billing_audit_logs_partitioned RENAME TO billing_audit_logs;
    `);

    // 5. Create indexes on new table
    await tx.execute(sql`
      CREATE INDEX idx_audit_logs_entity ON billing_audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_logs_actor ON billing_audit_logs(actor_id) WHERE actor_id IS NOT NULL;
    `);

    // 6. Drop old table (after verification)
    -- await tx.execute(sql`DROP TABLE billing_audit_logs_old`);
  });
}
```

### Summary

| Component | Purpose |
|-----------|---------|
| PARTITION BY RANGE | Monthly partitioning on timestamp |
| Partition naming | `{table}_{year}_{month}` convention |
| Default partition | Catches data outside defined ranges |
| `createFuturePartitions()` | Monthly cron to create upcoming partitions |
| `dropOldPartitions()` | Monthly cron to enforce data retention |
| Partition pruning | PostgreSQL auto-routes queries to relevant partitions |

### Retention Policy Summary

| Table | Retention | Reason |
|-------|-----------|--------|
| billing_audit_logs | 24 months | Compliance requirement |
| billing_webhook_events | 6 months | Debugging only |
| billing_usage_records | 36 months | Billing disputes |
| billing_job_executions | 3 months | Operational only |
| billing_webhook_deliveries | 6 months | Debugging only |

---

## Entity Relationship Diagram

> **Naming Convention**: All tables use the `billing_` prefix for namespace isolation.
> This ensures QZPay tables don't conflict with application tables in the host database.

```
┌───────────────────────┐       ┌─────────────────────────┐       ┌───────────────────────┐
│   billing_customers   │       │  billing_subscriptions  │       │    billing_payments   │
├───────────────────────┤       ├─────────────────────────┤       ├───────────────────────┤
│ id (PK)               │◄──────│ customer_id (FK)        │       │ id (PK)               │
│ external_id           │       │ id (PK)                 │◄──────│ subscription_id (FK)  │
│ email                 │       │ plan_id                 │       │ customer_id (FK)      │
│ name                  │       │ status                  │       │ amount                │
│ stripe_id             │       │ interval                │       │ currency              │
│ mp_id                 │       │ period_start            │       │ base_amount           │
│ metadata              │       │ period_end              │       │ base_currency         │
│ version               │       │ trial_end               │       │ exchange_rate         │
│ created_at            │       │ canceled_at             │       │ status                │
│ updated_at            │       │ promo_code_id           │       │ provider              │
│ deleted_at            │       │ version                 │       │ provider_id           │
│ livemode              │       │ metadata                │       │ refunded_amount       │
└───────────────────────┘       │ created_at              │       │ version               │
        │                       │ deleted_at              │       │ metadata              │
        │                       │ livemode                │       │ created_at            │
        │                       └─────────────────────────┘       │ deleted_at            │
        │                               │                         │ livemode              │
        │                               │                         └───────────────────────┘
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
                                │ amount_paid             │               │
                                │ amount_remaining        │               │
                                │ currency                │               │
                                │ line_items              │               │
                                │ due_date                │               │
                                │ paid_at                 │               │
                                │ version                 │               │
                                │ metadata                │               │
                                │ created_at              │               │
                                │ deleted_at              │               │
                                │ livemode                │               │
                                └─────────────────────────┘               │
                                        │                                 │
                                        │    ┌────────────────────────────┘
                                        ▼    ▼
                                ┌───────────────────────────────┐
                                │  billing_invoice_payments     │
                                ├───────────────────────────────┤
                                │ id (PK)                       │
                                │ invoice_id (FK)               │
                                │ payment_id (FK)               │
                                │ amount_applied                │
                                │ currency                      │
                                │ applied_at                    │
                                │ livemode                      │
                                └───────────────────────────────┘

┌───────────────────────┐       ┌───────────────────────────────┐       ┌───────────────────────┐
│ billing_promo_codes   │       │ billing_promo_code_usage      │       │    billing_vendors    │
├───────────────────────┤       ├───────────────────────────────┤       ├───────────────────────┤
│ id (PK)               │◄──────│ promo_code_id (FK)            │       │ id (PK)               │
│ code                  │       │ customer_id (FK)              │       │ external_id           │
│ type                  │       │ subscription_id (FK)          │       │ email                 │
│ value                 │       │ payment_id (FK)               │       │ name                  │
│ config                │       │ discount_amount               │       │ commission_rate       │
│ max_uses              │       │ used_at                       │       │ payment_mode          │
│ used_count            │       │ livemode                      │       │ stripe_account        │
│ max_per_customer      │       └───────────────────────────────┘       │ mp_merchant_id        │
│ valid_plans           │                                               │ onboard_status        │
│ new_only              │                                               │ can_receive           │
│ existing_only         │                                               │ version               │
│ starts_at             │                                               │ metadata              │
│ expires_at            │                                               │ created_at            │
│ combinable            │                                               │ updated_at            │
│ active                │                                               │ deleted_at            │
│ created_at            │                                               │ livemode              │
│ livemode              │                                               └───────────────────────┘
└───────────────────────┘                                                       │
                                                                                ▼
┌───────────────────────────────┐   ┌───────────────────────┐       ┌───────────────────────────┐
│  billing_payment_methods      │   │   billing_audit_logs  │       │  billing_vendor_payouts   │
├───────────────────────────────┤   ├───────────────────────┤       ├───────────────────────────┤
│ id (PK)                       │   │ id (PK)               │       │ id (PK)                   │
│ customer_id (FK)              │   │ entity_type           │       │ vendor_id (FK)            │
│ provider                      │   │ entity_id             │       │ amount                    │
│ provider_id                   │   │ action                │       │ currency                  │
│ type                          │   │ actor_type            │       │ status                    │
│ last_four                     │   │ actor_id              │       │ provider                  │
│ brand                         │   │ changes               │       │ provider_id               │
│ exp_month                     │   │ metadata              │       │ paid_at                   │
│ exp_year                      │   │ created_at            │       │ created_at                │
│ is_default                    │   │ livemode              │       │ livemode                  │
│ metadata                      │   └───────────────────────┘       └───────────────────────────┘
│ created_at                    │
│ livemode                      │
└───────────────────────────────┘

┌───────────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────┐
│   billing_webhook_events      │   │  billing_job_executions   │   │  billing_currencies   │
├───────────────────────────────┤   ├───────────────────────────┤   ├───────────────────────┤
│ id (PK)                       │   │ id (PK)                   │   │ code (PK)             │
│ provider                      │   │ job_name                  │   │ name                  │
│ event_type                    │   │ status                    │   │ minor_units           │
│ event_id                      │   │ started_at                │   │ symbol                │
│ payload                       │   │ completed_at              │   │ active                │
│ processed                     │   │ error                     │   │ livemode              │
│ processed_at                  │   │ metadata                  │   └───────────────────────┘
│ error                         │   │ livemode                  │
│ created_at                    │   └───────────────────────────┘
│ livemode                      │
└───────────────────────────────┘

┌───────────────────────────────┐   ┌───────────────────────────┐
│  billing_idempotency_keys     │   │    billing_event_queue    │
├───────────────────────────────┤   ├───────────────────────────┤
│ id (PK)                       │   │ id (PK)                   │
│ key (UNIQUE)                  │   │ event_type                │
│ entity_type                   │   │ payload                   │
│ entity_id                     │   │ status                    │
│ request_hash                  │   │ attempts                  │
│ response                      │   │ max_attempts              │
│ status                        │   │ scheduled_for             │
│ created_at                    │   │ locked_until              │
│ expires_at                    │   │ locked_by                 │
│ livemode                      │   │ last_error                │
└───────────────────────────────┘   │ processed_at              │
                                    │ created_at                │
                                    │ livemode                  │
                                    └───────────────────────────┘
```

---

## Table Definitions

### customers

Stores billing customer information linked to external user IDs.

```sql
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  mp_customer_id VARCHAR(255),

  -- Localization preference
  preferred_language VARCHAR(10) DEFAULT 'en',

  -- Customer segmentation for pricing and analytics
  -- segment: Business classification (retail, wholesale, enterprise, vip, partner)
  -- Used for: differentiated pricing rules, marketing campaigns, support tiers
  segment VARCHAR(50),

  -- tier: Subscription/service level (free, basic, pro, enterprise)
  -- Used for: feature gating, discount eligibility, usage limits
  -- Note: This is the customer's overall tier, distinct from individual plan tiers
  tier VARCHAR(20),

  -- Default billing address for invoices
  -- Structure: { line1, line2?, city, state?, postal_code, country, company_name?, attention?, phone? }
  -- country: ISO 3166-1 alpha-2 code (US, AR, MX, ES, etc.)
  -- Used as default when creating invoices; can be overridden per invoice
  billing_address JSONB,

  -- Shipping address for physical goods (marketplace, product fulfillment)
  -- Same structure as billing_address
  -- Optional: Only needed for businesses shipping physical products
  shipping_address JSONB,

  -- Tax identification for B2B invoicing and VAT validation
  -- tax_id: The actual tax ID number (e.g., "DE123456789", "RFC123456ABC")
  -- tax_id_type: Type of tax ID for validation and formatting
  tax_id VARCHAR(50),
  tax_id_type VARCHAR(20),  -- 'vat', 'rfc', 'cuit', 'ein', 'gst', 'abn', etc.

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint per environment
  CONSTRAINT uq_customers_external_id_livemode UNIQUE (external_id, livemode),

  -- Basic email format validation (defense in depth)
  -- Validates: at least one char before @, at least one char after @, at least one dot after @
  -- Pattern: .+@.+\..+ matches "a@b.c" but rejects "invalid", "@no-local", "no-domain@"
  -- More sophisticated validation should be done at application layer
  CONSTRAINT chk_customer_email_format CHECK (email ~ '.+@.+\..+')
);

CREATE INDEX idx_customers_external_id ON billing_customers(external_id);
CREATE INDEX idx_customers_email ON billing_customers(email);
CREATE INDEX idx_customers_stripe_id ON billing_customers(stripe_customer_id);
CREATE INDEX idx_customers_mp_id ON billing_customers(mp_customer_id);
CREATE INDEX idx_customers_active ON billing_customers(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_livemode ON billing_customers(livemode) WHERE deleted_at IS NULL;
-- Customer segmentation indexes (partial - only for customers with segment/tier set)
-- Enables efficient queries like "all enterprise customers" or "all pro tier customers"
CREATE INDEX idx_customers_segment ON billing_customers(segment)
  WHERE segment IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_customers_tier ON billing_customers(tier)
  WHERE tier IS NOT NULL AND deleted_at IS NULL;
-- Composite index for segment + tier queries (e.g., "enterprise customers on pro tier")
CREATE INDEX idx_customers_segment_tier ON billing_customers(segment, tier)
  WHERE segment IS NOT NULL AND tier IS NOT NULL AND deleted_at IS NULL;
-- Tax ID index for B2B customer lookup (e.g., find customer by VAT number)
-- Partial index: only customers with tax_id set
CREATE INDEX idx_customers_tax_id ON billing_customers(tax_id)
  WHERE tax_id IS NOT NULL AND deleted_at IS NULL;
-- Country index for billing address (extracted from JSONB for common queries)
-- Useful for tax jurisdiction queries and regional reporting
CREATE INDEX idx_customers_billing_country ON billing_customers((billing_address->>'country'))
  WHERE billing_address IS NOT NULL AND deleted_at IS NULL;
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

export const customers = pgTable('billing_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  mpCustomerId: varchar('mp_customer_id', { length: 255 }),
  preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),

  // Customer segmentation for pricing and analytics
  // segment: Business classification (retail, wholesale, enterprise, vip, partner)
  segment: varchar('segment', { length: 50 }),
  // tier: Service level (free, basic, pro, enterprise) for feature gating
  tier: varchar('tier', { length: 20 }),

  // Default billing address for invoices
  // Structure: { line1, line2?, city, state?, postal_code, country, company_name?, attention?, phone? }
  billingAddress: jsonb('billing_address'),

  // Shipping address for physical goods (marketplace, fulfillment)
  // Same structure as billingAddress
  shippingAddress: jsonb('shipping_address'),

  // Tax identification for B2B invoicing
  // taxId: The tax ID number (e.g., "DE123456789", "RFC123456ABC")
  // taxIdType: Type for validation ('vat', 'rfc', 'cuit', 'ein', 'gst', 'abn')
  taxId: varchar('tax_id', { length: 50 }),
  taxIdType: varchar('tax_id_type', { length: 20 }),

  livemode: boolean('livemode').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

---

### subscriptions

Stores subscription records with complete lifecycle data.

```sql
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  plan_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  billing_interval VARCHAR(50) NOT NULL,
  interval_count INTEGER DEFAULT 1,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,

  -- Trial conversion tracking
  -- trial_converted: TRUE when trial successfully converts to paid subscription
  -- trial_converted_at: Timestamp of conversion (for cohort analysis and reporting)
  -- Set when: first successful payment after trial period ends
  -- Remains FALSE if: trial expires without payment, subscription canceled during trial
  trial_converted BOOLEAN DEFAULT FALSE,
  trial_converted_at TIMESTAMP WITH TIME ZONE,

  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_free BOOLEAN DEFAULT FALSE,
  free_reason VARCHAR(500),
  free_expires_at TIMESTAMP WITH TIME ZONE,
  -- Optional: promo code applied to this subscription
  -- SET NULL: If promo code is deleted, subscription remains valid
  --
  -- ============================================
  -- PROMO CODE VALIDATION (Application Layer)
  -- ============================================
  -- The FK constraint only validates that the promo_code_id exists.
  -- Business validation MUST be performed in the application layer before INSERT/UPDATE:
  --
  -- REQUIRED VALIDATIONS (enforced by validatePromoCodeForSubscription):
  --   1. Promo code is active (active = true)
  --   2. Promo code has not expired (expires_at IS NULL OR expires_at > NOW())
  --   3. Promo code has started (starts_at IS NULL OR starts_at <= NOW())
  --   4. Promo code has available uses (used_count < max_uses OR max_uses IS NULL)
  --   5. Customer is eligible (new customer only, specific plans, etc.)
  --
  -- WHEN TO VALIDATE:
  --   - Before creating a new subscription with promo_code_id
  --   - Before updating an existing subscription to add promo_code_id
  --   - NOT required when promo_code_id is being set to NULL (removal)
  --
  -- ADMIN OVERRIDES:
  --   - bypassExpiration: Allow expired codes (customer service gestures)
  --   - bypassUsageLimit: Allow over-limit codes (special promotions)
  --   - All overrides must be logged in audit_logs with actor_id
  --
  -- See: validatePromoCodeForSubscription() in specReview.md DATA-MED-015
  --
  promo_code_id UUID REFERENCES billing_promo_codes(id) ON DELETE SET NULL,
  stripe_subscription_id VARCHAR(255),
  mp_subscription_id VARCHAR(255),

  -- Pause/Resume fields
  paused_at TIMESTAMP WITH TIME ZONE,
  pause_until TIMESTAMP WITH TIME ZONE,
  pause_reason VARCHAR(500),
  pause_count INTEGER NOT NULL DEFAULT 0,
  retain_access_during_pause BOOLEAN DEFAULT FALSE,

  -- Renewal tracking for retention analytics and LTV calculation
  -- Incremented by 1 each time the subscription successfully renews (payment succeeds)
  -- Use cases:
  --   - Retention analysis: AVG(renewal_count) by cohort
  --   - LTV calculation: renewal_count * plan_price
  --   - Customer segmentation: loyal (12+), established (6-11), new (0-5)
  --   - Churn prediction: identify patterns before churn
  -- Updated when: successful payment at period end (not manual payments or one-time charges)
  -- NOT incremented for: trial conversions (that's tracked separately), failed payments
  renewal_count INTEGER NOT NULL DEFAULT 0,

  -- Per-Seat Pricing fields
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Plan Versioning (P2 - v1.1)
  -- Optional: locked plan version for grandfathering
  -- SET NULL: If plan version is deleted, subscription continues with current terms
  locked_plan_version_id UUID REFERENCES billing_plan_versions(id) ON DELETE SET NULL,

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_subscription_status CHECK (
    status IN ('incomplete', 'incomplete_expired', 'trialing', 'trial_expired', 'active', 'past_due', 'paused', 'canceled', 'expired', 'unpaid')
  ),
  CONSTRAINT chk_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT chk_billing_interval CHECK (
    billing_interval IN ('week', 'month', 'quarter', 'year', 'custom')
  ),
  CONSTRAINT chk_trial_dates CHECK (
    (trial_start IS NULL AND trial_end IS NULL) OR
    (trial_start IS NOT NULL AND trial_end IS NOT NULL AND trial_end > trial_start)
  )
);

-- Basic indexes
CREATE INDEX idx_subscriptions_customer_status ON billing_subscriptions(customer_id, status);
CREATE INDEX idx_subscriptions_plan_id ON billing_subscriptions(plan_id);
CREATE INDEX idx_subscriptions_period_end ON billing_subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_external_id ON billing_subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_external_id_mp ON billing_subscriptions(mp_subscription_id);
CREATE INDEX idx_subscriptions_trial_end ON billing_subscriptions(trial_end);

-- Optimized composite indexes
CREATE INDEX idx_subscriptions_active_customer
  ON billing_subscriptions(customer_id, status)
  WHERE deleted_at IS NULL AND status IN ('active', 'trialing');

CREATE INDEX idx_subscriptions_renewal
  ON billing_subscriptions(current_period_end)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_subscriptions_customer_status_covering
  ON billing_subscriptions(customer_id, status)
  INCLUDE (id, plan_id, current_period_start, current_period_end)
  WHERE deleted_at IS NULL;

-- Paused subscriptions (for auto-resume job)
CREATE INDEX idx_subscriptions_paused
  ON billing_subscriptions(pause_until)
  WHERE status = 'paused' AND pause_until IS NOT NULL AND deleted_at IS NULL;

-- Environment filtering
CREATE INDEX idx_subscriptions_livemode
  ON billing_subscriptions(livemode)
  WHERE deleted_at IS NULL;

-- Plan version queries (for grandfathering migrations and version distribution reports)
-- Partial index: only indexes rows where locked_plan_version_id is set (non-NULL)
-- Use cases:
--   1. Find all subscriptions on a specific plan version: WHERE locked_plan_version_id = ?
--   2. Migration queries: UPDATE ... WHERE locked_plan_version_id = old_version
--   3. Version distribution reports: GROUP BY locked_plan_version_id
--   4. Notify users on deprecated versions
CREATE INDEX idx_subscriptions_locked_plan_version
  ON billing_subscriptions(locked_plan_version_id)
  WHERE locked_plan_version_id IS NOT NULL AND deleted_at IS NULL;

-- Promo code queries (for marketing analytics and promo code management)
-- Partial index: only indexes subscriptions that have a promo code applied (majority don't)
-- Use cases:
--   1. Marketing dashboard: "How many subscriptions used code BLACKFRIDAY?"
--   2. Revenue attribution: "Total revenue from promotional subscriptions"
--   3. Promo code management: "Is this code in use? Can I deactivate it?"
--   4. Fraud investigation: "Find all subscriptions using suspicious code"
CREATE INDEX idx_subscriptions_promo_code
  ON billing_subscriptions(promo_code_id)
  WHERE promo_code_id IS NOT NULL AND deleted_at IS NULL;

-- Trial conversion analytics
-- Partial index: only indexes converted trials (minority of all subscriptions)
-- Use cases:
--   1. Conversion rate dashboard: COUNT converted / COUNT with trial_end
--   2. Cohort analysis: GROUP BY DATE_TRUNC('month', trial_converted_at)
--   3. Revenue from conversions: JOIN with payments WHERE trial_converted = true
--   4. Time-to-convert analysis: trial_converted_at - trial_end
CREATE INDEX idx_subscriptions_trial_converted
  ON billing_subscriptions(trial_converted_at)
  WHERE trial_converted = true AND deleted_at IS NULL;

-- Pending trial conversions (trials that ended but haven't converted yet)
-- Use case: identify at-risk trials for win-back campaigns
CREATE INDEX idx_subscriptions_trial_pending
  ON billing_subscriptions(trial_end)
  WHERE trial_end IS NOT NULL
    AND trial_end < NOW()
    AND trial_converted = false
    AND status NOT IN ('canceled', 'expired')
    AND deleted_at IS NULL;

-- Renewal count analytics (for retention and LTV analysis)
-- Standard B-tree index: enables efficient range queries and aggregations
-- Use cases:
--   1. Customer segmentation: WHERE renewal_count >= 12 (loyal customers)
--   2. Cohort retention: AVG(renewal_count) GROUP BY DATE_TRUNC('month', created_at)
--   3. LTV correlation: renewal_count vs total_revenue analysis
--   4. Churn risk: WHERE renewal_count BETWEEN 1 AND 3 AND status = 'active'
--   5. Loyalty programs: identify customers hitting milestones (6, 12, 24 renewals)
CREATE INDEX idx_subscriptions_renewal_count
  ON billing_subscriptions(renewal_count)
  WHERE deleted_at IS NULL;
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

export const subscriptions = pgTable('billing_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  planId: varchar('plan_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  billingInterval: varchar('billing_interval', { length: 50 }).notNull(),
  intervalCount: integer('interval_count').default(1),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  trialStart: timestamp('trial_start', { withTimezone: true }),
  trialEnd: timestamp('trial_end', { withTimezone: true }),

  // Trial conversion tracking
  // trialConverted: TRUE when trial successfully converts to paid subscription
  // trialConvertedAt: Timestamp of conversion (for cohort analysis and reporting)
  trialConverted: boolean('trial_converted').default(false),
  trialConvertedAt: timestamp('trial_converted_at', { withTimezone: true }),

  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  cancelAt: timestamp('cancel_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  isFree: boolean('is_free').default(false),
  freeReason: varchar('free_reason', { length: 500 }),
  freeExpiresAt: timestamp('free_expires_at', { withTimezone: true }),
  promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, { onDelete: 'restrict' }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  mpSubscriptionId: varchar('mp_subscription_id', { length: 255 }),

  // Pause/Resume fields
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  pauseUntil: timestamp('pause_until', { withTimezone: true }),
  pauseReason: varchar('pause_reason', { length: 500 }),
  pauseCount: integer('pause_count').notNull().default(0),
  retainAccessDuringPause: boolean('retain_access_during_pause').default(false),

  /**
   * Renewal tracking for retention analytics and LTV calculation
   * Incremented by 1 each time the subscription successfully renews
   *
   * Use cases:
   * - Retention analysis: AVG(renewalCount) by cohort
   * - LTV calculation: renewalCount * planPrice
   * - Customer segmentation: loyal (12+), established (6-11), new (0-5)
   * - Churn prediction: identify patterns before churn
   *
   * Updated when: successful payment at period end
   * NOT incremented for: trial conversions, failed payments, manual payments
   */
  renewalCount: integer('renewal_count').notNull().default(0),

  // Per-Seat Pricing
  quantity: integer('quantity').notNull().default(1),

  // Plan Versioning (P2 - v1.1)
  // Links subscription to a specific plan version for grandfathering
  // When set, subscription uses pricing/features from this version instead of current plan
  lockedPlanVersionId: uuid('locked_plan_version_id').references(() => planVersions.id),

  // Environment isolation
  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Drizzle Index Definitions for subscriptions
// Note: Partial indexes require raw SQL in migrations as Drizzle doesn't support WHERE clauses natively
export const subscriptionsIndexes = {
  // Plan version lookup - created via migration SQL:
  // CREATE INDEX idx_subscriptions_locked_plan_version
  //   ON billing_subscriptions(locked_plan_version_id)
  //   WHERE locked_plan_version_id IS NOT NULL AND deleted_at IS NULL;
  //
  // This index enables efficient queries for:
  // - Finding subscriptions on a specific plan version
  // - Migrating subscriptions between plan versions
  // - Generating version distribution reports
  // - Identifying users on deprecated plan versions
};
```

---

### payments

Stores all payment transactions. Note: Payments are linked to invoices through the `billing_invoice_payments` junction table (N:N relationship), not through a direct foreign key.

```sql
CREATE TABLE billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Required: Customer who made the payment (cannot delete customer with payments)
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  -- Optional: Related subscription (one-time payments have no subscription)
  -- SET NULL: If subscription is deleted, payment record preserved
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,

  -- Amount in customer's currency (precision: 19,8 for crypto support)
  amount DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Amount in base currency (for reporting)
  base_amount DECIMAL(19, 8) NOT NULL,
  base_currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Exchange rate info (precision: 18,10 for volatile currencies)
  exchange_rate DECIMAL(18, 10),
  exchange_rate_source VARCHAR(50),
  exchange_rate_date TIMESTAMP WITH TIME ZONE,

  status VARCHAR(50) NOT NULL,
  -- Payment provider identifier
  -- Standardized length: VARCHAR(30) across all tables
  -- Current providers: 'stripe' (6 chars), 'mercadopago' (11 chars)
  -- Allows for future providers up to 30 characters
  provider VARCHAR(30) NOT NULL,
  provider_payment_id VARCHAR(255),
  provider_checkout_id VARCHAR(255),

  refunded_amount DECIMAL(19, 8) DEFAULT 0,
  failure_reason VARCHAR(500),
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Invoice application tracking (for N:N with invoices)
  amount_applied DECIMAL(19, 8) NOT NULL DEFAULT 0,
  amount_available DECIMAL(19, 8) GENERATED ALWAYS AS (amount - amount_applied - refunded_amount) STORED,

  -- Marketplace split info
  -- Optional: Vendor for marketplace payments (platform payments have no vendor)
  -- SET NULL: If vendor is deleted, payment record preserved for accounting
  vendor_id UUID REFERENCES billing_vendors(id) ON DELETE SET NULL,
  vendor_amount DECIMAL(19, 8),
  platform_fee DECIMAL(19, 8),

  -- Payment method used for this transaction
  -- Optional: May be NULL for external/manual payments or bank transfers
  -- SET NULL: If payment method is deleted, payment record preserved for history
  payment_method_id UUID REFERENCES billing_payment_methods(id) ON DELETE SET NULL,

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_payment_status CHECK (
    status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')
  ),
  CONSTRAINT chk_payment_provider CHECK (
    provider IN ('stripe', 'mercadopago', 'bank_transfer')
  ),
  CONSTRAINT chk_payment_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_refund_amount CHECK (refunded_amount <= amount),
  CONSTRAINT chk_amount_applied CHECK (amount_applied <= amount - refunded_amount)
);

-- Basic indexes
CREATE INDEX idx_payments_customer_id ON billing_payments(customer_id);
CREATE INDEX idx_payments_subscription_id ON billing_payments(subscription_id);
CREATE INDEX idx_payments_external_id ON billing_payments(provider_payment_id);
CREATE INDEX idx_payments_status ON billing_payments(status);
CREATE INDEX idx_payments_provider ON billing_payments(provider);
CREATE INDEX idx_payments_created_at ON billing_payments(created_at);
CREATE INDEX idx_payments_vendor_id ON billing_payments(vendor_id);
-- Payment method lookup (partial - only for payments with recorded method)
CREATE INDEX idx_payments_payment_method ON billing_payments(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

-- Optimized composite indexes
CREATE INDEX idx_payments_reporting
  ON billing_payments(status, created_at)
  INCLUDE (amount, currency)
  WHERE status = 'succeeded' AND deleted_at IS NULL;

CREATE INDEX idx_payments_available_credit
  ON billing_payments(customer_id)
  WHERE status = 'succeeded' AND amount_available > 0 AND deleted_at IS NULL;

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_payments_livemode ON billing_payments(livemode);

-- Payment retry job optimization
-- This index supports the background job that finds failed payments ready for retry
-- The job runs every 1-5 minutes and queries:
--   SELECT * FROM billing_payments
--   WHERE status = 'failed' AND next_retry_at <= NOW() AND deleted_at IS NULL
-- Without this index, each job execution would scan the entire payments table
-- With this partial index, only failed payments with scheduled retry are indexed
--
-- Note: retry_count filtering is done at query time (not in index) because:
--   1. The max_retries limit may vary per payment or be configurable
--   2. The filtered set is already small (only failed payments pending retry)
--   3. Avoids index recreation when retry policy changes
CREATE INDEX idx_payments_pending_retry
  ON billing_payments(next_retry_at)
  WHERE status = 'failed'
    AND next_retry_at IS NOT NULL
    AND deleted_at IS NULL;
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const payments = pgTable('billing_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  // Optional: Related subscription (one-time payments have no subscription)
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),

  amount: decimal('amount', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  baseAmount: decimal('base_amount', { precision: 19, scale: 8 }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull().references(() => currencies.code),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 10 }),
  exchangeRateSource: varchar('exchange_rate_source', { length: 50 }),
  exchangeRateDate: timestamp('exchange_rate_date', { withTimezone: true }),

  status: varchar('status', { length: 50 }).notNull(),
  // Payment provider identifier - standardized to 30 chars across all tables
  provider: varchar('provider', { length: 30 }).notNull(),
  providerPaymentId: varchar('provider_payment_id', { length: 255 }),
  providerCheckoutId: varchar('provider_checkout_id', { length: 255 }),

  refundedAmount: decimal('refunded_amount', { precision: 19, scale: 8 }).default('0'),
  failureReason: varchar('failure_reason', { length: 500 }),
  retryCount: integer('retry_count').default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  amountApplied: decimal('amount_applied', { precision: 19, scale: 8 }).notNull().default('0'),

  // Generated column: automatically calculated by database
  // Formula: amount - amount_applied - refunded_amount
  // Read-only: cannot be inserted or updated directly
  amountAvailable: decimal('amount_available', { precision: 19, scale: 8 })
    .generatedAlwaysAs(sql`amount - amount_applied - refunded_amount`),

  // Optional: Vendor for marketplace payments
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  vendorAmount: decimal('vendor_amount', { precision: 19, scale: 8 }),
  platformFee: decimal('platform_fee', { precision: 19, scale: 8 }),

  // Optional: Payment method used (may be NULL for external/manual payments)
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// Drizzle Index Definitions for payments
// Note: Partial indexes require raw SQL in migrations as Drizzle doesn't support WHERE clauses natively
export const paymentsIndexes = {
  // Payment retry job optimization - created via migration SQL:
  // CREATE INDEX idx_payments_pending_retry
  //   ON billing_payments(next_retry_at)
  //   WHERE status = 'failed' AND next_retry_at IS NOT NULL AND deleted_at IS NULL;
  //
  // This index enables the background retry job to efficiently find failed payments
  // ready for retry without scanning the entire payments table.
  // The job query pattern is:
  //   SELECT * FROM billing_payments
  //   WHERE status = 'failed'
  //     AND next_retry_at <= NOW()
  //     AND retry_count < max_retries
  //     AND deleted_at IS NULL
  //   ORDER BY next_retry_at ASC
  //   LIMIT 100;
};
```

---

### invoices

Stores invoice records for payments. Invoices are linked to payments through the `billing_invoice_payments` junction table (N:N relationship), supporting partial payments and payments that cover multiple invoices.

```sql
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Required: Customer who owns the invoice (cannot delete customer with invoices)
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  -- Optional: Related subscription (one-time purchases have no subscription)
  -- SET NULL: If subscription is deleted, invoice preserved for accounting
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,

  -- Invoice number: unique per environment (livemode)
  -- This allows test and production to have independent numbering sequences
  number VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,

  -- Amounts (precision: 19,8 for crypto support)
  subtotal DECIMAL(19, 8) NOT NULL,
  discount DECIMAL(19, 8) DEFAULT 0,
  tax DECIMAL(19, 8) DEFAULT 0,
  total DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Payment tracking (for N:N with payments)
  amount_paid DECIMAL(19, 8) NOT NULL DEFAULT 0,
  amount_remaining DECIMAL(19, 8) GENERATED ALWAYS AS (total - amount_paid) STORED,

  line_items JSONB NOT NULL DEFAULT '[]',

  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,

  billing_address JSONB,
  notes TEXT,

  -- PDF generation tracking
  -- pdf_url: URL to the generated PDF (S3, CDN, or internal storage path)
  -- pdf_generated_at: When the PDF was generated (for cache invalidation)
  -- Cache logic: if updated_at > pdf_generated_at, PDF needs regeneration
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_invoice_status CHECK (
    status IN ('draft', 'open', 'paid', 'partially_paid', 'void', 'uncollectible')
  ),
  CONSTRAINT chk_invoice_totals CHECK (total = subtotal - discount + tax),
  CONSTRAINT chk_amount_paid CHECK (amount_paid <= total),

  -- Discount cannot exceed subtotal (prevents negative totals before tax)
  -- Business rule: you cannot discount more than the original amount
  CONSTRAINT chk_invoice_discount_limit CHECK (discount <= subtotal),

  -- Line items must be a JSONB array (not object, null, or scalar)
  -- This is a basic structural validation; full schema validation (required fields
  -- per element: id, description, quantity, unitPrice, amount) is done in
  -- application layer with Zod for maintainability and testability.
  -- Prevents: '{}', 'null', '"string"', '123', 'true'
  -- Allows: '[]', '[{...}]', '[{...}, {...}]'
  CONSTRAINT chk_invoice_line_items_is_array CHECK (jsonb_typeof(line_items) = 'array'),

  -- Invoice number unique per environment (test vs production)
  -- Allows INV-0001 in test AND INV-0001 in production without conflict
  -- For multi-tenant: change to UNIQUE (tenant_id, number, livemode)
  CONSTRAINT uq_invoices_number_livemode UNIQUE (number, livemode)
);

-- Basic indexes
CREATE INDEX idx_invoices_customer_status ON billing_invoices(customer_id, status);
CREATE INDEX idx_invoices_subscription_id ON billing_invoices(subscription_id);
CREATE INDEX idx_invoices_due_date ON billing_invoices(due_date);
CREATE INDEX idx_invoices_number ON billing_invoices(number);

-- Optimized composite indexes
CREATE INDEX idx_invoices_unpaid
  ON billing_invoices(customer_id, due_date)
  WHERE status IN ('open', 'partially_paid') AND deleted_at IS NULL;

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_invoices_livemode ON billing_invoices(livemode);
```

**Line Items JSON Structure:**

```typescript
interface QZPayInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  metadata?: Record<string, unknown>;
}
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, integer, boolean, text, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const invoices = pgTable('billing_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'restrict' }),

  // Invoice number: unique per environment (livemode)
  // Composite unique constraint defined below in table config
  number: varchar('number', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),

  subtotal: decimal('subtotal', { precision: 19, scale: 8 }).notNull(),
  discount: decimal('discount', { precision: 19, scale: 8 }).default('0'),
  tax: decimal('tax', { precision: 19, scale: 8 }).default('0'),
  total: decimal('total', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  amountPaid: decimal('amount_paid', { precision: 19, scale: 8 }).notNull().default('0'),

  // Generated column: automatically calculated by database
  // Formula: total - amount_paid
  // Read-only: cannot be inserted or updated directly
  amountRemaining: decimal('amount_remaining', { precision: 19, scale: 8 })
    .generatedAlwaysAs(sql`total - amount_paid`),

  lineItems: jsonb('line_items').notNull().default([]),

  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),

  billingAddress: jsonb('billing_address'),
  notes: text('notes'),

  // PDF generation tracking
  // pdfUrl: URL to generated PDF (S3, CDN, or storage path)
  // pdfGeneratedAt: For cache invalidation (if updatedAt > pdfGeneratedAt, regenerate)
  pdfUrl: text('pdf_url'),
  pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  // Invoice number unique per environment (test vs production)
  // Allows INV-0001 in test AND INV-0001 in production without conflict
  // For multi-tenant: add tenant_id to this constraint
  uniqueNumberLivemode: unique('uq_invoices_number_livemode').on(table.number, table.livemode),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
```

---

### promo_codes

Stores promotional codes and their configurations.

```sql
CREATE TABLE billing_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,

  -- Human-readable identification
  -- name: Short display name for admin lists and dropdowns (e.g., "Summer Sale 2025")
  -- description: Longer explanation for terms, conditions, or internal notes
  name VARCHAR(255),
  description TEXT,

  type VARCHAR(50) NOT NULL,
  value DECIMAL(19, 8) NOT NULL,
  config JSONB DEFAULT '{}',

  -- Restrictions
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  max_uses_per_customer INTEGER,
  valid_plans TEXT[],
  new_customers_only BOOLEAN DEFAULT FALSE,
  existing_customers_only BOOLEAN DEFAULT FALSE,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  combinable BOOLEAN DEFAULT TRUE,

  -- Product restrictions (P2 - v1.1)
  valid_products TEXT[],
  valid_categories TEXT[],
  excluded_products TEXT[],
  excluded_categories TEXT[],
  valid_vendors TEXT[],
  excluded_vendors TEXT[],
  min_order_amount DECIMAL(19, 8),
  max_order_amount DECIMAL(19, 8),
  min_order_currency VARCHAR(3),

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',

  -- Optimistic locking: prevents concurrent update conflicts
  -- Application must include "WHERE version = X" and increment on update
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_promo_type CHECK (
    type IN ('percentage', 'fixed_amount', 'free_shipping', 'free_period', 'reduced_period', 'trial_extension', 'volume', 'amount_threshold')
  ),
  CONSTRAINT chk_percentage_range CHECK (
    type != 'percentage' OR (value >= 0 AND value <= 100)
  )
);

CREATE INDEX idx_promo_codes_code ON billing_promo_codes(code);
CREATE INDEX idx_promo_codes_active ON billing_promo_codes(active);
CREATE INDEX idx_promo_codes_expires_redemptions ON billing_promo_codes(expires_at, used_count);

-- Optimized composite index for valid promo codes
CREATE INDEX idx_promo_codes_valid
  ON billing_promo_codes(active, expires_at, starts_at)
  WHERE active = true;

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_promo_codes_livemode ON billing_promo_codes(livemode);
```

**Config JSON by Type:**

```typescript
// For QZPayPromoCodeType (promo codes):
// percentage: no config needed (value = percentage 0-100)
// fixed_amount: { currency: string }
// free_period: no config (value = number of periods)
// reduced_period: { periods: number, reducedPrice: number }
// trial_extension: no config (value = number of extra days)

// For QZPayAutomaticDiscountType (automatic discounts):
// percentage: no config needed (value = percentage 0-100)
// fixed_amount: { currency: string }
// free_period: no config (value = number of periods)
// reduced_period: { periods: number, reducedPrice: number }
// volume: { minQuantity: number }
// amount_threshold: { minAmount: number, currency: string }
// free_shipping: no config (value = 0)
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, boolean, integer, text } from 'drizzle-orm/pg-core';

export const promoCodes = pgTable('billing_promo_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),

  // Human-readable identification
  // name: Short display name for admin lists and dropdowns (e.g., "Summer Sale 2025")
  // description: Longer explanation for terms, conditions, or internal notes
  name: varchar('name', { length: 255 }),
  description: text('description'),

  type: varchar('type', { length: 50 }).notNull(),
  value: decimal('value', { precision: 19, scale: 8 }).notNull(),
  config: jsonb('config').default({}),

  // Restrictions
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').default(0),
  maxUsesPerCustomer: integer('max_uses_per_customer'),
  validPlans: text('valid_plans').array(),
  newCustomersOnly: boolean('new_customers_only').default(false),
  existingCustomersOnly: boolean('existing_customers_only').default(false),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  combinable: boolean('combinable').default(true),

  // Product restrictions (P2 - v1.1)
  validProducts: text('valid_products').array(),
  validCategories: text('valid_categories').array(),
  excludedProducts: text('excluded_products').array(),
  excludedCategories: text('excluded_categories').array(),
  validVendors: text('valid_vendors').array(),
  excludedVendors: text('excluded_vendors').array(),
  minOrderAmount: decimal('min_order_amount', { precision: 19, scale: 8 }),
  maxOrderAmount: decimal('max_order_amount', { precision: 19, scale: 8 }),
  minOrderCurrency: varchar('min_order_currency', { length: 3 }),

  livemode: boolean('livemode').notNull().default(true),

  active: boolean('active').default(true),
  metadata: jsonb('metadata').default({}),

  // Optimistic locking: prevents concurrent update conflicts (e.g., used_count increments)
  // Application must include "WHERE version = X" and increment on update
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type NewPromoCode = typeof promoCodes.$inferInsert;
```

---

### promo_code_usage

Tracks promo code usage by customers.

```sql
CREATE TABLE billing_promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES billing_promo_codes(id),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),
  subscription_id UUID REFERENCES billing_subscriptions(id),
  payment_id UUID REFERENCES billing_payments(id),
  discount_amount DECIMAL(19, 8) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_promo_usage UNIQUE (promo_code_id, customer_id, subscription_id)
);

CREATE INDEX idx_promo_usage_code ON billing_promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_usage_customer ON billing_promo_code_usage(customer_id);

-- Subscription-based lookups for promo code usage
-- Use case: Get all promo codes used in a subscription, verify subscription promo history
-- Partial index: Only indexes rows where subscription_id is NOT NULL (excludes one-time purchases)
CREATE INDEX idx_promo_usage_subscription ON billing_promo_code_usage(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- Time-based lookups for promo code usage analytics
-- Use cases:
--   1. Monthly/weekly usage reports: SELECT COUNT(*) WHERE used_at BETWEEN '2025-01-01' AND '2025-02-01'
--   2. Promo code performance trending: GROUP BY DATE_TRUNC('week', used_at)
--   3. Recent usage dashboard: WHERE used_at >= NOW() - INTERVAL '7 days'
--   4. Expiration analysis: Compare used_at vs promo_code.expires_at
-- B-tree index enables efficient range queries on timestamp column
-- Sorted DESC for efficient "most recent first" queries (common in dashboards)
CREATE INDEX idx_promo_usage_used_at ON billing_promo_code_usage(used_at DESC);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, decimal, timestamp, unique, index } from 'drizzle-orm/pg-core';

export const promoCodeUsage = pgTable('billing_promo_code_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  paymentId: uuid('payment_id').references(() => payments.id),
  discountAmount: decimal('discount_amount', { precision: 19, scale: 8 }).notNull(),
  /**
   * When the promo code was used/applied.
   * Indexed (DESC) for efficient time-based analytics queries.
   */
  usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueUsage: unique('uq_promo_usage').on(table.promoCodeId, table.customerId, table.subscriptionId),
  /**
   * Index for time-based analytics queries.
   * Use cases: monthly reports, trending analysis, recent usage dashboards.
   * Note: SQL definition uses DESC for "most recent first" optimization.
   * B-tree indexes can be scanned in reverse, so ASC index also works for DESC queries.
   */
  usedAtIdx: index('idx_promo_usage_used_at').on(table.usedAt),
}));

export type PromoCodeUsage = typeof promoCodeUsage.$inferSelect;
export type NewPromoCodeUsage = typeof promoCodeUsage.$inferInsert;
```

---

### currencies

Reference table for supported currencies (ISO 4217). Used to validate currency codes throughout the system.

```sql
CREATE TABLE billing_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  minor_units INTEGER NOT NULL DEFAULT 2,
  symbol VARCHAR(5),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_currencies_active ON billing_currencies(code) WHERE active = true;

-- Seed with common currencies
INSERT INTO billing_currencies (code, name, minor_units, symbol) VALUES
  ('USD', 'US Dollar', 2, '$'),
  ('EUR', 'Euro', 2, '€'),
  ('GBP', 'British Pound', 2, '£'),
  ('ARS', 'Argentine Peso', 2, '$'),
  ('BRL', 'Brazilian Real', 2, 'R$'),
  ('MXN', 'Mexican Peso', 2, '$'),
  ('CLP', 'Chilean Peso', 0, '$'),
  ('COP', 'Colombian Peso', 2, '$'),
  ('PEN', 'Peruvian Sol', 2, 'S/'),
  ('UYU', 'Uruguayan Peso', 2, '$'),
  ('JPY', 'Japanese Yen', 0, '¥'),
  ('CNY', 'Chinese Yuan', 2, '¥'),
  ('KRW', 'South Korean Won', 0, '₩'),
  ('INR', 'Indian Rupee', 2, '₹'),
  ('CAD', 'Canadian Dollar', 2, '$'),
  ('AUD', 'Australian Dollar', 2, '$'),
  ('CHF', 'Swiss Franc', 2, 'CHF');
```

**Drizzle Schema:**

```typescript
export const currencies = pgTable('billing_currencies', {
  code: varchar('code', { length: 3 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  minorUnits: integer('minor_units').notNull().default(2),
  symbol: varchar('symbol', { length: 5 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### invoice_payments

Junction table for the N:N relationship between invoices and payments. Supports partial payments, payments covering multiple invoices, and customer credit balance.

```sql
CREATE TABLE billing_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES billing_payments(id) ON DELETE RESTRICT,
  amount_applied DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Timestamps
  -- applied_at: When the payment was applied to the invoice (business event)
  -- created_at: When the database record was created (audit timestamp)
  -- These may differ in cases like data migration or manual adjustments
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_invoice_payment UNIQUE(invoice_id, payment_id),
  CONSTRAINT chk_amount_positive CHECK (amount_applied > 0)
);

-- Basic FK indexes
CREATE INDEX idx_invoice_payments_invoice ON billing_invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment ON billing_invoice_payments(payment_id);

-- Covering index for invoice-centric queries (most common access pattern)
-- Enables Index-Only Scan for queries like:
--   1. SUM(amount_applied) WHERE invoice_id = ? (total paid for invoice)
--   2. SELECT payment_id, amount_applied, ... WHERE invoice_id = ? (list payments)
--   3. JOIN with payments table (all columns needed from this side)
-- INCLUDE columns are stored in leaf pages only (not in B-tree), so search remains fast
CREATE INDEX idx_invoice_payments_invoice_covering
  ON billing_invoice_payments(invoice_id)
  INCLUDE (payment_id, amount_applied, currency, applied_at, created_at);
```

**Drizzle Schema:**

```typescript
export const invoicePayments = pgTable('billing_invoice_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'restrict' }),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'restrict' }),
  amountApplied: decimal('amount_applied', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  // Timestamps
  // appliedAt: When the payment was applied to the invoice (business event)
  // createdAt: When the database record was created (audit timestamp)
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Usage Examples:**

```typescript
// One payment covers multiple invoices
// Payment: $80, Invoice #1: $50, Invoice #2: $30
await db.insert(invoicePayments).values([
  { invoiceId: 'inv_1', paymentId: 'pay_1', amountApplied: 50, currency: 'USD' },
  { invoiceId: 'inv_2', paymentId: 'pay_1', amountApplied: 30, currency: 'USD' },
]);

// Multiple payments for one invoice (partial payments)
// Invoice: $100, Payment #1: $60, Payment #2: $40
await db.insert(invoicePayments).values([
  { invoiceId: 'inv_1', paymentId: 'pay_1', amountApplied: 60, currency: 'USD' },
  { invoiceId: 'inv_1', paymentId: 'pay_2', amountApplied: 40, currency: 'USD' },
]);

// Get available credit for a customer
const availableCredit = await db
  .select({ total: sql`SUM(amount_available)` })
  .from(payments)
  .where(and(
    eq(payments.customerId, customerId),
    eq(payments.status, 'succeeded'),
    gt(payments.amountAvailable, 0)
  ));
```

---

### automatic_discounts

Stores automatic discount rules that are applied without user input.

```sql
CREATE TABLE billing_automatic_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  type VARCHAR(50) NOT NULL,
  value DECIMAL(19, 8) NOT NULL,

  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '{}',

  -- Stacking behavior
  stackable BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,

  -- Validity
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,

  -- Usage limits
  max_redemptions INTEGER,
  redemption_count INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',

  -- Optimistic locking version field
  -- Increment on every UPDATE to prevent lost updates in concurrent scenarios
  -- Example: Multiple checkouts applying same discount simultaneously
  -- Usage: UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_auto_discount_type CHECK (
    type IN ('percentage', 'fixed_amount', 'free_shipping', 'free_period', 'volume', 'amount_threshold')
  )
);

CREATE INDEX idx_auto_discounts_discount_id ON billing_automatic_discounts(discount_id);
CREATE INDEX idx_auto_discounts_active ON billing_automatic_discounts(active);
CREATE INDEX idx_auto_discounts_valid ON billing_automatic_discounts(valid_from, valid_until);
CREATE INDEX idx_auto_discounts_priority ON billing_automatic_discounts(priority);
```

**Conditions JSON Structure (aligned with QZPayDiscountCondition):**

```typescript
interface QZPayAutomaticDiscountConditions {
  // Amount-based (QZPayDiscountCondition.MIN_PURCHASE_AMOUNT, etc.)
  minPurchaseAmount?: number;
  maxPurchaseAmount?: number;

  // Quantity-based
  minQuantity?: number;
  minQuantityPerProduct?: number;

  // Customer-based
  isFirstPurchase?: boolean;
  customerSegments?: string[];
  registeredAfter?: string; // ISO date

  // Product-based
  categories?: string[];
  products?: string[];
  excludeProducts?: string[];
  excludeCategories?: string[];

  // Time-based (uses QZPayDayOfWeek values)
  schedule?: {
    days?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    hours?: { from: number; to: number };
    timezone?: string;
  };
}
```

**Drizzle Schema:**

```typescript
export const automaticDiscounts = pgTable('billing_automatic_discounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  discountId: varchar('discount_id', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  type: varchar('type', { length: 50 }).notNull(),
  value: decimal('value', { precision: 19, scale: 8 }).notNull(),

  conditions: jsonb('conditions').notNull().default({}),

  stackable: boolean('stackable').default(true),
  priority: integer('priority').default(0),

  active: boolean('active').default(true),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),

  maxRedemptions: integer('max_redemptions'),
  redemptionCount: integer('redemption_count').default(0),

  metadata: jsonb('metadata').default({}),

  // Optimistic locking - increment on every UPDATE
  // Prevents lost updates when multiple checkouts apply same discount
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### automatic_discount_usage

Tracks automatic discount usage for analytics and limits.

```sql
CREATE TABLE billing_automatic_discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automatic_discount_id UUID NOT NULL REFERENCES billing_automatic_discounts(id),
  customer_id UUID REFERENCES billing_customers(id),
  payment_id UUID REFERENCES billing_payments(id),
  discount_amount DECIMAL(19, 8) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Context
  order_total DECIMAL(19, 8),
  conditions_matched JSONB,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_auto_discount_usage_discount ON billing_automatic_discount_usage(automatic_discount_id);
CREATE INDEX idx_auto_discount_usage_customer ON billing_automatic_discount_usage(customer_id);
CREATE INDEX idx_auto_discount_usage_applied ON billing_automatic_discount_usage(applied_at);
CREATE INDEX idx_auto_discount_usage_payment ON billing_automatic_discount_usage(payment_id)
  WHERE payment_id IS NOT NULL;
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const automaticDiscountUsage = pgTable('billing_automatic_discount_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  automaticDiscountId: uuid('automatic_discount_id').notNull().references(() => automaticDiscounts.id),
  customerId: uuid('customer_id').references(() => customers.id),
  paymentId: uuid('payment_id').references(() => payments.id),
  discountAmount: decimal('discount_amount', { precision: 19, scale: 8 }).notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),

  orderTotal: decimal('order_total', { precision: 19, scale: 8 }),
  conditionsMatched: jsonb('conditions_matched'),

  metadata: jsonb('metadata').default({}),
}, (table) => ({
  discountIdx: index('idx_auto_discount_usage_discount').on(table.automaticDiscountId),
  customerIdx: index('idx_auto_discount_usage_customer').on(table.customerId),
  appliedIdx: index('idx_auto_discount_usage_applied').on(table.appliedAt),
  paymentIdx: index('idx_auto_discount_usage_payment')
    .on(table.paymentId)
    .where(sql`payment_id IS NOT NULL`),
}));

export type AutomaticDiscountUsage = typeof automaticDiscountUsage.$inferSelect;
export type NewAutomaticDiscountUsage = typeof automaticDiscountUsage.$inferInsert;
```

---

### vendors

Stores marketplace vendor information.

```sql
CREATE TABLE billing_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,

  commission_rate DECIMAL(5, 4) NOT NULL,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'connect',

  stripe_connect_account_id VARCHAR(255),
  mp_merchant_id VARCHAR(255),

  onboarding_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  can_receive_payments BOOLEAN DEFAULT FALSE,

  -- Balance fields for fraud protection (CRIT-009)
  -- All amounts in cents, base currency
  balance_available DECIMAL(19, 8) NOT NULL DEFAULT 0,   -- Ready for payout
  balance_pending DECIMAL(19, 8) NOT NULL DEFAULT 0,     -- In cooling-off period (not yet available)
  balance_reserved DECIMAL(19, 8) NOT NULL DEFAULT 0,    -- Held for active disputes
  balance_currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES billing_currencies(code),

  -- Cooling-off period configuration (fraud prevention)
  cooling_off_days INTEGER NOT NULL DEFAULT 14,          -- Days before pending becomes available

  bank_account JSONB,
  payout_schedule VARCHAR(50) DEFAULT 'daily',

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_vendor_payment_mode CHECK (
    payment_mode IN ('connect', 'transfer')
  ),
  CONSTRAINT chk_vendor_onboarding_status CHECK (
    onboarding_status IN ('pending', 'in_progress', 'complete', 'restricted')
  ),

  -- Basic email format validation (defense in depth)
  -- Validates: at least one char before @, at least one char after @, at least one dot after @
  -- Pattern: .+@.+\..+ matches "a@b.c" but rejects "invalid", "@no-local", "no-domain@"
  -- More sophisticated validation should be done at application layer
  CONSTRAINT chk_vendor_email_format CHECK (email ~ '.+@.+\..+'),

  -- Commission rate must be between 0 (0%) and 1 (100%)
  -- 0 = vendor pays no commission (special agreement, promo)
  -- 1 = 100% commission (rare, internal vendors, testing)
  -- Business rules (e.g., max 30%) should be enforced at application layer
  CONSTRAINT chk_vendor_commission_rate CHECK (
    commission_rate >= 0 AND commission_rate <= 1
  ),

  -- Balance fields must be non-negative (fraud protection)
  CONSTRAINT chk_vendor_balance_available CHECK (balance_available >= 0),
  CONSTRAINT chk_vendor_balance_pending CHECK (balance_pending >= 0),
  CONSTRAINT chk_vendor_balance_reserved CHECK (balance_reserved >= 0),

  -- Cooling-off period must be at least 7 days (fraud prevention minimum)
  CONSTRAINT chk_vendor_cooling_off_days CHECK (cooling_off_days >= 7)
);

CREATE INDEX idx_vendors_external_id ON billing_vendors(external_id);
CREATE INDEX idx_vendors_stripe_account ON billing_vendors(stripe_connect_account_id);
CREATE INDEX idx_vendors_mp_merchant ON billing_vendors(mp_merchant_id);
CREATE INDEX idx_vendors_onboarding_status ON billing_vendors(onboarding_status);
CREATE INDEX idx_vendors_active ON billing_vendors(id) WHERE deleted_at IS NULL;

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_vendors_livemode ON billing_vendors(livemode);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const vendors = pgTable('billing_vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),

  commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull(),
  paymentMode: varchar('payment_mode', { length: 50 }).notNull().default('connect'),

  stripeConnectAccountId: varchar('stripe_connect_account_id', { length: 255 }),
  mpMerchantId: varchar('mp_merchant_id', { length: 255 }),

  onboardingStatus: varchar('onboarding_status', { length: 50 }).notNull().default('pending'),
  canReceivePayments: boolean('can_receive_payments').default(false),

  // Balance fields for fraud protection (CRIT-009)
  balanceAvailable: decimal('balance_available', { precision: 19, scale: 8 }).notNull().default('0'),
  balancePending: decimal('balance_pending', { precision: 19, scale: 8 }).notNull().default('0'),
  balanceReserved: decimal('balance_reserved', { precision: 19, scale: 8 }).notNull().default('0'),
  balanceCurrency: varchar('balance_currency', { length: 3 }).notNull().default('USD').references(() => currencies.code),

  // Cooling-off period configuration (fraud prevention)
  coolingOffDays: integer('cooling_off_days').notNull().default(14),

  bankAccount: jsonb('bank_account'),
  payoutSchedule: varchar('payout_schedule', { length: 50 }).default('daily'),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
```

---

### vendor_payouts

Tracks vendor payout history.

```sql
CREATE TABLE billing_vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES billing_vendors(id),

  amount DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  status VARCHAR(50) NOT NULL,
  provider VARCHAR(30) NOT NULL,  -- Standardized length across all tables
  provider_payout_id VARCHAR(255),

  paid_at TIMESTAMP WITH TIME ZONE,
  failure_reason VARCHAR(500),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payout_status CHECK (
    status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')
  )
);

CREATE INDEX idx_vendor_payouts_vendor ON billing_vendor_payouts(vendor_id);
CREATE INDEX idx_vendor_payouts_status ON billing_vendor_payouts(status);
CREATE INDEX idx_vendor_payouts_created ON billing_vendor_payouts(created_at);
CREATE INDEX idx_vendor_payouts_currency ON billing_vendor_payouts(currency);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const vendorPayouts = pgTable('billing_vendor_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),

  amount: decimal('amount', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  status: varchar('status', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 30 }).notNull(),  // Standardized
  providerPayoutId: varchar('provider_payout_id', { length: 255 }),

  paidAt: timestamp('paid_at', { withTimezone: true }),
  failureReason: varchar('failure_reason', { length: 500 }),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type VendorPayout = typeof vendorPayouts.$inferSelect;
export type NewVendorPayout = typeof vendorPayouts.$inferInsert;
```

---

### vendor_pending_balances

Tracks individual pending balance records for cooling-off period management (CRIT-009).

```sql
CREATE TABLE billing_vendor_pending_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES billing_vendors(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES billing_payments(id) ON DELETE RESTRICT,

  amount DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Cooling-off period tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  releases_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- When funds become available
  released_at TIMESTAMP WITH TIME ZONE,            -- Actual release timestamp

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_pending_balance_status CHECK (
    status IN ('pending', 'released', 'reserved', 'forfeited')
  ),
  CONSTRAINT chk_pending_balance_amount CHECK (amount > 0)
);

-- Index for background job that releases pending balances
CREATE INDEX idx_vendor_pending_balances_release ON billing_vendor_pending_balances(releases_at)
  WHERE status = 'pending';

-- Index for vendor balance queries
CREATE INDEX idx_vendor_pending_balances_vendor ON billing_vendor_pending_balances(vendor_id, status);

-- Index for payment lookup (dispute handling)
CREATE INDEX idx_vendor_pending_balances_payment ON billing_vendor_pending_balances(payment_id);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';

export const vendorPendingBalances = pgTable('billing_vendor_pending_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'restrict' }),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'restrict' }),

  amount: decimal('amount', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  // Cooling-off period tracking
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  releasesAt: timestamp('releases_at', { withTimezone: true }).notNull(),
  releasedAt: timestamp('released_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type VendorPendingBalance = typeof vendorPendingBalances.$inferSelect;
export type NewVendorPendingBalance = typeof vendorPendingBalances.$inferInsert;
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Funds in cooling-off period, not yet available for payout |
| `released` | Cooling-off period complete, funds moved to `balance_available` |
| `reserved` | Funds moved to `balance_reserved` due to dispute |
| `forfeited` | Funds lost due to dispute/chargeback resolution |

---

### payment_methods

Stores saved payment methods for customers.

```sql
CREATE TABLE billing_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  provider VARCHAR(30) NOT NULL,  -- Standardized length across all tables
  provider_payment_method_id VARCHAR(255) NOT NULL,

  type VARCHAR(50) NOT NULL,
  last_four VARCHAR(4),
  brand VARCHAR(50),
  exp_month INTEGER,
  exp_year INTEGER,

  is_default BOOLEAN DEFAULT FALSE,

  -- Environment: true = production, false = test/sandbox
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  -- Optimistic locking: prevents concurrent update conflicts
  -- Application must include "WHERE version = X" and increment on update
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Soft delete: NULL = active, timestamp = deleted
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_payment_method_type CHECK (
    type IN ('card', 'bank_account', 'debit_card', 'wallet')
  )
);

CREATE INDEX idx_payment_methods_customer ON billing_payment_methods(customer_id);
CREATE INDEX idx_payment_methods_default ON billing_payment_methods(customer_id, is_default);
-- Partial index for active (non-deleted) payment methods by environment
CREATE INDEX idx_payment_methods_customer_active ON billing_payment_methods(customer_id, livemode)
  WHERE deleted_at IS NULL;
-- Index for livemode filtering (environment isolation)
CREATE INDEX idx_payment_methods_livemode ON billing_payment_methods(livemode);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const paymentMethods = pgTable('billing_payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  provider: varchar('provider', { length: 30 }).notNull(),  // Standardized
  providerPaymentMethodId: varchar('provider_payment_method_id', { length: 255 }).notNull(),

  type: varchar('type', { length: 50 }).notNull(),
  lastFour: varchar('last_four', { length: 4 }),
  brand: varchar('brand', { length: 50 }),
  expMonth: integer('exp_month'),
  expYear: integer('exp_year'),

  isDefault: boolean('is_default').default(false),

  // Environment: true = production, false = test/sandbox
  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),

  // Optimistic locking: prevents concurrent update conflicts (e.g., is_default changes)
  // Application must include "WHERE version = X" and increment on update
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // Soft delete: null = active, timestamp = deleted
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
```

---

### webhook_events

Stores received webhook events for idempotency and debugging.

```sql
CREATE TABLE billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider VARCHAR(30) NOT NULL,  -- Standardized length across all tables
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,

  payload JSONB NOT NULL,

  -- Application-level context (separate from provider's raw payload)
  -- Stores: source IP, signature headers, processing attempts, affected entity IDs,
  -- handler version, custom tags, correlation IDs, etc.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_webhook_event UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_provider ON billing_webhook_events(provider);
CREATE INDEX idx_webhook_events_processed ON billing_webhook_events(processed);
CREATE INDEX idx_webhook_events_created ON billing_webhook_events(created_at);

-- Standalone event_id index for cross-provider lookups and debugging
-- Note: UNIQUE(provider, event_id) only works when provider is known
CREATE INDEX idx_webhook_events_event_id ON billing_webhook_events(event_id);
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, timestamp, jsonb, boolean, text, unique } from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable('billing_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  provider: varchar('provider', { length: 30 }).notNull(),  // Standardized
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventId: varchar('event_id', { length: 255 }).notNull(),

  payload: jsonb('payload').notNull(),

  // Application-level context (separate from provider's raw payload)
  // Stores: source IP, signature headers, processing attempts, affected entity IDs,
  // handler version, custom tags, correlation IDs, etc.
  metadata: jsonb('metadata').notNull().default({}),

  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueWebhookEvent: unique('uq_webhook_event').on(table.provider, table.eventId),
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
```

---

### idempotency_keys

Stores idempotency keys for client operations to prevent duplicate processing (e.g., double charges from double-clicks).

```sql
CREATE TABLE billing_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key and ownership
  key VARCHAR(255) NOT NULL UNIQUE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,

  -- Request validation
  request_hash VARCHAR(64) NOT NULL,
  response JSONB,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  CONSTRAINT chk_idempotency_status CHECK (
    status IN ('pending', 'completed', 'failed')
  )
);

CREATE INDEX idx_idempotency_key ON billing_idempotency_keys(key);
CREATE INDEX idx_idempotency_expires ON billing_idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_entity ON billing_idempotency_keys(entity_type, entity_id);
```

**Drizzle Schema:**

```typescript
export const idempotencyKeys = pgTable('billing_idempotency_keys', {
  id: uuid('id').primaryKey().defaultRandom(),

  key: varchar('key', { length: 255 }).notNull().unique(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),

  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  response: jsonb('response'),

  status: varchar('status', { length: 20 }).notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
```

#### Idempotency Key Validity and Expiration

**Validity Window:**

All idempotency keys have a **48-hour validity window** from creation. This allows sufficient time for retry scenarios while preventing unbounded database growth.

```typescript
// Default validity window
const IDEMPOTENCY_KEY_VALIDITY_HOURS = 48;

// Calculate expiration on key creation
const expiresAt = new Date(Date.now() + IDEMPOTENCY_KEY_VALIDITY_HOURS * 60 * 60 * 1000);
```

**Behavior After Expiration:**

| Scenario | Behavior | Client Response |
|----------|----------|-----------------|
| Retry with same key before expiration | Return cached response | Original response (success/error) |
| Retry with same key after expiration | Treat as NEW request | Process normally (may result in duplicate if original succeeded) |
| Same key with DIFFERENT request hash | Reject immediately | `IDEMPOTENCY_KEY_MISMATCH` error |
| Key exists but status='pending' | Wait up to 30s for completion | Return result or timeout error |

**Request Hash Validation:**

When a request is made with an existing idempotency key, the system validates that the request parameters match the original request:

```typescript
interface IdempotencyValidation {
  // Hash includes: method, path, body (sorted keys), customer_id
  requestHash: string;

  // If hash doesn't match, reject with error
  // This prevents accidental key reuse across different operations
}
```

**Cleanup Job Specification:**

A background job runs daily to clean expired idempotency keys:

```typescript
// Job: cleanup_expired_idempotency_keys
// Schedule: Daily at 3:00 AM UTC
// Query:
DELETE FROM billing_idempotency_keys
WHERE expires_at < NOW() - INTERVAL '24 hours'
  AND status IN ('completed', 'failed');

// Note: Keys with status='pending' are retained for 7 days
// to allow investigation of stuck operations
```

**Best Practices for Idempotency Keys:**

1. **Format:** `{operation}:{entity_id}:{timestamp}:{random}` (e.g., `payment:cust_123:1704067200:a1b2c3`)
2. **Storage:** Client should store key locally until operation confirmed
3. **Retry Strategy:** Retry with SAME key for network errors, NEW key for validation errors
4. **Subscription Scope:** Keys are NOT scoped to subscription. Use unique format to avoid collisions.

---

### event_queue

Stores events for asynchronous processing. Long-running event handlers are queued here to prevent webhook timeouts.

```sql
CREATE TABLE billing_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event data
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Processing state
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,

  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMP WITH TIME ZONE,
  locked_by VARCHAR(100),

  -- Results
  last_error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Environment isolation
  -- Required for separating test and production event processing
  -- Events with livemode=false are test events and should only be processed by test workers
  -- Events with livemode=true are production events
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_event_queue_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')
  )
);

CREATE INDEX idx_event_queue_status ON billing_event_queue(status);
CREATE INDEX idx_event_queue_scheduled ON billing_event_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_event_queue_locked ON billing_event_queue(locked_until) WHERE status = 'processing';
CREATE INDEX idx_event_queue_type ON billing_event_queue(event_type);

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_event_queue_livemode ON billing_event_queue(livemode);
```

**Drizzle Schema:**

```typescript
export const eventQueue = pgTable('billing_event_queue', {
  id: uuid('id').primaryKey().defaultRandom(),

  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),

  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),

  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lockedBy: varchar('locked_by', { length: 100 }),

  lastError: text('last_error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // Environment isolation
  // Required for separating test and production event processing
  livemode: boolean('livemode').notNull().default(true),
});

export type EventQueueItem = typeof eventQueue.$inferSelect;
export type NewEventQueueItem = typeof eventQueue.$inferInsert;
```

---

### plans

Stores plan definitions with entitlements and limits (optional, plans can also be defined in code).

```sql
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Pricing by interval (JSONB for flexibility)
  prices JSONB NOT NULL DEFAULT '{}',
  -- Example: { "month": { "amount": 2900, "currency": "USD" }, "year": { "amount": 29000, "currency": "USD" } }

  -- Entitlements (boolean features)
  entitlements JSONB NOT NULL DEFAULT '{}',
  -- Example: { "canAccessAnalytics": true, "canAccessPrioritySupport": false }

  -- Limits (numeric restrictions, -1 = unlimited)
  limits JSONB NOT NULL DEFAULT '{}',
  -- Example: { "maxProperties": 10, "maxPhotosPerProperty": 20 }

  -- Trial configuration
  trial_days INTEGER DEFAULT 0,
  trial_requires_payment_method BOOLEAN DEFAULT FALSE,

  -- Display
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  badge_text VARCHAR(50),

  -- Status
  active BOOLEAN DEFAULT TRUE,
  visible BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  -- Optimistic locking: prevents concurrent update conflicts
  -- Application must include "WHERE version = X" and increment on update
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_plan_id ON billing_plans(plan_id);
CREATE INDEX idx_plans_active ON billing_plans(active);
```

**Drizzle Schema:**

```typescript
export const plans = pgTable('billing_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: varchar('plan_id', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  prices: jsonb('prices').notNull().default({}),
  entitlements: jsonb('entitlements').notNull().default({}),
  limits: jsonb('limits').notNull().default({}),

  trialDays: integer('trial_days').default(0),
  trialRequiresPaymentMethod: boolean('trial_requires_payment_method').default(false),

  displayOrder: integer('display_order').default(0),
  isFeatured: boolean('is_featured').default(false),
  badgeText: varchar('badge_text', { length: 50 }),

  active: boolean('active').default(true),
  visible: boolean('visible').default(true),

  metadata: jsonb('metadata').default({}),

  // Optimistic locking: prevents concurrent update conflicts (e.g., price updates)
  // Application must include "WHERE version = X" and increment on update
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### usage_records

Tracks aggregated usage-based billing metrics per subscription per billing period.

> **Hybrid Architecture**: This table stores usage **reported by the consuming project**, NOT real-time usage. Real-time tracking is the project's responsibility using its own storage (Redis, DB, etc.). See PDR.md Section 3.2.1.

```sql
CREATE TABLE billing_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  -- What is being tracked (metric names are defined by consuming project)
  metric_name VARCHAR(100) NOT NULL,
  -- Examples: 'messages', 'api_calls', 'llm_queries', 'storage_gb'
  -- Package does NOT validate - any string is valid

  display_name VARCHAR(200),
  -- Human-readable name from plan config (e.g., "AI Queries", "Messages Sent")

  -- Billing Period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reported Usage (aggregated from usage_reports table)
  quantity BIGINT NOT NULL DEFAULT 0,
  included_quantity BIGINT NOT NULL DEFAULT 0,
  overage_quantity BIGINT GENERATED ALWAYS AS (GREATEST(0, quantity - included_quantity)) STORED,

  -- Pricing for overage (copied from plan config at period start)
  overage_rate INTEGER NOT NULL DEFAULT 0,  -- cents per unit
  overage_unit INTEGER NOT NULL DEFAULT 1,  -- unit size (e.g., 100 = per 100)
  overage_total INTEGER GENERATED ALWAYS AS (
    CEIL(GREATEST(0, quantity - included_quantity)::NUMERIC / overage_unit) * overage_rate
  ) STORED,

  -- Limit type from plan (informational - project enforces)
  limit_type VARCHAR(10) DEFAULT 'soft' CHECK (limit_type IN ('none', 'soft', 'hard')),

  -- Threshold alerts fired (one per threshold per period per metric)
  warning_fired_at TIMESTAMP WITH TIME ZONE,
  critical_fired_at TIMESTAMP WITH TIME ZONE,
  overage_alert_fired_at TIMESTAMP WITH TIME ZONE,

  -- Billing status
  billed BOOLEAN DEFAULT FALSE,
  billed_at TIMESTAMP WITH TIME ZONE,
  invoice_id UUID REFERENCES billing_invoices(id),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_period UNIQUE (subscription_id, metric_name, period_start)
);

CREATE INDEX idx_usage_records_subscription ON billing_usage_records(subscription_id);
CREATE INDEX idx_usage_records_customer ON billing_usage_records(customer_id);
CREATE INDEX idx_usage_records_metric ON billing_usage_records(metric_name);
CREATE INDEX idx_usage_records_period ON billing_usage_records(period_start, period_end);
CREATE INDEX idx_usage_records_billed ON billing_usage_records(billed) WHERE billed = FALSE;
CREATE INDEX idx_usage_records_unbilled ON billing_usage_records(period_end, billed) WHERE billed = FALSE;

-- Composite index for subscription + period queries (most common access pattern)
-- Use cases:
--   1. Get usage for subscription in specific period (billing calculation)
--   2. Get usage history for subscription in date range (dashboard)
--   3. ORDER BY period_start for chronological display
-- Note: idx_usage_records_subscription is still useful for queries without period filter
CREATE INDEX idx_usage_records_subscription_period
  ON billing_usage_records(subscription_id, period_start);

-- Invoice-based lookups for billed usage records
-- Use cases:
--   1. Get all usage records included in a specific invoice (reconciliation)
--   2. Show usage breakdown on invoice detail page (customer portal)
--   3. Regenerate invoice with original usage records (corrections)
--   4. Audit trail: which usage was billed on which invoice
-- Partial index: Only indexes billed records (invoice_id NOT NULL)
-- Unbilled records (NULL invoice_id) are queried via subscription_id + period indexes
CREATE INDEX idx_usage_records_invoice ON billing_usage_records(invoice_id)
  WHERE invoice_id IS NOT NULL;
```

**Drizzle Schema:**

```typescript
import { pgTable, uuid, varchar, bigint, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const usageRecords = pgTable('billing_usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  metricName: varchar('metric_name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 200 }),

  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  quantity: bigint('quantity', { mode: 'number' }).notNull().default(0),
  includedQuantity: bigint('included_quantity', { mode: 'number' }).notNull().default(0),

  // Generated column: automatically calculated by database
  // Formula: GREATEST(0, quantity - included_quantity)
  // Read-only: cannot be inserted or updated directly
  overageQuantity: bigint('overage_quantity', { mode: 'number' })
    .generatedAlwaysAs(sql`GREATEST(0, quantity - included_quantity)`),

  overageRate: integer('overage_rate').notNull().default(0),
  overageUnit: integer('overage_unit').notNull().default(1),

  // Generated column: automatically calculated by database
  // Formula: CEIL(GREATEST(0, quantity - included_quantity)::NUMERIC / overage_unit) * overage_rate
  // Read-only: cannot be inserted or updated directly
  overageTotal: integer('overage_total')
    .generatedAlwaysAs(sql`CEIL(GREATEST(0, quantity - included_quantity)::NUMERIC / overage_unit) * overage_rate`),

  limitType: varchar('limit_type', { length: 10 }).default('soft'),

  warningFiredAt: timestamp('warning_fired_at', { withTimezone: true }),
  criticalFiredAt: timestamp('critical_fired_at', { withTimezone: true }),
  overageAlertFiredAt: timestamp('overage_alert_fired_at', { withTimezone: true }),

  billed: boolean('billed').default(false),
  billedAt: timestamp('billed_at', { withTimezone: true }),
  invoiceId: uuid('invoice_id').references(() => invoices.id),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### usage_reports

Stores individual usage reports from consuming projects. Used for idempotency and audit trail.

> **Purpose**: When project calls `billing.usage.report()`, each record is stored here with its idempotency key. The `usage_records` table aggregates these reports per period.

```sql
CREATE TABLE billing_usage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  -- Metric being reported
  metric_name VARCHAR(100) NOT NULL,
  quantity BIGINT NOT NULL,

  -- When the usage occurred (from report, defaults to now)
  usage_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Idempotency (prevents duplicate billing)
  idempotency_key VARCHAR(255),
  -- Recommended format: {subscriptionId}:{metric}:{period}:{batchId}
  -- Keys are valid for 48 hours after period ends

  -- Which billing period this was applied to
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Processing status
  processed BOOLEAN DEFAULT TRUE,  -- Was added to usage_records
  skipped_duplicate BOOLEAN DEFAULT FALSE,  -- Was skipped due to idempotency

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_report_idempotency UNIQUE (subscription_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
);

CREATE INDEX idx_usage_reports_subscription ON billing_usage_reports(subscription_id);
CREATE INDEX idx_usage_reports_period ON billing_usage_reports(period_start, period_end);
CREATE INDEX idx_usage_reports_created ON billing_usage_reports(created_at);
-- Partial index for idempotency key lookups
CREATE INDEX idx_usage_reports_idempotency ON billing_usage_reports(subscription_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Drizzle Schema:**

```typescript
export const usageReports = pgTable('billing_usage_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  metricName: varchar('metric_name', { length: 100 }).notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull(),

  usageTimestamp: timestamp('usage_timestamp', { withTimezone: true }).notNull().defaultNow(),

  idempotencyKey: varchar('idempotency_key', { length: 255 }),

  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  processed: boolean('processed').default(true),
  skippedDuplicate: boolean('skipped_duplicate').default(false),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### usage_events (Deprecated - Use usage_reports)

> **Note**: This table is replaced by `usage_reports` in the hybrid architecture. Kept for backward compatibility. New implementations should use `usage_reports`.

Individual usage events for high-frequency tracking (legacy).

```sql
CREATE TABLE billing_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  metric_name VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Event details
  event_type VARCHAR(100),
  event_id VARCHAR(255),

  idempotency_key VARCHAR(255),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_event_idempotency UNIQUE (subscription_id, idempotency_key)
);

CREATE INDEX idx_usage_events_subscription ON billing_usage_events(subscription_id);
CREATE INDEX idx_usage_events_customer ON billing_usage_events(customer_id);
CREATE INDEX idx_usage_events_metric ON billing_usage_events(metric_name);
CREATE INDEX idx_usage_events_created ON billing_usage_events(created_at);
```

**Drizzle Schema:**

```typescript
// @deprecated Use usageReports instead
export const usageEvents = pgTable('billing_usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  metricName: varchar('metric_name', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull().default(1),

  eventType: varchar('event_type', { length: 100 }),
  eventId: varchar('event_id', { length: 255 }),

  idempotencyKey: varchar('idempotency_key', { length: 255 }),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### subscription_addons

Stores add-ons attached to subscriptions for extra features.

```sql
CREATE TABLE billing_subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: Preserve addon history for billing/audit. Use soft delete (status='removed').
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE RESTRICT,
  addon_id VARCHAR(100) NOT NULL,

  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE,

  -- ============================================
  -- PRORATION TRACKING
  -- ============================================
  -- These fields track prorated charges/credits when add-ons are added or removed
  -- mid-billing-cycle. Proration ensures customers pay only for the time they use.
  --
  -- PRORATION SCENARIOS:
  --
  -- 1. ADD-ON ADDED MID-CYCLE (prorated_amount > 0):
  --    - Customer adds $30/month add-on with 15 days remaining in cycle
  --    - prorated_amount = 30 * (15/30) = $15.00 (charge for remaining days)
  --    - proration_date = timestamp when proration was calculated
  --    - A one-time payment of $15 is charged immediately
  --
  -- 2. ADD-ON REMOVED MID-CYCLE with QZPayProrationBehavior.IMMEDIATELY:
  --    - Customer removes $30/month add-on with 10 days remaining
  --    - prorated_amount = -30 * (10/30) = -$10.00 (negative = credit)
  --    - proration_date = timestamp when removed
  --    - A credit note of $10 is created (type='proration')
  --
  -- 3. ADD-ON REMOVED with QZPayProrationBehavior.NEXT_PERIOD:
  --    - prorated_amount = NULL (no proration, runs until period end)
  --    - proration_date = NULL
  --    - status remains 'active' until period_end, then changes to 'removed'
  --
  -- 4. QUANTITY CHANGE MID-CYCLE:
  --    - Customer upgrades from qty=2 to qty=5 (3 more units)
  --    - prorated_amount = unit_price * 3 * (days_remaining/total_days)
  --    - proration_date = timestamp of quantity change
  --
  -- SIGN CONVENTION:
  --   positive = charge to customer (add-on added, quantity increased)
  --   negative = credit to customer (add-on removed, quantity decreased)
  --
  -- NULL VALUES:
  --   prorated_amount = NULL means no proration occurred (added at cycle start,
  --   or proration behavior was NEXT_PERIOD/NONE)
  --
  prorated_amount DECIMAL(19, 8),  -- Amount charged (+) or credited (-) for proration
  proration_date TIMESTAMP WITH TIME ZONE,  -- When proration was calculated

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_addon_status CHECK (
    status IN ('active', 'removed', 'pending')
  ),
  CONSTRAINT chk_addon_quantity CHECK (quantity >= 1),
  CONSTRAINT uq_subscription_addon UNIQUE (subscription_id, addon_id, status)
);

CREATE INDEX idx_subscription_addons_subscription ON billing_subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_addon ON billing_subscription_addons(addon_id);
CREATE INDEX idx_subscription_addons_active ON billing_subscription_addons(subscription_id)
  WHERE status = 'active';
```

**Drizzle Schema:**

```typescript
export const subscriptionAddons = pgTable('billing_subscription_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT: Preserve addon history for billing/audit. Use soft delete (status='removed').
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),
  addonId: varchar('addon_id', { length: 100 }).notNull(),

  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  status: varchar('status', { length: 20 }).notNull().default('active'),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),

  /**
   * PRORATION FIELDS
   *
   * proratedAmount: The prorated charge (+) or credit (-) calculated when the add-on
   * is added/removed mid-billing-cycle. NULL if no proration (added at cycle start
   * or proration behavior was NEXT_PERIOD/NONE).
   *
   * prorationDate: Timestamp when proration was calculated. Used for audit trail
   * and to correlate with payments/credit notes.
   *
   * @see QZPayProrationBehavior for proration behavior options
   * @see QZPayProrationDetails for structured proration information
   */
  proratedAmount: decimal('prorated_amount', { precision: 19, scale: 8 }),
  prorationDate: timestamp('proration_date', { withTimezone: true }),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionAddon = typeof subscriptionAddons.$inferSelect;
export type NewSubscriptionAddon = typeof subscriptionAddons.$inferInsert;
```

**Proration Types and Utilities:**

```typescript
// packages/core/src/types/proration.ts

import type { QZPayProrationBehaviorType } from './constants';

/**
 * ============================================
 * PRORATION TYPES
 * ============================================
 * These types provide structured proration information for add-ons,
 * seat changes, and plan upgrades/downgrades.
 */

/**
 * Detailed proration calculation result.
 * Returned by calculateProration() and included in billing events.
 */
export interface QZPayProrationDetails {
  /**
   * The prorated amount in the subscription's currency.
   * - Positive: charge to customer (add-on added, quantity increased, upgrade)
   * - Negative: credit to customer (add-on removed, quantity decreased, downgrade)
   * - Zero: no proration (e.g., change at cycle boundary)
   */
  amount: number;

  /**
   * ISO 4217 currency code (e.g., 'USD', 'EUR', 'ARS').
   */
  currency: string;

  /**
   * How the proration amount was derived.
   */
  calculation: {
    /**
     * The full period amount (what would be charged for a complete cycle).
     */
    fullPeriodAmount: number;

    /**
     * Days remaining in the current billing period when proration occurred.
     */
    daysRemaining: number;

    /**
     * Total days in the billing period (e.g., 30 for monthly, 365 for yearly).
     */
    totalDays: number;

    /**
     * The fraction used: daysRemaining / totalDays.
     */
    fraction: number;
  };

  /**
   * When the proration was calculated.
   */
  calculatedAt: Date;

  /**
   * The proration behavior that was applied.
   */
  behavior: QZPayProrationBehaviorType;

  /**
   * How the proration was settled.
   */
  settlement: {
    /**
     * Type of settlement:
     * - 'immediate_charge': One-time payment created for positive amount
     * - 'credit_note': Credit note created for negative amount
     * - 'next_invoice': Amount will be added to/subtracted from next invoice
     * - 'none': No settlement (behavior was NONE or amount was zero)
     */
    type: 'immediate_charge' | 'credit_note' | 'next_invoice' | 'none';

    /**
     * ID of the payment or credit note created (if applicable).
     */
    referenceId?: string;

    /**
     * For credit notes: the credit note number (e.g., 'CN-2025-00042').
     */
    referenceNumber?: string;
  };
}

/**
 * Input for proration calculation.
 */
export interface QZPayProrationInput {
  /**
   * The amount to prorate (full period price).
   */
  amount: number;

  /**
   * Currency code.
   */
  currency: string;

  /**
   * Current billing period start date.
   */
  periodStart: Date;

  /**
   * Current billing period end date.
   */
  periodEnd: Date;

  /**
   * When the change is being made (defaults to now).
   */
  changeDate?: Date;

  /**
   * The proration behavior to apply.
   */
  behavior: QZPayProrationBehaviorType;
}

/**
 * Calculates proration for a mid-cycle change.
 *
 * @example
 * // Add-on added mid-cycle
 * const proration = calculateProration({
 *   amount: 30.00,  // $30/month add-on
 *   currency: 'USD',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   changeDate: new Date('2025-01-16'),  // 15 days remaining
 *   behavior: QZPayProrationBehavior.IMMEDIATELY,
 * });
 * // Result: { amount: 15.00, ... } (charge for 15/30 days)
 *
 * @example
 * // Add-on removed mid-cycle
 * const proration = calculateProration({
 *   amount: -30.00,  // Negative = removal
 *   currency: 'USD',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   changeDate: new Date('2025-01-21'),  // 10 days remaining
 *   behavior: QZPayProrationBehavior.IMMEDIATELY,
 * });
 * // Result: { amount: -10.00, ... } (credit for 10/30 days)
 */
export function calculateProration(input: QZPayProrationInput): QZPayProrationDetails {
  const { amount, currency, periodStart, periodEnd, behavior } = input;
  const changeDate = input.changeDate ?? new Date();

  // No proration for NEXT_PERIOD or NONE behavior
  if (behavior === 'next_period' || behavior === 'none') {
    return {
      amount: 0,
      currency,
      calculation: {
        fullPeriodAmount: Math.abs(amount),
        daysRemaining: 0,
        totalDays: 0,
        fraction: 0,
      },
      calculatedAt: changeDate,
      behavior,
      settlement: { type: 'none' },
    };
  }

  // Calculate days
  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const fraction = daysRemaining / totalDays;

  // Calculate prorated amount (preserves sign)
  const proratedAmount = Math.round(amount * fraction * 100) / 100;

  // Determine settlement type
  let settlementType: QZPayProrationDetails['settlement']['type'];
  if (proratedAmount === 0) {
    settlementType = 'none';
  } else if (proratedAmount > 0) {
    settlementType = 'immediate_charge';
  } else {
    settlementType = 'credit_note';
  }

  return {
    amount: proratedAmount,
    currency,
    calculation: {
      fullPeriodAmount: Math.abs(amount),
      daysRemaining,
      totalDays,
      fraction,
    },
    calculatedAt: changeDate,
    behavior,
    settlement: { type: settlementType },
  };
}
```

---

### addon_definitions

Stores add-on product definitions that can be attached to subscriptions.

```sql
CREATE TABLE billing_addon_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Pricing model
  pricing_model VARCHAR(20) NOT NULL DEFAULT 'flat',
  price DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Compatibility
  compatible_plans TEXT[],

  -- Status
  active BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_addon_pricing_model CHECK (
    pricing_model IN ('flat', 'per_unit', 'tiered')
  )
);

CREATE INDEX idx_addon_definitions_addon_id ON billing_addon_definitions(addon_id);
CREATE INDEX idx_addon_definitions_active ON billing_addon_definitions(active) WHERE active = true;
```

**Drizzle Schema:**

```typescript
export const addonDefinitions = pgTable('billing_addon_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  addonId: varchar('addon_id', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  pricingModel: varchar('pricing_model', { length: 20 }).notNull().default('flat'),
  price: decimal('price', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  compatiblePlans: text('compatible_plans').array(),

  active: boolean('active').default(true),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AddonDefinition = typeof addonDefinitions.$inferSelect;
export type NewAddonDefinition = typeof addonDefinitions.$inferInsert;
```

---

### customer_discounts

Stores permanent customer-specific discounts (VIP rates, loyalty discounts, negotiated rates).

```sql
CREATE TABLE billing_customer_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: Preserve discount history for billing/audit. Use soft delete (active=false).
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,

  -- Discount details
  discount_type VARCHAR(20) NOT NULL,
  value DECIMAL(19, 8) NOT NULL,
  reason VARCHAR(500) NOT NULL,

  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,

  -- Scope
  applicable_plans TEXT[],
  applicable_products TEXT[],

  -- Priority for stacking
  priority INTEGER NOT NULL DEFAULT 0,

  -- Limits
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  -- Status
  active BOOLEAN DEFAULT TRUE,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),

  CONSTRAINT chk_discount_type CHECK (
    discount_type IN ('percentage', 'fixed_amount')
  ),
  CONSTRAINT chk_percentage_value CHECK (
    discount_type != 'percentage' OR (value >= 0 AND value <= 100)
  ),
  CONSTRAINT chk_fixed_value CHECK (
    discount_type != 'fixed_amount' OR value >= 0
  )
);

CREATE INDEX idx_customer_discounts_customer ON billing_customer_discounts(customer_id);
CREATE INDEX idx_customer_discounts_active ON billing_customer_discounts(customer_id, active)
  WHERE active = true;
CREATE INDEX idx_customer_discounts_validity ON billing_customer_discounts(valid_from, valid_until)
  WHERE active = true;
CREATE INDEX idx_customer_discounts_livemode ON billing_customer_discounts(livemode);
```

**Drizzle Schema:**

```typescript
export const customerDiscounts = pgTable('billing_customer_discounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT: Preserve discount history for billing/audit. Use soft delete (active=false).
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),

  discountType: varchar('discount_type', { length: 20 }).notNull(),
  value: decimal('value', { precision: 19, scale: 8 }).notNull(),
  reason: varchar('reason', { length: 500 }).notNull(),

  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),

  applicablePlans: text('applicable_plans').array(),
  applicableProducts: text('applicable_products').array(),

  priority: integer('priority').notNull().default(0),

  maxUses: integer('max_uses'),
  currentUses: integer('current_uses').default(0),

  active: boolean('active').default(true),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
});

export type CustomerDiscount = typeof customerDiscounts.$inferSelect;
export type NewCustomerDiscount = typeof customerDiscounts.$inferInsert;
```

---

### job_executions

Stores job execution history for monitoring background jobs.

```sql
CREATE TABLE billing_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,

  -- Execution details
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'running',

  -- Results
  items_processed INTEGER DEFAULT 0,
  items_succeeded INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,

  -- Error details
  error_message TEXT,
  error_stack TEXT,

  -- Execution context
  triggered_by VARCHAR(50) NOT NULL DEFAULT 'scheduler',
  triggered_by_user VARCHAR(255),
  dry_run BOOLEAN DEFAULT FALSE,

  -- Configuration snapshot
  config_snapshot JSONB DEFAULT '{}',

  -- Results summary
  result_summary JSONB DEFAULT '{}',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_job_status CHECK (
    status IN ('running', 'success', 'failed', 'partial', 'cancelled')
  ),
  CONSTRAINT chk_triggered_by CHECK (
    triggered_by IN ('scheduler', 'manual', 'api', 'webhook')
  )
);

CREATE INDEX idx_job_executions_job_name ON billing_job_executions(job_name);
CREATE INDEX idx_job_executions_status ON billing_job_executions(status);
CREATE INDEX idx_job_executions_started_at ON billing_job_executions(started_at DESC);
CREATE INDEX idx_job_executions_job_status ON billing_job_executions(job_name, status, started_at DESC);
```

**Drizzle Schema:**

```typescript
export const jobExecutions = pgTable('billing_job_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobName: varchar('job_name', { length: 100 }).notNull(),

  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  status: varchar('status', { length: 20 }).notNull().default('running'),

  itemsProcessed: integer('items_processed').default(0),
  itemsSucceeded: integer('items_succeeded').default(0),
  itemsFailed: integer('items_failed').default(0),

  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  triggeredBy: varchar('triggered_by', { length: 50 }).notNull().default('scheduler'),
  triggeredByUser: varchar('triggered_by_user', { length: 255 }),
  dryRun: boolean('dry_run').default(false),

  configSnapshot: jsonb('config_snapshot').default({}),
  resultSummary: jsonb('result_summary').default({}),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type JobExecution = typeof jobExecutions.$inferSelect;
export type NewJobExecution = typeof jobExecutions.$inferInsert;
```

---

### promo_code_analytics

Stores aggregated analytics for promo codes (for reporting and ROI tracking).

```sql
CREATE TABLE billing_promo_code_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: Preserve analytics history. Analytics are immutable audit records.
  promo_code_id UUID NOT NULL REFERENCES billing_promo_codes(id) ON DELETE RESTRICT,

  -- Date for daily aggregation
  analytics_date DATE NOT NULL,

  -- Usage metrics
  total_uses INTEGER DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  existing_customers INTEGER DEFAULT 0,

  -- Financial metrics
  total_discount_given DECIMAL(19, 8) DEFAULT 0,
  revenue_generated DECIMAL(19, 8) DEFAULT 0,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Plan breakdown (JSON for flexibility)
  plan_breakdown JSONB DEFAULT '{}',

  -- Conversion metrics
  checkout_starts INTEGER DEFAULT 0,
  successful_conversions INTEGER DEFAULT 0,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_promo_analytics_date UNIQUE (promo_code_id, analytics_date, livemode)
);

CREATE INDEX idx_promo_analytics_code ON billing_promo_code_analytics(promo_code_id);
CREATE INDEX idx_promo_analytics_date ON billing_promo_code_analytics(analytics_date);
CREATE INDEX idx_promo_analytics_livemode ON billing_promo_code_analytics(livemode);
```

**Drizzle Schema:**

```typescript
export const promoCodeAnalytics = pgTable('billing_promo_code_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT: Preserve analytics history. Analytics are immutable audit records.
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'restrict' }),

  analyticsDate: date('analytics_date').notNull(),

  totalUses: integer('total_uses').default(0),
  uniqueCustomers: integer('unique_customers').default(0),
  newCustomers: integer('new_customers').default(0),
  existingCustomers: integer('existing_customers').default(0),

  totalDiscountGiven: decimal('total_discount_given', { precision: 19, scale: 8 }).default('0'),
  revenueGenerated: decimal('revenue_generated', { precision: 19, scale: 8 }).default('0'),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  planBreakdown: jsonb('plan_breakdown').default({}),

  checkoutStarts: integer('checkout_starts').default(0),
  successfulConversions: integer('successful_conversions').default(0),

  livemode: boolean('livemode').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCodeAnalytics = typeof promoCodeAnalytics.$inferSelect;
export type NewPromoCodeAnalytics = typeof promoCodeAnalytics.$inferInsert;
```

---

### vendor_analytics

Stores aggregated analytics for vendors in marketplace mode.

```sql
CREATE TABLE billing_vendor_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: Preserve analytics history. Analytics are immutable audit records.
  vendor_id UUID NOT NULL REFERENCES billing_vendors(id) ON DELETE RESTRICT,

  -- Date for daily aggregation
  analytics_date DATE NOT NULL,

  -- Sales metrics
  total_sales DECIMAL(19, 8) DEFAULT 0,
  total_commissions DECIMAL(19, 8) DEFAULT 0,
  net_revenue DECIMAL(19, 8) DEFAULT 0,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Transaction counts
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  refunded_transactions INTEGER DEFAULT 0,

  -- Refund metrics
  total_refunds DECIMAL(19, 8) DEFAULT 0,
  refund_rate DECIMAL(5, 4) DEFAULT 0,

  -- Product breakdown
  product_breakdown JSONB DEFAULT '{}',

  -- Customer metrics
  unique_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_vendor_analytics_date UNIQUE (vendor_id, analytics_date, livemode)
);

CREATE INDEX idx_vendor_analytics_vendor ON billing_vendor_analytics(vendor_id);
CREATE INDEX idx_vendor_analytics_date ON billing_vendor_analytics(analytics_date);
CREATE INDEX idx_vendor_analytics_livemode ON billing_vendor_analytics(livemode);
```

**Drizzle Schema:**

```typescript
export const vendorAnalytics = pgTable('billing_vendor_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT: Preserve analytics history. Analytics are immutable audit records.
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'restrict' }),

  analyticsDate: date('analytics_date').notNull(),

  totalSales: decimal('total_sales', { precision: 19, scale: 8 }).default('0'),
  totalCommissions: decimal('total_commissions', { precision: 19, scale: 8 }).default('0'),
  netRevenue: decimal('net_revenue', { precision: 19, scale: 8 }).default('0'),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  successfulTransactions: integer('successful_transactions').default(0),
  failedTransactions: integer('failed_transactions').default(0),
  refundedTransactions: integer('refunded_transactions').default(0),

  totalRefunds: decimal('total_refunds', { precision: 19, scale: 8 }).default('0'),
  refundRate: decimal('refund_rate', { precision: 5, scale: 4 }).default('0'),

  productBreakdown: jsonb('product_breakdown').default({}),

  uniqueCustomers: integer('unique_customers').default(0),
  newCustomers: integer('new_customers').default(0),

  livemode: boolean('livemode').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type VendorAnalytics = typeof vendorAnalytics.$inferSelect;
export type NewVendorAnalytics = typeof vendorAnalytics.$inferInsert;
```

---

### credit_notes

Stores credit notes for refunds and adjustments.

```sql
CREATE TABLE billing_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Credit note number: unique per environment (livemode)
  -- This allows test and production to have independent numbering sequences
  number VARCHAR(20) NOT NULL,
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  -- Amounts
  amount DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),
  remaining_amount DECIMAL(19, 8) NOT NULL,

  -- ============================================
  -- TYPE AND STATUS
  -- ============================================
  -- Credit note type indicates why the credit was issued:
  --
  -- 'refund'        - Full or partial refund of a payment (e.g., customer requested refund)
  -- 'adjustment'    - Billing adjustment (e.g., overcharged, pricing correction)
  -- 'goodwill'      - Customer retention gesture (e.g., apology for service issue)
  -- 'billing_error' - System or operator error correction (e.g., duplicate charge)
  -- 'proration'     - Credit for unused time when:
  --                   * Add-on removed mid-cycle with QZPayProrationBehavior.IMMEDIATELY
  --                   * Seats reduced mid-cycle
  --                   * Subscription downgraded mid-cycle
  --                   * Subscription canceled mid-cycle with prorated refund policy
  --                   The prorated_amount field in billing_subscription_addons correlates
  --                   to credit notes of this type (negative prorated_amount → credit note)
  --
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  reason TEXT NOT NULL,

  -- Related entities
  invoice_id UUID REFERENCES billing_invoices(id),
  payment_id UUID REFERENCES billing_payments(id),
  applied_to_invoice_id UUID REFERENCES billing_invoices(id),

  -- Timestamps
  issued_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  void_reason TEXT,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),

  CONSTRAINT chk_credit_note_type CHECK (
    type IN ('refund', 'adjustment', 'goodwill', 'billing_error', 'proration')
  ),
  CONSTRAINT chk_credit_note_status CHECK (
    status IN ('draft', 'issued', 'applied', 'partially_applied', 'void')
  ),
  CONSTRAINT chk_remaining_amount CHECK (remaining_amount >= 0 AND remaining_amount <= amount),

  -- Credit note must have positive amount (a $0 or negative credit note is invalid)
  -- Consistent with billing_payments.chk_payment_amount_positive
  CONSTRAINT chk_credit_note_amount_positive CHECK (amount > 0),

  -- Credit note number unique per environment (test vs production)
  -- Allows CN-0001 in test AND CN-0001 in production without conflict
  -- For multi-tenant: change to UNIQUE (tenant_id, number, livemode)
  CONSTRAINT uq_credit_notes_number_livemode UNIQUE (number, livemode)
);

CREATE INDEX idx_credit_notes_customer ON billing_credit_notes(customer_id);
CREATE INDEX idx_credit_notes_status ON billing_credit_notes(status);
CREATE INDEX idx_credit_notes_invoice ON billing_credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_livemode ON billing_credit_notes(livemode);

-- Credit notes by originating payment (refunds, disputes)
-- Use cases:
--   1. Get credit notes generated from a specific payment refund
--   2. View credits associated with a disputed payment
--   3. Reconcile refunds with their credit notes
--   4. Audit trail: which credits originated from which payment
-- Partial index: Only indexes credit notes linked to a payment (excludes goodwill, adjustments without payment)
CREATE INDEX idx_credit_notes_payment ON billing_credit_notes(payment_id)
  WHERE payment_id IS NOT NULL;

-- Credit notes by target invoice (application tracking)
-- Use cases:
--   1. Get all credit notes applied to reduce a specific invoice balance
--   2. Calculate effective invoice balance (amount - applied credits)
--   3. Show credit application history on invoice detail page
--   4. Accounts receivable reporting with credit adjustments
-- Partial index: Only indexes credit notes that have been applied to an invoice
-- Note: Different from invoice_id which is the ORIGINATING invoice; this is the TARGET invoice
CREATE INDEX idx_credit_notes_applied_to ON billing_credit_notes(applied_to_invoice_id)
  WHERE applied_to_invoice_id IS NOT NULL;

-- Sequence for credit note numbers
CREATE SEQUENCE billing_credit_note_seq;
```

**Drizzle Schema:**

```typescript
import { unique } from 'drizzle-orm/pg-core';

export const creditNotes = pgTable('billing_credit_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Credit note number: unique per environment (livemode)
  // Composite unique constraint defined below in table config
  number: varchar('number', { length: 20 }).notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  amount: decimal('amount', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  remainingAmount: decimal('remaining_amount', { precision: 19, scale: 8 }).notNull(),

  /**
   * Credit note type. Valid values:
   * - 'refund': Full or partial refund of a payment
   * - 'adjustment': Billing adjustment (overcharge, pricing correction)
   * - 'goodwill': Customer retention gesture
   * - 'billing_error': System or operator error correction
   * - 'proration': Credit for unused time (add-on removed, seats reduced,
   *                subscription downgraded/canceled mid-cycle)
   *
   * @see QZPayCreditNoteType constant for TypeScript enum values
   */
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  reason: text('reason').notNull(),

  invoiceId: uuid('invoice_id').references(() => invoices.id),
  paymentId: uuid('payment_id').references(() => payments.id),
  appliedToInvoiceId: uuid('applied_to_invoice_id').references(() => invoices.id),

  issuedAt: timestamp('issued_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: text('void_reason'),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
}, (table) => ({
  // Credit note number unique per environment (test vs production)
  // Allows CN-0001 in test AND CN-0001 in production without conflict
  // For multi-tenant: add tenant_id to this constraint
  uniqueNumberLivemode: unique('uq_credit_notes_number_livemode').on(table.number, table.livemode),
}));

export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;
```

---

### exchange_rates

Stores exchange rates with caching and manual overrides.

```sql
CREATE TABLE billing_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),
  to_currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Precision: 18,10 for cryptocurrency and volatile currency support
  -- Must match precision used in billing_payments.exchange_rate and billing_pricing_snapshots.exchange_rate
  rate DECIMAL(18, 10) NOT NULL,
  source VARCHAR(30) NOT NULL,

  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- For manual overrides
  is_manual_override BOOLEAN DEFAULT FALSE,
  override_expires_at TIMESTAMP WITH TIME ZONE,
  override_by VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rate_source CHECK (
    source IN ('openexchangerates', 'exchangeratesapi', 'manual', 'provider')
  ),
  CONSTRAINT uk_exchange_rate UNIQUE (from_currency, to_currency, is_manual_override),
  CONSTRAINT chk_different_currencies CHECK (from_currency <> to_currency)
);

CREATE INDEX idx_exchange_rates_pair ON billing_exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_expires ON billing_exchange_rates(expires_at);
CREATE INDEX idx_exchange_rates_from ON billing_exchange_rates(from_currency);
CREATE INDEX idx_exchange_rates_to ON billing_exchange_rates(to_currency);
```

**Drizzle Schema:**

```typescript
export const exchangeRates = pgTable('billing_exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromCurrency: varchar('from_currency', { length: 3 }).notNull().references(() => currencies.code),
  toCurrency: varchar('to_currency', { length: 3 }).notNull().references(() => currencies.code),

  // Precision: 18,10 for cryptocurrency and volatile currency support
  // Must match precision used in payments.exchangeRate and pricingSnapshots.exchangeRate
  rate: decimal('rate', { precision: 18, scale: 10 }).notNull(),
  source: varchar('source', { length: 30 }).notNull(),

  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  isManualOverride: boolean('is_manual_override').default(false),
  overrideExpiresAt: timestamp('override_expires_at', { withTimezone: true }),
  overrideBy: varchar('override_by', { length: 255 }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
```

---

### pricing_snapshots

Stores pricing snapshots at subscription creation for historical accuracy.

```sql
CREATE TABLE billing_pricing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: Preserve pricing history for audit/legal. Snapshots are immutable records.
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE RESTRICT,
  plan_id VARCHAR(100) NOT NULL,

  -- Plan snapshot
  plan_snapshot JSONB NOT NULL,

  -- Applied discounts
  applied_discounts JSONB DEFAULT '{}',

  -- Final calculated price
  final_price DECIMAL(19, 8) NOT NULL,
  final_currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  -- Exchange rate if converted
  -- Precision: 18,10 for cryptocurrency and volatile currency support
  -- Must match precision used in billing_exchange_rates.rate and billing_payments.exchange_rate
  exchange_rate DECIMAL(18, 10),
  exchange_rate_locked_at TIMESTAMP WITH TIME ZONE,
  -- Exchange rate source tracking for audit trail
  -- Records where the exchange rate originated from for compliance and debugging
  -- Values: 'api:<provider>' (e.g., 'api:openexchangerates', 'api:currencyapi'),
  --         'manual:admin_override' (admin manually set the rate),
  --         'cache:<ttl>' (e.g., 'cache:30min' - cached rate with TTL),
  --         'billing_exchange_rates' (from internal exchange_rates table),
  --         'provider:<name>' (e.g., 'provider:stripe' - rate from payment provider)
  -- NULL when exchange_rate is NULL (same currency, no conversion needed)
  exchange_rate_source VARCHAR(50),

  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_snapshots_subscription ON billing_pricing_snapshots(subscription_id);
CREATE INDEX idx_pricing_snapshots_captured ON billing_pricing_snapshots(captured_at);
```

**Drizzle Schema:**

```typescript
export const pricingSnapshots = pgTable('billing_pricing_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT: Preserve pricing history for audit/legal. Snapshots are immutable records.
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),
  planId: varchar('plan_id', { length: 100 }).notNull(),

  planSnapshot: jsonb('plan_snapshot').notNull(),
  appliedDiscounts: jsonb('applied_discounts').default({}),

  finalPrice: decimal('final_price', { precision: 19, scale: 8 }).notNull(),
  finalCurrency: varchar('final_currency', { length: 3 }).notNull().references(() => currencies.code),

  // Precision: 18,10 for cryptocurrency and volatile currency support
  // Must match precision used in exchangeRates.rate and payments.exchangeRate
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 10 }),
  exchangeRateLockedAt: timestamp('exchange_rate_locked_at', { withTimezone: true }),
  /**
   * Exchange rate source tracking for audit trail
   * Records where the exchange rate originated from for compliance and debugging
   *
   * Valid values:
   * - 'api:<provider>' - External API (e.g., 'api:openexchangerates', 'api:currencyapi')
   * - 'manual:admin_override' - Admin manually set the rate
   * - 'cache:<ttl>' - Cached rate with TTL (e.g., 'cache:30min')
   * - 'billing_exchange_rates' - From internal exchange_rates table
   * - 'provider:<name>' - Rate from payment provider (e.g., 'provider:stripe')
   *
   * NULL when exchange_rate is NULL (same currency, no conversion needed)
   */
  exchangeRateSource: varchar('exchange_rate_source', { length: 50 }),

  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PricingSnapshot = typeof pricingSnapshots.$inferSelect;
export type NewPricingSnapshot = typeof pricingSnapshots.$inferInsert;
```

---

### exports

Stores export job requests and results.

```sql
CREATE TABLE billing_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request details
  entity VARCHAR(30) NOT NULL,
  format VARCHAR(10) NOT NULL,
  filters JSONB DEFAULT '{}',
  fields TEXT[],
  date_range_from TIMESTAMP WITH TIME ZONE,
  date_range_to TIMESTAMP WITH TIME ZONE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Results
  file_url TEXT,
  file_size INTEGER,
  row_count INTEGER,
  error_message TEXT,

  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- User info
  requested_by VARCHAR(255),

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_export_entity CHECK (
    entity IN ('customers', 'subscriptions', 'payments', 'invoices', 'credit_notes', 'promo_codes', 'audit_logs')
  ),
  CONSTRAINT chk_export_format CHECK (
    format IN ('csv', 'xlsx', 'json')
  ),
  CONSTRAINT chk_export_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX idx_exports_status ON billing_exports(status);
CREATE INDEX idx_exports_requested_by ON billing_exports(requested_by);
CREATE INDEX idx_exports_expires ON billing_exports(expires_at) WHERE status = 'completed';

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_exports_livemode ON billing_exports(livemode);
```

**Drizzle Schema:**

```typescript
export const exports = pgTable('billing_exports', {
  id: uuid('id').primaryKey().defaultRandom(),

  entity: varchar('entity', { length: 30 }).notNull(),
  format: varchar('format', { length: 10 }).notNull(),
  filters: jsonb('filters').default({}),
  fields: text('fields').array(),
  dateRangeFrom: timestamp('date_range_from', { withTimezone: true }),
  dateRangeTo: timestamp('date_range_to', { withTimezone: true }),

  status: varchar('status', { length: 20 }).notNull().default('pending'),

  fileUrl: text('file_url'),
  fileSize: integer('file_size'),
  rowCount: integer('row_count'),
  errorMessage: text('error_message'),

  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  requestedBy: varchar('requested_by', { length: 255 }),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Export = typeof exports.$inferSelect;
export type NewExport = typeof exports.$inferInsert;
```

---

### audit_logs

Stores immutable audit logs for compliance.

```sql
CREATE TABLE billing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Action details
  action VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,

  -- Actor
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255),
  actor_email VARCHAR(255),

  -- Entity
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,

  -- Changes
  changes JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_audit_category CHECK (
    category IN ('customer', 'subscription', 'payment', 'invoice', 'refund', 'promo_code', 'plan', 'security', 'admin')
  ),
  CONSTRAINT chk_audit_actor_type CHECK (
    actor_type IN ('user', 'admin', 'system', 'api', 'webhook', 'job')
  ),
  CONSTRAINT chk_audit_status CHECK (
    status IN ('success', 'failed')
  )
);

-- Immutability trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE OR DELETE ON billing_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_entity ON billing_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON billing_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_category ON billing_audit_logs(category);
CREATE INDEX idx_audit_logs_action ON billing_audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON billing_audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_livemode ON billing_audit_logs(livemode);

-- Partial index for request correlation (only indexes rows with request_id present)
-- Used for: debugging, correlating multiple audit events from same HTTP request, compliance tracing
-- Partial because: system events, background jobs, and triggers don't have request_id
CREATE INDEX idx_audit_logs_request_id ON billing_audit_logs(request_id)
  WHERE request_id IS NOT NULL;
```

**Drizzle Schema:**

```typescript
export const auditLogs = pgTable('billing_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

  action: varchar('action', { length: 100 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),

  actorType: varchar('actor_type', { length: 20 }).notNull(),
  actorId: varchar('actor_id', { length: 255 }),
  actorEmail: varchar('actor_email', { length: 255 }),

  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),

  changes: jsonb('changes'),

  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  requestId: varchar('request_id', { length: 100 }),

  livemode: boolean('livemode').notNull().default(true),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

---

### reconciliation_issues

Stores detected inconsistencies between DB and payment providers.

```sql
CREATE TABLE billing_reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity details
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  provider VARCHAR(30) NOT NULL,

  -- Issue details
  issue_type VARCHAR(30) NOT NULL,
  db_state JSONB NOT NULL,
  provider_state JSONB NOT NULL,

  -- Resolution
  resolution VARCHAR(20),
  resolved_by VARCHAR(255),

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  CONSTRAINT chk_recon_entity_type CHECK (
    entity_type IN ('subscription', 'customer', 'payment')
  ),
  CONSTRAINT chk_recon_issue_type CHECK (
    issue_type IN ('status_mismatch', 'missing_in_db', 'missing_in_provider', 'data_mismatch')
  ),
  CONSTRAINT chk_recon_resolution CHECK (
    resolution IS NULL OR resolution IN ('provider_wins', 'db_wins', 'manual', 'ignored')
  )
);

CREATE INDEX idx_recon_issues_entity ON billing_reconciliation_issues(entity_type, entity_id);
CREATE INDEX idx_recon_issues_pending ON billing_reconciliation_issues(detected_at)
  WHERE resolution IS NULL;
CREATE INDEX idx_recon_issues_provider ON billing_reconciliation_issues(provider);
CREATE INDEX idx_recon_issues_livemode ON billing_reconciliation_issues(livemode);
```

**Drizzle Schema:**

```typescript
export const reconciliationIssues = pgTable('billing_reconciliation_issues', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  provider: varchar('provider', { length: 30 }).notNull(),

  issueType: varchar('issue_type', { length: 30 }).notNull(),
  dbState: jsonb('db_state').notNull(),
  providerState: jsonb('provider_state').notNull(),

  resolution: varchar('resolution', { length: 20 }),
  resolvedBy: varchar('resolved_by', { length: 255 }),

  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
});

export type ReconciliationIssue = typeof reconciliationIssues.$inferSelect;
export type NewReconciliationIssue = typeof reconciliationIssues.$inferInsert;
```

---

### webhook_deliveries

Tracks outgoing webhook deliveries to customer endpoints for debugging and UI display.

```sql
CREATE TABLE billing_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Webhook endpoint configuration
  endpoint_url VARCHAR(2048) NOT NULL,

  -- Event information
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,

  -- Response tracking
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,
  latency_ms INTEGER,

  -- Timestamps
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  first_attempted_at TIMESTAMP WITH TIME ZONE,
  last_attempted_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Error tracking
  last_error TEXT,

  -- Environment isolation
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  CONSTRAINT chk_delivery_status CHECK (
    status IN ('pending', 'delivering', 'delivered', 'failed', 'exhausted')
  ),

  -- ============================================
  -- UNIQUENESS CONSTRAINT
  -- ============================================
  -- Prevents duplicate delivery records for the same event to the same endpoint.
  -- This ensures idempotency: if a delivery is already scheduled/in-progress/completed,
  -- attempting to create another delivery for the same event+endpoint+environment
  -- will fail with a constraint violation.
  --
  -- WHY ALL THREE COLUMNS:
  -- - event_id: Same event can be delivered to multiple endpoints (fan-out)
  -- - endpoint_url: Each endpoint gets its own delivery record
  -- - livemode: Test and production environments are isolated
  --
  -- RETRY BEHAVIOR:
  -- Retries do NOT create new records. The same delivery record is updated:
  -- - attempt_count incremented
  -- - last_attempted_at updated
  -- - next_retry_at calculated based on exponential backoff
  -- - status changes: pending → delivering → (delivered | failed | exhausted)
  --
  -- CONFLICT RESOLUTION:
  -- If you need to re-deliver an event (e.g., customer requested resend),
  -- use ON CONFLICT DO UPDATE to reset the delivery state, or create a new
  -- event with a different event_id.
  --
  CONSTRAINT uq_webhook_delivery_event_endpoint UNIQUE (event_id, endpoint_url, livemode)
);

CREATE INDEX idx_webhook_deliveries_status ON billing_webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_endpoint ON billing_webhook_deliveries(endpoint_url);
CREATE INDEX idx_webhook_deliveries_event_type ON billing_webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_scheduled ON billing_webhook_deliveries(scheduled_at);
CREATE INDEX idx_webhook_deliveries_next_retry ON billing_webhook_deliveries(next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_deliveries_livemode ON billing_webhook_deliveries(livemode);
```

**Drizzle Schema:**

```typescript
export const webhookDeliveries = pgTable('billing_webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),

  endpointUrl: varchar('endpoint_url', { length: 2048 }).notNull(),

  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventId: varchar('event_id', { length: 255 }).notNull(),
  payload: jsonb('payload').notNull(),

  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),

  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  responseHeaders: jsonb('response_headers'),
  latencyMs: integer('latency_ms'),

  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
  firstAttemptedAt: timestamp('first_attempted_at', { withTimezone: true }),
  lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  lastError: text('last_error'),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
}, (table) => ({
  /**
   * Uniqueness constraint: prevents duplicate delivery records.
   * Same event can be delivered to multiple endpoints (fan-out),
   * but each (event, endpoint, environment) combination is unique.
   *
   * Retries update the existing record, they don't create new ones.
   */
  uniqueEventEndpoint: unique('uq_webhook_delivery_event_endpoint').on(
    table.eventId,
    table.endpointUrl,
    table.livemode
  ),
}));

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
```

**Upsert Pattern for Webhook Delivery:**

```typescript
// packages/core/src/services/webhook-delivery.ts

import { sql } from 'drizzle-orm';
import type { NewWebhookDelivery } from '../schema';

/**
 * Creates or updates a webhook delivery record.
 * Uses PostgreSQL's ON CONFLICT for idempotent delivery scheduling.
 *
 * @example
 * // Schedule a new delivery (or get existing)
 * const delivery = await upsertWebhookDelivery(db, {
 *   eventId: 'evt_abc123',
 *   endpointUrl: 'https://example.com/webhook',
 *   eventType: 'subscription.created',
 *   payload: { ... },
 *   livemode: true,
 * });
 *
 * @example
 * // Resend a failed delivery (reset status)
 * const delivery = await upsertWebhookDelivery(db, {
 *   eventId: 'evt_abc123',
 *   endpointUrl: 'https://example.com/webhook',
 *   eventType: 'subscription.created',
 *   payload: { ... },
 *   livemode: true,
 * }, { resetOnConflict: true });
 */
export async function upsertWebhookDelivery(
  db: DatabaseConnection,
  data: NewWebhookDelivery,
  options?: { resetOnConflict?: boolean }
): Promise<WebhookDelivery> {
  const { resetOnConflict = false } = options ?? {};

  if (resetOnConflict) {
    // Reset delivery for resend: update status back to pending
    const result = await db
      .insert(webhookDeliveries)
      .values(data)
      .onConflictDoUpdate({
        target: [
          webhookDeliveries.eventId,
          webhookDeliveries.endpointUrl,
          webhookDeliveries.livemode,
        ],
        set: {
          status: 'pending',
          attemptCount: 0,
          scheduledAt: sql`NOW()`,
          nextRetryAt: null,
          lastError: null,
          responseStatus: null,
          responseBody: null,
          deliveredAt: null,
        },
      })
      .returning();

    return result[0];
  }

  // Normal insert: do nothing on conflict (idempotent)
  const result = await db
    .insert(webhookDeliveries)
    .values(data)
    .onConflictDoNothing({
      target: [
        webhookDeliveries.eventId,
        webhookDeliveries.endpointUrl,
        webhookDeliveries.livemode,
      ],
    })
    .returning();

  // If conflict occurred, fetch existing record
  if (result.length === 0) {
    const existing = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.eventId, data.eventId),
          eq(webhookDeliveries.endpointUrl, data.endpointUrl),
          eq(webhookDeliveries.livemode, data.livemode),
        )
      )
      .limit(1);

    return existing[0];
  }

  return result[0];
}
```

---

### customer_merges (P2 - v1.1)

Tracks customer merge operations for audit and potential rollback.

```sql
CREATE TABLE billing_customer_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source and target
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL REFERENCES billing_customers(id),

  -- Strategy used
  subscription_strategy VARCHAR(30) NOT NULL,
  payment_strategy VARCHAR(30) NOT NULL,
  invoice_strategy VARCHAR(30) NOT NULL,
  metadata_strategy VARCHAR(30) NOT NULL,

  -- Results
  moved_subscriptions INTEGER NOT NULL DEFAULT 0,
  moved_payments INTEGER NOT NULL DEFAULT 0,
  moved_invoices INTEGER NOT NULL DEFAULT 0,
  source_deleted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Snapshot of source before merge
  source_snapshot JSONB NOT NULL,

  -- Actor
  merged_by VARCHAR(255) NOT NULL,
  merged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  CONSTRAINT chk_subscription_strategy CHECK (
    subscription_strategy IN ('move_all', 'keep_active_only', 'cancel_source')
  ),
  CONSTRAINT chk_payment_strategy CHECK (
    payment_strategy IN ('move_all', 'keep_reference')
  ),
  CONSTRAINT chk_invoice_strategy CHECK (
    invoice_strategy IN ('move_all', 'keep_on_source', 'void_unpaid')
  ),
  CONSTRAINT chk_metadata_strategy CHECK (
    metadata_strategy IN ('merge', 'target_wins', 'source_wins')
  )
);

CREATE INDEX idx_customer_merges_source ON billing_customer_merges(source_customer_id);
CREATE INDEX idx_customer_merges_target ON billing_customer_merges(target_customer_id);
CREATE INDEX idx_customer_merges_date ON billing_customer_merges(merged_at);

-- Environment isolation index (required for all billable entities)
CREATE INDEX idx_customer_merges_livemode ON billing_customer_merges(livemode);
```

**Drizzle Schema:**

```typescript
export const customerMerges = pgTable('billing_customer_merges', {
  id: uuid('id').primaryKey().defaultRandom(),

  sourceCustomerId: uuid('source_customer_id').notNull(),
  targetCustomerId: uuid('target_customer_id').notNull().references(() => customers.id),

  // Strategy fields - valid values enforced by CHECK constraints in DB
  // subscriptionStrategy: 'move_all' | 'keep_active_only' | 'cancel_source'
  subscriptionStrategy: varchar('subscription_strategy', { length: 30 }).notNull(),
  // paymentStrategy: 'move_all' | 'keep_reference'
  paymentStrategy: varchar('payment_strategy', { length: 30 }).notNull(),
  // invoiceStrategy: 'move_all' | 'keep_on_source' | 'void_unpaid'
  invoiceStrategy: varchar('invoice_strategy', { length: 30 }).notNull(),
  // metadataStrategy: 'merge' | 'target_wins' | 'source_wins'
  metadataStrategy: varchar('metadata_strategy', { length: 30 }).notNull(),

  movedSubscriptions: integer('moved_subscriptions').notNull().default(0),
  movedPayments: integer('moved_payments').notNull().default(0),
  movedInvoices: integer('moved_invoices').notNull().default(0),
  sourceDeleted: boolean('source_deleted').notNull().default(false),

  sourceSnapshot: jsonb('source_snapshot').notNull(),

  mergedBy: varchar('merged_by', { length: 255 }).notNull(),
  mergedAt: timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
});

export type CustomerMerge = typeof customerMerges.$inferSelect;
export type NewCustomerMerge = typeof customerMerges.$inferInsert;
```

---

### plan_versions (P2 - v1.1)

Stores historical versions of plans for grandfathering.

```sql
CREATE TABLE billing_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,

  -- Pricing at this version
  prices JSONB NOT NULL,

  -- Features at this version
  entitlements JSONB NOT NULL,
  limits JSONB NOT NULL,

  -- Change info
  change_type VARCHAR(30) NOT NULL,
  change_description TEXT,

  -- Validity period
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_until TIMESTAMP WITH TIME ZONE,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}',

  CONSTRAINT uq_plan_version UNIQUE (plan_id, version, livemode),
  CONSTRAINT chk_change_type CHECK (
    change_type IN ('price_increase', 'price_decrease', 'feature_add', 'feature_remove', 'mixed', 'initial')
  )
);

CREATE INDEX idx_plan_versions_plan ON billing_plan_versions(plan_id);
CREATE INDEX idx_plan_versions_effective ON billing_plan_versions(plan_id, effective_from);
CREATE INDEX idx_plan_versions_livemode ON billing_plan_versions(livemode);
```

**Drizzle Schema:**

```typescript
export const planVersions = pgTable('billing_plan_versions', {
  id: uuid('id').primaryKey().defaultRandom(),

  planId: varchar('plan_id', { length: 255 }).notNull(),
  version: integer('version').notNull(),

  prices: jsonb('prices').notNull(),
  entitlements: jsonb('entitlements').notNull(),
  limits: jsonb('limits').notNull(),

  changeType: varchar('change_type', { length: 30 }).notNull(),
  changeDescription: text('change_description'),

  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),

  livemode: boolean('livemode').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  metadata: jsonb('metadata').default({}),
});

export type PlanVersion = typeof planVersions.$inferSelect;
export type NewPlanVersion = typeof planVersions.$inferInsert;
```

---

### webhook_records (P2 - v1.1)

Extended webhook tracking for replay capability. Replaces basic webhook_events.

```sql
CREATE TABLE billing_webhook_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider info
  provider VARCHAR(30) NOT NULL,  -- Standardized length across all tables
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,

  -- Payload
  payload JSONB NOT NULL,

  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,

  -- Attempt history
  attempts JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Error info
  last_error TEXT,

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',

  CONSTRAINT uq_webhook_record UNIQUE (provider, provider_event_id, livemode),
  CONSTRAINT chk_webhook_status CHECK (
    status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')
  )
);

CREATE INDEX idx_webhook_records_status ON billing_webhook_records(status);
CREATE INDEX idx_webhook_records_provider ON billing_webhook_records(provider);
CREATE INDEX idx_webhook_records_event_type ON billing_webhook_records(event_type);
CREATE INDEX idx_webhook_records_received ON billing_webhook_records(received_at);
CREATE INDEX idx_webhook_records_dead_letter ON billing_webhook_records(received_at)
  WHERE status = 'dead_letter';
CREATE INDEX idx_webhook_records_retry ON billing_webhook_records(next_retry_at)
  WHERE status IN ('pending', 'failed');
```

**Drizzle Schema:**

```typescript
export const webhookRecords = pgTable('billing_webhook_records', {
  id: uuid('id').primaryKey().defaultRandom(),

  provider: varchar('provider', { length: 30 }).notNull(),  // Standardized
  providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),

  payload: jsonb('payload').notNull(),

  status: varchar('status', { length: 20 }).notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),

  attempts: jsonb('attempts').notNull().default([]),

  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  lastError: text('last_error'),

  livemode: boolean('livemode').notNull().default(true),

  metadata: jsonb('metadata').default({}),
});

export type WebhookRecord = typeof webhookRecords.$inferSelect;
export type NewWebhookRecord = typeof webhookRecords.$inferInsert;
```

---

### event_store (P2 - v1.1)

Event sourcing store for complete audit trail and state replay.

```sql
CREATE TABLE billing_event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Aggregate identification
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id UUID NOT NULL,

  -- Event data
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Versioning for optimistic concurrency
  version INTEGER NOT NULL,

  -- Causation and correlation
  causation_id UUID,
  correlation_id UUID,

  -- Actor
  actor_type VARCHAR(20),
  actor_id VARCHAR(255),

  -- Environment
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_aggregate_version UNIQUE (aggregate_type, aggregate_id, version, livemode)
);

CREATE INDEX idx_event_store_aggregate ON billing_event_store(aggregate_type, aggregate_id);
CREATE INDEX idx_event_store_type ON billing_event_store(event_type);
CREATE INDEX idx_event_store_correlation ON billing_event_store(correlation_id);
CREATE INDEX idx_event_store_created ON billing_event_store(created_at);
CREATE INDEX idx_event_store_livemode ON billing_event_store(livemode);
```

**Drizzle Schema:**

```typescript
export const eventStore = pgTable('billing_event_store', {
  id: uuid('id').primaryKey().defaultRandom(),

  aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),

  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: jsonb('event_data').notNull(),

  metadata: jsonb('metadata').default({}),

  version: integer('version').notNull(),

  causationId: uuid('causation_id'),
  correlationId: uuid('correlation_id'),

  actorType: varchar('actor_type', { length: 20 }),
  actorId: varchar('actor_id', { length: 255 }),

  livemode: boolean('livemode').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type StoredEvent = typeof eventStore.$inferSelect;
export type NewStoredEvent = typeof eventStore.$inferInsert;
```

### Disputes Table (P2 - v1.1)

Tracks payment disputes and chargebacks.

```sql
CREATE TABLE billing_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES billing_payments(id),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),

  amount DECIMAL(19, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

  reason VARCHAR(50) NOT NULL,
  -- Values: fraudulent, duplicate, product_not_received, product_unacceptable,
  --         subscription_canceled, unrecognized, credit_not_processed, general

  status VARCHAR(30) NOT NULL DEFAULT 'opened',
  -- Values: opened, evidence_required, evidence_submitted, won, lost, expired

  evidence_due_by TIMESTAMP WITH TIME ZONE,
  evidence_submitted_at TIMESTAMP WITH TIME ZONE,

  provider_dispute_id VARCHAR(255),
  provider VARCHAR(30),  -- Standardized length across all tables

  metadata JSONB DEFAULT '{}',
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_payment ON billing_disputes(payment_id);
CREATE INDEX idx_disputes_customer ON billing_disputes(customer_id);
CREATE INDEX idx_disputes_status ON billing_disputes(status);
CREATE INDEX idx_disputes_livemode ON billing_disputes(livemode);
CREATE INDEX idx_disputes_currency ON billing_disputes(currency);
```

**Drizzle Schema:**

```typescript
export const disputes = pgTable('billing_disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  amount: decimal('amount', { precision: 19, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),

  reason: varchar('reason', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('opened'),

  evidenceDueBy: timestamp('evidence_due_by', { withTimezone: true }),
  evidenceSubmittedAt: timestamp('evidence_submitted_at', { withTimezone: true }),

  providerDisputeId: varchar('provider_dispute_id', { length: 255 }),
  provider: varchar('provider', { length: 30 }),  // Standardized

  metadata: jsonb('metadata').default({}),
  livemode: boolean('livemode').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Dispute = typeof disputes.$inferSelect;
export type NewDispute = typeof disputes.$inferInsert;
```

### Trial History Table (P2 - v1.1)

Tracks trial usage to prevent abuse.

```sql
CREATE TABLE billing_trial_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id),
  -- Plan identifier (VARCHAR, not UUID FK) - consistent with subscriptions and other tables
  -- This allows tracking trials even if plan is modified/versioned
  plan_id VARCHAR(100) NOT NULL,

  email_hash VARCHAR(64) NOT NULL,
  device_fingerprint VARCHAR(255),
  card_fingerprint VARCHAR(255),
  ip_address VARCHAR(45),

  trial_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_ended_at TIMESTAMP WITH TIME ZONE,
  converted BOOLEAN NOT NULL DEFAULT FALSE,

  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trial_history_email_hash ON billing_trial_history(email_hash, plan_id);
CREATE INDEX idx_trial_history_device ON billing_trial_history(device_fingerprint, plan_id);
CREATE INDEX idx_trial_history_card ON billing_trial_history(card_fingerprint, plan_id);
CREATE INDEX idx_trial_history_customer ON billing_trial_history(customer_id);
CREATE INDEX idx_trial_history_livemode ON billing_trial_history(livemode);
```

**Drizzle Schema:**

```typescript
export const trialHistory = pgTable('billing_trial_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  // Plan identifier (VARCHAR, not UUID FK) - consistent with subscriptions and other tables
  planId: varchar('plan_id', { length: 100 }).notNull(),

  emailHash: varchar('email_hash', { length: 64 }).notNull(),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  cardFingerprint: varchar('card_fingerprint', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),

  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }).notNull(),
  trialEndedAt: timestamp('trial_ended_at', { withTimezone: true }),
  converted: boolean('converted').notNull().default(false),

  livemode: boolean('livemode').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TrialHistory = typeof trialHistory.$inferSelect;
export type NewTrialHistory = typeof trialHistory.$inferInsert;
```

### Promo Code Reservations Table (P2 - v1.1)

Temporary reservations during checkout to prevent race conditions.

```sql
CREATE TABLE billing_promo_code_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES billing_promo_codes(id),
  checkout_session_id UUID NOT NULL,

  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  redeemed BOOLEAN NOT NULL DEFAULT FALSE,

  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_reservation_checkout UNIQUE (checkout_session_id)
);

CREATE INDEX idx_promo_reservations_code ON billing_promo_code_reservations(promo_code_id);
CREATE INDEX idx_promo_reservations_expires ON billing_promo_code_reservations(expires_at);
CREATE INDEX idx_promo_reservations_livemode ON billing_promo_code_reservations(livemode);
```

**Drizzle Schema:**

```typescript
export const promoCodeReservations = pgTable('billing_promo_code_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id),
  checkoutSessionId: uuid('checkout_session_id').notNull().unique(),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  redeemed: boolean('redeemed').notNull().default(false),

  livemode: boolean('livemode').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCodeReservation = typeof promoCodeReservations.$inferSelect;
export type NewPromoCodeReservation = typeof promoCodeReservations.$inferInsert;
```

### Webhook Processing Table (P2 - v1.1)

Tracks webhook processing for idempotency, replay attack protection, and concurrency control.

#### Replay Attack Protection

This table implements a multi-layer defense against webhook replay attacks:

| Layer | Protection | Implementation |
|-------|------------|----------------|
| 1. Timestamp validation | Reject stale webhooks | `webhook_timestamp` checked against 5-minute window |
| 2. Idempotency | Prevent duplicate processing | `webhook_id` UNIQUE constraint |
| 3. Concurrency lock | Prevent race conditions | `started_at` + `completed_at` check |

**Replay Window Configuration:**

```typescript
// packages/core/src/config/security.ts

export const WebhookSecurityConfig = {
  /** Maximum age of webhook timestamp (seconds). Webhooks older than this are rejected. */
  REPLAY_WINDOW_SECONDS: 300, // 5 minutes (industry standard)

  /** Maximum time to wait for a webhook to finish processing before considering it stuck */
  PROCESSING_TIMEOUT_SECONDS: 60,

  /** Retain processed webhooks for this duration (for debugging) */
  RETENTION_HOURS: 168, // 7 days
} as const;
```

**Concurrent Webhook Handling:**

When the same webhook arrives multiple times simultaneously:

```sql
-- Atomic insert with conflict handling
INSERT INTO billing_webhook_processing (webhook_id, provider, webhook_timestamp, started_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (webhook_id) DO NOTHING
RETURNING id;

-- If RETURNING is empty, webhook is already being processed or was processed
-- Check status:
SELECT id, started_at, completed_at, success
FROM billing_webhook_processing
WHERE webhook_id = $1;

-- If completed_at IS NULL AND started_at < NOW() - INTERVAL '60 seconds':
--   Processing is stuck, can retry
-- If completed_at IS NOT NULL AND success = TRUE:
--   Already processed successfully, skip
-- If completed_at IS NOT NULL AND success = FALSE:
--   Previous attempt failed, can retry
```

```sql
CREATE TABLE billing_webhook_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(30) NOT NULL,  -- Standardized length across all tables

  -- Replay attack protection: store original webhook timestamp
  webhook_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN,
  error TEXT,

  result_data JSONB,

  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint: webhook_timestamp must be within replay window
  CONSTRAINT chk_webhook_timestamp_valid CHECK (
    webhook_timestamp >= created_at - INTERVAL '5 minutes'
  )
);

CREATE INDEX idx_webhook_processing_webhook ON billing_webhook_processing(webhook_id);
CREATE INDEX idx_webhook_processing_started ON billing_webhook_processing(started_at);
CREATE INDEX idx_webhook_processing_livemode ON billing_webhook_processing(livemode);
-- Index for cleanup job (find old completed webhooks)
CREATE INDEX idx_webhook_processing_cleanup ON billing_webhook_processing(created_at)
  WHERE completed_at IS NOT NULL;
```

**Drizzle Schema:**

```typescript
export const webhookProcessing = pgTable('billing_webhook_processing', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: varchar('webhook_id', { length: 255 }).notNull().unique(),
  provider: varchar('provider', { length: 30 }).notNull(),  // Standardized

  // Replay attack protection: original webhook timestamp from provider
  webhookTimestamp: timestamp('webhook_timestamp', { withTimezone: true }).notNull(),

  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  success: boolean('success'),
  error: text('error'),

  resultData: jsonb('result_data'),

  livemode: boolean('livemode').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookProcessing = typeof webhookProcessing.$inferSelect;
export type NewWebhookProcessing = typeof webhookProcessing.$inferInsert;
```

### Data Integrity Constraints (P2 - v1.1)

CHECK constraints and triggers for data consistency.

#### Column Reference for Constraints

**IMPORTANT**: Use the correct column names from the table definitions. Common mistakes:

| Table | ❌ Wrong Column | ✅ Correct Column | Notes |
|-------|-----------------|-------------------|-------|
| `billing_invoices` | `amount` | `total` | Invoice total amount |
| `billing_invoices` | `amount_due` | `amount_remaining` | Generated column: `total - amount_paid` |
| `billing_promo_codes` | `max_redemptions` | `max_uses` | Max times code can be used |
| `billing_promo_codes` | `times_redeemed` | `used_count` | Current usage count |
| `billing_promo_codes` | `discount_type` | `type` | Discount type constant |
| `billing_promo_codes` | `discount_value` | `value` | Discount amount/percentage |

```sql
-- Ensure payment's customer_id matches subscription's customer_id
CREATE OR REPLACE FUNCTION validate_payment_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM billing_subscriptions
      WHERE id = NEW.subscription_id
      AND customer_id = NEW.customer_id
    ) THEN
      RAISE EXCEPTION 'Payment customer_id does not match subscription customer_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_payment_customer
BEFORE INSERT OR UPDATE ON billing_payments
FOR EACH ROW EXECUTE FUNCTION validate_payment_customer();

-- Ensure invoice amounts are non-negative
-- Note: amount_remaining is a GENERATED column, no need to check it directly
ALTER TABLE billing_invoices
ADD CONSTRAINT chk_invoice_positive_amounts
CHECK (
  subtotal >= 0 AND
  total >= 0 AND
  amount_paid >= 0 AND
  discount >= 0 AND
  tax >= 0
);

-- Ensure subscription dates are logical
ALTER TABLE billing_subscriptions
ADD CONSTRAINT chk_subscription_dates
CHECK (
  current_period_end > current_period_start
  AND (trial_end IS NULL OR trial_end >= trial_start)
);

-- Ensure promo code usage doesn't exceed max
-- Columns: max_uses (nullable), used_count (default 0)
ALTER TABLE billing_promo_codes
ADD CONSTRAINT chk_promo_usage_limit
CHECK (
  max_uses IS NULL
  OR used_count <= max_uses
);

-- Ensure payment amount matches currency precision
ALTER TABLE billing_payments
ADD CONSTRAINT chk_payment_amount_precision
CHECK (amount = ROUND(amount, 2));
```

---

## 1.14 High-Volume Table Index Strategy

High-volume tables require careful index strategy to balance write performance with query speed. This section defines indexing patterns for tables expected to grow beyond 10M rows.

### Index Strategy by Table Size

| Table Size | Index Approach | Maintenance Window | Reindex Frequency |
|------------|----------------|-------------------|-------------------|
| < 1M rows | Standard B-tree | Not required | Never |
| 1M - 10M rows | Partial indexes | Weekly | Monthly |
| 10M - 100M rows | Partitioned + covering | Nightly | Per-partition |
| > 100M rows | Partitioned + BRIN | Continuous | Automated |

### High-Volume Tables Index Definitions

#### billing_audit_logs (Expected: 1M+ rows/month)

```sql
-- Primary access patterns:
-- 1. Entity lookup: "Show audit history for subscription X"
-- 2. Actor lookup: "Show all actions by user Y"
-- 3. Time-range: "Show all audits in last 24 hours"
-- 4. Request correlation: "Show all audits for request Z"

-- BRIN index for time-based queries (efficient for append-only tables)
-- BRIN indexes store min/max values per block range, ideal for ordered inserts
CREATE INDEX idx_audit_logs_created_brin
ON billing_audit_logs USING brin(created_at)
WITH (pages_per_range = 128);

-- Partial index for entity lookup (most common query)
CREATE INDEX idx_audit_logs_entity_recent
ON billing_audit_logs(entity_type, entity_id, created_at DESC)
WHERE created_at > NOW() - INTERVAL '90 days';

-- Expression index for actor lookups (avoids NULL scans)
CREATE INDEX idx_audit_logs_actor_actions
ON billing_audit_logs(actor_id, action, created_at DESC)
WHERE actor_id IS NOT NULL;

-- Partial index for HTTP request correlation
CREATE INDEX idx_audit_logs_request
ON billing_audit_logs(request_id)
WHERE request_id IS NOT NULL;
```

#### billing_webhook_events (Expected: 500K+ rows/month)

```sql
-- Primary access patterns:
-- 1. Provider + event_id lookup (idempotency check)
-- 2. Unprocessed events (retry job)
-- 3. Failed events (admin investigation)
-- 4. Time-range analytics

-- Unique constraint on provider event (idempotency)
CREATE UNIQUE INDEX idx_webhook_events_provider_event_unique
ON billing_webhook_events(provider, provider_event_id)
WHERE processed = false;

-- Partial index for unprocessed events (retry job)
CREATE INDEX idx_webhook_events_unprocessed
ON billing_webhook_events(created_at, retry_count)
WHERE processed = false AND retry_count < 5;

-- Partial index for failed events requiring investigation
CREATE INDEX idx_webhook_events_failed
ON billing_webhook_events(created_at DESC)
WHERE status = 'failed' AND retry_count >= 5;

-- BRIN for time-range analytics
CREATE INDEX idx_webhook_events_created_brin
ON billing_webhook_events USING brin(created_at)
WITH (pages_per_range = 128);
```

#### billing_usage_records (Expected: 1M+ rows/month)

```sql
-- Primary access patterns:
-- 1. Subscription + period lookup (billing calculation)
-- 2. Unbilled records (invoice generation job)
-- 3. Customer usage reporting
-- 4. Feature usage analytics

-- Composite index for billing calculation (most critical query)
CREATE INDEX idx_usage_records_billing
ON billing_usage_records(subscription_id, period_start, period_end, billed)
INCLUDE (quantity, feature_key)
WHERE deleted_at IS NULL;

-- Partial index for unbilled records (invoice job)
CREATE INDEX idx_usage_records_unbilled
ON billing_usage_records(period_end)
INCLUDE (subscription_id, feature_key, quantity)
WHERE billed = false AND deleted_at IS NULL;

-- Customer-level usage (reporting dashboard)
CREATE INDEX idx_usage_records_customer
ON billing_usage_records(customer_id, period_start DESC)
INCLUDE (feature_key, quantity)
WHERE deleted_at IS NULL;
```

#### billing_payments (Expected: 100K+ rows/month)

```sql
-- Primary access patterns:
-- 1. Customer payment history
-- 2. Failed payments for retry
-- 3. Provider reconciliation
-- 4. Revenue reporting

-- Covering index for customer history (avoid heap access)
CREATE INDEX idx_payments_customer_history
ON billing_payments(customer_id, created_at DESC)
INCLUDE (id, amount, currency, status, provider, provider_payment_id)
WHERE deleted_at IS NULL;

-- Partial index for retry job (only failed payments with scheduled retry)
CREATE INDEX idx_payments_retry_pending
ON billing_payments(next_retry_at)
INCLUDE (id, customer_id, amount, retry_count)
WHERE status = 'failed'
  AND next_retry_at IS NOT NULL
  AND retry_count < 5
  AND deleted_at IS NULL;

-- Provider reconciliation (lookup by external ID)
CREATE INDEX idx_payments_provider_lookup
ON billing_payments(provider, provider_payment_id)
WHERE deleted_at IS NULL;
```

### Index Maintenance Strategy

```sql
-- Automated reindex for heavily updated tables
-- Run during low-traffic window (e.g., 3 AM UTC)

-- Function to reindex with minimal locking
CREATE OR REPLACE FUNCTION reindex_concurrently_safe(
  p_index_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
  v_index_def TEXT;
BEGIN
  -- Get original index definition
  SELECT pg_get_indexdef(i.oid), t.relname
  INTO v_index_def, v_table_name
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class t ON t.oid = x.indrelid
  WHERE i.relname = p_index_name;

  IF v_index_def IS NULL THEN
    RAISE EXCEPTION 'Index % not found', p_index_name;
  END IF;

  -- Create new index with temporary name
  EXECUTE regexp_replace(
    v_index_def,
    'CREATE (UNIQUE )?INDEX ' || p_index_name,
    'CREATE \1INDEX CONCURRENTLY ' || p_index_name || '_new'
  );

  -- Drop old index concurrently
  EXECUTE 'DROP INDEX CONCURRENTLY IF EXISTS ' || p_index_name;

  -- Rename new index to original name
  EXECUTE 'ALTER INDEX ' || p_index_name || '_new RENAME TO ' || p_index_name;
END;
$$ LANGUAGE plpgsql;

-- Weekly maintenance job configuration
-- Run: SELECT reindex_concurrently_safe('idx_payments_retry_pending');
```

### Index Monitoring Queries

```sql
-- Find unused indexes (candidates for removal)
SELECT
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find missing indexes (table scans on large tables)
SELECT
  schemaname || '.' || relname AS table_name,
  seq_scan AS sequential_scans,
  seq_tup_read AS rows_fetched_by_seq_scan,
  idx_scan AS index_scans,
  n_live_tup AS estimated_row_count,
  CASE
    WHEN seq_scan > 0 THEN seq_tup_read / seq_scan
    ELSE 0
  END AS avg_rows_per_seq_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > 100
  AND n_live_tup > 10000
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Index bloat estimation
SELECT
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE
    WHEN avg_leaf_density > 0 THEN
      ROUND((1 - avg_leaf_density / 90.0) * 100, 1)
    ELSE 0
  END AS estimated_bloat_percent
FROM pg_stat_user_indexes psi
LEFT JOIN pg_catalog.pg_statio_user_indexes psui
  ON psi.indexrelid = psui.indexrelid
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

### Drizzle Index Pattern for High-Volume Tables

```typescript
// packages/drizzle/src/schema/indexes/high-volume.ts

import { sql } from 'drizzle-orm';

/**
 * High-volume index definitions.
 * These require raw SQL as Drizzle doesn't support:
 * - BRIN indexes
 * - Partial indexes with complex WHERE clauses
 * - INCLUDE columns
 */
export const highVolumeIndexMigrations = sql`
  -- Run during initial setup or as needed

  -- Audit logs BRIN (for time-range queries)
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin
  ON billing_audit_logs USING brin(created_at)
  WITH (pages_per_range = 128);

  -- Usage records billing index
  CREATE INDEX IF NOT EXISTS idx_usage_records_billing
  ON billing_usage_records(subscription_id, period_start, period_end, billed)
  INCLUDE (quantity, feature_key)
  WHERE deleted_at IS NULL;

  -- Payments retry job index
  CREATE INDEX IF NOT EXISTS idx_payments_retry_pending
  ON billing_payments(next_retry_at)
  INCLUDE (id, customer_id, amount, retry_count)
  WHERE status = 'failed'
    AND next_retry_at IS NOT NULL
    AND retry_count < 5
    AND deleted_at IS NULL;
`;
```

---

### Covering Indexes (P2 - v1.1)

Optimized indexes for frequent query patterns using INCLUDE clause.

```sql
-- Subscription Queries

-- Active subscriptions by customer (most common query)
CREATE INDEX idx_subscriptions_customer_status_covering
ON billing_subscriptions(customer_id, status)
INCLUDE (id, plan_id, current_period_start, current_period_end, quantity)
WHERE deleted_at IS NULL;

-- Subscriptions expiring soon (renewal job)
CREATE INDEX idx_subscriptions_period_end_covering
ON billing_subscriptions(current_period_end)
INCLUDE (id, customer_id, plan_id, status)
WHERE status IN ('active', 'trialing') AND deleted_at IS NULL;

-- Trial ending soon
CREATE INDEX idx_subscriptions_trial_end_covering
ON billing_subscriptions(trial_end)
INCLUDE (id, customer_id, plan_id, status)
WHERE status = 'trialing' AND trial_end IS NOT NULL AND deleted_at IS NULL;

-- Invoice Queries

-- Customer invoices (billing history)
-- Columns: total (invoice total), amount_remaining (generated: total - amount_paid)
CREATE INDEX idx_invoices_customer_covering
ON billing_invoices(customer_id, created_at DESC)
INCLUDE (id, total, amount_remaining, status, currency, due_date)
WHERE deleted_at IS NULL;

-- Unpaid invoices (collection job)
-- Columns: amount_remaining (generated column showing unpaid amount)
CREATE INDEX idx_invoices_unpaid_covering
ON billing_invoices(due_date)
INCLUDE (id, customer_id, amount_remaining, currency, subscription_id)
WHERE status IN ('open', 'partially_paid') AND deleted_at IS NULL;

-- Payment Queries

-- Customer payment history
CREATE INDEX idx_payments_customer_covering
ON billing_payments(customer_id, created_at DESC)
INCLUDE (id, amount, currency, status, provider)
WHERE deleted_at IS NULL;

-- Pending payments (reconciliation)
CREATE INDEX idx_payments_pending_covering
ON billing_payments(created_at)
INCLUDE (id, customer_id, amount, provider, provider_payment_id)
WHERE status = 'pending' AND deleted_at IS NULL;

-- Promo Code Queries

-- Active promo codes lookup
-- Columns: type (discount type), value (discount value), max_uses, used_count
CREATE INDEX idx_promo_codes_active_covering
ON billing_promo_codes(code)
INCLUDE (id, type, value, max_uses, used_count, expires_at)
WHERE active = true;
```

---

## TypeScript Types

```typescript
// packages/core/src/types/entities.ts

export interface QZPayCustomer {
  id: string;
  externalId: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  mpCustomerId?: string;
  preferredLanguage?: QZPayLocale;
  livemode: boolean;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface QZPaySubscription {
  id: string;
  customerId: string;
  planId: string;
  status: QZPaySubscriptionStatus;
  billingInterval: QZPayBillingInterval;
  intervalCount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;

  // Trial conversion tracking
  trialConverted: boolean;
  trialConvertedAt?: Date;

  canceledAt?: Date;
  cancelAt?: Date;
  endedAt?: Date;
  isFree: boolean;
  freeReason?: string;
  freeExpiresAt?: Date;
  promoCodeId?: string;
  stripeSubscriptionId?: string;
  mpSubscriptionId?: string;

  // Pause/Resume fields
  pausedAt?: Date;
  pauseUntil?: Date;
  pauseReason?: string;
  pauseCount: number;
  retainAccessDuringPause: boolean;

  // Per-Seat Pricing
  quantity: number;

  // Environment
  livemode: boolean;

  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type QZPaySubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired'
  | 'unpaid';

export type QZPayBillingInterval =
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

export interface QZPayPayment {
  id: string;
  customerId: string;
  subscriptionId?: string;
  // Note: Linked to invoices through QZPayInvoicePayment (N:N)
  amount: number;
  currency: string;
  baseAmount: number;
  baseCurrency: string;
  exchangeRate?: number;
  exchangeRateSource?: string;
  exchangeRateDate?: Date;
  status: QZPayPaymentStatus;
  provider: QZPayPaymentProvider;
  providerPaymentId?: string;
  providerCheckoutId?: string;
  refundedAmount: number;
  failureReason?: string;
  retryCount: number;
  nextRetryAt?: Date;
  amountApplied: number;
  amountAvailable: number; // Computed: amount - amountApplied - refundedAmount
  vendorId?: string;
  vendorAmount?: number;
  platformFee?: number;
  livemode: boolean;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type QZPayPaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type QZPayPaymentProvider =
  | 'stripe'
  | 'mercadopago'
  | 'bank_transfer';

export interface QZPayInvoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  // Note: Linked to payments through QZPayInvoicePayment (N:N)
  number: string;
  status: QZPayInvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  amountPaid: number;
  amountRemaining: number; // Computed: total - amountPaid
  lineItems: QZPayInvoiceLineItem[];
  dueDate?: Date;
  paidAt?: Date;
  billingAddress?: QZPayAddress;
  notes?: string;
  livemode: boolean;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type QZPayInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'partially_paid'
  | 'void'
  | 'uncollectible';

/**
 * Junction entity for N:N relationship between invoices and payments.
 * Supports partial payments and payments covering multiple invoices.
 */
export interface QZPayInvoicePayment {
  id: string;
  invoiceId: string;
  paymentId: string;
  amountApplied: number;
  currency: string;
  appliedAt: Date;
}

/**
 * Currency reference entity (ISO 4217)
 */
export interface QZPayCurrency {
  code: string;
  name: string;
  minorUnits: number;
  symbol?: string;
  active: boolean;
}

export interface QZPayInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  metadata?: Record<string, unknown>;
}

export interface QZPayPromoCode {
  id: string;
  code: string;
  type: QZPayPromoCodeTypeType; // Use type from QZPayPromoCodeType constant
  value: number;
  config: Record<string, unknown>;
  maxUses?: number;
  usedCount: number;
  maxUsesPerCustomer?: number;
  validPlans?: string[];
  newCustomersOnly: boolean;
  existingCustomersOnly: boolean;
  startsAt?: Date;
  expiresAt?: Date;
  combinable: boolean;
  livemode: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Types derived from constants (see ARCHITECTURE.md for constant definitions)
export type QZPayPromoCodeTypeType = typeof QZPayPromoCodeType[keyof typeof QZPayPromoCodeType];
// Valid values: 'percentage' | 'fixed_amount' | 'free_period' | 'reduced_period' | 'trial_extension'

export type QZPayAutomaticDiscountTypeType = typeof QZPayAutomaticDiscountType[keyof typeof QZPayAutomaticDiscountType];
// Valid values: 'percentage' | 'fixed_amount' | 'free_period' | 'reduced_period' | 'volume' | 'amount_threshold' | 'free_shipping'

/**
 * Condition types for automatic discounts.
 * V1: Each discount has exactly ONE condition. AND/OR combinations planned for future.
 * See PDR Section 3.6.2 for full specification.
 */
export type QZPayDiscountCondition =
  // Cart/Purchase conditions
  | { type: 'MIN_AMOUNT'; minAmount: number }          // Minimum purchase amount in cents
  | { type: 'MIN_QUANTITY'; minQuantity: number }      // Minimum total items
  | { type: 'SPECIFIC_PRODUCTS'; productIds: string[] }
  | { type: 'SPECIFIC_CATEGORIES'; categoryIds: string[] }
  // Customer conditions
  | { type: 'FIRST_PURCHASE' }                         // Customer's first purchase ever
  | { type: 'CUSTOMER_SEGMENTS'; segments: string[] }  // Customer belongs to segment
  | { type: 'CUSTOMER_TENURE'; minDays: number }       // Customer account age in days
  // Subscription conditions
  | { type: 'BILLING_INTERVAL'; interval: 'month' | 'year' }
  | { type: 'SPECIFIC_PLANS'; planIds: string[] }
  // Time-based conditions
  | { type: 'DATE_RANGE'; startsAt: Date; endsAt: Date }
  | { type: 'SCHEDULE'; days: string[]; startHour: number; endHour: number; timezone: string }
  | { type: 'DAY_OF_WEEK'; days: string[] };

/**
 * Selection strategy for automatic discounts.
 * Determines which discount applies when multiple qualify.
 */
export const QZPayDiscountSelectionStrategy = {
  FIRST_MATCH: 'first_match',           // First by creation order (default)
  BEST_FOR_CUSTOMER: 'best_for_customer', // Highest savings wins
  HIGHEST_PRIORITY: 'highest_priority', // Lowest priority number wins
} as const;

export type QZPayDiscountSelectionStrategyType = typeof QZPayDiscountSelectionStrategy[keyof typeof QZPayDiscountSelectionStrategy];

/**
 * Automatic Discount - Rule-based discount applied automatically when conditions are met.
 * V1: One condition per discount, max 1 automatic discount per transaction.
 * Can stack with ONE promo code.
 * See PDR Section 3.6.2 for full specification.
 */
export interface QZPayAutomaticDiscount {
  id: string;
  name: string;
  description?: string;
  type: QZPayAutomaticDiscountTypeType;
  value: number;  // Percentage (0-100) or fixed amount in cents

  /**
   * Single condition that triggers this discount.
   * V1 Limitation: One condition per discount.
   */
  condition: QZPayDiscountCondition;

  /**
   * Priority for HIGHEST_PRIORITY selection strategy.
   * Lower = higher priority (1 beats 10). Default: 100.
   */
  priority: number;

  // Usage limits
  maxTotalUses?: number;
  usedCount: number;
  maxUsesPerCustomer?: number;

  // Validity period
  startsAt?: Date;
  expiresAt?: Date;

  livemode: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QZPayVendor {
  id: string;
  externalId: string;
  email: string;
  name: string;
  commissionRate: number;
  paymentMode: 'connect' | 'transfer';
  stripeConnectAccountId?: string;
  mpMerchantId?: string;
  onboardingStatus: QZPayVendorOnboardingStatus;
  canReceivePayments: boolean;
  bankAccount?: QZPayBankAccount;
  payoutSchedule: string;
  livemode: boolean;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type QZPayVendorOnboardingStatus =
  | 'pending'
  | 'in_progress'
  | 'complete'
  | 'restricted';

export interface QZPayVendorPayout {
  id: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: QZPayPayoutStatus;
  provider: string;
  providerPayoutId?: string;
  paidAt?: Date;
  failureReason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type QZPayPayoutStatus =
  | 'pending'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'canceled';

export interface QZPayPaymentMethod {
  id: string;
  customerId: string;
  provider: string;
  providerPaymentMethodId: string;
  type: QZPayPaymentMethodType;
  lastFour?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type QZPayPaymentMethodType =
  | 'card'
  | 'bank_account'
  | 'debit_card'
  | 'wallet';

export interface QZPayAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: 'system' | 'admin' | 'customer' | 'webhook';
  actorId: string;
  changes?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface QZPayWebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

/**
 * Job execution status values (must match SQL CHECK constraint chk_job_status).
 * - running: Job is currently executing
 * - success: Job completed without errors (all items processed successfully)
 * - failed: Job failed completely (fatal error, no items processed)
 * - partial: Job completed but with some errors (e.g., 950/1000 items OK)
 * - cancelled: Job was manually cancelled or timed out
 */
export type QZPayJobStatus = 'running' | 'success' | 'failed' | 'partial' | 'cancelled';

export interface QZPayJobExecution {
  id: string;
  jobName: string;
  status: QZPayJobStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  itemsProcessed: number;
  itemsFailed: number;
  itemsSkipped: number;
  error?: string;
  triggeredBy: 'scheduler' | 'manual' | 'api' | 'webhook';
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════
// ADDITIONAL STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Credit note status values (must match SQL CHECK constraint chk_credit_note_status).
 * - draft: Credit note created but not yet issued to customer
 * - issued: Credit note issued and available to apply
 * - applied: Credit note fully applied to invoice(s)
 * - partially_applied: Credit note partially used, remaining_amount > 0
 * - void: Credit note cancelled/voided (cannot be used)
 */
export type QZPayCreditNoteStatus = 'draft' | 'issued' | 'applied' | 'partially_applied' | 'void';

/**
 * Subscription addon status values (must match SQL CHECK constraint chk_addon_status).
 * - active: Addon is currently active on the subscription
 * - removed: Addon was removed from subscription (soft delete, keeps history)
 * - pending: Addon scheduled to be added (e.g., starts next billing cycle)
 */
export type QZPayAddonStatus = 'active' | 'removed' | 'pending';

/**
 * Export job status values (must match SQL CHECK constraint chk_export_status).
 * - pending: Export job queued, waiting to start
 * - processing: Export job currently running
 * - completed: Export finished successfully, file available
 * - failed: Export failed, check error_message for details
 */
export type QZPayExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Dispute status values (must match SQL CHECK constraint on disputes).
 * - opened: Dispute initiated by customer/bank
 * - evidence_required: Platform must submit evidence by deadline
 * - evidence_submitted: Evidence uploaded, awaiting decision
 * - won: Dispute resolved in merchant's favor
 * - lost: Dispute resolved in customer's favor (funds returned)
 * - expired: Evidence deadline passed without submission
 */
export type QZPayDisputeStatus = 'opened' | 'evidence_required' | 'evidence_submitted' | 'won' | 'lost' | 'expired';

/**
 * Audit log status values (must match SQL CHECK constraint chk_audit_status).
 * - success: Operation completed successfully
 * - failed: Operation failed (error logged)
 */
export type QZPayAuditStatus = 'success' | 'failed';

/**
 * Webhook delivery status values (must match SQL CHECK constraint chk_delivery_status).
 * - pending: Delivery queued, waiting for first attempt
 * - delivering: Currently attempting delivery
 * - delivered: Successfully delivered (2xx response)
 * - failed: Delivery failed, will retry if attempts remaining
 * - exhausted: All retry attempts exhausted, moved to dead letter
 */
export type QZPayWebhookDeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'exhausted';

/**
 * Webhook processing record status (must match SQL CHECK constraint chk_webhook_status).
 * - pending: Webhook received, queued for processing
 * - processing: Currently being processed
 * - processed: Successfully processed
 * - failed: Processing failed, will retry if attempts remaining
 * - dead_letter: All retries exhausted, requires manual intervention
 */
export type QZPayWebhookRecordStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';

/**
 * Event queue status values (must match SQL CHECK constraint chk_event_queue_status).
 * - pending: Event queued, waiting for processing
 * - processing: Event currently being processed
 * - completed: Event processed successfully
 * - failed: Event processing failed, will retry
 * - dead_letter: All retries exhausted, requires manual review
 */
export type QZPayEventQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

/**
 * Idempotency key status values (must match SQL CHECK constraint chk_idempotency_status).
 * - pending: Request in progress, prevents duplicate submission
 * - completed: Request completed successfully
 * - failed: Request failed, can be retried with same key
 */
export type QZPayIdempotencyStatus = 'pending' | 'completed' | 'failed';

// ═══════════════════════════════════════════════════════════════════════
// STATUS TRANSITION VALIDATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Valid status transitions for each entity.
 * Used by application-layer validation to prevent invalid state changes.
 * Format: { [currentStatus]: [allowedNextStatuses] }
 */

/**
 * Subscription status transitions.
 * Key business rules:
 * - Cannot go back to 'incomplete' once past it
 * - 'canceled' and 'expired' are terminal states
 * - 'past_due' can recover to 'active' on successful payment
 */
export const SUBSCRIPTION_STATUS_TRANSITIONS: Record<QZPaySubscriptionStatus, QZPaySubscriptionStatus[]> = {
  incomplete: ['incomplete_expired', 'active', 'trialing', 'canceled'],
  incomplete_expired: [], // Terminal state
  trialing: ['trial_expired', 'active', 'canceled', 'past_due'],
  trial_expired: ['active', 'canceled'], // Can convert or cancel
  active: ['past_due', 'paused', 'canceled', 'expired'],
  past_due: ['active', 'canceled', 'unpaid'], // Can recover or fail
  paused: ['active', 'canceled'], // Resume or cancel
  canceled: [], // Terminal state
  expired: [], // Terminal state
  unpaid: ['active', 'canceled'], // Can recover with payment or cancel
};

/**
 * Payment status transitions.
 * Key business rules:
 * - 'succeeded' can only go to refund states
 * - 'failed' is terminal (create new payment to retry)
 * - 'refunded' is terminal
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<QZPayPaymentStatus, QZPayPaymentStatus[]> = {
  pending: ['processing', 'succeeded', 'failed'],
  processing: ['succeeded', 'failed'],
  succeeded: ['refunded', 'partially_refunded'],
  failed: [], // Terminal state - create new payment
  refunded: [], // Terminal state
  partially_refunded: ['refunded'], // Can complete the refund
};

/**
 * Invoice status transitions.
 * Key business rules:
 * - 'draft' must go to 'open' before payment
 * - 'void' is terminal
 * - 'uncollectible' can be recovered if customer pays
 */
export const INVOICE_STATUS_TRANSITIONS: Record<QZPayInvoiceStatus, QZPayInvoiceStatus[]> = {
  draft: ['open', 'void'],
  open: ['paid', 'partially_paid', 'void', 'uncollectible'],
  partially_paid: ['paid', 'void', 'uncollectible'],
  paid: [], // Terminal state
  void: [], // Terminal state
  uncollectible: ['paid', 'partially_paid'], // Can recover
};

/**
 * Credit note status transitions.
 * Key business rules:
 * - Must be 'issued' before it can be applied
 * - 'void' is terminal
 * - 'applied' is terminal (fully used)
 */
export const CREDIT_NOTE_STATUS_TRANSITIONS: Record<QZPayCreditNoteStatus, QZPayCreditNoteStatus[]> = {
  draft: ['issued', 'void'],
  issued: ['applied', 'partially_applied', 'void'],
  partially_applied: ['applied', 'void'],
  applied: [], // Terminal state - fully used
  void: [], // Terminal state
};

/**
 * Vendor payout status transitions.
 * Key business rules:
 * - Linear progression with failure branch
 * - 'paid' and 'canceled' are terminal
 */
export const PAYOUT_STATUS_TRANSITIONS: Record<QZPayPayoutStatus, QZPayPayoutStatus[]> = {
  pending: ['in_transit', 'failed', 'canceled'],
  in_transit: ['paid', 'failed'],
  paid: [], // Terminal state
  failed: ['pending'], // Can retry
  canceled: [], // Terminal state
};

/**
 * Dispute status transitions.
 * Key business rules:
 * - Must submit evidence before deadline
 * - 'won', 'lost', 'expired' are terminal
 */
export const DISPUTE_STATUS_TRANSITIONS: Record<QZPayDisputeStatus, QZPayDisputeStatus[]> = {
  opened: ['evidence_required', 'won', 'lost'],
  evidence_required: ['evidence_submitted', 'expired'],
  evidence_submitted: ['won', 'lost'],
  won: [], // Terminal state
  lost: [], // Terminal state
  expired: [], // Terminal state
};

/**
 * Vendor onboarding status transitions.
 * Key business rules:
 * - Linear progression with possible restriction
 * - 'complete' can become 'restricted' if issues arise
 */
export const VENDOR_ONBOARDING_TRANSITIONS: Record<QZPayVendorOnboardingStatus, QZPayVendorOnboardingStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['complete', 'restricted'],
  complete: ['restricted'], // Can be restricted after completion
  restricted: ['complete'], // Can be unrestricted
};

// ═══════════════════════════════════════════════════════════════════════
// STATUS TRANSITION VALIDATORS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generic status transition validator.
 * Use this to validate status changes before updating the database.
 *
 * @param transitions - The allowed transitions map for the entity type
 * @param currentStatus - The current status value
 * @param newStatus - The proposed new status value
 * @param entityType - Entity name for error messages (e.g., 'subscription', 'invoice')
 * @throws Error if the transition is not allowed
 *
 * @example
 * ```typescript
 * // Before updating an invoice status:
 * validateStatusTransition(
 *   INVOICE_STATUS_TRANSITIONS,
 *   invoice.status,
 *   'paid',
 *   'invoice'
 * );
 * // Throws if current status doesn't allow transition to 'paid'
 * ```
 */
export function validateStatusTransition<T extends string>(
  transitions: Record<T, T[]>,
  currentStatus: T,
  newStatus: T,
  entityType: string
): void {
  // Same status is always allowed (no-op)
  if (currentStatus === newStatus) {
    return;
  }

  const allowedTransitions = transitions[currentStatus];

  if (!allowedTransitions) {
    throw new Error(
      `Invalid ${entityType} status: '${currentStatus}' is not a valid status value`
    );
  }

  if (!allowedTransitions.includes(newStatus)) {
    const allowed = allowedTransitions.length > 0
      ? allowedTransitions.join(', ')
      : 'none (terminal state)';

    throw new Error(
      `Invalid ${entityType} status transition: cannot change from '${currentStatus}' to '${newStatus}'. ` +
      `Allowed transitions from '${currentStatus}': ${allowed}`
    );
  }
}

/**
 * Convenience validators for each entity type.
 * These provide type-safe validation with clear error messages.
 */

export function validateSubscriptionStatusTransition(
  currentStatus: QZPaySubscriptionStatus,
  newStatus: QZPaySubscriptionStatus
): void {
  validateStatusTransition(SUBSCRIPTION_STATUS_TRANSITIONS, currentStatus, newStatus, 'subscription');
}

export function validatePaymentStatusTransition(
  currentStatus: QZPayPaymentStatus,
  newStatus: QZPayPaymentStatus
): void {
  validateStatusTransition(PAYMENT_STATUS_TRANSITIONS, currentStatus, newStatus, 'payment');
}

export function validateInvoiceStatusTransition(
  currentStatus: QZPayInvoiceStatus,
  newStatus: QZPayInvoiceStatus
): void {
  validateStatusTransition(INVOICE_STATUS_TRANSITIONS, currentStatus, newStatus, 'invoice');
}

export function validateCreditNoteStatusTransition(
  currentStatus: QZPayCreditNoteStatus,
  newStatus: QZPayCreditNoteStatus
): void {
  validateStatusTransition(CREDIT_NOTE_STATUS_TRANSITIONS, currentStatus, newStatus, 'credit note');
}

export function validatePayoutStatusTransition(
  currentStatus: QZPayPayoutStatus,
  newStatus: QZPayPayoutStatus
): void {
  validateStatusTransition(PAYOUT_STATUS_TRANSITIONS, currentStatus, newStatus, 'payout');
}

export function validateDisputeStatusTransition(
  currentStatus: QZPayDisputeStatus,
  newStatus: QZPayDisputeStatus
): void {
  validateStatusTransition(DISPUTE_STATUS_TRANSITIONS, currentStatus, newStatus, 'dispute');
}

export function validateVendorOnboardingTransition(
  currentStatus: QZPayVendorOnboardingStatus,
  newStatus: QZPayVendorOnboardingStatus
): void {
  validateStatusTransition(VENDOR_ONBOARDING_TRANSITIONS, currentStatus, newStatus, 'vendor onboarding');
}

// ═══════════════════════════════════════════════════════════════════════
// ENTITLEMENTS AND LIMITS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Entitlements are boolean features that a plan grants access to.
 * Projects can extend this with their own entitlements.
 */
export interface QZPayEntitlements {
  // Core entitlements
  canAccessAnalytics: boolean;
  canAccessPrioritySupport: boolean;
  canAccessApi: boolean;
  canExportData: boolean;
  canUseCustomBranding: boolean;
  canInviteTeamMembers: boolean;
  canUseIntegrations: boolean;
  canAccessAdvancedFeatures: boolean;

  // Allow project-specific entitlements
  [key: string]: boolean;
}

/**
 * Limits are numeric restrictions within the plan.
 * -1 means unlimited.
 * Projects can extend this with their own limits.
 */
export interface QZPayLimits {
  // Core limits
  maxStorageMb: number;
  maxTeamMembers: number;
  maxApiRequestsPerDay: number;
  maxApiRequestsPerMonth: number;

  // HOSPEDA-specific (example)
  maxProperties: number;
  maxPhotosPerProperty: number;

  // Asist.IA-specific (example)
  maxBots: number;
  maxMessagesPerMonth: number;
  maxPlugins: number;

  // GEMFolio-specific (example)
  maxProducts: number;
  maxBundlesPerMonth: number;

  // Allow project-specific limits
  [key: string]: number;
}

/**
 * Plan definition stored in database or code
 */
export interface QZPayPlan {
  id: string;
  planId: string;
  name: string;
  description?: string;

  // Pricing by interval
  prices: {
    [interval: string]: {
      amount: number;
      currency: string;
    };
  };

  // What the plan grants
  entitlements: Partial<QZPayEntitlements>;
  limits: Partial<QZPayLimits>;

  // Trial configuration
  trialDays: number;
  trialRequiresPaymentMethod: boolean;

  // Display
  displayOrder: number;
  isFeatured: boolean;
  badgeText?: string;

  // Status
  active: boolean;
  visible: boolean;

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Usage record for usage-based billing
 */
export interface QZPayUsageRecord {
  id: string;
  subscriptionId: string;
  customerId: string;
  metricName: string;
  periodStart: Date;
  periodEnd: Date;
  quantity: number;
  includedQuantity: number;
  overageQuantity: number;
  overageUnitPrice?: number;
  overageTotal: number;
  billed: boolean;
  billedAt?: Date;
  invoiceId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual usage event
 */
export interface QZPayUsageEvent {
  id: string;
  subscriptionId: string;
  customerId: string;
  metricName: string;
  quantity: number;
  eventType?: string;
  eventId?: string;
  idempotencyKey?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION ADD-ONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Add-on attached to a subscription
 */
export interface QZPaySubscriptionAddon {
  id: string;
  subscriptionId: string;
  addonId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  status: 'active' | 'removed' | 'pending';
  addedAt: Date;
  removedAt?: Date;
  proratedAmount?: number;
  prorationDate?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Add-on product definition
 */
export interface QZPayAddonDefinition {
  id: string;
  addonId: string;
  name: string;
  description?: string;
  pricingModel: 'flat' | 'per_unit' | 'tiered';
  price: number;
  currency: string;
  compatiblePlans?: string[];
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION WITH HELPERS (enriched type)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Subscription with helper methods for easy access to plan features.
 * This is what billing.subscriptions.get() returns.
 */
export interface QZPaySubscriptionWithHelpers extends QZPaySubscription {
  // The plan this subscription is for
  plan: QZPayPlan;

  // Status helper methods
  isActive(): boolean;
  isTrial(): boolean;
  isPastDue(): boolean;
  isCanceled(): boolean;
  isInGracePeriod(): boolean;

  // Access helper
  hasAccess(): boolean;

  // Plan helpers
  getPlan(): QZPayPlan;
  getPlanId(): string;
  getPlanName(): string;

  // Entitlements and limits
  getEntitlements(): QZPayEntitlements;
  getLimits(): QZPayLimits;
  hasEntitlement(key: keyof QZPayEntitlements): boolean;
  getLimit(key: keyof QZPayLimits): number;
  isLimitExceeded(key: keyof QZPayLimits, currentValue: number): boolean;

  // Date helpers
  getDaysRemaining(): number;
  getTrialDaysRemaining(): number | null;
  willRenew(): boolean;

  // Payment method (pre-calculated properties, not methods)
  hasPaymentMethod: boolean;
  defaultPaymentMethod: QZPayPaymentMethodSummary | null;

  // Pause/Resume helpers
  isPaused(): boolean;
  canPause(): boolean;
  pausesRemaining(): number;
  pausedUntil(): Date | null;

  // Add-on helpers
  getAddons(): QZPaySubscriptionAddon[];
  hasAddon(addonId: string): boolean;

  // Per-Seat helpers
  getQuantity(): number;
  getIncludedQuantity(): number;
  getAdditionalSeats(): number;
  getSeatPrice(): number;
  canAddSeats(count: number): boolean;
}
```

---

## Metadata JSONB Structures

All tables include a `metadata JSONB DEFAULT '{}'` column for storing application-specific data.
This section documents the **expected structure** for each table's metadata to ensure consistency
across implementations and enable type-safe access in TypeScript.

> **IMPORTANT**: These interfaces define the EXPECTED structure. The `metadata` column accepts
> any valid JSON object, but applications SHOULD conform to these structures for consistency.
> Custom fields can be added via the `customFields` property available in each interface.

```typescript
// packages/core/src/types/metadata.ts

// ═══════════════════════════════════════════════════════════════════════════
// CORE ENTITIES METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer metadata structure
 *
 * Stores acquisition, segmentation, and application-specific customer data.
 *
 * @example
 * {
 *   source: 'web',
 *   referralCode: 'FRIEND50',
 *   segment: 'enterprise',
 *   tags: ['vip', 'early-adopter'],
 *   acquisitionCampaign: 'summer-2024',
 *   preferredContactMethod: 'email'
 * }
 */
export interface QZPayCustomerMetadata {
  /**
   * Acquisition channel - how the customer was acquired
   * @example 'web', 'mobile', 'api', 'import', 'partner'
   */
  source?: 'web' | 'mobile' | 'api' | 'import' | 'partner' | 'referral' | 'organic';

  /**
   * Referral code used at signup (if any)
   * Links to promo_codes or external referral system
   */
  referralCode?: string;

  /**
   * Referrer customer ID (if referred by another customer)
   */
  referredBy?: string;

  /**
   * Customer segment for pricing/feature targeting
   * @example 'starter', 'growth', 'enterprise', 'vip'
   */
  segment?: string;

  /**
   * Customer tier for support/feature levels
   * @example 'free', 'basic', 'pro', 'enterprise'
   */
  tier?: string;

  /**
   * Searchable tags for filtering and categorization
   */
  tags?: string[];

  /**
   * Marketing campaign that converted this customer
   */
  acquisitionCampaign?: string;

  /**
   * UTM parameters from acquisition
   */
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  /**
   * Preferred contact method
   */
  preferredContactMethod?: 'email' | 'sms' | 'phone' | 'whatsapp';

  /**
   * Tax identification for invoicing
   */
  taxInfo?: {
    taxId?: string;
    taxIdType?: 'vat' | 'ein' | 'cuit' | 'rfc' | 'other';
    taxExempt?: boolean;
    taxExemptReason?: string;
  };

  /**
   * Company information for B2B customers
   */
  company?: {
    name?: string;
    size?: 'solo' | 'small' | 'medium' | 'large' | 'enterprise';
    industry?: string;
    website?: string;
  };

  /**
   * Application-specific custom fields
   * Use this for any fields not covered above
   */
  customFields?: Record<string, unknown>;
}

/**
 * Subscription metadata structure
 *
 * Stores subscription lifecycle, sales context, and upgrade/downgrade history.
 *
 * @example
 * {
 *   creationReason: 'upgrade',
 *   previousPlanId: 'plan_basic',
 *   salesRep: 'john.doe@company.com',
 *   campaignId: 'black-friday-2024',
 *   notes: 'VIP customer, expedited onboarding'
 * }
 */
export interface QZPaySubscriptionMetadata {
  /**
   * Why this subscription was created
   */
  creationReason?: 'signup' | 'upgrade' | 'downgrade' | 'migration' | 'support' | 'trial_conversion' | 'reactivation';

  /**
   * Previous plan ID if upgraded/downgraded
   */
  previousPlanId?: string;

  /**
   * Previous subscription ID if migrated
   */
  previousSubscriptionId?: string;

  /**
   * Sales representative who closed this deal
   */
  salesRep?: string;

  /**
   * Sales team or department
   */
  salesTeam?: string;

  /**
   * Campaign that led to this subscription
   */
  campaignId?: string;

  /**
   * Deal/opportunity ID from CRM
   */
  crmDealId?: string;

  /**
   * Contract ID for enterprise subscriptions
   */
  contractId?: string;

  /**
   * Custom billing cycle notes
   */
  billingNotes?: string;

  /**
   * Internal notes about this subscription
   */
  notes?: string;

  /**
   * Negotiated discount percentage (for enterprise)
   */
  negotiatedDiscount?: number;

  /**
   * Custom payment terms
   */
  paymentTerms?: 'net_0' | 'net_15' | 'net_30' | 'net_60' | 'net_90';

  /**
   * Auto-renewal preference override
   */
  autoRenewalOverride?: boolean;

  /**
   * Reason if auto-renewal was disabled
   */
  autoRenewalDisabledReason?: string;

  /**
   * Cancellation information (when canceled)
   */
  cancellation?: {
    reason?: string;
    feedback?: string;
    canceledBy?: 'customer' | 'admin' | 'system' | 'payment_failure';
    competitorMentioned?: string;
    winbackEligible?: boolean;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Payment metadata structure
 *
 * Stores fraud detection context, order references, and payment processing details.
 *
 * @example
 * {
 *   orderId: 'ORD-12345',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   fraudScore: 15,
 *   deviceFingerprint: 'abc123'
 * }
 */
export interface QZPayPaymentMetadata {
  /**
   * Order/cart reference from host application
   */
  orderId?: string;

  /**
   * External reference ID from host application
   */
  externalReference?: string;

  /**
   * IP address for fraud detection
   * Note: Consider privacy regulations (GDPR) when storing
   */
  ipAddress?: string;

  /**
   * Browser user agent for fraud detection
   */
  userAgent?: string;

  /**
   * Device fingerprint for fraud detection
   */
  deviceFingerprint?: string;

  /**
   * Fraud risk score (0-100, higher = riskier)
   */
  fraudScore?: number;

  /**
   * Fraud check result
   */
  fraudCheck?: {
    provider?: string;
    score?: number;
    decision?: 'approve' | 'review' | 'reject';
    reasons?: string[];
    checkedAt?: string; // ISO date
  };

  /**
   * 3D Secure authentication result
   */
  threeDSecure?: {
    version?: '1.0' | '2.0' | '2.1' | '2.2';
    status?: 'authenticated' | 'attempted' | 'failed' | 'unavailable';
    eci?: string;
    cavv?: string;
    xid?: string;
  };

  /**
   * Receipt information
   */
  receipt?: {
    url?: string;
    number?: string;
    sentAt?: string; // ISO date
    sentTo?: string; // email
  };

  /**
   * Retry context for failed payments
   */
  retryContext?: {
    originalPaymentId?: string;
    retryNumber?: number;
    lastFailureReason?: string;
    nextRetryAt?: string; // ISO date
  };

  /**
   * Refund information (if partially/fully refunded)
   */
  refundInfo?: {
    reason?: string;
    requestedBy?: string;
    requestedAt?: string; // ISO date
    notes?: string;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Invoice metadata structure
 *
 * Stores billing context, delivery tracking, and payment collection details.
 *
 * @example
 * {
 *   purchaseOrderNumber: 'PO-2024-001',
 *   costCenter: 'DEPT-ENGINEERING',
 *   approvedBy: 'jane.manager@company.com',
 *   deliveryEmails: ['billing@company.com', 'finance@company.com']
 * }
 */
export interface QZPayInvoiceMetadata {
  /**
   * Customer's purchase order number
   */
  purchaseOrderNumber?: string;

  /**
   * Cost center for enterprise billing
   */
  costCenter?: string;

  /**
   * Department or project code
   */
  projectCode?: string;

  /**
   * Person who approved this invoice (enterprise)
   */
  approvedBy?: string;

  /**
   * Additional emails for invoice delivery
   */
  deliveryEmails?: string[];

  /**
   * Invoice delivery tracking
   */
  delivery?: {
    sentAt?: string; // ISO date
    sentTo?: string[];
    method?: 'email' | 'api' | 'download';
    openedAt?: string; // ISO date
    downloadedAt?: string; // ISO date
  };

  /**
   * Collection notes for past due invoices
   */
  collectionNotes?: string;

  /**
   * Collection attempts tracking
   */
  collectionAttempts?: Array<{
    attemptedAt: string; // ISO date
    method: 'email' | 'phone' | 'letter';
    result: 'no_response' | 'promised_payment' | 'disputed' | 'paid';
    notes?: string;
  }>;

  /**
   * Dispute information (if invoice is disputed)
   */
  dispute?: {
    reason?: string;
    openedAt?: string; // ISO date
    resolvedAt?: string; // ISO date
    resolution?: string;
  };

  /**
   * Write-off information (if invoice was written off)
   */
  writeOff?: {
    amount?: number;
    reason?: string;
    approvedBy?: string;
    writtenOffAt?: string; // ISO date
  };

  /**
   * Tax calculation details
   */
  taxDetails?: {
    calculatedBy?: 'manual' | 'avalara' | 'taxjar' | 'stripe_tax';
    jurisdiction?: string;
    taxRates?: Array<{
      name: string;
      rate: number;
      amount: number;
    }>;
  };

  /**
   * PDF generation tracking
   */
  pdf?: {
    url?: string;
    generatedAt?: string; // ISO date
    version?: number;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMO CODES & DISCOUNTS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Promo code metadata structure
 *
 * Stores marketing campaign context and targeting rules.
 *
 * @example
 * {
 *   campaign: 'black-friday-2024',
 *   createdBy: 'marketing-team',
 *   targetAudience: 'churned-users',
 *   internalNotes: 'Approved by VP Marketing'
 * }
 */
export interface QZPayPromoCodeMetadata {
  /**
   * Marketing campaign this code belongs to
   */
  campaign?: string;

  /**
   * Who created this promo code
   */
  createdBy?: string;

  /**
   * Target audience description
   */
  targetAudience?: string;

  /**
   * Distribution channel
   */
  distributionChannel?: 'email' | 'social' | 'influencer' | 'partner' | 'affiliate' | 'internal';

  /**
   * Affiliate/partner ID if applicable
   */
  affiliateId?: string;

  /**
   * Partner commission percentage (0-100)
   */
  affiliateCommission?: number;

  /**
   * Internal notes (not shown to customers)
   */
  internalNotes?: string;

  /**
   * A/B test variant
   */
  abTestVariant?: string;

  /**
   * Budget tracking
   */
  budget?: {
    allocated?: number;
    used?: number;
    currency?: string;
  };

  /**
   * Geographic restrictions
   */
  geoRestrictions?: {
    allowedCountries?: string[];
    blockedCountries?: string[];
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Automatic discount usage metadata
 *
 * Stores the context of how an automatic discount was applied.
 */
export interface QZPayAutomaticDiscountUsageMetadata {
  /**
   * All conditions that were evaluated
   */
  evaluatedConditions?: Array<{
    type: string;
    expected: unknown;
    actual: unknown;
    matched: boolean;
  }>;

  /**
   * Reason why this discount was applied (human readable)
   */
  applicationReason?: string;

  /**
   * Priority among multiple matching discounts
   */
  appliedPriority?: number;

  /**
   * Other discounts that were NOT applied due to stacking rules
   */
  excludedDiscounts?: string[];

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Customer discount metadata
 *
 * Stores the context of customer-specific discounts.
 */
export interface QZPayCustomerDiscountMetadata {
  /**
   * Reason this discount was granted
   */
  grantedReason?: 'loyalty' | 'negotiation' | 'support_issue' | 'partnership' | 'enterprise_deal' | 'other';

  /**
   * Who approved this discount
   */
  approvedBy?: string;

  /**
   * Support ticket reference (if granted due to issue)
   */
  supportTicketId?: string;

  /**
   * Contract reference (for enterprise)
   */
  contractReference?: string;

  /**
   * Internal notes
   */
  notes?: string;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// VENDORS & MARKETPLACE METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vendor metadata structure
 *
 * Stores vendor business information and integration details.
 *
 * @example
 * {
 *   businessType: 'individual',
 *   industry: 'digital-products',
 *   website: 'https://vendor.example.com',
 *   socialProfiles: { twitter: '@vendor' }
 * }
 */
export interface QZPayVendorMetadata {
  /**
   * Type of business
   */
  businessType?: 'individual' | 'company' | 'non_profit';

  /**
   * Legal business name
   */
  legalBusinessName?: string;

  /**
   * Industry/category
   */
  industry?: string;

  /**
   * Vendor website
   */
  website?: string;

  /**
   * Social media profiles
   */
  socialProfiles?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };

  /**
   * Verification status details
   */
  verification?: {
    identityVerified?: boolean;
    identityVerifiedAt?: string; // ISO date
    businessVerified?: boolean;
    businessVerifiedAt?: string; // ISO date
    documentsSubmitted?: string[];
  };

  /**
   * Tax information
   */
  taxInfo?: {
    taxId?: string;
    taxIdType?: string;
    taxFormSubmitted?: boolean;
    taxFormType?: 'W9' | 'W8BEN' | 'W8BENE' | 'other';
  };

  /**
   * Support contact
   */
  supportContact?: {
    email?: string;
    phone?: string;
    hours?: string;
  };

  /**
   * Onboarding progress tracking
   */
  onboarding?: {
    step?: string;
    completedSteps?: string[];
    pendingActions?: string[];
    startedAt?: string; // ISO date
    completedAt?: string; // ISO date
  };

  /**
   * Account manager assignment
   */
  accountManager?: string;

  /**
   * Risk assessment
   */
  riskAssessment?: {
    level?: 'low' | 'medium' | 'high';
    assessedAt?: string; // ISO date
    factors?: string[];
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Vendor payout metadata
 *
 * Stores payout processing details and reconciliation info.
 */
export interface QZPayVendorPayoutMetadata {
  /**
   * Payout period covered
   */
  period?: {
    from: string; // ISO date
    to: string; // ISO date
  };

  /**
   * Number of transactions in this payout
   */
  transactionCount?: number;

  /**
   * Total gross amount before fees
   */
  grossAmount?: number;

  /**
   * Fees breakdown
   */
  fees?: {
    platformFee?: number;
    processingFee?: number;
    taxWithheld?: number;
  };

  /**
   * Bank transfer reference
   */
  bankReference?: string;

  /**
   * Reconciliation status
   */
  reconciliation?: {
    status?: 'pending' | 'matched' | 'discrepancy';
    matchedAt?: string; // ISO date
    discrepancyAmount?: number;
    discrepancyReason?: string;
  };

  /**
   * Approval workflow
   */
  approval?: {
    requiredApprovers?: number;
    approvedBy?: string[];
    approvedAt?: string; // ISO date
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT METHODS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payment method metadata
 *
 * Stores additional payment method context and preferences.
 */
export interface QZPayPaymentMethodMetadata {
  /**
   * Customer's nickname for this method
   */
  nickname?: string;

  /**
   * Billing address associated with this method
   */
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  /**
   * Verification status
   */
  verification?: {
    avsCheck?: 'pass' | 'fail' | 'unavailable';
    cvcCheck?: 'pass' | 'fail' | 'unavailable';
    addressMatch?: boolean;
    zipMatch?: boolean;
  };

  /**
   * Card-specific metadata (for card payment methods)
   */
  card?: {
    funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
    issuer?: string;
    country?: string;
    fingerprint?: string;
  };

  /**
   * Bank account metadata (for bank payment methods)
   */
  bankAccount?: {
    bankName?: string;
    accountType?: 'checking' | 'savings';
    lastVerifiedAt?: string; // ISO date
  };

  /**
   * Usage preferences
   */
  preferences?: {
    useForRecurring?: boolean;
    useForOneTime?: boolean;
    maxTransactionAmount?: number;
  };

  /**
   * Device where this method was added
   */
  addedFrom?: {
    deviceType?: 'web' | 'ios' | 'android';
    ipAddress?: string;
    userAgent?: string;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Webhook event metadata
 *
 * Stores processing context and debugging information.
 * This metadata is APPLICATION-level context, separate from the provider's raw payload.
 */
export interface QZPayWebhookEventMetadata {
  /**
   * Source IP address of webhook request
   */
  sourceIp?: string;

  /**
   * Signature verification result
   */
  signatureVerification?: {
    verified: boolean;
    algorithm?: string;
    headerName?: string;
    error?: string;
  };

  /**
   * Processing attempts history
   */
  processingAttempts?: Array<{
    attemptedAt: string; // ISO date
    duration?: number; // milliseconds
    result: 'success' | 'error' | 'skipped';
    error?: string;
    handlerVersion?: string;
  }>;

  /**
   * Entities affected by this webhook
   */
  affectedEntities?: Array<{
    type: string;
    id: string;
    action?: string;
  }>;

  /**
   * Handler that processed this event
   */
  handler?: {
    name?: string;
    version?: string;
    processingTime?: number; // milliseconds
  };

  /**
   * Correlation ID for tracing
   */
  correlationId?: string;

  /**
   * Request headers (subset, for debugging)
   */
  requestHeaders?: Record<string, string>;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Webhook delivery metadata
 *
 * Stores delivery attempt details and debugging info.
 */
export interface QZPayWebhookDeliveryMetadata {
  /**
   * Response headers from endpoint
   */
  responseHeaders?: Record<string, string>;

  /**
   * Response body preview (truncated)
   */
  responseBodyPreview?: string;

  /**
   * Connection details
   */
  connection?: {
    ipAddress?: string;
    tlsVersion?: string;
    dnsLookupTime?: number;
    connectTime?: number;
    ttfb?: number; // time to first byte
  };

  /**
   * Retry scheduling info
   */
  retrySchedule?: {
    strategy?: 'exponential' | 'linear' | 'fixed';
    baseDelay?: number;
    maxDelay?: number;
    maxAttempts?: number;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANS & ADDONS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Plan metadata
 *
 * Stores plan configuration and marketing context.
 */
export interface QZPayPlanMetadata {
  /**
   * Marketing headline
   */
  headline?: string;

  /**
   * Marketing subheadline
   */
  subheadline?: string;

  /**
   * Feature highlights for marketing
   */
  highlights?: string[];

  /**
   * Comparison matrix position
   */
  comparisonOrder?: number;

  /**
   * Target customer segment
   */
  targetSegment?: string;

  /**
   * Recommended for (customer type)
   */
  recommendedFor?: string[];

  /**
   * Upgrade path (next plan to suggest)
   */
  upgradePath?: string;

  /**
   * Downgrade path (fallback plan)
   */
  downgradePath?: string;

  /**
   * Legacy plan ID (if this replaces an old plan)
   */
  legacyPlanId?: string;

  /**
   * Sunset date (if plan is being deprecated)
   */
  sunsetDate?: string; // ISO date

  /**
   * Internal notes
   */
  internalNotes?: string;

  /**
   * A/B test configuration
   */
  abTest?: {
    enabled?: boolean;
    variant?: string;
    priceVariants?: Record<string, number>;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Addon definition metadata
 *
 * Stores addon configuration and compatibility rules.
 */
export interface QZPayAddonDefinitionMetadata {
  /**
   * Marketing description
   */
  marketingDescription?: string;

  /**
   * Icon or image URL
   */
  iconUrl?: string;

  /**
   * Setup instructions
   */
  setupInstructions?: string;

  /**
   * Dependencies on other addons
   */
  dependencies?: string[];

  /**
   * Conflicts with other addons
   */
  conflicts?: string[];

  /**
   * Provisioning webhook URL
   */
  provisioningWebhook?: string;

  /**
   * De-provisioning webhook URL
   */
  deprovisioningWebhook?: string;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Subscription addon metadata
 *
 * Stores addon instance configuration.
 */
export interface QZPaySubscriptionAddonMetadata {
  /**
   * Configuration values for this addon instance
   */
  configuration?: Record<string, unknown>;

  /**
   * Provisioning status
   */
  provisioning?: {
    status?: 'pending' | 'provisioned' | 'failed';
    provisionedAt?: string; // ISO date
    error?: string;
  };

  /**
   * Who added this addon
   */
  addedBy?: 'customer' | 'admin' | 'system' | 'api';

  /**
   * Reason for adding
   */
  addedReason?: string;

  /**
   * Removal context (when removed)
   */
  removal?: {
    reason?: string;
    removedBy?: 'customer' | 'admin' | 'system' | 'api';
    feedback?: string;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE-BASED BILLING METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Usage record metadata
 *
 * Stores aggregated usage context and calculation details.
 */
export interface QZPayUsageRecordMetadata {
  /**
   * Source of this usage data
   */
  source?: 'api' | 'webhook' | 'import' | 'manual' | 'metering_service';

  /**
   * Aggregation method used
   */
  aggregation?: {
    method?: 'sum' | 'max' | 'last' | 'average';
    eventCount?: number;
    firstEventAt?: string; // ISO date
    lastEventAt?: string; // ISO date
  };

  /**
   * Tier that was applied (for tiered pricing)
   */
  appliedTier?: {
    tierName?: string;
    tierIndex?: number;
    unitPrice?: number;
    includedQuantity?: number;
  };

  /**
   * Warning if approaching limit
   */
  limitWarning?: {
    percentUsed?: number;
    warningThreshold?: number;
    notificationSent?: boolean;
    notificationSentAt?: string; // ISO date
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Usage event metadata
 *
 * Stores individual usage event context.
 */
export interface QZPayUsageEventMetadata {
  /**
   * Event source details
   */
  source?: {
    service?: string;
    instance?: string;
    version?: string;
  };

  /**
   * User/actor who triggered this usage
   */
  actor?: {
    userId?: string;
    userEmail?: string;
    apiKeyId?: string;
  };

  /**
   * Resource being consumed
   */
  resource?: {
    type?: string;
    id?: string;
    name?: string;
  };

  /**
   * Geographic location (if relevant)
   */
  location?: {
    region?: string;
    country?: string;
    datacenter?: string;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTES & REFUNDS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Credit note metadata
 *
 * Stores credit note context and application details.
 */
export interface QZPayCreditNoteMetadata {
  /**
   * Reason category
   */
  reasonCategory?: 'refund' | 'goodwill' | 'error_correction' | 'proration' | 'dispute_resolution' | 'other';

  /**
   * Related support ticket
   */
  supportTicketId?: string;

  /**
   * Related dispute ID
   */
  disputeId?: string;

  /**
   * Who approved this credit
   */
  approvedBy?: string;

  /**
   * Approval workflow
   */
  approval?: {
    required?: boolean;
    approvers?: string[];
    approvedAt?: string; // ISO date
    notes?: string;
  };

  /**
   * Customer communication
   */
  communication?: {
    notified?: boolean;
    notifiedAt?: string; // ISO date
    notifiedVia?: 'email' | 'in_app' | 'phone';
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export metadata
 *
 * Stores export configuration and delivery details.
 */
export interface QZPayExportMetadata {
  /**
   * Who requested this export
   */
  requestedBy?: string;

  /**
   * Purpose of the export
   */
  purpose?: 'reporting' | 'audit' | 'migration' | 'backup' | 'compliance' | 'other';

  /**
   * Delivery configuration
   */
  delivery?: {
    method?: 'download' | 'email' | 's3' | 'sftp' | 'webhook';
    destination?: string;
    deliveredAt?: string; // ISO date
    expiresAt?: string; // ISO date
  };

  /**
   * Encryption details
   */
  encryption?: {
    enabled?: boolean;
    method?: 'pgp' | 'aes256';
    keyId?: string;
  };

  /**
   * Processing statistics
   */
  stats?: {
    rowsProcessed?: number;
    rowsExported?: number;
    rowsSkipped?: number;
    processingTime?: number; // milliseconds
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB EXECUTION METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Job execution metadata
 *
 * Stores job run context and diagnostics.
 */
export interface QZPayJobExecutionMetadata {
  /**
   * Job parameters used
   */
  parameters?: Record<string, unknown>;

  /**
   * Environment info
   */
  environment?: {
    hostname?: string;
    processId?: number;
    nodeVersion?: string;
    appVersion?: string;
  };

  /**
   * Checkpoint for resumable jobs
   */
  checkpoint?: {
    lastProcessedId?: string;
    offset?: number;
    canResume?: boolean;
  };

  /**
   * Performance metrics
   */
  performance?: {
    memoryUsedMb?: number;
    cpuPercent?: number;
    dbQueriesCount?: number;
    dbQueriesTime?: number;
  };

  /**
   * Alerts triggered
   */
  alerts?: Array<{
    type: string;
    message: string;
    triggeredAt: string; // ISO date
    notified?: boolean;
  }>;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Audit log metadata
 *
 * Stores additional audit context beyond standard fields.
 */
export interface QZPayAuditLogMetadata {
  /**
   * Session information
   */
  session?: {
    id?: string;
    startedAt?: string; // ISO date
    deviceType?: string;
  };

  /**
   * Geographic location
   */
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  /**
   * API request context
   */
  apiRequest?: {
    method?: string;
    path?: string;
    queryParams?: Record<string, string>;
    responseStatus?: number;
    responseTime?: number;
  };

  /**
   * Feature flags active during this action
   */
  featureFlags?: Record<string, boolean>;

  /**
   * A/B test context
   */
  abTests?: Record<string, string>;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED ENTITIES METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer merge metadata
 *
 * Stores merge operation details and conflict resolution.
 */
export interface QZPayCustomerMergeMetadata {
  /**
   * Reason for merge
   */
  reason?: 'duplicate_account' | 'company_acquisition' | 'data_cleanup' | 'customer_request' | 'other';

  /**
   * Conflicts encountered and how they were resolved
   */
  conflicts?: Array<{
    field: string;
    sourceValue: unknown;
    targetValue: unknown;
    resolution: 'keep_source' | 'keep_target' | 'merge' | 'manual';
    resolvedValue: unknown;
  }>;

  /**
   * Entities migrated
   */
  migratedEntities?: {
    subscriptions?: number;
    payments?: number;
    invoices?: number;
    paymentMethods?: number;
  };

  /**
   * Approval workflow
   */
  approval?: {
    requiredApprovals?: number;
    approvers?: string[];
    approvedAt?: string; // ISO date
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Pricing snapshot metadata
 *
 * Stores snapshot context and calculation audit trail.
 */
export interface QZPayPricingSnapshotMetadata {
  /**
   * Why this snapshot was taken
   */
  trigger?: 'subscription_create' | 'plan_change' | 'renewal' | 'addon_change' | 'manual';

  /**
   * Exchange rate details
   */
  exchangeRateDetails?: {
    source?: string;
    fetchedAt?: string; // ISO date
    isManualOverride?: boolean;
  };

  /**
   * Discounts applied
   */
  discountsApplied?: Array<{
    type: 'promo_code' | 'customer_discount' | 'automatic';
    id: string;
    amount: number;
  }>;

  /**
   * Tax calculation
   */
  taxCalculation?: {
    provider?: string;
    jurisdiction?: string;
    rates?: Array<{
      name: string;
      rate: number;
    }>;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Exchange rate metadata
 *
 * Stores rate source and override context.
 */
export interface QZPayExchangeRateMetadata {
  /**
   * Rate source details
   */
  source?: {
    provider?: string;
    apiEndpoint?: string;
    requestId?: string;
    fetchLatency?: number; // milliseconds
  };

  /**
   * Override context (if manually set)
   */
  override?: {
    reason?: string;
    overriddenBy?: string;
    previousRate?: number;
    approvedBy?: string;
  };

  /**
   * Historical rates for context
   */
  history?: {
    rate24hAgo?: number;
    rate7dAgo?: number;
    volatilityPercent?: number;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Event store metadata
 *
 * Stores event sourcing context.
 */
export interface QZPayEventStoreMetadata {
  /**
   * Causation ID (event that caused this event)
   */
  causationId?: string;

  /**
   * Correlation ID (request that initiated this chain)
   */
  correlationId?: string;

  /**
   * Event schema version
   */
  schemaVersion?: string;

  /**
   * User/system that triggered this event
   */
  triggeredBy?: {
    type?: 'user' | 'system' | 'webhook' | 'scheduler';
    id?: string;
  };

  /**
   * Idempotency key used
   */
  idempotencyKey?: string;

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Dispute metadata
 *
 * Stores dispute handling context and evidence.
 */
export interface QZPayDisputeMetadata {
  /**
   * Customer communication history
   */
  customerCommunication?: Array<{
    date: string; // ISO date
    channel: 'email' | 'phone' | 'chat';
    summary: string;
    outcome?: string;
  }>;

  /**
   * Evidence collected
   */
  evidence?: {
    receiptProvided?: boolean;
    deliveryProofProvided?: boolean;
    customerServiceLogsProvided?: boolean;
    refundPolicyProvided?: boolean;
    additionalDocuments?: string[];
    submittedAt?: string; // ISO date
  };

  /**
   * Internal assessment
   */
  internalAssessment?: {
    likelyOutcome?: 'win' | 'lose' | 'uncertain';
    assessedBy?: string;
    notes?: string;
  };

  /**
   * Resolution tracking
   */
  resolution?: {
    outcome?: 'won' | 'lost' | 'withdrawn';
    outcomeReason?: string;
    amountRecovered?: number;
    fees?: number;
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

/**
 * Event queue metadata
 *
 * Stores queue item processing context.
 */
export interface QZPayEventQueueMetadata {
  /**
   * Original trigger
   */
  trigger?: {
    source?: string;
    sourceId?: string;
    triggeredAt?: string; // ISO date
  };

  /**
   * Processing attempts detail
   */
  attempts?: Array<{
    attemptNumber: number;
    startedAt: string; // ISO date
    completedAt?: string; // ISO date
    result: 'success' | 'error' | 'timeout';
    error?: string;
    workerHost?: string;
  }>;

  /**
   * Priority context
   */
  priority?: {
    level?: 'low' | 'normal' | 'high' | 'critical';
    reason?: string;
    boostedAt?: string; // ISO date
  };

  /**
   * Dead letter context (if moved to DLQ)
   */
  deadLetter?: {
    movedAt?: string; // ISO date
    reason?: string;
    originalScheduledFor?: string; // ISO date
  };

  /**
   * Application-specific custom fields
   */
  customFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// METADATA UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type-safe metadata accessor
 *
 * @example
 * const source = getTypedMetadata<QZPayCustomerMetadata>(customer.metadata)?.source;
 */
export function getTypedMetadata<T>(metadata: Record<string, unknown> | null | undefined): T | null {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }
  return metadata as T;
}

/**
 * Type-safe metadata updater
 *
 * @example
 * const updated = updateTypedMetadata<QZPayCustomerMetadata>(customer.metadata, {
 *   source: 'mobile',
 *   segment: 'enterprise'
 * });
 */
export function updateTypedMetadata<T extends Record<string, unknown>>(
  existing: Record<string, unknown> | null | undefined,
  updates: Partial<T>
): T {
  return {
    ...(existing || {}),
    ...updates,
  } as T;
}

/**
 * Validate metadata conforms to expected structure
 * (For use with Zod or similar validation library)
 */
export function validateMetadata<T>(
  metadata: unknown,
  validator: (data: unknown) => T
): { success: true; data: T } | { success: false; error: Error } {
  try {
    const data = validator(metadata);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
```

### Metadata Interface Summary Table

| Table | Interface | Primary Purpose |
|-------|-----------|-----------------|
| `billing_customers` | `QZPayCustomerMetadata` | Acquisition, segmentation, tax info |
| `billing_subscriptions` | `QZPaySubscriptionMetadata` | Lifecycle tracking, sales context |
| `billing_payments` | `QZPayPaymentMetadata` | Fraud detection, order references |
| `billing_invoices` | `QZPayInvoiceMetadata` | Billing context, collection tracking |
| `billing_promo_codes` | `QZPayPromoCodeMetadata` | Campaign tracking, targeting |
| `billing_automatic_discount_usage` | `QZPayAutomaticDiscountUsageMetadata` | Application context |
| `billing_customer_discounts` | `QZPayCustomerDiscountMetadata` | Grant reason, approval |
| `billing_vendors` | `QZPayVendorMetadata` | Business info, verification |
| `billing_vendor_payouts` | `QZPayVendorPayoutMetadata` | Payout reconciliation |
| `billing_payment_methods` | `QZPayPaymentMethodMetadata` | Card details, preferences |
| `billing_webhook_events` | `QZPayWebhookEventMetadata` | Processing context |
| `billing_webhook_deliveries` | `QZPayWebhookDeliveryMetadata` | Delivery attempts |
| `billing_plans` | `QZPayPlanMetadata` | Marketing, upgrade paths |
| `billing_addon_definitions` | `QZPayAddonDefinitionMetadata` | Configuration, dependencies |
| `billing_subscription_addons` | `QZPaySubscriptionAddonMetadata` | Instance configuration |
| `billing_usage_records` | `QZPayUsageRecordMetadata` | Aggregation details |
| `billing_usage_events` | `QZPayUsageEventMetadata` | Event source context |
| `billing_credit_notes` | `QZPayCreditNoteMetadata` | Reason, approval workflow |
| `billing_exports` | `QZPayExportMetadata` | Request context, delivery |
| `billing_job_executions` | `QZPayJobExecutionMetadata` | Run diagnostics |
| `billing_audit_logs` | `QZPayAuditLogMetadata` | Session, location context |
| `billing_customer_merges` | `QZPayCustomerMergeMetadata` | Merge details, conflicts |
| `billing_pricing_snapshots` | `QZPayPricingSnapshotMetadata` | Calculation audit trail |
| `billing_exchange_rates` | `QZPayExchangeRateMetadata` | Rate source, overrides |
| `billing_event_store` | `QZPayEventStoreMetadata` | Event sourcing context |
| `billing_disputes` | `QZPayDisputeMetadata` | Evidence, resolution |
| `billing_event_queue` | `QZPayEventQueueMetadata` | Processing attempts |

---

## Migrations

The package provides migration utilities for Drizzle:

```typescript
// packages/drizzle/src/migrations/index.ts

export async function runMigrations(db: DrizzleClient) {
  await migrate(db, { migrationsFolder: './migrations' });
}

// Or generate schema for manual migration
export function generateSchema(): string {
  return `
    -- Billing System Tables
    -- Generated by @qazuor/qzpay-drizzle

    ${customersTableSQL}
    ${subscriptionsTableSQL}
    ${paymentsTableSQL}
    ${invoicesTableSQL}
    ${promoCodesTableSQL}
    ${promoCodeUsageTableSQL}
    ${vendorsTableSQL}
    ${vendorPayoutsTableSQL}
    ${paymentMethodsTableSQL}
    ${auditLogsTableSQL}
    ${webhookEventsTableSQL}
    ${jobExecutionsTableSQL}
  `;
}
```

---

*Document Version: 2.0*
*Last Updated: 2025-12-28*
