---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-drizzle': minor
---

fix(polling): scope active-job uniqueness to the resource, not the subscription

The partial unique index behind `subscriptionPollingJobs.create()` was scoped to
`subscription_id`, which silently broke every one-time-payment flow. A
subscription can legitimately have several concurrent one-time checkouts in
flight (e.g. two add-on purchases) and they all hang off the same
`subscription_id`, so the first checkout — even an **abandoned** one — held the
only slot for its whole lifetime. Every later enqueue hit the unique violation,
`create()` returned `null`, and those purchases got no polling job at all.

That is not a degraded fallback: MercadoPago Preferences deliver no Webhooks v2
event, so polling is their **only** activation path. A rejected enqueue means an
approved payment is never recorded anywhere. Measured against a live environment
on 2026-08-20: of four checkouts on one subscription, the two that were actually
**paid** were exactly the two whose enqueue this index rejected.

**Changes**

- The index is now `(provider, provider_resource_id) WHERE status = 'pending'`.
  `provider` is part of the key because resource ids are only unique within a
  single provider's namespace. Migration `0005` (with rollback) is included.
- New `findActiveByProviderResourceId(provider, providerResourceId)` on
  `QZPaySubscriptionPollingJobStorage`. Webhook handlers should use it to close
  the job their event resolved; it names the resource, so it cannot close a
  sibling job belonging to a different in-flight checkout.
- `findActiveBySubscriptionId` now orders by `(created_at, id)` and returns the
  oldest job. It was an unordered `LIMIT 1`, which was unambiguous only while
  the old index guaranteed at most one row — relaxing that index is exactly what
  would have made it start returning arbitrary rows.

**Upgrading**: `findActiveByProviderResourceId` is a new required member of
`QZPaySubscriptionPollingJobStorage`. Custom storage adapters implementing that
interface by hand must add it. Callers of `findActiveBySubscriptionId` that
assumed "at most one active job per subscription" should move to the
resource-scoped lookup.
