---
'@qazuor/qzpay-mercadopago': minor
---

feat(mp): add `failClosedWhenSecretMissing` option to webhook adapter

The MercadoPago webhook adapter previously returned `true` from
`verifySignature()` (and accepted payloads from `constructEvent()`) whenever
`webhookSecret` was unset. That was a silent pass-through and constituted a
defense-in-depth gap for production deployments that forgot to configure
the secret.

A new `failClosedWhenSecretMissing` option in `QZPayMercadoPagoWebhookConfig`
and on the top-level `QZPayMercadoPagoConfig` makes the adapter throw in
that case. When `true` + no secret, both `verifySignature()` and
`constructEvent()` throw an explicit error instead of accepting the
payload.

Default is `false` to preserve backwards compatibility and keep local-dev
experience smooth when billing is not yet configured. Production
deployments should set it to `true`.

Part of SPEC-123 A2 (qzpay foundation fixes, Phase A of SPEC-122).
