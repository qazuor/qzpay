# Events Reference

## Overview

@qazuor/qzpay uses an event-driven architecture. All billing operations emit events that can be subscribed to.

---

## Event Structure

```typescript
interface QZPayEventPayload {
  type: QZPayBillingEventType;
  timestamp: Date;
  emailSentByPackage: boolean;
  data: Record<string, unknown>;
}
```

---

## Subscribing to Events

```typescript
import { QZPayBillingEvent } from '@qazuor/qzpay-core';

billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event) => {
  console.log('New subscription:', event.data.subscriptionId);

  // Check if package sent notification
  if (!event.emailSentByPackage) {
    await sendCustomWelcomeEmail(event.data.customerId);
  }
});
```

---

## Event Categories

### Customer Events

| Event | Description |
|-------|-------------|
| `CUSTOMER_CREATED` | New customer created |
| `CUSTOMER_UPDATED` | Customer data updated |
| `CUSTOMER_DELETED` | Customer soft-deleted |
| `CUSTOMER_MERGED` | Two customers merged |

### Subscription Events

| Event | Description |
|-------|-------------|
| `SUBSCRIPTION_CREATED` | New subscription created |
| `SUBSCRIPTION_ACTIVATED` | Subscription became active |
| `SUBSCRIPTION_UPDATED` | Subscription updated |
| `SUBSCRIPTION_CANCELED` | Subscription canceled |
| `SUBSCRIPTION_RENEWED` | Subscription renewed for new period |
| `SUBSCRIPTION_PAUSED` | Subscription paused |
| `SUBSCRIPTION_RESUMED` | Subscription resumed from pause |
| `SUBSCRIPTION_EXPIRING` | Subscription about to expire |
| `SUBSCRIPTION_EXPIRED` | Subscription expired |

### Plan Change Events

When a plan change occurs, `PLAN_CHANGED` fires **always**, plus ONE of the specific events:

| Event | Description |
|-------|-------------|
| `PLAN_CHANGED` | Fired on every plan change (generic) |
| `SUBSCRIPTION_UPGRADED` | Moved to higher-priced plan |
| `SUBSCRIPTION_DOWNGRADED` | Moved to lower-priced plan |
| `SUBSCRIPTION_PLAN_LATERAL` | Moved to same-priced plan |

### Trial Events

| Event | Description |
|-------|-------------|
| `TRIAL_STARTED` | Trial period started |
| `TRIAL_EXPIRING` | Trial ending soon (7 days, 3 days, 1 day) |
| `TRIAL_EXPIRED` | Trial period ended |
| `TRIAL_CONVERTED` | Trial converted to paid subscription |
| `TRIAL_CANCELED` | User canceled during trial (no payment method) |

### Payment Events

| Event | Description |
|-------|-------------|
| `PAYMENT_PENDING` | Payment initiated |
| `PAYMENT_PROCESSING` | Payment being processed |
| `PAYMENT_SUCCEEDED` | Payment completed successfully |
| `PAYMENT_FAILED` | Payment failed |
| `PAYMENT_REFUNDED` | Payment fully refunded |
| `PAYMENT_PARTIALLY_REFUNDED` | Payment partially refunded |
| `PAYMENT_DISPUTED` | Dispute opened on payment |
| `PAYMENT_REQUIRES_ACTION` | 3DS or additional action needed |
| `PAYMENT_RETRY_SCHEDULED` | Retry scheduled for failed payment |

### Invoice Events

| Event | Description |
|-------|-------------|
| `INVOICE_CREATED` | New invoice created |
| `INVOICE_PAID` | Invoice marked as paid |
| `INVOICE_PAYMENT_FAILED` | Invoice payment failed |
| `INVOICE_OVERDUE` | Invoice past due date |
| `INVOICE_VOIDED` | Invoice voided/canceled |

### Grace Period Events

| Event | Description |
|-------|-------------|
| `GRACE_PERIOD_STARTED` | Grace period began after payment failure |
| `GRACE_PERIOD_ENDING` | Grace period about to end |
| `GRACE_PERIOD_EXPIRED` | Grace period ended, access revoked |

### Usage Events

| Event | Description |
|-------|-------------|
| `USAGE_REPORTED` | Usage reported via API |
| `USAGE_THRESHOLD_WARNING` | 80% of included usage reached |
| `USAGE_THRESHOLD_CRITICAL` | 100% of included usage reached |
| `USAGE_THRESHOLD_OVERAGE` | 150% overage threshold reached |
| `USAGE_PERIOD_RESET` | Usage counters reset for new period |
| `USAGE_OVERAGE_CALCULATED` | Overage charges calculated |
| `USAGE_OVERAGE_BILLED` | Overage charges billed |

