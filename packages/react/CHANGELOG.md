# @qazuor/qzpay-react

## 2.0.0

### Major Changes

- 722eca3: Require a `productDomain` when creating a subscription

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

### Patch Changes

- Updated dependencies [722eca3]
  - @qazuor/qzpay-core@6.0.0

## 1.1.30

### Patch Changes

- Updated dependencies [271c14d]
  - @qazuor/qzpay-core@5.3.0

## 1.1.29

### Patch Changes

- Updated dependencies [5f0bf43]
- Updated dependencies [5f0bf43]
  - @qazuor/qzpay-core@5.2.0

## 1.1.28

### Patch Changes

- Updated dependencies [8e82bc7]
  - @qazuor/qzpay-core@5.1.1

## 1.1.27

### Patch Changes

- Updated dependencies [035470c]
  - @qazuor/qzpay-core@5.1.0

## 1.1.26

### Patch Changes

- Updated dependencies [c38da0e]
  - @qazuor/qzpay-core@5.0.0

## 1.1.25

### Patch Changes

- Updated dependencies [849b3e1]
  - @qazuor/qzpay-core@4.0.0

## 1.1.24

### Patch Changes

- Updated dependencies [924a31e]
- Updated dependencies [8ba908e]
  - @qazuor/qzpay-core@3.1.0

## 1.1.23

### Patch Changes

- Updated dependencies [0dd7551]
  - @qazuor/qzpay-core@3.0.0

## 1.1.22

### Patch Changes

- Updated dependencies [a5fb89d]
  - @qazuor/qzpay-core@2.0.0

## 1.1.21

### Patch Changes

- Updated dependencies [195e2fd]
  - @qazuor/qzpay-core@1.17.0

## 1.1.20

### Patch Changes

- Updated dependencies [57edd01]
  - @qazuor/qzpay-core@1.16.0

## 1.1.19

### Patch Changes

- Updated dependencies [aed70dd]
  - @qazuor/qzpay-core@1.15.0

## 1.1.18

### Patch Changes

- Updated dependencies [f618b33]
  - @qazuor/qzpay-core@1.14.0

## 1.1.17

### Patch Changes

- Updated dependencies [f239212]
  - @qazuor/qzpay-core@1.13.0

## 1.1.16

### Patch Changes

- Updated dependencies [486099d]
  - @qazuor/qzpay-core@1.12.0

## 1.1.15

### Patch Changes

- Updated dependencies [400b829]
  - @qazuor/qzpay-core@1.11.0

## 1.1.14

### Patch Changes

- Updated dependencies [bf9e652]
  - @qazuor/qzpay-core@1.10.0

## 1.1.13

### Patch Changes

- Updated dependencies [b7c4ce8]
  - @qazuor/qzpay-core@1.9.0

## 1.1.12

### Patch Changes

- Updated dependencies [f031919]
  - @qazuor/qzpay-core@1.8.0

## 1.1.11

### Patch Changes

- Updated dependencies [1732404]
  - @qazuor/qzpay-core@1.7.0

## 1.1.10

### Patch Changes

- Updated dependencies [9256ca7]
  - @qazuor/qzpay-core@1.6.5

## 1.1.9

### Patch Changes

- Updated dependencies [23a1b5b]
  - @qazuor/qzpay-core@1.6.4

## 1.1.8

### Patch Changes

- Updated dependencies [ec77be6]
  - @qazuor/qzpay-core@1.6.3

## 1.1.7

### Patch Changes

- Updated dependencies [9779e37]
- Updated dependencies [b73cb1d]
  - @qazuor/qzpay-core@1.6.2

## 1.1.6

### Patch Changes

- Updated dependencies [1edba84]
  - @qazuor/qzpay-core@1.6.1

## 1.1.5

### Patch Changes

- Updated dependencies [4d37d82]
  - @qazuor/qzpay-core@1.6.0

## 1.1.4

### Patch Changes

- Updated dependencies [8420f6a]
  - @qazuor/qzpay-core@1.5.0

## 1.1.3

### Patch Changes

- Updated dependencies [0055abe]
- Updated dependencies [b89f133]
- Updated dependencies [df2ebf7]
- Updated dependencies [bbe8b04]
- Updated dependencies [bc4f89b]
  - @qazuor/qzpay-core@1.4.0

## 1.1.2

### Patch Changes

- Updated dependencies [4425eb6]
- Updated dependencies [91c9a5c]
- Updated dependencies [773d418]
  - @qazuor/qzpay-core@1.3.0

## 1.1.1

### Patch Changes

- Updated dependencies
  - @qazuor/qzpay-core@1.2.1
