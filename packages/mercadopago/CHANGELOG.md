# @qazuor/qzpay-mercadopago

## 1.4.2

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.4.1

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.4.0

### Minor Changes

- 8420f6a: feat(mp): support one-time payment mode in checkout adapter + RO-RO signature

  Updates `QZPayMercadoPagoCheckoutAdapter.create` for the new RO-RO contract
  introduced by `@qazuor/qzpay-core` 1.5.0 and adds support for one-time
  payment-mode checkouts:

  - `create(roro: QZPayProviderCreateCheckoutInput)` (single argument). The
    adapter now receives the customer record + per-line-item resolved pricing
    pre-fetched by core, so it does not re-query storage.
  - Line items branch by `providerPriceId` presence:
    - Set → fetch the MercadoPago `PreApprovalPlan` and use its
      `transaction_amount` + `currency_id` (existing subscription flow).
    - Unset → use the inline `unitAmount` + `currency` + `title` from the
      resolved line item directly (no plan lookup). This unblocks one-time
      payments — annual upfront, plan upgrade delta charges, etc. — that have
      no pre-registered MP plan.
  - Mixed checkouts (some items via priceId, some inline) work in a single
    request.
  - `external_reference` now defaults to the local checkout UUID forwarded by
    `billing.checkout.create()` (`roro.externalReference`), with the previous
    `input.customerId` fallback preserved for adapter-direct callers.
  - `notification_url` and `idempotency_key` likewise prefer the
    orchestrator-derived values from `roro` over the raw input.
  - Resolved customer (`roro.customer`) takes precedence over raw input fields
    when building the `payer` block.

  **Breaking change**: any direct caller of
  `paymentAdapter.checkout.create(input, providerPriceIds[])` must move to
  the single-argument RO-RO shape. Audit confirmed no in-wild callers outside
  test code; the new `billing.checkout` service in core 1.5.0 is the only
  intended consumer.

  **Test coverage**: 3 new tests in `one-time payment mode (inline amount)`
  plus the existing 22 tests migrated to the RO-RO shape. Total: 367 tests
  passing.

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.3.0

### Minor Changes

- 0055abe: feat(mp): full preapproval support in subscription adapter (create + update)

  Reshapes `QZPayPaymentSubscriptionAdapter.create()` to accept a single
  resolved input object so the MercadoPago adapter has all the data it needs
  to build a complete preapproval — eliminating its previous dead-code path
  that only sent `payer_email + preapproval_plan_id + external_reference`.

  **`@qazuor/qzpay-core`** — new exported type and interface change:

  - New `QZPayProviderCreateSubscriptionInput`: RO-RO container that carries
    `providerCustomerId`, `providerPriceId`, the original
    `QZPayCreateSubscriptionInput`, the resolved `customer`/`price`/`plan`
    records, plus orchestration fields (`externalReference`, `idempotencyKey`,
    `backUrl`, `notificationUrl`). The orchestrator (`billing.subscriptions
.create({ mode: 'paid' })`, wired in a later SPEC-124 commit) resolves
    these before invoking the adapter.
  - `QZPayPaymentSubscriptionAdapter.create()` now takes a single
    `QZPayProviderCreateSubscriptionInput` instead of the three positional
    args `(providerCustomerId, input, providerPriceId)`. Other methods
    unchanged.
  - `QZPayProviderSubscription` gains optional `initPoint?: string` and
    `sandboxInitPoint?: string` — the provider-hosted authorization URLs that
    callers redirect the user to. Stripe leaves these undefined (no hosted
    flow); MercadoPago populates them from the preapproval response.
  - `QZPayUpdateSubscriptionInput` gains optional `transactionAmount?: number`
    for plan-change scenarios (MP `auto_recurring.transaction_amount`).

  **`@qazuor/qzpay-mercadopago`** — `subscription.adapter.ts` rewrite:

  - `create()` sends a complete preapproval body: `payer_email`, `payer`
    (`email + first_name + last_name`), `external_reference`, `reason`
    (built from plan name + `'Mensual' | 'Anual'`), `auto_recurring`
    (frequency + frequency_type + transaction_amount + currency_id),
    optional `back_url`, optional `notification_url`, optional `free_trial`
    when `freeTrialDays > 0`. Calls MP with `requestOptions: { idempotencyKey }`
    so retries do not double-create.
  - Maps qzpay price interval (`day` | `week` | `month` | `year`) to MP's
    `auto_recurring.frequency_type` (`days` | `months`): weeks → `count * 7`
    days, years → `count * 12` months.
  - Payer name fallback: explicit `firstName`/`lastName` → email local-part →
    `'Customer'` for first name; trimmed `lastName` → `' '` (MP rejects
    empty strings).
  - Captures `init_point` and `sandbox_init_point` from MP's response and
    exposes them on the returned `QZPayProviderSubscription`.
  - `update()` now supports `transactionAmount` (forwarded as
    `auto_recurring.transaction_amount`) in addition to `planId` and
    `cancelAt`.

  **`@qazuor/qzpay-stripe`** — `subscription.adapter.ts` signature update:

  - Adapts to the new `create(input: QZPayProviderCreateSubscriptionInput)`
    signature. Reads `providerCustomerId`, `providerPriceId`, and the original
    `input.quantity`/`input.trialDays`/`input.metadata`. Ignores fields
    specific to MP preapprovals (`backUrl`, `freeTrialDays`, etc.). Behavior
    unchanged for Stripe consumers.

  **`@qazuor/qzpay-dev`** — mock adapter signature update:

  - `subscriptions.create()` adapts to the new shape, reading
    `providerInput.input.trialDays`/`providerInput.input.metadata`. Mock
    behavior unchanged.

  **Compatibility**: this is the first commit that actually wires the
  adapter in any meaningful way (the prior `create()` signature was dead
  code in the wild — the previous in-repo audit confirmed no caller reached
  the subscription adapter). Treating as `minor` for `qzpay-core` and
  `qzpay-mercadopago`; the implicit-API consumers (Stripe, dev) follow as
  `patch` because the source change is a mechanical signature update with
  no behavior change.

  Part of SPEC-124 (qzpay subscription preapproval wire-up, Phase B of
  SPEC-122 master plan).

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

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
