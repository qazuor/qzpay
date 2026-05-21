# @qazuor/qzpay-core

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
