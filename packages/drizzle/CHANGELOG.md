# @qazuor/qzpay-drizzle

## 2.1.0

### Minor Changes

- 37e3f49: Add typed courtesy-window columns to `billing_subscriptions`

  A complimentary ("courtesy") window — a subscriber who already pays being
  gifted one or more cycles — needs three facts recorded: when the gift starts,
  when it ends, and how many cycles it covers. `billing_subscriptions` declared
  none of them, so the first adopter kept all three inside the `metadata` jsonb
  and wrote an accessor module to hide that.

  Three nullable columns now carry them as first class:

  - `courtesy_starts_at` (timestamptz) — when the gift begins, which is normally
    the end of the period the subscriber already paid for rather than the instant
    it was granted;
  - `courtesy_ends_at` (timestamptz) — when it expires;
  - `courtesy_cycles_granted` (integer) — how many cycles it covers, for display
    and audit. The window's authority is the start/end pair, not this count.

  This is the same promotion `product_domain` and `promo_effect_remaining_cycles`
  went through: a column the first consumer had to fake in jsonb becomes one the
  schema declares. QZPay stores them and has no opinion on when a window opens or
  what it entitles — that stays with the consuming application, including the
  pairing invariant, since a window with an end but no start is a half-written
  record that must never read as live.

  Ships with `migrations/0007_add_subscription_courtesy_columns.sql`, which adds
  the columns and one PARTIAL index on `courtesy_ends_at WHERE courtesy_ends_at
IS NOT NULL`. Only rows inside a window can expire and they are a small
  minority, so an expiry sweep costs the number of open gifts rather than the
  size of the table — the same reasoning as the existing pending-plan-change
  index.

  Purely additive: all three columns are nullable with no DEFAULT, so existing
  rows are untouched and every current query keeps its meaning. A consumer moving
  windows out of its own jsonb owns that data migration.

### Patch Changes

- Updated dependencies [8e82bc7]
  - @qazuor/qzpay-core@5.1.1

## 2.0.1

### Patch Changes

- Updated dependencies [035470c]
  - @qazuor/qzpay-core@5.1.0

## 2.0.0

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

### Patch Changes

- Updated dependencies [c38da0e]
  - @qazuor/qzpay-core@5.0.0

## 1.13.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [849b3e1]
  - @qazuor/qzpay-core@4.0.0

## 1.12.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [924a31e]
- Updated dependencies [8ba908e]
  - @qazuor/qzpay-core@3.1.0

## 1.11.8

### Patch Changes

- Updated dependencies [0dd7551]
  - @qazuor/qzpay-core@3.0.0

## 1.11.7

### Patch Changes

- Updated dependencies [a5fb89d]
  - @qazuor/qzpay-core@2.0.0

## 1.11.6

### Patch Changes

- Updated dependencies [195e2fd]
  - @qazuor/qzpay-core@1.17.0

## 1.11.5

### Patch Changes

- bfa7484: fix(drizzle): forward payment.providerPaymentIds and derive provider from it instead of hardcoding 'stripe' in the payments storage adapter create()

## 1.11.4

### Patch Changes

- Updated dependencies [57edd01]
  - @qazuor/qzpay-core@1.16.0

## 1.11.3

### Patch Changes

- Updated dependencies [aed70dd]
  - @qazuor/qzpay-core@1.15.0

## 1.11.2

### Patch Changes

- Updated dependencies [f618b33]
  - @qazuor/qzpay-core@1.14.0

## 1.11.1

### Patch Changes

- Updated dependencies [f239212]
  - @qazuor/qzpay-core@1.13.0

## 1.11.0

### Minor Changes

