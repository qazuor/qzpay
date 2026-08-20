-- Migration: Scope the polling-jobs active-uniqueness to the RESOURCE, not the subscription
-- Created: 2026-08-20
-- Description: Replaces the partial unique index
-- `idx_polling_jobs_one_active_per_sub` (subscription_id WHERE status='pending')
-- with `idx_polling_jobs_one_active_per_resource`
-- ((provider, provider_resource_id) WHERE status='pending').
--
-- WHY: the subscription-scoped index silently broke every one-time-payment
-- flow. A subscription can legitimately have SEVERAL concurrent one-time
-- checkouts in flight (e.g. two add-on purchases), and they all hang off the
-- same subscription_id, so the first checkout -- even an ABANDONED one -- held
-- the only slot for its whole lifetime. Every later enqueue hit the unique
-- violation and `create()` returned NULL, leaving those purchases with no
-- polling job at all. Because MercadoPago Preferences deliver no Webhooks v2
-- event, polling is their ONLY activation path, so a rejected enqueue meant an
-- approved payment was never recorded anywhere.
--
-- Measured on 2026-08-20: of four checkouts on one subscription, the two that
-- were actually PAID were exactly the two whose enqueue this index rejected.
--
-- `provider` is part of the new key because resource ids are only unique
-- within a single provider's namespace.
--
-- SAFETY: this RELAXES the constraint (any row set legal before stays legal),
-- so it cannot fail on existing data -- with one exception, handled below.

-- The new index is stricter in exactly one respect: it forbids two pending
-- jobs sharing a (provider, provider_resource_id). That should never exist,
-- but a historical duplicate would make CREATE UNIQUE INDEX fail. Retire any
-- such duplicate first, keeping the oldest row of each group.
UPDATE "billing_subscription_polling_jobs" AS j
SET "status" = 'cancelled',
    "completed_at" = NOW(),
    "last_error" = 'superseded_by_one_active_per_resource_migration'
WHERE j."status" = 'pending'
  AND EXISTS (
      SELECT 1
      FROM "billing_subscription_polling_jobs" AS keep
      WHERE keep."status" = 'pending'
        AND keep."provider" = j."provider"
        AND keep."provider_resource_id" = j."provider_resource_id"
        AND (keep."created_at", keep."id") < (j."created_at", j."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "idx_polling_jobs_one_active_per_resource"
ON "billing_subscription_polling_jobs" ("provider", "provider_resource_id")
WHERE "status" = 'pending';

DROP INDEX IF EXISTS "idx_polling_jobs_one_active_per_sub";
