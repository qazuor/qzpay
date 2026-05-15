# @qazuor/qzpay-mercadopago

## 1.2.0

### Minor Changes

- 961e820: feat(mp): add `failClosedWhenSecretMissing` option to webhook adapter

  The MercadoPago webhook adapter previously returned `true` from
  `verifySignature()` (and accepted payloads from `constructEvent()`) whenever
  `webhookSecret` was unset. That was a silent pass-through and constituted a
  defense-in-depth gap for production deployments that forgot to configure
  the secret.

  A new `failClosedWhenSecretMissing` option in `QZPayMercadoPagoWebhookConfig`
  and on the top-level `QZPayMercadoPagoConfig` makes the adapter throw in
  that case. When `true` + no secret, both `verifySignature()` and
  `constructEvent()` throw an explicit error instead of accepting the
  payload.

  Default is `false` to preserve backwards compatibility and keep local-dev
  experience smooth when billing is not yet configured. Production
  deployments should set it to `true`.

  Part of SPEC-123 A2 (qzpay foundation fixes, Phase A of SPEC-122).

- cb31502: feat(mp)!: drop stale `TEST-` access-token prefix; require explicit `sandbox` flag

  **Background**: Current MercadoPago issues access tokens with the
  `APP_USR-` prefix for BOTH sandbox and production environments. Whether
  a token is sandbox or production is determined by which credentials
  section it was copied from in the MP dashboard, not by the token shape.
  The legacy `TEST-` prefix is no longer used by MP.

  The adapter previously:

  1. Accepted `TEST-` as a valid token prefix in its validator.
  2. Heuristically detected sandbox mode via `accessToken.includes('TEST')`.

  Both became misleading: the validator allowed a string that MP will
  never emit (suggesting it might mean something), and the heuristic
  always returned `false` for real tokens (defeating the auto-detection
  purpose).

  **Changes**:

  - Token validator now rejects `TEST-` (and everything else that does
    not start with `APP_USR-`).
  - Private `isSandbox()` helper is removed.
  - `QZPayMercadoPagoConfig.sandbox?: boolean` (defaults `false`) is the
    new way to opt into sandbox mode. Forwarded to the checkout adapter
    for `sandbox_init_point` selection. Callers should derive it from
    their own environment configuration (e.g. an env var).

  **Breaking**: callers who relied on a `TEST-` prefix in their access
  token or on automatic sandbox detection must update to (a) use an
  `APP_USR-` token from their sandbox credentials section and (b) pass
  `sandbox: true` explicitly when constructing the adapter.

  Part of SPEC-123 A3 + A5 (qzpay foundation fixes, Phase A of SPEC-122).

- 773d418: feat(mp): enrich checkout adapter with payer info, category_id, idempotency, statement_descriptor

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

### Patch Changes

- 4425eb6: fix(mp): generate payment idempotency key outside the retry loop

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

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.1.1

### Patch Changes

- Updated dependencies
  - @qazuor/qzpay-core@1.2.1
