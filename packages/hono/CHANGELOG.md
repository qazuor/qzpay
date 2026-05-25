# @qazuor/qzpay-hono

## 1.6.0

### Minor Changes

- 400b829: feat: admin subscription pause/resume with provider propagation

  Expose subscription pause/resume as first-class admin operations.

  - core: `billing.subscriptions.pause/resume` now propagate to the payment
    adapter (PUT preapproval status) in addition to the local storage update,
    so a pause actually stops the provider from charging. Guarded by the same
    `providerSyncErrorStrategy` used by create, and a no-op for subscriptions
    without a linked provider id.
  - hono: `createAdminRoutes` gains `POST /subscriptions/:id/pause` and
    `POST /subscriptions/:id/resume`, plus `onBeforeSubscriptionPause`,
    `onAfterSubscriptionPause`, `onBeforeSubscriptionResume` and
    `onAfterSubscriptionResume` lifecycle hooks. The before hooks can abort
    with HTTP 422; the after hooks receive the request context so hosts can run
    service-level side effects (the pause scope beyond the billing hold is
    host-defined).

### Patch Changes

- Updated dependencies [400b829]
  - @qazuor/qzpay-core@1.11.0

## 1.5.2

### Patch Changes

- Updated dependencies [bf9e652]
  - @qazuor/qzpay-core@1.10.0

## 1.5.1

### Patch Changes

- Updated dependencies [b7c4ce8]
  - @qazuor/qzpay-core@1.9.0

## 1.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [f031919]
  - @qazuor/qzpay-core@1.8.0

## 1.4.0

### Minor Changes

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

## 1.3.1

### Patch Changes

- Updated dependencies [9256ca7]
  - @qazuor/qzpay-core@1.6.5

## 1.3.0

### Minor Changes

- 7b5e5cc: feat(hono): expose admin tier with lifecycle hooks (v1.3)

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

## 1.2.0

### Minor Changes

- 9abba4c: Invert the dispatch order in `createWebhookRouter`: call `onEvent` (generic handler) BEFORE the type-specific `handler` instead of after.

  The previous order ran type-specific handlers first, then the generic `onEvent` afterwards. This broke the canonical use case for `onEvent` — running cross-cutting concerns (idempotency tracking, event persistence, audit logging) that must complete BEFORE any type-specific dispatch can rely on them. Consumers that put the event INSERT inside `onEvent` to implement optimistic-insert idempotency would see the INSERT happen after the dispatch had already run, defeating the pattern entirely.

  After the change:

  - `onEvent` runs first. If it returns a `Response` (e.g. "this event is a duplicate, short-circuit"), the type-specific handler is skipped.
  - The type-specific handler runs after and can rely on `onEvent` having completed.

  This is a behavioural breaking change for consumers that intentionally relied on the type-specific handler running first (e.g. if the handler mutated context that `onEvent` then read). Such consumers should move the affected logic into a Hono middleware. The shipped tests in this package only assert that both handlers were called, not the order, so the existing test suite continues to pass.

  Discovered while validating Hospeda SPEC-143 T-143-15 (e2e webhook idempotency) — the old order made `billing_webhook_events.status` stay `pending` after the first event because `markEventProcessedByProviderId` ran before the row was inserted.

## 1.1.10

### Patch Changes

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.1.9

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.1.8

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

## 1.1.7

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.1.6

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.1.5

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.1.4

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

## 1.1.3

### Patch Changes

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.1.2

### Patch Changes

- Updated dependencies
  - @qazuor/qzpay-core@1.2.1

## 1.1.1

### Bug Fixes

- Add addon source support, UUID `sourceId` validation, and input object calls in routes
- Migrate to input object pattern for entitlement and limit operations

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage

## 1.1.0

### Features

- Initial public release with Hono middleware and route handlers
- REST API endpoints for billing, subscriptions, payments, entitlements, and limits
- Zod-based request validation

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
