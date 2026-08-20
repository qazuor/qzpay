---
'@qazuor/qzpay-mercadopago': minor
'@qazuor/qzpay-core': minor
---

`QZPayProviderPayment` now carries `refundedAmount`, and the MercadoPago adapter populates it.

A provider payment could report `status: 'refunded'` and nothing else. That status is true of a payment refunded in full and of one refunded by 30%, so a consumer holding only the mapped `QZPayProviderPayment` had no way to tell the two apart — and the natural reading of a missing amount ("assume the whole thing came back") is the destructive one, since it revokes whatever the payment paid for. MercadoPago sends the figure as `transaction_amount_refunded` on the very same `Payment.get()` / payment-search response the adapter already fetches; `mapToProviderPayment` simply dropped it.

**New behaviour**

- `QZPayProviderPayment.refundedAmount?: number` — how much of `amount` the provider has already refunded, in the SAME minor units as `amount` (cents/centavos). It is optional and additive: nothing that ignores it changes.
- The MercadoPago adapter maps `transaction_amount_refunded` onto it in `retrieve()`, `create()`, `capture()` and `search()`, converting from MP's major units with the identical `Math.round(value * 100)` already used for `amount`.
- `undefined` means "the provider did not report a refunded amount" and is deliberately NOT the same as `0`. The key is omitted rather than set to `undefined`, so an explicit provider zero survives the round trip and a consumer can distinguish "nothing refunded" from "nothing said". A non-numeric value from the provider is treated as unreported rather than coerced.

**Notes for adapter authors**

Adapters whose provider does not expose a refunded figure leave `refundedAmount` absent — the field is optional precisely so no adapter is forced to invent one. Anything that does populate it MUST use the same minor units as `amount`; the unit ambiguity between a provider's major units and QZPay's minor units is the exact failure this field exists to close, so do not introduce a second convention for it.
