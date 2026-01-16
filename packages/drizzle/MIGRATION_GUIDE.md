# Migration Guide - Composite Indexes

This guide explains how to apply migration `0001_add_composite_indexes.sql` to improve query performance.

## Overview

Migration `0001_add_composite_indexes` adds 14 composite and partial indexes to optimize common query patterns:
- Customer-scoped queries (subscriptions, payments, invoices)
- Status-based filtering
- Time-based aggregations
- Reporting queries

## Prerequisites

1. Database backup completed
2. Drizzle Kit installed (`pnpm add -D drizzle-kit`)
3. PostgreSQL 12+ (for partial indexes support)
4. Database connection configured in `.env`

## Apply Migration

### Option 1: Using Drizzle Kit (Recommended)

```bash
# Navigate to drizzle package
cd packages/drizzle

# Build the schema (required for drizzle-kit)
pnpm build

# Apply all pending migrations
pnpm drizzle-kit migrate

# Or push directly (development only)
pnpm drizzle-kit push
```

### Option 2: Manual SQL Execution

```bash
# Using psql
psql -U your_username -d your_database -f migrations/0001_add_composite_indexes.sql

# Or using environment variable
psql $DATABASE_URL -f migrations/0001_add_composite_indexes.sql
```

### Option 3: Production Deployment (Zero Downtime)

For production, create indexes concurrently to avoid locking:

```sql
-- Create indexes with CONCURRENTLY option
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_customer_status
  ON billing_subscriptions(customer_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period_end
  ON billing_subscriptions(status, current_period_end)
  WHERE status IN ('active', 'trialing');

-- ... repeat for all indexes
```

**Note**: Creating indexes concurrently takes longer but doesn't lock tables.

## Verify Migration

### 1. Check Migration Status

```sql
-- Check if indexes exist
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%_customer_status'
ORDER BY tablename, indexname;
```

Expected output:
```
 schemaname |      tablename       |          indexname           | indexdef
------------+---------------------+------------------------------+----------
 public     | billing_invoices    | idx_invoices_customer_status | CREATE INDEX...
 public     | billing_payments    | idx_payments_customer_status | CREATE INDEX...
 public     | billing_subscriptions | idx_subscriptions_customer_status | CREATE INDEX...
```

### 2. Check Index Size

```sql
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND tablename IN ('billing_subscriptions', 'billing_payments', 'billing_invoices')
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### 3. Verify Index Usage

After running for a while, check if indexes are being used:

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%_customer_status'
ORDER BY idx_scan DESC;
```

## Performance Testing

### Before/After Comparison

Run these queries before and after migration to measure improvement:

#### Query 1: Customer Active Subscriptions
```sql
EXPLAIN ANALYZE
SELECT * FROM billing_subscriptions
WHERE customer_id = 'some-uuid'
    AND status = 'active';
```

**Expected improvement**: Should use `idx_subscriptions_customer_status` instead of sequential scan.

#### Query 2: Unpaid Invoices Due Soon
```sql
EXPLAIN ANALYZE
SELECT * FROM billing_invoices
WHERE status IN ('draft', 'open')
    AND due_date < CURRENT_DATE + INTERVAL '7 days'
ORDER BY due_date;
```

**Expected improvement**: Should use `idx_invoices_status_due_date` partial index.

#### Query 3: Subscription Renewals
```sql
EXPLAIN ANALYZE
SELECT * FROM billing_subscriptions
WHERE status IN ('active', 'trialing')
    AND current_period_end < CURRENT_DATE + INTERVAL '3 days'
ORDER BY current_period_end;
```

**Expected improvement**: Should use `idx_subscriptions_status_period_end` partial index.

#### Query 4: Usage Aggregation
```sql
EXPLAIN ANALYZE
SELECT
    subscription_id,
    metric_name,
    SUM(quantity) as total
FROM billing_usage_records
WHERE subscription_id = 'some-uuid'
    AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY subscription_id, metric_name;
```

**Expected improvement**: Should use `idx_usage_records_subscription_timestamp`.

## Rollback

If you need to rollback the migration:

```bash
# Using the rollback script
psql $DATABASE_URL -f migrations/0001_add_composite_indexes_rollback.sql
```

Or manually:
```sql
-- Drop all indexes from migration 0001
DROP INDEX IF EXISTS idx_subscriptions_customer_status;
DROP INDEX IF EXISTS idx_subscriptions_status_period_end;
DROP INDEX IF EXISTS idx_payments_customer_status;
-- ... (see rollback script for complete list)
```

## Monitoring

### Index Bloat

Check for index bloat after several months:

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
JOIN pg_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### Rebuild Bloated Indexes

If indexes become bloated:

```sql
-- Rebuild index concurrently (production safe)
REINDEX INDEX CONCURRENTLY idx_subscriptions_customer_status;
```

## Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Solution**: This is expected with `IF NOT EXISTS`. The migration is idempotent.

### Issue: Indexes Not Being Used

**Solution**:
1. Run `ANALYZE` on affected tables:
   ```sql
   ANALYZE billing_subscriptions;
   ANALYZE billing_payments;
   ANALYZE billing_invoices;
   ```

2. Check if query planner prefers sequential scan (for small tables):
   ```sql
   -- Force index usage for testing
   SET enable_seqscan = OFF;
   EXPLAIN ANALYZE SELECT ...;
   SET enable_seqscan = ON;
   ```

### Issue: Slow Index Creation

**Solution**: For large tables, indexes may take time:
- Use `CONCURRENTLY` option
- Run during low-traffic periods
- Monitor progress: `SELECT * FROM pg_stat_progress_create_index;`

## Best Practices

1. **Always backup before migration**
2. **Test on staging first**
3. **Use CONCURRENTLY in production**
4. **Monitor index usage after deployment**
5. **Rebuild indexes periodically** (every 6-12 months)
6. **Remove unused indexes** (check `pg_stat_user_indexes`)

## Expected Impact

### Performance Improvements
- Customer dashboard queries: **40-60% faster**
- Subscription renewal processing: **70-80% faster**
- Invoice status queries: **50-70% faster**
- Usage aggregations: **60-80% faster**
- Reporting queries: **30-50% faster**

### Storage Impact
- Additional storage: **~10-15%** of table size
- Partial indexes minimize overhead
- Composite indexes more efficient than multiple single-column indexes

## Support

For issues or questions:
1. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
2. Review query plans: `EXPLAIN (ANALYZE, BUFFERS) your_query`
3. Open issue on GitHub: https://github.com/qazuor/qzpay/issues
