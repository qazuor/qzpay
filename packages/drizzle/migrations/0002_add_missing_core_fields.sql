-- Migration: Add missing fields from Core types
-- Created: 2026-01-15
-- Description: Adds fields that exist in Core types but were missing in Drizzle schemas

-- Add phone field to billing_customers
ALTER TABLE "billing_customers"
ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);

-- Add cancel_at_period_end field to billing_subscriptions
ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN DEFAULT false;

-- Add payout_schedule field to billing_vendors
ALTER TABLE "billing_vendors"
ADD COLUMN IF NOT EXISTS "payout_schedule" JSONB;

-- Add status field to billing_payment_methods
ALTER TABLE "billing_payment_methods"
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) NOT NULL DEFAULT 'active';

-- Rename and migrate provider_payment_id to provider_payment_ids in billing_payments
-- Step 1: Add new JSONB column
ALTER TABLE "billing_payments"
ADD COLUMN IF NOT EXISTS "provider_payment_ids" JSONB DEFAULT '{}';

-- Step 2: Migrate existing data from provider_payment_id to provider_payment_ids
UPDATE "billing_payments"
SET "provider_payment_ids" = jsonb_build_object(
    COALESCE("provider", 'unknown'),
    "provider_payment_id"
)
WHERE "provider_payment_id" IS NOT NULL
  AND "provider_payment_ids" = '{}'::jsonb;

-- Step 3: Drop the old provider_payment_id column and its index
DROP INDEX IF EXISTS "idx_payments_provider_id";
ALTER TABLE "billing_payments"
DROP COLUMN IF EXISTS "provider_payment_id";
