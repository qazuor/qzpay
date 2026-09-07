---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-mercadopago": minor
---

Add `providerUnitAmountOverride` to `subscriptions.create()`'s input, letting a caller seed a provider subscription at an explicit amount (in cents, same convention as the resolved price) instead of the plan's price row. This restores discounted-signup checkouts on providers whose ad-hoc flow has no provider-side plan to bake a discount into: without this override, that flow would silently charge the full price row amount. `0` is a valid, distinct override value — it is not treated as "no override". Optional and fully backward compatible: omitting it behaves exactly as before.

The MercadoPago adapter now honors it in `auto_recurring.transaction_amount` on its ad-hoc (no-plan) preapproval flow; it has no effect on MercadoPago's plan-based flow, since MercadoPago derives the amount from the referenced plan there. Other provider adapters can adopt the same field the same way.
