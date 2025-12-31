# Functional Requirements

## Overview

This document defines the functional requirements for @qazuor/qzpay, organized by domain area.

---

## 1. Customer Management

### FR-CUST-001: Create Customer

**Priority**: Critical

**Description**: Create a customer record linked to an external user ID

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| externalId | string | Yes | User ID in the consuming application |
| email | string | Yes | Customer email address |
| name | string | No | Customer display name |
| metadata | object | No | Custom key-value data |

| Output | Type | Description |
|--------|------|-------------|
| customer | Customer | Created customer object |

**Business Rules**:
- externalId must be unique per project
- Customer is automatically created in payment providers when first payment is made
- Email must be valid format

### FR-CUST-002: Sync Customer with User

**Priority**: High

**Description**: Ensure customer record is linked and synced with application user

```typescript
const customer = await billing.customers.syncUser({
  externalId: user.id,
  email: user.email,
  name: user.name,
});
```

**Business Rules**:
- Creates customer if not exists
- Updates customer data if exists and changed
- Syncs with payment providers if connected

### FR-CUST-003: Get Customer

**Priority**: Critical

**Description**: Retrieve customer by ID or external ID

### FR-CUST-004: Update Customer

**Priority**: High

**Description**: Update customer information

**Business Rules**:
- Changes to email must be synced with payment providers
- Metadata merge is additive (new keys added, existing keys updated)

### FR-CUST-005: Delete Customer

**Priority**: Medium

**Description**: Soft-delete customer and cancel all active subscriptions

**Business Rules**:
- Must cancel all active subscriptions first
- Customer data retained for 7 years (compliance)
- Can be permanently deleted via admin action

---

## 2. Subscription Management

### FR-SUB-001: Create Subscription

**Priority**: Critical

**Description**: Create a new subscription for a customer

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer to subscribe |
| planId | string | Yes | Plan identifier |
| interval | enum | Yes | weekly, monthly, quarterly, yearly, custom |
| trialDays | number | No | Trial period length (0 = no trial) |
| trialRequiresPaymentMethod | boolean | No | Whether trial requires card (default: true) |
| promoCode | string | No | Promo code to apply |
| startDate | Date | No | When to start (default: now) |
| metadata | object | No | Custom data |

| Output | Type | Description |
|--------|------|-------------|
| subscription | QZPaySubscriptionWithHelpers | Created subscription with helper methods |

**Business Rules**:
- Customer can have multiple subscriptions (to different plans)
- Trial period starts immediately or at startDate
- If `trialRequiresPaymentMethod: false`, subscription created without payment method
- If no payment method and trial requires it, subscription created in `incomplete` status
- Promo code validated before creation

**Billing Date Normalization**:

All subscription dates are normalized to UTC midnight:

| Input Field | Normalization | Stored Value |
|-------------|---------------|--------------|
| `startDate` | Truncated to 00:00:00 UTC | `2025-01-15T00:00:00Z` |
| `trial_end` | Set to 23:59:59 UTC of the day | `2025-01-29T23:59:59Z` |
| `current_period_start` | Always 00:00:00 UTC | `2025-01-15T00:00:00Z` |
| `current_period_end` | Always 00:00:00 UTC (exclusive) | `2025-02-15T00:00:00Z` |

### FR-SUB-002: Get Subscription with Helpers

**Priority**: Critical

**Description**: Retrieve subscription by ID with helper methods

```typescript
const subscription = await billing.subscriptions.get(subscriptionId);

// Helper methods
subscription.isActive();         // true if status is active
subscription.isTrial();          // true if status is trialing
subscription.hasAccess();        // true if active, trialing, or in grace period
subscription.hasPaymentMethod;   // true if payment method attached
subscription.getEntitlements();  // returns typed entitlements
subscription.getLimits();        // returns typed limits
subscription.isInGracePeriod();  // true if past_due but within grace period
subscription.willCancel();       // true if cancelAt is set
subscription.daysUntilRenewal(); // days until next billing
subscription.daysUntilTrialEnd(); // days until trial ends
```

### FR-SUB-003: Get Active Subscription by Customer External ID

