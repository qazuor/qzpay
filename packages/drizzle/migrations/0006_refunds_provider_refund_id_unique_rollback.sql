-- Rollback for 0006_refunds_provider_refund_id_unique.sql
--
-- WARNING: this removes the idempotency guarantee on the refund ledger.
-- `createRefund()`'s `ON CONFLICT` target
-- (`idx_refunds_provider_refund_id_unique`) will silently stop matching a
-- real index, so calling this without also reverting
-- `payments.repository.ts#createRefund` reintroduces HOS-669's duplicate-
-- refund risk: nothing stops the same settled provider refund from being
-- persisted twice and inflating `getTotalRefundedAmount()`.
--
-- The DELETE performed by the forward migration (retiring duplicate
-- provider_refund_id rows) is NOT reversible — those rows are gone.
DROP INDEX IF EXISTS "idx_refunds_provider_refund_id_unique";

CREATE INDEX IF NOT EXISTS "idx_refunds_provider_id"
ON "billing_refunds" ("provider_refund_id");
