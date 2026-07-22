---
"@qazuor/qzpay-core": minor
---

feat(core): add `subscriptions.uncancel(id)` to reverse a soft-cancel

Adds a first-class primitive that undoes a soft-cancel
(`cancel(id, { cancelAtPeriodEnd: true })`) before it is finalized: it
re-authorizes the provider preapproval that the soft-cancel paused (so it
charges again) and clears the local `canceledAt` stamp. Unlike `resume()`, it
does NOT change `status` — a soft-cancel leaves the subscription
`active`/`trialing`, so `uncancel` preserves it (a `trialing` subscription stays
`trialing` and its deferred first charge is restored). Honours
`providerSyncErrorStrategy` on a provider failure, mirroring cancel/pause/resume.

Also widens `QZPayUpdateSubscriptionInput.canceledAt` to `Date | null` so the
stamp can be cleared through the storage adapter (matching the existing
`trialEnd?: Date | null` clear-with-null pattern).
