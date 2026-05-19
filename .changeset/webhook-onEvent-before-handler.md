---
'@qazuor/qzpay-hono': minor
---

Invert the dispatch order in `createWebhookRouter`: call `onEvent` (generic handler) BEFORE the type-specific `handler` instead of after.

The previous order ran type-specific handlers first, then the generic `onEvent` afterwards. This broke the canonical use case for `onEvent` — running cross-cutting concerns (idempotency tracking, event persistence, audit logging) that must complete BEFORE any type-specific dispatch can rely on them. Consumers that put the event INSERT inside `onEvent` to implement optimistic-insert idempotency would see the INSERT happen after the dispatch had already run, defeating the pattern entirely.

After the change:

- `onEvent` runs first. If it returns a `Response` (e.g. "this event is a duplicate, short-circuit"), the type-specific handler is skipped.
- The type-specific handler runs after and can rely on `onEvent` having completed.

This is a behavioural breaking change for consumers that intentionally relied on the type-specific handler running first (e.g. if the handler mutated context that `onEvent` then read). Such consumers should move the affected logic into a Hono middleware. The shipped tests in this package only assert that both handlers were called, not the order, so the existing test suite continues to pass.

Discovered while validating Hospeda SPEC-143 T-143-15 (e2e webhook idempotency) — the old order made `billing_webhook_events.status` stay `pending` after the first event because `markEventProcessedByProviderId` ran before the row was inserted.
