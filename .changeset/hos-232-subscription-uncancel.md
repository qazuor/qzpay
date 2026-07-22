---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-mercadopago": minor
"@qazuor/qzpay-stripe": minor
"@qazuor/qzpay-dev": minor
---

feat: add `subscriptions.uncancel(id)` to reverse a soft-cancel

Adds a first-class primitive that undoes a soft-cancel
(`cancel(id, { cancelAtPeriodEnd: true })`) before it is finalized, symmetric to
`cancel`. It reverses the soft-cancel at the provider and clears the local
`canceledAt` stamp. Unlike `resume()` (which reverses `pause` and forces
`status: 'active'`), `uncancel` does NOT change `status` — a soft-cancel leaves
the subscription `active`/`trialing`, so it is preserved (a `trialing`
subscription stays `trialing`). Emits a new `subscription.uncanceled` event.

Guards (a money-critical primitive must not desync local state from the
provider):
- Rejects (`QZPayConflictError`) when the subscription is already hard-cancelled
  (`status: 'canceled'`) — that is terminal at the provider.
- No-ops when there is nothing to reverse (`canceledAt == null`), which also
  prevents it from touching a `pause()`d subscription (reverse those with
  `resume`).
- Honours `providerSyncErrorStrategy` (throw vs log), mirroring cancel/pause/resume.

Because each provider's soft-cancel uses a different mechanism, `uncancel` is a
new REQUIRED method on the `QZPayPaymentSubscriptionAdapter` interface, reversing
each provider's own soft-cancel — NOT reusing `resume`:
- MercadoPago: re-authorizes the paused preapproval (`PUT status: 'authorized'`).
- Stripe: clears `cancel_at_period_end` (NOT `pause_collection`).
- Dev mock adapter: clears the flag + stamp.

Custom `QZPayPaymentSubscriptionAdapter` implementations must add an `uncancel`
method. Also widens `QZPayUpdateSubscriptionInput.canceledAt` /
`QZPayUpdateSubscriptionServiceInput.canceledAt` to `Date | null` so the stamp
can be cleared (matching the existing `trialEnd?: Date | null` clear-with-null).

Scope note: this ships the core primitive + provider adapters only. The
`@qazuor/qzpay-hono` routes, `@qazuor/qzpay-nestjs` service, and
`@qazuor/qzpay-react` hooks are intentionally NOT wired for `uncancel` in this
release — hosts call `billing.subscriptions.uncancel()` directly (as they
already do for `cancel`). Consumer-package wiring can follow separately.
