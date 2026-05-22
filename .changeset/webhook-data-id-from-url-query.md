---
'@qazuor/qzpay-mercadopago': patch
'@qazuor/qzpay-hono': minor
'@qazuor/qzpay-core': minor
---

fix(mercadopago): use `data.id` from URL query (not body) for HMAC manifest

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
const dataId = new URL(request.url).searchParams.get('data.id') ?? undefined;
adapter.verifySignature(payload, signature, requestId, dataId);
```
