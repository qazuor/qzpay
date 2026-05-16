---
'@qazuor/qzpay-dev': minor
---

feat(dev): implement checkouts in memory storage + align mock adapter with RO-RO

Adds the `checkouts` slot to the in-memory storage adapter and updates the
mock payment adapter for the new RO-RO checkout signature shipped in
`@qazuor/qzpay-core` 1.5.0:

- **Memory storage**:
  - `MemoryStorageData` and `MemoryStorageSnapshot` gain a `checkouts` map.
  - Reset / seed / `getSnapshot` wire through the new map.
  - `adapter.checkouts` implements `create / update / findById /
    findByCustomerId / list` (paginated). `create` rejects duplicate IDs to
    mirror the subscriptions slot semantics.
- **Mock payment adapter**: `adapter.checkout.create` accepts the new RO-RO
  `QZPayProviderCreateCheckoutInput`. It reads `customer?.id` (with
  fallback to `input.customerId`) and `input.metadata` to populate the
  returned `QZPayProviderCheckout`.

**Breaking change**: direct callers of `adapter.checkout.create({}, [...])`
(positional) must move to the single-argument RO-RO shape, e.g.
`adapter.checkout.create({ input, resolvedLineItems, externalReference,
idempotencyKey, ... })`.

**Test coverage**: 9 existing checkout tests migrated through a new
`buildCheckoutInput()` helper. Total dev tests: 283 passing.
