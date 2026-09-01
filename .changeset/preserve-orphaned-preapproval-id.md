---
'@qazuor/qzpay-core': patch
---

Stop losing the provider subscription id when the local link write fails

`subscriptions.create({ mode: 'paid' })` does three things in sequence, and
cannot be atomic — wrapping it in a SQL transaction would hold locks across an
HTTP round-trip:

1. insert the local row
2. create the real object at the provider
3. write the provider id back onto the local row

When step 3 failed, the catch rolled the local row back and rethrew. But
`providerResult` was declared *inside* the `try`, so the id the provider had
just returned went out of scope with it. The result was a live, chargeable
subscription that no consumer could cancel or link, because its id no longer
existed anywhere — not in the database, not in the error, nowhere.

`providerResult` is now declared outside the `try`, and the catch:

- **cancels the just-created provider subscription, best-effort**, so an object
  nobody can reach does not keep charging; and
- when that cancel also fails, throws a `QZPayProviderSyncError` carrying
  `providerSubscriptionId` and `orphaned: true` in its metadata (with the
  original error preserved as `cause`), so the consumer can log it and
  reconcile by hand.

Under `providerSyncErrorStrategy: 'log'` the id is added to the existing warning
for the same reason: the local row that strategy keeps has no provider id on it.

Two things this deliberately does NOT do. It does not cancel when the provider
call itself failed — there is nothing to cancel. And it does not cancel when the
id WAS linked and something later threw: cancelling a healthy subscription over
an unrelated failure would be far worse than the bug being fixed. That second
guard is currently unreachable (nothing after the link can throw: the event
emitter swallows listener errors), which was established by mutation rather than
assumed; it is kept because the day an awaited call is added after the link, its
absence becomes a live hazard.

Behaviour is unchanged for every path that was already working.
