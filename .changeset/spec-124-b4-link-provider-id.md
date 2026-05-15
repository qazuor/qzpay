---
'@qazuor/qzpay-core': minor
---

feat(core): expose billing.subscriptions.linkProviderId for webhook writeback

Adds a public method on the subscription service so consumers can link a
provider-side subscription ID (MercadoPago preapproval, Stripe `sub_*`,
etc.) to a local subscription record AFTER the provider confirms via
webhook or reconciliation job:

```typescript
await billing.subscriptions.linkProviderId({
    localSubscriptionId: 'sub_uuid',
    provider: 'mercadopago',
    providerSubscriptionId: 'preapproval_mp_abc'
});
```

The method:

1. Verifies the local subscription exists (`QZPayNotFoundError` if not).
2. Updates `providerSubscriptionIds[provider]` via the storage layer's
   update path (mapped by SPEC-124 B5 mappers to the dedicated column).
3. Emits `subscription.linked` with the updated subscription record.
4. Returns the subscription wrapped with helpers.

This is the canonical entry point for Hospeda's webhook handler
(SPEC-126) when MP sends `subscription_preapproval.created` after the
user authorizes the recurring charge on the hosted page. The handler
finds the local sub by `external_reference` (which is the local UUID,
set by SPEC-124 B3) and then calls `linkProviderId` to attach the
`preapproval.id` to the local record.

**New exports**:

- `QZPayLinkProviderIdInput` (interface) — the input object.
- `QZPaySubscriptionService.linkProviderId(input)` — the method.
- `'subscription.linked'` event in `QZPAY_BILLING_EVENT` +
  `QZPayEventMap['subscription.linked']: QZPaySubscription`.

The provider-name parameter is a free-form string (typed as `string`,
not a union) so adapters for new providers can register their own key
without touching the core type. The drizzle mapper splits known providers
(`'stripe'`, `'mercadopago'`) into dedicated columns; unknown keys are
ignored (forward compat).

**Tests**: 4 new unit tests cover the happy path (MP), provider-agnostic
behavior (Stripe), event emission, and the not-found error.

Part of SPEC-124 (Phase B of SPEC-122 master plan). Closes the public
API surface needed by Hospeda's subscription webhook handler (SPEC-126).
