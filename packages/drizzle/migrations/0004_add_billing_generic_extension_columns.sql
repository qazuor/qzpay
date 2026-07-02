-- Migration: Add generic multi-domain and promo-effect extension columns
-- Created: 2026-07-02
-- Description: Adds `product_domain` to `billing_subscriptions` and
-- `billing_plans`, `promo_effect_remaining_cycles` to `billing_subscriptions`,
-- and `effect_kind`/`value_kind`/`duration_cycles`/`extra_days` to
-- `billing_promo_codes`. These generalize columns the first adopter (Hospeda)
-- had added via its own app-level migration carril because qzpay-drizzle
-- didn't declare them, promoting them to first-class typed columns here —
-- same pattern as 0003_add_plan_typed_attribute_columns.sql. NOT NULL columns
-- get a placeholder DEFAULT so the statement succeeds against existing rows.
--
-- NOTE: `effect_kind` overlaps conceptually with the existing `type` column
-- (QZPayDiscountType — percentage/fixed_amount/free_trial) for the discount
-- and free_trial cases, but adds a third kind ('comp') that `type` has no
-- equivalent for. Left as two separate columns pending a broader
-- reconciliation — not resolved in this migration.

-- Add product_domain to billing_subscriptions (free-form domain discriminator)
ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "product_domain" VARCHAR(32) NOT NULL DEFAULT 'accommodation';

CREATE INDEX IF NOT EXISTS "idx_subscriptions_product_domain"
ON "billing_subscriptions" ("product_domain");

-- Add promo_effect_remaining_cycles to billing_subscriptions (multi-cycle discount countdown)
ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "promo_effect_remaining_cycles" INTEGER;

-- Add product_domain to billing_plans (mirrors billing_subscriptions.product_domain)
ALTER TABLE "billing_plans"
ADD COLUMN IF NOT EXISTS "product_domain" VARCHAR(32) NOT NULL DEFAULT 'accommodation';

CREATE INDEX IF NOT EXISTS "idx_plans_product_domain"
ON "billing_plans" ("product_domain");

-- Add typed effect columns to billing_promo_codes
ALTER TABLE "billing_promo_codes"
ADD COLUMN IF NOT EXISTS "effect_kind" VARCHAR(30) NOT NULL DEFAULT 'discount';

ALTER TABLE "billing_promo_codes"
ADD COLUMN IF NOT EXISTS "value_kind" VARCHAR(20);

ALTER TABLE "billing_promo_codes"
ADD COLUMN IF NOT EXISTS "duration_cycles" INTEGER;

ALTER TABLE "billing_promo_codes"
ADD COLUMN IF NOT EXISTS "extra_days" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_promo_codes_effect_kind"
ON "billing_promo_codes" ("effect_kind");
