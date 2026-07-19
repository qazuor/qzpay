---
'@qazuor/qzpay-core': minor
'@qazuor/qzpay-mercadopago': minor
---

Support setting and reading a subscription's provider `external_reference` after creation.

Adds `externalReference?: string` to `QZPayUpdateSubscriptionInput` (mapped by the
MercadoPago adapter to `PUT /preapproval/{id}` `external_reference`), and adds
`externalReference?: string | null` / `payerEmail?: string | null` to
`QZPayProviderSubscription` (populated by the MercadoPago adapter's `retrieve()` from
the preapproval's `external_reference` / `payer_email`).

This unblocks consumers that need to retroactively link a provider-hosted subscription
to a local entity resolved after the preapproval was created — e.g. Hospeda's
consumer-linking flow (HOS-191), which creates the MP preapproval before the local
entity id is known and needs to backfill the link once it is. Both additions are
optional and backwards compatible; adapters that do not support mutating
`external_reference` post-creation (or that never expose `payer_email`) may ignore the
new fields.
