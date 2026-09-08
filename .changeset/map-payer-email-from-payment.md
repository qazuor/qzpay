---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-mercadopago': minor
---

Report the paying account's email on `QZPayProviderPayment`

`QZPayProviderPayment` gains an optional `payerEmail`, and the MercadoPago
adapter now populates it from `payer.email` when it maps a payment.

This was the only missing link for a consumer that needs to record which email
actually paid a subscription — which is not necessarily the account's own signup
address. A preapproval cannot answer that question: measured against the live
MercadoPago sandbox on 2026-09-08, `GET /preapproval/{id}` returns `payer_email`
**present and empty** on an `authorized` preapproval whose checkout supplied a
perfectly valid address (its `payer_id` comes back populated all the same). The
payment is the only object that states it, and the adapter was dropping it.

Adapters must collapse a missing field and an empty one into `null` rather than
forwarding `''`. An empty string is the dangerous shape: falsy enough to slip
past every `if (payment.payerEmail)` guard without a trace, but still a `string`,
so code that type-checks before it validates would persist a non-address as if it
were one.
