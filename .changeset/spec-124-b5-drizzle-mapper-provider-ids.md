---
'@qazuor/qzpay-drizzle': minor
'@qazuor/qzpay-core': minor
---

feat(drizzle): map providerSubscriptionIds (stripe + mercadopago) in subscription mappers

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
