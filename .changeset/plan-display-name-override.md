---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-mercadopago": minor
---

Add `planDisplayName` to `subscriptions.create()`'s input, letting a caller override the buyer-visible plan name a provider's ad-hoc flow shows on its own payment UI. Without it, an adapter that builds a buyer-facing description straight from `plan.name` (e.g. MercadoPago's preapproval `reason`, shown as the subscription title on its authorization screen) shows `plan.name` verbatim — which is frequently a machine-facing slug the caller already matches plans by, not a human label. A blank or whitespace-only value is not treated as an override. Optional and fully backward compatible: omitting it produces the exact same buyer-facing text as before.

The MercadoPago adapter now honors it, replacing only the plan-name portion of `reason` on its ad-hoc (no-plan) preapproval flow and keeping the existing interval suffix ("- Mensual"/"- Anual") unchanged; it has no effect on MercadoPago's plan-based flow, which keeps sending the same `reason` it always has. Other provider adapters can adopt the same field the same way.
