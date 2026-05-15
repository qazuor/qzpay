---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-drizzle': minor
---

fix(core,drizzle): atomic promo code redemption (race-safe)

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
