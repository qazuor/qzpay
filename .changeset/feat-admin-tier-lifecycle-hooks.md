---
'@qazuor/qzpay-hono': minor
---

feat(hono): expose admin tier with lifecycle hooks (v1.3)

Surface the existing `createAdminRoutes` factory through the package barrel and extend it with optional lifecycle hooks so host applications can plug in side effects (audit logging, revoking linked resources, Sentry tagging) without forking the route handlers.

New endpoints:

- `GET /admin/subscriptions/:id`
- `GET /admin/payments/:id`
- `GET /admin/invoices/:id`
- `POST /admin/subscriptions/:id/cancel` — honors hooks; end-of-period by default, accepts `{ immediate?, reason? }`. The existing `force-cancel` stays as the raw no-hooks emergency path.
- `POST /admin/subscriptions/:id/extend-trial` — accepts `{ additionalDays, reason? }`.
- `POST /admin/payments/:id/refund` — honors hooks. Coexists with `force-refund`.
- `POST /admin/invoices/:id/pay` — honors hooks. Coexists with `mark-paid`.

New lifecycle hooks (all optional) on `QZPayAdminRoutesConfig.hooks`:

- `onBeforeSubscriptionCancel` — can abort the cancel by returning `{ ok: false, reason }`; the response becomes 422 with the reason in the body.
- `onAfterSubscriptionCancel`
- `onAfterSubscriptionChangePlan`
- `onAfterSubscriptionTrialExtended`
- `onAfterPaymentRefund`
- `onAfterInvoicePay`
- `onAfterInvoiceVoid`

`onAfter*` hooks receive the resource that was just committed plus the live Hono `Context`. After-hook errors are logged via `console.error` and never fail the response — the core operation has already committed at that point.

Fully additive: existing routes (`force-cancel`, `force-refund`, `mark-paid`, etc.) are unchanged; passing no `hooks` config keeps the prior behavior. Public API also now re-exports `createAdminRoutes`, `QZPayAdminRoutesConfig`, `QZPayAdminLifecycleHooks`, and `QZPayAdminLifecycleAbortable`.
