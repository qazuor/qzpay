---
'@qazuor/qzpay-core': minor
---

feat(core): add `QZPayScheduledPlanChange` storage type for scheduled plan changes

Adds a typed storage primitive for plan changes scheduled to apply at a
future point in time (typically the end of the current billing period
for downgrades that should not apply immediately, but the shape is
generic enough for any kind of deferred plan transition).

**New public API surface**:

- `QZPayScheduledPlanChange` interface — describes the queued change:
  `newPlanId`, `newPriceId`, `targetTransactionAmountMajor` (forwarded
  to the payment adapter on application), `applyAt`, `requestedAt`,
  optional `requestedBy`, `attemptCount` + `lastAttemptAt` for the
  scheduler's retry bookkeeping, `resolvedAt`, `lastError`, and a
  free-form `metadata` slot.
- `QZPayScheduledPlanChangeStatus` union — `'pending' | 'applied' |
  'cancelled' | 'failed'`. The lifecycle is owned by the consuming
  application's scheduler (cron); qzpay provides the storage shape
  only.
- `QZPaySubscription.scheduledPlanChange: QZPayScheduledPlanChange |
  null` — set when a change is queued, `null` otherwise. Storage
  adapters that support the field surface it on the subscription
  object; consumers without a scheduler can ignore it.
- `QZPayUpdateSubscriptionInput.scheduledPlanChange?:
  QZPayScheduledPlanChange | null` — partial-update slot. Passing
  `null` explicitly clears the scheduled change (e.g. on cancel or
  after an upgrade resolves mid-period); passing an object writes /
  replaces it. `undefined` (omitted) leaves the existing value
  untouched — standard partial-update semantics.

**Why this lives in qzpay-core**:

The shape is provider-agnostic — every provider that supports
mid-cycle plan changes can reuse it. Hospeda (SPEC-141 D7 downgrade)
is the first consumer, but Stripe-backed apps with their own
scheduling logic can hydrate the same field.

**What stays out of qzpay-core**:

- The decision of WHEN to schedule a change (Hospeda schedules on
  downgrades; another app might schedule for any plan change with
  user-configurable timing).
- The cron / lifecycle worker that fires at `applyAt` and reconciles
  status.
- Notification / audit policy.

qzpay-core only declares the shape and the read/write hook on
`QZPayUpdateSubscriptionInput`. Storage adapters wire it into their
table.

**Compatibility**:

- `QZPaySubscription.scheduledPlanChange` is required — bumped as
  **minor** since the field is additive on the read side. Adapters
  that have not been updated yet will not compile against this
  release until they hydrate the field. The qzpay-drizzle bump
  (1.6.x → 1.7.0) lands in the same release.
- All other surface unchanged.
