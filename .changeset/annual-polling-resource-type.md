---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-drizzle': minor
'@qazuor/qzpay-mercadopago': minor
---

feat: support polling for one-time-payment checkouts + fix MP checkout metadata drop

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
