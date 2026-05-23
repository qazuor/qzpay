---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-drizzle': minor
---

feat: add subscription provider polling fallback primitives

Introduces the optional `QZPaySubscriptionPollingJobStorage` interface
on the core storage adapter, paired with a Drizzle implementation
backed by a new `billing_subscription_polling_jobs` table.

This unblocks consumers that need to work around providers whose
subscription webhooks are unreliable (e.g. MercadoPago's
`subscription_preapproval` event family, which we have observed
silently dropped across multiple test runs). The consuming application
runs the cron loop; qzpay only owns the storage primitive plus the
domain types so multiple consumers can share one polling implementation.

Types added (qzpay-core):
- `QZPaySubscriptionPollingJob`
- `QZPaySubscriptionPollingJobStatus`
- `QZPaySchedulePollingInput`
- `QZPayUpdatePollingJobInput`
- `QZPaySubscriptionPollingJobStorage` (interface on the storage adapter)

Drizzle additions (qzpay-drizzle):
- `billing_subscription_polling_jobs` schema (3 indexes, optimistic
  locking via `version` uuid, partial-unique constraint on
  `(subscription_id) WHERE status = 'pending'`)
- `QZPaySubscriptionPollingJobsRepository` + mapper + adapter wiring
- `POLLING_JOB_DEFAULTS` (30 s initial delay, 60 max attempts)

No public methods are added on `QZPayBilling` — consumers reach the
polling storage via the existing `billing.getStorage()` escape hatch
and call `paymentAdapter.subscriptions.retrieve()` (already part of
the adapter contract) to fetch provider status. This keeps the
public API surface stable.

No changes to `@qazuor/qzpay-mercadopago` are required — its existing
`retrieve()` already returns the status field used by the polling
loop. The adapter's `MERCADOPAGO_SUBSCRIPTION_STATUS` map already
translates MP's `authorized` to qzpay's `active`, which is the
terminal state the poller watches for.
