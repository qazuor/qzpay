# @qazuor/qzpay-drizzle

## 1.7.7

### Patch Changes

- Updated dependencies [1732404]
  - @qazuor/qzpay-core@1.7.0

## 1.7.6

### Patch Changes

- Updated dependencies [9256ca7]
  - @qazuor/qzpay-core@1.6.5

## 1.7.5

### Patch Changes

- 7486eb2: Mark `billing_webhook_events.provider_event_id` as `uniqueIndex` instead of a plain index. Webhook handlers in downstream consumers rely on an optimistic-insert idempotency pattern that depends on a UNIQUE violation surfacing when the same provider event arrives twice — without the constraint the duplicate INSERT silently succeeds and the downstream dispatcher runs twice. Consumers will pick up the constraint on their next `drizzle-kit push` (the index name is unchanged, so the migration is a CREATE UNIQUE INDEX replacement).

## 1.7.4

### Patch Changes

- 23a1b5b: fix(core,drizzle): start `mode: 'paid'` subscriptions in `incomplete`, not `active`

  Prior to this fix, `billing.subscriptions.create({ mode: 'paid' })`
  inserted the local row with `status: 'active'` immediately, BEFORE the
  provider preapproval call landed and BEFORE the user authorized the
  recurring charge at the provider. Downstream code that keys off
  `active`/`trialing` status (entitlement gates, feature flags, plan
  benefits) granted features the instant the local row was created — a
  real freebie / entitlement-leak window that lasted until MercadoPago
  either authorized (good case) or rejected/expired (bad case, user kept
  features for free).

  The fix:

  1. **`@qazuor/qzpay-core`** — `billing.subscriptions.create` now
     propagates `input.mode` to the storage adapter's `create` input. The
     `QZPayCreateSubscriptionInput` type already declared `mode?: 'trial'
| 'paid'`; this just ensures the value reaches the adapter.
  2. **`@qazuor/qzpay-drizzle`** — the drizzle storage adapter now picks
     the initial status based on `mode`: `'incomplete'` for `mode: 'paid'`,
     `'trialing'` when a trial is active, `'active'` otherwise. The
     webhook handler is responsible for flipping `'incomplete'` to
     `'active'` once the provider confirms authorization.

  No behavior change for `mode: 'trial'` or callers that omit `mode` —
  the existing status selection (`'trialing'` or `'active'`) is
  preserved.

  Regression test added in `billing.test.ts` ('propagates input.mode to
  the storage adapter') that asserts the storage `create` mock receives
  `mode: 'paid'` in its input. Adapter-level coverage of the
  `mode → status` mapping is exercised end-to-end by Hospeda's
  monthly-checkout e2e suite (SPEC-143).

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.7.3

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.7.2

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

## 1.7.1

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.7.0

### Minor Changes

- 4d37d82: feat(drizzle): add `scheduled_plan_change` JSONB column to `billing_subscriptions`

  Adds the storage backend for the new `QZPayScheduledPlanChange`
  primitive introduced in qzpay-core. Persists the scheduled change as
  JSONB on `billing_subscriptions.scheduled_plan_change`, with a
  partial index supporting efficient scheduler queries.

  **Schema changes**:

  - New column `scheduled_plan_change jsonb` (nullable). Conforms to
    `QZPayScheduledPlanChange` from qzpay-core. `null` when no change
    is queued.
  - New partial index `idx_subscriptions_pending_plan_change` on
    `scheduled_plan_change` filtered by
    `scheduled_plan_change IS NOT NULL AND
(scheduled_plan_change->>'status') = 'pending'`. Keeps the
    scheduler's per-tick query at O(k) where k = #pending changes
    (NOT O(n) full table scan).

  **Mapper changes**:

  - `mapDrizzleSubscriptionToCore` reads `drizzle.scheduledPlanChange`
    and surfaces it on the core `QZPaySubscription.scheduledPlanChange`
    field (cast `as QZPayScheduledPlanChange | null` — JSONB shape is
    guaranteed by the writer).
  - `mapCoreSubscriptionUpdateToDrizzle` writes
    `input.scheduledPlanChange` to the column when present in the
    partial. Explicit `null` clears the column; `undefined` leaves it
    untouched.

  **Migration**:

  `drizzle-kit push` will add the column + partial index. The column
  is nullable with no default, so existing rows pick up `null`
  automatically — no backfill needed.

  **Compatibility**:

  - Insert default for the column is `NULL`, so all pre-existing
    consumer code (qzpay-drizzle 1.6.x and earlier) keeps working
    without changes; readers that ignore the field continue to behave
    as before.
  - Bumped **minor** alongside the qzpay-core 1.5.x → 1.6.0 bump that
    introduces the type. Consumers should bump both packages together.

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.6.0

### Minor Changes

- 8420f6a: feat(drizzle): persist checkout sessions in billing_checkouts table

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

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.5.0

### Minor Changes

- bbe8b04: feat(drizzle): map providerSubscriptionIds (stripe + mercadopago) in subscription mappers

  Adds the writeback path so consumers (e.g. Hospeda's webhook handler)
  can link a provider-side subscription ID (MP preapproval, Stripe
  subscription) to the local subscription record via the storage layer.

  **`@qazuor/qzpay-core`** — two interface extensions:

  - `QZPayCreateSubscriptionInput.providerSubscriptionIds?: Record<string, string>`
    — usually undefined at create time (the provider call happens after
    the local insert and is reconciled via `linkProviderId`), but
    supported for backfills and manual reconciliation.
  - `QZPayUpdateSubscriptionInput.providerSubscriptionIds?: Record<string, string>`
    — the primary writeback path. Webhook handlers / linkProviderId
    populate this when the provider confirms a preapproval was created.

  **`@qazuor/qzpay-drizzle`** — both mappers honor the new field:

  - `mapCoreSubscriptionCreateToDrizzle` reads
    `input.providerSubscriptionIds`, splits `stripe` → `stripeSubscriptionId`
    and `mercadopago` → `mpSubscriptionId`. Unknown provider keys are
    silently ignored (forward compat).
  - `mapCoreSubscriptionUpdateToDrizzle` mirrors the same split for the
    partial-update path used by `storage.subscriptions.update()`. Other
    update fields continue to work unchanged.

  The read-side (`mapDrizzleSubscriptionToCore`) already aggregated both
  columns into `providerSubscriptionIds` before this change — the only
  gap was the write-side, which this commit closes.

  Tests: 8 new unit tests cover the create + update split for each
  provider, the dual-provider case, and the unknown-key forward-compat
  case.

  Part of SPEC-124 (Phase B of SPEC-122 master plan). Required by the
  upcoming `linkProviderId()` API (next commit).

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

## 1.4.0

### Minor Changes

- 91c9a5c: fix(core,drizzle): atomic promo code redemption (race-safe)

  The previous `promoCodes.apply()` flow had a read-then-write race
  condition: `validate()` would check `currentRedemptions < maxRedemptions`,
  then `incrementRedemptions()` would unconditionally add 1. Two concurrent
  redeems near the limit could both pass validation, leading to a final
  counter that exceeds `maxRedemptions`.

  **Core (`@qazuor/qzpay-core`)**:

  - `QZPayPromoCodeStorage` gains `atomicIncrementRedemptions(id): Promise<QZPayPromoCode | null>`.
    Storage adapters MUST implement this as a single conditional UPDATE
    (e.g. `UPDATE ... WHERE redemptions < max RETURNING *`). Returns `null`
    when the increment would exceed the cap.
  - The legacy `incrementRedemptions()` is kept for backwards compatibility
    but marked `@deprecated`.
  - `promoCodes.apply()` now uses the atomic method and throws
    `QZPayConflictError` (`conflictType: 'promo_code_limit_reached'`) when
    the storage layer returns `null`.

  **Drizzle (`@qazuor/qzpay-drizzle`)**:

  - `QZPayPromoCodesRepository.atomicIncrementUsage(id)` implements the
    conditional UPDATE against `billing_promo_codes`.
  - `drizzleStorage.promoCodes.atomicIncrementRedemptions()` wires it
    through with the existing mapper.
  - Integration tests cover: happy path, overshoot returns null, no-limit
    (`maxUses === null`) never blocks, and a concurrent-redeem race with
    `Promise.all` against `maxUses = 2 / 10 contenders` showing exactly 2
    successes.

  Part of SPEC-123 A4 (qzpay foundation fixes, Phase A of SPEC-122).

### Patch Changes

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.3.0

### Minor Changes

- Add index and `maxUsesPerUser` column to `promoCodes` schema for better query performance and per-user usage limits.

### Patch Changes

- Add `trialEnd` to subscription update types in core, and map missing fields in the drizzle subscription mapper.
- Updated dependencies
  - @qazuor/qzpay-core@1.2.1

## 1.2.0

### Features

- Add composite indexes on `(source, source_id)` columns for entitlements and limits
- Wire `revokeBySource`, `delete`, and `deleteBySource` through storage adapter

### Bug Fixes

- Make limit delete idempotent and use `QZPaySourceType` in repositories
- Fix `sourceId` passthrough in mappers and remove dead code
- Map `currentPeriodStart`, `currentPeriodEnd`, and `trialEnd` fields in subscription update mapper

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage across entitlement and limit tests

## 1.1.0

### Features

- Initial public release with Drizzle ORM storage adapter
- Full CRUD operations for customers, subscriptions, payments, entitlements, and limits
- PostgreSQL schema definitions and migrations

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
