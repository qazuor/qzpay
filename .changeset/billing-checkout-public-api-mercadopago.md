---
'@qazuor/qzpay-mercadopago': minor
---

feat(mp): support one-time payment mode in checkout adapter + RO-RO signature

Updates `QZPayMercadoPagoCheckoutAdapter.create` for the new RO-RO contract
introduced by `@qazuor/qzpay-core` 1.5.0 and adds support for one-time
payment-mode checkouts:

- `create(roro: QZPayProviderCreateCheckoutInput)` (single argument). The
  adapter now receives the customer record + per-line-item resolved pricing
  pre-fetched by core, so it does not re-query storage.
- Line items branch by `providerPriceId` presence:
  - Set → fetch the MercadoPago `PreApprovalPlan` and use its
    `transaction_amount` + `currency_id` (existing subscription flow).
  - Unset → use the inline `unitAmount` + `currency` + `title` from the
    resolved line item directly (no plan lookup). This unblocks one-time
    payments — annual upfront, plan upgrade delta charges, etc. — that have
    no pre-registered MP plan.
- Mixed checkouts (some items via priceId, some inline) work in a single
  request.
- `external_reference` now defaults to the local checkout UUID forwarded by
  `billing.checkout.create()` (`roro.externalReference`), with the previous
  `input.customerId` fallback preserved for adapter-direct callers.
- `notification_url` and `idempotency_key` likewise prefer the
  orchestrator-derived values from `roro` over the raw input.
- Resolved customer (`roro.customer`) takes precedence over raw input fields
  when building the `payer` block.

**Breaking change**: any direct caller of
`paymentAdapter.checkout.create(input, providerPriceIds[])` must move to
the single-argument RO-RO shape. Audit confirmed no in-wild callers outside
test code; the new `billing.checkout` service in core 1.5.0 is the only
intended consumer.

**Test coverage**: 3 new tests in `one-time payment mode (inline amount)`
plus the existing 22 tests migrated to the RO-RO shape. Total: 367 tests
passing.
