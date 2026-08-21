---
'@qazuor/qzpay-hono': patch
---

Fix `mapErrorToHttpStatus()` reporting a 500 INTERNAL_ERROR for deliberate rejections thrown by qzpay-core's typed error hierarchy (`QZPayValidationError`, `QZPayNotFoundError`, `QZPayConflictError`, `QZPayProviderSyncError`).

The mapper only recognized `QZPayHttpError` by type; every other error, including qzpay-core's own typed classes, fell through to matching its `message` text against a fixed list of regexes (`ERROR_PATTERNS`) and defaulted to 500 when nothing matched. A guard like the refund path's "Payment is not linked to \<provider\> — cannot refund at the provider" (thrown as `QZPayValidationError`) doesn't contain any of the matched words, so a correct, deliberate 4xx rejection was reported to the client as a server crash.

**New behaviour**

`mapErrorToHttpStatus()` now checks the error's TYPE first, before the message-text fallback:

- `QZPayValidationError` → 422 `VALIDATION_ERROR` (matches this package's existing `isValidationError()` / message-pattern convention for the same class of failure)
- `QZPayNotFoundError` → 404 `NOT_FOUND`
- `QZPayConflictError` → 409 `CONFLICT`
- `QZPayProviderSyncError` → 502 `PROVIDER_SYNC_FAILED` (new `HttpStatus.BAD_GATEWAY` constant) — the upstream payment provider call failed or was refused, not the client's request
- Anything else, including the bare `QZPayError` base class, still falls through to the message-pattern matching and then the 500 default, unchanged. Unrecognized errors never get promoted to a different status.

`isNotFoundError()` / `isValidationError()` / `isConflictError()` now also return `true` for the corresponding typed qzpay-core error, not only for a plain `Error` whose message happens to match.
