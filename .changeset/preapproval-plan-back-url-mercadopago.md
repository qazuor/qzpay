---
"@qazuor/qzpay-mercadopago": minor
---

Fix a launch-blocking failure: creating a MercadoPago `preapproval_plan` (`POST /preapproval_plan`) now sends the required `back_url`. Previously the price adapter built the plan body with only `reason` and `auto_recurring`, so MercadoPago rejected every first-time plan provision with `Create price - Back url is required`. The bug was invisible wherever the plan mapping was already populated (the "resolve" path never calls create) and only surfaced against an empty mapping (e.g. a fresh production database), where it blocked all paid subscriptions.

The `back_url` is resolved with per-request precedence: `QZPayCreatePriceInput.backUrl` first (carries the checkout's own return URL), then a new adapter-level `defaultPlanBackUrl` config on `createQZPayMercadoPagoAdapter` as a safety net. If neither resolves to a valid absolute `http(s)` URL, the adapter throws a clear error **before** calling MercadoPago instead of surfacing MercadoPago's opaque 400.

- Added `defaultPlanBackUrl` to `QZPayMercadoPagoConfig`.
- The `resolve` path (reusing an existing `preapproval_plan` id) and the public `subscriptions.create` signature are unchanged.
