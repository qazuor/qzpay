# @qazuor/qzpay-drizzle

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