**Priority**: Critical

**Description**: Get active subscription using the application's user ID

```typescript
const subscription = await billing.subscriptions.getActiveByCustomerExternalId(userId);
```

**Business Rules**:
- Returns the active subscription for the customer
- Returns null if no active subscription
- Includes all helper methods

### FR-SUB-004: List Customer Subscriptions

**Priority**: Critical

**Description**: List all subscriptions for a customer

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| status | QZPaySubscriptionStatus[] | No | Filter by status using constants |
| includeEnded | boolean | No | Include canceled/expired |

### FR-SUB-005: Change Subscription Plan

**Priority**: High

**Description**: Upgrade or downgrade subscription plan

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| subscriptionId | string | Yes | Subscription to change |
| newPlanId | string | Yes | Target plan |
| newInterval | QZPayBillingInterval | No | New billing interval |
| proration | QZPayProrationBehaviorType | No | IMMEDIATELY, NEXT_PERIOD, NONE |

**Proration Formula**:

```typescript
// Days remaining in current period
const daysRemaining = differenceInDays(subscription.currentPeriodEnd, new Date());
const totalDaysInPeriod = differenceInDays(subscription.currentPeriodEnd, subscription.currentPeriodStart);

// Unused value from current plan
const unusedRatio = daysRemaining / totalDaysInPeriod;
const unusedCredit = Math.round(currentPlanPrice * unusedRatio);

// Value of new plan for remaining days
const newPlanProrated = Math.round(newPlanPrice * unusedRatio);

// Net charge or credit
const netAmount = newPlanProrated - unusedCredit;
```

**Edge Cases**:

| Scenario | Behavior |
|----------|----------|
| Same-day change | Full proration for remaining period |
| Last day of period | Minimal proration, change applies next period |
| Free trial active | No proration (no value to credit) |
| Paused subscription | Proration calculated from resume date |
| Plan price is $0 | Credit unused amount, no charge |

---

## 3. Payment Processing

### FR-PAY-001: Create One-Time Payment

**Priority**: Critical

**Description**: Process a one-time payment

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| amount | number | Yes | Amount in cents |
| currency | QZPayCurrency | Yes | Currency code |
| paymentMethodId | string | No | Saved payment method |
| description | string | No | Payment description |
| idempotencyKey | string | Yes | Prevent duplicate charges |

### FR-PAY-002: Handle Payment Failure

**Priority**: Critical

**Description**: Manage failed payment scenarios with configurable retry logic and grace periods.

#### Default Configuration

```typescript
const defaultPaymentRetryConfig = {
  /** Days after initial failure to retry */
  retryIntervals: [1, 3, 5, 7],

  /** Maximum retry attempts */
  maxAttempts: 4,

  /** Days customer retains access after first failure */
  gracePeriodDays: 7,

  /** Whether to send email after each failure */
  notifyOnEachFailure: true,

  /** Whether to send email before grace period expires */
  notifyBeforeGraceExpires: true,

  /** Days before grace expiration to notify */
  graceExpirationWarningDays: [2, 1],
};
```

#### Retry Timeline

```
Day 0: Initial payment fails
       → subscription.status = 'past_due'
       → grace period starts
       → hasAccess() = true
       → Send "Payment Failed" email

Day 1: Retry #1
       → If success: status = 'active', grace ends
       → If failure: continue grace period

Day 3: Retry #2
       → If success: status = 'active', grace ends
       → If failure: continue grace period

Day 5: Retry #3 (grace warning: 2 days remaining)
       → If success: status = 'active', grace ends
       → If failure: Send "Grace Period Expiring" email

Day 6: Grace warning: 1 day remaining
       → Send "Last Day to Update Payment" email

Day 7: Retry #4 (final) + grace period ends
       → If success: status = 'active'
       → If failure: status = 'canceled', hasAccess() = false
       → Send "Subscription Canceled" email
```

#### Grace Period Access Rules

