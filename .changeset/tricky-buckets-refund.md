---
'@qazuor/qzpay-core': major
---

**BREAKING**: `billing.payments.refund()` now refunds at the payment provider instead of only writing `status: 'refunded'` to storage.

Until now `refund()` never called the provider adapter — it updated the local payment row and emitted `payment.refunded`. The provider's `payments.refund()` existed in every adapter (MercadoPago, Stripe) and was simply never invoked, so a local record could claim a customer was paid back while nothing left the account.

**New behaviour**

- The provider adapter is called FIRST; the local status mirrors the provider's verdict, not the caller's request.
- Settled refund (`approved` / `succeeded` / …) → status derived from the amount the **provider** refunded (`refunded` or `partially_refunded`), `payment.refunded` emitted.
- Refused refund (`rejected` / `cancelled` / …) → throws `QZPayProviderSyncError`, the row is left untouched, no event.
- Pending or unrecognised status → the in-flight refund is recorded in metadata (`refundId`, `refundStatus: 'pending'`, `refundProvider`), the status is left untouched and no event is emitted. A webhook settles it later. An unknown status can never mark a payment refunded.
- `input.amount` is forwarded verbatim: omitting it still means "full refund" at the provider.

**Why this can break you**

- A refund can now throw where it previously always resolved: provider down, provider refusal, or a payment that carries no `providerPaymentIds[provider]` (throws `QZPayValidationError` instead of silently marking it refunded locally).
- `providerSyncErrorStrategy: 'log'` does NOT apply here. `subscriptions.cancel/pause/resume` fall back to a local-only write when the provider call fails; `refund()` deliberately does not, because a local-only refund write is exactly the failure being fixed.
- Callers should treat a thrown refund as "the money did NOT move" and retry, rather than assuming the local row is authoritative.

Deployments with no `paymentAdapter` configured keep the previous local-only behaviour — there is no provider to lie about.

Also exports `qzpayClassifyRefundStatus()` for normalizing a provider refund status into `'succeeded' | 'failed' | 'pending'`.
