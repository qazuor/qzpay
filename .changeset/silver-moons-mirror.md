---
'@qazuor/qzpay-core': major
---

**BREAKING**: `billing.customers.update()` and `billing.customers.delete()` now reach the payment provider instead of writing only to storage.

Both methods used to touch storage alone while `adapter.customers.update` / `adapter.customers.delete` — present in every adapter — were never invoked. The provider-side customer kept a stale email forever, and survived a local deletion along with its saved cards.

**New behaviour**

- `update()` mirrors `email` and `name` to the provider. Those are the fields a provider customer actually holds, and the ones that end up on the provider's own receipts and notifications. Updates that touch only local fields (metadata, saved cards, the provider id map) skip the provider call entirely — no round trip per metadata write.
- `delete()` deletes the customer at the provider as well. The provider leg runs first, so a caller using `providerSyncErrorStrategy: 'throw'` aborts while the local record still exists.
- Customers with no `providerCustomerIds[provider]` skip the provider call silently. There is no provider-side record to mirror onto, and that is not an error.

**Why this can break you**

- **`delete()` is destructive at the provider and is not reversible.** The provider customer holds the saved cards; deleting it removes the stored payment instruments. If your `delete()` is a local soft-delete used for archival rather than erasure, audit those call sites before upgrading — under the previous behaviour the provider copy silently survived, and code may depend on that.
- Both methods can now throw where they never did (provider down or refusing), under `providerSyncErrorStrategy: 'throw'` — the default in livemode.

Unlike `payments.refund()`, these are **mirror syncs, not money movements**, so they honour `providerSyncErrorStrategy` the same way `subscriptions.cancel/pause/resume` do: under `'log'` the local write still applies and the failure is logged. A provider outage must not stop a user from changing their name.
