# @qazuor/qzpay-mercadopago

## 2.1.0

### Minor Changes

- bf9e652: feat: support polling for one-time-payment checkouts + fix MP checkout metadata drop

  Extends the subscription polling fallback so consumers can also poll
  deferred-payment checkout flows (MercadoPago Preferences in `payment`
  mode), and fixes a long-standing bug in the MercadoPago checkout
  adapter that silently discarded caller-supplied metadata.

  ### qzpay-core (minor)

  - New `QZPayPollingResourceType = 'subscription' | 'one_time_payment'`
    classifies the polled resource so adapters know whether to hit a
    recurring-authorization endpoint (`subscription`) or search the
    payments collection by checkout session id (`one_time_payment`).
  - `QZPaySchedulePollingInput` gains an optional `resourceType` field
    defaulting to `'subscription'` for backward compatibility.
  - `QZPaySubscriptionPollingJob` exposes the persisted `resourceType`.
  - `QZPayPaymentPaymentAdapter` gains an optional `search(criteria)`
    method that returns matching provider payments by checkout-session
    id or external reference. Optional so legacy adapters still compile.
  - New `QZPayPaymentSearchCriteria` shape with `checkoutSessionId` and
    `externalReference` keys.

  ### qzpay-drizzle (minor)

  - `billing_subscription_polling_jobs` gains a `resource_type varchar(20)
NOT NULL DEFAULT 'subscription'` column. Existing rows keep working
    via the default; new rows can opt into `'one_time_payment'` polling.
  - Mappers updated to round-trip the new field.

  ### qzpay-mercadopago (minor)

  - New `QZPayMercadoPagoPaymentAdapter.search()` implementation. Uses
    the SDK's typed `external_reference` filter for the primary path and
    forwards `checkoutSessionId` as the (untyped but MP-REST-supported)
    `preference_id` query param via the SDK's `Object.assign` passthrough.
    Returns matches sorted `date_created DESC` so the most recent
    attempt comes first.
  - Fix: `QZPayMercadoPagoCheckoutAdapter.create()` now merges caller-
    supplied `input.metadata` with the adapter's `qzpay_*` diagnostic
    keys instead of overwriting it with a hard-coded object. The qzpay
    keys still win on conflict (merged LAST) so reserved diagnostics
    cannot be hijacked. This unblocks webhook dispatch keys that
    downstream handlers rely on, notably Hospeda's annual checkout
    flow which embeds `annualSubscriptionId` in metadata so the
    payment-updated webhook can route to the correct local sub.

  ### Why now

  Hospeda's SPEC-143 needs polling fallback for annual subscriptions
  (MercadoPago Preferences only deliver via legacy IPN, which Hospeda
  filters out as duplicates). The polling fix carries with it the
  metadata-forwarding fix, since the same flow exercises both paths.

### Patch Changes

- Updated dependencies [bf9e652]
  - @qazuor/qzpay-core@1.10.0

## 2.0.3

### Patch Changes

- Updated dependencies [b7c4ce8]
  - @qazuor/qzpay-core@1.9.0

## 2.0.2

### Patch Changes

- f46848e: fix(mercadopago): forward `logger` from top-level config to webhook sub-adapter

  `QZPayMercadoPagoConfig` now accepts an optional `logger?: QZPayLogger`,
  and `createQZPayMercadoPagoAdapter` forwards it to the internal
  `QZPayMercadoPagoWebhookAdapter`. Previously the webhook adapter
  constructor accepted a logger directly (since v2.0.0), but consumers
  that built the top-level adapter via the factory had no way to inject
  one — so all the diagnostic logs added in v2.0.1 (manifest dump,
  dataId source, HMAC mismatch context) were silently dropped.

  After this patch, passing `{ logger }` to `createQZPayMercadoPagoAdapter`
  (or to the higher-level qzpay-hono `createWebhookRouter`'s
  `paymentAdapter` builder) propagates the logger end-to-end. No
  behavioural change for adapters that don't pass a logger.

## 2.0.1

### Patch Changes

