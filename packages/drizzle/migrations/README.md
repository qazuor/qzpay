# Database Migrations

This directory contains all database migrations for the QZPay billing system.

## Migration Files

### 0000_safe_spirit.sql
Initial schema creation with all tables and basic indexes.

**Tables created:**
- `billing_customers` - Customer records with payment provider IDs
- `billing_subscriptions` - Subscription lifecycle management
- `billing_payments` - Payment transactions
- `billing_refunds` - Payment refunds
- `billing_invoices` - Invoice documents
- `billing_invoice_lines` - Invoice line items
- `billing_invoice_payments` - Invoice-payment relationships
- `billing_payment_methods` - Customer payment methods
- `billing_usage_records` - Metered usage records
- `billing_plans` - Product plans
- `billing_prices` - Plan pricing
- `billing_promo_codes` - Promotional codes
- `billing_promo_code_usage` - Promo code usage tracking
- `billing_vendors` - Vendor/merchant accounts
- `billing_vendor_payouts` - Vendor payouts
- `billing_entitlements` - Feature entitlements
- `billing_customer_entitlements` - Customer entitlements
- `billing_limits` - Usage limits
- `billing_customer_limits` - Customer limits
- `billing_webhook_events` - Webhook event processing
- `billing_webhook_dead_letter` - Failed webhook events
- `billing_audit_logs` - Audit trail
- `billing_idempotency_keys` - Idempotency tracking

**Indexes created:**
- Single-column indexes for foreign keys
- Single-column indexes for status fields
- Single-column indexes for provider IDs
- Timestamp indexes for time-based queries

### 0001_add_composite_indexes.sql
Performance optimization with composite indexes for common query patterns.

**Indexes added:**

#### Query Performance
- `idx_subscriptions_customer_status` - Filter subscriptions by customer and status
- `idx_payments_customer_status` - Filter payments by customer and status
- `idx_invoices_customer_status` - Filter invoices by customer and status

#### Relational Queries
- `idx_payments_subscription_status` - Filter payments by subscription and status
- `idx_invoices_subscription_status` - Filter invoices by subscription and status

#### Time-based Queries
- `idx_subscriptions_status_period_end` - Active subscriptions due for renewal (partial index)
- `idx_invoices_status_due_date` - Unpaid invoices by due date (partial index)
- `idx_usage_records_subscription_timestamp` - Usage records aggregation
- `idx_invoices_period_start_end` - Invoices by billing period

#### Aggregation Queries
- `idx_usage_records_subscription_metric` - Usage by subscription and metric

#### Lookup Queries
- `idx_payment_methods_customer_default` - Find default payment method (partial index)

#### Reporting Queries
- `idx_payments_created_at` - Payments by creation date (partial index, excludes soft-deleted)
- `idx_subscriptions_created_at` - Subscriptions by creation date (partial index, excludes soft-deleted)
- `idx_customers_deleted_at` - Active customers filter (partial index)

**Index Types:**
- **Composite indexes**: Multiple columns for complex queries
- **Partial indexes**: Include WHERE clause to reduce index size
- **Covering indexes**: Include all columns needed for specific queries

## Running Migrations

### Using Drizzle Kit

```bash
# Push migrations to database
pnpm drizzle-kit push

# Or migrate explicitly
pnpm drizzle-kit migrate
```

### Manual Migration

```bash
# Run a specific migration
psql -U username -d database_name -f migrations/0001_add_composite_indexes.sql
```

## Migration Best Practices

1. **Always use IF NOT EXISTS**: Ensures idempotency
2. **Create indexes concurrently**: For production databases (add CONCURRENTLY keyword)
3. **Test before production**: Run migrations on staging first
4. **Backup before migrating**: Always backup production data
5. **Monitor index usage**: Use `pg_stat_user_indexes` to verify index usage

## Index Strategy

### When to Use Composite Indexes

Composite indexes are beneficial when:
- Queries filter by multiple columns (e.g., `customer_id AND status`)
- ORDER BY uses multiple columns
- Queries need covering index (all columns in SELECT)

### Partial Index Benefits

Partial indexes reduce storage and improve performance by:
- Only indexing rows that match WHERE condition
- Smaller index size means faster scans
- Useful for status-based queries (e.g., only active records)

### Index Maintenance

Monitor index usage:
```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

Remove unused indexes:
```sql
-- Find indexes with zero scans
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname = 'public'
    AND indexname NOT LIKE '%_pkey';
```

## Rollback

To rollback the composite indexes migration:

```sql
-- Drop all composite indexes from 0001
DROP INDEX IF EXISTS idx_subscriptions_customer_status;
DROP INDEX IF EXISTS idx_subscriptions_status_period_end;
DROP INDEX IF EXISTS idx_payments_customer_status;
DROP INDEX IF EXISTS idx_payments_subscription_status;
DROP INDEX IF EXISTS idx_invoices_customer_status;
DROP INDEX IF EXISTS idx_invoices_subscription_status;
DROP INDEX IF EXISTS idx_invoices_status_due_date;
DROP INDEX IF EXISTS idx_usage_records_subscription_timestamp;
DROP INDEX IF EXISTS idx_usage_records_subscription_metric;
DROP INDEX IF EXISTS idx_payment_methods_customer_default;
DROP INDEX IF EXISTS idx_payments_created_at;
DROP INDEX IF EXISTS idx_subscriptions_created_at;
DROP INDEX IF EXISTS idx_customers_deleted_at;
DROP INDEX IF EXISTS idx_invoices_period_start_end;
```

## Performance Impact

Expected improvements:
- **Customer dashboard**: 40-60% faster (customer_id + status queries)
- **Subscription renewals**: 70-80% faster (partial index on active subscriptions)
- **Invoice queries**: 50-70% faster (composite indexes on customer/subscription + status)
- **Usage aggregations**: 60-80% faster (subscription + timestamp index)
- **Reporting queries**: 30-50% faster (created_at partial indexes)

Storage overhead:
- Approximately 10-15% increase in total database size
- All indexes use B-tree structure (efficient for range queries)
- Partial indexes minimize storage impact
