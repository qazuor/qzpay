# @qazuor/qzpay-core

## 5.1.0

### Minor Changes

- 035470c: Add an optional `payerEmail` override for `subscriptions.create()`

  The email used to authorize a recurring charge with the payment provider was
  hardcoded to the customer's stored contact email (`customer.email`). For
  MercadoPago, that email is binding: `/preapproval`'s `payer_email` only
  authorizes the MP account that matches it exactly. A customer's registration
  email and the MercadoPago account they actually want to pay with (the one
  holding a balance, say) are frequently two different addresses in practice,
  and there was no way to declare that distinction without overwriting the
  customer's real contact email — which would also redirect their
  transactional mail.

  `QZPayCreateSubscriptionInput` (and the `billing.subscriptions.create()`
  service input) now accepts an optional `payerEmail?: string`. When present,
  it is used to build the provider-facing payer identity instead of
  `customer.email`; the stored customer record is never touched. When
  omitted, resolution falls back to `customer.email` exactly as before — this
  is a purely additive, backwards-compatible change with no behavior change
  for existing callers.

  The override is resolved once in `packages/core/src/billing.ts` before the
  provider adapter is invoked, so adapters (MercadoPago, Stripe) require no
  changes: MercadoPago's `buildCreateBody` already runs whatever lands in
  `customer.email` through `sanitizeEmail()`, so an invalid `payerEmail`
  fails with the same validation error an invalid `customer.email` would, and
  a mixed-case/whitespace value is normalized the same way. Stripe's adapter
  does not read `customer.email` at all (it creates the subscription against
  an existing `providerCustomerId`), so it is unaffected.

## 5.0.0

### Major Changes

- c38da0e: Make `list()` filters, ordering and paging actually work

  Three options on `QZPayListOptions` were accepted and then silently discarded by
  the Drizzle storage adapter, which read only `limit` and `offset`.

  **`filters` was ignored entirely.** `subscriptions.list({ filters: { status: 'active' } })`
  returned every status. This was not theoretical: it shipped a bug that mailed
  customers a "your subscription renews soon" reminder every day for subscriptions
  that had already lapsed, because the calling job trusted a filter that was never
  applied. Callers around the codebase had independently grown defensive JS
  post-filters against it without anyone finding the cause.

  **`orderBy` / `orderDirection` were ignored too** — every query hardcoded
  `created_at DESC`.

  **`limit` defaulted to 20**, so a caller writing `list()` and naming the result
  `allSubscriptions` quietly got the first 20 rows. `hasMore` was right there in
  the result and nothing read it. Code inside this library worked around it with
  `{ limit: 10000 }`, which is the same defect with a higher ceiling.

  ### Breaking changes

  - `limit` is now **required** on `list()`, and `options` itself is required.
    Deciding a page size is no longer optional.
  - `filters` is **typed per entity** instead of `Record<string, unknown>`. A
    filter the library cannot honour now fails to compile rather than being
    discarded at runtime.
  - `orderBy` is typed per entity. Note that `updatedAt` is not available
    everywhere: checkout sessions, payment methods and promo codes have no such
    column. `createdAt` is the only column present on every entity and remains the
    default ordering.

  ### New

  - `listAll()` on every entity storage: paginates internally and returns a plain
    array. This is the honest answer to what `{ limit: 10000 }` was reaching for.
    Accepts `batchSize` (default 200) and an optional `maxItems` cap — exceeding
    the cap throws `QZPayListAllLimitExceededError` rather than returning a
    truncated array, since silently returning a short list is the failure this API
    exists to remove.
  - `resolveOrderBy` / `orderableColumnsOf` helpers. An `orderBy` that does not
    resolve to a real column throws `QZPayInvalidOrderByError` instead of falling
    back to a default ordering. Column names are never interpolated into SQL — the
    name is looked up on the Drizzle table object, so a hostile string cannot
    reach the query.

  ### Fixed

  - `vendors.search()` declared a `query` filter in its options type and never
    read it. It now filters, matching the behaviour of the equivalent option on
    customers, plans and add-ons.

  ### Migration

  ```ts
  // before
  const result = await storage.subscriptions.list();
  const subs = result.data;

  // after — one page, explicit size
  const result = await storage.subscriptions.list({ limit: 50 });
  const subs = result.data;

  // after — every row
  const subs = await storage.subscriptions.listAll();

  // after — every row, filtered (and the filter is now applied)
  const active = await storage.subscriptions.listAll({
    filters: { status: "active" },
  });
  ```

## 4.0.0

### Major Changes

- 849b3e1: **BREAKING**: `billing.payments.refund()` now derives a payment's refund status from the ACCUMULATED total across every settled refund, not just the amount from the current call — and `QZPayPaymentStorage` gains three new required methods to support it, including a duplicate-refund guard.

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

## 3.1.0

### Minor Changes

