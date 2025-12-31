# Migrations

## Overview

This document describes the migration strategy for @qazuor/qzpay database schema.

---

## Migration Strategy

### Tool: Drizzle Kit

The reference implementation uses Drizzle Kit for migrations:

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply pending migrations
pnpm drizzle-kit migrate

# Push schema directly (development only)
pnpm drizzle-kit push
```

### Migration File Naming

```
migrations/
├── 0000_initial_schema.sql
├── 0001_add_customer_segment.sql
├── 0002_add_subscription_pause.sql
└── meta/
    └── _journal.json
```

---

## Initial Schema Migration

The initial migration creates all core tables:

```sql
-- 0000_initial_schema.sql

-- Currencies reference table
CREATE TABLE billing_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  minor_units INTEGER DEFAULT 2,
  symbol VARCHAR(5),
  active BOOLEAN DEFAULT TRUE,
  livemode BOOLEAN DEFAULT TRUE
);

-- Insert default currencies
INSERT INTO billing_currencies (code, name, minor_units, symbol) VALUES
  ('USD', 'US Dollar', 2, '$'),
  ('EUR', 'Euro', 2, '€'),
  ('ARS', 'Argentine Peso', 2, '$'),
  ('BRL', 'Brazilian Real', 2, 'R$'),
  ('MXN', 'Mexican Peso', 2, '$');

-- Customers table
CREATE TABLE billing_customers (
  -- ... full definition
);

-- Subscriptions table
CREATE TABLE billing_subscriptions (
  -- ... full definition
);

-- Payments table
CREATE TABLE billing_payments (
  -- ... full definition
);

-- Invoices table
CREATE TABLE billing_invoices (
  -- ... full definition
);

-- ... remaining tables
```

---

## Migration Best Practices

### 1. Always Test Rollback

```sql
-- UP
ALTER TABLE billing_subscriptions ADD COLUMN pause_reason TEXT;

-- DOWN
ALTER TABLE billing_subscriptions DROP COLUMN pause_reason;
```

### 2. Avoid Breaking Changes

Instead of renaming columns:

```sql
-- BAD: Breaks existing queries
ALTER TABLE billing_customers RENAME COLUMN email TO contact_email;

-- GOOD: Add new column, migrate data, drop old
ALTER TABLE billing_customers ADD COLUMN contact_email VARCHAR(255);
UPDATE billing_customers SET contact_email = email;
-- Deploy application changes
ALTER TABLE billing_customers DROP COLUMN email;
```

### 3. Handle Large Tables

For tables with millions of rows:

```sql
-- Create index concurrently (doesn't lock table)
CREATE INDEX CONCURRENTLY idx_payments_created_at ON billing_payments(created_at);

-- Add column with default (instant in PostgreSQL 11+)
ALTER TABLE billing_payments ADD COLUMN processed BOOLEAN DEFAULT FALSE;
```

### 4. Data Migrations

Separate from schema migrations:

```typescript
// data-migrations/001_backfill_customer_segment.ts
export async function up(db: Database) {
  // Backfill in batches to avoid memory issues
  let cursor = null;

  while (true) {
    const batch = await db.query(`
      SELECT id FROM billing_customers
      WHERE segment IS NULL
      ${cursor ? `AND id > '${cursor}'` : ''}
      ORDER BY id
      LIMIT 1000
    `);

    if (batch.length === 0) break;

    await db.execute(`
      UPDATE billing_customers
      SET segment = 'retail'
      WHERE id = ANY($1)
    `, [batch.map(r => r.id)]);

    cursor = batch[batch.length - 1].id;
  }
}
```

---

## Multi-Tenant Migrations

When adding `tenant_id` column:

```sql
-- Step 1: Add nullable column
ALTER TABLE billing_customers ADD COLUMN tenant_id UUID;

-- Step 2: Backfill existing data
UPDATE billing_customers SET tenant_id = 'default-tenant-id';

-- Step 3: Make NOT NULL
ALTER TABLE billing_customers ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE billing_customers
  ADD CONSTRAINT fk_customers_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Step 5: Update unique constraints
ALTER TABLE billing_customers
  DROP CONSTRAINT uq_customers_external_id_livemode;
ALTER TABLE billing_customers
  ADD CONSTRAINT uq_customers_tenant_external_id_livemode
  UNIQUE (tenant_id, external_id, livemode);
```

---

## Rollback Procedures

### Automatic Rollback

Drizzle Kit doesn't generate down migrations. Use this pattern:

```typescript
// In migration file, include rollback SQL as comment
/*
  ROLLBACK:
  ALTER TABLE billing_subscriptions DROP COLUMN pause_reason;
*/
```

### Emergency Rollback

For critical issues:

1. **Stop application** - Prevent new writes
2. **Backup current state** - `pg_dump` if needed
3. **Apply rollback SQL** - From migration comments
4. **Verify data integrity** - Run checks
5. **Deploy previous version** - Application code
6. **Resume service**

---

## Version Control

### Tracking Applied Migrations

Drizzle stores migration state in `_drizzle_migrations` table:

```sql
SELECT * FROM _drizzle_migrations ORDER BY id DESC LIMIT 5;

-- id | hash | created_at
-- 5  | abc123 | 2025-01-15 10:00:00
-- 4  | def456 | 2025-01-10 09:00:00
```

### CI/CD Integration

```yaml
# .github/workflows/migrate.yml
deploy:
  steps:
    - name: Run migrations
      run: pnpm drizzle-kit migrate
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}

    - name: Verify migrations
      run: pnpm drizzle-kit check
```

---

## Common Migration Scenarios

### Adding a New Column

```sql
ALTER TABLE billing_customers
  ADD COLUMN preferred_timezone VARCHAR(50) DEFAULT 'UTC';
```

### Adding an Index

```sql
CREATE INDEX CONCURRENTLY idx_subscriptions_plan
  ON billing_subscriptions(plan_id)
  WHERE deleted_at IS NULL;
```

### Changing Column Type

```sql
-- Add new column
ALTER TABLE billing_payments ADD COLUMN amount_bigint BIGINT;

-- Migrate data
UPDATE billing_payments SET amount_bigint = amount::BIGINT;

-- Swap columns
ALTER TABLE billing_payments DROP COLUMN amount;
ALTER TABLE billing_payments RENAME COLUMN amount_bigint TO amount;
```

### Adding a New Table

```sql
CREATE TABLE billing_subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  addon_id VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Related Documents

- [Data Model Overview](./OVERVIEW.md)
- [Table Definitions](./TABLES.md)
- [Schema Patterns](./PATTERNS.md)
