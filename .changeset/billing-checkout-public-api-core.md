---
'@qazuor/qzpay-core': minor
---

feat(core): expose billing.checkout as a public service

Adds `billing.checkout` to `QZPayBilling` — a public service that orchestrates
checkout sessions end-to-end (validate → resolve line items → persist locally
→ call the payment adapter → write back provider session IDs → emit
`checkout.created`). Mirrors the SPEC-124 wiring of `billing.subscriptions`
and unblocks consumers that previously had to drop down to the raw provider
SDK for one-time payments and hosted-checkout authorization flows.

**New public API surface**:

- `billing.checkout.create(input) → Promise<QZPayCheckoutWithHelpers>` —
  orchestrates the full flow. Returns the persisted session augmented with
  `providerInitPoint` / `providerSandboxInitPoint` when provider sync
  succeeded.
- `billing.checkout.get(id) → Promise<QZPayCheckoutSession | null>`
- `billing.checkout.getByCustomerId(customerId) → Promise<QZPayCheckoutSession[]>`
- `billing.checkout.list(options) → paginated result`

**New event**:

- `checkout.created` on `QZPayEventMap`. Emitted after the local session is
  persisted (and, when a payment adapter is wired, after the provider call
  returns and `providerSessionIds` is written back).

**Storage adapter contract change**: `QZPayStorageAdapter` gains a required
`checkouts: QZPayCheckoutStorage` slot (`create / update / findById /
findByCustomerId / list`). All bundled adapter implementations
(`@qazuor/qzpay-dev` memory storage, `@qazuor/qzpay-drizzle` Postgres
storage) implement the new slot in this release.

**Payment adapter contract change**: `QZPayPaymentCheckoutAdapter.create`
moves to a single RO-RO argument:

```
create(input: QZPayProviderCreateCheckoutInput) → Promise<QZPayProviderCheckout>
```

`QZPayProviderCreateCheckoutInput` mirrors `QZPayProviderCreateSubscriptionInput`
shipped in 1.4.0: aggregates the original caller input, resolved customer
record, per-line-item resolved pricing, external reference, and idempotency
key. The previous positional `(input, providerPriceIds[])` signature is
gone. Audit confirmed no in-wild callers reached this method directly
outside test code; the new `billing.checkout` service is the only intended
consumer.

**Input type extension**: `QZPayCheckoutLineItem` gains optional
`unitAmount`, `currency`, and `title` fields. `priceId` becomes optional so
payment-mode checkouts (annual upfront, plan upgrade delta charges) can
carry their amount inline without a provider-side plan. Validation enforces
XOR: a line item resolves through `priceId` OR through
`unitAmount + currency` (with `title` required for the inline path).

**Error contract**: `billing.checkout.create` raises `QZPayValidationError`
for invalid input or unknown `priceId`, and wraps provider-sync failures in
`QZPayProviderSyncError` under `providerSyncErrorStrategy: 'throw'`. Under
`'log'`, the local session stays in `'open'` status and a warn is logged
instead.

**Migration**: existing consumers of `billing.subscriptions` are unaffected.
Consumers of the low-level `paymentAdapter.checkout.create` must update to
the RO-RO signature; the recommended path is to use the new `billing.checkout`
service instead.
