---
'@qazuor/qzpay-core': major
'@qazuor/qzpay-drizzle': major
'@qazuor/qzpay-hono': major
'@qazuor/qzpay-nestjs': major
'@qazuor/qzpay-react': major
---

Require a `productDomain` when creating a subscription

`QZPayCreateSubscriptionInput` (and its `QZPayCreateSubscriptionServiceInput`
mirror) gains a **required** `productDomain: string` — a free-form
discriminator for the product/business line the subscription belongs to. QZPay
defines no vocabulary for it; the consuming application does. The value is
forwarded to storage, and the Drizzle mapper now writes it to the
`product_domain` column, which until now no create path ever populated.

**This is a breaking change and every caller must be updated.** The
`billing.subscriptions.create()` input, the Hono `POST /billing/subscriptions`
body schema, the NestJS `CreateSubscriptionDto`, and the React
`useSubscription().create()` input all require the field now. A blank or
whitespace-only value is rejected with a `QZPayValidationError` before anything
is persisted; a value with surrounding whitespace is trimmed.

Required rather than optional, deliberately. `billing_subscriptions
.product_domain` is `NOT NULL` with a default, so an omitted domain never
stayed omitted — it silently became whatever the column defaulted to. In
practice that meant one product line answering for every other, and a whole
product line spending its entire existence filed under a neighbouring one,
with no line of code being wrong and nothing to grep for. An optional field
would reproduce exactly that, because an optional field is satisfied by
omission. A consumer with a single product line names it once and is done; a
consumer with several can no longer forget which one it meant.

The column's own `.default('accommodation')` — a value from one specific
consuming application, sitting in a generic payments package — is scheduled for
removal in a follow-up, so that an omitted write fails loudly at the first
insert instead of guessing. That removal MUST land after consumers have been
updated, never with them: dropping the default while a caller still omits the
column turns every subscription insert into a `NOT NULL` violation.
