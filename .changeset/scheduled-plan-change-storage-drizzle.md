---
'@qazuor/qzpay-drizzle': minor
---

feat(drizzle): add `scheduled_plan_change` JSONB column to `billing_subscriptions`

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