### Promo Code Events

| Event | Description |
|-------|-------------|
| `PROMO_CODE_APPLIED` | Promo code applied to subscription |
| `PROMO_CODE_EXPIRED` | Promo code expired |
| `PROMO_CODE_LIMIT_REACHED` | Promo code usage limit reached |
| `PROMO_CODE_CREATED` | New promo code created |

### Automatic Discount Events

| Event | Description |
|-------|-------------|
| `AUTOMATIC_DISCOUNT_CREATED` | Admin created automatic discount |
| `AUTOMATIC_DISCOUNT_APPLIED` | Automatic discount applied to purchase |
| `AUTOMATIC_DISCOUNT_EVALUATED` | Discount evaluated but conditions not met |
| `AUTOMATIC_DISCOUNT_UPDATED` | Admin updated discount |
| `AUTOMATIC_DISCOUNT_DEACTIVATED` | Discount deactivated |
| `DISCOUNT_STACKING_CONFLICT` | Multiple discounts conflicted |

### Payment Method Events

| Event | Description |
|-------|-------------|
| `CARD_EXPIRING` | Card expiring soon (30 days) |
| `CARD_EXPIRED` | Card has expired |
| `PAYMENT_METHOD_ADDED` | New payment method added |
| `PAYMENT_METHOD_REMOVED` | Payment method removed |
| `PAYMENT_METHOD_DEFAULT_CHANGED` | Default payment method changed |

### Checkout Events

| Event | Description |
|-------|-------------|
| `CHECKOUT_STARTED` | Checkout session started |
| `CHECKOUT_COMPLETED` | Checkout completed successfully |
| `CHECKOUT_ABANDONED` | Checkout abandoned by user |
| `CHECKOUT_EXPIRED` | Checkout session expired |

### Marketplace Events

| Event | Description |
|-------|-------------|
| `VENDOR_CREATED` | New vendor registered |
| `VENDOR_ONBOARDING_STARTED` | Vendor started onboarding |
| `VENDOR_ONBOARDING_COMPLETED` | Vendor onboarding completed |
| `VENDOR_ONBOARDING_FAILED` | Vendor onboarding failed |
| `VENDOR_PAYOUT_CREATED` | Payout initiated for vendor |
| `VENDOR_PAYOUT_PAID` | Payout completed |
| `VENDOR_PAYOUT_FAILED` | Payout failed |
| `SPLIT_PAYMENT_COMPLETED` | Split payment processed |
| `VENDOR_COMMISSION_CHANGED` | Vendor commission rate changed |

### Webhook Events

| Event | Description |
|-------|-------------|
| `WEBHOOK_RECEIVED` | Webhook received from provider |
| `WEBHOOK_PROCESSED` | Webhook processed successfully |
| `WEBHOOK_FAILED` | Webhook processing failed |
| `WEBHOOK_SIGNATURE_INVALID` | Invalid webhook signature |
| `WEBHOOK_REPLAYED` | Webhook replayed from DLQ |

### Security Events

| Event | Description |
|-------|-------------|
| `FRAUD_DETECTED` | Potential fraud detected |
| `FRAUD_REVIEW_REQUIRED` | Manual review required |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

### Infrastructure Events

| Event | Description |
|-------|-------------|
| `CIRCUIT_BREAKER_OPENED` | Circuit breaker opened for provider |
| `CIRCUIT_BREAKER_CLOSED` | Circuit breaker closed |
| `CIRCUIT_BREAKER_HALF_OPEN` | Circuit breaker testing recovery |
| `EMAIL_SEND_FAILED` | Email sending failed |
| `PROVIDER_ERROR` | Payment provider error |

---

## Email Suppression

Configure which events should NOT send package emails:

```typescript
const billing = createQZPayBilling({
  notifications: {
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
      QZPayBillingEvent.INVOICE_CREATED,
    ],
  },
});
```

In event handlers, check `emailSentByPackage`:

```typescript
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  if (!event.emailSentByPackage) {
    // Handle custom email
    await sendBrandedTrialReminder(event.data);
  }
});
```

---

## Related Documents

- [Public API](./PUBLIC-API.md)
- [Constants Reference](./CONSTANTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
