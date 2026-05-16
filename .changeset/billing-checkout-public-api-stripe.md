---
'@qazuor/qzpay-stripe': minor
---

feat(stripe): support one-time payment mode in checkout adapter + RO-RO signature

Updates `QZPayStripeCheckoutAdapter.create` for the new RO-RO contract
introduced by `@qazuor/qzpay-core` 1.5.0 and adds support for one-time
payment-mode checkouts:

- `create(roro: QZPayProviderCreateCheckoutInput)` (single argument).
- Line items branch by `providerPriceId` presence:
  - Set → forward as `line_items[].price` (existing pre-registered Stripe
    Price ID flow).
  - Unset → build `line_items[].price_data` inline using
    `resolved.unitAmount` + `resolved.currency` + `resolved.title` (Stripe
    one-time charge without a pre-registered Price object).
- `client_reference_id` is set to the local checkout UUID forwarded by
  `billing.checkout.create()` so webhook handlers correlate back via the
  same field used elsewhere in the stack.
- Resolved customer (`roro.customer`) takes precedence over raw input
  fields: when `providerCustomerId` is present it is forwarded as
  `params.customer`, otherwise the raw `input.customerId` is honored as
  before.

**Breaking change**: direct callers of
`paymentAdapter.checkout.create(input, providerPriceIds[])` must move to
the single-argument RO-RO shape. The new `billing.checkout` service in
core 1.5.0 is the only intended consumer.
