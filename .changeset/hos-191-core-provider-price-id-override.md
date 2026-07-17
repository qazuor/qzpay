---
'@qazuor/qzpay-core': minor
---

Add an optional `providerPriceId` to `QZPayCreateSubscriptionInput`. When present it overrides the value otherwise resolved from the selected price's `providerPriceIds[provider]` map, letting callers choose a provider plan by per-customer runtime state a static price row cannot encode (e.g. MercadoPago `preapproval_plan` trial vs no-trial variant, picked by trial-eligibility at checkout). Omitting it falls back to the price map exactly as before — additive and backwards compatible.