- 924a31e: `QZPayProviderPayment` now carries `refundedAmount`, and the MercadoPago adapter populates it.

  A provider payment could report `status: 'refunded'` and nothing else. That status is true of a payment refunded in full and of one refunded by 30%, so a consumer holding only the mapped `QZPayProviderPayment` had no way to tell the two apart — and the natural reading of a missing amount ("assume the whole thing came back") is the destructive one, since it revokes whatever the payment paid for. MercadoPago sends the figure as `transaction_amount_refunded` on the very same `Payment.get()` / payment-search response the adapter already fetches; `mapToProviderPayment` simply dropped it.

  **New behaviour**

  - `QZPayProviderPayment.refundedAmount?: number` — how much of `amount` the provider has already refunded, in the SAME minor units as `amount` (cents/centavos). It is optional and additive: nothing that ignores it changes.
  - The MercadoPago adapter maps `transaction_amount_refunded` onto it in `retrieve()`, `create()`, `capture()` and `search()`, converting from MP's major units with the identical `Math.round(value * 100)` already used for `amount`.
  - `undefined` means "the provider did not report a refunded amount" and is deliberately NOT the same as `0`. The key is omitted rather than set to `undefined`, so an explicit provider zero survives the round trip and a consumer can distinguish "nothing refunded" from "nothing said". A non-numeric value from the provider is treated as unreported rather than coerced.

  **Notes for adapter authors**

  Adapters whose provider does not expose a refunded figure leave `refundedAmount` absent — the field is optional precisely so no adapter is forced to invent one. Anything that does populate it MUST use the same minor units as `amount`; the unit ambiguity between a provider's major units and QZPay's minor units is the exact failure this field exists to close, so do not introduce a second convention for it.

- 8ba908e: fix(polling): scope active-job uniqueness to the resource, not the subscription

  The partial unique index behind `subscriptionPollingJobs.create()` was scoped to
  `subscription_id`, which silently broke every one-time-payment flow. A
  subscription can legitimately have several concurrent one-time checkouts in
  flight (e.g. two add-on purchases) and they all hang off the same
  `subscription_id`, so the first checkout — even an **abandoned** one — held the
  only slot for its whole lifetime. Every later enqueue hit the unique violation,
  `create()` returned `null`, and those purchases got no polling job at all.

  That is not a degraded fallback: MercadoPago Preferences deliver no Webhooks v2
  event, so polling is their **only** activation path. A rejected enqueue means an
  approved payment is never recorded anywhere. Measured against a live environment
  on 2026-08-20: of four checkouts on one subscription, the two that were actually
  **paid** were exactly the two whose enqueue this index rejected.

  **Changes**

  - The index is now `(provider, provider_resource_id) WHERE status = 'pending'`.
    `provider` is part of the key because resource ids are only unique within a
    single provider's namespace. Migration `0005` (with rollback) is included.
  - New `findActiveByProviderResourceId(provider, providerResourceId)` on
    `QZPaySubscriptionPollingJobStorage`. Webhook handlers should use it to close
    the job their event resolved; it names the resource, so it cannot close a
    sibling job belonging to a different in-flight checkout.
  - `findActiveBySubscriptionId` now orders by `(created_at, id)` and returns the
    oldest job. It was an unordered `LIMIT 1`, which was unambiguous only while
    the old index guaranteed at most one row — relaxing that index is exactly what
    would have made it start returning arbitrary rows.

  **Upgrading**: `findActiveByProviderResourceId` is a new required member of
  `QZPaySubscriptionPollingJobStorage`. Custom storage adapters implementing that
  interface by hand must add it. Callers of `findActiveBySubscriptionId` that
  assumed "at most one active job per subscription" should move to the
  resource-scoped lookup.

## 3.0.0

### Major Changes

- 0dd7551: **BREAKING**: `billing.customers.update()` and `billing.customers.delete()` now reach the payment provider instead of writing only to storage.

  Both methods used to touch storage alone while `adapter.customers.update` / `adapter.customers.delete` — present in every adapter — were never invoked. The provider-side customer kept a stale email forever, and survived a local deletion along with its saved cards.

  **New behaviour**

  - `update()` mirrors `email` and `name` to the provider. Those are the fields a provider customer actually holds, and the ones that end up on the provider's own receipts and notifications. Updates that touch only local fields (metadata, saved cards, the provider id map) skip the provider call entirely — no round trip per metadata write.
  - `delete()` deletes the customer at the provider as well. The provider leg runs first, so a caller using `providerSyncErrorStrategy: 'throw'` aborts while the local record still exists.
  - Customers with no `providerCustomerIds[provider]` skip the provider call silently. There is no provider-side record to mirror onto, and that is not an error.

  **Why this can break you**

  - **`delete()` is destructive at the provider and is not reversible.** The provider customer holds the saved cards; deleting it removes the stored payment instruments. If your `delete()` is a local soft-delete used for archival rather than erasure, audit those call sites before upgrading — under the previous behaviour the provider copy silently survived, and code may depend on that.
  - Both methods can now throw where they never did (provider down or refusing), under `providerSyncErrorStrategy: 'throw'` — the default in livemode.

  Unlike `payments.refund()`, these are **mirror syncs, not money movements**, so they honour `providerSyncErrorStrategy` the same way `subscriptions.cancel/pause/resume` do: under `'log'` the local write still applies and the failure is logged. A provider outage must not stop a user from changing their name.

## 2.0.0

### Major Changes

- a5fb89d: **BREAKING**: `billing.payments.refund()` now refunds at the payment provider instead of only writing `status: 'refunded'` to storage.

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

## 1.17.0

### Minor Changes