| Configuration | Access During Grace | Use Case |
|---------------|---------------------|----------|
| `gracePeriodAccess: 'full'` | Full feature access | Default, user-friendly |
| `gracePeriodAccess: 'limited'` | Read-only or restricted | Encourage payment update |
| `gracePeriodAccess: 'none'` | No access | Strict enforcement |

```typescript
// Optional: Limit features during grace period
const billing = createQZPayBilling({
  subscriptions: {
    gracePeriodDays: 7,
    gracePeriodAccess: 'limited',
    gracePeriodLimitations: {
      disableFeatures: ['api_access', 'export'],
      limitUsage: { maxApiCalls: 10 },
    },
  },
});
```

#### Events Emitted

| Event | When |
|-------|------|
| `PAYMENT_FAILED` | Each failed payment attempt |
| `PAYMENT_RETRY_SCHEDULED` | When next retry is scheduled |
| `GRACE_PERIOD_STARTED` | When grace period begins |
| `GRACE_PERIOD_EXPIRING` | Warning before grace expires |
| `PAYMENT_SUCCEEDED` | When retry succeeds |
| `SUBSCRIPTION_RECOVERED` | When subscription returns to active |
| `PAYMENT_FAILED_FINAL` | When all retries exhausted |
| `GRACE_PERIOD_EXPIRED` | When grace period ends |
| `SUBSCRIPTION_CANCELED` | When subscription canceled due to non-payment |

**Business Rules**:
- Configurable retry count and intervals via `paymentRetry` config
- Grace period configurable per plan or globally (default: 7 days)
- Customer can update payment method during grace period
- Updating payment method triggers immediate retry
- Clear notifications to customer at each stage
- Events emitted for each state change
- `subscription.isInGracePeriod()` helper available
- `subscription.daysRemainingInGrace()` helper available

### FR-PAY-003: Process Refund

**Priority**: High

**Description**: Refund a payment fully or partially

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| paymentId | string | Yes | Payment to refund |
| amount | number | No | Amount in cents (full if omitted) |
| reason | string | Yes | Reason for refund |
| idempotencyKey | string | Yes | Prevent duplicate refunds |

### FR-PAY-004: Manage Payment Methods

**Priority**: High

**Description**: Allow customers to add, list, update, and remove payment methods.

#### FR-PAYMETH-001: Add Payment Method

**Priority**: Critical

**Description**: Attach a payment method to a customer

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| providerPaymentMethodId | string | Yes | Payment method ID from provider |
| setAsDefault | boolean | No | Set as default payment method (default: false) |

**Business Rules**:
- Payment method must be validated by provider before attachment
- If no default exists, first payment method becomes default
- Payment method type is detected automatically (card, bank, etc.)

#### FR-PAYMETH-002: List Payment Methods

**Priority**: High

**Description**: List all payment methods for a customer

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| type | string | No | Filter by type (card, bank_account, etc.) |

| Output | Type | Description |
|--------|------|-------------|
| paymentMethods | PaymentMethod[] | List of payment methods |
| default | string | ID of default payment method |

#### FR-PAYMETH-003: Set Default Payment Method

**Priority**: High

**Description**: Set a payment method as the customer's default

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| paymentMethodId | string | Yes | Payment method to set as default |

**Business Rules**:
- Payment method must belong to the customer
- Active subscriptions will use new default for future charges

#### FR-PAYMETH-004: Remove Payment Method

**Priority**: Medium

**Description**: Detach a payment method from a customer

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| paymentMethodId | string | Yes | Payment method to remove |

**Business Rules**:
- Cannot remove if it's the only payment method AND customer has active subscriptions
- Cannot remove default payment method (must set another as default first)
- Removing triggers `PAYMENT_METHOD_REMOVED` event

#### FR-PAYMETH-005: Update Payment Method

**Priority**: Medium

**Description**: Update payment method billing details

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| paymentMethodId | string | Yes | Payment method to update |
| billingDetails | object | No | Updated billing address/name |
| expirationDate | object | No | Updated expiration (cards only, if provider supports) |

#### Payment Method Expiration Handling

```typescript
// Configuration for expiration notifications
const paymentMethodConfig = {
  /** Days before expiration to send first reminder */
  expirationWarningDays: [30, 7, 1],

  /** Whether to auto-update from provider (if supported) */
  autoUpdateFromProvider: true,
};
```

