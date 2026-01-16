-- Rollback migration: Remove fields added in 0002_add_missing_core_fields
-- Created: 2026-01-15
-- Description: Rollback changes from adding missing Core type fields

-- Restore provider_payment_id in billing_payments
-- Step 1: Add back the provider_payment_id column
ALTER TABLE "billing_payments"
ADD COLUMN IF NOT EXISTS "provider_payment_id" VARCHAR(255);

-- Step 2: Migrate data back from provider_payment_ids to provider_payment_id
UPDATE "billing_payments"
SET "provider_payment_id" = (
    SELECT value
    FROM jsonb_each_text("provider_payment_ids")
    ORDER BY key
    LIMIT 1
)
WHERE "provider_payment_ids" IS NOT NULL
  AND "provider_payment_ids" != '{}'::jsonb;

-- Step 3: Recreate the index
CREATE INDEX IF NOT EXISTS "idx_payments_provider_id" ON "billing_payments" ("provider_payment_id");

-- Step 4: Drop provider_payment_ids column
ALTER TABLE "billing_payments"
DROP COLUMN IF EXISTS "provider_payment_ids";

-- Remove status field from billing_payment_methods
ALTER TABLE "billing_payment_methods"
DROP COLUMN IF EXISTS "status";

-- Remove payout_schedule field from billing_vendors
ALTER TABLE "billing_vendors"
DROP COLUMN IF EXISTS "payout_schedule";

-- Remove cancel_at_period_end field from billing_subscriptions
ALTER TABLE "billing_subscriptions"
DROP COLUMN IF EXISTS "cancel_at_period_end";

-- Remove phone field from billing_customers
ALTER TABLE "billing_customers"
DROP COLUMN IF EXISTS "phone";
