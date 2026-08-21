---
'@qazuor/qzpay-core': major
'@qazuor/qzpay-drizzle': minor
'@qazuor/qzpay-dev': minor
---

**BREAKING**: `billing.payments.refund()` now derives a payment's refund status from the ACCUMULATED total across every settled refund, not just the amount from the current call — and `QZPayPaymentStorage` gains two new required methods to support it.

A payment refunded across two tranches that together add up to the full amount stayed `partially_refunded` forever. `refund()` compared only `providerRefund.amount` — the amount from THIS refund event — against `payment.amount`. The second of two 50% refunds asked "is 50 >= 100?", got "no", and the payment could never reach `refunded` even though every centavo had come back (measured in Hospeda production: a 15.000-centavo payment refunded 5.000 then 10.000 stayed `partially_refunded` after the second, fully-covering refund).

**New behaviour**

- Every settled refund event (provider-backed or local-only) is now persisted via `storage.payments.createRefund()`, an append-only record of that individual event.
- The payment's status is derived from `storage.payments.getTotalRefundedAmount()` — the SUM of every settled refund event for that payment — compared against `payment.amount`. Two 50% refunds now correctly reach `refunded` on the second call.
- `metadata.refundedAmount` on the updated payment reflects the accumulated total, not just the latest event's amount.
- A refund still in `pending` at the provider is NOT persisted to the refund ledger — nothing has settled yet, so there is nothing to accumulate.

**Why this can break you**

- `QZPayPaymentStorage` (the interface any custom storage adapter implements) gains two new REQUIRED methods: `createRefund(input: QZPayCreateRefundInput): Promise<void>` and `getTotalRefundedAmount(paymentId: string): Promise<number>`. A custom adapter that does not implement them will fail to typecheck against `@qazuor/qzpay-core@^3`, and `payments.refund()` will throw at runtime against an adapter missing them.
- `@qazuor/qzpay-drizzle` and `@qazuor/qzpay-dev` both ship the new methods (`minor`, additive to their own consumers): the drizzle adapter wires them to the already-existing `billing_refunds` table and `PaymentsRepository.createRefund`/`getTotalRefundedAmount` methods (previously built, tested at the repository layer, but never actually called by `payments.refund()`); the in-memory adapter keeps an internal `refunds` map.

Deployments with no `paymentAdapter` configured are affected too — a local-only refund now also persists a ledger row and accumulates, instead of taking the previous single-shot amount.
