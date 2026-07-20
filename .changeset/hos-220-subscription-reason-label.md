---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-mercadopago": minor
---

feat(mercadopago): support an explicit `reason` label on subscription update

Adds an optional `reason` field to `QZPayUpdateSubscriptionInput`. The
MercadoPago subscription adapter now prefers it as the preapproval `reason`
(buyer-visible description) — falling back to the synthetic
`"Plan updated to: ${planId}"` only when `reason` is absent. This lets callers
show a human plan name on a plan change instead of an opaque plan id.
