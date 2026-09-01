-- Migration: Add subscription courtesy-window columns
-- Created: 2026-09-01
-- Description: Adds `courtesy_starts_at`, `courtesy_ends_at` and
-- `courtesy_cycles_granted` to `billing_subscriptions`. These promote to
-- first-class typed columns three fields the first adopter (Hospeda) had been
-- keeping inside the `metadata` jsonb because qzpay-drizzle did not declare
-- them — same pattern as 0004_add_billing_generic_extension_columns.sql.
--
-- All three are nullable and get no DEFAULT: a subscription that was never
-- gifted anything carries NULL in all three, which is the overwhelmingly
-- common case, so existing rows need no backfill. A consumer migrating off a
-- jsonb-backed implementation owns moving its own data across.
--
-- The three columns are written together. A window with an end but no start
-- (or vice versa) is a half-written record, and a consumer that reads it as
-- live would hand out free entitlements — qzpay stores, it does not enforce
-- that pairing, so the consuming application must.
--
-- The index is PARTIAL on purpose: only rows inside a window can expire, and
-- they are a small minority, so indexing just those keeps an expiry sweep
-- proportional to the number of open gifts rather than the size of the table.
-- Same reasoning as idx_subscriptions_pending_plan_change.

ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "courtesy_starts_at" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "courtesy_ends_at" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "billing_subscriptions"
ADD COLUMN IF NOT EXISTS "courtesy_cycles_granted" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_subscriptions_courtesy_expiry"
ON "billing_subscriptions" ("courtesy_ends_at")
WHERE "courtesy_ends_at" IS NOT NULL;
