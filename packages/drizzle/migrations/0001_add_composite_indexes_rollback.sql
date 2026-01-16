-- Rollback migration: 0001_add_composite_indexes
-- This script removes all composite indexes added in migration 0001
-- Run this if you need to revert the composite indexes migration

-- Drop composite indexes for query performance
DROP INDEX IF EXISTS idx_subscriptions_customer_status;
DROP INDEX IF EXISTS idx_payments_customer_status;
DROP INDEX IF EXISTS idx_invoices_customer_status;

-- Drop composite indexes for relational queries
DROP INDEX IF EXISTS idx_payments_subscription_status;
DROP INDEX IF EXISTS idx_invoices_subscription_status;

-- Drop composite indexes for time-based queries
DROP INDEX IF EXISTS idx_subscriptions_status_period_end;
DROP INDEX IF EXISTS idx_invoices_status_due_date;
DROP INDEX IF EXISTS idx_usage_records_subscription_timestamp;
DROP INDEX IF EXISTS idx_invoices_period_start_end;

-- Drop composite indexes for aggregation queries
DROP INDEX IF EXISTS idx_usage_records_subscription_metric;

-- Drop composite indexes for lookup queries
DROP INDEX IF EXISTS idx_payment_methods_customer_default;

-- Drop composite indexes for reporting queries
DROP INDEX IF EXISTS idx_payments_created_at;
DROP INDEX IF EXISTS idx_subscriptions_created_at;
DROP INDEX IF EXISTS idx_customers_deleted_at;
