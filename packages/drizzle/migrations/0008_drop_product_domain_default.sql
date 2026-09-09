-- Migration: Drop the product_domain column default
-- Created: 2026-09-09
-- Description: Removes `DEFAULT 'accommodation'` from
-- `billing_plans.product_domain` and `billing_subscriptions.product_domain`.
-- Both columns stay NOT NULL, so after this an insert that omits the column
-- fails outright instead of quietly filing the row under one application's
-- primary product line.
--
-- WHY A DEFAULT WAS THE WRONG TOOL HERE
--
-- `'accommodation'` is one specific consumer's product line, which a generic
-- payments package has no business naming. And the default did not behave the
-- way a default reads: a caller that omitted the column did not get "no
-- domain", it got that one. Measured in production across two databases: every
-- plan row of a SECOND product line, and every subscription on one, reported
-- `product_domain = 'accommodation'`. Not one line of code was wrong — the
-- value was simply never stated, and the default answered for a whole vertical
-- for as long as those plans had existed.
--
-- The type system could not help: while the default exists, `productDomain` is
-- OPTIONAL in Drizzle's insert type, so the compiler has no opinion on the
-- omission. Removing it is what turns a silent, plausible wrong row into a
-- failure.
--
-- ─────────────────────────────────────────────────────────────────────────
-- RUN ORDER — THIS IS NOT SAFE TO APPLY ON ITS OWN
-- ─────────────────────────────────────────────────────────────────────────
--
-- Every write that creates a plan or a subscription must ALREADY state its
-- domain before this runs. One that does not stops working the moment this
-- lands — not degraded, rejected — and if that write is a paid checkout, it
-- takes the checkout down for every product line at the first attempt.
--
-- Confirm first, then apply. The first adopter does it with a CI guard that
-- reads every create site and fails on an omission (conditional spreads and
-- keys nested in a metadata blob explicitly do not count as stating it).
--
-- No backfill precedes this. A DEFAULT only applies to inserts that omit the
-- column; dropping it changes nothing about rows already stored, and there are
-- no NULLs to repair because the column has been NOT NULL throughout.
--
-- Rollback is non-destructive and restores the previous behaviour exactly:
-- see 0008_drop_product_domain_default_rollback.sql.

ALTER TABLE "billing_plans"
ALTER COLUMN "product_domain" DROP DEFAULT;

ALTER TABLE "billing_subscriptions"
ALTER COLUMN "product_domain" DROP DEFAULT;