- f031919: fix(mercadopago): use `data.id` from URL query (not body) for HMAC manifest

  ## The remaining bug after v2.0.0 / v1.4.0

  MercadoPago Webhooks v2 deliver the resource id in the request URL query
  string (`?data.id=<id>` or legacy `?id=<id>`), and the HMAC manifest's
  `id:` field is computed from that URL value — not from the JSON body.

  `@qazuor/qzpay-mercadopago@2.0.0` extracted `data.id` from the JSON body,
  which broke against real MP webhooks whenever:

  - The body lacked a `data.id` field (the adapter fell back to the root
    event id, which never matches the URL resource id).
  - The body and URL carried different values.
  - The body was empty / IPN-style (only query params, no JSON).

  The result: every real MP webhook arrived at the host signed correctly
  by MP but verified as a mismatch by the adapter. Staging smoke 1.1
  (annual checkout APRO) reproduced this deterministically — even after
  the v2.0.0 `x-request-id` fix shipped.

  ## Changes

  ### `@qazuor/qzpay-mercadopago` (patch — 2.0.0 → 2.0.1)

  - `verifySignature(payload, signature, requestId?, dataId?)` now accepts
    an explicit `dataId` as the fourth argument.
  - When `dataId` is provided, it is used directly in the HMAC manifest
    (lowercased to match MP's canonicalization).
  - When `dataId` is omitted, the adapter falls back to body extraction
    (best-effort, documented as such — direct callers should always pass
    the URL value).
  - The HMAC-mismatch warning log now includes the canonical manifest
    computed, the dataId source (`url` vs `body`), the body-side value
    (for divergence diagnosis), and prefix-only excerpts of the received
    vs expected signatures. No secret material is leaked.

  ### `@qazuor/qzpay-hono` (minor — 1.4.0 → 1.5.0)

  - `createWebhookMiddleware`, `createWebhookRouter`, and
    `createSimpleWebhookHandler` accept a new optional
    `dataIdQueryParams?: readonly string[]` config field.
  - Defaults: `['data.id', 'id']` for MercadoPago (v2 + legacy IPN), `[]`
    for Stripe (no separate URL id — it lives in `stripe-signature`).
  - The middleware tries each name in order, uses the first non-empty
    match, and forwards the value to
    `paymentAdapter.webhooks.verifySignature` / `constructEvent` as the
    fourth argument. Empty array disables extraction.

  ### `@qazuor/qzpay-core` (minor — 1.7.0 → 1.8.0)

  - `QZPayPaymentWebhookAdapter.verifySignature` and `constructEvent` gain
    an optional fourth `dataId?: string` parameter (additive). Adapter
    implementations that do not need it can keep their existing
    signatures — TypeScript parameter bivariance covers the gap.

  ## Migration

  ### `qzpay-hono` consumers

  No migration required. The middleware extracts `?data.id=` (or `?id=`)
  automatically for MercadoPago.

  ### Direct `qzpay-mercadopago` consumers

  ```ts
  // Before (works only when body has data.id matching URL)
  adapter.verifySignature(payload, signature, requestId);

  // After (canonical)
  const dataId = new URL(request.url).searchParams.get("data.id") ?? undefined;
  adapter.verifySignature(payload, signature, requestId, dataId);
  ```

- Updated dependencies [f031919]
  - @qazuor/qzpay-core@1.8.0

## 2.0.0

### Major Changes

- 1732404: fix(mercadopago): include `x-request-id` header in the HMAC manifest;
  add optional structured logger to every package

  ## Breaking change (mercadopago)

  `QZPayMercadoPagoWebhookAdapter.verifySignature()` and `constructEvent()`
  now accept a third argument `requestId` and REQUIRE it (when a webhook
  secret is configured) to compute the canonical signed manifest:

  ```
  id:{lowercased dataId};request-id:{x-request-id};ts:{ts};
  ```

  Previous versions (<= 1.x) reused the `ts` value for the `request-id`
  field, which silently passed in unit tests but rejected every real
  MercadoPago webhook because the server signs with the value of the
  `x-request-id` HTTP header, not the timestamp. Real signatures could
  never match.

  Callers that build the manifest manually (e.g. integration tests) must
  update the formula to include the `x-request-id` header value and pass
  it as the third argument to `verifySignature()`/`constructEvent()`. The
  `@qazuor/qzpay-hono` middleware does this automatically (see below).

  The `dataId` is also lowercased before hashing, matching MercadoPago's
  server-side canonicalization.

  When a secret is configured and `requestId` is missing, verification
  returns `false` and logs a warning (via the configured logger, if any).

  ## New feature (mercadopago)

  `QZPayMercadoPagoWebhookConfig` now accepts an optional `logger:
QZPayLogger`. The webhook adapter routes its debug/warn/error output
  through it instead of `console.*`. If omitted, the adapter is silent.

  `QZPayMercadoPagoIPNHandler` now accepts `{ logger }` in its constructor
  and logs handler registration, unhandled IPN types, dispatch success,
  and handler errors.

  ## New feature (hono)

  `createWebhookMiddleware`, `createWebhookRouter`, and
  `createSimpleWebhookHandler` now accept:

  - `requestIdHeader?: string | null` — header name to read the provider
    request-id from. Defaults to `x-request-id` for MercadoPago and `null`
    (skipped) for Stripe. The middleware automatically forwards the value
    to the adapter's `verifySignature` / `constructEvent` calls.
  - `logger?: QZPayLogger` — structured logger forwarded to the adapter
    and used by the middleware to log signature verification failures
    with structured context (provider, header presence flags, etc.).

  `createErrorMiddleware`, `createErrorHandler`, and `createAdminRoutes`
  also accept an optional `logger` config field. When provided, errors
  and lifecycle hook failures go through `logger.error` instead of
  `console.error`.

  The webhook router now emits structured debug/info/error lines for
  construction, dispatch, onEvent short-circuit, handler invocation,
  unhandled event types, and handler failures.

  ## Additive change (core)

  `QZPayPaymentWebhookAdapter.verifySignature` and `constructEvent` gained
  an optional third parameter `requestId?: string`. Adapter implementations
  (Stripe, mock, etc.) that do not need it can keep their existing two-arg
  signatures — TypeScript parameter bivariance allows implementations to
  omit trailing optional parameters.

  `qzpayLoggingMiddleware` now accepts either a function or a
  `QZPayLogger` instance. `qzpayBatchHandler` accepts `options.logger` so
  the trailing-flush catch can be captured by the host's structured
  logger.

  ## Migration (qzpay-hono consumers)

  No migration required. The middleware automatically extracts
  `x-request-id` for MercadoPago and forwards it.

  ## Migration (direct qzpay-mercadopago consumers)

  ```ts
  // Before
  adapter.verifySignature(payload, signature);
  adapter.constructEvent(payload, signature);

  // After
  const requestId = headers["x-request-id"];
  adapter.verifySignature(payload, signature, requestId);
  adapter.constructEvent(payload, signature, requestId);
  ```

### Patch Changes

- Updated dependencies [1732404]
  - @qazuor/qzpay-core@1.7.0

## 1.4.6

### Patch Changes

- 9256ca7: fix(mercadopago): convert `transaction_amount` / `unit_price` from cents
  to decimal at the provider boundary

  MercadoPago's `/preapproval.auto_recurring.transaction_amount` and
  `/preference.items[].unit_price` expect decimal currency units (e.g.
  100.00 ARS), not the smallest unit (cents). The subscription and
  checkout adapters were forwarding values verbatim from
  `QZPayProviderCreateSubscriptionInput.price.amount` and
  `QZPayProviderCreateCheckoutInput.resolvedLineItems[].unitAmount`,
  both of which are documented as cents elsewhere in `qzpay-core`. A plan
  priced at $15,000 ARS (1,500,000 cents) was being sent to MP as
  `transaction_amount: 1500000`, which MP interprets as $1.5M ARS and
  rejects with HTTP 500 "Internal server error". Sister adapters
  (`payment`, `price`) already divided by 100 at the provider boundary;
  this brings subscription + checkout in line.

  fix(core): remove unused `providerCustomerId` validation in subscription
  create

  `billing.subscriptions.create` paid-mode path was rejecting any flow
  where the customer had no `providerCustomerIds[provider]` populated.
  The check was safety theater for MercadoPago — the MP `/preapproval`
  adapter does not reference the value, and the rest of the subscription
  machinery does not depend on it either. Effect was that any sandbox /
  error-recovery scenario where the customer-create sync had failed
  became permanently stuck. `QZPayProviderCreateSubscriptionInput
.providerCustomerId` is now optional; adapters that genuinely need it
  (Stripe-style) validate at their own boundary.

  fix(stripe): validate `providerCustomerId` at adapter boundary

  Stripe's `SubscriptionCreateParams.customer` field is required. Since
  core no longer gates `providerCustomerId` globally (the MercadoPago
  adapter does not need it), each adapter that requires it now validates
  locally with a clear error message instead of leaking a TypeScript /
  runtime error from the SDK.

- Updated dependencies [9256ca7]
  - @qazuor/qzpay-core@1.6.5

## 1.4.5

### Patch Changes

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.4.4

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.4.3

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

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
