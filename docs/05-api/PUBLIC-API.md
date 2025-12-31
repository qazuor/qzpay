# Public API Reference

## Overview

This document describes the public API of @qazuor/qzpay-core and related packages.

---

## Initialization

### createQZPayBilling

Main factory function to create a billing instance.

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';

const billing = createQZPayBilling({
  storage: createQZPayDrizzleStorage({ db }),
  paymentAdapter: createQZPayStripeAdapter({
    secretKey: process.env.STRIPE_SECRET_KEY,
  }),
  plans: PLANS,
  notifications: {
    suppress: [QZPayBillingEvent.TRIAL_EXPIRING],
  },
});
```

### createQZPayBillingFromEnv

Auto-configure from environment variables.

```typescript
import { createQZPayBillingFromEnv } from '@qazuor/qzpay-core';

// Auto-detects STRIPE_SECRET_KEY, MP_ACCESS_TOKEN, etc.
const billing = createQZPayBillingFromEnv({
  storage: createQZPayDrizzleStorage({ db }),
  plans: PLANS,
});
```

---

## Customer Management

### billing.customers.create

Create a new billing customer.

```typescript
const customer = await billing.customers.create({
  externalId: 'user_123',
  email: 'user@example.com',
  name: 'John Doe',
  metadata: { tier: 'premium' },
});
```

### billing.customers.get

Get customer by ID.

```typescript
const customer = await billing.customers.get(customerId);
```

### billing.customers.getByExternalId

Get customer by external (application) ID.

```typescript
const customer = await billing.customers.getByExternalId(userId);
```

### billing.customers.syncUser

Create or update customer from application user.

```typescript
const customer = await billing.customers.syncUser({
  externalId: user.id,
  email: user.email,
  name: user.name,
});
```

### billing.customers.update

Update customer information.

```typescript
const customer = await billing.customers.update(customerId, {
  email: 'new@example.com',
  metadata: { tier: 'enterprise' },
});
```

### billing.customers.delete

Soft-delete a customer.

```typescript
await billing.customers.delete(customerId);
```

---

## Subscription Management

### billing.subscriptions.create

Create a new subscription.

```typescript
const subscription = await billing.subscriptions.create({
  customerId: 'cust_123',
  planId: 'pro',
  interval: QZPayBillingInterval.MONTH,
  trialDays: 14,
  trialRequiresPaymentMethod: false,
  promoCode: 'WELCOME20',
  idempotencyKey: 'sub_create_abc123',
});
```

### billing.subscriptions.get

Get subscription with helper methods.

```typescript
const subscription = await billing.subscriptions.get(subscriptionId);

// Helper methods
subscription.isActive();           // true if status is active
subscription.isTrial();            // true if status is trialing
subscription.hasAccess();          // true if active, trialing, or grace period
subscription.hasPaymentMethod;     // pre-calculated boolean
subscription.isInGracePeriod();    // true if past_due within grace
subscription.willCancel();         // true if cancelAt is set
subscription.daysUntilRenewal();   // number
subscription.daysUntilTrialEnd();  // number | null
subscription.getEntitlements<T>(); // typed entitlements
subscription.getLimits<T>();       // typed limits
```

### billing.subscriptions.getActiveByCustomerExternalId

Get active subscription by user ID.

```typescript
const subscription = await billing.subscriptions.getActiveByCustomerExternalId(userId);
```

### billing.subscriptions.list

List customer subscriptions.

```typescript
const subscriptions = await billing.subscriptions.list({
  customerId: 'cust_123',
  status: [QZPaySubscriptionStatus.ACTIVE, QZPaySubscriptionStatus.TRIALING],
  includeEnded: false,
});
```

### billing.subscriptions.changePlan

Upgrade or downgrade subscription.

```typescript
const subscription = await billing.subscriptions.changePlan({
  subscriptionId: 'sub_123',
  newPlanId: 'enterprise',
  proration: QZPayProrationBehavior.IMMEDIATELY,
});
```

### billing.subscriptions.cancel

Cancel a subscription.

```typescript
await billing.subscriptions.cancel({
  subscriptionId: 'sub_123',
  cancelAt: QZPayCancelAt.PERIOD_END,
  reason: 'Customer requested',
});
```

### billing.subscriptions.pause / resume

Pause and resume subscription.

```typescript
await billing.subscriptions.pause(subscriptionId, {
  reason: 'Vacation',
});

await billing.subscriptions.resume(subscriptionId);
```

---

## Payment Methods

### billing.paymentMethods.list

List customer payment methods.

```typescript
const methods = await billing.paymentMethods.list(customerId);
```

### billing.paymentMethods.setDefault

Set default payment method.

```typescript
await billing.paymentMethods.setDefault(customerId, paymentMethodId);
```

### billing.paymentMethods.delete

Remove a payment method.

```typescript
await billing.paymentMethods.delete(paymentMethodId);
```

---

## Invoices

### billing.invoices.list

List customer invoices.

```typescript
const invoices = await billing.invoices.list({
  customerId: 'cust_123',
  status: QZPayInvoiceStatus.PAID,
});
```

### billing.invoices.get

Get invoice by ID.

```typescript
const invoice = await billing.invoices.get(invoiceId);
```

### billing.invoices.getDownloadUrl

Get invoice PDF download URL.

```typescript
const url = await billing.invoices.getDownloadUrl(invoiceId);
```

---

## Promo Codes

### billing.promoCodes.validate

Validate a promo code.

```typescript
const validation = await billing.promoCodes.validate({
  code: 'WELCOME20',
  customerId: 'cust_123',
  planId: 'pro',
});

if (validation.valid) {
  console.log('Discount:', validation.discount);
}
```

### billing.promoCodes.apply

Apply promo code to subscription.

```typescript
await billing.promoCodes.apply({
  code: 'WELCOME20',
  subscriptionId: 'sub_123',
});
```

---

## Usage Reporting

### billing.usage.report

Report usage for usage-based billing.

```typescript
await billing.usage.report({
  subscriptionId: 'sub_123',
  records: [
    { metric: 'api_calls', quantity: 1500 },
    { metric: 'storage_mb', quantity: 250 },
  ],
  idempotencyKey: 'usage_report_abc123',
});
```

### billing.usage.getCurrent

Get current period usage.

```typescript
const usage = await billing.usage.getCurrent(subscriptionId);
// { api_calls: { used: 1500, limit: 10000 }, ... }
```

---

## Metrics

### billing.metrics.getRevenue

Get revenue metrics.

```typescript
const revenue = await billing.metrics.getRevenue({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  currency: 'USD',
});
```

### billing.metrics.getMRR

Get Monthly Recurring Revenue.

```typescript
const mrr = await billing.metrics.getMRR({ currency: 'USD' });
```

### billing.metrics.getChurn

Get churn rate.

```typescript
const churn = await billing.metrics.getChurn({
  period: 'month',
  date: '2025-01',
});
```

---

## Event Subscription

### billing.on

Subscribe to billing events.

```typescript
billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event) => {
  console.log('New subscription:', event.data.subscriptionId);
});

billing.on(QZPayBillingEvent.PAYMENT_FAILED, async (event) => {
  if (!event.emailSentByPackage) {
    await sendCustomPaymentFailedEmail(event.data);
  }
});
```

---

## Related Documents

- [Events Reference](./EVENTS.md)
- [Constants Reference](./CONSTANTS.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
