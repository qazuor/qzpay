-- Migration: Make the refund ledger idempotent by provider refund id
-- Created: 2026-08-21
-- Description: Replaces the plain lookup index `idx_refunds_provider_id`
-- with a PARTIAL UNIQUE index `idx_refunds_provider_refund_id_unique` on
-- `billing_refunds.provider_refund_id` (WHERE provider_refund_id IS NOT
-- NULL). `createRefund()` in packages/drizzle/src/repositories/payments.repository.ts
-- now targets this index with `ON CONFLICT ... DO NOTHING`.
--
-- WHY: HOS-669 made `payments.refund()` derive `refunded` vs
-- `partially_refunded` from SUM(amount) over every settled row in
-- billing_refunds for a payment (storage.payments.getTotalRefundedAmount),
-- instead of comparing only the current call's amount. That fix introduced
-- a NEW risk: `createRefund()` was called unconditionally, with nothing
-- stopping the SAME settled provider refund from being persisted twice.
--
-- Realistic trigger: a 10.000 payment is refunded 5.000; the HTTP response
-- is lost to a network blip after MercadoPago already processed it; the
-- caller/operator retries and MP returns the SAME providerRefundId for the
-- already-processed refund. Without this constraint that produces TWO
-- 5.000 rows, SUM() reports 10.000, and the payment is marked `refunded`
-- having actually returned only half the money — a money-losing bug in the
-- opposite direction of the one HOS-669 fixed, and silent: nothing throws.
--
-- This is a PARTIAL index (WHERE provider_refund_id IS NOT NULL) because
-- the column is nullable — a local-only refund with no payment adapter
-- configured has no provider id to deduplicate against, and NULL values
-- must never collide with each other under a UNIQUE constraint.
--
-- SAFETY: unlike 0005, this TIGHTENS the constraint and CAN fail against
-- existing data if a duplicate provider_refund_id already exists. Before
-- creating the index, delete any duplicate rows sharing a
-- provider_refund_id, keeping only the OLDEST (by created_at, then id) —
-- the extra rows are exactly the double-persisted events this migration
-- exists to prevent, so removing them corrects any already-inflated
-- accumulated total instead of merely hiding the problem going forward.

-- Retire any pre-existing duplicate settled events for the same provider
-- refund id, keeping only the oldest row per id.
DELETE FROM "billing_refunds" AS dup
WHERE dup."provider_refund_id" IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM "billing_refunds" AS keep
      WHERE keep."provider_refund_id" = dup."provider_refund_id"
        AND (keep."created_at", keep."id") < (dup."created_at", dup."id")
  );

DROP INDEX IF EXISTS "idx_refunds_provider_id";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_refunds_provider_refund_id_unique"
ON "billing_refunds" ("provider_refund_id")
WHERE "provider_refund_id" IS NOT NULL;
