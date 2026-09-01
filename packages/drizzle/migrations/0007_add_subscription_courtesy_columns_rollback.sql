-- Rollback for 0007_add_subscription_courtesy_columns.sql
--
-- DESTRUCTIVE: dropping these columns discards every complimentary window
-- recorded in them. A consumer that migrated its windows out of `metadata`
-- jsonb and into these columns has no other copy — run this only after
-- confirming the data is either expendable or has been copied back.

DROP INDEX IF EXISTS "idx_subscriptions_courtesy_expiry";

ALTER TABLE "billing_subscriptions"
DROP COLUMN IF EXISTS "courtesy_cycles_granted";

ALTER TABLE "billing_subscriptions"
DROP COLUMN IF EXISTS "courtesy_ends_at";

ALTER TABLE "billing_subscriptions"
DROP COLUMN IF EXISTS "courtesy_starts_at";
