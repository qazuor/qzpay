---
'@qazuor/qzpay-mercadopago': minor
'@qazuor/qzpay-core': minor
---

feat(mp): enrich checkout adapter with payer info, category_id, idempotency, statement_descriptor

Brings the MercadoPago checkout adapter (`QZPayMercadoPagoCheckoutAdapter`)
to parity with the hand-rolled direct-SDK path that Hospeda built in
SPEC-109 Phase 1. All of these are part of MP's 14-item quality
checklist and improve fraud-engine approval rates.

**`@qazuor/qzpay-core`** — `QZPayCreateCheckoutInput` gains:
- `customerName?: string`
- `payerFirstName?: string`
- `payerLastName?: string`
- `idempotencyKey?: string`
- `statementDescriptor?: string`

And `QZPayCheckoutLineItem` gains:
- `categoryId?: string`

All optional and backwards-compatible.

**`@qazuor/qzpay-mercadopago`** — the checkout adapter now:
- Sets `items[].category_id` on every item (default `'services'` for SaaS;
  callers can override per-line-item).
- Populates `payer` with `email + first_name + last_name`. Priority:
  explicit `payerFirstName`/`payerLastName` → split `customerName` on
  first space → fall back to email local-part. `last_name` is never
  empty (MP rejects empty strings; falls back to a single space).
- Forwards `idempotencyKey` via `requestOptions: { idempotencyKey }`
  when provided.
- Validates `statementDescriptor` format (`/^[A-Z0-9 ]{1,11}$/`) and
  forwards as `body.statement_descriptor`. Invalid values throw before
  the HTTP round-trip.

The previous tests that asserted on exact body shape were updated to
include the new `category_id` (default `'services'`) and the expanded
`payer` shape.

Part of SPEC-125 (Phase C of SPEC-122 master plan). Unblocks SPEC-127
(migration of Hospeda's `addon.checkout.ts` from direct mercadopago SDK
to `billing.checkout.create()`).
