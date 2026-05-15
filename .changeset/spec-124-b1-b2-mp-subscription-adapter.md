---
'@qazuor/qzpay-mercadopago': minor
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-stripe': patch
'@qazuor/qzpay-dev': patch
---

feat(mp): full preapproval support in subscription adapter (create + update)

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
