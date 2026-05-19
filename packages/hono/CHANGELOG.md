# @qazuor/qzpay-hono

## 1.2.0

### Minor Changes

- 9abba4c: Invert the dispatch order in `createWebhookRouter`: call `onEvent` (generic handler) BEFORE the type-specific `handler` instead of after.

  The previous order ran type-specific handlers first, then the generic `onEvent` afterwards. This broke the canonical use case for `onEvent` — running cross-cutting concerns (idempotency tracking, event persistence, audit logging) that must complete BEFORE any type-specific dispatch can rely on them. Consumers that put the event INSERT inside `onEvent` to implement optimistic-insert idempotency would see the INSERT happen after the dispatch had already run, defeating the pattern entirely.

  After the change:

  - `onEvent` runs first. If it returns a `Response` (e.g. "this event is a duplicate, short-circuit"), the type-specific handler is skipped.
  - The type-specific handler runs after and can rely on `onEvent` having completed.

  This is a behavioural breaking change for consumers that intentionally relied on the type-specific handler running first (e.g. if the handler mutated context that `onEvent` then read). Such consumers should move the affected logic into a Hono middleware. The shipped tests in this package only assert that both handlers were called, not the order, so the existing test suite continues to pass.

  Discovered while validating Hospeda SPEC-143 T-143-15 (e2e webhook idempotency) — the old order made `billing_webhook_events.status` stay `pending` after the first event because `markEventProcessedByProviderId` ran before the row was inserted.

## 1.1.10

### Patch Changes

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.1.9

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.1.8

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

## 1.1.7

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.1.6

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.1.5

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.1.4

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

## 1.1.3

### Patch Changes

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.1.2

### Patch Changes

- Updated dependencies
  - @qazuor/qzpay-core@1.2.1

## 1.1.1

### Bug Fixes

- Add addon source support, UUID `sourceId` validation, and input object calls in routes
- Migrate to input object pattern for entitlement and limit operations

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage

## 1.1.0

### Features

- Initial public release with Hono middleware and route handlers
- REST API endpoints for billing, subscriptions, payments, entitlements, and limits
- Zod-based request validation

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
