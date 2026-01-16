-- Add composite indexes for common query patterns
-- Migration: 0001_add_composite_indexes
-- Created: 2026-01-15

-- Subscriptions: Query by customer and status (very common pattern)
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_status ON billing_subscriptions(customer_id, status);

-- Subscriptions: Query active subscriptions due for renewal
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period_end ON billing_subscriptions(status, current_period_end) WHERE status IN ('active', 'trialing');

-- Payments: Query by customer and status
CREATE INDEX IF NOT EXISTS idx_payments_customer_status ON billing_payments(customer_id, status);

-- Payments: Query by subscription and status
CREATE INDEX IF NOT EXISTS idx_payments_subscription_status ON billing_payments(subscription_id, status);

-- Invoices: Query by customer and status
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status ON billing_invoices(customer_id, status);

-- Invoices: Query by subscription and status
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_status ON billing_invoices(subscription_id, status);

-- Invoices: Query unpaid invoices by due date
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date ON billing_invoices(status, due_date) WHERE status IN ('draft', 'open');

-- Usage Records: Query by subscription and timestamp for aggregations
CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_timestamp ON billing_usage_records(subscription_id, timestamp);

-- Usage Records: Query by subscription and metric
CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_metric ON billing_usage_records(subscription_id, metric_name);

-- Payment Methods: Query customer's default payment method
CREATE INDEX IF NOT EXISTS idx_payment_methods_customer_default ON billing_payment_methods(customer_id, is_default) WHERE is_default = true;

-- Payments: Query by created_at for reporting (with soft delete support)
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON billing_payments(created_at) WHERE deleted_at IS NULL;

-- Subscriptions: Query by created_at for reporting (with soft delete support)
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON billing_subscriptions(created_at) WHERE deleted_at IS NULL;

-- Customers: Query active customers (with soft delete support)
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON billing_customers(deleted_at) WHERE deleted_at IS NULL;

-- Invoices: Query invoices by period for reporting
CREATE INDEX IF NOT EXISTS idx_invoices_period_start_end ON billing_invoices(period_start, period_end);
