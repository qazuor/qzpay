# Schema Patterns

## Overview

This document describes the common patterns used in the @qazuor/qzpay database schema.

---

## 1. Soft Delete Pattern

All billing tables that support deletion use soft delete via a `deleted_at` timestamp column.

### Implementation

```sql
-- Standard soft delete column
deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

-- NULL = active record
-- NOT NULL = deleted at specified timestamp
```

### Tables Using Soft Delete

| Table | Has deleted_at | Reason |
|-------|----------------|--------|
| billing_customers | Yes | Data preserved for invoices, payments |
| billing_subscriptions | Yes | History for analytics, compliance |
| billing_payments | Yes | Legal documents |
| billing_invoices | Yes | Legal documents, cannot hard delete |
| billing_payment_methods | Yes | History for audit |
| billing_promo_codes | Yes | Usage history |
| billing_vendors | Yes | Commission history |
| billing_audit_logs | No | Append-only, never deleted |
| billing_webhook_events | No | Append-only event log |

### Protection Trigger

Prevents accidental hard deletes by converting them to soft deletes:

```sql
CREATE OR REPLACE FUNCTION billing_soft_delete_protection()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow hard delete of already soft-deleted records (for cleanup)
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Convert DELETE to soft delete
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
  ) USING OLD.id;

  RETURN NULL;  -- Cancel original DELETE
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Optimistic Locking Pattern

Uses a `version` column to prevent concurrent update conflicts.

### Implementation

```sql
version INTEGER NOT NULL DEFAULT 1,

-- On update, always include version check
UPDATE billing_subscriptions
SET status = 'canceled', version = version + 1
WHERE id = $1 AND version = $2;
-- If 0 rows affected, throw conflict error
```

### Tables Using Optimistic Locking

- billing_customers
- billing_subscriptions
- billing_payments
- billing_invoices
- billing_vendors

---

## 3. Auto-Update Timestamp Pattern

Automatically updates `updated_at` on any row modification.

### Implementation

```sql
CREATE OR REPLACE FUNCTION billing_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW
  EXECUTE FUNCTION billing_update_timestamp();
```

---

## 4. Environment Isolation Pattern

All tables include `livemode` column for test/production separation.

### Implementation

```sql
livemode BOOLEAN NOT NULL DEFAULT TRUE,

-- Unique constraints include livemode
CONSTRAINT uq_customers_external_id_livemode UNIQUE (external_id, livemode)
```

### Benefits

- Test with real-looking data without risk
- Same database, different environments
- Easy to reset test data

---

## 5. Currency Foreign Key Pattern

All currency fields reference the `billing_currencies` table.

### Implementation

```sql
currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),

-- Reference table
CREATE TABLE billing_currencies (
  code VARCHAR(3) PRIMARY KEY,  -- ISO 4217: USD, EUR, ARS
  name VARCHAR(100) NOT NULL,
  minor_units INTEGER DEFAULT 2,
  symbol VARCHAR(5),
  active BOOLEAN DEFAULT TRUE,
  livemode BOOLEAN DEFAULT TRUE
);
```

### Tables with Currency FK

| Table | Currency Field(s) |
|-------|-------------------|
| billing_payments | currency, base_currency |
| billing_subscriptions | currency |
| billing_invoices | currency |
| billing_vendor_payouts | currency |

---

## 6. JSONB Metadata Pattern

All tables include a `metadata` JSONB column for extensibility.

### Implementation

```sql
metadata JSONB DEFAULT '{}',

-- Query example
SELECT * FROM billing_customers
WHERE metadata->>'tier' = 'enterprise';
```

### Best Practices

- Use for non-queryable custom data
- Validate at application layer
- Don't store structured data that needs querying
- Size limit: 64KB recommended

---

## 7. Timestamp Patterns

### Standard Columns

```sql
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMP WITH TIME ZONE,  -- NULL if not deleted
```

### Action Timestamps

```sql
-- When action occurred
paid_at TIMESTAMP WITH TIME ZONE,
canceled_at TIMESTAMP WITH TIME ZONE,
voided_at TIMESTAMP WITH TIME ZONE,

-- When action will occur
cancel_at TIMESTAMP WITH TIME ZONE,  -- Future cancellation
expires_at TIMESTAMP WITH TIME ZONE,
```

---

## 8. ON DELETE Referential Actions

| Relationship | Action | Reason |
|--------------|--------|--------|
| subscription → customer | RESTRICT | Cannot delete customer with subscriptions |
| payment → customer | RESTRICT | Payment history must be preserved |
| invoice → customer | RESTRICT | Invoices are legal documents |
| payment_method → customer | CASCADE | Delete methods when customer deleted |

---

## 9. Pagination Patterns

### Cursor-Based Pagination

For large datasets with stable ordering:

```sql
-- First page
SELECT * FROM billing_payments
WHERE customer_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page (cursor = created_at, id from last row)
SELECT * FROM billing_payments
WHERE customer_id = $1
  AND (created_at, id) < ($cursor_created_at, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

### Offset Pagination

For admin UIs with page navigation:

```sql
SELECT * FROM billing_customers
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;  -- Page 3
```

---

## 10. Index Strategy

### Essential Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| customers | external_id | User lookup |
| subscriptions | customer_id | Customer subscriptions |
| subscriptions | status + period_end | Renewal job |
| payments | customer_id | Payment history |
| payments | provider_payment_id | Webhook lookup |
| invoices | customer_id, status | Invoice queries |

### Partial Indexes

```sql
-- Only index active records
CREATE INDEX idx_customers_active
ON billing_customers(id)
WHERE deleted_at IS NULL;

-- Only index pending renewals
CREATE INDEX idx_subscriptions_renewal
ON billing_subscriptions(current_period_end)
WHERE status IN ('active', 'trialing') AND deleted_at IS NULL;
```

---

## Related Documents

- [Data Model Overview](./OVERVIEW.md)
- [Table Definitions](./TABLES.md)
- [Migrations](./MIGRATIONS.md)
