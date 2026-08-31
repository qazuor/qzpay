---
'@qazuor/qzpay-core': minor
---

Add an optional `payerEmail` override for `subscriptions.create()`

The email used to authorize a recurring charge with the payment provider was
hardcoded to the customer's stored contact email (`customer.email`). For
MercadoPago, that email is binding: `/preapproval`'s `payer_email` only
authorizes the MP account that matches it exactly. A customer's registration
email and the MercadoPago account they actually want to pay with (the one
holding a balance, say) are frequently two different addresses in practice,
and there was no way to declare that distinction without overwriting the
customer's real contact email — which would also redirect their
transactional mail.

`QZPayCreateSubscriptionInput` (and the `billing.subscriptions.create()`
service input) now accepts an optional `payerEmail?: string`. When present,
it is used to build the provider-facing payer identity instead of
`customer.email`; the stored customer record is never touched. When
omitted, resolution falls back to `customer.email` exactly as before — this
is a purely additive, backwards-compatible change with no behavior change
for existing callers.

The override is resolved once in `packages/core/src/billing.ts` before the
provider adapter is invoked, so adapters (MercadoPago, Stripe) require no
changes: MercadoPago's `buildCreateBody` already runs whatever lands in
`customer.email` through `sanitizeEmail()`, so an invalid `payerEmail`
fails with the same validation error an invalid `customer.email` would, and
a mixed-case/whitespace value is normalized the same way. Stripe's adapter
does not read `customer.email` at all (it creates the subscription against
an existing `providerCustomerId`), so it is unaffected.
