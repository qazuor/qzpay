# Events Reference

## Overview

@qazuor/qzpay uses an event-driven architecture. All billing operations emit events that can be subscribed to.

---

## Event Constant

Events are accessed via `QZPAY_BILLING_EVENT`:

```typescript
import { QZPAY_BILLING_EVENT } from '@qazuor/qzpay-core';

// Example: QZPAY_BILLING_EVENT.SUBSCRIPTION_CREATED -> 'subscription.created'
```

---

## Event Structure

```typescript
interface QZPayEventPayload {
  type: QZPayBillingEvent;
  timestamp: Date;
  emailSentByPackage: boolean;
  data: Record<string, unknown>;
}
```

---

## Subscribing to Events

```typescript
import { QZPAY_BILLING_EVENT } from '@qazuor/qzpay-core';

billing.on(QZPAY_BILLING_EVENT.SUBSCRIPTION_CREATED, async (event) => {
  console.log('New subscription:', event.data.subscriptionId);

  // Check if package sent notification
  if (!event.emailSentByPackage) {
    await sendCustomWelcomeEmail(event.data.customerId);
  }
});
```

---

## Available Events (29 total)

### Customer Events (3)

| Constant | Value | Description |
|----------|-------|-------------|
| `CUSTOMER_CREATED` | `customer.created` | New customer created |
| `CUSTOMER_UPDATED` | `customer.updated` | Customer data updated |
| `CUSTOMER_DELETED` | `customer.deleted` | Customer soft-deleted |

### Subscription Events (7)

| Constant | Value | Description |
|----------|-------|-------------|
| `SUBSCRIPTION_CREATED` | `subscription.created` | New subscription created |
| `SUBSCRIPTION_UPDATED` | `subscription.updated` | Subscription updated |
| `SUBSCRIPTION_CANCELED` | `subscription.canceled` | Subscription canceled |
| `SUBSCRIPTION_PAUSED` | `subscription.paused` | Subscription paused |
| `SUBSCRIPTION_RESUMED` | `subscription.resumed` | Subscription resumed from pause |
| `SUBSCRIPTION_TRIAL_ENDING` | `subscription.trial_ending` | Trial period ending soon |
| `SUBSCRIPTION_TRIAL_ENDED` | `subscription.trial_ended` | Trial period ended |

### Payment Events (4)

| Constant | Value | Description |
|----------|-------|-------------|
| `PAYMENT_SUCCEEDED` | `payment.succeeded` | Payment completed successfully |
| `PAYMENT_FAILED` | `payment.failed` | Payment failed |
| `PAYMENT_REFUNDED` | `payment.refunded` | Payment refunded |
| `PAYMENT_DISPUTED` | `payment.disputed` | Dispute opened on payment |

### Invoice Events (4)

| Constant | Value | Description |
|----------|-------|-------------|
| `INVOICE_CREATED` | `invoice.created` | New invoice created |
| `INVOICE_PAID` | `invoice.paid` | Invoice marked as paid |
| `INVOICE_PAYMENT_FAILED` | `invoice.payment_failed` | Invoice payment failed |
| `INVOICE_VOIDED` | `invoice.voided` | Invoice voided/canceled |

### Checkout Events (2)

| Constant | Value | Description |
|----------|-------|-------------|
| `CHECKOUT_COMPLETED` | `checkout.completed` | Checkout completed successfully |
| `CHECKOUT_EXPIRED` | `checkout.expired` | Checkout session expired |

### Vendor/Marketplace Events (3)

| Constant | Value | Description |
|----------|-------|-------------|
| `VENDOR_CREATED` | `vendor.created` | New vendor registered |
| `VENDOR_UPDATED` | `vendor.updated` | Vendor data updated |
| `VENDOR_PAYOUT` | `vendor.payout` | Payout initiated for vendor |

### Add-on Events (6)

| Constant | Value | Description |
|----------|-------|-------------|
| `ADDON_CREATED` | `addon.created` | New add-on created |
| `ADDON_UPDATED` | `addon.updated` | Add-on updated |
| `ADDON_DELETED` | `addon.deleted` | Add-on deleted |
| `SUBSCRIPTION_ADDON_ADDED` | `subscription.addon_added` | Add-on added to subscription |
| `SUBSCRIPTION_ADDON_REMOVED` | `subscription.addon_removed` | Add-on removed from subscription |
| `SUBSCRIPTION_ADDON_UPDATED` | `subscription.addon_updated` | Subscription add-on updated |

---

## Email Suppression

Configure which events should NOT send package emails:

```typescript
import { createQZPayBilling, QZPAY_BILLING_EVENT } from '@qazuor/qzpay-core';

const billing = createQZPayBilling({
  storage: storageAdapter,
  paymentAdapter: stripeAdapter,
  notifications: {
    suppress: [
      QZPAY_BILLING_EVENT.SUBSCRIPTION_TRIAL_ENDING,
      QZPAY_BILLING_EVENT.INVOICE_CREATED,
    ],
  },
});
```

In event handlers, check `emailSentByPackage`:

```typescript
billing.on(QZPAY_BILLING_EVENT.SUBSCRIPTION_TRIAL_ENDING, async (event) => {
  if (!event.emailSentByPackage) {
    // Handle custom email
    await sendBrandedTrialReminder(event.data);
  }
});
```

---

## TypeScript Types

```typescript
import type { QZPayBillingEvent } from '@qazuor/qzpay-core';

// Type for event handler
type EventHandler = (event: QZPayEventPayload) => Promise<void> | void;

// All available event values
import { QZPAY_BILLING_EVENT_VALUES } from '@qazuor/qzpay-core';
// Returns: ['customer.created', 'customer.updated', ...]
```

---

## Related Documents

- [Public API](./PUBLIC-API.md)
- [Constants Reference](./CONSTANTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