- 06b6fa9: Add generic `productDomain`, `promoEffectRemainingCycles`, and typed promo-code effect columns (`effectKind`, `valueKind`, `durationCycles`, `extraDays`).

  - `billingSubscriptions.productDomain` and `billingPlans.productDomain`: free-form discriminator for the product/business line a subscription or plan belongs to. QZPay has no opinion on the value set; consumers with a single product line can ignore it.
  - `billingSubscriptions.promoEffectRemainingCycles`: countdown of remaining billing cycles for a multi-cycle promo effect.
  - `billingPromoCodes.effectKind`/`valueKind`/`durationCycles`/`extraDays`: typed promo-code effect columns supporting discount, trial-extension, and comp (permanently complimentary) effects, alongside the existing `type` (`QZPayDiscountType`) column.

  Includes migration `0004_add_billing_generic_extension_columns.sql` (additive, existing rows get placeholder defaults — same pattern as `0003_add_plan_typed_attribute_columns.sql`).

  These promote columns the first adopter (Hospeda) had added via its own app-level migration carril because qzpay-drizzle didn't declare them, which made `drizzle-kit push` treat them as extraneous and block on an unanswerable data-loss confirmation prompt in any non-interactive environment.

## 1.10.0

### Minor Changes

- Add typed `displayName`, `monthlyPriceArs`, and `annualPriceArs` columns to the `billingPlans` schema, promoting them from `metadata` jsonb keys to top-level typed columns. Includes migration `0003_add_plan_typed_attribute_columns.sql` (additive, existing rows get placeholder defaults). `mapCorePlanCreateToDrizzle` now derives these fields from `input.metadata` when present, falling back to `input.name` / `0` / `null`.

## 1.9.2

### Patch Changes

- Updated dependencies [486099d]
  - @qazuor/qzpay-core@1.12.0

## 1.9.1

### Patch Changes

- Updated dependencies [400b829]
  - @qazuor/qzpay-core@1.11.0

## 1.9.0

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

## 1.8.0

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

### Patch Changes

- Updated dependencies [b7c4ce8]
  - @qazuor/qzpay-core@1.9.0

## 1.7.8

### Patch Changes

- Updated dependencies [f031919]
  - @qazuor/qzpay-core@1.8.0

## 1.7.7

### Patch Changes

- Updated dependencies [1732404]
  - @qazuor/qzpay-core@1.7.0

## 1.7.6

### Patch Changes

- Updated dependencies [9256ca7]
  - @qazuor/qzpay-core@1.6.5

## 1.7.5

### Patch Changes

- 7486eb2: Mark `billing_webhook_events.provider_event_id` as `uniqueIndex` instead of a plain index. Webhook handlers in downstream consumers rely on an optimistic-insert idempotency pattern that depends on a UNIQUE violation surfacing when the same provider event arrives twice — without the constraint the duplicate INSERT silently succeeds and the downstream dispatcher runs twice. Consumers will pick up the constraint on their next `drizzle-kit push` (the index name is unchanged, so the migration is a CREATE UNIQUE INDEX replacement).

## 1.7.4

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

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.7.3

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.7.2

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

## 1.7.1

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.7.0

### Minor Changes

- 4d37d82: feat(drizzle): add `scheduled_plan_change` JSONB column to `billing_subscriptions`

  Adds the storage backend for the new `QZPayScheduledPlanChange`
  primitive introduced in qzpay-core. Persists the scheduled change as
  JSONB on `billing_subscriptions.scheduled_plan_change`, with a
  partial index supporting efficient scheduler queries.

  **Schema changes**:

  - New column `scheduled_plan_change jsonb` (nullable). Conforms to
    `QZPayScheduledPlanChange` from qzpay-core. `null` when no change
    is queued.
  - New partial index `idx_subscriptions_pending_plan_change` on
    `scheduled_plan_change` filtered by
    `scheduled_plan_change IS NOT NULL AND
(scheduled_plan_change->>'status') = 'pending'`. Keeps the
    scheduler's per-tick query at O(k) where k = #pending changes
    (NOT O(n) full table scan).

  **Mapper changes**:

  - `mapDrizzleSubscriptionToCore` reads `drizzle.scheduledPlanChange`
    and surfaces it on the core `QZPaySubscription.scheduledPlanChange`
    field (cast `as QZPayScheduledPlanChange | null` — JSONB shape is
    guaranteed by the writer).
  - `mapCoreSubscriptionUpdateToDrizzle` writes
    `input.scheduledPlanChange` to the column when present in the
    partial. Explicit `null` clears the column; `undefined` leaves it
    untouched.

  **Migration**:

  `drizzle-kit push` will add the column + partial index. The column
  is nullable with no default, so existing rows pick up `null`
  automatically — no backfill needed.

  **Compatibility**:

  - Insert default for the column is `NULL`, so all pre-existing
    consumer code (qzpay-drizzle 1.6.x and earlier) keeps working
    without changes; readers that ignore the field continue to behave
    as before.
  - Bumped **minor** alongside the qzpay-core 1.5.x → 1.6.0 bump that
    introduces the type. Consumers should bump both packages together.

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.6.0

