---
'@qazuor/qzpay-core': minor
---

feat(core): wire payment adapter into billing.subscriptions.create when mode=paid

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
