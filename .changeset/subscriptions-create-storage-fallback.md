---
'@qazuor/qzpay-core': patch
---

fix(core): fall back to storage when resolving plans in `subscriptions.create({ mode: 'paid' })`

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
