-- Migration: Promote plan display/price attributes from metadata jsonb to typed columns
-- Created: 2026-07-02
-- Description: Adds display_name, monthly_price_ars, and annual_price_ars as typed
-- top-level columns on billing_plans. These previously existed only as keys inside the
-- metadata jsonb column. NOT NULL columns get a placeholder DEFAULT so the statement
-- succeeds against existing rows; real backfill from metadata happens in the consuming
-- application's own migration (Hospeda HOS-39 T-003), not here.

-- Add display_name column (mirrors metadata.displayName)
ALTER TABLE "billing_plans"
ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(255) NOT NULL DEFAULT '';

-- Add monthly_price_ars column (mirrors metadata.monthlyPriceArs)
ALTER TABLE "billing_plans"
ADD COLUMN IF NOT EXISTS "monthly_price_ars" INTEGER NOT NULL DEFAULT 0;

-- Add annual_price_ars column (mirrors metadata.annualPriceArs; nullable — not every plan has an annual price)
ALTER TABLE "billing_plans"
ADD COLUMN IF NOT EXISTS "annual_price_ars" INTEGER;
