---
'@qazuor/qzpay-core': minor
---

feat(core): extend QZPayCreateSubscriptionInput for paid subscription mode

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
