---
'@qazuor/qzpay-core': major
'@qazuor/qzpay-drizzle': minor
'@qazuor/qzpay-dev': minor
---

**BREAKING**: `billing.payments.refund()` now derives a payment's refund status from the ACCUMULATED total across every settled refund, not just the amount from the current call — and `QZPayPaymentStorage` gains three new required methods to support it, including a duplicate-refund guard.

A payment refunded across two tranches that together add up to the full amount stayed `partially_refunded` forever. `refund()` compared only `providerRefund.amount` — the amount from THIS refund event — against `payment.amount`. The second of two 50% refunds asked "is 50 >= 100?", got "no", and the payment could never reach `refunded` even though every centavo had come back (measured in Hospeda production: a 15.000-centavo payment refunded 5.000 then 10.000 stayed `partially_refunded` after the second, fully-covering refund).

**New behaviour**

- Every settled refund event (provider-backed or local-only) is now persisted via `storage.payments.createRefund()`, an append-only record of that individual event.
- The payment's status is derived from `storage.payments.getTotalRefundedAmount()` — the SUM of every settled refund event for that payment — compared against `payment.amount`. Two 50% refunds now correctly reach `refunded` on the second call.
- `metadata.refundedAmount` on the updated payment reflects the accumulated total, not just the latest event's amount.
- A refund still in `pending` at the provider is NOT persisted to the refund ledger — nothing has settled yet, so there is nothing to accumulate.

**Duplicate-refund guard**

Persisting an accumulated total introduced a NEW risk: `createRefund()` was called unconditionally, with nothing stopping the SAME settled provider refund from being persisted twice — e.g. a caller retrying `payments.refund()` after a network blip hid a successful provider response, where the provider then replays the same `providerRefundId` on the retry. A duplicate row would inflate the SUM `getTotalRefundedAmount()` derives its total from, marking a payment `refunded` after only part of the money actually moved — a money-losing bug in the opposite direction of the one this change otherwise fixes, and silent.

- `createRefund()` is now idempotent by `providerRefundId`. `@qazuor/qzpay-drizzle` enforces this with a PARTIAL UNIQUE index (`idx_refunds_provider_refund_id_unique`, `WHERE provider_refund_id IS NOT NULL` — partial because the column is nullable for local-only refunds) and `ON CONFLICT ... DO NOTHING`; a duplicate write returns the existing row instead of inserting or throwing. Migration `0006` (with rollback) is included and deletes any pre-existing duplicate rows (keeping the oldest) before creating the index. `@qazuor/qzpay-dev`'s in-memory adapter mirrors the same idempotency in application code.
- `billing.payments.refund()` also pre-checks `storage.payments.hasRefundForProviderRefundId()` before writing, so a known duplicate is skipped without a redundant round trip. This is an optimization on top of the storage-layer guarantee, not a replacement for it — a check-then-write has a TOCTOU gap under concurrent retries that only a DB-level constraint closes.

**Why this can break you**

- `QZPayPaymentStorage` (the interface any custom storage adapter implements) gains three new REQUIRED methods: `createRefund(input: QZPayCreateRefundInput): Promise<void>`, `getTotalRefundedAmount(paymentId: string): Promise<number>`, and `hasRefundForProviderRefundId(providerRefundId: string): Promise<boolean>`. A custom adapter that does not implement them will fail to typecheck against `@qazuor/qzpay-core@^3`, and `payments.refund()` will throw at runtime against an adapter missing them. A custom adapter's own `createRefund()` MUST also enforce `providerRefundId` uniqueness itself (e.g. a partial unique DB constraint) — the core-side pre-check alone does not prevent a duplicate row under concurrent retries.
- `@qazuor/qzpay-drizzle` and `@qazuor/qzpay-dev` both ship the new methods (`minor`, additive to their own consumers): the drizzle adapter wires them to the already-existing `billing_refunds` table and `PaymentsRepository.createRefund`/`getTotalRefundedAmount`/`findRefundByProviderRefundId` methods (previously built, tested at the repository layer, but never actually called by `payments.refund()`); the in-memory adapter keeps an internal `refunds` map. Consumers of `@qazuor/qzpay-drizzle` must apply migration `0006` before upgrading `@qazuor/qzpay-core`.

Deployments with no `paymentAdapter` configured are affected too — a local-only refund now also persists a ledger row and accumulates, instead of taking the previous single-shot amount. A refund with no `providerRefundId` has nothing to deduplicate against and is always persisted, unchanged.
