# Constants Reference

## Overview

All status values, event types, and configuration options use exported constants with the `QZPay` prefix to avoid magic strings and enable TypeScript autocomplete.

---

## Usage

```typescript
import {
  QZPaySubscriptionStatus,
  QZPayPaymentStatus,
  QZPayBillingEvent,
  QZPayBillingInterval,
  QZPayCurrency,
} from '@qazuor/qzpay-core';

// Type-safe comparisons
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) {
  // ...
}

// Event handlers
billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, handler);
```

---

## Subscription Status

```typescript
export const QZPaySubscriptionStatus = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  PAUSED: 'paused',
  INCOMPLETE: 'incomplete',
  EXPIRED: 'expired',
} as const;

export type QZPaySubscriptionStatusType =
  typeof QZPaySubscriptionStatus[keyof typeof QZPaySubscriptionStatus];
```

---

## Payment Status

```typescript
export const QZPayPaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
  REQUIRES_ACTION: 'requires_action',
} as const;
```

---

## Invoice Status

```typescript
export const QZPayInvoiceStatus = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  VOID: 'void',
  UNCOLLECTIBLE: 'uncollectible',
} as const;
```

---

## Billing Interval

```typescript
export const QZPayBillingInterval = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
} as const;
```

---

## Currency

```typescript
export const QZPayCurrency = {
  USD: 'USD',
  EUR: 'EUR',
  ARS: 'ARS',
  BRL: 'BRL',
  MXN: 'MXN',
  CLP: 'CLP',
  COP: 'COP',
  PEN: 'PEN',
  GBP: 'GBP',
} as const;
```

---

## Checkout Mode

```typescript
export const QZPayCheckoutMode = {
  EMBEDDED: 'embedded',   // Embedded in page
  HOSTED: 'hosted',       // Redirect to hosted page
} as const;
```

---

## Payment Provider

```typescript
export const QZPayPaymentProvider = {
  STRIPE: 'stripe',
  MERCADOPAGO: 'mercadopago',
  BANK_TRANSFER: 'bank_transfer',
} as const;
```

---

## Discount Types

### Base Types (shared)

```typescript
export const QZPayDiscountTypeBase = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_PERIOD: 'free_period',
  REDUCED_PERIOD: 'reduced_period',
} as const;
```

### Promo Code Types

```typescript
export const QZPayPromoCodeType = {
  ...QZPayDiscountTypeBase,
  TRIAL_EXTENSION: 'trial_extension',
} as const;
```

### Automatic Discount Types

```typescript
export const QZPayAutomaticDiscountType = {
  ...QZPayDiscountTypeBase,
  VOLUME: 'volume',
  AMOUNT_THRESHOLD: 'amount_threshold',
  FREE_SHIPPING: 'free_shipping',
} as const;
```

### Unified Discount Type

```typescript
export const QZPayDiscountType = {
  ...QZPayPromoCodeType,
  ...QZPayAutomaticDiscountType,
} as const;
```

---

## Discount Stacking Mode

```typescript
export const QZPayDiscountStackingMode = {
  BEST_DISCOUNT: 'best_discount',      // Only highest applies
  ALL_STACKABLE: 'all_stackable',      // All stackable combine
  AUTOMATIC_FIRST: 'automatic_first',  // Automatic first, then promo
} as const;
```

---

## Proration Behavior

```typescript
export const QZPayProrationBehavior = {
  IMMEDIATELY: 'immediately',   // Apply with prorated charges
  NEXT_PERIOD: 'next_period',   // Apply at next billing
  NONE: 'none',                 // No proration calculation
} as const;
```

---

## Cancel At

```typescript
export const QZPayCancelAt = {
  IMMEDIATELY: 'immediately',   // Cancel now, access ends
  PERIOD_END: 'period_end',     // Cancel at period end
  TRIAL_END: 'trial_end',       // Cancel at trial end
} as const;
```

---

## Vendor Status

```typescript
export const QZPayVendorOnboardingStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const QZPayVendorPaymentMode = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
} as const;
```

---

## Notification Mode

```typescript
export const QZPayNotificationMode = {
  PACKAGE_ONLY: 'package_only',   // Package sends all
  EVENTS_ONLY: 'events_only',     // Only emit events
  HYBRID: 'hybrid',               // Package sends, project can override
} as const;
```

---

## Transaction Isolation

```typescript
export const QZPayTransactionIsolation = {
  SERIALIZABLE: 'serializable',
  REPEATABLE_READ: 'repeatable_read',
  READ_COMMITTED: 'read_committed',
} as const;
```

---

## Day of Week

```typescript
export const QZPayDayOfWeek = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday',
} as const;
```

---

## Discount Conditions

```typescript
export const QZPayDiscountCondition = {
  MIN_PURCHASE_AMOUNT: 'minPurchaseAmount',
  MAX_PURCHASE_AMOUNT: 'maxPurchaseAmount',
  MIN_QUANTITY: 'minQuantity',
  MIN_QUANTITY_PER_PRODUCT: 'minQuantityPerProduct',
  IS_FIRST_PURCHASE: 'isFirstPurchase',
  CUSTOMER_SEGMENTS: 'customerSegments',
  REGISTERED_AFTER: 'registeredAfter',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  EXCLUDE_PRODUCTS: 'excludeProducts',
  EXCLUDE_CATEGORIES: 'excludeCategories',
  SCHEDULE: 'schedule',
  VALID_FROM: 'validFrom',
  VALID_UNTIL: 'validUntil',
  MAX_REDEMPTIONS: 'maxRedemptions',
} as const;
```

---

## Related Documents

- [Public API](./PUBLIC-API.md)
- [Events Reference](./EVENTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
