---
"@qazuor/qzpay-core": minor
"@qazuor/qzpay-mercadopago": minor
---

cancel() now propagates to the payment provider; MercadoPago adapter pauses the preapproval on cancelAtPeriodEnd (resumable) vs cancels it on immediate cancel.

Previously `billing.subscriptions.cancel()` only wrote the cancellation to local storage, so a soft-cancel (`cancelAtPeriodEnd: true`) or hard-cancel never stopped MercadoPago from charging. The method now mirrors `pause()` exactly: it resolves the provider subscription ID, calls `paymentAdapter.subscriptions.cancel(id, cancelAtPeriodEnd)`, and honours `providerSyncErrorStrategy` on failure.

The MercadoPago adapter `cancel()` now branches on `cancelAtPeriodEnd`: `true` issues a `PUT { status: 'paused' }` (preapproval stays alive and is resumable), `false` issues a `PUT { status: 'cancelled' }` (permanent, today's default behaviour). The Stripe adapter already handles `cancelAtPeriodEnd` natively and was not changed.
