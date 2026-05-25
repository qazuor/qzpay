---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-hono": minor
---

feat: admin subscription pause/resume with provider propagation

Expose subscription pause/resume as first-class admin operations.

- core: `billing.subscriptions.pause/resume` now propagate to the payment
  adapter (PUT preapproval status) in addition to the local storage update,
  so a pause actually stops the provider from charging. Guarded by the same
  `providerSyncErrorStrategy` used by create, and a no-op for subscriptions
  without a linked provider id.
- hono: `createAdminRoutes` gains `POST /subscriptions/:id/pause` and
  `POST /subscriptions/:id/resume`, plus `onBeforeSubscriptionPause`,
  `onAfterSubscriptionPause`, `onBeforeSubscriptionResume` and
  `onAfterSubscriptionResume` lifecycle hooks. The before hooks can abort
  with HTTP 422; the after hooks receive the request context so hosts can run
  service-level side effects (the pause scope beyond the billing hold is
  host-defined).
