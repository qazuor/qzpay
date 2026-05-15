---
'@qazuor/qzpay-mercadopago': minor
---

feat(mp)!: drop stale `TEST-` access-token prefix; require explicit `sandbox` flag

**Background**: Current MercadoPago issues access tokens with the
`APP_USR-` prefix for BOTH sandbox and production environments. Whether
a token is sandbox or production is determined by which credentials
section it was copied from in the MP dashboard, not by the token shape.
The legacy `TEST-` prefix is no longer used by MP.

The adapter previously:
1. Accepted `TEST-` as a valid token prefix in its validator.
2. Heuristically detected sandbox mode via `accessToken.includes('TEST')`.

Both became misleading: the validator allowed a string that MP will
never emit (suggesting it might mean something), and the heuristic
always returned `false` for real tokens (defeating the auto-detection
purpose).

**Changes**:
- Token validator now rejects `TEST-` (and everything else that does
  not start with `APP_USR-`).
- Private `isSandbox()` helper is removed.
- `QZPayMercadoPagoConfig.sandbox?: boolean` (defaults `false`) is the
  new way to opt into sandbox mode. Forwarded to the checkout adapter
  for `sandbox_init_point` selection. Callers should derive it from
  their own environment configuration (e.g. an env var).

**Breaking**: callers who relied on a `TEST-` prefix in their access
token or on automatic sandbox detection must update to (a) use an
`APP_USR-` token from their sandbox credentials section and (b) pass
`sandbox: true` explicitly when constructing the adapter.

Part of SPEC-123 A3 + A5 (qzpay foundation fixes, Phase A of SPEC-122).
