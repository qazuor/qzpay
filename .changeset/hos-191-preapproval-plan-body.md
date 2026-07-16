---
"@qazuor/qzpay-mercadopago": minor
---

Add plan-based subscription creation to the MercadoPago subscription adapter.

When the orchestrator resolves a `providerPriceId` (an MP `preapproval_plan` id),
`subscriptions.create()` now subscribes by sending `preapproval_plan_id` and omits
the inline `auto_recurring` block — amount, cadence and `free_trial` are inherited
from the plan, and MP returns an `init_point` for the redirect authorization. When
no plan id is present it falls back to the legacy inline direct-preapproval body,
so existing callers are unaffected (additive, non-breaking).

This fixes card-first trial authorization on MercadoPago's hosted checkout: a
direct preapproval that carries an inline `free_trial` fails card authorization,
whereas the plan-based flow authorizes the card correctly.