- 195e2fd: feat: add `subscriptions.uncancel(id)` to reverse a soft-cancel

  Adds a first-class primitive that undoes a soft-cancel
  (`cancel(id, { cancelAtPeriodEnd: true })`) before it is finalized, symmetric to
  `cancel`. It reverses the soft-cancel at the provider and clears the local
  `canceledAt` stamp. Unlike `resume()` (which reverses `pause` and forces
  `status: 'active'`), `uncancel` does NOT change `status` — a soft-cancel leaves
  the subscription `active`/`trialing`, so it is preserved (a `trialing`
  subscription stays `trialing`). Emits a new `subscription.uncanceled` event.

  Guards (a money-critical primitive must not desync local state from the
  provider):

  - Rejects (`QZPayConflictError`) when the subscription is already hard-cancelled
    (`status: 'canceled'`) — that is terminal at the provider.
  - No-ops when there is nothing to reverse (`canceledAt == null`), which also
    prevents it from touching a `pause()`d subscription (reverse those with
    `resume`).
  - Honours `providerSyncErrorStrategy` (throw vs log), mirroring cancel/pause/resume.

  Because each provider's soft-cancel uses a different mechanism, `uncancel` is a
  new REQUIRED method on the `QZPayPaymentSubscriptionAdapter` interface, reversing
  each provider's own soft-cancel — NOT reusing `resume`:

  - MercadoPago: re-authorizes the paused preapproval (`PUT status: 'authorized'`).
  - Stripe: clears `cancel_at_period_end` (NOT `pause_collection`).
  - Dev mock adapter: clears the flag + stamp.

  Custom `QZPayPaymentSubscriptionAdapter` implementations must add an `uncancel`
  method. Also widens `QZPayUpdateSubscriptionInput.canceledAt` /
  `QZPayUpdateSubscriptionServiceInput.canceledAt` to `Date | null` so the stamp
  can be cleared (matching the existing `trialEnd?: Date | null` clear-with-null).

  Scope note: this ships the core primitive + provider adapters only. The
  `@qazuor/qzpay-hono` routes, `@qazuor/qzpay-nestjs` service, and
  `@qazuor/qzpay-react` hooks are intentionally NOT wired for `uncancel` in this
  release — hosts call `billing.subscriptions.uncancel()` directly (as they
  already do for `cancel`). Consumer-package wiring can follow separately.

## 1.16.0

### Minor Changes

- 57edd01: feat(mercadopago): support an explicit `reason` label on subscription update

  Adds an optional `reason` field to `QZPayUpdateSubscriptionInput`. The
  MercadoPago subscription adapter now prefers it as the preapproval `reason`
  (buyer-visible description) — falling back to the synthetic
  `"Plan updated to: ${planId}"` only when `reason` is absent. This lets callers
  show a human plan name on a plan change instead of an opaque plan id.

## 1.15.0

### Minor Changes

