---
'@qazuor/qzpay-core': patch
---

fix(core): expose `scheduledPlanChange` on `QZPayUpdateSubscriptionServiceInput`

Closes a gap in qzpay-core 1.6.0 — `QZPayScheduledPlanChange` was
added to the storage-side `QZPayUpdateSubscriptionInput` but missed
on the public `QZPayUpdateSubscriptionServiceInput` (the shape the
`billing.subscriptions.update()` facade accepts). Without the field
on the service interface, app-level schedulers couldn't write or
clear the queued change without dropping into the storage adapter
directly.

Changes:
- `QZPayUpdateSubscriptionServiceInput.scheduledPlanChange?:
  QZPayScheduledPlanChange | null` — partial update slot. Explicit
  `null` clears the queued change; an object writes / replaces;
  `undefined` (omitted) leaves untouched.
- `billing.subscriptions.update()` impl now forwards
  `input.scheduledPlanChange` to the storage adapter using the same
  "defined vs undefined" guard as the other partial fields. The
  `null` value is preserved (NOT collapsed to "undefined" by a
  truthy check) so callers can intentionally clear the field.

This is a patch bump — the change is additive on a partial-update
interface and behaviour is unchanged for callers that omit the
field. Required to consume the storage primitive added in 1.6.0
without re-implementing facade plumbing in every consumer.