**Events Emitted**:

| Event | When |
|-------|------|
| `PAYMENT_METHOD_ADDED` | New payment method attached |
| `PAYMENT_METHOD_UPDATED` | Payment method details updated |
| `PAYMENT_METHOD_REMOVED` | Payment method detached |
| `PAYMENT_METHOD_EXPIRING` | Warning before expiration |
| `PAYMENT_METHOD_EXPIRED` | Payment method has expired |
| `PAYMENT_METHOD_DEFAULT_CHANGED` | Default payment method changed |

---

## 4. Promo Codes & Discounts

### FR-PROMO-001: Apply Promo Code

**Priority**: High

**Description**: Validate and apply a promo code to checkout

**Business Rules**:
- Validate code exists and is active
- Check usage limits (global and per-customer)
- Check eligibility (plans, dates, customer type)
- Calculate discount amount

### FR-PROMO-002: Automatic Discounts

**Priority**: High

**Description**: Apply discounts automatically based on conditions

**Condition Types**:

| Condition | Description |
|-----------|-------------|
| MIN_PURCHASE_AMOUNT | Minimum cart value |
| MIN_QUANTITY | Minimum items in cart |
| IS_FIRST_PURCHASE | Customer's first order |
| CUSTOMER_SEGMENTS | VIP, wholesale, etc. |
| CATEGORIES | Product categories |
| SCHEDULE | Time-based (happy hour) |

---

## 5. Marketplace Features

### FR-MKT-001: Vendor Onboarding

**Priority**: High

**Description**: Onboard vendors to receive split payments

**Business Rules**:
- Support Stripe Connect and MP Marketplace
- Capture required compliance information
- Enable/disable vendor payments based on status

### FR-MKT-002: Split Payments

**Priority**: High

**Description**: Split payment between platform and vendor(s)

| Input | Type | Description |
|-------|------|-------------|
| vendorId | string | Vendor to pay |
| amount | number | Vendor share in cents |
| platformFee | number | Platform commission |

### FR-MKT-003: Vendor Payouts

**Priority**: High

**Description**: Process payouts to vendors

**Business Rules**:
- Automatic or manual payout scheduling
- Minimum payout thresholds
- Payout reporting for vendors

---

## 6. Notifications

### FR-NOTIF-001: Email Notifications

**Priority**: High

**Description**: Send or suppress email notifications

**Business Rules**:
- Package provides default templates
- Projects can suppress specific events
- `emailSentByPackage` indicates in events whether package sent email
- Support custom email adapters (Resend, SendGrid)

### FR-NOTIF-002: Event Emission

**Priority**: Critical

**Description**: Emit events for all billing operations

**All events include**:
- Event type (using QZPayBillingEvent constants)
- Timestamp
- Relevant entity IDs
- `emailSentByPackage` boolean
- Context data

---

## Requirements Matrix

