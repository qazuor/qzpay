---
'@qazuor/qzpay-core': major
'@qazuor/qzpay-drizzle': major
---

**BREAKING** — `QZPayCreatePlanInput.productDomain` is now required, and the
Drizzle plan mapper carries it.

The subscription side got this one release earlier. The plan side was missed, and
the gap was worse than "not done yet": `mapCorePlanCreateToDrizzle` builds the
insert field-by-field off `QZPayCreatePlanInput`, so a `productDomain` passed to
`plans.create()` was **dropped on the floor** and the column default answered
instead. A caller could not state a plan's domain even when it wanted to, and
nothing said so — the row came back looking correct.

Measured: a test calling
`adapter.plans.create({ productDomain: 'test', name: 'Pro Plan', ... })` stored
`product_domain` as the default, not `'test'`.

## Migrating

Add `productDomain` to every `plans.create()` call. There is no sensible default
to fall back on — that is the point; a value invented here is one product line
answering for another.

Pair this with the `billing_plans` half of migration
`0008_drop_product_domain_default.sql`. The order is the same as for
subscriptions and it is not negotiable: state the domain at every create site
FIRST, then drop the database default. Dropping it while a create still omits the
column rejects that create outright.
