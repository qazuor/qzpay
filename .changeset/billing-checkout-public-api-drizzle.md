---
'@qazuor/qzpay-drizzle': minor
---

feat(drizzle): persist checkout sessions in billing_checkouts table

Implements the new `checkouts` slot on the Postgres storage adapter to
match the contract added in `@qazuor/qzpay-core` 1.5.0. Local checkout
sessions created by `billing.checkout.create()` now persist BEFORE the
provider call, so a process crash mid-flow never leaves an orphan
checkout on the provider side without a local trace.

**New artifacts**:

- `billing_checkouts` table (`schema/checkouts.schema.ts`) — columns for
  customer, mode, status (`open | complete | expired`), currency, line
  items (jsonb), success/cancel URLs, expires_at, paymentId /
  subscriptionId nullable FKs, providerSessionIds (jsonb), metadata,
  livemode, timestamps. Indexes on `customer_id`, `status`,
  `(customer_id, status)`, and `expires_at`.
- `mappers/checkout.mapper.ts` — `mapDrizzleCheckoutToCore`,
  `mapCoreCheckoutToDrizzle`, `mapCoreCheckoutUpdateToDrizzle` (the last
  one is the writeback path used by webhook handlers to flip status,
  link payment / subscription IDs, mark `completedAt`, etc.).
- `repositories/checkouts.repository.ts` — `findById / create / update /
  findByCustomerId / search`. Mirrors the subscriptions repository CRUD
  shape without the lifecycle / metrics methods that don't apply to
  short-lived session records.
- `adapter/drizzle-storage.adapter.ts` — instantiates the repository and
  wires the `checkouts` storage slot.

**Migration**: a migration SQL is NOT included in this release because
`drizzle-kit generate` surfaced a pre-existing schema drift unrelated to
this work (`provider_payment_id → provider_payment_ids` on
`billing_payments`). The integrator must run `drizzle-kit generate` in
their own environment after the drift is reconciled to produce a clean
`billing_checkouts` migration.
