# User Personas

## Overview

This document defines the key user personas for @qazuor/qzpay. Understanding these personas helps drive design decisions and prioritize features.

---

## 2.1 Developer (Primary User)

**Name**: Carlos, Full-Stack Developer

### Background

- Builds 2-3 SaaS products simultaneously
- Uses different tech stacks per project (NestJS, Hono, etc.)
- Limited time for billing infrastructure
- Needs reliable, tested solutions

### Goals

| Priority | Goal |
|----------|------|
| 1 | Integrate billing in under 30 minutes |
| 2 | Not worry about payment edge cases |
| 3 | Reuse billing logic across projects |
| 4 | Have full control when needed |
| 5 | Never use magic strings in comparisons |

### Pain Points

- Every project needs billing code rewritten
- Stripe code doesn't work with Mercado Pago
- Testing payment flows is tedious
- Handling subscription edge cases is complex
- Comparing statuses with string literals is error-prone

### How QZPay Helps

```typescript
// Before: Error-prone magic strings
if (subscription.status === 'active') { ... }

// After: Type-safe constants
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) { ... }
```

---

## 2.2 End Customer

**Name**: Maria, SaaS User

### Background

- Subscribes to multiple online services
- Expects smooth payment experiences
- Uses various payment methods

### Goals

| Priority | Goal |
|----------|------|
| 1 | Easy checkout process |
| 2 | Clear pricing information |
| 3 | Manage subscription easily |
| 4 | Apply discount codes |
| 5 | Start trials without entering credit card |

### Pain Points

- Confusing checkout flows
- Hard to cancel subscriptions
- Unclear billing dates
- Missing payment notifications
- Forced to enter card for trials

### How QZPay Helps

- Supports trials without payment method required
- Clear subscription management UI components
- Consistent notification system
- Easy promo code application

---

## 2.3 Platform Vendor (Marketplace)

**Name**: Ana, Jewelry Store Owner on GEMFolio

### Background

- Sells products on a marketplace platform
- Needs to receive payments for sales
- Wants to track earnings

### Goals

| Priority | Goal |
|----------|------|
| 1 | Easy payment account setup |
| 2 | See sales and commissions clearly |
| 3 | Reliable payouts |
| 4 | Dispute resolution support |

### Pain Points

- Complex onboarding processes
- Unclear commission structures
- Delayed payouts
- No visibility into disputes

### How QZPay Helps

- Streamlined vendor onboarding (Stripe Connect, MP Marketplace)
- Clear commission configuration
- Automated split payments
- Vendor dashboard components

---

## 2.4 Platform Administrator

**Name**: Luis, Platform Owner

### Background

- Manages a multi-vendor marketplace or SaaS platform
- Needs oversight of all billing operations
- Requires reporting and analytics

### Goals

| Priority | Goal |
|----------|------|
| 1 | Monitor platform revenue |
| 2 | Manage vendor commissions |
| 3 | Handle disputes and refunds |
| 4 | Access detailed analytics |

### Pain Points

- Lack of unified billing dashboard
- Manual commission calculations
- Difficult to track metrics
- Complex refund processes

### How QZPay Helps

- Centralized metrics API
- Configurable commission structures
- Admin UI components
- Automated promo code analytics

---

## Persona Priority Matrix

| Feature Area | Carlos (Dev) | Maria (Customer) | Ana (Vendor) | Luis (Admin) |
|--------------|:------------:|:----------------:|:------------:|:------------:|
| Quick Integration | **HIGH** | - | - | - |
| Type Safety | **HIGH** | - | - | - |
| Checkout UX | Medium | **HIGH** | - | - |
| Subscription Management | Medium | **HIGH** | - | Medium |
| Vendor Onboarding | Low | - | **HIGH** | Medium |
| Split Payments | Medium | - | **HIGH** | **HIGH** |
| Analytics | Low | - | Medium | **HIGH** |
| Promo Codes | Medium | **HIGH** | Low | **HIGH** |

---

## Related Documents

- [Project Overview](./OVERVIEW.md)
- [Value Propositions](./VALUE-PROPOSITIONS.md)
- [User Stories](../02-requirements/USER-STORIES.md)
