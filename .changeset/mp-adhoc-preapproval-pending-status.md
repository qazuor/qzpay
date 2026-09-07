---
"@qazuor/qzpay-mercadopago": patch
---

Fix the MercadoPago ad-hoc subscription flow (no `preapproval_plan_id`) failing with HTTP 400 `"card_token_id is required"`. The adapter now explicitly sends `status: "pending"` on that request — MercadoPago's documented way to create a preapproval with no card collected up front, matching its "subscription with no associated plan / with pending payment" flow. The plan-based flow (created with a `preapproval_plan_id`) is unaffected.
