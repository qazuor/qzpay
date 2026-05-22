---
'@qazuor/qzpay-mercadopago': patch
---

fix(mercadopago): forward `logger` from top-level config to webhook sub-adapter

`QZPayMercadoPagoConfig` now accepts an optional `logger?: QZPayLogger`,
and `createQZPayMercadoPagoAdapter` forwards it to the internal
`QZPayMercadoPagoWebhookAdapter`. Previously the webhook adapter
constructor accepted a logger directly (since v2.0.0), but consumers
that built the top-level adapter via the factory had no way to inject
one — so all the diagnostic logs added in v2.0.1 (manifest dump,
dataId source, HMAC mismatch context) were silently dropped.

After this patch, passing `{ logger }` to `createQZPayMercadoPagoAdapter`
(or to the higher-level qzpay-hono `createWebhookRouter`'s
`paymentAdapter` builder) propagates the logger end-to-end. No
behavioural change for adapters that don't pass a logger.