- aed70dd: Support setting and reading a subscription's provider `external_reference` after creation.

  Adds `externalReference?: string` to `QZPayUpdateSubscriptionInput` (mapped by the
  MercadoPago adapter to `PUT /preapproval/{id}` `external_reference`), and adds
  `externalReference?: string | null` / `payerEmail?: string | null` to
  `QZPayProviderSubscription` (populated by the MercadoPago adapter's `retrieve()` from
  the preapproval's `external_reference` / `payer_email`).

  This unblocks consumers that need to retroactively link a provider-hosted subscription
  to a local entity resolved after the preapproval was created — e.g. Hospeda's
  consumer-linking flow (HOS-191), which creates the MP preapproval before the local
  entity id is known and needs to backfill the link once it is. Both additions are
  optional and backwards compatible; adapters that do not support mutating
  `external_reference` post-creation (or that never expose `payer_email`) may ignore the
  new fields.

## 1.14.0

### Minor Changes

- f618b33: Add an optional `backUrl` to `QZPayCreatePriceInput`. It carries the absolute `http(s)` URL the provider redirects the payer back to after the plan-authorization flow. This is provider-specific: MercadoPago **requires** a `back_url` when creating a `preapproval_plan` and rejects the request with "Back url is required" without it. The field is optional on this cross-provider input because providers that do not need a redirect URL for price creation (e.g. Stripe) ignore it. Additive and backwards compatible.

## 1.13.0

### Minor Changes

- f239212: Add an optional `providerPriceId` to `QZPayCreateSubscriptionInput`. When present it overrides the value otherwise resolved from the selected price's `providerPriceIds[provider]` map, letting callers choose a provider plan by per-customer runtime state a static price row cannot encode (e.g. MercadoPago `preapproval_plan` trial vs no-trial variant, picked by trial-eligibility at checkout). Omitting it falls back to the price map exactly as before — additive and backwards compatible.

## 1.12.0

### Minor Changes

- 486099d: cancel() now propagates to the payment provider; MercadoPago adapter pauses the preapproval on cancelAtPeriodEnd (resumable) vs cancels it on immediate cancel.

  Previously `billing.subscriptions.cancel()` only wrote the cancellation to local storage, so a soft-cancel (`cancelAtPeriodEnd: true`) or hard-cancel never stopped MercadoPago from charging. The method now mirrors `pause()` exactly: it resolves the provider subscription ID, calls `paymentAdapter.subscriptions.cancel(id, cancelAtPeriodEnd)`, and honours `providerSyncErrorStrategy` on failure.

  The MercadoPago adapter `cancel()` now branches on `cancelAtPeriodEnd`: `true` issues a `PUT { status: 'paused' }` (preapproval stays alive and is resumable), `false` issues a `PUT { status: 'cancelled' }` (permanent, today's default behaviour). The Stripe adapter already handles `cancelAtPeriodEnd` natively and was not changed.

## 1.11.0

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

## 1.10.0

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

## 1.9.0

### Minor Changes

- b7c4ce8: feat: add subscription provider polling fallback primitives

  Introduces the optional `QZPaySubscriptionPollingJobStorage` interface
  on the core storage adapter, paired with a Drizzle implementation
  backed by a new `billing_subscription_polling_jobs` table.

  This unblocks consumers that need to work around providers whose
  subscription webhooks are unreliable (e.g. MercadoPago's
  `subscription_preapproval` event family, which we have observed
  silently dropped across multiple test runs). The consuming application
  runs the cron loop; qzpay only owns the storage primitive plus the
  domain types so multiple consumers can share one polling implementation.

  Types added (qzpay-core):

  - `QZPaySubscriptionPollingJob`
  - `QZPaySubscriptionPollingJobStatus`
  - `QZPaySchedulePollingInput`
  - `QZPayUpdatePollingJobInput`
  - `QZPaySubscriptionPollingJobStorage` (interface on the storage adapter)

  Drizzle additions (qzpay-drizzle):

  - `billing_subscription_polling_jobs` schema (3 indexes, optimistic
    locking via `version` uuid, partial-unique constraint on
    `(subscription_id) WHERE status = 'pending'`)
  - `QZPaySubscriptionPollingJobsRepository` + mapper + adapter wiring
  - `POLLING_JOB_DEFAULTS` (30 s initial delay, 60 max attempts)

  No public methods are added on `QZPayBilling` — consumers reach the
  polling storage via the existing `billing.getStorage()` escape hatch
  and call `paymentAdapter.subscriptions.retrieve()` (already part of
  the adapter contract) to fetch provider status. This keeps the
  public API surface stable.

  No changes to `@qazuor/qzpay-mercadopago` are required — its existing
  `retrieve()` already returns the status field used by the polling
  loop. The adapter's `MERCADOPAGO_SUBSCRIPTION_STATUS` map already
  translates MP's `authorized` to qzpay's `active`, which is the
  terminal state the poller watches for.

## 1.8.0

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

## 1.7.0

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

## 1.6.5

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

## 1.6.4

### Patch Changes

- 23a1b5b: fix(core,drizzle): start `mode: 'paid'` subscriptions in `incomplete`, not `active`

  Prior to this fix, `billing.subscriptions.create({ mode: 'paid' })`
  inserted the local row with `status: 'active'` immediately, BEFORE the
  provider preapproval call landed and BEFORE the user authorized the
  recurring charge at the provider. Downstream code that keys off
  `active`/`trialing` status (entitlement gates, feature flags, plan
  benefits) granted features the instant the local row was created — a
  real freebie / entitlement-leak window that lasted until MercadoPago
  either authorized (good case) or rejected/expired (bad case, user kept
  features for free).

  The fix:

  1. **`@qazuor/qzpay-core`** — `billing.subscriptions.create` now
     propagates `input.mode` to the storage adapter's `create` input. The
     `QZPayCreateSubscriptionInput` type already declared `mode?: 'trial'
| 'paid'`; this just ensures the value reaches the adapter.
  2. **`@qazuor/qzpay-drizzle`** — the drizzle storage adapter now picks
     the initial status based on `mode`: `'incomplete'` for `mode: 'paid'`,
     `'trialing'` when a trial is active, `'active'` otherwise. The
     webhook handler is responsible for flipping `'incomplete'` to
     `'active'` once the provider confirms authorization.

  No behavior change for `mode: 'trial'` or callers that omit `mode` —
  the existing status selection (`'trialing'` or `'active'`) is
  preserved.

  Regression test added in `billing.test.ts` ('propagates input.mode to
  the storage adapter') that asserts the storage `create` mock receives
  `mode: 'paid'` in its input. Adapter-level coverage of the
  `mode → status` mapping is exercised end-to-end by Hospeda's
  monthly-checkout e2e suite (SPEC-143).

## 1.6.3

### Patch Changes

- ec77be6: fix(core): fall back to storage when resolving plans in `subscriptions.create({ mode: 'paid' })`

  Prior to this fix, `billing.subscriptions.create({ mode: 'paid' })` only
  consulted the in-memory `planMap` (the snapshot of `config.plans` built
  at construction time) and threw
  `QZPayValidationError('Cannot create paid subscription: plan ... is not
configured')` for any plan that lived only in storage. Hosts that manage
  their plan catalog at runtime (admin tools, dynamic configs — Hospeda's
  pattern) could never use paid mode without duplicating the catalog into
  `config.plans`, even though the rest of the public API (`billing.plans.get`,
  `billing.plans.list`, the upgrade/downgrade path) already supported
  storage-managed plans.

  The fix mirrors the dual-lookup pattern already used by `billing.plans.get()`
  and the plan-change service: try `planMap` first, then fall back to
  `storage.plans.findById`. When the plan loaded from storage does not carry
  its `prices` array in-line (some adapters return plan rows without joined
  prices), the price list is fetched separately via `storage.prices.findByPlanId`
  — the same fallback the upgrade/downgrade path uses.

  No behavior change for callers that declare their plans in `config.plans`:
  the in-memory lookup runs first and short-circuits before any storage call.

  Regression guard test added in `billing.test.ts`: paid subscription create
  against a storage-only plan (no `plans` field passed to `createQZPayBilling`)
  now succeeds and the provider adapter receives the resolved plan + price.

## 1.6.2

### Patch Changes

- 9779e37: fix(core): use UUID for checkout session IDs

  `qzpayCreateCheckoutSession` previously generated session IDs via
  `qzpayGenerateId('cs')`, producing Stripe-style `cs_<base36>` strings.
  This format is incompatible with the `id: uuid('id')` column on
  `billing_checkouts` in qzpay-drizzle (and the equivalent UUID-typed
  columns in other storage adapters): every paid checkout creation
  attempt failed at INSERT time with a PostgreSQL `invalid input syntax
for type uuid` error.

  The fix switches to `crypto.randomUUID()`, aligning checkout sessions
  with the rest of the persisted qzpay contract (subscriptions, payments,
  invoices, customers, plans, prices, etc., all already use UUIDs).

  **Impact**: any consumer that relied on the `cs_` prefix for session IDs
  (string assertion, prefix stripping, regex match) needs to update.
  However, the previous IDs were rejected by the canonical qzpay-drizzle
  storage adapter, so consumers using that adapter were already broken
  at the SQL layer. Memory and Stripe adapters that accepted the
  prefixed format will see a new ID shape but no functional change.

  The internal `qzpayGenerateId` helper is still available for non-persisted
  identifiers (events, correlation IDs).

- b73cb1d: fix(core): use global crypto.randomUUID for checkout session IDs

  The previous fix (use UUID for checkout session IDs) imported `randomUUID`
  from `node:crypto`. That broke the browser-bound playground build because
  Vite externalizes `node:crypto` for browser compatibility, and the
  externalized shim does not export `randomUUID`:

  ```
  ../../packages/core/dist/index.js (1:9):
    "randomUUID" is not exported by "__vite-browser-external"
  ```

  Switch to the global `crypto.randomUUID()` (Web Crypto API, available in
  Node 19+ and all modern browsers). This matches the existing pattern
  already used throughout `billing.ts` for every other UUID-generated entity
  (subscriptions, payments, invoices, customers, …), so the import was the
  outlier — removing it brings the file in line with the rest of qzpay-core.

  No behavior change: tests still produce UUIDv4-shaped session IDs.

## 1.6.1

### Patch Changes

- 1edba84: fix(core): expose `scheduledPlanChange` on `QZPayUpdateSubscriptionServiceInput`

  Closes a gap in qzpay-core 1.6.0 — `QZPayScheduledPlanChange` was
  added to the storage-side `QZPayUpdateSubscriptionInput` but missed
  on the public `QZPayUpdateSubscriptionServiceInput` (the shape the
  `billing.subscriptions.update()` facade accepts). Without the field
  on the service interface, app-level schedulers couldn't write or
  clear the queued change without dropping into the storage adapter
  directly.

  Changes:

  - `QZPayUpdateSubscriptionServiceInput.scheduledPlanChange?:
QZPayScheduledPlanChange | null` — partial update slot. Explicit
    `null` clears the queued change; an object writes / replaces;
    `undefined` (omitted) leaves untouched.
  - `billing.subscriptions.update()` impl now forwards
    `input.scheduledPlanChange` to the storage adapter using the same
    "defined vs undefined" guard as the other partial fields. The
    `null` value is preserved (NOT collapsed to "undefined" by a
    truthy check) so callers can intentionally clear the field.

  This is a patch bump — the change is additive on a partial-update
  interface and behaviour is unchanged for callers that omit the
  field. Required to consume the storage primitive added in 1.6.0
  without re-implementing facade plumbing in every consumer.

## 1.6.0

### Minor Changes

- 4d37d82: feat(core): add `QZPayScheduledPlanChange` storage type for scheduled plan changes

  Adds a typed storage primitive for plan changes scheduled to apply at a
  future point in time (typically the end of the current billing period
  for downgrades that should not apply immediately, but the shape is
  generic enough for any kind of deferred plan transition).

  **New public API surface**:

  - `QZPayScheduledPlanChange` interface — describes the queued change:
    `newPlanId`, `newPriceId`, `targetTransactionAmountMajor` (forwarded
    to the payment adapter on application), `applyAt`, `requestedAt`,
    optional `requestedBy`, `attemptCount` + `lastAttemptAt` for the
    scheduler's retry bookkeeping, `resolvedAt`, `lastError`, and a
    free-form `metadata` slot.
  - `QZPayScheduledPlanChangeStatus` union — `'pending' | 'applied' |
'cancelled' | 'failed'`. The lifecycle is owned by the consuming
    application's scheduler (cron); qzpay provides the storage shape
    only.
  - `QZPaySubscription.scheduledPlanChange: QZPayScheduledPlanChange |
null` — set when a change is queued, `null` otherwise. Storage
    adapters that support the field surface it on the subscription
    object; consumers without a scheduler can ignore it.
  - `QZPayUpdateSubscriptionInput.scheduledPlanChange?:
QZPayScheduledPlanChange | null` — partial-update slot. Passing
    `null` explicitly clears the scheduled change (e.g. on cancel or
    after an upgrade resolves mid-period); passing an object writes /
    replaces it. `undefined` (omitted) leaves the existing value
    untouched — standard partial-update semantics.

  **Why this lives in qzpay-core**:

  The shape is provider-agnostic — every provider that supports
  mid-cycle plan changes can reuse it. Hospeda (SPEC-141 D7 downgrade)
  is the first consumer, but Stripe-backed apps with their own
  scheduling logic can hydrate the same field.

  **What stays out of qzpay-core**:

  - The decision of WHEN to schedule a change (Hospeda schedules on
    downgrades; another app might schedule for any plan change with
    user-configurable timing).
  - The cron / lifecycle worker that fires at `applyAt` and reconciles
    status.
  - Notification / audit policy.

  qzpay-core only declares the shape and the read/write hook on
  `QZPayUpdateSubscriptionInput`. Storage adapters wire it into their
  table.

  **Compatibility**:

  - `QZPaySubscription.scheduledPlanChange` is required — bumped as
    **minor** since the field is additive on the read side. Adapters
    that have not been updated yet will not compile against this
    release until they hydrate the field. The qzpay-drizzle bump
    (1.6.x → 1.7.0) lands in the same release.
  - All other surface unchanged.

## 1.5.0

### Minor Changes

- 8420f6a: feat(core): expose billing.checkout as a public service

  Adds `billing.checkout` to `QZPayBilling` — a public service that orchestrates
  checkout sessions end-to-end (validate → resolve line items → persist locally
  → call the payment adapter → write back provider session IDs → emit
  `checkout.created`). Mirrors the SPEC-124 wiring of `billing.subscriptions`
  and unblocks consumers that previously had to drop down to the raw provider
  SDK for one-time payments and hosted-checkout authorization flows.

  **New public API surface**:

  - `billing.checkout.create(input) → Promise<QZPayCheckoutWithHelpers>` —
    orchestrates the full flow. Returns the persisted session augmented with
    `providerInitPoint` / `providerSandboxInitPoint` when provider sync
    succeeded.
  - `billing.checkout.get(id) → Promise<QZPayCheckoutSession | null>`
  - `billing.checkout.getByCustomerId(customerId) → Promise<QZPayCheckoutSession[]>`
  - `billing.checkout.list(options) → paginated result`

  **New event**:

  - `checkout.created` on `QZPayEventMap`. Emitted after the local session is
    persisted (and, when a payment adapter is wired, after the provider call
    returns and `providerSessionIds` is written back).

  **Storage adapter contract change**: `QZPayStorageAdapter` gains a required
  `checkouts: QZPayCheckoutStorage` slot (`create / update / findById /
findByCustomerId / list`). All bundled adapter implementations
  (`@qazuor/qzpay-dev` memory storage, `@qazuor/qzpay-drizzle` Postgres
  storage) implement the new slot in this release.

  **Payment adapter contract change**: `QZPayPaymentCheckoutAdapter.create`
  moves to a single RO-RO argument:

  ```
  create(input: QZPayProviderCreateCheckoutInput) → Promise<QZPayProviderCheckout>
  ```

  `QZPayProviderCreateCheckoutInput` mirrors `QZPayProviderCreateSubscriptionInput`
  shipped in 1.4.0: aggregates the original caller input, resolved customer
  record, per-line-item resolved pricing, external reference, and idempotency
  key. The previous positional `(input, providerPriceIds[])` signature is
  gone. Audit confirmed no in-wild callers reached this method directly
  outside test code; the new `billing.checkout` service is the only intended
  consumer.

  **Input type extension**: `QZPayCheckoutLineItem` gains optional
  `unitAmount`, `currency`, and `title` fields. `priceId` becomes optional so
  payment-mode checkouts (annual upfront, plan upgrade delta charges) can
  carry their amount inline without a provider-side plan. Validation enforces
  XOR: a line item resolves through `priceId` OR through
  `unitAmount + currency` (with `title` required for the inline path).

  **Error contract**: `billing.checkout.create` raises `QZPayValidationError`
  for invalid input or unknown `priceId`, and wraps provider-sync failures in
  `QZPayProviderSyncError` under `providerSyncErrorStrategy: 'throw'`. Under
  `'log'`, the local session stays in `'open'` status and a warn is logged
  instead.

  **Migration**: existing consumers of `billing.subscriptions` are unaffected.
  Consumers of the low-level `paymentAdapter.checkout.create` must update to
  the RO-RO signature; the recommended path is to use the new `billing.checkout`
  service instead.

## 1.4.0

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

- b89f133: feat(core): wire payment adapter into billing.subscriptions.create when mode=paid

  Connects `billing.subscriptions.create()` to the payment adapter for the
  first time. When the caller opts in with `mode: 'paid'` AND a payment
  adapter is configured, after persisting the local subscription the core
  calls `paymentAdapter.subscriptions.create()` with a fully-resolved
  `QZPayProviderCreateSubscriptionInput` (customer, price, plan, URLs,
  idempotency key) and then writes back the provider's subscription ID to
  the local record via the storage update path.

  **Flow when `mode: 'paid'`**:

  1. Build `createInput` and persist locally via
     `storage.subscriptions.create()` (existing path).
  2. Resolve the customer (via `storage.customers.findById`) and pull its
     `providerCustomerIds[paymentAdapter.provider]`. Throws
     `QZPayValidationError` if the customer has no provider ID for the
     configured adapter — paid subscriptions cannot be created from a
     local-only customer.
  3. Resolve the price's `providerPriceIds[paymentAdapter.provider]`
     (optional; ad-hoc preapprovals such as MP do not require it).
  4. Split `customer.name` on first whitespace into `firstName` / `lastName`
     for the provider's payer record.
  5. Call `paymentAdapter.subscriptions.create()` with
     `idempotencyKey = externalReference = local subscription UUID` so MP
     never double-creates and the webhook can find the local record by
     external_reference.
  6. On success: call `storage.subscriptions.update()` with
     `providerSubscriptionIds: { [provider]: providerResult.id }` (mapped
     to the dedicated column by SPEC-124 B5 mappers). Return the
     subscription wrapped with `providerInitPoint` and
     `providerSandboxInitPoint` so the caller can redirect the user.
  7. On error: dispatch by `providerSyncErrorStrategy`:
     - `'throw'` (default in livemode): roll back the local record via
       `storage.subscriptions.delete()` and re-throw so the caller can
       retry cleanly.
     - `'log'` (default in test mode): keep the local record in its
       pending state, log a warning, and return the unenriched
       subscription. The webhook (or a reconciliation job) can link the
       provider ID later when MP eventually confirms.

  **Backwards compatibility**: callers that omit `mode` (or pass
  `mode: 'trial'`) see ZERO behavior change. The adapter is never invoked
  in those paths — they remain pure storage-only inserts.

  **Type extensions** (`QZPayCreateSubscriptionServiceInput` /
  `QZPayUpdateSubscriptionServiceInput`): the service-level input now
  mirrors the core type's SPEC-124 fields — `mode`, `billingInterval`,
  `paymentMethodReturnUrl`, `notificationUrl`, `freeTrialDays`,
  `transactionAmount`. These were not exposed at the service boundary
  before this commit.

  **Helper return type** (`QZPaySubscriptionWithHelpers`): two optional
  fields — `providerInitPoint?: string`, `providerSandboxInitPoint?:
string` — are now exposed on the wrapper so the caller can read the
  provider's hosted-authorization URL straight off the return value of
  `subscriptions.create({ mode: 'paid' })`. Undefined for trial-mode
  returns and for subscriptions retrieved later from storage.

  **Tests**: 7 new unit tests cover the regression guard (no adapter call
  for default / trial mode), the happy path (adapter inputs +
  `providerSubscriptionIds` linked + `providerInitPoint` surfaced),
  both error strategies (`throw` rolls back; `log` keeps local), and the
  two validation errors (missing provider customer ID; plan without
  price).

  **Drive-by fix** in `qzpay-drizzle`: the SPEC-124 B5 mapper changes
  used dot-notation on a `Record<string, string>` index signature, which
  passed Biome's `useLiteralKeys` but failed TypeScript's
  `noPropertyAccessFromIndexSignature` once the full monorepo typecheck
  ran end-to-end after the new core types landed. Reverted to bracket
  notation with the same `biome-ignore` pattern the read-side mapper
  already uses.

  Part of SPEC-124 (Phase B of SPEC-122 master plan). This is the
  keystone commit — Hospeda's subscription routes (SPEC-126) can now
  build on top of `billing.subscriptions.create({ mode: 'paid' })` and
  `linkProviderId()` (next commit) to deliver real recurring billing.

- df2ebf7: feat(core): expose billing.subscriptions.linkProviderId for webhook writeback

  Adds a public method on the subscription service so consumers can link a
  provider-side subscription ID (MercadoPago preapproval, Stripe `sub_*`,
  etc.) to a local subscription record AFTER the provider confirms via
  webhook or reconciliation job:

  ```typescript
  await billing.subscriptions.linkProviderId({
    localSubscriptionId: "sub_uuid",
    provider: "mercadopago",
    providerSubscriptionId: "preapproval_mp_abc",
  });
  ```

  The method:

  1. Verifies the local subscription exists (`QZPayNotFoundError` if not).
  2. Updates `providerSubscriptionIds[provider]` via the storage layer's
     update path (mapped by SPEC-124 B5 mappers to the dedicated column).
  3. Emits `subscription.linked` with the updated subscription record.
  4. Returns the subscription wrapped with helpers.

  This is the canonical entry point for Hospeda's webhook handler
  (SPEC-126) when MP sends `subscription_preapproval.created` after the
  user authorizes the recurring charge on the hosted page. The handler
  finds the local sub by `external_reference` (which is the local UUID,
  set by SPEC-124 B3) and then calls `linkProviderId` to attach the
  `preapproval.id` to the local record.

  **New exports**:

  - `QZPayLinkProviderIdInput` (interface) — the input object.
  - `QZPaySubscriptionService.linkProviderId(input)` — the method.
  - `'subscription.linked'` event in `QZPAY_BILLING_EVENT` +
    `QZPayEventMap['subscription.linked']: QZPaySubscription`.

  The provider-name parameter is a free-form string (typed as `string`,
  not a union) so adapters for new providers can register their own key
  without touching the core type. The drizzle mapper splits known providers
  (`'stripe'`, `'mercadopago'`) into dedicated columns; unknown keys are
  ignored (forward compat).

  **Tests**: 4 new unit tests cover the happy path (MP), provider-agnostic
  behavior (Stripe), event emission, and the not-found error.

  Part of SPEC-124 (Phase B of SPEC-122 master plan). Closes the public
  API surface needed by Hospeda's subscription webhook handler (SPEC-126).

- bbe8b04: feat(drizzle): map providerSubscriptionIds (stripe + mercadopago) in subscription mappers

  Adds the writeback path so consumers (e.g. Hospeda's webhook handler)
  can link a provider-side subscription ID (MP preapproval, Stripe
  subscription) to the local subscription record via the storage layer.

  **`@qazuor/qzpay-core`** — two interface extensions:

  - `QZPayCreateSubscriptionInput.providerSubscriptionIds?: Record<string, string>`
    — usually undefined at create time (the provider call happens after
    the local insert and is reconciled via `linkProviderId`), but
    supported for backfills and manual reconciliation.
  - `QZPayUpdateSubscriptionInput.providerSubscriptionIds?: Record<string, string>`
    — the primary writeback path. Webhook handlers / linkProviderId
    populate this when the provider confirms a preapproval was created.

  **`@qazuor/qzpay-drizzle`** — both mappers honor the new field:

  - `mapCoreSubscriptionCreateToDrizzle` reads
    `input.providerSubscriptionIds`, splits `stripe` → `stripeSubscriptionId`
    and `mercadopago` → `mpSubscriptionId`. Unknown provider keys are
    silently ignored (forward compat).
  - `mapCoreSubscriptionUpdateToDrizzle` mirrors the same split for the
    partial-update path used by `storage.subscriptions.update()`. Other
    update fields continue to work unchanged.

  The read-side (`mapDrizzleSubscriptionToCore`) already aggregated both
  columns into `providerSubscriptionIds` before this change — the only
  gap was the write-side, which this commit closes.

  Tests: 8 new unit tests cover the create + update split for each
  provider, the dual-provider case, and the unknown-key forward-compat
  case.

  Part of SPEC-124 (Phase B of SPEC-122 master plan). Required by the
  upcoming `linkProviderId()` API (next commit).

- bc4f89b: feat(core): extend QZPayCreateSubscriptionInput for paid subscription mode

  Adds six optional fields to `QZPayCreateSubscriptionInput` to support
  the paid-subscription flow wired in subsequent commits of SPEC-124:

  - `priceId?: string` — disambiguate when a plan exposes multiple prices
    (e.g. monthly + annual). When omitted, the first price of the plan is
    used (backwards-compatible default).
  - `mode?: 'trial' | 'paid'` — creation mode. `'trial'` (default) keeps
    the pre-SPEC-124 storage-only behavior. `'paid'` triggers a call to
    `paymentAdapter.subscriptions.create()` after persisting the local
    record so the provider preapproval is created and the caller can
    redirect the user to the provider-hosted authorization page.
  - `billingInterval?: 'monthly' | 'annual'` — label used by the provider
    adapter to build the user-facing `reason` (MP dashboard + bank
    statement). The actual interval/frequency sent to the provider comes
    from the selected price.
  - `paymentMethodReturnUrl?: string` — URL the provider redirects the
    user back to after authorizing (MP `back_url`).
  - `notificationUrl?: string` — provider webhook URL for this specific
    preapproval (MP `notification_url`). Optional override.
  - `freeTrialDays?: number` — provider-level free-trial extension (MP
    `auto_recurring.free_trial`). Additive to `trialDays` and intended
    for promo-driven extensions of an existing trial.

  All fields are optional and backwards-compatible: pre-SPEC-124 callers
  of `billing.subscriptions.create()` (without `mode`) see no behavior
  change. The wiring that consumes these fields lands in subsequent
  SPEC-124 commits.

  Part of SPEC-124 (qzpay subscription preapproval wire-up, Phase B of
  SPEC-122 master plan).

## 1.3.0

### Minor Changes

- 91c9a5c: fix(core,drizzle): atomic promo code redemption (race-safe)

  The previous `promoCodes.apply()` flow had a read-then-write race
  condition: `validate()` would check `currentRedemptions < maxRedemptions`,
  then `incrementRedemptions()` would unconditionally add 1. Two concurrent
  redeems near the limit could both pass validation, leading to a final
  counter that exceeds `maxRedemptions`.

  **Core (`@qazuor/qzpay-core`)**:

  - `QZPayPromoCodeStorage` gains `atomicIncrementRedemptions(id): Promise<QZPayPromoCode | null>`.
    Storage adapters MUST implement this as a single conditional UPDATE
    (e.g. `UPDATE ... WHERE redemptions < max RETURNING *`). Returns `null`
    when the increment would exceed the cap.
  - The legacy `incrementRedemptions()` is kept for backwards compatibility
    but marked `@deprecated`.
  - `promoCodes.apply()` now uses the atomic method and throws
    `QZPayConflictError` (`conflictType: 'promo_code_limit_reached'`) when
    the storage layer returns `null`.

  **Drizzle (`@qazuor/qzpay-drizzle`)**:

  - `QZPayPromoCodesRepository.atomicIncrementUsage(id)` implements the
    conditional UPDATE against `billing_promo_codes`.
  - `drizzleStorage.promoCodes.atomicIncrementRedemptions()` wires it
    through with the existing mapper.
  - Integration tests cover: happy path, overshoot returns null, no-limit
    (`maxUses === null`) never blocks, and a concurrent-redeem race with
    `Promise.all` against `maxUses = 2 / 10 contenders` showing exactly 2
    successes.

  Part of SPEC-123 A4 (qzpay foundation fixes, Phase A of SPEC-122).

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

## 1.2.1

### Patch Changes

- Add `trialEnd` to subscription update types in core, and map missing fields in the drizzle subscription mapper.

## 1.2.0

### Features

- Add `QZPaySourceType` enum (`manual`, `addon`, `system`) for tracking entitlement and limit origins
- Extend entitlement and limit input types with `source` and `sourceId` fields
- Add `trialEnd` field to `QZPayUpdateSubscriptionInput`

### Bug Fixes

- Change `grant`/`set` methods to use input object pattern (RO-RO) instead of positional arguments
- Add `remove` and `revokeBySource` methods to entitlement and limit storage adapters

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage across entitlement and limit tests

### Docs

- Update API docs for input object pattern and addon source type

## 1.1.0

### Features

- Initial public release with full billing, subscription, and payment management
- Entitlement and limit management system
- Memory storage adapter for development
- Comprehensive type system with Zod validation

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
