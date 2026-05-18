---
'@qazuor/qzpay-core': patch
---

fix(core): use UUID for checkout session IDs

`qzpayCreateCheckoutSession` previously generated session IDs via
`qzpayGenerateId('cs')`, producing Stripe-style `cs_<base36>` strings.
This format is incompatible with the `id: uuid('id')` column on
`billing_checkouts` in qzpay-drizzle (and the equivalent UUID-typed
columns in other storage adapters): every paid checkout creation
attempt failed at INSERT time with a PostgreSQL `invalid input syntax
for type uuid` error.

The fix switches to `crypto.randomUUID()`, aligning checkout sessions
with the rest of the persisted qzpay contract (subscriptions, payments,
invoices, customers, plans, prices, etc., all already use UUIDs).

**Impact**: any consumer that relied on the `cs_` prefix for session IDs
(string assertion, prefix stripping, regex match) needs to update.
However, the previous IDs were rejected by the canonical qzpay-drizzle
storage adapter, so consumers using that adapter were already broken
at the SQL layer. Memory and Stripe adapters that accepted the
prefixed format will see a new ID shape but no functional change.

The internal `qzpayGenerateId` helper is still available for non-persisted
identifiers (events, correlation IDs).