| ID | Priority | Category | Status |
|----|----------|----------|--------|
| FR-CUST-001 | Critical | Customer | Planned |
| FR-CUST-002 | High | Customer | Planned |
| FR-CUST-003 | Critical | Customer | Planned |
| FR-CUST-004 | High | Customer | Planned |
| FR-CUST-005 | Medium | Customer | Planned |
| FR-SUB-001 | Critical | Subscription | Planned |
| FR-SUB-002 | Critical | Subscription | Planned |
| FR-SUB-003 | Critical | Subscription | Planned |
| FR-SUB-004 | Critical | Subscription | Planned |
| FR-SUB-005 | High | Subscription | Planned |
| FR-PAY-001 | Critical | Payment | Planned |
| FR-PAY-002 | Critical | Payment | Planned |
| FR-PAY-003 | High | Payment | Planned |
| FR-PAY-004 | High | Payment | Planned |
| FR-PAYMETH-001 | Critical | Payment Methods | Planned |
| FR-PAYMETH-002 | High | Payment Methods | Planned |
| FR-PAYMETH-003 | High | Payment Methods | Planned |
| FR-PAYMETH-004 | Medium | Payment Methods | Planned |
| FR-PAYMETH-005 | Medium | Payment Methods | Planned |
| FR-PROMO-001 | High | Discounts | Planned |
| FR-PROMO-002 | High | Discounts | Planned |
| FR-MKT-001 | High | Marketplace | Planned |
| FR-MKT-002 | High | Marketplace | Planned |
| FR-MKT-003 | High | Marketplace | Planned |
| FR-NOTIF-001 | High | Notifications | Planned |
| FR-NOTIF-002 | Critical | Notifications | Planned |
| FR-WEBHOOK-001 | Critical | Webhooks | Planned |
| FR-WEBHOOK-002 | Critical | Webhooks | Planned |
| FR-WEBHOOK-003 | Critical | Webhooks | Planned |
| FR-WEBHOOK-004 | High | Webhooks | Planned |
| FR-WEBHOOK-005 | High | Webhooks | Planned |
| FR-JOBS-001 | Critical | Background Jobs | Planned |
| FR-JOBS-002 | Critical | Background Jobs | Planned |
| FR-JOBS-003 | High | Background Jobs | Planned |
| FR-JOBS-004 | High | Background Jobs | Planned |
| FR-JOBS-005 | Critical | Background Jobs | Planned |
| FR-JOBS-006 | Low | Background Jobs | Planned |
| FR-JOBS-007 | Medium | Background Jobs | Planned |
| FR-USAGE-001 | High | Usage-Based Billing | Planned |
| FR-USAGE-002 | High | Usage-Based Billing | Planned |
| FR-USAGE-003 | Medium | Usage-Based Billing | Planned |
| FR-USAGE-004 | Medium | Usage-Based Billing | Planned |
| FR-USAGE-005 | Medium | Usage-Based Billing | Planned |
| FR-INVOICE-001 | Critical | Invoices | Planned |
| FR-INVOICE-002 | Critical | Invoices | Planned |
| FR-INVOICE-003 | High | Invoices | Planned |
| FR-INVOICE-004 | High | Invoices | Planned |
| FR-INVOICE-005 | High | Invoices | Planned |
| FR-INVOICE-006 | Medium | Invoices | Planned |
| FR-INVOICE-007 | Medium | Invoices | Planned |
| FR-ADMIN-001 | High | Admin | Planned |
| FR-ADMIN-002 | High | Admin | Planned |
| FR-ADMIN-003 | High | Admin | Planned |
| FR-ADMIN-004 | High | Admin | Planned |
| FR-ADMIN-005 | Medium | Admin | Planned |
| FR-ADMIN-006 | Medium | Admin | Planned |
| FR-ADMIN-007 | Medium | Admin | Planned |
| FR-ADMIN-008 | Medium | Admin | Planned |
| FR-ADMIN-009 | Low | Admin | Planned |
| FR-ADMIN-010 | High | Admin | Planned |
| FR-ADDONS-001 | High | Add-ons | Planned |
| FR-ADDONS-002 | High | Add-ons | Planned |
| FR-ADDONS-003 | High | Add-ons | Planned |
| FR-ADDONS-004 | Medium | Add-ons | Planned |
| FR-ADDONS-005 | Medium | Add-ons | Planned |
| FR-ADDONS-006 | Low | Add-ons | Planned |

---

## Related Documents

- [Non-Functional Requirements](./NON-FUNCTIONAL.md)
- [User Stories](./USER-STORIES.md)
- [Testing Requirements](./TESTING-REQUIREMENTS.md)
- [Webhook Processing Requirements](./FR-WEBHOOK.md)
- [Background Jobs Requirements](./FR-JOBS.md)
- [Usage-Based Billing Requirements](./FR-USAGE.md)
- [Invoice Requirements](./FR-INVOICE.md)
- [Admin API Requirements](./FR-ADMIN.md)
- [Add-ons Requirements](./FR-ADDONS.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
- [Adapter Specifications](../05-api/ADAPTER-SPECIFICATIONS.md)
- [Error Catalog](../05-api/ERROR-CATALOG.md)
