# Design Patterns

## Overview

This document describes the key design patterns used in @qazuor/qzpay.

---

## 1. Exported Constants Pattern

All status values, event types, and configuration options use exported constants with the `QZPay` prefix.

### Why?

- Prevents typos with magic strings
- Enables TypeScript autocomplete
- Avoids naming collisions with other packages
- Tree-shakeable

### Implementation

```typescript
// packages/core/src/constants/subscription-status.ts

export const QZPaySubscriptionStatus = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  PAUSED: 'paused',
} as const;

// TypeScript type derived from constant
export type QZPaySubscriptionStatusType =
  typeof QZPaySubscriptionStatus[keyof typeof QZPaySubscriptionStatus];
```

### Usage

```typescript
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';

// Type-safe comparison
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) {
  // ...
}

// Event handling
billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event) => {
  // ...
});
```

---

## 2. Adapter Pattern

All external dependencies are abstracted through adapter interfaces.

### Payment Adapter

```typescript
export interface QZPayPaymentAdapter {
  // Customer management
  createCustomer(data: CreateCustomerData): Promise<ProviderCustomer>;
  updateCustomer(id: string, data: UpdateCustomerData): Promise<ProviderCustomer>;

  // Payments
  createPayment(data: CreatePaymentData): Promise<ProviderPayment>;
  refundPayment(id: string, amount?: number): Promise<ProviderRefund>;

  // Subscriptions
  createSubscription(data: CreateSubscriptionData): Promise<ProviderSubscription>;
  cancelSubscription(id: string, immediately: boolean): Promise<void>;

  // Webhooks
  verifyWebhook(payload: string, signature: string): boolean;
  parseWebhook(payload: string): WebhookEvent;
}
```

### Storage Adapter

```typescript
export interface QZPayStorageAdapter {
  // Collections
  customers: QZPayCustomerCollection;
  subscriptions: QZPaySubscriptionCollection;
  payments: QZPayPaymentCollection;
  invoices: QZPayInvoiceCollection;

  // Transaction support
  transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
```

### Benefits

1. **Swap implementations** without changing business logic
2. **Easy testing** with mock adapters
3. **Future-proof** - add new providers without core changes

---

## 3. Entitlements and Limits System

Separates boolean features (entitlements) from numeric restrictions (limits).

### Entitlements (Boolean Features)

```typescript
export interface QZPayEntitlements {
  canAccessAnalytics: boolean;
  canAccessPrioritySupport: boolean;
  canAccessApi: boolean;
  canExportData: boolean;
  canUseCustomBranding: boolean;
  [key: string]: boolean;
}
```

### Limits (Numeric Restrictions)

```typescript
export interface QZPayLimits {
  maxProperties: number;        // -1 = unlimited
  maxBots: number;
  maxMessagesPerMonth: number;
  maxStorageMb: number;
  [key: string]: number;
}
```

### Usage in Plans

```typescript
const proPlan: QZPayPlanDefinition = {
  id: 'pro',
  name: 'Pro Plan',
  entitlements: {
    canAccessAnalytics: true,
    canExportData: true,
  },
  limits: {
    maxProjects: 10,
    maxStorageMb: 5000,
  },
};
```

### Checking in Application

```typescript
const subscription = await billing.subscriptions.get(id);
const entitlements = subscription.getEntitlements<MyEntitlements>();
const limits = subscription.getLimits<MyLimits>();

if (entitlements.canAccessAnalytics) {
  // Show analytics
}

if (currentProjects >= limits.maxProjects && limits.maxProjects !== -1) {
  // Show upgrade prompt
}
```

---

## 4. Event-Driven Architecture

All billing operations emit events that can be subscribed to.

### Event Structure

```typescript
export interface QZPayEventPayload {
  type: QZPayBillingEventType;
  timestamp: Date;
  emailSentByPackage: boolean;  // Indicates if package sent notification
  data: Record<string, unknown>;
}
```

### Event Categories

| Category | Events |
|----------|--------|
| Customer | CREATED, UPDATED, DELETED |
| Subscription | CREATED, ACTIVATED, CANCELED, RENEWED, etc. |
| Trial | STARTED, EXPIRING, EXPIRED, CONVERTED |
| Payment | SUCCEEDED, FAILED, REFUNDED |
| Invoice | CREATED, PAID, OVERDUE |
| Promo | APPLIED, EXPIRED, LIMIT_REACHED |

### Subscription

```typescript
billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event) => {
  console.log('New subscription:', event.data.subscriptionId);
});

billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  if (!event.emailSentByPackage) {
    // Send custom email
    await sendCustomTrialReminder(event.data.customerId);
  }
});
```

---

## 5. Subscription Helpers Pattern

Subscriptions are returned with helper methods for common operations.

### Available Helpers

```typescript
interface QZPaySubscriptionWithHelpers extends QZPaySubscription {
  // Status checks
  isActive(): boolean;
  isTrial(): boolean;
  hasAccess(): boolean;  // active OR trialing OR grace period
  isInGracePeriod(): boolean;
  willCancel(): boolean;

  // Property shortcuts
  hasPaymentMethod: boolean;  // Pre-calculated

  // Time calculations
  daysUntilRenewal(): number;
  daysUntilTrialEnd(): number | null;

  // Feature access
  getEntitlements<T extends QZPayEntitlements>(): T;
  getLimits<T extends QZPayLimits>(): T;
}
```

### Benefits

- **Encapsulates complex logic** (e.g., grace period calculation)
- **Type-safe** access to entitlements and limits
- **Tested** - logic is in one place, tested thoroughly
- **Consistent** - all consumers use same logic

---

## 6. Email Suppress Pattern

Projects can suppress package emails and handle notifications themselves.

### Configuration

```typescript
const billing = createQZPayBilling({
  notifications: {
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
    ],
  },
});
```

### Event Indicator

```typescript
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  // Check if package already sent email
  if (!event.emailSentByPackage) {
    // Handle custom notification
    await sendBrandedEmail(event.data);
  }
});
```

### Benefits

- **No duplicate emails** - clear ownership
- **Custom branding** - projects can use their own templates
- **Flexibility** - mix package and custom notifications

---

## 7. Factory Pattern

All major components are created through factory functions.

```typescript
// Core billing
const billing = createQZPayBilling({
  storage: createQZPayDrizzleStorage({ db }),
  paymentAdapter: createQZPayStripeAdapter({ secretKey }),
  plans: PLANS,
});

// Auto-configure from environment
const billing = createQZPayBillingFromEnv({
  storage: createQZPayDrizzleStorage({ db }),
  plans: PLANS,
});
```

### Benefits

- **Clear configuration** - all options visible
- **Validation** - factory can validate config
- **Environment detection** - auto-configure from env vars

---

## Related Documents

- [Architecture Overview](./OVERVIEW.md)
- [Security](./SECURITY.md)
- [Resilience](./RESILIENCE.md)
