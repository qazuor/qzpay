# Migration Commands Reference

Quick reference for managing database migrations in QZPay Drizzle package.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Build schema
pnpm build
```

## Common Commands

### Apply Migrations

```bash
# Apply all pending migrations
pnpm drizzle-kit migrate

# Push schema directly (development only, skips migrations)
pnpm drizzle-kit push
```

### Generate Migrations

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Generate migration with custom name
pnpm drizzle-kit generate --name add_new_indexes
```

### View Schema

```bash
# Open Drizzle Studio (visual database explorer)
pnpm drizzle-kit studio
```

### Check Migration Status

```bash
# View current migration status
pnpm drizzle-kit check

# View migration history
pnpm drizzle-kit history
```

## Manual Migration Management

### Apply Single Migration

```bash
# Using psql
psql $DATABASE_URL -f migrations/0001_add_composite_indexes.sql

# Or with connection details
psql -h localhost -U postgres -d qzpay_dev -f migrations/0001_add_composite_indexes.sql
```

### Rollback Migration

```bash
# Apply rollback script
psql $DATABASE_URL -f migrations/0001_add_composite_indexes_rollback.sql
```

### Check Applied Migrations

```sql
-- Query drizzle migrations table
SELECT * FROM __drizzle_migrations
ORDER BY created_at DESC;
```

## Validation Commands

### Check Index Existence

```sql
-- List all indexes on billing tables
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename LIKE 'billing_%'
ORDER BY tablename, indexname;
```

### Verify Composite Indexes

```sql
-- Check if composite indexes from 0001 exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname IN (
        'idx_subscriptions_customer_status',
        'idx_payments_customer_status',
        'idx_invoices_customer_status',
        'idx_payments_subscription_status',
        'idx_invoices_subscription_status'
    );
```

### Check Index Usage Statistics

```sql
-- View index usage stats
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename LIKE 'billing_%'
ORDER BY idx_scan DESC;
```

### Find Unused Indexes

```sql
-- Indexes with zero scans (candidates for removal)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

## Performance Testing

### Test Query Performance

```sql
-- Enable timing
\timing on

-- Test with EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM billing_subscriptions
WHERE customer_id = 'your-uuid-here'
    AND status = 'active';
```

### Compare Before/After

```sql
-- Disable index temporarily to compare
SET enable_indexscan = OFF;
EXPLAIN ANALYZE [your query];
SET enable_indexscan = ON;

-- With index
EXPLAIN ANALYZE [your query];
```

### Analyze Tables

```sql
-- Update statistics for query planner
ANALYZE billing_subscriptions;
ANALYZE billing_payments;
ANALYZE billing_invoices;
ANALYZE billing_usage_records;
ANALYZE billing_payment_methods;
ANALYZE billing_customers;

-- Or analyze all tables
ANALYZE;
```

## Maintenance Commands

### Rebuild Indexes

```sql
-- Rebuild index (locks table)
REINDEX INDEX idx_subscriptions_customer_status;

-- Rebuild index concurrently (no locks, production safe)
REINDEX INDEX CONCURRENTLY idx_subscriptions_customer_status;

-- Rebuild all indexes on a table
REINDEX TABLE billing_subscriptions;
```

### Check Index Bloat

```sql
-- Estimate index bloat
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename LIKE 'billing_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### Vacuum Tables

```sql
-- Vacuum to reclaim space
VACUUM ANALYZE billing_subscriptions;

-- Full vacuum (locks table)
VACUUM FULL billing_subscriptions;
```

## Production Deployment

### Safe Production Migration

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Create indexes concurrently (modify SQL)
# Edit migration to add CONCURRENTLY keyword
sed 's/CREATE INDEX IF NOT EXISTS/CREATE INDEX CONCURRENTLY IF NOT EXISTS/g' \
    migrations/0001_add_composite_indexes.sql > migrations/0001_concurrent.sql

# 3. Apply concurrent migration
psql $DATABASE_URL -f migrations/0001_concurrent.sql

# 4. Verify indexes
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%_customer_status';"

# 5. Analyze tables
psql $DATABASE_URL -c "ANALYZE;"
```

### Monitor Migration Progress

```sql
-- View index creation progress
SELECT
    phase,
    round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS percent_done,
    tuples_done,
    tuples_total
FROM pg_stat_progress_create_index;
```

## Troubleshooting

### Reset Statistics

```sql
-- Reset index statistics
SELECT pg_stat_reset();

-- Reset specific table statistics
SELECT pg_stat_reset_single_table_counters('billing_subscriptions'::regclass);
```

### Check Locks

```sql
-- View current locks
SELECT
    l.pid,
    l.mode,
    l.granted,
    d.datname,
    c.relname
FROM pg_locks l
JOIN pg_database d ON l.database = d.oid
JOIN pg_class c ON l.relation = c.oid
WHERE d.datname = current_database()
ORDER BY l.pid;
```

### Kill Long-Running Query

```sql
-- Find long-running queries
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query
FROM pg_stat_activity
WHERE state = 'active'
    AND now() - pg_stat_activity.query_start > interval '5 minutes';

-- Terminate specific query
SELECT pg_terminate_backend(pid);
```

## Environment Variables

### Development

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qzpay_dev"
```

### Staging

```bash
export DATABASE_URL="postgresql://user:pass@staging-host:5432/qzpay_staging"
```

### Production

```bash
export DATABASE_URL="postgresql://user:pass@prod-host:5432/qzpay_prod"
# Use SSL
export DATABASE_URL="postgresql://user:pass@prod-host:5432/qzpay_prod?sslmode=require"
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `pnpm drizzle-kit migrate` | Apply all pending migrations |
| `pnpm drizzle-kit push` | Push schema directly (dev only) |
| `pnpm drizzle-kit generate` | Generate migration from schema |
| `pnpm drizzle-kit studio` | Open Drizzle Studio |
| `pnpm drizzle-kit check` | Check migration status |
| `ANALYZE;` | Update database statistics |
| `REINDEX INDEX CONCURRENTLY` | Rebuild index safely |
| `VACUUM ANALYZE` | Reclaim space and update stats |

## Documentation

- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Migration README](./README.md)
- [Migration Guide](../MIGRATION_GUIDE.md)
- [Performance Examples](./PERFORMANCE_EXAMPLES.md)
