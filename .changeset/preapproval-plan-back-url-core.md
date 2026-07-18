---
"@qazuor/qzpay-core": minor
---

Add an optional `backUrl` to `QZPayCreatePriceInput`. It carries the absolute `http(s)` URL the provider redirects the payer back to after the plan-authorization flow. This is provider-specific: MercadoPago **requires** a `back_url` when creating a `preapproval_plan` and rejects the request with "Back url is required" without it. The field is optional on this cross-provider input because providers that do not need a redirect URL for price creation (e.g. Stripe) ignore it. Additive and backwards compatible.
