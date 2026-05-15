---
'@qazuor/qzpay-mercadopago': patch
'@qazuor/qzpay-core': patch
---

fix(mp): generate payment idempotency key outside the retry loop

Before this fix, the `X-Idempotency-Key` for `payment.create()` was generated
inside the `withRetry()` callback, so every retry attempt produced a fresh
key. If the first attempt timed out AFTER MercadoPago had actually processed
the charge, the retry would use a different key and MP would create a
duplicate payment — silently double-charging the customer.

The key is now generated once per logical `create()` call and reused across
all retry attempts. MP's idempotency window will then return the same
payment on retries instead of charging again.

`QZPayCreatePaymentInput` also gains an optional `idempotencyKey` field so
callers can supply their own correlation ID (e.g. a local order UUID) for
end-to-end traceability. When omitted, the adapter generates `qzpay_<uuid>`
using `crypto.randomUUID()`.

Part of SPEC-123 (qzpay foundation fixes, Phase A of SPEC-122 master plan).
