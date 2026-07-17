---
'@qazuor/qzpay-mercadopago': minor
---

The MercadoPago price adapter no longer hardcodes `billing_day: 1` when creating a `preapproval_plan`. Without it, MercadoPago bills on the subscription's own rolling anniversary (its start date, i.e. the trial end when a `free_trial` is present) for the full amount, instead of anchoring to a fixed calendar day and prorating the first period. This restores the rolling-monthly behaviour expected of card-first subscriptions.
