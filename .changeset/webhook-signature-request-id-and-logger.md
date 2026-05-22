---
'@qazuor/qzpay-mercadopago': major
'@qazuor/qzpay-hono': minor
'@qazuor/qzpay-core': minor
---

fix(mercadopago): include `x-request-id` header in the HMAC manifest;
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
const requestId = headers['x-request-id'];
adapter.verifySignature(payload, signature, requestId);
adapter.constructEvent(payload, signature, requestId);
```
