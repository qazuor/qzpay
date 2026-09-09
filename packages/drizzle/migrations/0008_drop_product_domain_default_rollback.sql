-- Rollback for 0008_drop_product_domain_default.sql
--
-- NON-DESTRUCTIVE. A column DEFAULT governs only future inserts that omit the
-- column, so restoring it discards nothing and rewrites no stored row. Every
-- `product_domain` already recorded keeps the value it has.
--
-- What it DOES restore is the failure mode the forward migration exists to
-- remove: with the default back, a create that omits the column succeeds again
-- and files the row under `'accommodation'`, whatever product line it actually
-- belongs to. That is silent and plausible — no error, no log line, and a row
-- that reads as correct.
--
-- So this is the right lever for exactly one situation: the drop landed while
-- some create site still omitted the domain, and inserts are failing in
-- production right now. Run it to stop the bleeding, fix the offending write,
-- then re-apply 0008. It is not a way to keep the default.

ALTER TABLE "billing_plans"
ALTER COLUMN "product_domain" SET DEFAULT 'accommodation';

ALTER TABLE "billing_subscriptions"
ALTER COLUMN "product_domain" SET DEFAULT 'accommodation';
