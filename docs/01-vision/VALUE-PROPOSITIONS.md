# Value Propositions

## Overview

This document outlines the key value propositions of @qazuor/qzpay and how they address specific market needs.

---

## Core Value Propositions

### 1. Universal Compatibility

**Problem**: Most billing solutions are tied to specific frameworks or databases.

**Solution**: QZPay works with any Node.js framework and database through its adapter pattern.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Application                             │
│         (Any Framework: NestJS, Hono, Express, etc.)            │
└─────────────────────────────────────────────────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     │  @qazuor/qzpay-core │
                     └──────────┬──────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Hono Adapter   │   │  NestJS Module  │   │ Express Adapter │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

### 2. Provider Agnostic

**Problem**: Changing payment providers requires rewriting billing code.

**Solution**: Single API for multiple providers through payment adapters.

| Feature | Stripe | Mercado Pago | Bank Transfer |
|---------|:------:|:------------:|:-------------:|
| One-time Payments | Yes | Yes | Yes |
| Subscriptions | Yes | Yes | Manual |
| Marketplace | Yes | Yes | - |
| Webhooks | Yes | Yes | - |

```typescript
// Same code works with any provider
const billing = createQZPayBilling({
  paymentAdapter: createQZPayStripeAdapter({ ... })
  // OR
  // paymentAdapter: createQZPayMercadoPagoAdapter({ ... })
});
```

---

### 3. Highly Configurable

**Problem**: Billing solutions are too rigid for different use cases.

**Solution**: Every aspect can be customized per project.

#### Configuration Levels

1. **Global Defaults** - Package provides sensible defaults
2. **Project Configuration** - Override defaults at initialization
3. **Per-Operation** - Override for specific operations

```typescript
const billing = createQZPayBilling({
  // Global configuration
  notifications: {
    suppress: [QZPayBillingEvent.TRIAL_EXPIRING]
  },

  // Subscription defaults
  subscriptions: {
    gracePeriodDays: 3,
    retryCount: 4
  }
});

// Per-operation override
await billing.subscriptions.create({
  customerId: 'cus_123',
  planId: 'pro',
  gracePeriodDays: 7  // Override for this subscription
});
```

---

### 4. Production Ready

**Problem**: Custom billing code lacks handling for edge cases.

**Solution**: Built-in handling for all common scenarios.

| Scenario | Handling |
|----------|----------|
| Failed Payments | Configurable retry logic with backoff |
| Grace Periods | Automatic access during grace period |
| Trials | With or without payment method |
| Upgrades | Prorated billing calculation |
| Downgrades | Apply at period end |
| Cancellations | Immediate or end-of-period |
| Disputes | Event-driven notifications |
| Refunds | Full and partial support |

---

### 5. Developer Experience

**Problem**: Billing APIs are complex and poorly documented.

**Solution**: TypeScript-first with excellent DX.

#### No Magic Strings

```typescript
// Error-prone
if (subscription.status === 'active') { ... }

// Type-safe with autocomplete
if (subscription.status === QZPaySubscriptionStatus.ACTIVE) { ... }
```

#### Rich Subscription Objects

```typescript
// Instead of manual calculations
const hasAccess = subscription.hasAccess();
const daysLeft = subscription.daysUntilRenewal();
const entitlements = subscription.getEntitlements<MyEntitlements>();
```

#### CLI Tools

```bash
# Generate environment file with required variables
npx @qazuor/qzpay-cli env:generate --adapters stripe,mercadopago

# Validate environment
npx @qazuor/qzpay-cli env:check
```

---

### 6. Clear Email Responsibility

**Problem**: Duplicate or missing notifications when package and app both send emails.

**Solution**: Suppress system + `emailSentByPackage` indicator.

```typescript
const billing = createQZPayBilling({
  notifications: {
    // These events won't trigger package emails
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
    ],
  },
});

// Event handler knows if package sent email
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  if (!event.emailSentByPackage) {
    // Project handles the email
    await sendCustomEmail(event.customer, event.daysLeft);
  }
});
```

---

## Competitive Comparison

| Feature | QZPay | Stripe Billing | Custom Code |
|---------|:-----:|:--------------:|:-----------:|
| Multiple Providers | Yes | No | Manual |
| Framework Agnostic | Yes | Yes | Yes |
| Type Safety | Full | Partial | Manual |
| UI Components | Yes | Limited | Manual |
| Marketplace Support | Yes | Yes | Manual |
| Trial without Card | Yes | Yes | Manual |
| Entitlements/Limits | Built-in | External | Manual |
| Email Control | Full | Limited | Full |

---

## ROI Analysis

### Development Time Savings

| Task | Custom Implementation | With QZPay |
|------|----------------------:|----------:|
| Basic Payments | 20 hours | 2 hours |
| Subscriptions | 40 hours | 4 hours |
| Webhooks | 16 hours | 1 hour |
| UI Components | 60 hours | 8 hours |
| Marketplace | 80 hours | 12 hours |
| **Total** | **216 hours** | **27 hours** |

**Savings: ~189 hours per project**

### Maintenance Reduction

- No need to track provider API changes
- Security updates handled by package
- Bug fixes shared across community
- Documentation always current

---

## Related Documents

- [Project Overview](./OVERVIEW.md)
- [User Personas](./PERSONAS.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
