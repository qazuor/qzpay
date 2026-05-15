# @qazuor/qzpay-drizzle

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
