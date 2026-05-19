---
'@qazuor/qzpay-core': patch
'@qazuor/qzpay-drizzle': patch
---

fix(core,drizzle): start `mode: 'paid'` subscriptions in `incomplete`, not `active`

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
