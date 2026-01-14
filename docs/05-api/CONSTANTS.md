# Constants Reference

## Overview

All status values, event types, and configuration options use exported constants with the `QZPAY_` prefix (uppercase) to avoid magic strings and enable TypeScript autocomplete.

---

## Usage

```typescript
import {
  QZPAY_SUBSCRIPTION_STATUS,
  QZPAY_PAYMENT_STATUS,
  QZPAY_BILLING_EVENT,
  QZPAY_BILLING_INTERVAL,
  QZPAY_CURRENCY,
} from '@qazuor/qzpay-core';

// Type-safe comparisons
if (subscription.status === QZPAY_SUBSCRIPTION_STATUS.ACTIVE) {
  // ...
}

// Event handlers
billing.on(QZPAY_BILLING_EVENT.PAYMENT_SUCCEEDED, handler);
```

---

## Subscription Status

```typescript
export const QZPAY_SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  PAUSED: 'paused',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
} as const;

export type QZPaySubscriptionStatus =
  (typeof QZPAY_SUBSCRIPTION_STATUS)[keyof typeof QZPAY_SUBSCRIPTION_STATUS];
```

---

## Payment Status

```typescript
export const QZPAY_PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
} as const;

export type QZPayPaymentStatus =
  (typeof QZPAY_PAYMENT_STATUS)[keyof typeof QZPAY_PAYMENT_STATUS];
```

---

## Billing Interval

```typescript
export const QZPAY_BILLING_INTERVAL = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
} as const;

export type QZPayBillingInterval =
  (typeof QZPAY_BILLING_INTERVAL)[keyof typeof QZPAY_BILLING_INTERVAL];
```

---

## Currency (ISO 4217)

```typescript
export const QZPAY_CURRENCY = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  ARS: 'ARS',
  BRL: 'BRL',
  MXN: 'MXN',
  CLP: 'CLP',
  COP: 'COP',
  PEN: 'PEN',
  UYU: 'UYU',
} as const;

export type QZPayCurrency =
  (typeof QZPAY_CURRENCY)[keyof typeof QZPAY_CURRENCY];
```

---

## Checkout Mode

```typescript
export const QZPAY_CHECKOUT_MODE = {
  PAYMENT: 'payment',         // One-time payment
  SUBSCRIPTION: 'subscription', // Recurring subscription
  SETUP: 'setup',             // Save payment method
} as const;

export type QZPayCheckoutMode =
  (typeof QZPAY_CHECKOUT_MODE)[keyof typeof QZPAY_CHECKOUT_MODE];
```

---

## Payment Provider

```typescript
export const QZPAY_PAYMENT_PROVIDER = {
  STRIPE: 'stripe',
  MERCADOPAGO: 'mercadopago',
} as const;

export type QZPayPaymentProvider =
  (typeof QZPAY_PAYMENT_PROVIDER)[keyof typeof QZPAY_PAYMENT_PROVIDER];
```

---

## Discount Type

```typescript
export const QZPAY_DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_TRIAL: 'free_trial',
} as const;

export type QZPayDiscountType =
  (typeof QZPAY_DISCOUNT_TYPE)[keyof typeof QZPAY_DISCOUNT_TYPE];
```

---

## Discount Stacking Mode

```typescript
export const QZPAY_DISCOUNT_STACKING_MODE = {
  NONE: 'none',               // No stacking
  ADDITIVE: 'additive',       // Discounts add together
  MULTIPLICATIVE: 'multiplicative', // Discounts multiply
  BEST: 'best',               // Only best discount applies
} as const;

export type QZPayDiscountStackingMode =
  (typeof QZPAY_DISCOUNT_STACKING_MODE)[keyof typeof QZPAY_DISCOUNT_STACKING_MODE];
```

---

## Cancel At

```typescript
export const QZPAY_CANCEL_AT = {
  IMMEDIATELY: 'immediately',   // Cancel now, access ends
  PERIOD_END: 'period_end',     // Cancel at billing period end
} as const;

export type QZPayCancelAt =
  (typeof QZPAY_CANCEL_AT)[keyof typeof QZPAY_CANCEL_AT];
```

---

## All Available Constants

| Constant | Export Name | Values |
|----------|-------------|--------|
| Subscription Status | `QZPAY_SUBSCRIPTION_STATUS` | active, trialing, past_due, paused, canceled, unpaid, incomplete, incomplete_expired |
| Payment Status | `QZPAY_PAYMENT_STATUS` | pending, processing, succeeded, failed, canceled, refunded, partially_refunded, disputed |
| Billing Interval | `QZPAY_BILLING_INTERVAL` | day, week, month, year |
| Currency | `QZPAY_CURRENCY` | USD, EUR, GBP, ARS, BRL, MXN, CLP, COP, PEN, UYU |
| Checkout Mode | `QZPAY_CHECKOUT_MODE` | payment, subscription, setup |
| Payment Provider | `QZPAY_PAYMENT_PROVIDER` | stripe, mercadopago |
| Discount Type | `QZPAY_DISCOUNT_TYPE` | percentage, fixed_amount, free_trial |
| Discount Stacking | `QZPAY_DISCOUNT_STACKING_MODE` | none, additive, multiplicative, best |
| Cancel At | `QZPAY_CANCEL_AT` | immediately, period_end |
| Billing Events | `QZPAY_BILLING_EVENT` | See [Events Reference](./EVENTS.md) |

---

## TypeScript Types

Each constant exports a corresponding type:

```typescript
import type {
  QZPaySubscriptionStatus,
  QZPayPaymentStatus,
  QZPayBillingInterval,
  QZPayCurrency,
  QZPayCheckoutMode,
  QZPayPaymentProvider,
  QZPayDiscountType,
  QZPayDiscountStackingMode,
  QZPayCancelAt,
  QZPayBillingEvent,
} from '@qazuor/qzpay-core';
```

---

## Related Documents

- [Public API](./PUBLIC-API.md)
- [Events Reference](./EVENTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
