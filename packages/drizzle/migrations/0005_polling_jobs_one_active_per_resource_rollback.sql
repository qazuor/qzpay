-- Rollback for 0005_polling_jobs_one_active_per_resource.sql
--
-- WARNING: this restores the subscription-scoped uniqueness, which is the
-- constraint that caused approved one-time payments to go unrecorded. Only run
-- it if the new index itself is the problem.
--
-- Recreating the old index can FAIL where the fix has already been exercised:
-- any subscription that legitimately accumulated more than one pending job
-- (the whole point of the change) violates it. Retire the extras first,
-- keeping the oldest job per subscription.
UPDATE "billing_subscription_polling_jobs" AS j
SET "status" = 'cancelled',
    "completed_at" = NOW(),
    "last_error" = 'cancelled_by_one_active_per_resource_rollback'
WHERE j."status" = 'pending'
  AND EXISTS (
      SELECT 1
      FROM "billing_subscription_polling_jobs" AS keep
      WHERE keep."status" = 'pending'
        AND keep."subscription_id" = j."subscription_id"
        AND (keep."created_at", keep."id") < (j."created_at", j."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "idx_polling_jobs_one_active_per_sub"
ON "billing_subscription_polling_jobs" ("subscription_id")
WHERE "status" = 'pending';

DROP INDEX IF EXISTS "idx_polling_jobs_one_active_per_resource";
