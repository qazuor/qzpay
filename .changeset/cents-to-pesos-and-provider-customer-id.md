---
'@qazuor/qzpay-core': patch
'@qazuor/qzpay-mercadopago': patch
'@qazuor/qzpay-stripe': patch
---

fix(mercadopago): convert `transaction_amount` / `unit_price` from cents
to decimal at the provider boundary

MercadoPago's `/preapproval.auto_recurring.transaction_amount` and
`/preference.items[].unit_price` expect decimal currency units (e.g.
100.00 ARS), not the smallest unit (cents). The subscription and
checkout adapters were forwarding values verbatim from
`QZPayProviderCreateSubscriptionInput.price.amount` and
`QZPayProviderCreateCheckoutInput.resolvedLineItems[].unitAmount`,
both of which are documented as cents elsewhere in `qzpay-core`. A plan
priced at $15,000 ARS (1,500,000 cents) was being sent to MP as
`transaction_amount: 1500000`, which MP interprets as $1.5M ARS and
rejects with HTTP 500 "Internal server error". Sister adapters
(`payment`, `price`) already divided by 100 at the provider boundary;
this brings subscription + checkout in line.

fix(core): remove unused `providerCustomerId` validation in subscription
create

`billing.subscriptions.create` paid-mode path was rejecting any flow
where the customer had no `providerCustomerIds[provider]` populated.
The check was safety theater for MercadoPago — the MP `/preapproval`
adapter does not reference the value, and the rest of the subscription
machinery does not depend on it either. Effect was that any sandbox /
error-recovery scenario where the customer-create sync had failed
became permanently stuck. `QZPayProviderCreateSubscriptionInput
.providerCustomerId` is now optional; adapters that genuinely need it
(Stripe-style) validate at their own boundary.

fix(stripe): validate `providerCustomerId` at adapter boundary

Stripe's `SubscriptionCreateParams.customer` field is required. Since
core no longer gates `providerCustomerId` globally (the MercadoPago
adapter does not need it), each adapter that requires it now validates
locally with a clear error message instead of leaking a TypeScript /
runtime error from the SDK.