### Minor Changes

- 8420f6a: feat(drizzle): persist checkout sessions in billing_checkouts table

  Implements the new `checkouts` slot on the Postgres storage adapter to
  match the contract added in `@qazuor/qzpay-core` 1.5.0. Local checkout
  sessions created by `billing.checkout.create()` now persist BEFORE the
  provider call, so a process crash mid-flow never leaves an orphan
  checkout on the provider side without a local trace.

  **New artifacts**:

  - `billing_checkouts` table (`schema/checkouts.schema.ts`) — columns for
    customer, mode, status (`open | complete | expired`), currency, line
    items (jsonb), success/cancel URLs, expires_at, paymentId /
    subscriptionId nullable FKs, providerSessionIds (jsonb), metadata,
    livemode, timestamps. Indexes on `customer_id`, `status`,
    `(customer_id, status)`, and `expires_at`.
  - `mappers/checkout.mapper.ts` — `mapDrizzleCheckoutToCore`,
    `mapCoreCheckoutToDrizzle`, `mapCoreCheckoutUpdateToDrizzle` (the last
    one is the writeback path used by webhook handlers to flip status,
    link payment / subscription IDs, mark `completedAt`, etc.).
  - `repositories/checkouts.repository.ts` — `findById / create / update /
findByCustomerId / search`. Mirrors the subscriptions repository CRUD
    shape without the lifecycle / metrics methods that don't apply to
    short-lived session records.
  - `adapter/drizzle-storage.adapter.ts` — instantiates the repository and
    wires the `checkouts` storage slot.

  **Migration**: a migration SQL is NOT included in this release because
  `drizzle-kit generate` surfaced a pre-existing schema drift unrelated to
  this work (`provider_payment_id → provider_payment_ids` on
  `billing_payments`). The integrator must run `drizzle-kit generate` in
  their own environment after the drift is reconciled to produce a clean
  `billing_checkouts` migration.

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

## 1.4.0

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

### Patch Changes

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.3.0

### Minor Changes

- Add index and `maxUsesPerUser` column to `promoCodes` schema for better query performance and per-user usage limits.

### Patch Changes

- Add `trialEnd` to subscription update types in core, and map missing fields in the drizzle subscription mapper.
- Updated dependencies
  - @qazuor/qzpay-core@1.2.1

## 1.2.0

### Features

- Add composite indexes on `(source, source_id)` columns for entitlements and limits
- Wire `revokeBySource`, `delete`, and `deleteBySource` through storage adapter

### Bug Fixes

- Make limit delete idempotent and use `QZPaySourceType` in repositories
- Fix `sourceId` passthrough in mappers and remove dead code
- Map `currentPeriodStart`, `currentPeriodEnd`, and `trialEnd` fields in subscription update mapper

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage across entitlement and limit tests

## 1.1.0

### Features

- Initial public release with Drizzle ORM storage adapter
- Full CRUD operations for customers, subscriptions, payments, entitlements, and limits
- PostgreSQL schema definitions and migrations

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
