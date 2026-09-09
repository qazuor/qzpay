---
'@qazuor/qzpay-drizzle': major
---

**BREAKING** — `product_domain` no longer has a column default.

`billing_plans.product_domain` and `billing_subscriptions.product_domain` dropped
`.default('accommodation')`. Both stay `NOT NULL`, so a create that omits the
column now fails outright instead of filing the row under one consumer's primary
product line.

The default was wrong twice over. `'accommodation'` names a specific
application's product line inside a generic payments package; and it did not
behave the way a default reads — a caller that omitted the column did not get
"no domain", it got that one. Measured in production across two databases: every
plan of a SECOND product line, and every subscription on one, reported
`product_domain = 'accommodation'`. Not one line of code was wrong. The value was
simply never stated, and the default answered for a whole vertical for as long as
those plans had existed. The type system could not help either: while the default
exists, `productDomain` is OPTIONAL in Drizzle's insert type.

## Migrating

**Order matters, and getting it wrong takes down checkout.** Every create of a
plan or a subscription must ALREADY state its domain before the database default
goes. One that does not is rejected — for every product line, at the first
insert.

1. Make every create state `productDomain`. A conditional spread
   (`...(x ? { productDomain } : {})`) and a key nested inside a `metadata` blob
   are NOT stating it — both still write a row on the default. Verify this
   mechanically rather than by reading; a CI guard that walks every create site
   is what makes it knowable.
2. Upgrade to this version.
3. Run `packages/drizzle/migrations/0008_drop_product_domain_default.sql`.

**Step 3 is not optional, and skipping it is silent.** Upgrading the package
changes the DDL emitted for a NEW database; an existing one keeps its column
default until that `ALTER TABLE ... DROP DEFAULT` runs. Between step 2 and step 3
an omitted write still succeeds, so nothing tells you the protection is not yet
in place.

No backfill is needed: a DEFAULT only applies to inserts that omit the column, so
dropping it changes no stored row, and there are no NULLs because the column has
been `NOT NULL` throughout. `0008_..._rollback.sql` restores the default and is
non-destructive — for stopping an incident, not for keeping the default.
