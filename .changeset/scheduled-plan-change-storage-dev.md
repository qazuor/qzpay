---
'@qazuor/qzpay-dev': patch
---

chore(dev): hydrate `scheduledPlanChange: null` on memory storage subscription create

Tracks the additive `scheduledPlanChange` field qzpay-core 1.6.0 added
to `QZPaySubscription`. The memory storage adapter (used for in-process
playgrounds and end-to-end harness apps) now initializes the field to
`null` on `subscriptions.create` and relies on the spread in
`subscriptions.update` to honour partial writes from callers. No
behaviour change for consumers that ignore the field.
