# Implementation Plan

## Overview

This document outlines the complete implementation plan for @qazuor/qzpay, broken down into phases with atomic, granular tasks following Test-Driven Development (TDD) approach.

---

## Phase Summary

| Phase | Name | Description | Tasks |
|-------|------|-------------|-------|
| 1 | Core Foundation | Project setup, core types, storage interface | 70 |
| 2 | Storage Layer | Drizzle adapter, migrations, repositories | 60 |
| **3** | **Business Logic** | **Divided into sub-phases for better manageability** | **299** |
| 3A | Core Services | Customer, Plan, Subscription Helpers, Subscription | ~45 |
| 3B | Payment & Invoice | Payment Service, Invoice Service | ~35 |
| 3C | Discounts & Promo Codes | Promo Code, Automatic Discounts, Discount Stacking | ~55 |
| 3D | Checkout & Marketplace | Checkout, Bank Transfer, Marketplace, Metrics | ~40 |
| 3E | Notifications & Jobs | Notification, Usage, Background Jobs, Webhook | ~35 |
| 3F | Security & Resilience | Security Services, Resilience Services | ~40 |
| 3G | Advanced Features (P2) | Advanced Subscriptions, Analytics, I18n, Edge Cases | ~49 |
| 4 | Payment Providers | Stripe and MercadoPago adapters with TDD | 80 |
| 5 | Framework Integration | Hono middleware, webhooks | 35 |
| 6 | React Components | UI components and hooks | 60 |
| 7 | CLI Tools | Environment validation and generation | 20 |
| 8 | Documentation & Examples | Docs site and examples | 30 |

**Total Estimated Tasks: ~654**

### Phase 3 Sub-Phase Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 3 SUB-PHASES                                 │
│                                                                              │
│   ┌──────────┐                                                               │
│   │   3A     │ Core Services (Customer, Plan, Subscription)                  │
│   │ ~45 tasks│                                                               │
│   └────┬─────┘                                                               │
│        │                                                                     │
│   ┌────▼─────┐     ┌──────────┐                                             │
│   │   3B     │────►│   3C     │ Discounts & Promo Codes                     │
│   │ ~35 tasks│     │ ~55 tasks│                                             │
│   │ Payment  │     └────┬─────┘                                             │
│   └────┬─────┘          │                                                   │
│        │                │                                                   │
│   ┌────▼────────────────▼──┐                                                │
│   │         3D             │ Checkout & Marketplace                         │
│   │       ~40 tasks        │                                                │
│   └────────────┬───────────┘                                                │
│                │                                                            │
│   ┌────────────▼───────────┐                                                │
│   │         3E             │ Notifications & Jobs                           │
│   │       ~35 tasks        │                                                │
│   └────────────┬───────────┘                                                │
│                │                                                            │
│   ┌────────────▼───────────┐     ┌──────────────────────┐                   │
│   │         3F             │────►│         3G           │                   │
│   │       ~40 tasks        │     │      ~49 tasks       │                   │
│   │ Security & Resilience  │     │ Advanced Features P2 │                   │
│   └────────────────────────┘     └──────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Recommended Execution Order:**
1. **3A → 3B → 3C** can be parallelized after 3A completes
2. **3D** requires 3B and 3C
3. **3E** requires 3D
4. **3F** requires 3E
5. **3G** (P2 features) can start after 3F, independent of Phase 4

---

## Phase 1: Core Foundation

### 1.1 Monorepo Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.1.1 | Initialize pnpm workspace | Create pnpm-workspace.yaml with packages/* | - |
| 1.1.2 | Setup Turborepo | Create turbo.json with build/test/lint pipelines | 1.1.1 |
| 1.1.3 | Create root package.json | Add workspace scripts, devDependencies | 1.1.1 |
| 1.1.4 | Setup TypeScript config | Create tsconfig.base.json with strict settings | 1.1.1 |
| 1.1.5 | Setup Biome config | Create biome.json for linting/formatting | 1.1.1 |
| 1.1.6 | Setup Changesets | Initialize @changesets/cli for versioning | 1.1.1 |
| 1.1.7 | Create .gitignore | Add node_modules, dist, .env patterns | 1.1.1 |
| 1.1.8 | Setup Husky hooks | Add pre-commit with lint-staged | 1.1.5 |
| 1.1.9 | Create GitHub Actions | CI workflow for build/test/lint | 1.1.2 |
| 1.1.10 | Create release workflow | GitHub Action for npm publish | 1.1.6 |

### 1.2 Core Package Structure

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.2.1 | Create packages/core directory | Initialize package structure | 1.1.1 |
| 1.2.2 | Create core package.json | Name, version, exports, dependencies | 1.2.1 |
| 1.2.3 | Create core tsconfig.json | Extend from base, set paths | 1.1.4, 1.2.1 |
| 1.2.4 | Setup tsup for bundling | Create tsup.config.ts | 1.2.2 |
| 1.2.5 | Create src/index.ts | Main entry point with exports | 1.2.1 |
| 1.2.6 | Create directory structure | services/, types/, utils/, adapters/, constants/ | 1.2.1 |
| 1.2.7 | Setup Vitest for testing | Create vitest.config.ts | 1.2.2 |
| 1.2.8 | Create tests directory | tests/unit/, tests/integration/, tests/mocks/ | 1.2.7 |

### 1.3 Exported Constants (QZPay prefix)

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.3.1 | Create constants/subscription-status.ts | QZPaySubscriptionStatus constant object | 1.2.6 |
| 1.3.2 | Create constants/payment-status.ts | QZPayPaymentStatus constant object | 1.2.6 |
| 1.3.3 | Create constants/invoice-status.ts | QZPayInvoiceStatus constant object | 1.2.6 |
| 1.3.4 | Create constants/billing-interval.ts | QZPayBillingInterval constant object | 1.2.6 |
| 1.3.5 | Create constants/discount-type.ts | QZPayDiscountTypeBase, QZPayPromoCodeType, QZPayAutomaticDiscountType, QZPayDiscountType (hierarchical structure) | 1.2.6 |
| 1.3.6 | Create constants/discount-stacking-mode.ts | QZPayDiscountStackingMode constant object | 1.2.6 |
| 1.3.7 | Create constants/discount-condition.ts | QZPayDiscountCondition constant object | 1.2.6 |
| 1.3.8 | Create constants/day-of-week.ts | QZPayDayOfWeek constant object | 1.2.6 |
| 1.3.9 | Create constants/checkout-mode.ts | QZPayCheckoutMode constant object | 1.2.6 |
| 1.3.10 | Create constants/payment-provider.ts | QZPayPaymentProvider constant object | 1.2.6 |
| 1.3.11 | Create constants/vendor-status.ts | QZPayVendorOnboardingStatus, QZPayVendorPaymentMode | 1.2.6 |
| 1.3.12 | Create constants/currency.ts | QZPayCurrency constant object | 1.2.6 |
| 1.3.13 | Create constants/proration-behavior.ts | QZPayProrationBehavior (immediately, next_period, none) | 1.2.6 |
| 1.3.14 | Create constants/cancel-at.ts | QZPayCancelAt (immediately, period_end) | 1.2.6 |
| 1.3.15 | Create constants/billing-event.ts | QZPayBillingEvent constant object with all events | 1.2.6 |
| 1.3.16 | Create constants/index.ts | Re-export all constants with QZPay prefix | 1.3.1-1.3.15 |
| 1.3.17 | Create TypeScript types from constants | Derive types using typeof | 1.3.16 |

### 1.4 Core Types Definition

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.4.1 | Create types/customer.types.ts | QZPayCustomer, QZPayCreateCustomer, QZPayUpdateCustomer | 1.2.6 |
| 1.4.2 | Create types/subscription.types.ts | QZPaySubscription, QZPaySubscriptionWithHelpers | 1.2.6, 1.3.12 |
| 1.4.3 | Create types/payment.types.ts | QZPayPayment, status, provider using constants | 1.2.6, 1.3.12 |
| 1.4.4 | Create types/invoice.types.ts | QZPayInvoice, line items, status | 1.2.6, 1.3.12 |
| 1.4.5 | Create types/promo-code.types.ts | QZPayPromoCode, types, restrictions | 1.2.6, 1.3.12 |
| 1.4.6 | Create types/vendor.types.ts | QZPayVendor, payout, onboarding status | 1.2.6, 1.3.12 |
| 1.4.7 | Create types/checkout.types.ts | QZPayCheckoutSession, items, modes | 1.2.6, 1.3.12 |
| 1.4.8 | Create types/plan.types.ts | QZPayPlan, QZPayPlanConfig with entitlements/limits | 1.2.6 |
| 1.4.9 | Create types/entitlements.types.ts | QZPayEntitlements base interface | 1.2.6 |
| 1.4.10 | Create types/limits.types.ts | QZPayLimits base interface (-1 = unlimited) | 1.2.6 |
| 1.4.11 | Create types/config.types.ts | QZPayBillingConfig with notifications.suppress | 1.2.6 |
| 1.4.12 | Create types/events.types.ts | QZPayEvent payloads with emailSentByPackage | 1.2.6, 1.3.10 |
| 1.4.13 | Create types/metrics.types.ts | QZPayMetric response types | 1.2.6 |
| 1.4.14 | Create types/index.ts | Re-export all types | 1.4.1-1.4.13 |

### 1.5 Adapter Interfaces

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.5.1 | Create adapters/payment.adapter.ts | QZPayPaymentAdapter interface | 1.4.3 |
| 1.5.2 | Create adapters/storage.adapter.ts | QZPayStorageAdapter interface | 1.4.1-1.4.6 |
| 1.5.3 | Create adapters/email.adapter.ts | QZPayEmailAdapter interface | 1.4.12 |
| 1.5.4 | Create adapters/index.ts | Re-export all adapters | 1.5.1-1.5.3 |

#### 1.5.5 Adapter Interface Contracts

**CRITICAL**: All adapter implementations MUST adhere to these contracts. These define the expected behavior, error handling, and invariants for each adapter type.

##### QZPayPaymentAdapter Contract

```typescript
/**
 * Payment Provider Adapter Contract
 *
 * INVARIANTS:
 * 1. All methods MUST be idempotent when called with the same idempotencyKey
 * 2. All methods MUST throw QZPayProviderError subclasses, never raw provider errors
 * 3. All methods MUST handle network timeouts (default: 30s)
 * 4. All methods MUST log operations for audit trail
 */
export interface QZPayPaymentAdapter {
  readonly providerId: 'stripe' | 'mercadopago';

  /**
   * Create a payment intent for one-time or first subscription payment.
   *
   * ERROR CONTRACT:
   * - QZPayProviderNetworkError: Network/timeout issues (retryable)
   * - QZPayProviderRateLimitError: Rate limited (retryable with backoff)
   * - QZPayProviderValidationError: Invalid params (not retryable)
   * - QZPayProviderAuthError: Invalid credentials (not retryable, alert)
   *
   * IDEMPOTENCY: If idempotencyKey provided and matches previous call,
   * MUST return same response without creating new intent.
   */
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;

  /**
   * Create a subscription in the payment provider.
   *
   * ERROR CONTRACT:
   * - QZPayProviderCustomerNotFoundError: Customer doesn't exist in provider
   * - QZPayProviderPriceNotFoundError: Price/plan doesn't exist
   * - QZPayPaymentMethodRequiredError: No payment method attached
   * - QZPayPaymentDeclinedError: Payment failed (includes decline code)
   */
  createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription>;

  /**
   * Cancel a subscription in the payment provider.
   *
   * MUST handle already-canceled subscriptions gracefully (no error).
   */
  cancelSubscription(
    subscriptionId: string,
    params?: CancelSubscriptionParams
  ): Promise<ProviderSubscription>;

  /**
   * Process a refund.
   *
   * ERROR CONTRACT:
   * - QZPayRefundExceedsAmountError: Refund amount > original payment
   * - QZPayAlreadyRefundedError: Payment already fully refunded
   * - QZPayProviderRefundError: Provider rejected refund
   */
  refund(params: RefundParams): Promise<ProviderRefund>;

  /**
   * Verify webhook signature.
   *
   * MUST use timing-safe comparison.
   * MUST validate timestamp within 5-minute window.
   */
  verifyWebhook(payload: string, signature: string): WebhookEvent | null;
}
```

##### QZPayStorageAdapter Contract

```typescript
/**
 * Storage Adapter Contract
 *
 * INVARIANTS:
 * 1. All write operations MUST be atomic
 * 2. All collections MUST filter deleted_at IS NULL by default
 * 3. Transactions MUST support configurable isolation levels
 * 4. All operations MUST use parameterized queries (no SQL injection)
 */
export interface QZPayStorageAdapter {
  /**
   * Execute operations in a transaction.
   *
   * ISOLATION LEVELS (see ARCHITECTURE.md Section 2.1):
   * - SERIALIZABLE: For financial operations, plan changes
   * - REPEATABLE_READ: For promo code redemption
   * - READ_COMMITTED: Default for most operations
   *
   * ERROR CONTRACT:
   * - QZPayTransactionRetryExhaustedError: Max retries for serialization failure
   * - QZPayTransactionTimeoutError: Transaction exceeded timeout
   * - QZPayDeadlockError: Deadlock detected (retryable)
   */
  transaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;

  // Collections (all collections implement same base contract)
  customers: QZPayCollection<Customer, CreateCustomer, UpdateCustomer>;
  subscriptions: QZPayCollection<Subscription, CreateSubscription, UpdateSubscription>;
  payments: QZPayCollection<Payment, CreatePayment, UpdatePayment>;
  invoices: QZPayCollection<Invoice, CreateInvoice, UpdateInvoice>;
  // ... other collections
}

/**
 * Collection Contract - All storage collections implement this
 */
export interface QZPayCollection<T, TCreate, TUpdate> {
  /**
   * Find by ID. Returns null if not found or soft-deleted.
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find by ID including soft-deleted. For admin/audit.
   */
  findByIdIncludingDeleted(id: string): Promise<T | null>;

  /**
   * Create new entity. MUST generate ID if not provided.
   *
   * ERROR CONTRACT:
   * - QZPayDuplicateError: Unique constraint violation
   * - QZPayForeignKeyError: Referenced entity doesn't exist
   */
  create(data: TCreate): Promise<T>;

  /**
   * Update existing entity.
   *
   * ERROR CONTRACT:
   * - QZPayNotFoundError: Entity doesn't exist
   * - QZPayOptimisticLockError: Version mismatch (if using optimistic locking)
   */
  update(id: string, data: TUpdate): Promise<T>;

  /**
   * Soft delete. Sets deleted_at, does NOT remove.
   */
  softDelete(id: string): Promise<void>;

  /**
   * Restore soft-deleted entity.
   */
  restore(id: string): Promise<void>;
}
```

##### QZPayEmailAdapter Contract

```typescript
/**
 * Email Adapter Contract
 *
 * INVARIANTS:
 * 1. MUST NOT throw on send failure (log and continue)
 * 2. MUST support template variables substitution
 * 3. MUST respect rate limits (queue if needed)
 */
export interface QZPayEmailAdapter {
  /**
   * Send an email.
   *
   * MUST NOT throw on failure - log error and return false.
   * Caller is responsible for retry logic if needed.
   */
  send(params: SendEmailParams): Promise<{ sent: boolean; error?: string }>;

  /**
   * Check if adapter supports a template.
   * Used for fallback to default templates.
   */
  hasTemplate(templateId: string): Promise<boolean>;
}
```

##### Error Hierarchy for Adapters

```typescript
// Base error for all adapter errors
abstract class QZPayAdapterError extends Error {
  abstract readonly retryable: boolean;
  abstract readonly adapter: 'payment' | 'storage' | 'email';
}

// Payment adapter errors
class QZPayProviderNetworkError extends QZPayAdapterError {
  readonly retryable = true;
  readonly adapter = 'payment';
}

class QZPayProviderRateLimitError extends QZPayAdapterError {
  readonly retryable = true;
  readonly adapter = 'payment';
  constructor(message: string, readonly retryAfterMs: number) { super(message); }
}

class QZPayPaymentDeclinedError extends QZPayAdapterError {
  readonly retryable = false;
  readonly adapter = 'payment';
  constructor(message: string, readonly declineCode: string) { super(message); }
}

// Storage adapter errors
class QZPayTransactionRetryExhaustedError extends QZPayAdapterError {
  readonly retryable = false;
  readonly adapter = 'storage';
}

class QZPayOptimisticLockError extends QZPayAdapterError {
  readonly retryable = true; // Caller can retry with fresh data
  readonly adapter = 'storage';
}
```

##### Validation Checklist

- [ ] All payment adapter methods throw typed errors (never raw provider errors)
- [ ] All storage collection methods filter soft-deleted by default
- [ ] Transaction isolation levels are configurable
- [ ] Email adapter never throws on send failure
- [ ] All errors include `retryable` flag
- [ ] All adapters log operations for audit

### 1.6 Utilities

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.6.1 | Write utility error tests | Test custom error classes | 1.2.7 |
| 1.6.2 | Create utils/errors.ts | Custom error classes | 1.6.1 |
| 1.6.3 | Write validation utility tests | Test input validation helpers | 1.2.7 |
| 1.6.4 | Create utils/validation.ts | Input validation helpers | 1.6.3 |
| 1.6.5 | Write date utility tests | Test date calculation utilities | 1.2.7 |
| 1.6.6 | Create utils/date.ts | Date calculation utilities | 1.6.5 |
| 1.6.7 | Write currency utility tests | Test currency formatting, conversion | 1.2.7 |
| 1.6.8 | Create utils/currency.ts | Currency formatting, conversion | 1.6.7 |
| 1.6.9 | Write ID utility tests | Test ID generation (nanoid/uuid) | 1.2.7 |
| 1.6.10 | Create utils/id.ts | ID generation (nanoid/uuid) | 1.6.9 |
| 1.6.11 | Write env utility tests | Test environment variable validation | 1.2.7 |
| 1.6.12 | Create utils/env.ts | Environment variable validation | 1.6.11 |
| 1.6.13 | Create utils/index.ts | Re-export utilities | 1.6.2-1.6.12 |

### 1.7 Event System

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.7.1 | Write event emitter tests | Unit tests for emitter | 1.2.7, 1.4.12, 1.3.10 |
| 1.7.2 | Create events/event-emitter.ts | Typed event emitter using QZPayBillingEvent | 1.4.12, 1.3.10, 1.7.1 |
| 1.7.3 | Add emailSentByPackage tracking | Track email sending per event | 1.7.2 |

### 1.8 QZPayBilling Factory and Core

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.8.1 | Write QZPayBilling factory tests | Factory, config validation tests | 1.2.7 |
| 1.8.2 | Create billing.ts | createQZPayBilling() factory function | 1.5.4, 1.7.2, 1.8.1 |
| 1.8.3 | Implement config parsing | Config validation, adapter setup | 1.8.2 |
| 1.8.4 | Implement environment validation | Validate required env vars on init + warning for unused | 1.8.3, 1.6.12 |
| 1.8.5 | Create createQZPayBillingFromEnv() | Auto-detect adapters from environment | 1.8.4 |
| 1.8.6 | Add service getters | Lazy service initialization | 1.8.5 |
| 1.8.7 | Add event methods | on(), off(), emit() delegation | 1.8.6, 1.7.2 |
| 1.8.8 | Add suppress array handling | Check suppress before emitting emails | 1.8.7 |

### 1.9 Testing Infrastructure

> **CRITICAL**: All test infrastructure MUST be implemented before writing feature tests. This ensures consistency across the entire test suite.

#### 1.9.1 Mock Payment Providers

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.9.1.1 | Create MockPaymentProvider base class | Abstract base with common mock behavior | 1.5.1 |
| 1.9.1.2 | Create MockStripeProvider | Stripe-specific mock with configurable responses | 1.9.1.1 |
| 1.9.1.3 | Create MockMercadoPagoProvider | MercadoPago-specific mock | 1.9.1.1 |
| 1.9.1.4 | Create provider error simulators | Simulate network errors, rate limits, etc. | 1.9.1.2, 1.9.1.3 |

**MockPaymentProvider Base Class:**

```typescript
// packages/core/src/testing/mocks/MockPaymentProvider.ts

export interface MockProviderConfig {
  /** Default delay in ms to simulate network latency (0 = instant) */
  latencyMs?: number;
  /** If true, all calls will fail with network error */
  simulateNetworkError?: boolean;
  /** If true, all calls will fail with rate limit error */
  simulateRateLimitError?: boolean;
  /** Custom error to throw on next call (one-time) */
  nextCallError?: Error | null;
}

export abstract class MockPaymentProvider {
  protected config: MockProviderConfig;
  protected callHistory: Array<{ method: string; args: unknown[]; timestamp: Date }> = [];

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      latencyMs: 0,
      simulateNetworkError: false,
      simulateRateLimitError: false,
      nextCallError: null,
      ...config
    };
  }

  /** Get all recorded calls for assertions */
  getCallHistory(): typeof this.callHistory {
    return [...this.callHistory];
  }

  /** Get calls filtered by method name */
  getCallsFor(method: string): typeof this.callHistory {
    return this.callHistory.filter(c => c.method === method);
  }

  /** Clear call history */
  clearHistory(): void {
    this.callHistory = [];
  }

  /** Set error for next call only (auto-clears after use) */
  setNextCallError(error: Error): void {
    this.config.nextCallError = error;
  }

  /** Simulate latency and check for configured errors */
  protected async simulateCall(method: string, args: unknown[]): Promise<void> {
    this.callHistory.push({ method, args, timestamp: new Date() });

    if (this.config.latencyMs && this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
    }

    if (this.config.nextCallError) {
      const error = this.config.nextCallError;
      this.config.nextCallError = null;
      throw error;
    }

    if (this.config.simulateNetworkError) {
      throw new ProviderNetworkError('Network error (simulated)');
    }

    if (this.config.simulateRateLimitError) {
      throw new ProviderRateLimitError('Rate limit exceeded (simulated)', { retryAfterMs: 1000 });
    }
  }
}
```

**MockStripeProvider Implementation:**

```typescript
// packages/core/src/testing/mocks/MockStripeProvider.ts

import { MockPaymentProvider, MockProviderConfig } from './MockPaymentProvider';
import type { PaymentProviderAdapter, CreatePaymentIntent, PaymentIntent } from '../../adapters';

export interface MockStripeConfig extends MockProviderConfig {
  /** Default card decline behavior */
  declineCards?: string[]; // e.g., ['4000000000000002'] - Stripe test decline card
  /** Webhook signing secret for test webhooks */
  webhookSecret?: string;
}

export interface MockPaymentIntentOptions {
  id?: string;
  status?: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export class MockStripeProvider extends MockPaymentProvider implements PaymentProviderAdapter {
  readonly providerId = 'stripe' as const;
  private mockPaymentIntents: Map<string, PaymentIntent> = new Map();
  private mockCustomers: Map<string, StripeCustomer> = new Map();
  private mockPaymentMethods: Map<string, StripePaymentMethod> = new Map();
  private declineCards: Set<string>;

  constructor(config: MockStripeConfig = {}) {
    super(config);
    this.declineCards = new Set(config.declineCards ?? ['4000000000000002']);
  }

  /** Pre-configure a payment intent to be "found" */
  seedPaymentIntent(intent: PaymentIntent): void {
    this.mockPaymentIntents.set(intent.id, intent);
  }

  /** Pre-configure a customer to be "found" */
  seedCustomer(customer: StripeCustomer): void {
    this.mockCustomers.set(customer.id, customer);
  }

  /** Create a mock payment intent with configurable properties */
  createMockPaymentIntent(options: MockPaymentIntentOptions = {}): PaymentIntent {
    return {
      id: options.id ?? `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: options.status ?? 'requires_payment_method',
      amount: options.amount ?? 1000,
      currency: options.currency ?? 'usd',
      metadata: options.metadata ?? {},
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };
  }

  async createPaymentIntent(params: CreatePaymentIntent): Promise<PaymentIntent> {
    await this.simulateCall('createPaymentIntent', [params]);

    const intent = this.createMockPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata
    });

    this.mockPaymentIntents.set(intent.id, intent);
    return intent;
  }

  async confirmPaymentIntent(id: string, paymentMethodId: string): Promise<PaymentIntent> {
    await this.simulateCall('confirmPaymentIntent', [id, paymentMethodId]);

    const intent = this.mockPaymentIntents.get(id);
    if (!intent) {
      throw new ProviderResourceNotFoundError(`PaymentIntent ${id} not found`);
    }

    // Simulate card decline
    const paymentMethod = this.mockPaymentMethods.get(paymentMethodId);
    if (paymentMethod && this.declineCards.has(paymentMethod.card?.last4 ?? '')) {
      throw new PaymentDeclinedError('Card declined (simulated)', { declineCode: 'card_declined' });
    }

    intent.status = 'succeeded';
    return intent;
  }

  async createCustomer(params: CreateCustomerParams): Promise<StripeCustomer> {
    await this.simulateCall('createCustomer', [params]);

    const customer: StripeCustomer = {
      id: `cus_mock_${Date.now()}`,
      email: params.email,
      name: params.name,
      metadata: params.metadata ?? {},
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };

    this.mockCustomers.set(customer.id, customer);
    return customer;
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<StripeSubscription> {
    await this.simulateCall('createSubscription', [params]);

    return {
      id: `sub_mock_${Date.now()}`,
      customer: params.customerId,
      status: 'active',
      items: { data: [{ price: { id: params.priceId } }] },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      livemode: false
    };
  }

  async cancelSubscription(id: string, params?: CancelSubscriptionParams): Promise<StripeSubscription> {
    await this.simulateCall('cancelSubscription', [id, params]);

    return {
      id,
      status: params?.cancelAtPeriodEnd ? 'active' : 'canceled',
      cancel_at_period_end: params?.cancelAtPeriodEnd ?? false,
      canceled_at: Math.floor(Date.now() / 1000),
      livemode: false
    };
  }

  /** Verify webhook signature (always passes in mock, unless configured otherwise) */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    this.callHistory.push({ method: 'verifyWebhookSignature', args: [payload, signature], timestamp: new Date() });
    return true; // Mock always passes unless simulateNetworkError is set
  }

  /** Generate a mock webhook event for testing webhook handlers */
  createMockWebhookEvent(type: string, data: unknown): StripeWebhookEvent {
    return {
      id: `evt_mock_${Date.now()}`,
      type,
      data: { object: data },
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };
  }
}
```

**MockMercadoPagoProvider Implementation:**

```typescript
// packages/core/src/testing/mocks/MockMercadoPagoProvider.ts

import { MockPaymentProvider, MockProviderConfig } from './MockPaymentProvider';

export interface MockMercadoPagoConfig extends MockProviderConfig {
  /** Cards that will be rejected */
  rejectCards?: string[];
  /** Simulate pending payments (common in MercadoPago) */
  simulatePendingPayments?: boolean;
}

export class MockMercadoPagoProvider extends MockPaymentProvider implements PaymentProviderAdapter {
  readonly providerId = 'mercadopago' as const;
  private mockPreferences: Map<string, MPPreference> = new Map();
  private mockPayments: Map<string, MPPayment> = new Map();
  private simulatePending: boolean;

  constructor(config: MockMercadoPagoConfig = {}) {
    super(config);
    this.simulatePending = config.simulatePendingPayments ?? false;
  }

  async createPreference(params: CreatePreferenceParams): Promise<MPPreference> {
    await this.simulateCall('createPreference', [params]);

    const preference: MPPreference = {
      id: `pref_mock_${Date.now()}`,
      init_point: `https://mock.mercadopago.com/checkout?pref_id=pref_mock_${Date.now()}`,
      sandbox_init_point: `https://sandbox.mercadopago.com/checkout?pref_id=pref_mock_${Date.now()}`,
      items: params.items,
      payer: params.payer,
      external_reference: params.externalReference,
      notification_url: params.notificationUrl
    };

    this.mockPreferences.set(preference.id, preference);
    return preference;
  }

  async getPayment(paymentId: string): Promise<MPPayment> {
    await this.simulateCall('getPayment', [paymentId]);

    const payment = this.mockPayments.get(paymentId);
    if (!payment) {
      throw new ProviderResourceNotFoundError(`Payment ${paymentId} not found`);
    }
    return payment;
  }

  async createPayment(params: CreateMPPaymentParams): Promise<MPPayment> {
    await this.simulateCall('createPayment', [params]);

    const payment: MPPayment = {
      id: Date.now(),
      status: this.simulatePending ? 'pending' : 'approved',
      status_detail: this.simulatePending ? 'pending_waiting_payment' : 'accredited',
      transaction_amount: params.transactionAmount,
      currency_id: params.currencyId ?? 'ARS',
      external_reference: params.externalReference,
      payment_method_id: params.paymentMethodId,
      date_created: new Date().toISOString(),
      date_approved: this.simulatePending ? null : new Date().toISOString()
    };

    this.mockPayments.set(String(payment.id), payment);
    return payment;
  }

  async refundPayment(paymentId: string, amount?: number): Promise<MPRefund> {
    await this.simulateCall('refundPayment', [paymentId, amount]);

    const payment = this.mockPayments.get(paymentId);
    if (!payment) {
      throw new ProviderResourceNotFoundError(`Payment ${paymentId} not found`);
    }

    return {
      id: Date.now(),
      payment_id: Number(paymentId),
      amount: amount ?? payment.transaction_amount,
      status: 'approved',
      date_created: new Date().toISOString()
    };
  }

  /** Seed a payment for testing getPayment */
  seedPayment(payment: MPPayment): void {
    this.mockPayments.set(String(payment.id), payment);
  }

  /** Create mock IPN notification for testing webhook handlers */
  createMockIPNNotification(type: 'payment' | 'merchant_order', dataId: string): MPIPNNotification {
    return {
      id: Date.now(),
      live_mode: false,
      type,
      date_created: new Date().toISOString(),
      application_id: 'mock_app_id',
      user_id: 'mock_user_id',
      action: 'payment.created',
      data: { id: dataId }
    };
  }
}
```

#### 1.9.2 Test Fixtures Factory

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.9.2.1 | Create TestFixtureFactory base | Factory with common fixture creation methods | 1.4.1 |
| 1.9.2.2 | Create customer fixtures | createCustomer(), createCustomerWithSubscription() | 1.9.2.1 |
| 1.9.2.3 | Create subscription fixtures | createSubscription(), createTrialSubscription(), etc. | 1.9.2.1 |
| 1.9.2.4 | Create payment fixtures | createPayment(), createFailedPayment(), createRefund() | 1.9.2.1 |
| 1.9.2.5 | Create invoice fixtures | createInvoice(), createPartiallyPaidInvoice() | 1.9.2.1 |
| 1.9.2.6 | Create promo code fixtures | createPromoCode(), createExpiredPromoCode() | 1.9.2.1 |
| 1.9.2.7 | Create plan fixtures | createPlan(), createPlanWithTrials() | 1.9.2.1 |
| 1.9.2.8 | Create vendor fixtures | createVendor(), createVendorWithProducts() | 1.9.2.1 |

**TestFixtureFactory Implementation:**

```typescript
// packages/core/src/testing/fixtures/TestFixtureFactory.ts

import { v4 as uuidv4 } from 'uuid';
import type {
  Customer, Subscription, Payment, Invoice, PromoCode, Plan, Vendor,
  PaymentMethod, SubscriptionStatus, PaymentStatus, InvoiceStatus
} from '../../types';

export interface FixtureOverrides<T> {
  [key: string]: unknown;
}

/**
 * Factory for creating test fixtures with sensible defaults.
 * All methods accept optional overrides to customize specific fields.
 *
 * @example
 * const factory = new TestFixtureFactory();
 *
 * // Create with defaults
 * const customer = factory.createCustomer();
 *
 * // Create with overrides
 * const premiumCustomer = factory.createCustomer({
 *   email: 'premium@example.com',
 *   metadata: { tier: 'premium' }
 * });
 */
export class TestFixtureFactory {
  private sequence = 0;

  /** Get next sequence number for unique values */
  private nextSeq(): number {
    return ++this.sequence;
  }

  /** Reset sequence counter (useful between tests) */
  resetSequence(): void {
    this.sequence = 0;
  }

  // ==================== CUSTOMERS ====================

  createCustomer(overrides: Partial<Customer> = {}): Customer {
    const seq = this.nextSeq();
    return {
      id: uuidv4(),
      externalId: `ext_customer_${seq}`,
      email: `customer${seq}@test.example.com`,
      name: `Test Customer ${seq}`,
      metadata: {},
      livemode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  createCustomerWithPaymentMethod(
    customerOverrides: Partial<Customer> = {},
    paymentMethodOverrides: Partial<PaymentMethod> = {}
  ): { customer: Customer; paymentMethod: PaymentMethod } {
    const customer = this.createCustomer(customerOverrides);
    const paymentMethod = this.createPaymentMethod({
      customerId: customer.id,
      isDefault: true,
      ...paymentMethodOverrides
    });
    return { customer, paymentMethod };
  }

  // ==================== SUBSCRIPTIONS ====================

  createSubscription(overrides: Partial<Subscription> = {}): Subscription {
    const seq = this.nextSeq();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    return {
      id: uuidv4(),
      customerId: overrides.customerId ?? uuidv4(),
      planId: `plan_test_${seq}`,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      trialStart: null,
      trialEnd: null,
      canceledAt: null,
      endedAt: null,
      metadata: {},
      livemode: false,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createTrialSubscription(
    overrides: Partial<Subscription> = {},
    trialDays: number = 14
  ): Subscription {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    return this.createSubscription({
      status: 'trialing',
      trialStart: now,
      trialEnd: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      ...overrides
    });
  }

  createCanceledSubscription(overrides: Partial<Subscription> = {}): Subscription {
    const now = new Date();
    return this.createSubscription({
      status: 'canceled',
      canceledAt: now,
      endedAt: now,
      ...overrides
    });
  }

  createPastDueSubscription(overrides: Partial<Subscription> = {}): Subscription {
    return this.createSubscription({
      status: 'past_due',
      ...overrides
    });
  }

  // ==================== PAYMENTS ====================

  createPayment(overrides: Partial<Payment> = {}): Payment {
    const seq = this.nextSeq();
    const now = new Date();

    return {
      id: uuidv4(),
      customerId: overrides.customerId ?? uuidv4(),
      subscriptionId: overrides.subscriptionId ?? null,
      invoiceId: overrides.invoiceId ?? null,
      amount: 2900, // $29.00 in cents
      currency: 'usd',
      status: 'succeeded',
      provider: 'stripe',
      providerPaymentId: `pi_mock_${seq}`,
      paymentMethodId: overrides.paymentMethodId ?? null,
      refundedAmount: 0,
      metadata: {},
      livemode: false,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createFailedPayment(overrides: Partial<Payment> = {}): Payment {
    return this.createPayment({
      status: 'failed',
      failureCode: 'card_declined',
      failureMessage: 'Your card was declined.',
      ...overrides
    });
  }

  createPendingPayment(overrides: Partial<Payment> = {}): Payment {
    return this.createPayment({
      status: 'pending',
      ...overrides
    });
  }

  createRefundedPayment(
    overrides: Partial<Payment> = {},
    refundAmount?: number
  ): Payment {
    const payment = this.createPayment(overrides);
    return {
      ...payment,
      status: 'refunded',
      refundedAmount: refundAmount ?? payment.amount
    };
  }

  createPartiallyRefundedPayment(
    overrides: Partial<Payment> = {},
    refundAmount: number
  ): Payment {
    return this.createPayment({
      status: 'partially_refunded',
      refundedAmount: refundAmount,
      ...overrides
    });
  }

  // ==================== INVOICES ====================

  createInvoice(overrides: Partial<Invoice> = {}): Invoice {
    const seq = this.nextSeq();
    const now = new Date();
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id: uuidv4(),
      customerId: overrides.customerId ?? uuidv4(),
      subscriptionId: overrides.subscriptionId ?? null,
      number: `INV-${String(seq).padStart(6, '0')}`,
      status: 'open',
      subtotal: 2900,
      discount: 0,
      tax: 0,
      total: 2900,
      amountPaid: 0,
      amountRemaining: 2900,
      currency: 'usd',
      lineItems: [
        {
          description: 'Monthly subscription',
          quantity: 1,
          unitAmount: 2900,
          amount: 2900
        }
      ],
      dueDate: dueDate,
      paidAt: null,
      billingAddress: null,
      notes: null,
      metadata: {},
      livemode: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createPaidInvoice(overrides: Partial<Invoice> = {}): Invoice {
    const invoice = this.createInvoice(overrides);
    return {
      ...invoice,
      status: 'paid',
      amountPaid: invoice.total,
      amountRemaining: 0,
      paidAt: new Date()
    };
  }

  createPartiallyPaidInvoice(
    overrides: Partial<Invoice> = {},
    amountPaid: number
  ): Invoice {
    const invoice = this.createInvoice(overrides);
    return {
      ...invoice,
      status: 'partially_paid',
      amountPaid: amountPaid,
      amountRemaining: invoice.total - amountPaid
    };
  }

  createOverdueInvoice(overrides: Partial<Invoice> = {}): Invoice {
    const pastDueDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    return this.createInvoice({
      dueDate: pastDueDate,
      status: 'open',
      ...overrides
    });
  }

  // ==================== PROMO CODES ====================

  createPromoCode(overrides: Partial<PromoCode> = {}): PromoCode {
    const seq = this.nextSeq();
    const now = new Date();

    return {
      id: uuidv4(),
      code: `TESTCODE${seq}`,
      type: 'percentage',
      value: 10, // 10% off
      config: {},
      maxUses: null,
      usedCount: 0,
      maxUsesPerCustomer: null,
      validPlans: null,
      newCustomersOnly: false,
      existingCustomersOnly: false,
      startsAt: null,
      expiresAt: null,
      combinable: true,
      active: true,
      metadata: {},
      livemode: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createFixedAmountPromoCode(
    amount: number,
    currency: string = 'usd',
    overrides: Partial<PromoCode> = {}
  ): PromoCode {
    return this.createPromoCode({
      type: 'fixed_amount',
      value: amount,
      config: { currency },
      ...overrides
    });
  }

  createExpiredPromoCode(overrides: Partial<PromoCode> = {}): PromoCode {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    return this.createPromoCode({
      expiresAt: pastDate,
      ...overrides
    });
  }

  createMaxedOutPromoCode(overrides: Partial<PromoCode> = {}): PromoCode {
    return this.createPromoCode({
      maxUses: 10,
      usedCount: 10,
      ...overrides
    });
  }

  // ==================== PLANS ====================

  createPlan(overrides: Partial<Plan> = {}): Plan {
    const seq = this.nextSeq();
    const now = new Date();

    return {
      id: uuidv4(),
      planId: `plan_test_${seq}`,
      name: `Test Plan ${seq}`,
      description: `Description for test plan ${seq}`,
      prices: {
        month: { amount: 2900, currency: 'usd' },
        year: { amount: 29000, currency: 'usd' }
      },
      entitlements: {
        canAccessBasicFeatures: true,
        canAccessPremiumFeatures: false
      },
      limits: {
        maxProjects: 5,
        maxStorageMB: 1000
      },
      trialDays: 0,
      trialRequiresPaymentMethod: false,
      displayOrder: seq,
      isFeatured: false,
      badgeText: null,
      active: true,
      visible: true,
      metadata: {},
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createPlanWithTrial(trialDays: number = 14, overrides: Partial<Plan> = {}): Plan {
    return this.createPlan({
      trialDays,
      trialRequiresPaymentMethod: true,
      ...overrides
    });
  }

  createFreePlan(overrides: Partial<Plan> = {}): Plan {
    return this.createPlan({
      planId: 'plan_free',
      name: 'Free Plan',
      prices: {},
      limits: {
        maxProjects: 1,
        maxStorageMB: 100
      },
      ...overrides
    });
  }

  // ==================== PAYMENT METHODS ====================

  createPaymentMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
    const seq = this.nextSeq();
    const now = new Date();

    return {
      id: uuidv4(),
      customerId: overrides.customerId ?? uuidv4(),
      provider: 'stripe',
      providerPaymentMethodId: `pm_mock_${seq}`,
      type: 'card',
      lastFour: '4242',
      brand: 'visa',
      expMonth: 12,
      expYear: new Date().getFullYear() + 2,
      isDefault: false,
      livemode: false,
      metadata: {},
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...overrides
    };
  }

  createExpiredPaymentMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
    return this.createPaymentMethod({
      expMonth: 1,
      expYear: new Date().getFullYear() - 1, // Last year
      ...overrides
    });
  }

  // ==================== VENDORS ====================

  createVendor(overrides: Partial<Vendor> = {}): Vendor {
    const seq = this.nextSeq();
    const now = new Date();

    return {
      id: uuidv4(),
      externalId: `vendor_${seq}`,
      name: `Test Vendor ${seq}`,
      email: `vendor${seq}@test.example.com`,
      commissionRate: 10, // 10%
      payoutSchedule: 'monthly',
      payoutMinimum: 10000, // $100.00
      currency: 'usd',
      status: 'active',
      onboardingStatus: 'complete',
      providerAccountId: `acct_mock_${seq}`,
      metadata: {},
      livemode: false,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  createPendingVendor(overrides: Partial<Vendor> = {}): Vendor {
    return this.createVendor({
      status: 'pending',
      onboardingStatus: 'pending',
      providerAccountId: null,
      ...overrides
    });
  }
}

// Export singleton instance for convenience
export const fixtures = new TestFixtureFactory();
```

#### 1.9.3 Database Test Utilities

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.9.3.1 | Create TestDatabase class | Database setup/teardown for tests | 2.3.1 |
| 1.9.3.2 | Create transaction wrapper | Run tests in rolled-back transactions | 1.9.3.1 |
| 1.9.3.3 | Create seeding utilities | Seed database with fixture data | 1.9.3.1, 1.9.2.1 |
| 1.9.3.4 | Create cleanup utilities | Reset database between tests | 1.9.3.1 |

**TestDatabase Implementation:**

```typescript
// packages/drizzle/src/testing/TestDatabase.ts

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

export interface TestDatabaseConfig {
  /** Database connection URL (should be test database, NOT production!) */
  connectionUrl: string;
  /** If true, log all SQL queries (useful for debugging) */
  logQueries?: boolean;
  /** Schema to use (defaults to 'public') */
  schema?: string;
}

/**
 * Test database utility for integration tests.
 *
 * IMPORTANT: This should ONLY connect to a test database, never production!
 *
 * @example
 * let testDb: TestDatabase;
 *
 * beforeAll(async () => {
 *   testDb = new TestDatabase({
 *     connectionUrl: process.env.TEST_DATABASE_URL!
 *   });
 *   await testDb.connect();
 *   await testDb.migrate();
 * });
 *
 * afterAll(async () => {
 *   await testDb.disconnect();
 * });
 *
 * beforeEach(async () => {
 *   await testDb.truncateAll();
 * });
 */
export class TestDatabase {
  private client: postgres.Sql | null = null;
  private _db: PostgresJsDatabase<typeof schema> | null = null;
  private config: TestDatabaseConfig;

  constructor(config: TestDatabaseConfig) {
    this.config = config;

    // Safety check: refuse to connect to production-looking URLs
    if (
      config.connectionUrl.includes('prod') ||
      config.connectionUrl.includes('production') ||
      !config.connectionUrl.includes('test')
    ) {
      throw new Error(
        'TestDatabase connection URL must contain "test" and not contain "prod" or "production". ' +
        'This is a safety measure to prevent accidental data loss.'
      );
    }
  }

  /** Get the Drizzle database instance */
  get db(): PostgresJsDatabase<typeof schema> {
    if (!this._db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this._db;
  }

  /** Connect to the test database */
  async connect(): Promise<void> {
    this.client = postgres(this.config.connectionUrl, {
      max: 1, // Single connection for tests
      onnotice: () => {} // Suppress notices
    });

    this._db = drizzle(this.client, {
      schema,
      logger: this.config.logQueries
    });
  }

  /** Disconnect from the test database */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this._db = null;
    }
  }

  /** Run migrations on the test database */
  async migrate(): Promise<void> {
    // Implementation depends on your migration setup
    // Option 1: Use Drizzle Kit programmatically
    // Option 2: Run SQL files directly
    // Option 3: Use migrate() from drizzle-orm/postgres-js/migrator
  }

  /** Truncate all tables (preserves schema, removes all data) */
  async truncateAll(): Promise<void> {
    if (!this.client) throw new Error('Database not connected');

    // Get all table names in the billing schema
    const tables = await this.client`
      SELECT tablename FROM pg_tables
      WHERE schemaname = ${this.config.schema ?? 'public'}
      AND tablename LIKE 'billing_%'
    `;

    if (tables.length === 0) return;

    // Truncate all tables in a single transaction with CASCADE
    const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
    await this.client.unsafe(`TRUNCATE TABLE ${tableNames} CASCADE`);
  }

  /** Drop and recreate all tables (full reset) */
  async reset(): Promise<void> {
    await this.truncateAll();
    // Optionally re-run migrations or seed data
  }

  /**
   * Run a function within a transaction that will be rolled back.
   * Useful for tests that need isolation without cleanup.
   *
   * @example
   * await testDb.withRollback(async (tx) => {
   *   await tx.insert(customers).values(customerData);
   *   const result = await tx.query.customers.findFirst();
   *   expect(result).toBeDefined();
   * }); // Transaction is rolled back, no data persists
   */
  async withRollback<T>(
    fn: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>
  ): Promise<T> {
    return await this.db.transaction(async (tx) => {
      const result = await fn(tx);
      // Force rollback by throwing after getting result
      throw { __rollback: true, result };
    }).catch((err) => {
      if (err.__rollback) return err.result;
      throw err;
    });
  }
}
```

**Database Seeder Implementation:**

```typescript
// packages/drizzle/src/testing/DatabaseSeeder.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';
import { TestFixtureFactory, fixtures } from '@qazuor/qzpay-core/testing';

export interface SeedScenario {
  name: string;
  description: string;
  seed: (db: PostgresJsDatabase<typeof schema>, fixtures: TestFixtureFactory) => Promise<void>;
}

/**
 * Database seeder for creating test scenarios.
 *
 * @example
 * const seeder = new DatabaseSeeder(testDb.db);
 *
 * // Seed a predefined scenario
 * await seeder.seed('simpleCustomerWithSubscription');
 *
 * // Or seed custom data
 * await seeder.seedCustom(async (db, fixtures) => {
 *   const customer = fixtures.createCustomer({ email: 'test@example.com' });
 *   await db.insert(schema.customers).values(customer);
 * });
 */
export class DatabaseSeeder {
  private db: PostgresJsDatabase<typeof schema>;
  private scenarios: Map<string, SeedScenario> = new Map();

  constructor(db: PostgresJsDatabase<typeof schema>) {
    this.db = db;
    this.registerDefaultScenarios();
  }

  private registerDefaultScenarios(): void {
    // Scenario: Single customer, no subscriptions
    this.registerScenario({
      name: 'simpleCustomer',
      description: 'A single customer with no subscriptions or payment methods',
      seed: async (db, f) => {
        const customer = f.createCustomer();
        await db.insert(schema.customers).values(customer);
      }
    });

    // Scenario: Customer with active subscription
    this.registerScenario({
      name: 'simpleCustomerWithSubscription',
      description: 'A customer with one active monthly subscription',
      seed: async (db, f) => {
        const customer = f.createCustomer();
        const paymentMethod = f.createPaymentMethod({ customerId: customer.id, isDefault: true });
        const subscription = f.createSubscription({ customerId: customer.id });

        await db.insert(schema.customers).values(customer);
        await db.insert(schema.paymentMethods).values(paymentMethod);
        await db.insert(schema.subscriptions).values(subscription);
      }
    });

    // Scenario: Customer on trial
    this.registerScenario({
      name: 'customerOnTrial',
      description: 'A customer with a trial subscription (14 days)',
      seed: async (db, f) => {
        const customer = f.createCustomer();
        const paymentMethod = f.createPaymentMethod({ customerId: customer.id, isDefault: true });
        const subscription = f.createTrialSubscription({ customerId: customer.id }, 14);

        await db.insert(schema.customers).values(customer);
        await db.insert(schema.paymentMethods).values(paymentMethod);
        await db.insert(schema.subscriptions).values(subscription);
      }
    });

    // Scenario: Customer with past due subscription
    this.registerScenario({
      name: 'pastDueCustomer',
      description: 'A customer with a past_due subscription and failed payment',
      seed: async (db, f) => {
        const customer = f.createCustomer();
        const subscription = f.createPastDueSubscription({ customerId: customer.id });
        const invoice = f.createOverdueInvoice({
          customerId: customer.id,
          subscriptionId: subscription.id
        });
        const failedPayment = f.createFailedPayment({
          customerId: customer.id,
          invoiceId: invoice.id
        });

        await db.insert(schema.customers).values(customer);
        await db.insert(schema.subscriptions).values(subscription);
        await db.insert(schema.invoices).values(invoice);
        await db.insert(schema.payments).values(failedPayment);
      }
    });

    // Scenario: Multiple customers with various states
    this.registerScenario({
      name: 'multipleCustomers',
      description: '5 customers with different subscription states',
      seed: async (db, f) => {
        const customers = [
          { ...f.createCustomer(), email: 'active@test.com' },
          { ...f.createCustomer(), email: 'trial@test.com' },
          { ...f.createCustomer(), email: 'canceled@test.com' },
          { ...f.createCustomer(), email: 'pastdue@test.com' },
          { ...f.createCustomer(), email: 'free@test.com' }
        ];

        await db.insert(schema.customers).values(customers);

        await db.insert(schema.subscriptions).values([
          f.createSubscription({ customerId: customers[0].id, status: 'active' }),
          f.createTrialSubscription({ customerId: customers[1].id }),
          f.createCanceledSubscription({ customerId: customers[2].id }),
          f.createPastDueSubscription({ customerId: customers[3].id })
          // customers[4] has no subscription (free tier)
        ]);
      }
    });

    // Scenario: Promo codes
    this.registerScenario({
      name: 'promoCodes',
      description: 'Various promo codes for testing validation',
      seed: async (db, f) => {
        await db.insert(schema.promoCodes).values([
          f.createPromoCode({ code: 'VALID10', type: 'percentage', value: 10 }),
          f.createPromoCode({ code: 'FIXED50', type: 'fixed_amount', value: 5000 }),
          f.createExpiredPromoCode({ code: 'EXPIRED' }),
          f.createMaxedOutPromoCode({ code: 'MAXED' }),
          f.createPromoCode({ code: 'NEWONLY', newCustomersOnly: true })
        ]);
      }
    });
  }

  /** Register a custom scenario */
  registerScenario(scenario: SeedScenario): void {
    this.scenarios.set(scenario.name, scenario);
  }

  /** Get list of available scenarios */
  getAvailableScenarios(): Array<{ name: string; description: string }> {
    return Array.from(this.scenarios.values()).map(s => ({
      name: s.name,
      description: s.description
    }));
  }

  /** Seed the database with a predefined scenario */
  async seed(scenarioName: string): Promise<void> {
    const scenario = this.scenarios.get(scenarioName);
    if (!scenario) {
      throw new Error(
        `Unknown scenario: "${scenarioName}". Available: ${Array.from(this.scenarios.keys()).join(', ')}`
      );
    }
    await scenario.seed(this.db, fixtures);
  }

  /** Seed the database with custom logic */
  async seedCustom(
    fn: (db: PostgresJsDatabase<typeof schema>, fixtures: TestFixtureFactory) => Promise<void>
  ): Promise<void> {
    await fn(this.db, fixtures);
  }
}
```

#### 1.9.4 Test Environment Configuration

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.9.4.1 | Create test environment documentation | Document required env vars for tests | - |
| 1.9.4.2 | Create .env.test.example | Template for test environment | 1.9.4.1 |
| 1.9.4.3 | Create vitest.config.ts | Vitest configuration for all packages | - |
| 1.9.4.4 | Create test setup files | Global setup/teardown for tests | 1.9.4.3 |

**Test Environment Variables (.env.test.example):**

```bash
# .env.test.example
# Copy to .env.test and fill in values for running tests

# ===========================================
# DATABASE (Required for integration tests)
# ===========================================
# MUST contain "test" in the name as a safety measure
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qzpay_test

# ===========================================
# PAYMENT PROVIDERS (Optional - mocks used by default)
# ===========================================
# Set these to use real Stripe test mode instead of mocks
# STRIPE_TEST_SECRET_KEY=sk_test_...
# STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
# STRIPE_TEST_WEBHOOK_SECRET=whsec_...

# Set these to use real MercadoPago sandbox instead of mocks
# MERCADOPAGO_TEST_ACCESS_TOKEN=TEST-...
# MERCADOPAGO_TEST_PUBLIC_KEY=TEST-...

# ===========================================
# TEST CONFIGURATION
# ===========================================
# Set to 'true' to log all SQL queries during tests
TEST_LOG_QUERIES=false

# Set to 'true' to use real providers instead of mocks
TEST_USE_REAL_PROVIDERS=false

# Timeout for async operations in ms
TEST_TIMEOUT_MS=5000
```

**Vitest Configuration (vitest.config.ts):**

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Global settings
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 30000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/testing/**', // Don't require coverage for test utilities
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },

    // Setup files
    setupFiles: ['./test/setup.ts'],

    // Pool configuration for parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Use single fork for DB tests to avoid connection issues
      }
    },

    // Include patterns
    include: ['packages/**/*.{test,spec}.{js,ts}'],

    // Alias resolution
    alias: {
      '@qazuor/qzpay-core': path.resolve(__dirname, 'packages/core/src'),
      '@qazuor/qzpay-drizzle': path.resolve(__dirname, 'packages/drizzle/src'),
      '@qazuor/qzpay-stripe': path.resolve(__dirname, 'packages/stripe/src'),
      '@qazuor/qzpay-mercadopago': path.resolve(__dirname, 'packages/mercadopago/src')
    }
  }
});
```

**Global Test Setup (test/setup.ts):**

```typescript
// test/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestDatabase } from '@qazuor/qzpay-drizzle/testing';
import { fixtures } from '@qazuor/qzpay-core/testing';

// Load test environment
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Validate required environment variables
const requiredEnvVars = ['TEST_DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required test environment variable: ${envVar}`);
  }
}

// Global test database instance
let testDatabase: TestDatabase | null = null;

// Get or create test database instance
export function getTestDatabase(): TestDatabase {
  if (!testDatabase) {
    testDatabase = new TestDatabase({
      connectionUrl: process.env.TEST_DATABASE_URL!,
      logQueries: process.env.TEST_LOG_QUERIES === 'true'
    });
  }
  return testDatabase;
}

// Global setup (runs once before all tests)
beforeAll(async () => {
  const db = getTestDatabase();
  await db.connect();
  await db.migrate();
});

// Global teardown (runs once after all tests)
afterAll(async () => {
  if (testDatabase) {
    await testDatabase.disconnect();
    testDatabase = null;
  }
});

// Per-test setup
beforeEach(() => {
  // Reset fixture sequence for consistent test data
  fixtures.resetSequence();

  // Clear all mocks
  vi.clearAllMocks();
});

// Per-test teardown
afterEach(async () => {
  // Truncate all data after each test for isolation
  const db = getTestDatabase();
  await db.truncateAll();
});

// Export for use in tests
export { fixtures };
```

#### 1.9.5 Shared Test Utilities

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.9.5.1 | Create event assertion utilities | assertEventEmitted(), assertEventPayload() | 1.7.2 |
| 1.9.5.2 | Create async utilities | waitFor(), waitForCondition(), eventually() | - |
| 1.9.5.3 | Create mock clock utilities | Wrapper around vi.useFakeTimers() for billing dates | - |
| 1.9.5.4 | Create API test utilities | createTestRequest(), expectApiError() | - |

**Test Utilities Implementation:**

```typescript
// packages/core/src/testing/utils/assertions.ts

import { expect, vi } from 'vitest';
import type { QZPayEvent, QZPayEventType } from '../../events';

/**
 * Assert that an event was emitted with specific payload.
 *
 * @example
 * const mockEmit = vi.fn();
 * billing.on('subscription.created', mockEmit);
 *
 * await billing.subscriptions.create(...);
 *
 * assertEventEmitted(mockEmit, 'subscription.created', {
 *   subscriptionId: expect.any(String),
 *   customerId: 'cus_123'
 * });
 */
export function assertEventEmitted(
  mockFn: ReturnType<typeof vi.fn>,
  eventType: QZPayEventType,
  expectedPayload?: Record<string, unknown>
): void {
  expect(mockFn).toHaveBeenCalled();

  const calls = mockFn.mock.calls;
  const matchingCall = calls.find((call) => {
    const event = call[0] as QZPayEvent;
    return event.type === eventType;
  });

  expect(matchingCall).toBeDefined();

  if (expectedPayload) {
    const event = matchingCall![0] as QZPayEvent;
    expect(event.payload).toMatchObject(expectedPayload);
  }
}

/**
 * Assert that an event was NOT emitted.
 */
export function assertEventNotEmitted(
  mockFn: ReturnType<typeof vi.fn>,
  eventType: QZPayEventType
): void {
  const calls = mockFn.mock.calls;
  const matchingCall = calls.find((call) => {
    const event = call[0] as QZPayEvent;
    return event.type === eventType;
  });

  expect(matchingCall).toBeUndefined();
}

/**
 * Get all events of a specific type from mock calls.
 */
export function getEmittedEvents<T = unknown>(
  mockFn: ReturnType<typeof vi.fn>,
  eventType: QZPayEventType
): Array<QZPayEvent<T>> {
  return mockFn.mock.calls
    .map((call) => call[0] as QZPayEvent<T>)
    .filter((event) => event.type === eventType);
}
```

```typescript
// packages/core/src/testing/utils/async.ts

/**
 * Wait for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to become true, with timeout.
 *
 * @example
 * await waitForCondition(
 *   () => mockFn.mock.calls.length > 0,
 *   { timeout: 5000, interval: 100 }
 * );
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Retry an async function until it succeeds or timeout.
 *
 * @example
 * const result = await eventually(
 *   () => db.query.customers.findFirst({ where: eq(customers.email, 'test@example.com') }),
 *   { timeout: 5000 }
 * );
 */
export async function eventually<T>(
  fn: () => Promise<T>,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - startTime < timeout) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      await sleep(interval);
    }
  }

  throw new Error(`Operation failed after ${timeout}ms. Last error: ${lastError?.message}`);
}
```

```typescript
// packages/core/src/testing/utils/time.ts

import { vi, afterEach } from 'vitest';

/**
 * Helper for testing time-sensitive billing logic.
 * Provides a cleaner API over vi.useFakeTimers().
 *
 * @example
 * const clock = useFakeClock();
 *
 * // Create subscription
 * const sub = await billing.subscriptions.create(...);
 *
 * // Advance to end of trial
 * clock.advanceDays(14);
 *
 * // Trigger billing
 * await billing.jobs.processSubscriptionRenewals();
 */
export function useFakeClock(initialDate?: Date) {
  vi.useFakeTimers();

  if (initialDate) {
    vi.setSystemTime(initialDate);
  }

  // Auto-cleanup after test
  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    /** Advance time by milliseconds */
    advance(ms: number): void {
      vi.advanceTimersByTime(ms);
    },

    /** Advance time by days */
    advanceDays(days: number): void {
      vi.advanceTimersByTime(days * 24 * 60 * 60 * 1000);
    },

    /** Advance time by hours */
    advanceHours(hours: number): void {
      vi.advanceTimersByTime(hours * 60 * 60 * 1000);
    },

    /** Set the current time to a specific date */
    setTime(date: Date): void {
      vi.setSystemTime(date);
    },

    /** Get the current mocked time */
    now(): Date {
      return new Date();
    },

    /** Restore real timers */
    restore(): void {
      vi.useRealTimers();
    }
  };
}

/**
 * Create a date relative to now (or a base date).
 *
 * @example
 * const yesterday = relativeDate({ days: -1 });
 * const nextWeek = relativeDate({ days: 7 });
 * const inTwoMonths = relativeDate({ months: 2 }, new Date('2024-01-15'));
 */
export function relativeDate(
  delta: { days?: number; hours?: number; minutes?: number; months?: number },
  base: Date = new Date()
): Date {
  const result = new Date(base);

  if (delta.months) {
    result.setMonth(result.getMonth() + delta.months);
  }
  if (delta.days) {
    result.setDate(result.getDate() + delta.days);
  }
  if (delta.hours) {
    result.setHours(result.getHours() + delta.hours);
  }
  if (delta.minutes) {
    result.setMinutes(result.getMinutes() + delta.minutes);
  }

  return result;
}
```

```typescript
// packages/core/src/testing/utils/api.ts

import type { Context } from 'hono';
import { vi } from 'vitest';

/**
 * Create a mock Hono context for testing API handlers.
 *
 * @example
 * const { ctx, json, status } = createMockContext({
 *   body: { email: 'test@example.com' },
 *   params: { id: '123' }
 * });
 *
 * await createCustomerHandler(ctx);
 *
 * expect(status).toHaveBeenCalledWith(201);
 * expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
 */
export function createMockContext(options: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): {
  ctx: Context;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  header: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const header = vi.fn();

  const ctx = {
    req: {
      json: vi.fn().mockResolvedValue(options.body ?? {}),
      param: (key: string) => options.params?.[key],
      query: (key: string) => options.query?.[key],
      header: (key: string) => options.headers?.[key]
    },
    json,
    status,
    header,
    get: vi.fn(),
    set: vi.fn()
  } as unknown as Context;

  return { ctx, json, status, header };
}

/**
 * Assert that an API handler returned an error response.
 *
 * @example
 * await expectApiError(
 *   () => handler(ctx),
 *   { status: 404, code: 'CUSTOMER_NOT_FOUND' }
 * );
 */
export async function expectApiError(
  fn: () => Promise<unknown>,
  expected: { status: number; code?: string; message?: string }
): Promise<void> {
  const { ctx, json, status } = createMockContext();

  try {
    await fn();
  } catch (error) {
    // If handler throws, check error properties
    if (error && typeof error === 'object' && 'status' in error) {
      expect((error as { status: number }).status).toBe(expected.status);
      if (expected.code) {
        expect((error as { code: string }).code).toBe(expected.code);
      }
      return;
    }
    throw error;
  }

  // If handler doesn't throw, check response
  expect(status).toHaveBeenCalledWith(expected.status);
  if (expected.code) {
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: expected.code }) })
    );
  }
}
```

#### 1.9.6 Package Exports

**Core Testing Exports:**

```typescript
// packages/core/src/testing/index.ts

// Mock Providers
export { MockPaymentProvider, type MockProviderConfig } from './mocks/MockPaymentProvider';
export { MockStripeProvider, type MockStripeConfig } from './mocks/MockStripeProvider';
export { MockMercadoPagoProvider, type MockMercadoPagoConfig } from './mocks/MockMercadoPagoProvider';

// Fixtures
export { TestFixtureFactory, fixtures } from './fixtures/TestFixtureFactory';

// Utilities
export { assertEventEmitted, assertEventNotEmitted, getEmittedEvents } from './utils/assertions';
export { sleep, waitForCondition, eventually } from './utils/async';
export { useFakeClock, relativeDate } from './utils/time';
export { createMockContext, expectApiError } from './utils/api';
```

**Drizzle Testing Exports:**

```typescript
// packages/drizzle/src/testing/index.ts

export { TestDatabase, type TestDatabaseConfig } from './TestDatabase';
export { DatabaseSeeder, type SeedScenario } from './DatabaseSeeder';
```

### 1.10 Edge Cases Documentation

> **CRITICAL**: All edge cases documented in this section MUST have corresponding tests. Tests should be marked with `@edge-case` tag for easy identification.

#### 1.10.1 Subscription Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| SUB-EC-001 | Create subscription for customer with no payment method | MUST fail with `PAYMENT_METHOD_REQUIRED` error | ✅ Required |
| SUB-EC-002 | Create subscription for customer with expired card | MUST fail with `PAYMENT_METHOD_EXPIRED` error | ✅ Required |
| SUB-EC-003 | Create subscription with invalid plan_id | MUST fail with `PLAN_NOT_FOUND` error | ✅ Required |
| SUB-EC-004 | Create subscription with inactive plan | MUST fail with `PLAN_INACTIVE` error | ✅ Required |
| SUB-EC-005 | Two concurrent `changePlan()` calls | First succeeds, second fails with `OPTIMISTIC_LOCK_ERROR` | ✅ Required |
| SUB-EC-006 | `changePlan()` to same plan | MUST fail with `SAME_PLAN` error (no-op prevention) | ✅ Required |
| SUB-EC-007 | `changePlan()` on canceled subscription | MUST fail with `SUBSCRIPTION_NOT_ACTIVE` error | ✅ Required |
| SUB-EC-008 | `cancel()` on already canceled subscription | MUST be idempotent (return success, no state change) | ✅ Required |
| SUB-EC-009 | `cancel()` with `cancelAtPeriodEnd=true` then `reactivate()` | Subscription returns to `active`, `cancelAtPeriodEnd=false` | ✅ Required |
| SUB-EC-010 | `reactivate()` after period has ended | MUST fail with `SUBSCRIPTION_ENDED` error | ✅ Required |
| SUB-EC-011 | Trial subscription with 0 trial days | MUST start as `active`, not `trialing` | ✅ Required |
| SUB-EC-012 | Trial ends exactly at midnight UTC | MUST transition to `active` and charge customer | ✅ Required |
| SUB-EC-013 | Subscription renewal when payment fails | Status → `past_due`, create failed payment record, emit event | ✅ Required |
| SUB-EC-014 | Subscription with multiple addons, remove one | Only specified addon removed, others unchanged | ✅ Required |
| SUB-EC-015 | Downgrade to plan without addon support | Addons MUST be removed, customer notified via event | ✅ Required |

**Subscription State Transition Matrix:**

| From State | To State | Allowed? | Trigger |
|------------|----------|----------|---------|
| `trialing` | `active` | ✅ Yes | Trial ends, payment succeeds |
| `trialing` | `past_due` | ✅ Yes | Trial ends, payment fails |
| `trialing` | `canceled` | ✅ Yes | Customer cancels during trial |
| `active` | `past_due` | ✅ Yes | Renewal payment fails |
| `active` | `canceled` | ✅ Yes | Customer cancels (immediate) |
| `active` | `trialing` | ❌ No | Invalid transition |
| `past_due` | `active` | ✅ Yes | Payment succeeds |
| `past_due` | `canceled` | ✅ Yes | Max retries exceeded or customer cancels |
| `past_due` | `unpaid` | ✅ Yes | Grace period ends |
| `canceled` | `active` | ❌ No | Must create new subscription |
| `canceled` | `trialing` | ❌ No | Must create new subscription |
| `unpaid` | `active` | ✅ Yes | Outstanding balance paid |
| `unpaid` | `canceled` | ✅ Yes | Admin cancels or auto-cancel policy |

**Test Implementation Pattern:**

```typescript
describe('Subscription Edge Cases', () => {
  describe('@edge-case SUB-EC-005: Concurrent changePlan calls', () => {
    it('should fail second call with OPTIMISTIC_LOCK_ERROR', async () => {
      // Arrange
      const subscription = await createSubscription({ planId: 'basic' });

      // Act - simulate concurrent calls
      const [result1, result2] = await Promise.allSettled([
        billing.subscriptions.changePlan(subscription.id, 'premium'),
        billing.subscriptions.changePlan(subscription.id, 'enterprise')
      ]);

      // Assert
      const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
      const failed = [result1, result2].filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason.code).toBe('OPTIMISTIC_LOCK_ERROR');
    });
  });
});
```

#### 1.10.2 Payment Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| PAY-EC-001 | Payment amount = 0 | MUST fail with `INVALID_AMOUNT` error (use free plan instead) | ✅ Required |
| PAY-EC-002 | Payment amount < 0 | MUST fail with `INVALID_AMOUNT` error | ✅ Required |
| PAY-EC-003 | Payment amount > invoice total | MUST fail with `AMOUNT_EXCEEDS_BALANCE` error | ✅ Required |
| PAY-EC-004 | Two partial payments summing to exact total | Invoice status → `paid`, no overpayment | ✅ Required |
| PAY-EC-005 | Two concurrent partial payments | One succeeds, one fails with `OPTIMISTIC_LOCK_ERROR` | ✅ Required |
| PAY-EC-006 | Payment with declined card | Status `failed`, `failureCode` populated, event emitted | ✅ Required |
| PAY-EC-007 | Payment with insufficient funds | Status `failed`, specific `failureCode: 'insufficient_funds'` | ✅ Required |
| PAY-EC-008 | Payment with network timeout | Status `pending`, retry scheduled, idempotency key preserved | ✅ Required |
| PAY-EC-009 | Refund full amount | Original payment status → `refunded`, `refundedAmount = amount` | ✅ Required |
| PAY-EC-010 | Refund partial amount | Status → `partially_refunded`, `refundedAmount` updated | ✅ Required |
| PAY-EC-011 | Refund more than original amount | MUST fail with `REFUND_EXCEEDS_PAYMENT` error | ✅ Required |
| PAY-EC-012 | Refund already refunded payment | MUST fail with `ALREADY_REFUNDED` error | ✅ Required |
| PAY-EC-013 | Payment with 8 decimal places (crypto) | Amount stored with full precision (DECIMAL 19,8) | ✅ Required |
| PAY-EC-014 | Payment in currency not matching invoice | MUST fail with `CURRENCY_MISMATCH` error | ✅ Required |
| PAY-EC-015 | Duplicate payment (same idempotency key) | Return original payment, no duplicate charge | ✅ Required |
| PAY-EC-016 | Payment method deleted mid-transaction | Transaction fails gracefully, no orphan records | ✅ Required |

**Idempotency Key Behavior:**

```typescript
/**
 * Idempotency Key Rules:
 *
 * 1. Key format: `{operation}_{entityId}_{timestamp}` or client-provided
 * 2. Key TTL: 24 hours (configurable)
 * 3. Same key + same params = return cached result
 * 4. Same key + different params = IDEMPOTENCY_KEY_REUSED error
 * 5. Expired key = treated as new request
 */

interface IdempotencyBehavior {
  // Within TTL window
  sameKeyAndParams: 'return_cached_result';
  sameKeyDifferentParams: 'throw_IDEMPOTENCY_KEY_REUSED';

  // After TTL expires
  expiredKey: 'process_as_new_request';
}
```

**Payment State Transition Matrix:**

| From State | To State | Allowed? | Trigger |
|------------|----------|----------|---------|
| `pending` | `processing` | ✅ Yes | Provider confirms receipt |
| `pending` | `succeeded` | ✅ Yes | Instant payment success |
| `pending` | `failed` | ✅ Yes | Payment rejected |
| `processing` | `succeeded` | ✅ Yes | Provider confirms success |
| `processing` | `failed` | ✅ Yes | Provider confirms failure |
| `succeeded` | `refunded` | ✅ Yes | Full refund processed |
| `succeeded` | `partially_refunded` | ✅ Yes | Partial refund processed |
| `succeeded` | `disputed` | ✅ Yes | Customer opens dispute |
| `failed` | `succeeded` | ❌ No | Must create new payment |
| `refunded` | `succeeded` | ❌ No | Invalid transition |
| `disputed` | `succeeded` | ✅ Yes | Dispute resolved in merchant favor |
| `disputed` | `refunded` | ✅ Yes | Dispute resolved in customer favor |

#### 1.10.3 Invoice Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| INV-EC-001 | Invoice total = 0 (100% discount) | Invoice created with `status: 'paid'`, no payment required | ✅ Required |
| INV-EC-002 | Invoice with negative discount (surcharge) | MUST fail with `INVALID_DISCOUNT` error | ✅ Required |
| INV-EC-003 | Discount > subtotal | Discount capped at subtotal, total = tax only | ✅ Required |
| INV-EC-004 | Multiple payments exceeding total | MUST fail on payment that would exceed | ✅ Required |
| INV-EC-005 | Void invoice with partial payments | MUST fail with `INVOICE_HAS_PAYMENTS` error | ✅ Required |
| INV-EC-006 | Void already voided invoice | Idempotent, return success | ✅ Required |
| INV-EC-007 | Void paid invoice | MUST fail with `INVOICE_ALREADY_PAID` error (use refund instead) | ✅ Required |
| INV-EC-008 | Invoice number collision | MUST use tenant-scoped unique constraint, retry with next number | ✅ Required |
| INV-EC-009 | Invoice due_date in the past | Allowed (for backdating), but mark as overdue immediately | ✅ Required |
| INV-EC-010 | Update invoice after payment | Only `notes`, `metadata` editable; amounts frozen | ✅ Required |
| INV-EC-011 | Delete invoice with line items | MUST cascade delete line items (or fail if has payments) | ✅ Required |
| INV-EC-012 | Invoice for deleted customer | MUST fail with `CUSTOMER_NOT_FOUND` error | ✅ Required |
| INV-EC-013 | Concurrent updates to amount_paid | Use optimistic locking, fail with conflict error | ✅ Required |

**Invoice Amount Calculation Rules:**

```typescript
/**
 * Invoice Amount Calculation (MUST be enforced):
 *
 * 1. subtotal = SUM(lineItems.amount)
 * 2. discount = MIN(appliedDiscount, subtotal)  // Cannot exceed subtotal
 * 3. tax = (subtotal - discount) * taxRate
 * 4. total = subtotal - discount + tax
 * 5. amount_remaining = total - amount_paid     // Generated column in DB
 *
 * Precision: All amounts use DECIMAL(19,8)
 * Rounding: ROUND_HALF_UP at final total only
 */

interface InvoiceAmountRules {
  subtotal: 'sum_of_line_items';
  discount: 'capped_at_subtotal';
  tax: 'applied_after_discount';
  total: 'subtotal_minus_discount_plus_tax';
  amountRemaining: 'generated_column';
}
```

#### 1.10.4 Promo Code Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| PROMO-EC-001 | Apply expired promo code | MUST fail with `PROMO_CODE_EXPIRED` error | ✅ Required |
| PROMO-EC-002 | Apply promo code before start date | MUST fail with `PROMO_CODE_NOT_STARTED` error | ✅ Required |
| PROMO-EC-003 | Apply promo code at exact max_uses | MUST succeed (equal is valid) | ✅ Required |
| PROMO-EC-004 | Apply promo code when used_count = max_uses | MUST fail with `PROMO_CODE_EXHAUSTED` error | ✅ Required |
| PROMO-EC-005 | Two concurrent redemptions at max_uses - 1 | One succeeds, one fails (optimistic locking) | ✅ Required |
| PROMO-EC-006 | Apply `newCustomersOnly` to existing customer | MUST fail with `PROMO_CODE_NEW_CUSTOMERS_ONLY` error | ✅ Required |
| PROMO-EC-007 | Apply `existingCustomersOnly` to new customer | MUST fail with `PROMO_CODE_EXISTING_CUSTOMERS_ONLY` error | ✅ Required |
| PROMO-EC-008 | Apply promo code to non-valid plan | MUST fail with `PROMO_CODE_INVALID_PLAN` error | ✅ Required |
| PROMO-EC-009 | Apply percentage discount > 100% | MUST fail with `INVALID_DISCOUNT_VALUE` error (DB constraint) | ✅ Required |
| PROMO-EC-010 | Apply fixed_amount discount > order total | Discount capped at order total, no negative | ✅ Required |
| PROMO-EC-011 | Combine two non-combinable promo codes | MUST fail with `PROMO_CODES_NOT_COMBINABLE` error | ✅ Required |
| PROMO-EC-012 | Apply same promo code twice to same order | MUST fail with `PROMO_CODE_ALREADY_APPLIED` error | ✅ Required |
| PROMO-EC-013 | Apply promo code exceeding max_uses_per_customer | MUST fail with `PROMO_CODE_CUSTOMER_LIMIT_REACHED` error | ✅ Required |
| PROMO-EC-014 | Deactivate promo code with active usages | Allowed, but existing usages honored | ✅ Required |

**Promo Code Validation Order:**

```typescript
/**
 * Promo Code Validation Order (MUST validate in this order):
 *
 * 1. Code exists and is active
 * 2. Code has not expired (expiresAt)
 * 3. Code has started (startsAt)
 * 4. Code has uses remaining (usedCount < maxUses)
 * 5. Customer eligibility (newCustomersOnly, existingCustomersOnly)
 * 6. Customer has not exceeded maxUsesPerCustomer
 * 7. Plan is in validPlans (if specified)
 * 8. Product/category restrictions (if specified)
 * 9. Order amount meets minimum (minOrderAmount)
 * 10. Combinability check with other applied codes
 *
 * Return FIRST validation that fails (for clear error messages)
 */

const VALIDATION_ORDER = [
  'CODE_EXISTS',
  'CODE_ACTIVE',
  'NOT_EXPIRED',
  'HAS_STARTED',
  'USES_REMAINING',
  'CUSTOMER_ELIGIBILITY',
  'CUSTOMER_USAGE_LIMIT',
  'VALID_PLAN',
  'PRODUCT_RESTRICTIONS',
  'MINIMUM_AMOUNT',
  'COMBINABILITY'
] as const;
```

#### 1.10.5 Timezone and Date Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| TZ-EC-001 | Billing at midnight UTC for UTC-12 customer | Bill at customer's 12:00 noon previous day | ✅ Required |
| TZ-EC-002 | Billing at midnight UTC for UTC+14 customer | Bill at customer's 14:00 same day | ✅ Required |
| TZ-EC-003 | DST transition: 2:00 AM doesn't exist | Use 3:00 AM (skip non-existent hour) | ✅ Required |
| TZ-EC-004 | DST transition: 2:00 AM exists twice | Use first occurrence (earlier UTC) | ✅ Required |
| TZ-EC-005 | Annual subscription starting Feb 29 | Next billing: Feb 28 (non-leap year) or Feb 29 (leap year) | ✅ Required |
| TZ-EC-006 | Monthly subscription starting Jan 31 | Feb billing: Feb 28/29, Mar billing: Mar 31 | ✅ Required |
| TZ-EC-007 | Monthly subscription starting Jan 30 | Feb billing: Feb 28/29, Mar billing: Mar 30 | ✅ Required |
| TZ-EC-008 | Trial ends exactly at DST transition | Use UTC for all internal calculations | ✅ Required |
| TZ-EC-009 | Invoice due_date during DST transition | Store as UTC, display in customer timezone | ✅ Required |
| TZ-EC-010 | Promo code expires at midnight in timezone X | Compare using UTC, document timezone in code config | ✅ Required |

**Date Calculation Rules:**

```typescript
/**
 * Date Calculation Rules (MUST follow):
 *
 * 1. ALL dates stored in UTC (TIMESTAMP WITH TIME ZONE)
 * 2. Billing calculations use UTC midnight
 * 3. Customer-facing dates converted to customer timezone for display only
 * 4. "End of month" means last day of that month
 * 5. Leap year handling: Feb 29 → Feb 28 in non-leap years
 *
 * Monthly Billing Date Rules:
 * - Start day 1-28: Same day each month
 * - Start day 29: 28 in Feb (non-leap), 29 in Feb (leap), 29 otherwise
 * - Start day 30: 28/29 in Feb, 30 otherwise
 * - Start day 31: Last day of each month
 */

function getNextBillingDate(startDate: Date, intervalMonths: number): Date {
  const result = new Date(startDate);
  result.setUTCMonth(result.getUTCMonth() + intervalMonths);

  // Handle end-of-month edge cases
  const originalDay = startDate.getUTCDate();
  const resultMonth = result.getUTCMonth();
  const lastDayOfResultMonth = new Date(
    Date.UTC(result.getUTCFullYear(), resultMonth + 1, 0)
  ).getUTCDate();

  if (originalDay > lastDayOfResultMonth) {
    result.setUTCDate(lastDayOfResultMonth);
  }

  return result;
}
```

**Test Implementation for Timezone:**

```typescript
describe('@edge-case TZ-EC-005: Annual subscription starting Feb 29', () => {
  it('should bill on Feb 28 in non-leap year', async () => {
    const clock = useFakeClock(new Date('2024-02-29T00:00:00Z')); // Leap year

    const subscription = await billing.subscriptions.create({
      customerId: customer.id,
      planId: 'annual',
      billingCycleAnchor: new Date('2024-02-29T00:00:00Z')
    });

    // Advance to Feb 2025 (non-leap year)
    clock.setTime(new Date('2025-02-28T00:00:00Z'));
    await billing.jobs.processSubscriptionRenewals();

    const renewedSub = await billing.subscriptions.get(subscription.id);
    expect(renewedSub.currentPeriodStart.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('should bill on Feb 29 in next leap year', async () => {
    const clock = useFakeClock(new Date('2024-02-29T00:00:00Z'));

    const subscription = await billing.subscriptions.create({
      customerId: customer.id,
      planId: 'annual',
      billingCycleAnchor: new Date('2024-02-29T00:00:00Z')
    });

    // Advance to Feb 2028 (leap year)
    clock.setTime(new Date('2028-02-29T00:00:00Z'));
    await billing.jobs.processSubscriptionRenewals();

    const renewedSub = await billing.subscriptions.get(subscription.id);
    expect(renewedSub.currentPeriodStart.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});
```

#### 1.10.6 Currency and Precision Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| CUR-EC-001 | BTC payment of 0.00000001 | Store with full 8 decimal precision | ✅ Required |
| CUR-EC-002 | ETH payment of 0.000000000000000001 | Round to 8 decimals (DB limit) with warning | ✅ Required |
| CUR-EC-003 | USD payment with > 2 decimals | Round to 2 decimals (currency standard) | ✅ Required |
| CUR-EC-004 | JPY payment with decimals | Round to 0 decimals (JPY has no minor unit) | ✅ Required |
| CUR-EC-005 | Currency conversion USD → EUR | Use stored exchange rate, not live rate | ✅ Required |
| CUR-EC-006 | Currency conversion with stale rate (> 24h) | Fail with `EXCHANGE_RATE_STALE` or use with warning | ✅ Required |
| CUR-EC-007 | Sum of line items ≠ invoice total (rounding) | Recalculate total from line items, don't trust sum | ✅ Required |
| CUR-EC-008 | Refund amount precision loss | Use original currency, same precision as payment | ✅ Required |
| CUR-EC-009 | Display amount in different currency than stored | Convert for display, store in original | ✅ Required |
| CUR-EC-010 | Multi-currency invoice (USD items + EUR items) | MUST fail, single currency per invoice | ✅ Required |

**Currency Precision Rules:**

```typescript
/**
 * Currency Precision Rules (MUST follow):
 *
 * Storage: All amounts stored as DECIMAL(19, 8)
 * Display: Round to currency-specific decimals
 *
 * Currency Decimal Places:
 * - Fiat standard: USD(2), EUR(2), GBP(2), etc.
 * - Zero decimal: JPY(0), KRW(0), VND(0)
 * - Three decimal: KWD(3), BHD(3), OMR(3)
 * - Crypto: BTC(8), ETH(8), stored up to 8 decimals
 */

const CURRENCY_DECIMALS: Record<string, number> = {
  // Fiat - 2 decimals
  USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, CHF: 2, CNY: 2, INR: 2,
  MXN: 2, BRL: 2, ARS: 2, CLP: 0, COP: 2, PEN: 2,

  // Zero decimals
  JPY: 0, KRW: 0, VND: 0,

  // Three decimals
  KWD: 3, BHD: 3, OMR: 3,

  // Crypto - 8 decimals (our max precision)
  BTC: 8, ETH: 8, USDC: 6, USDT: 6
};

function roundToCurrency(amount: number, currency: string): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}
```

#### 1.10.7 Concurrency Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| CONC-EC-001 | Same webhook delivered twice (< 5s apart) | Second delivery returns cached result (idempotent) | ✅ Required |
| CONC-EC-002 | Same webhook delivered twice (> 24h apart) | Process as new event (idempotency expired) | ✅ Required |
| CONC-EC-003 | Webhook A and B for same subscription, B arrives first | Process B, then A (out-of-order handling) | ✅ Required |
| CONC-EC-004 | Customer merge during active transaction | Transaction fails or completes before merge | ✅ Required |
| CONC-EC-005 | Two users set same payment method as default | Last writer wins (no conflict, both valid) | ✅ Required |
| CONC-EC-006 | Subscription cancel and renew at same instant | Cancel wins (explicit action > automated) | ✅ Required |
| CONC-EC-007 | Invoice finalize and void at same instant | First to acquire lock wins | ✅ Required |
| CONC-EC-008 | Database connection lost mid-transaction | Transaction rolled back, retryable error returned | ✅ Required |
| CONC-EC-009 | Provider timeout during payment | Mark as pending, schedule status check | ✅ Required |
| CONC-EC-010 | Bulk operation (1000 invoices) with partial failure | Continue processing, report failures at end | ✅ Required |

**Idempotency Implementation Pattern:**

```typescript
/**
 * Idempotency Implementation Requirements:
 *
 * 1. Client provides idempotency key in header: `Idempotency-Key: <uuid>`
 * 2. Server generates key if not provided: `{operation}_{primaryId}_{timestamp}`
 * 3. Store in Redis/DB: key → { status, result, createdAt }
 * 4. TTL: 24 hours (configurable per operation)
 * 5. On duplicate key:
 *    - If params match: return cached result
 *    - If params differ: return 409 Conflict
 *    - If still processing: return 409 with Retry-After header
 */

interface IdempotencyRecord {
  key: string;
  operationType: string;
  requestHash: string;       // Hash of request params for comparison
  status: 'processing' | 'completed' | 'failed';
  result: unknown | null;
  error: { code: string; message: string } | null;
  createdAt: Date;
  expiresAt: Date;
}

async function withIdempotency<T>(
  key: string,
  requestParams: unknown,
  operation: () => Promise<T>
): Promise<T> {
  const requestHash = hashObject(requestParams);

  // Check for existing record
  const existing = await idempotencyStore.get(key);

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyKeyReusedError(key);
    }

    if (existing.status === 'processing') {
      throw new OperationInProgressError(key, { retryAfterMs: 5000 });
    }

    if (existing.status === 'failed') {
      throw deserializeError(existing.error);
    }

    return existing.result as T;
  }

  // Create processing record
  await idempotencyStore.set(key, {
    key,
    operationType: 'payment',
    requestHash,
    status: 'processing',
    result: null,
    error: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  try {
    const result = await operation();
    await idempotencyStore.update(key, { status: 'completed', result });
    return result;
  } catch (error) {
    await idempotencyStore.update(key, {
      status: 'failed',
      error: serializeError(error)
    });
    throw error;
  }
}
```

#### 1.10.8 Webhook Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| WH-EC-001 | Invalid signature | Return 401, do NOT process, log attempt | ✅ Required |
| WH-EC-002 | Valid signature, malformed JSON | Return 400, log error with raw payload | ✅ Required |
| WH-EC-003 | Valid signature, unknown event type | Return 200 (acknowledge), log for review | ✅ Required |
| WH-EC-004 | Valid event, handler throws error | Return 500, schedule retry | ✅ Required |
| WH-EC-005 | Valid event, handler timeout (> 30s) | Return 500, webhook marked pending | ✅ Required |
| WH-EC-006 | Replay attack (old timestamp) | Reject if timestamp > 5 minutes old | ✅ Required |
| WH-EC-007 | Event for non-existent resource | Log warning, return 200 (don't retry) | ✅ Required |
| WH-EC-008 | Event for deleted customer (soft-deleted) | Process event, update deleted record if needed | ✅ Required |
| WH-EC-009 | Provider sends events out of order | Use event timestamp, not arrival time | ✅ Required |
| WH-EC-010 | Provider retries after our 200 response | Idempotent handling via event_id | ✅ Required |
| WH-EC-011 | Provider sends duplicate event_id | Return 200 immediately (cached) | ✅ Required |
| WH-EC-012 | Webhook endpoint under heavy load | Queue events, process async, return 202 | ✅ Required |

**Webhook Processing Flow:**

```typescript
/**
 * Webhook Processing Flow (MUST follow):
 *
 * 1. Verify signature (provider-specific)
 * 2. Parse payload
 * 3. Check idempotency (event_id)
 * 4. Validate timestamp (reject if > 5 min old)
 * 5. Map to internal event type
 * 6. Check if resource exists
 * 7. Process event
 * 8. Store event record
 * 9. Return 2xx response
 *
 * Error Responses:
 * - 401: Invalid signature
 * - 400: Malformed payload
 * - 500: Processing error (provider will retry)
 * - 200/202: Success (even for unknown events)
 */

interface WebhookProcessingResult {
  acknowledged: boolean;
  processed: boolean;
  eventId: string;
  eventType: string;
  skippedReason?: 'duplicate' | 'unknown_event' | 'resource_not_found';
}
```

#### 1.10.9 Customer Merge Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| MERGE-EC-001 | Merge customer with itself | MUST fail with `CANNOT_MERGE_SELF` error | ✅ Required |
| MERGE-EC-002 | Merge two customers with active subscriptions | Subscriptions handled per `subscription_strategy` | ✅ Required |
| MERGE-EC-003 | Merge during active payment transaction | MUST fail with `TRANSACTION_IN_PROGRESS` error | ✅ Required |
| MERGE-EC-004 | Merge with conflicting default payment methods | Target's default preserved, source's marked non-default | ✅ Required |
| MERGE-EC-005 | Circular merge (A→B→A) | MUST fail with `CIRCULAR_MERGE` error | ✅ Required |
| MERGE-EC-006 | Merge already merged customer (soft-deleted) | MUST fail with `CUSTOMER_ALREADY_MERGED` error | ✅ Required |
| MERGE-EC-007 | Merge with strategy `void_unpaid` and partial payment | Void remaining balance, preserve partial payment | ✅ Required |
| MERGE-EC-008 | Merge large customer (10k+ records) | Process in batches, emit progress events | ✅ Required |
| MERGE-EC-009 | Merge interrupted (server crash) | Transaction rolled back, both customers unchanged | ✅ Required |
| MERGE-EC-010 | Query merged customer by old ID | Return redirect to new customer ID | ✅ Required |

#### 1.10.10 Vendor/Multi-Vendor Edge Cases

| ID | Scenario | Expected Behavior | Test Required |
|----|----------|-------------------|---------------|
| VEND-EC-001 | Order with items from 3 vendors | Create 3 separate payments, 1 platform fee transaction | ✅ Required |
| VEND-EC-002 | Partial refund on multi-vendor order | Proportional refund to each vendor | ✅ Required |
| VEND-EC-003 | Vendor with 0% commission | All payment goes to vendor, no platform fee | ✅ Required |
| VEND-EC-004 | Vendor with 100% commission | All payment goes to platform, vendor gets nothing | ✅ Required |
| VEND-EC-005 | Vendor payout below minimum threshold | Accumulate balance, payout when threshold met | ✅ Required |
| VEND-EC-006 | Vendor account deactivated mid-payout | Cancel payout, notify admin | ✅ Required |
| VEND-EC-007 | Dispute on multi-vendor order | Hold all vendor payouts until resolved | ✅ Required |
| VEND-EC-008 | Vendor changes commission rate mid-period | Apply new rate to future orders only | ✅ Required |
| VEND-EC-009 | Order currency differs from vendor payout currency | Convert at stored exchange rate, document in payout | ✅ Required |
| VEND-EC-010 | Refund after vendor payout already sent | Deduct from next payout or create recovery invoice | ✅ Required |

#### 1.10.11 Required Test Coverage Summary

**Minimum Required Tests per Category:**

| Category | Edge Cases | Required Coverage |
|----------|-----------|-------------------|
| Subscriptions | 15 | 100% |
| Payments | 16 | 100% |
| Invoices | 13 | 100% |
| Promo Codes | 14 | 100% |
| Timezone/Date | 10 | 100% |
| Currency/Precision | 10 | 100% |
| Concurrency | 10 | 100% |
| Webhooks | 12 | 100% |
| Customer Merge | 10 | 100% |
| Vendors | 10 | 100% |
| **TOTAL** | **120** | **100%** |

**Test Naming Convention:**

```typescript
// Pattern: describe('@edge-case {ID}: {description}')
describe('@edge-case SUB-EC-005: Concurrent changePlan calls', () => {
  // Test implementation
});

// This allows filtering edge case tests:
// pnpm test --grep "@edge-case"
// pnpm test --grep "SUB-EC-"
```

**CI/CD Requirements:**

```yaml
# Edge case tests MUST pass before merge
edge-case-tests:
  runs-on: ubuntu-latest
  steps:
    - name: Run edge case tests
      run: pnpm test --grep "@edge-case"

    - name: Verify coverage
      run: |
        EDGE_CASES=$(grep -r "@edge-case" packages --include="*.test.ts" | wc -l)
        if [ "$EDGE_CASES" -lt 120 ]; then
          echo "ERROR: Only $EDGE_CASES edge case tests found, minimum 120 required"
          exit 1
        fi
```

---

### 1.11 Webhook Testing Infrastructure

> **CRITICAL**: Complete webhook testing infrastructure for testing all webhook scenarios without making real provider calls.

#### 1.11.1 WebhookTestHelper Class

```typescript
// File: packages/core/src/testing/webhook-test-helper.ts

import { createHmac } from 'crypto';

/**
 * Configuration for webhook test helper
 */
export interface WebhookTestHelperConfig {
  /** Stripe webhook secret for signature generation */
  stripeWebhookSecret: string;
  /** MercadoPago secret for IPN signature generation */
  mercadoPagoSecret: string;
  /** Base URL for webhook endpoints */
  baseUrl: string;
  /** Default timeout for webhook delivery (ms) */
  defaultTimeout?: number;
}

/**
 * Result of a webhook delivery attempt
 */
export interface WebhookDeliveryResult {
  /** Whether the webhook was successfully processed */
  success: boolean;
  /** HTTP status code returned */
  statusCode: number;
  /** Response body */
  responseBody: unknown;
  /** Time taken to process (ms) */
  processingTimeMs: number;
  /** Error message if failed */
  error?: string;
  /** Number of retries attempted */
  retryCount: number;
}

/**
 * Webhook event for tracking and verification
 */
export interface TrackedWebhookEvent {
  /** Unique event ID */
  eventId: string;
  /** Event type (e.g., 'payment_intent.succeeded') */
  eventType: string;
  /** Provider ('stripe' | 'mercadopago') */
  provider: 'stripe' | 'mercadopago';
  /** Payload sent */
  payload: Record<string, unknown>;
  /** Timestamp when sent */
  sentAt: Date;
  /** Delivery result */
  deliveryResult?: WebhookDeliveryResult;
  /** Whether event was processed (idempotency check) */
  wasProcessed: boolean;
  /** Processing result if processed */
  processingResult?: unknown;
}

/**
 * Main helper class for testing webhooks
 * Provides methods to create, sign, send, and verify webhook events
 */
export class WebhookTestHelper {
  private readonly config: Required<WebhookTestHelperConfig>;
  private readonly trackedEvents: Map<string, TrackedWebhookEvent> = new Map();
  private readonly processedEventIds: Set<string> = new Set();

  constructor(config: WebhookTestHelperConfig) {
    this.config = {
      ...config,
      defaultTimeout: config.defaultTimeout ?? 30000,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STRIPE WEBHOOK SIGNATURE GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate Stripe webhook signature header
   * Matches Stripe's signature format: t=timestamp,v1=signature
   *
   * @param payload - The webhook payload (stringified JSON)
   * @param timestamp - Unix timestamp (optional, defaults to now)
   * @returns The complete Stripe-Signature header value
   *
   * @example
   * const signature = helper.generateStripeSignature(JSON.stringify(payload));
   * // Returns: "t=1609459200,v1=abc123..."
   */
  generateStripeSignature(payload: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payload}`;
    const signature = createHmac('sha256', this.config.stripeWebhookSecret)
      .update(signedPayload)
      .digest('hex');
    return `t=${ts},v1=${signature}`;
  }

  /**
   * Generate an INVALID Stripe signature for testing signature validation
   *
   * @param payload - The webhook payload
   * @param invalidationType - Type of invalidation to apply
   * @returns Invalid signature header
   *
   * @example
   * const badSig = helper.generateInvalidStripeSignature(payload, 'wrong_secret');
   */
  generateInvalidStripeSignature(
    payload: string,
    invalidationType: 'wrong_secret' | 'wrong_timestamp' | 'malformed' | 'missing_v1'
  ): string {
    const ts = Math.floor(Date.now() / 1000);

    switch (invalidationType) {
      case 'wrong_secret': {
        const signature = createHmac('sha256', 'wrong_secret_12345')
          .update(`${ts}.${payload}`)
          .digest('hex');
        return `t=${ts},v1=${signature}`;
      }
      case 'wrong_timestamp': {
        // Timestamp from 10 minutes ago (beyond tolerance)
        const oldTs = ts - 600;
        const signature = createHmac('sha256', this.config.stripeWebhookSecret)
          .update(`${oldTs}.${payload}`)
          .digest('hex');
        return `t=${oldTs},v1=${signature}`;
      }
      case 'malformed':
        return 'invalid_format_no_equals';
      case 'missing_v1':
        return `t=${ts}`;
      default:
        throw new Error(`Unknown invalidation type: ${invalidationType}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MERCADOPAGO IPN SIGNATURE GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate MercadoPago IPN signature
   * Uses HMAC-SHA256 with x-request-id and data.id
   *
   * @param requestId - The x-request-id header value
   * @param dataId - The data.id from the payload
   * @param timestamp - Unix timestamp (optional)
   * @returns Object with all required headers
   *
   * @example
   * const headers = helper.generateMercadoPagoSignature('req_123', 'payment_456');
   */
  generateMercadoPagoSignature(
    requestId: string,
    dataId: string,
    timestamp?: number
  ): {
    'x-request-id': string;
    'x-signature': string;
    'x-signature-timestamp': string;
  } {
    const ts = timestamp?.toString() ?? Date.now().toString();
    // MercadoPago signature template: id:${data.id};request-id:${x-request-id};ts:${ts};
    const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const signature = createHmac('sha256', this.config.mercadoPagoSecret)
      .update(template)
      .digest('hex');

    return {
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${signature}`,
      'x-signature-timestamp': ts,
    };
  }

  /**
   * Generate invalid MercadoPago signature for testing
   */
  generateInvalidMercadoPagoSignature(
    requestId: string,
    dataId: string,
    invalidationType: 'wrong_secret' | 'wrong_timestamp' | 'malformed'
  ): {
    'x-request-id': string;
    'x-signature': string;
    'x-signature-timestamp': string;
  } {
    const ts = Date.now().toString();

    switch (invalidationType) {
      case 'wrong_secret': {
        const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
        const signature = createHmac('sha256', 'wrong_secret')
          .update(template)
          .digest('hex');
        return {
          'x-request-id': requestId,
          'x-signature': `ts=${ts},v1=${signature}`,
          'x-signature-timestamp': ts,
        };
      }
      case 'wrong_timestamp': {
        const oldTs = (Date.now() - 600000).toString();
        const template = `id:${dataId};request-id:${requestId};ts:${oldTs};`;
        const signature = createHmac('sha256', this.config.mercadoPagoSecret)
          .update(template)
          .digest('hex');
        return {
          'x-request-id': requestId,
          'x-signature': `ts=${oldTs},v1=${signature}`,
          'x-signature-timestamp': oldTs,
        };
      }
      case 'malformed':
        return {
          'x-request-id': requestId,
          'x-signature': 'invalid',
          'x-signature-timestamp': ts,
        };
      default:
        throw new Error(`Unknown invalidation type: ${invalidationType}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBHOOK SENDING AND TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a webhook and track the result
   *
   * @param event - Webhook event to send
   * @param options - Delivery options
   * @returns Delivery result with timing and response info
   */
  async sendWebhook(
    event: Omit<TrackedWebhookEvent, 'sentAt' | 'deliveryResult' | 'wasProcessed' | 'processingResult'>,
    options: {
      /** Custom endpoint path (appended to baseUrl) */
      endpoint?: string;
      /** Custom headers to include */
      headers?: Record<string, string>;
      /** Timeout override (ms) */
      timeout?: number;
      /** Whether to track this event */
      track?: boolean;
    } = {}
  ): Promise<WebhookDeliveryResult> {
    const { endpoint, headers = {}, timeout = this.config.defaultTimeout, track = true } = options;

    const trackedEvent: TrackedWebhookEvent = {
      ...event,
      sentAt: new Date(),
      wasProcessed: false,
    };

    if (track) {
      this.trackedEvents.set(event.eventId, trackedEvent);
    }

    const startTime = Date.now();
    let retryCount = 0;

    // Generate provider-specific signature
    const signatureHeaders = this.getSignatureHeaders(event);

    const url = endpoint
      ? `${this.config.baseUrl}${endpoint}`
      : `${this.config.baseUrl}/webhooks/${event.provider}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...signatureHeaders,
          ...headers,
        },
        body: JSON.stringify(event.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const processingTimeMs = Date.now() - startTime;
      let responseBody: unknown;

      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }

      const result: WebhookDeliveryResult = {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        processingTimeMs,
        retryCount,
      };

      if (track) {
        trackedEvent.deliveryResult = result;
        trackedEvent.wasProcessed = response.ok;
        this.trackedEvents.set(event.eventId, trackedEvent);

        if (response.ok) {
          this.processedEventIds.add(event.eventId);
        }
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const processingTimeMs = Date.now() - startTime;

      return {
        success: false,
        statusCode: 0,
        responseBody: null,
        processingTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount,
      };
    }
  }

  /**
   * Send webhook with automatic retries (simulates provider retry behavior)
   */
  async sendWebhookWithRetries(
    event: Omit<TrackedWebhookEvent, 'sentAt' | 'deliveryResult' | 'wasProcessed' | 'processingResult'>,
    options: {
      maxRetries?: number;
      retryDelayMs?: number;
      endpoint?: string;
    } = {}
  ): Promise<WebhookDeliveryResult> {
    const { maxRetries = 3, retryDelayMs = 100, endpoint } = options;

    let lastResult: WebhookDeliveryResult | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await this.sendWebhook(event, {
        endpoint,
        track: attempt === 0, // Only track first attempt
      });

      if (lastResult.success) {
        lastResult.retryCount = retryCount;
        return lastResult;
      }

      // Check if error is retryable (5xx errors)
      if (lastResult.statusCode >= 500 && lastResult.statusCode < 600) {
        retryCount++;
        if (attempt < maxRetries) {
          await this.sleep(retryDelayMs * Math.pow(2, attempt)); // Exponential backoff
        }
      } else {
        // Non-retryable error (4xx)
        break;
      }
    }

    lastResult!.retryCount = retryCount;
    return lastResult!;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VERIFICATION METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if an event was processed (for idempotency testing)
   */
  wasEventProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  /**
   * Get tracked event details
   */
  getTrackedEvent(eventId: string): TrackedWebhookEvent | undefined {
    return this.trackedEvents.get(eventId);
  }

  /**
   * Get all tracked events
   */
  getAllTrackedEvents(): TrackedWebhookEvent[] {
    return Array.from(this.trackedEvents.values());
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string): TrackedWebhookEvent[] {
    return this.getAllTrackedEvents().filter(e => e.eventType === eventType);
  }

  /**
   * Clear all tracked events (call in afterEach)
   */
  clearTrackedEvents(): void {
    this.trackedEvents.clear();
    this.processedEventIds.clear();
  }

  /**
   * Assert that an event was processed successfully
   */
  assertEventProcessed(eventId: string): void {
    const event = this.trackedEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    if (!event.wasProcessed) {
      throw new Error(
        `Event ${eventId} was not processed. ` +
        `Status: ${event.deliveryResult?.statusCode}, ` +
        `Error: ${event.deliveryResult?.error}`
      );
    }
  }

  /**
   * Assert that an event was rejected
   */
  assertEventRejected(eventId: string, expectedStatusCode?: number): void {
    const event = this.trackedEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    if (event.wasProcessed) {
      throw new Error(`Event ${eventId} was unexpectedly processed`);
    }
    if (expectedStatusCode && event.deliveryResult?.statusCode !== expectedStatusCode) {
      throw new Error(
        `Expected status ${expectedStatusCode}, got ${event.deliveryResult?.statusCode}`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private getSignatureHeaders(
    event: Pick<TrackedWebhookEvent, 'provider' | 'eventId' | 'payload'>
  ): Record<string, string> {
    if (event.provider === 'stripe') {
      return {
        'Stripe-Signature': this.generateStripeSignature(JSON.stringify(event.payload)),
      };
    }

    if (event.provider === 'mercadopago') {
      const dataId = (event.payload as { data?: { id?: string } }).data?.id ?? event.eventId;
      const headers = this.generateMercadoPagoSignature(event.eventId, dataId);
      return headers;
    }

    return {};
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 1.11.2 Stripe Webhook Factory

```typescript
// File: packages/core/src/testing/factories/stripe-webhook.factory.ts

import { randomUUID } from 'crypto';

/**
 * Stripe event types supported by qzpay
 */
export const STRIPE_EVENT_TYPES = {
  // Payment events
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  PAYMENT_INTENT_CANCELED: 'payment_intent.canceled',
  PAYMENT_INTENT_PROCESSING: 'payment_intent.processing',
  PAYMENT_INTENT_REQUIRES_ACTION: 'payment_intent.requires_action',

  // Charge events
  CHARGE_SUCCEEDED: 'charge.succeeded',
  CHARGE_FAILED: 'charge.failed',
  CHARGE_REFUNDED: 'charge.refunded',
  CHARGE_DISPUTE_CREATED: 'charge.dispute.created',
  CHARGE_DISPUTE_CLOSED: 'charge.dispute.closed',

  // Subscription events
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
  SUBSCRIPTION_PENDING_UPDATE_APPLIED: 'customer.subscription.pending_update_applied',
  SUBSCRIPTION_PENDING_UPDATE_EXPIRED: 'customer.subscription.pending_update_expired',

  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_UPCOMING: 'invoice.upcoming',
  INVOICE_MARKED_UNCOLLECTIBLE: 'invoice.marked_uncollectible',
  INVOICE_VOIDED: 'invoice.voided',

  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',

  // Payment method events
  PAYMENT_METHOD_ATTACHED: 'payment_method.attached',
  PAYMENT_METHOD_DETACHED: 'payment_method.detached',
  PAYMENT_METHOD_UPDATED: 'payment_method.updated',

  // Checkout events
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CHECKOUT_SESSION_EXPIRED: 'checkout.session.expired',

  // Payout events (for marketplace)
  PAYOUT_CREATED: 'payout.created',
  PAYOUT_PAID: 'payout.paid',
  PAYOUT_FAILED: 'payout.failed',

  // Account events (for Connect)
  ACCOUNT_UPDATED: 'account.updated',
} as const;

export type StripeEventType = (typeof STRIPE_EVENT_TYPES)[keyof typeof STRIPE_EVENT_TYPES];

/**
 * Base Stripe event structure
 */
export interface StripeEvent<T = unknown> {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: T;
    previous_attributes?: Partial<T>;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: StripeEventType;
}

/**
 * Options for creating Stripe webhook events
 */
export interface CreateStripeWebhookOptions<T> {
  /** Event type */
  type: StripeEventType;
  /** Event data object */
  data: T;
  /** Previous attributes (for update events) */
  previousAttributes?: Partial<T>;
  /** Event ID (auto-generated if not provided) */
  eventId?: string;
  /** Whether this is live mode */
  livemode?: boolean;
  /** API version */
  apiVersion?: string;
  /** Creation timestamp (Unix) */
  created?: number;
}

/**
 * Factory for creating Stripe webhook test events
 */
export class StripeWebhookFactory {
  private readonly defaultApiVersion = '2024-06-20';

  /**
   * Create a generic Stripe webhook event
   */
  createEvent<T>(options: CreateStripeWebhookOptions<T>): StripeEvent<T> {
    const {
      type,
      data,
      previousAttributes,
      eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      livemode = false,
      apiVersion = this.defaultApiVersion,
      created = Math.floor(Date.now() / 1000),
    } = options;

    const event: StripeEvent<T> = {
      id: eventId,
      object: 'event',
      api_version: apiVersion,
      created,
      data: {
        object: data,
      },
      livemode,
      pending_webhooks: 1,
      request: {
        id: `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        idempotency_key: null,
      },
      type,
    };

    if (previousAttributes) {
      event.data.previous_attributes = previousAttributes;
    }

    return event;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT INTENT EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create payment_intent.succeeded event
   */
  createPaymentIntentSucceeded(options: {
    paymentIntentId?: string;
    amount: number;
    currency: string;
    customerId?: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      paymentIntentId = `pi_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      amount,
      currency,
      customerId,
      metadata = {},
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.PAYMENT_INTENT_SUCCEEDED,
      data: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount,
        amount_received: amount,
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata,
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  /**
   * Create payment_intent.payment_failed event
   */
  createPaymentIntentFailed(options: {
    paymentIntentId?: string;
    amount: number;
    currency: string;
    customerId?: string;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      paymentIntentId = `pi_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      amount,
      currency,
      customerId,
      errorCode = 'card_declined',
      errorMessage = 'Your card was declined.',
      metadata = {},
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.PAYMENT_INTENT_FAILED,
      data: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount,
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata,
        status: 'requires_payment_method',
        last_payment_error: {
          code: errorCode,
          message: errorMessage,
          type: 'card_error',
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTION EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create customer.subscription.created event
   */
  createSubscriptionCreated(options: {
    subscriptionId?: string;
    customerId: string;
    priceId: string;
    status?: 'active' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'canceled' | 'unpaid';
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    trialEnd?: number | null;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      subscriptionId = `sub_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      priceId,
      status = 'active',
      currentPeriodStart = Math.floor(Date.now() / 1000),
      currentPeriodEnd = currentPeriodStart + 30 * 24 * 60 * 60,
      trialEnd = null,
      metadata = {},
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.SUBSCRIPTION_CREATED,
      data: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        trial_end: trialEnd,
        items: {
          object: 'list',
          data: [
            {
              id: `si_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
              object: 'subscription_item',
              price: {
                id: priceId,
                object: 'price',
              },
            },
          ],
        },
        metadata,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  /**
   * Create customer.subscription.updated event
   */
  createSubscriptionUpdated(options: {
    subscriptionId?: string;
    customerId: string;
    priceId: string;
    status: string;
    previousStatus?: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      subscriptionId = `sub_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      priceId,
      status,
      previousStatus,
      metadata = {},
    } = options;

    const now = Math.floor(Date.now() / 1000);

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.SUBSCRIPTION_UPDATED,
      data: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status,
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        items: {
          object: 'list',
          data: [
            {
              id: `si_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
              object: 'subscription_item',
              price: { id: priceId, object: 'price' },
            },
          ],
        },
        metadata,
        created: now,
        livemode: false,
      },
      previousAttributes: previousStatus ? { status: previousStatus } : undefined,
    });
  }

  /**
   * Create customer.subscription.deleted event
   */
  createSubscriptionDeleted(options: {
    subscriptionId?: string;
    customerId: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      subscriptionId = `sub_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      metadata = {},
    } = options;

    const now = Math.floor(Date.now() / 1000);

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.SUBSCRIPTION_DELETED,
      data: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
        canceled_at: now,
        ended_at: now,
        current_period_end: now,
        metadata,
        created: now - 30 * 24 * 60 * 60,
        livemode: false,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVOICE EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create invoice.paid event
   */
  createInvoicePaid(options: {
    invoiceId?: string;
    customerId: string;
    subscriptionId?: string;
    amountPaid: number;
    currency: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      invoiceId = `in_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      subscriptionId,
      amountPaid,
      currency,
      metadata = {},
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.INVOICE_PAID,
      data: {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: amountPaid,
        amount_due: amountPaid,
        currency: currency.toLowerCase(),
        status: 'paid',
        paid: true,
        metadata,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  /**
   * Create invoice.payment_failed event
   */
  createInvoicePaymentFailed(options: {
    invoiceId?: string;
    customerId: string;
    subscriptionId?: string;
    amountDue: number;
    currency: string;
    attemptCount?: number;
    nextPaymentAttempt?: number | null;
  }): StripeEvent {
    const {
      invoiceId = `in_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      subscriptionId,
      amountDue,
      currency,
      attemptCount = 1,
      nextPaymentAttempt = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.INVOICE_PAYMENT_FAILED,
      data: {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: 0,
        amount_due: amountDue,
        currency: currency.toLowerCase(),
        status: 'open',
        paid: false,
        attempt_count: attemptCount,
        next_payment_attempt: nextPaymentAttempt,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHARGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create charge.refunded event
   */
  createChargeRefunded(options: {
    chargeId?: string;
    paymentIntentId?: string;
    amount: number;
    amountRefunded: number;
    currency: string;
    customerId?: string;
    refundId?: string;
  }): StripeEvent {
    const {
      chargeId = `ch_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      paymentIntentId,
      amount,
      amountRefunded,
      currency,
      customerId,
      refundId = `re_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.CHARGE_REFUNDED,
      data: {
        id: chargeId,
        object: 'charge',
        amount,
        amount_refunded: amountRefunded,
        currency: currency.toLowerCase(),
        customer: customerId,
        payment_intent: paymentIntentId,
        refunded: amountRefunded === amount,
        refunds: {
          object: 'list',
          data: [
            {
              id: refundId,
              object: 'refund',
              amount: amountRefunded,
              status: 'succeeded',
            },
          ],
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  /**
   * Create charge.dispute.created event
   */
  createDisputeCreated(options: {
    disputeId?: string;
    chargeId: string;
    amount: number;
    currency: string;
    reason?: string;
    status?: 'warning_needs_response' | 'needs_response' | 'under_review' | 'won' | 'lost';
  }): StripeEvent {
    const {
      disputeId = `dp_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      chargeId,
      amount,
      currency,
      reason = 'fraudulent',
      status = 'needs_response',
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.CHARGE_DISPUTE_CREATED,
      data: {
        id: disputeId,
        object: 'dispute',
        charge: chargeId,
        amount,
        currency: currency.toLowerCase(),
        reason,
        status,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECKOUT EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create checkout.session.completed event
   */
  createCheckoutSessionCompleted(options: {
    sessionId?: string;
    customerId: string;
    mode: 'payment' | 'subscription' | 'setup';
    paymentIntentId?: string;
    subscriptionId?: string;
    amountTotal?: number;
    currency?: string;
    metadata?: Record<string, string>;
  }): StripeEvent {
    const {
      sessionId = `cs_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      customerId,
      mode,
      paymentIntentId,
      subscriptionId,
      amountTotal,
      currency = 'usd',
      metadata = {},
    } = options;

    return this.createEvent({
      type: STRIPE_EVENT_TYPES.CHECKOUT_SESSION_COMPLETED,
      data: {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        mode,
        payment_intent: paymentIntentId,
        subscription: subscriptionId,
        amount_total: amountTotal,
        currency: currency.toLowerCase(),
        payment_status: 'paid',
        status: 'complete',
        metadata,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      },
    });
  }
}

// Export singleton instance for convenience
export const stripeWebhookFactory = new StripeWebhookFactory();
```

#### 1.11.3 MercadoPago IPN Factory

```typescript
// File: packages/core/src/testing/factories/mercadopago-webhook.factory.ts

import { randomUUID } from 'crypto';

/**
 * MercadoPago notification types
 */
export const MERCADOPAGO_EVENT_TYPES = {
  // Payment notifications
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_UPDATED: 'payment.updated',

  // Subscription (preapproval) notifications
  SUBSCRIPTION_PREAPPROVAL: 'subscription_preapproval',
  SUBSCRIPTION_AUTHORIZED_PAYMENT: 'subscription_authorized_payment',

  // Plan notifications
  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',

  // Point of sale
  POINT_INTEGRATION_WH: 'point_integration_wh',

  // Chargebacks
  CHARGEBACKS: 'chargebacks',

  // Merchant orders
  MERCHANT_ORDER: 'merchant_order',

  // Topic-based (legacy)
  TOPIC_PAYMENT: 'payment',
  TOPIC_SUBSCRIPTION: 'subscription_preapproval',
  TOPIC_MERCHANT_ORDER: 'merchant_order',
} as const;

export type MercadoPagoEventType = (typeof MERCADOPAGO_EVENT_TYPES)[keyof typeof MERCADOPAGO_EVENT_TYPES];

/**
 * MercadoPago IPN notification structure
 */
export interface MercadoPagoNotification {
  id: number;
  live_mode: boolean;
  type: MercadoPagoEventType;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

/**
 * MercadoPago payment status values
 */
export const MERCADOPAGO_PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  AUTHORIZED: 'authorized',
  IN_PROCESS: 'in_process',
  IN_MEDIATION: 'in_mediation',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHARGED_BACK: 'charged_back',
} as const;

/**
 * MercadoPago payment status detail values
 */
export const MERCADOPAGO_STATUS_DETAIL = {
  // Approved
  ACCREDITED: 'accredited',
  // Pending
  PENDING_CONTINGENCY: 'pending_contingency',
  PENDING_REVIEW_MANUAL: 'pending_review_manual',
  PENDING_WAITING_PAYMENT: 'pending_waiting_payment',
  // Rejected
  CC_REJECTED_BAD_FILLED_CARD_NUMBER: 'cc_rejected_bad_filled_card_number',
  CC_REJECTED_BAD_FILLED_DATE: 'cc_rejected_bad_filled_date',
  CC_REJECTED_BAD_FILLED_OTHER: 'cc_rejected_bad_filled_other',
  CC_REJECTED_BAD_FILLED_SECURITY_CODE: 'cc_rejected_bad_filled_security_code',
  CC_REJECTED_BLACKLIST: 'cc_rejected_blacklist',
  CC_REJECTED_CALL_FOR_AUTHORIZE: 'cc_rejected_call_for_authorize',
  CC_REJECTED_CARD_DISABLED: 'cc_rejected_card_disabled',
  CC_REJECTED_DUPLICATED_PAYMENT: 'cc_rejected_duplicated_payment',
  CC_REJECTED_HIGH_RISK: 'cc_rejected_high_risk',
  CC_REJECTED_INSUFFICIENT_AMOUNT: 'cc_rejected_insufficient_amount',
  CC_REJECTED_INVALID_INSTALLMENTS: 'cc_rejected_invalid_installments',
  CC_REJECTED_MAX_ATTEMPTS: 'cc_rejected_max_attempts',
  CC_REJECTED_OTHER_REASON: 'cc_rejected_other_reason',
} as const;

/**
 * Full payment object (returned when fetching payment details)
 */
export interface MercadoPagoPayment {
  id: number;
  date_created: string;
  date_approved: string | null;
  date_last_updated: string;
  money_release_date: string | null;
  payment_method_id: string;
  payment_type_id: string;
  status: (typeof MERCADOPAGO_PAYMENT_STATUS)[keyof typeof MERCADOPAGO_PAYMENT_STATUS];
  status_detail: string;
  currency_id: string;
  description: string;
  collector_id: number;
  payer: {
    id: number;
    email: string;
    identification: {
      type: string;
      number: string;
    };
  };
  metadata: Record<string, unknown>;
  additional_info: Record<string, unknown>;
  transaction_amount: number;
  transaction_amount_refunded: number;
  coupon_amount: number;
  transaction_details: {
    net_received_amount: number;
    total_paid_amount: number;
    overpaid_amount: number;
    installment_amount: number;
  };
  installments: number;
  card: {
    first_six_digits: string;
    last_four_digits: string;
    expiration_month: number;
    expiration_year: number;
    date_created: string;
    cardholder: {
      name: string;
    };
  } | null;
  external_reference: string | null;
  order: {
    id: string;
    type: string;
  } | null;
}

/**
 * Factory for creating MercadoPago webhook test events
 */
export class MercadoPagoWebhookFactory {
  private readonly apiVersion = 'v1';
  private notificationCounter = 0;

  /**
   * Create a generic MercadoPago IPN notification
   */
  createNotification(options: {
    type: MercadoPagoEventType;
    dataId: string;
    action?: string;
    userId?: number;
    liveMode?: boolean;
  }): MercadoPagoNotification {
    const {
      type,
      dataId,
      action = 'payment.created',
      userId = 123456789,
      liveMode = false,
    } = options;

    this.notificationCounter++;

    return {
      id: this.notificationCounter,
      live_mode: liveMode,
      type,
      date_created: new Date().toISOString(),
      user_id: userId,
      api_version: this.apiVersion,
      action,
      data: {
        id: dataId,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create payment.created notification
   */
  createPaymentCreatedNotification(paymentId: string | number): MercadoPagoNotification {
    return this.createNotification({
      type: MERCADOPAGO_EVENT_TYPES.PAYMENT_CREATED,
      dataId: paymentId.toString(),
      action: 'payment.created',
    });
  }

  /**
   * Create payment.updated notification
   */
  createPaymentUpdatedNotification(paymentId: string | number): MercadoPagoNotification {
    return this.createNotification({
      type: MERCADOPAGO_EVENT_TYPES.PAYMENT_UPDATED,
      dataId: paymentId.toString(),
      action: 'payment.updated',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT OBJECTS (for mock API responses)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a full payment object (as returned by GET /v1/payments/:id)
   */
  createPayment(options: {
    id?: number;
    status: (typeof MERCADOPAGO_PAYMENT_STATUS)[keyof typeof MERCADOPAGO_PAYMENT_STATUS];
    statusDetail?: string;
    amount: number;
    currency?: string;
    payerEmail?: string;
    externalReference?: string;
    metadata?: Record<string, unknown>;
    description?: string;
    paymentMethodId?: string;
  }): MercadoPagoPayment {
    const {
      id = Math.floor(Math.random() * 1000000000),
      status,
      statusDetail = status === 'approved' ? 'accredited' : 'pending_contingency',
      amount,
      currency = 'ARS',
      payerEmail = 'test@example.com',
      externalReference = null,
      metadata = {},
      description = 'Test payment',
      paymentMethodId = 'visa',
    } = options;

    const now = new Date().toISOString();

    return {
      id,
      date_created: now,
      date_approved: status === 'approved' ? now : null,
      date_last_updated: now,
      money_release_date: status === 'approved' ? now : null,
      payment_method_id: paymentMethodId,
      payment_type_id: 'credit_card',
      status,
      status_detail: statusDetail,
      currency_id: currency,
      description,
      collector_id: 123456789,
      payer: {
        id: 987654321,
        email: payerEmail,
        identification: {
          type: 'DNI',
          number: '12345678',
        },
      },
      metadata,
      additional_info: {},
      transaction_amount: amount,
      transaction_amount_refunded: 0,
      coupon_amount: 0,
      transaction_details: {
        net_received_amount: amount * 0.95, // 5% fee
        total_paid_amount: amount,
        overpaid_amount: 0,
        installment_amount: amount,
      },
      installments: 1,
      card: {
        first_six_digits: '450995',
        last_four_digits: '3704',
        expiration_month: 12,
        expiration_year: 2025,
        date_created: now,
        cardholder: {
          name: 'APRO',
        },
      },
      external_reference: externalReference,
      order: null,
    };
  }

  /**
   * Create an approved payment
   */
  createApprovedPayment(options: {
    id?: number;
    amount: number;
    currency?: string;
    externalReference?: string;
    metadata?: Record<string, unknown>;
  }): MercadoPagoPayment {
    return this.createPayment({
      ...options,
      status: MERCADOPAGO_PAYMENT_STATUS.APPROVED,
      statusDetail: MERCADOPAGO_STATUS_DETAIL.ACCREDITED,
    });
  }

  /**
   * Create a rejected payment
   */
  createRejectedPayment(options: {
    id?: number;
    amount: number;
    currency?: string;
    rejectionReason?: keyof typeof MERCADOPAGO_STATUS_DETAIL;
    externalReference?: string;
  }): MercadoPagoPayment {
    const { rejectionReason = 'CC_REJECTED_INSUFFICIENT_AMOUNT', ...rest } = options;

    return this.createPayment({
      ...rest,
      status: MERCADOPAGO_PAYMENT_STATUS.REJECTED,
      statusDetail: MERCADOPAGO_STATUS_DETAIL[rejectionReason],
    });
  }

  /**
   * Create a pending payment
   */
  createPendingPayment(options: {
    id?: number;
    amount: number;
    currency?: string;
    externalReference?: string;
  }): MercadoPagoPayment {
    return this.createPayment({
      ...options,
      status: MERCADOPAGO_PAYMENT_STATUS.PENDING,
      statusDetail: MERCADOPAGO_STATUS_DETAIL.PENDING_CONTINGENCY,
    });
  }

  /**
   * Create a refunded payment
   */
  createRefundedPayment(options: {
    id?: number;
    amount: number;
    amountRefunded?: number;
    currency?: string;
    externalReference?: string;
  }): MercadoPagoPayment {
    const { amountRefunded = options.amount, ...rest } = options;

    const payment = this.createPayment({
      ...rest,
      status: MERCADOPAGO_PAYMENT_STATUS.REFUNDED,
      statusDetail: 'refunded',
    });

    payment.transaction_amount_refunded = amountRefunded;

    return payment;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTION NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create subscription_preapproval notification
   */
  createSubscriptionNotification(preapprovalId: string): MercadoPagoNotification {
    return this.createNotification({
      type: MERCADOPAGO_EVENT_TYPES.SUBSCRIPTION_PREAPPROVAL,
      dataId: preapprovalId,
      action: 'updated',
    });
  }

  /**
   * Create subscription_authorized_payment notification
   */
  createSubscriptionPaymentNotification(paymentId: string): MercadoPagoNotification {
    return this.createNotification({
      type: MERCADOPAGO_EVENT_TYPES.SUBSCRIPTION_AUTHORIZED_PAYMENT,
      dataId: paymentId,
      action: 'created',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHARGEBACK NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create chargebacks notification
   */
  createChargebackNotification(chargebackId: string): MercadoPagoNotification {
    return this.createNotification({
      type: MERCADOPAGO_EVENT_TYPES.CHARGEBACKS,
      dataId: chargebackId,
      action: 'created',
    });
  }
}

// Export singleton instance for convenience
export const mercadoPagoWebhookFactory = new MercadoPagoWebhookFactory();
```

#### 1.11.4 Webhook Test Scenarios

> **Reference**: Edge cases WH-EC-001 through WH-EC-012 from Section 1.10.8

| Scenario ID | Category | Description | Test Method | Expected Result |
|-------------|----------|-------------|-------------|-----------------|
| WH-TEST-001 | Signature | Valid Stripe signature | `helper.sendWebhook()` with factory event | 200 OK, event processed |
| WH-TEST-002 | Signature | Invalid Stripe signature (wrong secret) | `generateInvalidStripeSignature('wrong_secret')` | 401 Unauthorized |
| WH-TEST-003 | Signature | Expired Stripe signature (>5 min old) | `generateInvalidStripeSignature('wrong_timestamp')` | 401 Unauthorized |
| WH-TEST-004 | Signature | Malformed Stripe signature | `generateInvalidStripeSignature('malformed')` | 400 Bad Request |
| WH-TEST-005 | Signature | Valid MercadoPago signature | `generateMercadoPagoSignature()` | 200 OK, event processed |
| WH-TEST-006 | Signature | Invalid MercadoPago signature | `generateInvalidMercadoPagoSignature('wrong_secret')` | 401 Unauthorized |
| WH-TEST-007 | Idempotency | Duplicate event (same ID) | Send same event twice | First: 200, Second: 200 (already processed) |
| WH-TEST-008 | Idempotency | Duplicate within 24 hours | Send same ID after 12 hours | 200 (idempotent response) |
| WH-TEST-009 | Idempotency | Duplicate after 24+ hours | Send same ID after TTL expires | 200 (reprocessed) |
| WH-TEST-010 | Out-of-order | payment_intent.succeeded before created | Send events out of order | Both succeed, state consistent |
| WH-TEST-011 | Out-of-order | Subscription update before create | Send update before create | Queue update, process after create |
| WH-TEST-012 | Out-of-order | Invoice paid before finalized | Send events out of order | State reconciled correctly |
| WH-TEST-013 | Retry | Temporary failure (500) | Return 500, then 200 | Retry succeeds |
| WH-TEST-014 | Retry | Permanent failure (400) | Return 400 | No retry, logged as error |
| WH-TEST-015 | Retry | Timeout on first attempt | Delay response > timeout | Retry succeeds |
| WH-TEST-016 | Retry | Exponential backoff | Track retry timing | Delays increase exponentially |
| WH-TEST-017 | Unknown | Unknown event type | Send unknown event type | 200 OK, logged, not processed |
| WH-TEST-018 | Unknown | Unknown provider | Send with wrong endpoint | 404 or 400 |
| WH-TEST-019 | Replay | Replay attack (old event) | Send event with old timestamp | 401 Unauthorized |
| WH-TEST-020 | Concurrent | Concurrent same event | Send same event in parallel | One succeeds, one returns idempotent |
| WH-TEST-021 | Recovery | Webhook endpoint down | Queue events, recover | All events processed on recovery |
| WH-TEST-022 | State | Payment creates invoice | Send payment succeeded | Invoice created automatically |
| WH-TEST-023 | State | Subscription syncs status | Send subscription updated | Local status matches webhook |
| WH-TEST-024 | State | Refund updates payment | Send charge.refunded | Payment status = refunded |

#### 1.11.5 Complete Test Implementation Examples

```typescript
// File: packages/core/tests/integration/webhooks/stripe-webhooks.test.ts

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { WebhookTestHelper } from '../../../src/testing/webhook-test-helper';
import { stripeWebhookFactory } from '../../../src/testing/factories/stripe-webhook.factory';
import { createQZPayBilling } from '../../../src';
import { createTestDatabase } from '../../utils/test-database';

describe('Stripe Webhook Processing', () => {
  let helper: WebhookTestHelper;
  let billing: ReturnType<typeof createQZPayBilling>;
  let db: ReturnType<typeof createTestDatabase>;

  beforeAll(async () => {
    db = createTestDatabase();
    await db.setup();

    billing = createQZPayBilling({
      storage: db.adapter,
      providers: {
        stripe: {
          secretKey: 'sk_test_123',
          webhookSecret: 'whsec_test_secret',
        },
      },
    });

    helper = new WebhookTestHelper({
      stripeWebhookSecret: 'whsec_test_secret',
      mercadoPagoSecret: 'mp_test_secret',
      baseUrl: 'http://localhost:3000',
    });
  });

  beforeEach(async () => {
    await db.truncateAll();
    helper.clearTrackedEvents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-001 to WH-TEST-004: Signature Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-001: Signature validation', () => {
    it('WH-TEST-001: should accept valid Stripe signature', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
        customerId: 'cus_123',
        metadata: { orderId: 'order_123' },
      });

      // Act
      const result = await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      helper.assertEventProcessed(event.id);
    });

    it('WH-TEST-002: should reject invalid Stripe signature (wrong secret)', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });
      const invalidSignature = helper.generateInvalidStripeSignature(
        JSON.stringify(event),
        'wrong_secret'
      );

      // Act
      const result = await helper.sendWebhook(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        {
          headers: {
            'Stripe-Signature': invalidSignature,
          },
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      helper.assertEventRejected(event.id, 401);
    });

    it('WH-TEST-003: should reject expired Stripe signature', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });
      const expiredSignature = helper.generateInvalidStripeSignature(
        JSON.stringify(event),
        'wrong_timestamp'
      );

      // Act
      const result = await helper.sendWebhook(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        {
          headers: {
            'Stripe-Signature': expiredSignature,
          },
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('WH-TEST-004: should reject malformed Stripe signature', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });
      const malformedSignature = helper.generateInvalidStripeSignature(
        JSON.stringify(event),
        'malformed'
      );

      // Act
      const result = await helper.sendWebhook(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        {
          headers: {
            'Stripe-Signature': malformedSignature,
          },
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-007 to WH-TEST-009: Idempotency
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-002: Idempotency', () => {
    it('WH-TEST-007: should handle duplicate events (same ID)', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
        customerId: 'cus_123',
      });

      // Act - Send first time
      const result1 = await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Act - Send second time (duplicate)
      const result2 = await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result1.statusCode).toBe(200);
      expect(result2.success).toBe(true);
      expect(result2.statusCode).toBe(200);

      // Verify only processed once
      const events = helper.getEventsByType(event.type);
      const processedCount = events.filter(e => e.wasProcessed).length;
      expect(processedCount).toBe(1); // Only first was actually processed
    });

    it('WH-TEST-020: should handle concurrent duplicate events', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
        customerId: 'cus_123',
      });

      // Act - Send both in parallel
      const [result1, result2] = await Promise.all([
        helper.sendWebhook({
          eventId: `${event.id}_1`,
          eventType: event.type,
          provider: 'stripe',
          payload: { ...event, id: `${event.id}_dup` },
        }),
        helper.sendWebhook({
          eventId: `${event.id}_2`,
          eventType: event.type,
          provider: 'stripe',
          payload: { ...event, id: `${event.id}_dup` },
        }),
      ]);

      // Assert - Both should return 200, but only one processes
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify payment was only created once
      const payments = await billing.payments.list({ customerId: 'cus_123' });
      expect(payments.data.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-010 to WH-TEST-012: Out-of-Order Processing
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-003: Out-of-order events', () => {
    it('WH-TEST-010: should handle payment succeeded before created', async () => {
      // Arrange
      const customerId = 'cus_out_of_order';
      await billing.customers.create({
        id: customerId,
        email: 'test@example.com',
        name: 'Test Customer',
      });

      const paymentIntentId = `pi_${Date.now()}`;

      const succeededEvent = stripeWebhookFactory.createPaymentIntentSucceeded({
        paymentIntentId,
        amount: 10000,
        currency: 'usd',
        customerId,
      });

      // Act - Send succeeded event (normally comes after created)
      const result = await helper.sendWebhook({
        eventId: succeededEvent.id,
        eventType: succeededEvent.type,
        provider: 'stripe',
        payload: succeededEvent,
      });

      // Assert
      expect(result.success).toBe(true);

      // Verify payment was created and status is succeeded
      const payment = await billing.payments.getByExternalId(paymentIntentId);
      expect(payment).not.toBeNull();
      expect(payment!.status).toBe('succeeded');
    });

    it('WH-TEST-011: should reconcile subscription events received out of order', async () => {
      // Arrange
      const customerId = 'cus_sub_order';
      await billing.customers.create({
        id: customerId,
        email: 'test@example.com',
        name: 'Test Customer',
      });

      const subscriptionId = `sub_${Date.now()}`;

      const updatedEvent = stripeWebhookFactory.createSubscriptionUpdated({
        subscriptionId,
        customerId,
        priceId: 'price_premium',
        status: 'active',
        previousStatus: 'trialing',
      });

      const createdEvent = stripeWebhookFactory.createSubscriptionCreated({
        subscriptionId,
        customerId,
        priceId: 'price_basic',
        status: 'trialing',
      });

      // Act - Send updated BEFORE created
      await helper.sendWebhook({
        eventId: updatedEvent.id,
        eventType: updatedEvent.type,
        provider: 'stripe',
        payload: updatedEvent,
      });

      await helper.sendWebhook({
        eventId: createdEvent.id,
        eventType: createdEvent.type,
        provider: 'stripe',
        payload: createdEvent,
      });

      // Assert - Final state should reflect the most recent update
      const subscription = await billing.subscriptions.getByExternalId(subscriptionId);
      expect(subscription).not.toBeNull();
      expect(subscription!.status).toBe('active'); // Updated status, not created
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-013 to WH-TEST-016: Retry Behavior
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-004: Retry behavior', () => {
    it('WH-TEST-013: should retry on temporary failure (500)', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });

      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return new Response('Internal Server Error', { status: 500 });
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // Act
      const result = await helper.sendWebhookWithRetries(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        { maxRetries: 3 }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(attemptCount).toBe(2);
    });

    it('WH-TEST-014: should NOT retry on permanent failure (400)', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });

      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        return new Response('Bad Request', { status: 400 });
      });

      // Act
      const result = await helper.sendWebhookWithRetries(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        { maxRetries: 3 }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.retryCount).toBe(0);
      expect(attemptCount).toBe(1); // No retries
    });

    it('WH-TEST-016: should use exponential backoff', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });

      const timestamps: number[] = [];
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        timestamps.push(Date.now());
        if (timestamps.length < 4) {
          return new Response('Internal Server Error', { status: 500 });
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      });

      // Act
      await helper.sendWebhookWithRetries(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        { maxRetries: 5, retryDelayMs: 100 }
      );

      // Assert - Verify exponential backoff
      // Delays should be approximately: 100ms, 200ms, 400ms
      if (timestamps.length >= 4) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        const delay3 = timestamps[3] - timestamps[2];

        expect(delay2).toBeGreaterThanOrEqual(delay1 * 1.5);
        expect(delay3).toBeGreaterThanOrEqual(delay2 * 1.5);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-017 to WH-TEST-018: Unknown Events
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-005: Unknown events', () => {
    it('WH-TEST-017: should accept but not process unknown event types', async () => {
      // Arrange
      const unknownEvent = {
        id: 'evt_unknown_123',
        object: 'event',
        type: 'unknown.event.type',
        data: { object: { foo: 'bar' } },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      };

      // Act
      const result = await helper.sendWebhook({
        eventId: unknownEvent.id,
        eventType: unknownEvent.type,
        provider: 'stripe',
        payload: unknownEvent,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      // Event should be acknowledged but not processed
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-019: Replay Attack Prevention
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-006: Replay attack prevention', () => {
    it('WH-TEST-019: should reject events with old timestamps', async () => {
      // Arrange
      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
      });

      // Generate signature with timestamp from 10 minutes ago
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const oldSignature = helper.generateStripeSignature(
        JSON.stringify(event),
        oldTimestamp
      );

      // Act
      const result = await helper.sendWebhook(
        {
          eventId: event.id,
          eventType: event.type,
          provider: 'stripe',
          payload: event,
        },
        {
          headers: {
            'Stripe-Signature': oldSignature,
          },
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-022 to WH-TEST-024: State Synchronization
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-007: State synchronization', () => {
    it('WH-TEST-022: should create invoice when payment succeeds', async () => {
      // Arrange
      const customerId = 'cus_invoice_test';
      await billing.customers.create({
        id: customerId,
        email: 'invoice@test.com',
        name: 'Invoice Test',
      });

      const event = stripeWebhookFactory.createPaymentIntentSucceeded({
        amount: 10000,
        currency: 'usd',
        customerId,
        metadata: { createInvoice: 'true' },
      });

      // Act
      await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Assert
      const invoices = await billing.invoices.list({ customerId });
      expect(invoices.data.length).toBe(1);
      expect(invoices.data[0].status).toBe('paid');
      expect(invoices.data[0].amount).toBe(10000);
    });

    it('WH-TEST-023: should sync subscription status from webhook', async () => {
      // Arrange
      const customerId = 'cus_sync_test';
      await billing.customers.create({
        id: customerId,
        email: 'sync@test.com',
        name: 'Sync Test',
      });

      const subscriptionId = `sub_sync_${Date.now()}`;

      // Create subscription locally with 'trialing' status
      await billing.subscriptions.create({
        customerId,
        planId: 'plan_basic',
        externalId: subscriptionId,
        status: 'trialing',
      });

      // Webhook says it's now 'active'
      const event = stripeWebhookFactory.createSubscriptionUpdated({
        subscriptionId,
        customerId,
        priceId: 'price_basic',
        status: 'active',
        previousStatus: 'trialing',
      });

      // Act
      await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Assert
      const subscription = await billing.subscriptions.getByExternalId(subscriptionId);
      expect(subscription!.status).toBe('active');
    });

    it('WH-TEST-024: should update payment status on refund', async () => {
      // Arrange
      const customerId = 'cus_refund_test';
      await billing.customers.create({
        id: customerId,
        email: 'refund@test.com',
        name: 'Refund Test',
      });

      const paymentIntentId = `pi_refund_${Date.now()}`;

      // Create succeeded payment
      await billing.payments.create({
        customerId,
        amount: 10000,
        currency: 'usd',
        externalId: paymentIntentId,
        status: 'succeeded',
      });

      // Refund webhook
      const event = stripeWebhookFactory.createChargeRefunded({
        paymentIntentId,
        amount: 10000,
        amountRefunded: 10000,
        currency: 'usd',
        customerId,
      });

      // Act
      await helper.sendWebhook({
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        payload: event,
      });

      // Assert
      const payment = await billing.payments.getByExternalId(paymentIntentId);
      expect(payment!.status).toBe('refunded');
      expect(payment!.refundedAmount).toBe(10000);
    });
  });
});
```

#### 1.11.6 MercadoPago Webhook Tests

```typescript
// File: packages/core/tests/integration/webhooks/mercadopago-webhooks.test.ts

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { WebhookTestHelper } from '../../../src/testing/webhook-test-helper';
import {
  mercadoPagoWebhookFactory,
  MERCADOPAGO_PAYMENT_STATUS,
} from '../../../src/testing/factories/mercadopago-webhook.factory';
import { createQZPayBilling } from '../../../src';
import { createTestDatabase } from '../../utils/test-database';

describe('MercadoPago Webhook Processing', () => {
  let helper: WebhookTestHelper;
  let billing: ReturnType<typeof createQZPayBilling>;
  let db: ReturnType<typeof createTestDatabase>;

  beforeAll(async () => {
    db = createTestDatabase();
    await db.setup();

    billing = createQZPayBilling({
      storage: db.adapter,
      providers: {
        mercadopago: {
          accessToken: 'TEST-123',
          webhookSecret: 'mp_webhook_secret',
        },
      },
    });

    helper = new WebhookTestHelper({
      stripeWebhookSecret: 'whsec_test',
      mercadoPagoSecret: 'mp_webhook_secret',
      baseUrl: 'http://localhost:3000',
    });
  });

  beforeEach(async () => {
    await db.truncateAll();
    helper.clearTrackedEvents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WH-TEST-005 to WH-TEST-006: MercadoPago Signature Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('@edge-case WH-EC-001: MercadoPago signature validation', () => {
    it('WH-TEST-005: should accept valid MercadoPago signature', async () => {
      // Arrange
      const paymentId = '12345678901';
      const notification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);

      // Mock the payment fetch
      const payment = mercadoPagoWebhookFactory.createApprovedPayment({
        id: parseInt(paymentId),
        amount: 1000,
        currency: 'ARS',
        externalReference: 'order_123',
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValue(payment);

      // Act
      const result = await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('WH-TEST-006: should reject invalid MercadoPago signature', async () => {
      // Arrange
      const paymentId = '12345678901';
      const notification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);

      const invalidHeaders = helper.generateInvalidMercadoPagoSignature(
        notification.id.toString(),
        paymentId,
        'wrong_secret'
      );

      // Act
      const result = await helper.sendWebhook(
        {
          eventId: notification.id.toString(),
          eventType: notification.type,
          provider: 'mercadopago',
          payload: notification,
        },
        {
          headers: invalidHeaders,
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MercadoPago-specific scenarios
  // ─────────────────────────────────────────────────────────────────────────────

  describe('MercadoPago payment status mapping', () => {
    it('should map approved status correctly', async () => {
      // Arrange
      const customerId = 'cus_mp_approved';
      await billing.customers.create({
        id: customerId,
        email: 'mp@test.com',
        name: 'MP Test',
      });

      const paymentId = '12345678902';
      const notification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);

      const payment = mercadoPagoWebhookFactory.createApprovedPayment({
        id: parseInt(paymentId),
        amount: 1500,
        currency: 'ARS',
        metadata: { customerId },
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValue(payment);

      // Act
      await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      const localPayment = await billing.payments.getByExternalId(paymentId);
      expect(localPayment).not.toBeNull();
      expect(localPayment!.status).toBe('succeeded');
    });

    it('should map rejected status correctly', async () => {
      // Arrange
      const customerId = 'cus_mp_rejected';
      await billing.customers.create({
        id: customerId,
        email: 'mp-reject@test.com',
        name: 'MP Reject Test',
      });

      const paymentId = '12345678903';
      const notification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);

      const payment = mercadoPagoWebhookFactory.createRejectedPayment({
        id: parseInt(paymentId),
        amount: 1500,
        currency: 'ARS',
        rejectionReason: 'CC_REJECTED_INSUFFICIENT_AMOUNT',
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValue(payment);

      // Act
      await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      const localPayment = await billing.payments.getByExternalId(paymentId);
      expect(localPayment).not.toBeNull();
      expect(localPayment!.status).toBe('failed');
      expect(localPayment!.failureReason).toBe('cc_rejected_insufficient_amount');
    });

    it('should map pending status correctly', async () => {
      // Arrange
      const paymentId = '12345678904';
      const notification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);

      const payment = mercadoPagoWebhookFactory.createPendingPayment({
        id: parseInt(paymentId),
        amount: 2000,
        currency: 'ARS',
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValue(payment);

      // Act
      await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      const localPayment = await billing.payments.getByExternalId(paymentId);
      expect(localPayment!.status).toBe('pending');
    });

    it('should handle payment status updates', async () => {
      // Arrange
      const paymentId = '12345678905';

      // First: create pending payment
      const createNotification = mercadoPagoWebhookFactory.createPaymentCreatedNotification(paymentId);
      const pendingPayment = mercadoPagoWebhookFactory.createPendingPayment({
        id: parseInt(paymentId),
        amount: 3000,
        currency: 'ARS',
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValueOnce(pendingPayment);

      await helper.sendWebhook({
        eventId: createNotification.id.toString(),
        eventType: createNotification.type,
        provider: 'mercadopago',
        payload: createNotification,
      });

      // Second: update to approved
      const updateNotification = mercadoPagoWebhookFactory.createPaymentUpdatedNotification(paymentId);
      const approvedPayment = mercadoPagoWebhookFactory.createApprovedPayment({
        id: parseInt(paymentId),
        amount: 3000,
        currency: 'ARS',
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValueOnce(approvedPayment);

      await helper.sendWebhook({
        eventId: updateNotification.id.toString(),
        eventType: updateNotification.type,
        provider: 'mercadopago',
        payload: updateNotification,
      });

      // Assert
      const localPayment = await billing.payments.getByExternalId(paymentId);
      expect(localPayment!.status).toBe('succeeded');
    });
  });

  describe('MercadoPago subscription webhooks', () => {
    it('should handle subscription payment notifications', async () => {
      // Arrange
      const preapprovalId = 'preapproval_123';
      const paymentId = 'sub_payment_456';

      const notification = mercadoPagoWebhookFactory.createSubscriptionPaymentNotification(paymentId);

      const payment = mercadoPagoWebhookFactory.createApprovedPayment({
        id: parseInt(paymentId) || 456,
        amount: 999,
        currency: 'ARS',
        metadata: { preapprovalId },
      });

      vi.spyOn(billing.providers.mercadopago, 'getPayment').mockResolvedValue(payment);

      // Act
      const result = await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle chargeback notifications', async () => {
      // Arrange
      const chargebackId = 'chargeback_123';
      const notification = mercadoPagoWebhookFactory.createChargebackNotification(chargebackId);

      // Act
      const result = await helper.sendWebhook({
        eventId: notification.id.toString(),
        eventType: notification.type,
        provider: 'mercadopago',
        payload: notification,
      });

      // Assert
      expect(result.success).toBe(true);
      // Verify dispute was created in system
    });
  });
});
```

#### 1.11.7 Webhook Testing Tasks

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.11.1 | Create WebhookTestHelper class | Full implementation with signature generation | 1.2.7 |
| 1.11.2 | Write WebhookTestHelper unit tests | Test signature generation, tracking, assertions | 1.11.1 |
| 1.11.3 | Create StripeWebhookFactory | All Stripe event factory methods | 1.11.1 |
| 1.11.4 | Write StripeWebhookFactory tests | Test all event creation methods | 1.11.3 |
| 1.11.5 | Create MercadoPagoWebhookFactory | All MP notification and payment factories | 1.11.1 |
| 1.11.6 | Write MercadoPagoWebhookFactory tests | Test all factory methods | 1.11.5 |
| 1.11.7 | Implement Stripe signature validation tests | WH-TEST-001 to WH-TEST-004 | 1.11.3 |
| 1.11.8 | Implement MercadoPago signature tests | WH-TEST-005 to WH-TEST-006 | 1.11.5 |
| 1.11.9 | Implement idempotency tests | WH-TEST-007 to WH-TEST-009, WH-TEST-020 | 1.11.3, 1.11.5 |
| 1.11.10 | Implement out-of-order tests | WH-TEST-010 to WH-TEST-012 | 1.11.3 |
| 1.11.11 | Implement retry behavior tests | WH-TEST-013 to WH-TEST-016 | 1.11.3 |
| 1.11.12 | Implement unknown event tests | WH-TEST-017 to WH-TEST-018 | 1.11.3 |
| 1.11.13 | Implement replay attack tests | WH-TEST-019 | 1.11.3 |
| 1.11.14 | Implement state sync tests | WH-TEST-022 to WH-TEST-024 | 1.11.3 |
| 1.11.15 | Create webhook endpoint mocks | Mock HTTP endpoints for testing | 1.11.1 |
| 1.11.16 | Document webhook testing patterns | Add to developer documentation | 1.11.1-1.11.15 |

#### 1.11.8 Webhook Test Environment Configuration

```typescript
// File: packages/core/tests/setup/webhook-test-setup.ts

import { WebhookTestHelper } from '../../src/testing/webhook-test-helper';
import { stripeWebhookFactory } from '../../src/testing/factories/stripe-webhook.factory';
import { mercadoPagoWebhookFactory } from '../../src/testing/factories/mercadopago-webhook.factory';

/**
 * Global webhook test configuration
 */
export const WEBHOOK_TEST_CONFIG = {
  stripe: {
    webhookSecret: 'whsec_test_secret_12345',
    signatureTolerance: 300, // 5 minutes
  },
  mercadopago: {
    webhookSecret: 'mp_webhook_secret_67890',
    signatureTolerance: 300,
  },
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
  idempotency: {
    keyTtlSeconds: 86400, // 24 hours
  },
};

/**
 * Create pre-configured webhook test helper
 */
export function createWebhookTestHelper(baseUrl: string): WebhookTestHelper {
  return new WebhookTestHelper({
    stripeWebhookSecret: WEBHOOK_TEST_CONFIG.stripe.webhookSecret,
    mercadoPagoSecret: WEBHOOK_TEST_CONFIG.mercadopago.webhookSecret,
    baseUrl,
    defaultTimeout: 30000,
  });
}

/**
 * Export factories for test files
 */
export { stripeWebhookFactory, mercadoPagoWebhookFactory };

/**
 * Webhook test assertions
 */
export const webhookAssertions = {
  /**
   * Assert webhook was processed exactly once
   */
  assertProcessedOnce: (helper: WebhookTestHelper, eventId: string) => {
    const event = helper.getTrackedEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    if (!event.wasProcessed) {
      throw new Error(`Event ${eventId} was not processed`);
    }
    if (event.deliveryResult?.retryCount && event.deliveryResult.retryCount > 0) {
      throw new Error(`Event ${eventId} was retried ${event.deliveryResult.retryCount} times`);
    }
  },

  /**
   * Assert webhook was retried and eventually succeeded
   */
  assertRetriedSuccessfully: (
    helper: WebhookTestHelper,
    eventId: string,
    expectedRetries: number
  ) => {
    const event = helper.getTrackedEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    if (!event.wasProcessed) {
      throw new Error(`Event ${eventId} was not processed after retries`);
    }
    if (event.deliveryResult?.retryCount !== expectedRetries) {
      throw new Error(
        `Expected ${expectedRetries} retries, got ${event.deliveryResult?.retryCount}`
      );
    }
  },

  /**
   * Assert webhook was rejected with specific status
   */
  assertRejectedWithStatus: (
    helper: WebhookTestHelper,
    eventId: string,
    expectedStatus: number
  ) => {
    const event = helper.getTrackedEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    if (event.wasProcessed) {
      throw new Error(`Event ${eventId} was unexpectedly processed`);
    }
    if (event.deliveryResult?.statusCode !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${event.deliveryResult?.statusCode}`
      );
    }
  },

  /**
   * Assert processing time is within limit
   */
  assertProcessingTime: (
    helper: WebhookTestHelper,
    eventId: string,
    maxMs: number
  ) => {
    const event = helper.getTrackedEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} was not tracked`);
    }
    const processingTime = event.deliveryResult?.processingTimeMs ?? 0;
    if (processingTime > maxMs) {
      throw new Error(
        `Processing time ${processingTime}ms exceeded limit of ${maxMs}ms`
      );
    }
  },
};
```

#### 1.11.9 CI/CD Webhook Test Requirements

```yaml
# .github/workflows/ci.yml (webhook test section)

webhook-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install

    - name: Run webhook unit tests
      run: pnpm test --grep "Webhook" --reporter=verbose

    - name: Run webhook integration tests
      run: pnpm test:integration --grep "webhook" --reporter=verbose

    - name: Verify webhook test coverage
      run: |
        # Count webhook test scenarios
        WEBHOOK_TESTS=$(grep -r "WH-TEST-" packages --include="*.test.ts" | wc -l)

        if [ "$WEBHOOK_TESTS" -lt 24 ]; then
          echo "ERROR: Only $WEBHOOK_TESTS webhook tests found, minimum 24 required"
          echo "Required test scenarios: WH-TEST-001 through WH-TEST-024"
          exit 1
        fi

        echo "✓ Found $WEBHOOK_TESTS webhook test scenarios"

    - name: Verify signature validation tests
      run: |
        # Ensure both providers have signature tests
        STRIPE_SIG=$(grep -r "WH-TEST-00[1234]" packages --include="*.test.ts" | wc -l)
        MP_SIG=$(grep -r "WH-TEST-00[56]" packages --include="*.test.ts" | wc -l)

        if [ "$STRIPE_SIG" -lt 4 ]; then
          echo "ERROR: Missing Stripe signature validation tests"
          exit 1
        fi

        if [ "$MP_SIG" -lt 2 ]; then
          echo "ERROR: Missing MercadoPago signature validation tests"
          exit 1
        fi

        echo "✓ Signature validation tests present for both providers"

    - name: Verify idempotency tests
      run: |
        IDEMP_TESTS=$(grep -r "WH-TEST-007\|WH-TEST-008\|WH-TEST-009\|WH-TEST-020" packages --include="*.test.ts" | wc -l)

        if [ "$IDEMP_TESTS" -lt 4 ]; then
          echo "ERROR: Missing idempotency tests"
          exit 1
        fi

        echo "✓ Idempotency tests present"

    - name: Verify retry tests
      run: |
        RETRY_TESTS=$(grep -r "WH-TEST-01[3456]" packages --include="*.test.ts" | wc -l)

        if [ "$RETRY_TESTS" -lt 4 ]; then
          echo "ERROR: Missing retry behavior tests"
          exit 1
        fi

        echo "✓ Retry behavior tests present"
```

---

### 1.12 Performance Testing Infrastructure

> **CRITICAL**: Complete performance testing infrastructure to validate system behavior under load and ensure production readiness.

#### 1.12.1 Performance Targets

##### Latency Requirements (SLOs)

| Operation | P50 | P95 | P99 | Max | Notes |
|-----------|-----|-----|-----|-----|-------|
| **Customer Operations** |
| Create customer | 50ms | 100ms | 200ms | 500ms | Single DB insert |
| Get customer | 10ms | 30ms | 50ms | 100ms | Indexed lookup |
| Update customer | 30ms | 80ms | 150ms | 300ms | Single DB update |
| List customers (page) | 50ms | 150ms | 300ms | 500ms | 50 items per page |
| **Subscription Operations** |
| Create subscription | 150ms | 400ms | 800ms | 2s | Includes provider call |
| Get subscription | 15ms | 40ms | 80ms | 150ms | With helpers loaded |
| Update subscription | 100ms | 300ms | 600ms | 1.5s | May include provider |
| Change plan | 200ms | 500ms | 1s | 3s | Proration + provider |
| Cancel subscription | 100ms | 300ms | 600ms | 2s | Provider cancellation |
| Pause subscription | 80ms | 200ms | 400ms | 1s | Local + provider |
| Resume subscription | 100ms | 300ms | 600ms | 1.5s | Reactivation flow |
| **Payment Operations** |
| Create payment | 200ms | 600ms | 1.2s | 3s | Provider charge |
| Process refund | 150ms | 500ms | 1s | 2.5s | Provider refund |
| Get payment | 10ms | 30ms | 60ms | 100ms | Indexed lookup |
| **Invoice Operations** |
| Generate invoice | 80ms | 200ms | 400ms | 1s | Line items calc |
| Finalize invoice | 50ms | 150ms | 300ms | 600ms | Number assignment |
| Send invoice email | 100ms | 300ms | 600ms | 1.5s | Email adapter |
| **Promo Code Operations** |
| Validate promo code | 30ms | 80ms | 150ms | 300ms | Complex conditions |
| Apply promo code | 50ms | 120ms | 250ms | 500ms | Usage tracking |
| **Usage Operations** |
| Record usage | 15ms | 40ms | 80ms | 150ms | Single insert |
| Batch record usage | 50ms | 150ms | 300ms | 600ms | Up to 100 records |
| Get usage summary | 30ms | 100ms | 200ms | 400ms | Aggregation query |
| **Webhook Operations** |
| Process webhook | 80ms | 250ms | 500ms | 2s | Signature + processing |
| Webhook acknowledgment | 20ms | 50ms | 100ms | 200ms | Return 200 OK |
| **Checkout Operations** |
| Create checkout session | 150ms | 400ms | 800ms | 2s | Provider session |
| Complete checkout | 200ms | 600ms | 1.2s | 3s | Full flow |

##### Throughput Requirements

| Operation | Sustained Rate | Burst Rate | Duration |
|-----------|---------------|------------|----------|
| **API Endpoints** |
| Read operations | 5,000/min | 10,000/min | 1 min |
| Write operations | 1,000/min | 3,000/min | 1 min |
| Mixed workload | 3,000/min | 6,000/min | 1 min |
| **Webhooks** |
| Stripe webhooks | 1,000/min | 5,000/min | 5 min |
| MercadoPago webhooks | 500/min | 2,000/min | 5 min |
| Combined webhooks | 1,500/min | 6,000/min | 5 min |
| **Background Jobs** |
| Invoice generation | 500/min | 2,000/min | 10 min |
| Payment retries | 200/min | 500/min | 5 min |
| Usage aggregation | 1,000/min | 3,000/min | 5 min |
| **Usage Recording** |
| Single records | 10,000/min | 30,000/min | 1 min |
| Batch records | 50 batches/min | 200 batches/min | 1 min |

##### Concurrency Requirements

| Scenario | Concurrent Users | Target |
|----------|-----------------|--------|
| Checkout sessions | 500 | All complete successfully |
| Subscription updates | 200 | No race conditions |
| Webhook processing | 100 | All processed in order |
| Usage recording | 1,000 | No data loss |
| Invoice generation | 100 | No duplicate invoices |

#### 1.12.2 Performance Test Utilities

```typescript
// File: packages/core/src/testing/performance/performance-test-helper.ts

import { performance } from 'perf_hooks';

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  /** Operation name */
  operation: string;
  /** Number of iterations */
  iterations: number;
  /** Total duration in milliseconds */
  totalMs: number;
  /** Average duration per operation */
  avgMs: number;
  /** Minimum duration */
  minMs: number;
  /** Maximum duration */
  maxMs: number;
  /** P50 (median) duration */
  p50Ms: number;
  /** P95 duration */
  p95Ms: number;
  /** P99 duration */
  p99Ms: number;
  /** Operations per second */
  opsPerSecond: number;
  /** All individual measurements */
  measurements: number[];
  /** Timestamp when test was run */
  timestamp: Date;
}

/**
 * Performance target definition
 */
export interface PerformanceTarget {
  /** Operation name */
  operation: string;
  /** P50 target in ms */
  p50Ms: number;
  /** P95 target in ms */
  p95Ms: number;
  /** P99 target in ms */
  p99Ms: number;
  /** Maximum allowed in ms */
  maxMs: number;
  /** Minimum ops/second */
  minOpsPerSecond?: number;
}

/**
 * Performance test configuration
 */
export interface PerformanceTestConfig {
  /** Number of iterations to run */
  iterations: number;
  /** Warmup iterations (not counted) */
  warmupIterations?: number;
  /** Concurrent execution count */
  concurrency?: number;
  /** Timeout per operation in ms */
  timeoutMs?: number;
  /** Whether to run garbage collection between iterations */
  forceGC?: boolean;
}

/**
 * Performance comparison result
 */
export interface PerformanceComparison {
  operation: string;
  target: PerformanceTarget;
  actual: PerformanceMeasurement;
  passed: boolean;
  violations: {
    metric: 'p50' | 'p95' | 'p99' | 'max' | 'opsPerSecond';
    target: number;
    actual: number;
    percentOver: number;
  }[];
}

/**
 * Main performance testing helper
 */
export class PerformanceTestHelper {
  private readonly targets: Map<string, PerformanceTarget> = new Map();

  /**
   * Register performance targets for operations
   */
  registerTargets(targets: PerformanceTarget[]): void {
    for (const target of targets) {
      this.targets.set(target.operation, target);
    }
  }

  /**
   * Measure performance of a synchronous operation
   */
  async measure<T>(
    operation: string,
    fn: () => T | Promise<T>,
    config: PerformanceTestConfig = { iterations: 100 }
  ): Promise<PerformanceMeasurement> {
    const {
      iterations,
      warmupIterations = Math.min(10, Math.floor(iterations * 0.1)),
      concurrency = 1,
      timeoutMs = 30000,
      forceGC = false,
    } = config;

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Force GC if available and requested
    if (forceGC && global.gc) {
      global.gc();
    }

    const measurements: number[] = [];

    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          ),
        ]);
        const duration = performance.now() - start;
        measurements.push(duration);
      }
    } else {
      // Concurrent execution
      const batches = Math.ceil(iterations / concurrency);
      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(concurrency, iterations - batch * concurrency);
        const batchPromises = Array(batchSize)
          .fill(null)
          .map(async () => {
            const start = performance.now();
            await fn();
            return performance.now() - start;
          });
        const batchResults = await Promise.all(batchPromises);
        measurements.push(...batchResults);
      }
    }

    return this.calculateStats(operation, measurements);
  }

  /**
   * Measure throughput (operations per time period)
   */
  async measureThroughput<T>(
    operation: string,
    fn: () => T | Promise<T>,
    config: {
      durationMs: number;
      concurrency?: number;
      warmupMs?: number;
    }
  ): Promise<{
    operation: string;
    durationMs: number;
    totalOperations: number;
    opsPerSecond: number;
    avgLatencyMs: number;
    errors: number;
  }> {
    const { durationMs, concurrency = 10, warmupMs = 1000 } = config;

    // Warmup
    const warmupEnd = Date.now() + warmupMs;
    while (Date.now() < warmupEnd) {
      await fn();
    }

    let totalOperations = 0;
    let errors = 0;
    const latencies: number[] = [];
    const endTime = Date.now() + durationMs;

    // Create worker pool
    const workers = Array(concurrency)
      .fill(null)
      .map(async () => {
        while (Date.now() < endTime) {
          const start = performance.now();
          try {
            await fn();
            totalOperations++;
            latencies.push(performance.now() - start);
          } catch {
            errors++;
          }
        }
      });

    await Promise.all(workers);

    const avgLatencyMs =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    return {
      operation,
      durationMs,
      totalOperations,
      opsPerSecond: (totalOperations / durationMs) * 1000,
      avgLatencyMs,
      errors,
    };
  }

  /**
   * Compare measurement against registered target
   */
  compare(measurement: PerformanceMeasurement): PerformanceComparison {
    const target = this.targets.get(measurement.operation);
    if (!target) {
      throw new Error(`No target registered for operation: ${measurement.operation}`);
    }

    const violations: PerformanceComparison['violations'] = [];

    if (measurement.p50Ms > target.p50Ms) {
      violations.push({
        metric: 'p50',
        target: target.p50Ms,
        actual: measurement.p50Ms,
        percentOver: ((measurement.p50Ms - target.p50Ms) / target.p50Ms) * 100,
      });
    }

    if (measurement.p95Ms > target.p95Ms) {
      violations.push({
        metric: 'p95',
        target: target.p95Ms,
        actual: measurement.p95Ms,
        percentOver: ((measurement.p95Ms - target.p95Ms) / target.p95Ms) * 100,
      });
    }

    if (measurement.p99Ms > target.p99Ms) {
      violations.push({
        metric: 'p99',
        target: target.p99Ms,
        actual: measurement.p99Ms,
        percentOver: ((measurement.p99Ms - target.p99Ms) / target.p99Ms) * 100,
      });
    }

    if (measurement.maxMs > target.maxMs) {
      violations.push({
        metric: 'max',
        target: target.maxMs,
        actual: measurement.maxMs,
        percentOver: ((measurement.maxMs - target.maxMs) / target.maxMs) * 100,
      });
    }

    if (target.minOpsPerSecond && measurement.opsPerSecond < target.minOpsPerSecond) {
      violations.push({
        metric: 'opsPerSecond',
        target: target.minOpsPerSecond,
        actual: measurement.opsPerSecond,
        percentOver:
          ((target.minOpsPerSecond - measurement.opsPerSecond) /
            target.minOpsPerSecond) *
          100,
      });
    }

    return {
      operation: measurement.operation,
      target,
      actual: measurement,
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Assert that measurement meets target
   */
  assertMeetsTarget(measurement: PerformanceMeasurement): void {
    const comparison = this.compare(measurement);
    if (!comparison.passed) {
      const violationDetails = comparison.violations
        .map(
          v =>
            `${v.metric}: expected ${v.target}ms, got ${v.actual.toFixed(2)}ms (${v.percentOver.toFixed(1)}% over)`
        )
        .join(', ');
      throw new Error(
        `Performance target not met for ${measurement.operation}: ${violationDetails}`
      );
    }
  }

  /**
   * Calculate percentile value
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate statistics from measurements
   */
  private calculateStats(
    operation: string,
    measurements: number[]
  ): PerformanceMeasurement {
    const sorted = [...measurements].sort((a, b) => a - b);
    const total = measurements.reduce((a, b) => a + b, 0);

    return {
      operation,
      iterations: measurements.length,
      totalMs: total,
      avgMs: total / measurements.length,
      minMs: sorted[0] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
      p50Ms: this.percentile(sorted, 50),
      p95Ms: this.percentile(sorted, 95),
      p99Ms: this.percentile(sorted, 99),
      opsPerSecond: (measurements.length / total) * 1000,
      measurements,
      timestamp: new Date(),
    };
  }
}

/**
 * Export singleton instance
 */
export const performanceHelper = new PerformanceTestHelper();
```

#### 1.12.3 Load Test Scenarios

```typescript
// File: packages/core/src/testing/performance/load-test-scenarios.ts

import { PerformanceTestHelper } from './performance-test-helper';

/**
 * Load test scenario definition
 */
export interface LoadTestScenario {
  /** Unique scenario ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this tests */
  description: string;
  /** Test category */
  category: 'api' | 'webhook' | 'background' | 'database' | 'integration';
  /** Setup function (run once before test) */
  setup?: () => Promise<void>;
  /** The operation to test */
  execute: () => Promise<void>;
  /** Teardown function (run once after test) */
  teardown?: () => Promise<void>;
  /** Default configuration */
  config: {
    iterations: number;
    concurrency: number;
    warmupIterations: number;
  };
  /** Performance targets */
  targets: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    minOpsPerSecond?: number;
  };
}

/**
 * Pre-defined load test scenarios
 */
export const LOAD_TEST_SCENARIOS: Record<string, LoadTestScenario> = {
  // ─────────────────────────────────────────────────────────────────────────
  // API Endpoint Scenarios
  // ─────────────────────────────────────────────────────────────────────────

  API_CREATE_CUSTOMER: {
    id: 'API_CREATE_CUSTOMER',
    name: 'Create Customer API',
    description: 'Measure customer creation throughput and latency',
    category: 'api',
    config: { iterations: 1000, concurrency: 10, warmupIterations: 50 },
    targets: { p50Ms: 50, p95Ms: 100, p99Ms: 200, maxMs: 500, minOpsPerSecond: 100 },
    execute: async () => {
      // Implemented by test
    },
  },

  API_GET_CUSTOMER: {
    id: 'API_GET_CUSTOMER',
    name: 'Get Customer API',
    description: 'Measure customer retrieval performance',
    category: 'api',
    config: { iterations: 5000, concurrency: 50, warmupIterations: 100 },
    targets: { p50Ms: 10, p95Ms: 30, p99Ms: 50, maxMs: 100, minOpsPerSecond: 500 },
    execute: async () => {},
  },

  API_LIST_CUSTOMERS: {
    id: 'API_LIST_CUSTOMERS',
    name: 'List Customers API (paginated)',
    description: 'Measure paginated customer listing with 100k customers',
    category: 'api',
    config: { iterations: 500, concurrency: 10, warmupIterations: 20 },
    targets: { p50Ms: 50, p95Ms: 150, p99Ms: 300, maxMs: 500 },
    execute: async () => {},
  },

  API_CREATE_SUBSCRIPTION: {
    id: 'API_CREATE_SUBSCRIPTION',
    name: 'Create Subscription API',
    description: 'Full subscription creation including provider call',
    category: 'api',
    config: { iterations: 200, concurrency: 5, warmupIterations: 10 },
    targets: { p50Ms: 150, p95Ms: 400, p99Ms: 800, maxMs: 2000 },
    execute: async () => {},
  },

  API_CHANGE_PLAN: {
    id: 'API_CHANGE_PLAN',
    name: 'Change Subscription Plan API',
    description: 'Plan change with proration calculation',
    category: 'api',
    config: { iterations: 200, concurrency: 5, warmupIterations: 10 },
    targets: { p50Ms: 200, p95Ms: 500, p99Ms: 1000, maxMs: 3000 },
    execute: async () => {},
  },

  API_VALIDATE_PROMO_CODE: {
    id: 'API_VALIDATE_PROMO_CODE',
    name: 'Validate Promo Code API',
    description: 'Complex promo code validation with conditions',
    category: 'api',
    config: { iterations: 2000, concurrency: 20, warmupIterations: 100 },
    targets: { p50Ms: 30, p95Ms: 80, p99Ms: 150, maxMs: 300, minOpsPerSecond: 200 },
    execute: async () => {},
  },

  API_RECORD_USAGE: {
    id: 'API_RECORD_USAGE',
    name: 'Record Usage API',
    description: 'Single usage record creation',
    category: 'api',
    config: { iterations: 10000, concurrency: 100, warmupIterations: 500 },
    targets: { p50Ms: 15, p95Ms: 40, p99Ms: 80, maxMs: 150, minOpsPerSecond: 500 },
    execute: async () => {},
  },

  API_BATCH_RECORD_USAGE: {
    id: 'API_BATCH_RECORD_USAGE',
    name: 'Batch Record Usage API',
    description: 'Batch of 100 usage records',
    category: 'api',
    config: { iterations: 500, concurrency: 10, warmupIterations: 20 },
    targets: { p50Ms: 50, p95Ms: 150, p99Ms: 300, maxMs: 600 },
    execute: async () => {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Webhook Processing Scenarios
  // ─────────────────────────────────────────────────────────────────────────

  WEBHOOK_STRIPE_PAYMENT: {
    id: 'WEBHOOK_STRIPE_PAYMENT',
    name: 'Stripe Payment Webhook',
    description: 'Process payment_intent.succeeded webhook',
    category: 'webhook',
    config: { iterations: 1000, concurrency: 20, warmupIterations: 50 },
    targets: { p50Ms: 80, p95Ms: 250, p99Ms: 500, maxMs: 2000 },
    execute: async () => {},
  },

  WEBHOOK_STRIPE_SUBSCRIPTION: {
    id: 'WEBHOOK_STRIPE_SUBSCRIPTION',
    name: 'Stripe Subscription Webhook',
    description: 'Process subscription.updated webhook',
    category: 'webhook',
    config: { iterations: 500, concurrency: 10, warmupIterations: 25 },
    targets: { p50Ms: 100, p95Ms: 300, p99Ms: 600, maxMs: 2000 },
    execute: async () => {},
  },

  WEBHOOK_MERCADOPAGO_PAYMENT: {
    id: 'WEBHOOK_MERCADOPAGO_PAYMENT',
    name: 'MercadoPago Payment IPN',
    description: 'Process payment IPN notification',
    category: 'webhook',
    config: { iterations: 500, concurrency: 10, warmupIterations: 25 },
    targets: { p50Ms: 100, p95Ms: 350, p99Ms: 700, maxMs: 2500 },
    execute: async () => {},
  },

  WEBHOOK_BURST: {
    id: 'WEBHOOK_BURST',
    name: 'Webhook Burst Test',
    description: 'Simulate burst of 5000 webhooks in 1 minute',
    category: 'webhook',
    config: { iterations: 5000, concurrency: 100, warmupIterations: 100 },
    targets: { p50Ms: 100, p95Ms: 500, p99Ms: 1000, maxMs: 5000 },
    execute: async () => {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Background Job Scenarios
  // ─────────────────────────────────────────────────────────────────────────

  JOB_GENERATE_INVOICE: {
    id: 'JOB_GENERATE_INVOICE',
    name: 'Generate Invoice Job',
    description: 'Generate single invoice with line items',
    category: 'background',
    config: { iterations: 500, concurrency: 5, warmupIterations: 25 },
    targets: { p50Ms: 80, p95Ms: 200, p99Ms: 400, maxMs: 1000 },
    execute: async () => {},
  },

  JOB_MASS_INVOICE_GENERATION: {
    id: 'JOB_MASS_INVOICE_GENERATION',
    name: 'Mass Invoice Generation',
    description: 'Generate 1000 invoices (billing cycle simulation)',
    category: 'background',
    config: { iterations: 10, concurrency: 1, warmupIterations: 1 },
    targets: { p50Ms: 60000, p95Ms: 90000, p99Ms: 120000, maxMs: 180000 },
    execute: async () => {},
  },

  JOB_PAYMENT_RETRY: {
    id: 'JOB_PAYMENT_RETRY',
    name: 'Payment Retry Job',
    description: 'Process failed payment retry',
    category: 'background',
    config: { iterations: 200, concurrency: 5, warmupIterations: 10 },
    targets: { p50Ms: 200, p95Ms: 600, p99Ms: 1200, maxMs: 3000 },
    execute: async () => {},
  },

  JOB_USAGE_AGGREGATION: {
    id: 'JOB_USAGE_AGGREGATION',
    name: 'Usage Aggregation Job',
    description: 'Aggregate usage for billing period',
    category: 'background',
    config: { iterations: 100, concurrency: 2, warmupIterations: 5 },
    targets: { p50Ms: 500, p95Ms: 1500, p99Ms: 3000, maxMs: 10000 },
    execute: async () => {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Database Scenarios
  // ─────────────────────────────────────────────────────────────────────────

  DB_CUSTOMER_LOOKUP: {
    id: 'DB_CUSTOMER_LOOKUP',
    name: 'Customer Lookup (indexed)',
    description: 'Direct database customer lookup by ID',
    category: 'database',
    config: { iterations: 10000, concurrency: 50, warmupIterations: 500 },
    targets: { p50Ms: 2, p95Ms: 5, p99Ms: 10, maxMs: 50, minOpsPerSecond: 2000 },
    execute: async () => {},
  },

  DB_SUBSCRIPTION_JOIN: {
    id: 'DB_SUBSCRIPTION_JOIN',
    name: 'Subscription with Plan Join',
    description: 'Fetch subscription with plan and customer',
    category: 'database',
    config: { iterations: 5000, concurrency: 25, warmupIterations: 250 },
    targets: { p50Ms: 5, p95Ms: 15, p99Ms: 30, maxMs: 100, minOpsPerSecond: 500 },
    execute: async () => {},
  },

  DB_INVOICE_HISTORY: {
    id: 'DB_INVOICE_HISTORY',
    name: 'Invoice History Query',
    description: 'Query last 12 months of invoices for customer',
    category: 'database',
    config: { iterations: 1000, concurrency: 10, warmupIterations: 50 },
    targets: { p50Ms: 20, p95Ms: 60, p99Ms: 120, maxMs: 300 },
    execute: async () => {},
  },

  DB_USAGE_AGGREGATION: {
    id: 'DB_USAGE_AGGREGATION',
    name: 'Usage Aggregation Query',
    description: 'Aggregate 1 month of usage records',
    category: 'database',
    config: { iterations: 200, concurrency: 5, warmupIterations: 10 },
    targets: { p50Ms: 100, p95Ms: 300, p99Ms: 600, maxMs: 1500 },
    execute: async () => {},
  },

  DB_LARGE_CUSTOMER_BASE: {
    id: 'DB_LARGE_CUSTOMER_BASE',
    name: 'Large Customer Base Query',
    description: 'Query with 100k customers in database',
    category: 'database',
    config: { iterations: 100, concurrency: 5, warmupIterations: 5 },
    targets: { p50Ms: 50, p95Ms: 150, p99Ms: 300, maxMs: 500 },
    execute: async () => {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Stress Test Scenarios (System Limits)
  // ─────────────────────────────────────────────────────────────────────────

  STRESS_CONCURRENT_SUBSCRIPTIONS: {
    id: 'STRESS_CONCURRENT_SUBSCRIPTIONS',
    name: 'Concurrent Subscription Creation',
    description: 'Create 100 subscriptions simultaneously to test locking',
    category: 'integration',
    config: { iterations: 100, concurrency: 100, warmupIterations: 0 },
    targets: { p50Ms: 500, p95Ms: 2000, p99Ms: 5000, maxMs: 10000 },
    execute: async () => {},
  },

  STRESS_CONCURRENT_PLAN_CHANGE: {
    id: 'STRESS_CONCURRENT_PLAN_CHANGE',
    name: 'Concurrent Plan Changes (Same Subscription)',
    description: 'Attempt 10 plan changes on same subscription simultaneously',
    category: 'integration',
    config: { iterations: 10, concurrency: 10, warmupIterations: 0 },
    targets: { p50Ms: 500, p95Ms: 2000, p99Ms: 5000, maxMs: 10000 },
    // Expected: Only 1 succeeds, others get OPTIMISTIC_LOCK_CONFLICT
    execute: async () => {},
  },

  STRESS_WEBHOOK_FLOOD: {
    id: 'STRESS_WEBHOOK_FLOOD',
    name: 'Webhook Flood (Rate Limit Test)',
    description: 'Send 10,000 webhooks in 60 seconds to test rate limiting',
    category: 'webhook',
    config: { iterations: 10000, concurrency: 200, warmupIterations: 0 },
    targets: { p50Ms: 50, p95Ms: 500, p99Ms: 2000, maxMs: 5000 },
    // Expected: Circuit breaker should activate, DLQ should be used
    execute: async () => {},
  },

  STRESS_DB_CONNECTION_POOL: {
    id: 'STRESS_DB_CONNECTION_POOL',
    name: 'Database Connection Pool Exhaustion',
    description: 'Exhaust connection pool with 500 concurrent queries',
    category: 'database',
    config: { iterations: 500, concurrency: 500, warmupIterations: 0 },
    targets: { p50Ms: 100, p95Ms: 2000, p99Ms: 5000, maxMs: 30000 },
    // Expected: Some queries queue, none fail with connection error
    execute: async () => {},
  },

  STRESS_PROMO_CODE_RACE: {
    id: 'STRESS_PROMO_CODE_RACE',
    name: 'Promo Code Limit Race Condition',
    description: 'Attempt to redeem limited promo code (10 max) with 50 concurrent requests',
    category: 'integration',
    config: { iterations: 50, concurrency: 50, warmupIterations: 0 },
    targets: { p50Ms: 100, p95Ms: 500, p99Ms: 1000, maxMs: 2000 },
    // Expected: Exactly 10 succeed, 40 get PROMO_LIMIT_REACHED
    execute: async () => {},
  },

  STRESS_USAGE_PERIOD_BOUNDARY: {
    id: 'STRESS_USAGE_PERIOD_BOUNDARY',
    name: 'Usage Reporting at Period Boundary',
    description: 'Report usage during period transition (simulates race condition)',
    category: 'integration',
    config: { iterations: 100, concurrency: 50, warmupIterations: 0 },
    targets: { p50Ms: 50, p95Ms: 200, p99Ms: 500, maxMs: 1000 },
    // Expected: All usage correctly attributed to correct period
    execute: async () => {},
  },

  STRESS_INVOICE_CONCURRENT_FINALIZATION: {
    id: 'STRESS_INVOICE_CONCURRENT_FINALIZATION',
    name: 'Concurrent Invoice Finalization',
    description: 'Attempt to finalize same invoice from multiple processes',
    category: 'integration',
    config: { iterations: 10, concurrency: 10, warmupIterations: 0 },
    targets: { p50Ms: 200, p95Ms: 500, p99Ms: 1000, maxMs: 2000 },
    // Expected: Only 1 succeeds, others get INVOICE_ALREADY_FINALIZED
    execute: async () => {},
  },

  STRESS_PROVIDER_TIMEOUT_CASCADE: {
    id: 'STRESS_PROVIDER_TIMEOUT_CASCADE',
    name: 'Provider Timeout Cascade',
    description: 'Test behavior when payment provider times out on 100 requests',
    category: 'integration',
    config: { iterations: 100, concurrency: 20, warmupIterations: 0 },
    targets: { p50Ms: 30000, p95Ms: 35000, p99Ms: 40000, maxMs: 45000 },
    // Expected: Circuit breaker opens, subsequent requests fast-fail
    execute: async () => {},
  },

  STRESS_MEMORY_LARGE_EXPORT: {
    id: 'STRESS_MEMORY_LARGE_EXPORT',
    name: 'Large Data Export (Memory Test)',
    description: 'Export 100k invoices to CSV (streaming test)',
    category: 'integration',
    config: { iterations: 5, concurrency: 1, warmupIterations: 0 },
    targets: { p50Ms: 60000, p95Ms: 90000, p99Ms: 120000, maxMs: 180000 },
    // Expected: Memory stays under 512MB, uses streaming
    execute: async () => {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Soak Test Scenarios (Long-Running)
  // ─────────────────────────────────────────────────────────────────────────

  SOAK_24H_OPERATIONS: {
    id: 'SOAK_24H_OPERATIONS',
    name: '24-Hour Soak Test',
    description: 'Mixed operations for 24 hours at 100 req/sec',
    category: 'integration',
    config: { iterations: 8640000, concurrency: 100, warmupIterations: 0 },
    targets: { p50Ms: 100, p95Ms: 500, p99Ms: 2000, maxMs: 10000 },
    // Expected: No memory leaks, consistent latency over time
    execute: async () => {},
  },

  SOAK_BILLING_CYCLE: {
    id: 'SOAK_BILLING_CYCLE',
    name: 'Full Billing Cycle Simulation',
    description: 'Simulate complete monthly billing for 10k subscriptions',
    category: 'integration',
    config: { iterations: 1, concurrency: 1, warmupIterations: 0 },
    targets: { p50Ms: 300000, p95Ms: 600000, p99Ms: 900000, maxMs: 1800000 },
    // Expected: All invoices generated, all webhooks sent, no data loss
    execute: async () => {},
  },
};

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(
  category: LoadTestScenario['category']
): LoadTestScenario[] {
  return Object.values(LOAD_TEST_SCENARIOS).filter(s => s.category === category);
}

/**
 * Get all scenario IDs
 */
export function getAllScenarioIds(): string[] {
  return Object.keys(LOAD_TEST_SCENARIOS);
}
```

#### 1.12.4 Database Seeder for Performance Tests

```typescript
// File: packages/core/src/testing/performance/performance-seeder.ts

/**
 * Seeder configuration for performance tests
 */
export interface PerformanceSeederConfig {
  /** Number of customers to create */
  customerCount: number;
  /** Subscriptions per customer (average) */
  subscriptionsPerCustomer: number;
  /** Payments per subscription (average) */
  paymentsPerSubscription: number;
  /** Invoices per subscription (average) */
  invoicesPerSubscription: number;
  /** Usage records per subscription (for usage-based) */
  usageRecordsPerSubscription: number;
  /** Number of plans to create */
  planCount: number;
  /** Number of promo codes to create */
  promoCodeCount: number;
  /** Batch size for insertions */
  batchSize: number;
}

/**
 * Default configurations for different test sizes
 */
export const SEEDER_PRESETS: Record<string, PerformanceSeederConfig> = {
  small: {
    customerCount: 1000,
    subscriptionsPerCustomer: 1,
    paymentsPerSubscription: 3,
    invoicesPerSubscription: 3,
    usageRecordsPerSubscription: 100,
    planCount: 10,
    promoCodeCount: 50,
    batchSize: 100,
  },
  medium: {
    customerCount: 10000,
    subscriptionsPerCustomer: 1.5,
    paymentsPerSubscription: 6,
    invoicesPerSubscription: 6,
    usageRecordsPerSubscription: 500,
    planCount: 25,
    promoCodeCount: 200,
    batchSize: 500,
  },
  large: {
    customerCount: 100000,
    subscriptionsPerCustomer: 2,
    paymentsPerSubscription: 12,
    invoicesPerSubscription: 12,
    usageRecordsPerSubscription: 1000,
    planCount: 50,
    promoCodeCount: 500,
    batchSize: 1000,
  },
  stress: {
    customerCount: 500000,
    subscriptionsPerCustomer: 2,
    paymentsPerSubscription: 24,
    invoicesPerSubscription: 24,
    usageRecordsPerSubscription: 5000,
    planCount: 100,
    promoCodeCount: 1000,
    batchSize: 5000,
  },
};

/**
 * Seeding progress callback
 */
export type SeedProgressCallback = (progress: {
  phase: string;
  current: number;
  total: number;
  percentComplete: number;
  estimatedRemainingMs: number;
}) => void;

/**
 * Performance test database seeder
 */
export class PerformanceSeeder {
  private readonly config: PerformanceSeederConfig;
  private progressCallback?: SeedProgressCallback;

  constructor(config: PerformanceSeederConfig | keyof typeof SEEDER_PRESETS) {
    this.config =
      typeof config === 'string' ? SEEDER_PRESETS[config] : config;
  }

  /**
   * Set progress callback
   */
  onProgress(callback: SeedProgressCallback): this {
    this.progressCallback = callback;
    return this;
  }

  /**
   * Seed the database with test data
   */
  async seed(db: unknown): Promise<{
    customers: number;
    subscriptions: number;
    payments: number;
    invoices: number;
    usageRecords: number;
    plans: number;
    promoCodes: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const stats = {
      customers: 0,
      subscriptions: 0,
      payments: 0,
      invoices: 0,
      usageRecords: 0,
      plans: 0,
      promoCodes: 0,
      durationMs: 0,
    };

    // Phase 1: Create plans
    await this.seedPlans(db, stats);

    // Phase 2: Create promo codes
    await this.seedPromoCodes(db, stats);

    // Phase 3: Create customers
    await this.seedCustomers(db, stats);

    // Phase 4: Create subscriptions
    await this.seedSubscriptions(db, stats);

    // Phase 5: Create payments
    await this.seedPayments(db, stats);

    // Phase 6: Create invoices
    await this.seedInvoices(db, stats);

    // Phase 7: Create usage records
    await this.seedUsageRecords(db, stats);

    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  private async seedPlans(db: unknown, stats: { plans: number }): Promise<void> {
    const { planCount, batchSize } = this.config;
    // Implementation: batch insert plans
    stats.plans = planCount;
    this.reportProgress('plans', planCount, planCount);
  }

  private async seedPromoCodes(
    db: unknown,
    stats: { promoCodes: number }
  ): Promise<void> {
    const { promoCodeCount, batchSize } = this.config;
    // Implementation: batch insert promo codes
    stats.promoCodes = promoCodeCount;
    this.reportProgress('promoCodes', promoCodeCount, promoCodeCount);
  }

  private async seedCustomers(
    db: unknown,
    stats: { customers: number }
  ): Promise<void> {
    const { customerCount, batchSize } = this.config;
    // Implementation: batch insert customers
    stats.customers = customerCount;
    this.reportProgress('customers', customerCount, customerCount);
  }

  private async seedSubscriptions(
    db: unknown,
    stats: { subscriptions: number }
  ): Promise<void> {
    const { customerCount, subscriptionsPerCustomer, batchSize } = this.config;
    const total = Math.floor(customerCount * subscriptionsPerCustomer);
    // Implementation: batch insert subscriptions
    stats.subscriptions = total;
    this.reportProgress('subscriptions', total, total);
  }

  private async seedPayments(
    db: unknown,
    stats: { payments: number; subscriptions: number }
  ): Promise<void> {
    const { paymentsPerSubscription, batchSize } = this.config;
    const total = stats.subscriptions * paymentsPerSubscription;
    // Implementation: batch insert payments
    stats.payments = total;
    this.reportProgress('payments', total, total);
  }

  private async seedInvoices(
    db: unknown,
    stats: { invoices: number; subscriptions: number }
  ): Promise<void> {
    const { invoicesPerSubscription, batchSize } = this.config;
    const total = stats.subscriptions * invoicesPerSubscription;
    // Implementation: batch insert invoices
    stats.invoices = total;
    this.reportProgress('invoices', total, total);
  }

  private async seedUsageRecords(
    db: unknown,
    stats: { usageRecords: number; subscriptions: number }
  ): Promise<void> {
    const { usageRecordsPerSubscription, batchSize } = this.config;
    const total = stats.subscriptions * usageRecordsPerSubscription;
    // Implementation: batch insert usage records
    stats.usageRecords = total;
    this.reportProgress('usageRecords', total, total);
  }

  private reportProgress(phase: string, current: number, total: number): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase,
        current,
        total,
        percentComplete: (current / total) * 100,
        estimatedRemainingMs: 0, // Would be calculated based on rate
      });
    }
  }
}
```

#### 1.12.5 K6 Load Test Scripts

```javascript
// File: packages/core/tests/performance/k6/api-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const createCustomerDuration = new Trend('create_customer_duration');
const getCustomerDuration = new Trend('get_customer_duration');
const createSubscriptionDuration = new Trend('create_subscription_duration');
const validatePromoCodeDuration = new Trend('validate_promo_code_duration');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    // Load test
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50 VUs
        { duration: '2m', target: 100 },  // Ramp to 100
        { duration: '5m', target: 100 },  // Stay at 100
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'load' },
    },
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 400 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },  // Spike to 100
        { duration: '1m', target: 100 },
        { duration: '10s', target: 500 },  // Spike to 500
        { duration: '3m', target: 500 },
        { duration: '10s', target: 100 },  // Back to 100
        { duration: '1m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    // Overall
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],

    // Per-operation thresholds
    create_customer_duration: ['p(95)<100', 'p(99)<200'],
    get_customer_duration: ['p(95)<30', 'p(99)<50'],
    create_subscription_duration: ['p(95)<400', 'p(99)<800'],
    validate_promo_code_duration: ['p(95)<80', 'p(99)<150'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

// Helper to generate unique IDs
function generateId() {
  return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function () {
  const customerId = generateId();

  // 1. Create Customer
  {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/customers`,
      JSON.stringify({
        id: customerId,
        email: `${customerId}@perftest.com`,
        name: `Performance Test User ${customerId}`,
      }),
      { headers }
    );

    createCustomerDuration.add(Date.now() - start);

    const success = check(res, {
      'create customer status is 201': (r) => r.status === 201,
      'create customer has id': (r) => JSON.parse(r.body).id === customerId,
    });

    errorRate.add(!success);
  }

  sleep(0.1);

  // 2. Get Customer
  {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/customers/${customerId}`, { headers });

    getCustomerDuration.add(Date.now() - start);

    const success = check(res, {
      'get customer status is 200': (r) => r.status === 200,
      'get customer has correct id': (r) => JSON.parse(r.body).id === customerId,
    });

    errorRate.add(!success);
  }

  sleep(0.1);

  // 3. Validate Promo Code
  {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/promo-codes/validate`,
      JSON.stringify({
        code: 'PERF10',
        customerId,
        planId: 'plan_monthly',
      }),
      { headers }
    );

    validatePromoCodeDuration.add(Date.now() - start);

    const success = check(res, {
      'validate promo status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });

    errorRate.add(!success);
  }

  sleep(0.1);

  // 4. Create Subscription
  {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/subscriptions`,
      JSON.stringify({
        customerId,
        planId: 'plan_monthly',
      }),
      { headers }
    );

    createSubscriptionDuration.add(Date.now() - start);

    const success = check(res, {
      'create subscription status is 201': (r) => r.status === 201,
      'create subscription has id': (r) => JSON.parse(r.body).id !== undefined,
    });

    errorRate.add(!success);
  }

  sleep(0.5);
}

// Teardown - runs once after all iterations
export function teardown(data) {
  console.log('Load test completed');
}
```

#### 1.12.6 K6 Webhook Stress Test

```javascript
// File: packages/core/tests/performance/k6/webhook-stress-test.js

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import crypto from 'k6/crypto';

// Custom metrics
const webhookProcessed = new Counter('webhooks_processed');
const webhookFailed = new Counter('webhooks_failed');
const webhookDuration = new Trend('webhook_processing_duration');
const webhookErrorRate = new Rate('webhook_error_rate');

export const options = {
  scenarios: {
    // Sustained load
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 1000,           // 1000 webhooks per minute
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      tags: { test_type: 'sustained' },
    },
    // Burst test
    burst: {
      executor: 'constant-arrival-rate',
      rate: 5000,           // 5000 webhooks per minute (burst)
      timeUnit: '1m',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      startTime: '6m',      // Start after sustained test
      tags: { test_type: 'burst' },
    },
  },
  thresholds: {
    webhook_processing_duration: ['p(95)<500', 'p(99)<1000'],
    webhook_error_rate: ['rate<0.01'],
    webhooks_processed: ['count>4500'],  // At least 90% success in sustained
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'whsec_test_secret';

// Generate Stripe-compatible signature
function generateStripeSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');
  return `t=${timestamp},v1=${signature}`;
}

// Pre-generated event types for variety
const EVENT_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'charge.refunded',
];

function generateWebhookPayload(eventType) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = {
    id: eventId,
    object: 'event',
    api_version: '2024-06-20',
    created: timestamp,
    type: eventType,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: generateEventData(eventType),
    },
  };

  return { payload, timestamp, eventId };
}

function generateEventData(eventType) {
  const customerId = `cus_perf_${Math.random().toString(36).substr(2, 9)}`;

  switch (eventType) {
    case 'payment_intent.succeeded':
      return {
        id: `pi_${Math.random().toString(36).substr(2, 24)}`,
        object: 'payment_intent',
        amount: Math.floor(Math.random() * 100000) + 1000,
        currency: 'usd',
        customer: customerId,
        status: 'succeeded',
      };
    case 'customer.subscription.created':
      return {
        id: `sub_${Math.random().toString(36).substr(2, 24)}`,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };
    default:
      return {
        id: `obj_${Math.random().toString(36).substr(2, 24)}`,
        object: 'unknown',
      };
  }
}

export default function () {
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const { payload, timestamp, eventId } = generateWebhookPayload(eventType);
  const payloadStr = JSON.stringify(payload);
  const signature = generateStripeSignature(payloadStr, WEBHOOK_SECRET, timestamp);

  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/webhooks/stripe`,
    payloadStr,
    {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
    }
  );

  const duration = Date.now() - start;
  webhookDuration.add(duration);

  const success = check(res, {
    'webhook accepted': (r) => r.status === 200,
    'response is fast': (r) => duration < 1000,
  });

  if (success) {
    webhookProcessed.add(1);
  } else {
    webhookFailed.add(1);
  }

  webhookErrorRate.add(!success);
}
```

#### 1.12.7 Performance Test Runner

```typescript
// File: packages/core/tests/performance/run-performance-tests.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PerformanceTestHelper,
  performanceHelper,
} from '../../src/testing/performance/performance-test-helper';
import {
  LOAD_TEST_SCENARIOS,
  getScenariosByCategory,
} from '../../src/testing/performance/load-test-scenarios';
import { PerformanceSeeder, SEEDER_PRESETS } from '../../src/testing/performance/performance-seeder';
import { createTestDatabase } from '../utils/test-database';
import { createQZPayBilling } from '../../src';

/**
 * Performance test suite
 *
 * Run with: pnpm test:perf
 * Or specific category: pnpm test:perf -- --grep "API"
 */
describe('Performance Tests', () => {
  let db: ReturnType<typeof createTestDatabase>;
  let billing: ReturnType<typeof createQZPayBilling>;
  let helper: PerformanceTestHelper;

  beforeAll(async () => {
    // Setup database with performance test data
    db = createTestDatabase();
    await db.setup();

    // Seed with medium preset (10k customers)
    const seeder = new PerformanceSeeder('medium');
    seeder.onProgress((progress) => {
      console.log(
        `Seeding ${progress.phase}: ${progress.percentComplete.toFixed(1)}%`
      );
    });
    await seeder.seed(db);

    // Initialize billing
    billing = createQZPayBilling({
      storage: db.adapter,
      providers: {
        stripe: {
          secretKey: 'sk_test_perf',
          webhookSecret: 'whsec_test_perf',
        },
      },
    });

    // Register performance targets
    helper = new PerformanceTestHelper();
    helper.registerTargets(
      Object.values(LOAD_TEST_SCENARIOS).map((s) => ({
        operation: s.id,
        ...s.targets,
      }))
    );
  }, 300000); // 5 min timeout for seeding

  afterAll(async () => {
    await db.teardown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API Performance Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('API Performance', () => {
    it('PERF-API-001: Create Customer meets latency targets', async () => {
      const scenario = LOAD_TEST_SCENARIOS.API_CREATE_CUSTOMER;
      let counter = 0;

      const measurement = await helper.measure(
        scenario.id,
        async () => {
          counter++;
          await billing.customers.create({
            id: `perf_cust_${Date.now()}_${counter}`,
            email: `perf${counter}@test.com`,
            name: `Perf Test ${counter}`,
          });
        },
        scenario.config
      );

      console.log(`Create Customer: p50=${measurement.p50Ms.toFixed(2)}ms, ` +
        `p95=${measurement.p95Ms.toFixed(2)}ms, p99=${measurement.p99Ms.toFixed(2)}ms`);

      helper.assertMeetsTarget(measurement);
    });

    it('PERF-API-002: Get Customer meets latency targets', async () => {
      const scenario = LOAD_TEST_SCENARIOS.API_GET_CUSTOMER;

      // Get a random existing customer
      const customers = await billing.customers.list({ limit: 100 });
      const customerIds = customers.data.map((c) => c.id);

      const measurement = await helper.measure(
        scenario.id,
        async () => {
          const randomId = customerIds[Math.floor(Math.random() * customerIds.length)];
          await billing.customers.get(randomId);
        },
        scenario.config
      );

      console.log(`Get Customer: p50=${measurement.p50Ms.toFixed(2)}ms, ` +
        `p95=${measurement.p95Ms.toFixed(2)}ms, p99=${measurement.p99Ms.toFixed(2)}ms`);

      helper.assertMeetsTarget(measurement);
    });

    it('PERF-API-003: Validate Promo Code meets latency targets', async () => {
      const scenario = LOAD_TEST_SCENARIOS.API_VALIDATE_PROMO_CODE;

      const measurement = await helper.measure(
        scenario.id,
        async () => {
          await billing.promoCodes.validate({
            code: 'PERF10',
            customerId: 'cust_perf_1',
            planId: 'plan_monthly',
          });
        },
        scenario.config
      );

      console.log(`Validate Promo: p50=${measurement.p50Ms.toFixed(2)}ms, ` +
        `p95=${measurement.p95Ms.toFixed(2)}ms, p99=${measurement.p99Ms.toFixed(2)}ms`);

      helper.assertMeetsTarget(measurement);
    });

    it('PERF-API-004: Record Usage meets throughput targets', async () => {
      const scenario = LOAD_TEST_SCENARIOS.API_RECORD_USAGE;

      // Get subscriptions with usage-based plans
      const subscriptions = await billing.subscriptions.list({
        status: 'active',
        limit: 100,
      });
      const subIds = subscriptions.data.map((s) => s.id);

      let counter = 0;
      const measurement = await helper.measure(
        scenario.id,
        async () => {
          counter++;
          const subId = subIds[Math.floor(Math.random() * subIds.length)];
          await billing.usage.record({
            subscriptionId: subId,
            metricId: 'api_calls',
            quantity: Math.floor(Math.random() * 100) + 1,
            timestamp: new Date(),
          });
        },
        scenario.config
      );

      console.log(`Record Usage: p50=${measurement.p50Ms.toFixed(2)}ms, ` +
        `ops/sec=${measurement.opsPerSecond.toFixed(2)}`);

      helper.assertMeetsTarget(measurement);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Database Performance Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Database Performance', () => {
    it('PERF-DB-001: Customer lookup by ID is fast', async () => {
      const scenario = LOAD_TEST_SCENARIOS.DB_CUSTOMER_LOOKUP;

      const customers = await billing.customers.list({ limit: 1000 });
      const ids = customers.data.map((c) => c.id);

      const measurement = await helper.measure(
        scenario.id,
        async () => {
          const id = ids[Math.floor(Math.random() * ids.length)];
          await db.query(`SELECT * FROM billing_customers WHERE id = $1`, [id]);
        },
        scenario.config
      );

      console.log(`DB Customer Lookup: p50=${measurement.p50Ms.toFixed(2)}ms, ` +
        `ops/sec=${measurement.opsPerSecond.toFixed(2)}`);

      helper.assertMeetsTarget(measurement);
    });

    it('PERF-DB-002: Subscription with joins is performant', async () => {
      const scenario = LOAD_TEST_SCENARIOS.DB_SUBSCRIPTION_JOIN;

      const subs = await billing.subscriptions.list({ limit: 500 });
      const ids = subs.data.map((s) => s.id);

      const measurement = await helper.measure(
        scenario.id,
        async () => {
          const id = ids[Math.floor(Math.random() * ids.length)];
          await db.query(
            `SELECT s.*, c.email, c.name, p.name as plan_name
             FROM billing_subscriptions s
             JOIN billing_customers c ON s.customer_id = c.id
             JOIN billing_plans p ON s.plan_id = p.id
             WHERE s.id = $1`,
            [id]
          );
        },
        scenario.config
      );

      console.log(`DB Subscription Join: p50=${measurement.p50Ms.toFixed(2)}ms`);

      helper.assertMeetsTarget(measurement);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Concurrency Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Concurrency Tests', () => {
    it('PERF-CONC-001: Concurrent checkout sessions complete successfully', async () => {
      const concurrentSessions = 50;
      const results: { success: boolean; duration: number }[] = [];

      const startTime = Date.now();

      await Promise.all(
        Array(concurrentSessions)
          .fill(null)
          .map(async (_, i) => {
            const sessionStart = Date.now();
            try {
              await billing.checkout.createSession({
                customerId: `cust_conc_${i}`,
                items: [{ planId: 'plan_monthly', quantity: 1 }],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
              });
              results.push({ success: true, duration: Date.now() - sessionStart });
            } catch {
              results.push({ success: false, duration: Date.now() - sessionStart });
            }
          })
      );

      const totalDuration = Date.now() - startTime;
      const successCount = results.filter((r) => r.success).length;
      const avgDuration =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      console.log(
        `Concurrent Checkouts: ${successCount}/${concurrentSessions} succeeded, ` +
        `avg=${avgDuration.toFixed(2)}ms, total=${totalDuration}ms`
      );

      expect(successCount).toBe(concurrentSessions);
      expect(avgDuration).toBeLessThan(2000);
    });

    it('PERF-CONC-002: Concurrent subscription updates have no race conditions', async () => {
      // Create a subscription to update
      const sub = await billing.subscriptions.create({
        customerId: 'cust_race_test',
        planId: 'plan_basic',
      });

      const concurrentUpdates = 10;
      const updates = ['plan_pro', 'plan_enterprise', 'plan_basic'];
      const results: { success: boolean; version: number }[] = [];

      await Promise.all(
        Array(concurrentUpdates)
          .fill(null)
          .map(async (_, i) => {
            try {
              const newPlan = updates[i % updates.length];
              const updated = await billing.subscriptions.changePlan(sub.id, newPlan);
              results.push({ success: true, version: updated.version });
            } catch (e) {
              // Optimistic lock errors are expected
              results.push({ success: false, version: -1 });
            }
          })
      );

      const successCount = results.filter((r) => r.success).length;

      // At least one should succeed, and we should have proper versioning
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalSub = await billing.subscriptions.get(sub.id);
      expect(finalSub).toBeDefined();
      expect(finalSub!.version).toBeGreaterThanOrEqual(1);

      console.log(
        `Concurrent Updates: ${successCount}/${concurrentUpdates} succeeded, ` +
        `final version=${finalSub!.version}`
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Memory Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Memory Tests', () => {
    it('PERF-MEM-001: Large result set does not cause memory spike', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Fetch all customers in pages
      let page = 0;
      let total = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await billing.customers.list({
          limit: 100,
          offset: page * 100,
        });
        total += result.data.length;
        hasMore = result.hasMore;
        page++;

        // Check memory after each page
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (currentMemory - initialMemory) / 1024 / 1024;

        // Should not increase by more than 50MB
        expect(memoryIncrease).toBeLessThan(50);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory Test: Processed ${total} customers, ` +
        `memory increase=${totalIncrease.toFixed(2)}MB`
      );
    });
  });
});
```

#### 1.12.8 Performance Test Configuration

```typescript
// File: packages/core/tests/performance/vitest.perf.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/performance/**/*.test.ts'],
    exclude: ['tests/performance/k6/**'],
    testTimeout: 300000, // 5 minutes per test
    hookTimeout: 600000, // 10 minutes for setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single process for accurate measurements
      },
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/performance.json',
    },
    env: {
      NODE_ENV: 'test',
      PERF_TEST: 'true',
    },
  },
});
```

#### 1.12.9 CI/CD Performance Test Requirements

```yaml
# .github/workflows/ci.yml (performance test section)

performance-tests:
  runs-on: ubuntu-latest
  timeout-minutes: 30
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: qzpay_perf
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432

  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v2

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install

    - name: Build packages
      run: pnpm build

    - name: Run performance tests
      run: pnpm test:perf
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/qzpay_perf
        NODE_OPTIONS: '--expose-gc'

    - name: Upload performance results
      uses: actions/upload-artifact@v4
      with:
        name: performance-results
        path: test-results/performance.json

    - name: Check performance regression
      run: |
        # Compare against baseline
        if [ -f "baseline/performance.json" ]; then
          node scripts/check-perf-regression.js \
            --baseline baseline/performance.json \
            --current test-results/performance.json \
            --threshold 20
        fi

    - name: Comment on PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('test-results/performance.json'));

          let comment = '## Performance Test Results\n\n';
          comment += '| Operation | P50 | P95 | P99 | Status |\n';
          comment += '|-----------|-----|-----|-----|--------|\n';

          for (const test of results.testResults) {
            const status = test.passed ? '✅' : '❌';
            comment += `| ${test.name} | ${test.p50}ms | ${test.p95}ms | ${test.p99}ms | ${status} |\n`;
          }

          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });

k6-load-tests:
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs: [performance-tests]
  if: github.ref == 'refs/heads/main' || contains(github.event.pull_request.labels.*.name, 'load-test')
  steps:
    - uses: actions/checkout@v4

    - name: Setup k6
      run: |
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6

    - name: Start test server
      run: |
        pnpm build
        pnpm start:test &
        sleep 10

    - name: Run k6 load tests
      run: |
        k6 run packages/core/tests/performance/k6/api-load-test.js \
          --out json=k6-results.json \
          -e BASE_URL=http://localhost:3000 \
          -e API_KEY=${{ secrets.TEST_API_KEY }}

    - name: Upload k6 results
      uses: actions/upload-artifact@v4
      with:
        name: k6-results
        path: k6-results.json
```

#### 1.12.10 Performance Testing Tasks

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 1.12.1 | Define performance targets | Document all latency and throughput SLOs | - |
| 1.12.2 | Create PerformanceTestHelper | Measurement, comparison, assertions | 1.2.7 |
| 1.12.3 | Write PerformanceTestHelper tests | Unit tests for helper class | 1.12.2 |
| 1.12.4 | Define load test scenarios | All scenario configurations | 1.12.2 |
| 1.12.5 | Create PerformanceSeeder | Database seeder with presets | 1.9.3 |
| 1.12.6 | Write PerformanceSeeder tests | Test seeding accuracy | 1.12.5 |
| 1.12.7 | Create k6 API load test script | Main API endpoint tests | 1.12.4 |
| 1.12.8 | Create k6 webhook stress test | Webhook burst testing | 1.12.4, 1.11.3 |
| 1.12.9 | Create performance test runner | Vitest-based runner | 1.12.2-1.12.5 |
| 1.12.10 | Implement API performance tests | All API scenarios | 1.12.9 |
| 1.12.11 | Implement DB performance tests | Database query tests | 1.12.9 |
| 1.12.12 | Implement concurrency tests | Race condition testing | 1.12.9 |
| 1.12.13 | Implement memory tests | Memory leak detection | 1.12.9 |
| 1.12.14 | Create vitest perf config | Separate config for perf tests | 1.12.9 |
| 1.12.15 | Setup CI performance testing | GitHub Actions workflow | 1.12.9-1.12.14 |
| 1.12.16 | Create regression check script | Compare against baseline | 1.12.15 |
| 1.12.17 | Document performance testing | Developer documentation | 1.12.1-1.12.16 |

---

## Phase 2: Storage Layer

### 2.1 Storage Adapter Interface

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 2.1.1 | Define customers collection | CRUD operations interface | 1.5.2 |
| 2.1.2 | Define subscriptions collection | CRUD + query + helpers operations | 1.5.2 |
| 2.1.3 | Define payments collection | CRUD + history queries | 1.5.2 |
| 2.1.4 | Define invoices collection | CRUD + number generation | 1.5.2 |
| 2.1.5 | Define promoCodes collection | CRUD + validation queries | 1.5.2 |
| 2.1.6 | Define promoCodeUsage collection | Track usage operations | 1.5.2 |
| 2.1.7 | Define plans collection | CRUD with entitlements/limits | 1.5.2 |
| 2.1.8 | Define vendors collection | CRUD + onboarding | 1.5.2 |
| 2.1.9 | Define vendorPayouts collection | Create, list operations | 1.5.2 |
| 2.1.10 | Define paymentMethods collection | CRUD + default handling | 1.5.2 |
| 2.1.11 | Define auditLogs collection | Create, query operations | 1.5.2 |
| 2.1.12 | Define webhookEvents collection | Idempotency operations | 1.5.2 |
| 2.1.13 | Define jobExecutions collection | Job tracking operations | 1.5.2 |
| 2.1.14 | Define usageRecords collection | Usage tracking for limits | 1.5.2 |
| 2.1.15 | Define automaticDiscounts collection | CRUD + condition matching | 1.5.2 |
| 2.1.16 | Define automaticDiscountUsage collection | Usage tracking | 1.5.2 |
| 2.1.17 | Define creditNotes collection | CRUD + invoice linking + status queries | 1.5.2 |
| 2.1.18 | Define exports collection | Create + status update + customer query | 1.5.2 |
| 2.1.19 | Define exchangeRates collection | Upsert + query by currency pair + expiration | 1.5.2 |
| 2.1.20 | Define customerDiscounts collection | CRUD + active query by customer | 1.5.2 |
| 2.1.21 | Define subscriptionAddons collection | CRUD + subscription query | 1.5.2 |
| 2.1.22 | Define planVersions collection | CRUD + active version query | 1.5.2 |
| 2.1.23 | Define webhookDeliveries collection | Create + status update + retry query | 1.5.2 |
| 2.1.24 | Define trialHistory collection | Create + customer query | 1.5.2 |
| 2.1.25 | Define disputes collection | CRUD + status query | 1.5.2 |
| 2.1.26 | Define pricingSnapshots collection | Create + query by subscription + date range | 1.5.2 |

### 2.2 Drizzle Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 2.2.1 | Create packages/drizzle directory | Initialize package | 1.1.1 |
| 2.2.2 | Create drizzle package.json | Dependencies: drizzle-orm | 2.2.1 |
| 2.2.3 | Create drizzle tsconfig.json | Extend base config | 2.2.1 |
| 2.2.4 | Setup tsup config | Bundle configuration | 2.2.2 |
| 2.2.5 | Create src/index.ts | Main exports | 2.2.1 |

### 2.3 Drizzle Schema

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 2.3.1 | Create schema/customers.ts | QZPayCustomers table definition | 2.2.5 |
| 2.3.2 | Create schema/subscriptions.ts | QZPaySubscriptions with plan reference | 2.2.5 |
| 2.3.3 | Create schema/payments.ts | QZPayPayments table definition | 2.2.5 |
| 2.3.4 | Create schema/invoices.ts | QZPayInvoices table definition | 2.2.5 |
| 2.3.5 | Create schema/promo-codes.ts | QZPayPromoCodes with all types | 2.2.5 |
| 2.3.6 | Create schema/promo-code-usage.ts | QZPayPromoCodeUsage tracking table | 2.2.5 |
| 2.3.7 | Create schema/plans.ts | QZPayPlans with entitlements/limits JSONB | 2.2.5 |
| 2.3.8 | Create schema/vendors.ts | QZPayVendors table definition | 2.2.5 |
| 2.3.9 | Create schema/vendor-payouts.ts | QZPayVendorPayouts table definition | 2.2.5 |
| 2.3.10 | Create schema/payment-methods.ts | QZPayPaymentMethods table | 2.2.5 |
| 2.3.11 | Create schema/audit-logs.ts | QZPayAuditLogs table | 2.2.5 |
| 2.3.12 | Create schema/webhook-events.ts | QZPayWebhookEvents table | 2.2.5 |
| 2.3.13 | Create schema/job-executions.ts | QZPayJobExecutions table | 2.2.5 |
| 2.3.14 | Create schema/usage-records.ts | QZPayUsageRecords for limits | 2.2.5 |
| 2.3.15 | Create schema/automatic-discounts.ts | QZPayAutomaticDiscounts table | 2.2.5 |
| 2.3.16 | Create schema/automatic-discount-usage.ts | QZPayAutomaticDiscountUsage tracking | 2.2.5 |
| 2.3.17 | Create schema/credit-notes.ts | QZPayCreditNotes table | 2.2.5 |
| 2.3.18 | Create schema/exports.ts | QZPayExports table | 2.2.5 |
| 2.3.19 | Create schema/exchange-rates.ts | QZPayExchangeRates table | 2.2.5 |
| 2.3.20 | Create schema/customer-discounts.ts | QZPayCustomerDiscounts table | 2.2.5 |
| 2.3.21 | Create schema/subscription-addons.ts | QZPaySubscriptionAddons table | 2.2.5 |
| 2.3.22 | Create schema/plan-versions.ts | QZPayPlanVersions table | 2.2.5 |
| 2.3.23 | Create schema/webhook-deliveries.ts | QZPayWebhookDeliveries table | 2.2.5 |
| 2.3.24 | Create schema/trial-history.ts | QZPayTrialHistory table | 2.2.5 |
| 2.3.25 | Create schema/disputes.ts | QZPayDisputes table | 2.2.5 |
| 2.3.26 | Create schema/pricing-snapshots.ts | QZPayPricingSnapshots table | 2.2.5 |
| 2.3.27 | Create schema/index.ts | Export all schemas | 2.3.1-2.3.26 |
| 2.3.28 | Create schema/relations.ts | Define table relations | 2.3.1-2.3.26 |
| 2.3.29 | Create schema/currencies.ts | QZPayCurrencies reference table | 2.2.5 |
| 2.3.30 | Create schema/promo-code-analytics.ts | QZPayPromoCodeAnalytics table | 2.2.5 |
| 2.3.31 | Create schema/vendor-analytics.ts | QZPayVendorAnalytics table | 2.2.5 |

#### 2.3A Currency Foreign Key Requirements

**CRITICAL**: All schema files with currency fields MUST include FK to `currencies.code`. See DATA-MODEL.md Section 1.5.

| Schema File | Field(s) | FK Pattern |
|-------------|----------|------------|
| `payments.ts` | `currency`, `baseCurrency` | `.references(() => currencies.code)` |
| `subscriptions.ts` | `currency` | `.references(() => currencies.code)` |
| `invoices.ts` | `currency` | `.references(() => currencies.code)` |
| `credit-notes.ts` | `currency` | `.references(() => currencies.code)` |
| `vendor-payouts.ts` | `currency` | `.references(() => currencies.code)` |
| `disputes.ts` | `currency` | `.references(() => currencies.code)` |
| `exchange-rates.ts` | `fromCurrency`, `toCurrency` | `.references(() => currencies.code)` |
| `pricing-snapshots.ts` | `finalCurrency` | `.references(() => currencies.code)` |
| `promo-code-analytics.ts` | `currency` | `.references(() => currencies.code)` |
| `vendor-analytics.ts` | `currency` | `.references(() => currencies.code)` |

**Example Implementation:**

```typescript
// vendor-payouts.ts
import { currencies } from './currencies';

export const vendorPayouts = pgTable('billing_vendor_payouts', {
  // ...
  currency: varchar('currency', { length: 3 })
    .notNull()
    .references(() => currencies.code),
  // ...
});
```

**Validation Checklist:**
- [ ] All currency fields have FK constraint
- [ ] All currency fields are indexed
- [ ] currencies.ts is imported in schema files with currency fields
- [ ] exchange_rates.ts has CHECK constraint for different currencies

#### 2.3A.1 Currency Table Seeding (Migration 001)

**CRITICAL**: The `billing_currencies` table MUST be seeded in the same migration that creates it. This prevents a "chicken-and-egg" problem where tables with currency FK cannot insert rows until currencies exist.

**Problem Without Combined Migration:**

```sql
-- Migration 001: Create billing_currencies (empty)
-- Migration 002: Create billing_payments (references currencies)
-- Migration 003: Seed currencies

-- Issue: Between Migration 002 and 003:
INSERT INTO billing_payments (..., currency) VALUES (..., 'USD');
-- FAILS! Foreign key violation - 'USD' doesn't exist in billing_currencies
```

**Solution: Combined Create + Seed Migration:**

```sql
-- Migration 001: Create AND seed billing_currencies
CREATE TABLE billing_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed core currencies in same migration
INSERT INTO billing_currencies (code, name, symbol, decimal_places) VALUES
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('ARS', 'Argentine Peso', '$', 2),
  ('BRL', 'Brazilian Real', 'R$', 2),
  ('MXN', 'Mexican Peso', '$', 2),
  ('CLP', 'Chilean Peso', '$', 0),
  ('COP', 'Colombian Peso', '$', 0),
  ('PEN', 'Peruvian Sol', 'S/', 2),
  ('UYU', 'Uruguayan Peso', '$U', 2);
```

**Core Currencies (Required):**

These currencies MUST be seeded and are validated on billing system initialization:

| Code | Name | Symbol | Decimals | Region |
|------|------|--------|----------|--------|
| USD | US Dollar | $ | 2 | Global |
| EUR | Euro | € | 2 | Europe |
| GBP | British Pound | £ | 2 | UK |
| ARS | Argentine Peso | $ | 2 | Argentina |
| BRL | Brazilian Real | R$ | 2 | Brazil |
| MXN | Mexican Peso | $ | 2 | Mexico |

**Optional Currencies (Admin-Addable):**

Additional currencies can be added via admin panel or additional migrations:
- CLP, COP, PEN, UYU (Latin America)
- CAD, AUD, NZD (North America, Oceania)
- JPY, CNY, KRW (Asia - note: JPY has 0 decimal places)
- CHF, SEK, NOK, DKK (Europe)

**Initialization Validation:**

The billing system MUST validate core currencies exist on startup:

```typescript
// packages/core/src/billing.ts

const CORE_CURRENCIES = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN'] as const;

async function validateCoreCurrencies(storage: QZPayStorageAdapter): Promise<void> {
  const existingCurrencies = await storage.currencies.findAll();
  const existingCodes = new Set(existingCurrencies.map(c => c.code));

  const missingCurrencies = CORE_CURRENCIES.filter(code => !existingCodes.has(code));

  if (missingCurrencies.length > 0) {
    throw new QZPayConfigurationError(
      `Missing core currencies: ${missingCurrencies.join(', ')}. ` +
      `Run migrations to seed billing_currencies table.`
    );
  }
}

// Called during createQZPayBilling()
export async function createQZPayBilling(config: QZPayConfig): Promise<QZPayBilling> {
  // ... other initialization
  await validateCoreCurrencies(config.storage);
  // ...
}
```

**Drizzle Migration Pattern:**

```typescript
// packages/drizzle/src/migrations/001_create_currencies.ts
import { sql } from 'drizzle-orm';
import { pgTable, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export async function up(db: DrizzleClient) {
  // Create table
  await db.execute(sql`
    CREATE TABLE billing_currencies (
      code VARCHAR(3) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      symbol VARCHAR(10) NOT NULL,
      decimal_places INTEGER NOT NULL DEFAULT 2,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Seed core currencies (atomic with table creation)
  await db.execute(sql`
    INSERT INTO billing_currencies (code, name, symbol, decimal_places) VALUES
      ('USD', 'US Dollar', '$', 2),
      ('EUR', 'Euro', '€', 2),
      ('GBP', 'British Pound', '£', 2),
      ('ARS', 'Argentine Peso', '$', 2),
      ('BRL', 'Brazilian Real', 'R$', 2),
      ('MXN', 'Mexican Peso', '$', 2)
  `);
}

export async function down(db: DrizzleClient) {
  await db.execute(sql`DROP TABLE IF EXISTS billing_currencies`);
}
```

---

#### 2.3A.2 Migration Rollback Strategy

All migrations MUST include both `up()` and `down()` functions for safe rollback capability.

**Rollback Requirements:**

| Requirement | Description |
|-------------|-------------|
| Reversibility | Every `up()` must have a working `down()` |
| Idempotency | Migrations should be safe to run multiple times |
| Data Preservation | Destructive operations must preserve data in rollback |
| Testing | Both `up()` and `down()` must be tested before merge |

**Safe Rollback Patterns:**

```typescript
// packages/drizzle/src/migrations/005_add_subscription_pause.ts

import { sql } from 'drizzle-orm';

/**
 * Migration: Add pause functionality to subscriptions
 *
 * ROLLBACK SAFETY:
 * - New columns are nullable initially
 * - Backfill runs as separate step
 * - Rollback preserves data in _backup columns
 */
export async function up(db: DrizzleClient) {
  // Step 1: Add new columns (nullable for safety)
  await db.execute(sql`
    ALTER TABLE billing_subscriptions
    ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN pause_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN pause_reason TEXT,
    ADD COLUMN pauses_used_this_year INTEGER DEFAULT 0
  `);

  // Step 2: Add index for pause queries
  await db.execute(sql`
    CREATE INDEX idx_subscriptions_paused
    ON billing_subscriptions(pause_until)
    WHERE paused_at IS NOT NULL
  `);

  // Step 3: Backfill defaults (separate transaction)
  await db.execute(sql`
    UPDATE billing_subscriptions
    SET pauses_used_this_year = 0
    WHERE pauses_used_this_year IS NULL
  `);

  // Step 4: Make column NOT NULL after backfill
  await db.execute(sql`
    ALTER TABLE billing_subscriptions
    ALTER COLUMN pauses_used_this_year SET NOT NULL
  `);
}

export async function down(db: DrizzleClient) {
  // Step 1: Drop index first
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_subscriptions_paused
  `);

  // Step 2: Backup data before removing columns (if needed)
  // Only backup if table has paused subscriptions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _rollback_subscription_pause_backup AS
    SELECT id, paused_at, pause_until, pause_reason, pauses_used_this_year
    FROM billing_subscriptions
    WHERE paused_at IS NOT NULL
  `);

  // Step 3: Remove columns
  await db.execute(sql`
    ALTER TABLE billing_subscriptions
    DROP COLUMN IF EXISTS paused_at,
    DROP COLUMN IF EXISTS pause_until,
    DROP COLUMN IF EXISTS pause_reason,
    DROP COLUMN IF EXISTS pauses_used_this_year
  `);

  // Note: Backup table _rollback_subscription_pause_backup preserved for manual recovery
}
```

**Destructive Migration Pattern:**

```typescript
// packages/drizzle/src/migrations/010_remove_legacy_column.ts

/**
 * Migration: Remove deprecated column
 *
 * DESTRUCTIVE OPERATION
 * - Creates backup before removal
 * - Backup retained for 30 days
 * - Requires manual confirmation in production
 */
export async function up(db: DrizzleClient) {
  // Step 1: Verify column exists
  const columnExists = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'billing_customers' AND column_name = 'legacy_id'
  `);

  if (columnExists.rows.length === 0) {
    console.log('Column legacy_id does not exist, skipping migration');
    return;
  }

  // Step 2: Create backup
  await db.execute(sql`
    CREATE TABLE _backup_customers_legacy_id AS
    SELECT id, legacy_id FROM billing_customers WHERE legacy_id IS NOT NULL
  `);

  // Step 3: Remove column
  await db.execute(sql`
    ALTER TABLE billing_customers DROP COLUMN legacy_id
  `);

  // Step 4: Log backup info
  console.log(`
    ⚠️  DESTRUCTIVE MIGRATION COMPLETED
    Backup table: _backup_customers_legacy_id
    To restore: See rollback instructions
    Backup expires: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
  `);
}

export async function down(db: DrizzleClient) {
  // Step 1: Re-add column
  await db.execute(sql`
    ALTER TABLE billing_customers
    ADD COLUMN legacy_id VARCHAR(255)
  `);

  // Step 2: Restore from backup if exists
  const backupExists = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = '_backup_customers_legacy_id'
  `);

  if (backupExists.rows.length > 0) {
    await db.execute(sql`
      UPDATE billing_customers c
      SET legacy_id = b.legacy_id
      FROM _backup_customers_legacy_id b
      WHERE c.id = b.id
    `);

    console.log('Data restored from backup table');
  } else {
    console.warn('⚠️  No backup table found. Data cannot be restored.');
  }
}
```

**Migration Testing Requirements:**

```typescript
// packages/drizzle/src/__tests__/migrations.test.ts

describe('Migration Rollback Tests', () => {
  it('should rollback migration 005_add_subscription_pause', async () => {
    const testDb = await createTestDatabase();

    // Run up migration
    await migration005.up(testDb);

    // Verify columns exist
    const columnsAfterUp = await getColumns(testDb, 'billing_subscriptions');
    expect(columnsAfterUp).toContain('paused_at');
    expect(columnsAfterUp).toContain('pause_until');

    // Insert test data
    await testDb.execute(sql`
      INSERT INTO billing_subscriptions (id, customer_id, plan_id, paused_at)
      VALUES ('sub_test', 'cust_test', 'plan_test', NOW())
    `);

    // Run down migration
    await migration005.down(testDb);

    // Verify columns removed
    const columnsAfterDown = await getColumns(testDb, 'billing_subscriptions');
    expect(columnsAfterDown).not.toContain('paused_at');
    expect(columnsAfterDown).not.toContain('pause_until');

    // Verify backup created
    const backupExists = await tableExists(testDb, '_rollback_subscription_pause_backup');
    expect(backupExists).toBe(true);

    // Run up again (should be idempotent)
    await migration005.up(testDb);
    const columnsAfterReUp = await getColumns(testDb, 'billing_subscriptions');
    expect(columnsAfterReUp).toContain('paused_at');
  });
});
```

**Production Rollback Procedure:**

```bash
# Step 1: Identify current migration version
pnpm drizzle-kit status

# Step 2: Create database backup BEFORE rollback
pg_dump -Fc billing_db > backup_$(date +%Y%m%d_%H%M%S).dump

# Step 3: Run rollback (down migration)
pnpm drizzle-kit migrate:down --to 004

# Step 4: Verify rollback success
pnpm drizzle-kit status
# Should show: "Current version: 004"

# Step 5: Test application with rolled-back schema
pnpm test:integration

# Step 6: If rollback failed, restore from backup
pg_restore -d billing_db backup_20250115_103000.dump
```

**Migration Checklist:**

- [ ] `up()` function implemented
- [ ] `down()` function implemented
- [ ] Both functions tested locally
- [ ] Destructive operations create backups
- [ ] Indexes dropped before columns in rollback
- [ ] Migrations are idempotent (safe to run twice)
- [ ] Production rollback procedure documented
- [ ] CI/CD runs both up and down in test environment

---

**Validation Checklist (Updated):**
- [ ] Migration 001 creates AND seeds billing_currencies table
- [ ] Core currencies (USD, EUR, GBP, ARS, BRL, MXN) are seeded
- [ ] createQZPayBilling() validates core currencies exist
- [ ] Error thrown with helpful message if currencies missing

#### 2.3B Timestamp Field Requirements

**CRITICAL**: All timestamp fields with `DEFAULT NOW()` MUST include `NOT NULL`. See DATA-MODEL.md Section 1.6.

| Schema File | Fields Requiring NOT NULL |
|-------------|---------------------------|
| All schemas | `createdAt`, `updatedAt` |
| `promo-code-usage.ts` | `usedAt` |
| `invoice-payments.ts` | `appliedAt` |
| `automatic-discount-usage.ts` | `appliedAt` |
| `subscription-addons.ts` | `addedAt` |
| `pricing-snapshots.ts` | `capturedAt` |
| `exports.ts` | `requestedAt` |
| `billing-anomalies.ts` | `detectedAt` |
| `event-queue.ts` | `scheduledFor` |
| `customer-discounts.ts` | `validFrom` |

**Pattern:**
```typescript
// CORRECT
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

// INCORRECT - missing .notNull()
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),  // ❌
```

**Nullable Timestamps (intentional):**
- `deletedAt` - Soft delete marker
- `paidAt`, `canceledAt`, `endedAt` - Event timestamps that may not occur
- `trialEnd`, `expiresAt` - Optional future dates
- `completedAt`, `resolvedAt` - Completion markers

**Validation Checklist:**
- [ ] All `createdAt` fields have `.notNull().defaultNow()`
- [ ] All `updatedAt` fields have `.notNull().defaultNow()`
- [ ] All other timestamp fields with `.defaultNow()` have `.notNull()`
- [ ] Nullable timestamps do NOT have `.notNull()` or `.defaultNow()`

#### 2.3C ON DELETE Referential Action Requirements

**CRITICAL**: Foreign keys MUST use the correct `ON DELETE` action. See DATA-MODEL.md Section 1.7.

| Schema File | FK Field | Parent | Action | Reason |
|-------------|----------|--------|--------|--------|
| `subscription-addons.ts` | `subscriptionId` | `subscriptions` | `restrict` | Preserve addon history for billing/audit |
| `customer-discounts.ts` | `customerId` | `customers` | `restrict` | Preserve discount history for billing/audit |
| `promo-code-analytics.ts` | `promoCodeId` | `promoCodes` | `restrict` | Analytics are immutable audit records |
| `vendor-analytics.ts` | `vendorId` | `vendors` | `restrict` | Analytics are immutable audit records |
| `pricing-snapshots.ts` | `subscriptionId` | `subscriptions` | `restrict` | Pricing history for audit/legal compliance |

**Pattern:**
```typescript
// CORRECT - RESTRICT for historical/audit data
subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),

// INCORRECT - CASCADE loses historical data
subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),  // ❌
```

**Soft Delete Implementation:**

| Schema | Soft Delete Method |
|--------|-------------------|
| `subscription-addons.ts` | Set `status = 'removed'` |
| `customer-discounts.ts` | Set `active = false` |
| Analytics tables | Immutable, never delete |

**Validation Checklist:**
- [ ] All 5 schemas use `{ onDelete: 'restrict' }`
- [ ] Application code implements soft delete for addon removal
- [ ] Application code implements soft delete for discount deactivation
- [ ] Analytics tables have NO delete operations in service layer

#### 2.3D Soft Delete Field Requirements

**CRITICAL**: Tables requiring soft delete MUST have `deleted_at` field. See DATA-MODEL.md.

| Schema File | Field | Type | Purpose |
|-------------|-------|------|---------|
| `payment-methods.ts` | `deletedAt` | `timestamp` (nullable) | Soft delete for payment methods |

**Pattern:**
```typescript
// payment-methods.ts
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

**SQL Index (required for performance):**
```sql
-- Partial index for active (non-deleted) payment methods
CREATE INDEX idx_payment_methods_customer_active ON billing_payment_methods(customer_id)
  WHERE deleted_at IS NULL;
```

**Why payment_methods needs soft delete:**
1. **Audit trail**: Past transactions reference payment methods
2. **Dispute handling**: Need to verify payment method used in disputed transactions
3. **PCI-DSS compliance**: Requires traceability of payment method changes
4. **User experience**: Allow "remove" without losing historical data

**Validation Checklist:**
- [ ] `payment-methods.ts` has `deletedAt` field
- [ ] Partial index created for active payment methods
- [ ] Service layer uses `deleted_at IS NULL` filter by default
- [ ] Delete operation sets `deleted_at = NOW()` instead of hard delete

#### 2.3E Livemode Field Requirements

**CRITICAL**: All billable entities MUST have `livemode` field for environment isolation. See DATA-MODEL.md.

| Schema File | Field | Type | Default | Purpose |
|-------------|-------|------|---------|---------|
| `customers.ts` | `livemode` | `boolean` | `true` | ✅ Already exists |
| `subscriptions.ts` | `livemode` | `boolean` | `true` | ✅ Already exists |
| `payments.ts` | `livemode` | `boolean` | `true` | ✅ Already exists |
| `invoices.ts` | `livemode` | `boolean` | `true` | ✅ Already exists |
| `payment-methods.ts` | `livemode` | `boolean` | `true` | ✅ Added (was missing) |

**Pattern:**
```typescript
// payment-methods.ts
livemode: boolean('livemode').notNull().default(true),
```

**SQL Indexes (required for environment filtering):**
```sql
-- Partial index for active payment methods by environment
CREATE INDEX idx_payment_methods_customer_active ON billing_payment_methods(customer_id, livemode)
  WHERE deleted_at IS NULL;

-- Index for livemode filtering
CREATE INDEX idx_payment_methods_livemode ON billing_payment_methods(livemode);
```

**Why livemode is critical:**
1. **Provider compatibility**: Stripe/MercadoPago distinguish test vs production
2. **Data isolation**: Test payment methods must never appear in production
3. **Consistency**: All billable entities must have livemode for correct filtering
4. **Query safety**: Prevents accidental cross-environment data access

**Service Layer Implementation:**
```typescript
// Always filter by livemode in queries
async getCustomerPaymentMethods(customerId: string, livemode: boolean) {
  return await db.query.paymentMethods.findMany({
    where: and(
      eq(paymentMethods.customerId, customerId),
      eq(paymentMethods.livemode, livemode),
      isNull(paymentMethods.deletedAt)
    )
  });
}
```

**Validation Checklist:**
- [ ] `payment-methods.ts` has `livemode` field with `.notNull().default(true)`
- [ ] Partial index includes `livemode` column
- [ ] Separate index for `livemode` filtering exists
- [ ] Service layer ALWAYS filters by `livemode`
- [ ] API endpoints receive `livemode` from context (never from user input)

#### 2.3F Livemode Index Requirements

**CRITICAL**: ALL tables with `livemode` field MUST have a dedicated index for environment filtering. See DATA-MODEL.md.

| Table | Index Name | Status |
|-------|------------|--------|
| `billing_customers` | `idx_customers_livemode` | ✅ Already exists |
| `billing_subscriptions` | `idx_subscriptions_livemode` | ✅ Already exists |
| `billing_payments` | `idx_payments_livemode` | ✅ Added |
| `billing_invoices` | `idx_invoices_livemode` | ✅ Added |
| `billing_promo_codes` | `idx_promo_codes_livemode` | ✅ Added |
| `billing_vendors` | `idx_vendors_livemode` | ✅ Added |
| `billing_payment_methods` | `idx_payment_methods_livemode` | ✅ Already exists |
| `billing_customer_discounts` | `idx_customer_discounts_livemode` | ✅ Already exists |
| `billing_promo_code_analytics` | `idx_promo_analytics_livemode` | ✅ Already exists |
| `billing_vendor_analytics` | `idx_vendor_analytics_livemode` | ✅ Already exists |
| `billing_credit_notes` | `idx_credit_notes_livemode` | ✅ Already exists |
| `billing_exports` | `idx_exports_livemode` | ✅ Added |
| `billing_audit_logs` | `idx_audit_logs_livemode` | ✅ Already exists |
| `billing_webhook_deliveries` | `idx_webhook_deliveries_livemode` | ✅ Already exists |
| `billing_customer_merges` | `idx_customer_merges_livemode` | ✅ Added |
| `billing_plan_versions` | `idx_plan_versions_livemode` | ✅ Already exists |
| `billing_event_queue` | `idx_event_queue_livemode` | ✅ Added |
| `billing_event_store` | `idx_event_store_livemode` | ✅ Already exists |
| `billing_disputes` | `idx_disputes_livemode` | ✅ Already exists |
| `billing_trial_history` | `idx_trial_history_livemode` | ✅ Already exists |
| `billing_promo_code_reservations` | `idx_promo_reservations_livemode` | ✅ Already exists |
| `billing_webhook_processing` | `idx_webhook_processing_livemode` | ✅ Already exists |

**Pattern:**
```sql
-- Standard livemode index
CREATE INDEX idx_<table>_livemode ON billing_<table>(livemode);

-- Comment (required for documentation)
-- Environment isolation index (required for all billable entities)
```

**Why livemode indexes are critical:**
1. **Query performance**: Without index, every query filtering by `livemode` does full table scan
2. **Scale impact**: As data grows, queries become exponentially slower
3. **Production safety**: Fast filtering prevents test data from appearing in production
4. **High-traffic tables**: payments, invoices, subscriptions need fast environment filtering

**Validation Checklist:**
- [ ] All 22 tables with `livemode` have corresponding index
- [ ] Index naming follows pattern `idx_<table>_livemode`
- [ ] All indexes have documentation comment
- [ ] Migration includes all 7 newly added indexes

#### 2.3G Webhook Event ID Index Requirement

**CRITICAL**: The `billing_webhook_events` table requires a standalone index on `event_id` for cross-provider lookups.

**Problem:**
The existing `UNIQUE(provider, event_id)` constraint creates a composite index ordered by `provider` first. This means queries that search by `event_id` alone cannot use this index efficiently.

**Index Added:**
```sql
-- Standalone event_id index for cross-provider lookups and debugging
-- Note: UNIQUE(provider, event_id) only works when provider is known
CREATE INDEX idx_webhook_events_event_id ON billing_webhook_events(event_id);
```

**Use Cases Enabled:**
1. **Debugging**: Search event by ID without knowing provider
2. **Admin queries**: "Has event evt_123 been processed?"
3. **Cross-provider lookup**: Check if event ID exists in any provider
4. **Log correlation**: Find event by ID from external logs

**Query Performance:**

| Query Pattern | Without Index | With Index |
|---------------|---------------|------------|
| `WHERE provider = 'stripe' AND event_id = ?` | ✅ Uses UNIQUE | ✅ Uses UNIQUE |
| `WHERE event_id = ?` | ❌ Full scan | ✅ Uses index |

**Validation Checklist:**
- [ ] `idx_webhook_events_event_id` index exists
- [ ] Index has documentation comment explaining purpose
- [ ] Service layer can search by event_id alone when needed

#### 2.3H Plan ID Type Consistency

**CRITICAL**: The `plan_id` field must use consistent types across all tables. See DATA-MODEL.md.

**Problem Fixed:**
`billing_trial_history.plan_id` was defined as `UUID REFERENCES billing_plans(id)` instead of `VARCHAR(100)` like other tables.

**Correct Pattern:**
```sql
-- plan_id should be VARCHAR, not UUID FK
-- This stores the plan identifier string (e.g., "pro_monthly")
plan_id VARCHAR(100) NOT NULL
```

```typescript
// Drizzle pattern
planId: varchar('plan_id', { length: 100 }).notNull(),
```

**Tables Using plan_id:**

| Table | Type | Status |
|-------|------|--------|
| `billing_plans` | `VARCHAR(100)` | ✅ Authoritative source |
| `billing_subscriptions` | `VARCHAR(255)` | ✅ Uses identifier |
| `billing_pricing_snapshots` | `VARCHAR(100)` | ✅ Uses identifier |
| `billing_plan_versions` | `VARCHAR(255)` | ✅ Uses identifier |
| `billing_trial_history` | `VARCHAR(100)` | ✅ Fixed (was UUID) |

**Why VARCHAR, not UUID FK:**
1. **Consistency**: All other tables use plan identifier string
2. **Decoupling**: Trials can be tracked even if plan is modified/deleted
3. **Simpler queries**: No JOIN needed to compare with subscriptions
4. **Versioning support**: Plan identifier stays constant across versions

**Validation Checklist:**
- [ ] `trial-history.ts` uses `varchar('plan_id', { length: 100 })`
- [ ] NO `.references()` on planId field
- [ ] Comment explains why VARCHAR is used instead of UUID FK

#### 2.3I Customer Merge Strategy Constraints

**CRITICAL**: All strategy fields in `billing_customer_merges` MUST have CHECK constraints. See DATA-MODEL.md.

**Problem Fixed:**
The `invoice_strategy` field was missing its CHECK constraint, allowing invalid values.

**All Strategy Fields and Valid Values:**

| Field | Valid Values | Description |
|-------|--------------|-------------|
| `subscription_strategy` | `move_all`, `keep_active_only`, `cancel_source` | How to handle subscriptions |
| `payment_strategy` | `move_all`, `keep_reference` | How to handle payment history |
| `invoice_strategy` | `move_all`, `keep_on_source`, `void_unpaid` | How to handle invoices |
| `metadata_strategy` | `merge`, `target_wins`, `source_wins` | How to merge metadata |

**Invoice Strategy Values Explained:**

| Value | Behavior |
|-------|----------|
| `move_all` | Move all invoices (paid and unpaid) to target customer |
| `keep_on_source` | Keep invoices on source customer record (before soft delete) |
| `void_unpaid` | Void unpaid invoices, move only paid invoices to target |

**SQL CHECK Constraints:**
```sql
CONSTRAINT chk_subscription_strategy CHECK (
  subscription_strategy IN ('move_all', 'keep_active_only', 'cancel_source')
),
CONSTRAINT chk_payment_strategy CHECK (
  payment_strategy IN ('move_all', 'keep_reference')
),
CONSTRAINT chk_invoice_strategy CHECK (
  invoice_strategy IN ('move_all', 'keep_on_source', 'void_unpaid')
),
CONSTRAINT chk_metadata_strategy CHECK (
  metadata_strategy IN ('merge', 'target_wins', 'source_wins')
)
```

**TypeScript Type (for service layer):**
```typescript
type InvoiceStrategy = 'move_all' | 'keep_on_source' | 'void_unpaid';
type SubscriptionStrategy = 'move_all' | 'keep_active_only' | 'cancel_source';
type PaymentStrategy = 'move_all' | 'keep_reference';
type MetadataStrategy = 'merge' | 'target_wins' | 'source_wins';
```

**Validation Checklist:**
- [ ] All 4 strategy fields have CHECK constraints
- [ ] Drizzle schema has comments documenting valid values
- [ ] Service layer uses TypeScript union types for type safety
- [ ] API validates strategy values before database insert

#### 2.3J Optimistic Locking Requirements

**CRITICAL**: Tables with concurrent update scenarios MUST use the `version` field for optimistic locking. See DATA-MODEL.md Section 1.8.

**Problem Being Prevented:**
Race conditions where concurrent updates overwrite each other, causing data loss:
- Two partial payments applied simultaneously, one payment "lost"
- Two promo code redemptions, only one `used_count` increment recorded
- Two users changing default payment method, inconsistent state

**Tables Requiring Optimistic Locking:**

| Table | `version` Field | Why Required |
|-------|-----------------|-------------|
| `billing_invoices` | `INTEGER NOT NULL DEFAULT 1` | Partial payments, status transitions |
| `billing_promo_codes` | `INTEGER NOT NULL DEFAULT 1` | Concurrent `used_count` increments |
| `billing_plans` | `INTEGER NOT NULL DEFAULT 1` | Price/feature updates |
| `billing_payment_methods` | `INTEGER NOT NULL DEFAULT 1` | `is_default` changes, metadata |

**SQL Pattern:**
```sql
-- Optimistic locking: prevents concurrent update conflicts
-- Application must include "WHERE version = X" and increment on update
version INTEGER NOT NULL DEFAULT 1,
```

**Drizzle Pattern:**
```typescript
// Optimistic locking: prevents concurrent update conflicts
// Application must include "WHERE version = X" and increment on update
version: integer('version').notNull().default(1),
```

**Application Update Pattern (MANDATORY):**
```typescript
// Step 1: Read current state including version
const invoice = await db.query.invoices.findFirst({
  where: eq(invoices.id, invoiceId)
});

// Step 2: Update with version check
const result = await db
  .update(invoices)
  .set({
    amountPaid: newAmount,
    version: invoice.version + 1,  // MUST increment
    updatedAt: new Date()
  })
  .where(
    and(
      eq(invoices.id, invoiceId),
      eq(invoices.version, invoice.version)  // MUST check version
    )
  );

// Step 3: Check if update succeeded
if (result.rowCount === 0) {
  throw new OptimisticLockError('Record was modified by another process');
}
```

**Required Service Layer Implementation:**

1. **OptimisticLockError class:**
```typescript
export class OptimisticLockError extends Error {
  constructor(
    message: string,
    public readonly table: string,
    public readonly recordId: string,
    public readonly attemptedVersion: number
  ) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}
```

2. **Retry utility with exponential backoff:**
```typescript
export async function withOptimisticRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 100 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OptimisticLockError && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Validation Checklist:**
- [ ] All 4 tables have `version INTEGER NOT NULL DEFAULT 1`
- [ ] Drizzle schema has comments explaining usage
- [ ] OptimisticLockError class implemented in `@qazuor/qzpay-core`
- [ ] withOptimisticRetry utility implemented in `@qazuor/qzpay-core`
- [ ] All update operations on these tables use version check pattern
- [ ] Conflict logging implemented for monitoring
- [ ] Unit tests verify optimistic locking behavior

### 2.4 Drizzle Storage Implementation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 2.4.1 | Write QZPayDrizzleStorage base tests | Integration tests for base class | 2.2.7, 2.3.27 |
| 2.4.2 | Create storage.ts base | QZPayDrizzleStorage class | 2.3.27, 2.4.1 |
| 2.4.3 | Write customers collection tests | Test CRUD operations | 2.4.1 |
| 2.4.4 | Implement customers collection | CRUD operations | 2.4.2, 2.1.1, 2.4.3 |
| 2.4.5 | Write subscriptions collection tests | Test CRUD + queries | 2.4.1 |
| 2.4.6 | Implement subscriptions collection | CRUD + queries | 2.4.2, 2.1.2, 2.4.5 |
| 2.4.7 | Write payments collection tests | Test CRUD + history | 2.4.1 |
| 2.4.8 | Implement payments collection | CRUD + history | 2.4.2, 2.1.3, 2.4.7 |
| 2.4.9 | Write invoices collection tests | Test CRUD + numbering | 2.4.1 |
| 2.4.10 | Implement invoices collection | CRUD + numbering | 2.4.2, 2.1.4, 2.4.9 |
| 2.4.11 | Write promoCodes collection tests | Test CRUD + validation | 2.4.1 |
| 2.4.12 | Implement promoCodes collection | CRUD + validation | 2.4.2, 2.1.5, 2.4.11 |
| 2.4.13 | Write promoCodeUsage collection tests | Test usage tracking | 2.4.1 |
| 2.4.14 | Implement promoCodeUsage collection | Usage tracking | 2.4.2, 2.1.6, 2.4.13 |
| 2.4.15 | Write plans collection tests | Test CRUD with entitlements/limits | 2.4.1 |
| 2.4.16 | Implement plans collection | CRUD with entitlements/limits | 2.4.2, 2.1.7, 2.4.15 |
| 2.4.17 | Write vendors collection tests | Test CRUD + onboarding | 2.4.1 |
| 2.4.18 | Implement vendors collection | CRUD + onboarding | 2.4.2, 2.1.8, 2.4.17 |
| 2.4.19 | Write vendorPayouts collection tests | Test payout operations | 2.4.1 |
| 2.4.20 | Implement vendorPayouts collection | Payout operations | 2.4.2, 2.1.9, 2.4.19 |
| 2.4.21 | Write paymentMethods collection tests | Test CRUD + default | 2.4.1 |
| 2.4.22 | Implement paymentMethods collection | CRUD + default | 2.4.2, 2.1.10, 2.4.21 |
| 2.4.23 | Write auditLogs collection tests | Test logging operations | 2.4.1 |
| 2.4.24 | Implement auditLogs collection | Logging operations | 2.4.2, 2.1.11, 2.4.23 |
| 2.4.25 | Write webhookEvents collection tests | Test idempotency | 2.4.1 |
| 2.4.26 | Implement webhookEvents collection | Idempotency | 2.4.2, 2.1.12, 2.4.25 |
| 2.4.27 | Write jobExecutions collection tests | Test job tracking | 2.4.1 |
| 2.4.28 | Implement jobExecutions collection | Job tracking | 2.4.2, 2.1.13, 2.4.27 |
| 2.4.29 | Write usageRecords collection tests | Test usage tracking | 2.4.1 |
| 2.4.30 | Implement usageRecords collection | Usage tracking | 2.4.2, 2.1.14, 2.4.29 |
| 2.4.31 | Write automaticDiscounts collection tests | Test CRUD + condition matching | 2.4.1 |
| 2.4.32 | Implement automaticDiscounts collection | CRUD + condition matching | 2.4.2, 2.1.15, 2.4.31 |
| 2.4.33 | Write automaticDiscountUsage collection tests | Test usage tracking | 2.4.1 |
| 2.4.34 | Implement automaticDiscountUsage collection | Usage tracking | 2.4.2, 2.1.16, 2.4.33 |
| 2.4.35 | Write creditNotes collection tests | Test CRUD + invoice linking | 2.4.1 |
| 2.4.36 | Implement creditNotes collection | CRUD + invoice linking + status | 2.4.2, 2.1.17, 2.4.35 |
| 2.4.37 | Write exports collection tests | Test export job tracking | 2.4.1 |
| 2.4.38 | Implement exports collection | Create + status + customer query | 2.4.2, 2.1.18, 2.4.37 |
| 2.4.39 | Write exchangeRates collection tests | Test upsert + currency query | 2.4.1 |
| 2.4.40 | Implement exchangeRates collection | Upsert + currency pair + expiration | 2.4.2, 2.1.19, 2.4.39 |
| 2.4.41 | Write customerDiscounts collection tests | Test CRUD + customer query | 2.4.1 |
| 2.4.42 | Implement customerDiscounts collection | CRUD + active by customer | 2.4.2, 2.1.20, 2.4.41 |
| 2.4.43 | Write subscriptionAddons collection tests | Test CRUD + subscription query | 2.4.1 |
| 2.4.44 | Implement subscriptionAddons collection | CRUD + subscription query | 2.4.2, 2.1.21, 2.4.43 |
| 2.4.45 | Write planVersions collection tests | Test version management | 2.4.1 |
| 2.4.46 | Implement planVersions collection | CRUD + active version query | 2.4.2, 2.1.22, 2.4.45 |
| 2.4.47 | Write webhookDeliveries collection tests | Test delivery tracking | 2.4.1 |
| 2.4.48 | Implement webhookDeliveries collection | Create + status + retry | 2.4.2, 2.1.23, 2.4.47 |
| 2.4.49 | Write trialHistory collection tests | Test trial tracking | 2.4.1 |
| 2.4.50 | Implement trialHistory collection | Create + customer query | 2.4.2, 2.1.24, 2.4.49 |
| 2.4.51 | Write disputes collection tests | Test CRUD + status | 2.4.1 |
| 2.4.52 | Implement disputes collection | CRUD + status query | 2.4.2, 2.1.25, 2.4.51 |
| 2.4.53 | Write pricingSnapshots collection tests | Test snapshot queries | 2.4.1 |
| 2.4.54 | Implement pricingSnapshots collection | Create + subscription + date range | 2.4.2, 2.1.26, 2.4.53 |

---

## Phase 3: Business Logic

> **Note**: Phase 3 is divided into 7 sub-phases (3A-3G) for better manageability. See Phase Summary table for task distribution and dependency diagram.

---

## Phase 3A: Core Services

> **Scope**: Customer, Plan, Subscription Helpers, and Subscription services. These are the foundational services that all other business logic depends on.

### 3.1 Customer Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.1.1 | Write QZPayCustomerService tests | Unit tests for customer operations | 1.2.7, 1.8.2 |
| 3.1.2 | Create customer.service.ts | QZPayCustomerService class | 1.8.2, 3.1.1 |
| 3.1.3 | Implement create() | Create customer | 3.1.2 |
| 3.1.4 | Implement get() | Get by ID | 3.1.2 |
| 3.1.5 | Implement getByExternalId() | Get by external ID | 3.1.2 |
| 3.1.6 | Implement update() | Update customer | 3.1.2 |
| 3.1.7 | Implement delete() | Soft delete customer | 3.1.2 |
| 3.1.8 | Implement list() | List with filters | 3.1.2 |
| 3.1.9 | Implement syncUser() | Sync with app user | 3.1.3, 3.1.5 |
| 3.1.10 | Add provider sync logic | Sync with Stripe/MP on update | 3.1.6 |

### 3.2 Plan Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.2.1 | Write QZPayPlanService tests | Unit tests for plan operations | 1.2.7, 1.8.2 |
| 3.2.2 | Create plan.service.ts | QZPayPlanService class | 1.8.2, 3.2.1 |
| 3.2.3 | Implement create() | Create plan with entitlements/limits | 3.2.2 |
| 3.2.4 | Implement get() | Get plan | 3.2.2 |
| 3.2.5 | Implement list() | List all plans | 3.2.2 |
| 3.2.6 | Implement update() | Update plan | 3.2.2 |
| 3.2.7 | Implement getEntitlements() | Get plan entitlements | 3.2.2 |
| 3.2.8 | Implement getLimits() | Get plan limits | 3.2.2 |
| 3.2.9 | Implement validateTrialConfig() | Validate trial settings | 3.2.2 |

### 3.3 Subscription Helpers

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3.1 | Write subscription helper tests | Unit tests for all helpers | 1.2.7 |
| 3.3.2 | Create subscription-helpers.ts | Helper function factory | 3.3.1 |
| 3.3.3 | Implement isActive() | Check if status is active | 3.3.2 |
| 3.3.4 | Implement isTrial() | Check if status is trialing | 3.3.2 |
| 3.3.5 | Implement hasAccess() | Active, trialing, or grace period | 3.3.2 |
| 3.3.6 | Implement hasPaymentMethod() | Check payment method attached | 3.3.2 |
| 3.3.7 | Implement isInGracePeriod() | Check if in grace period | 3.3.2 |
| 3.3.8 | Implement willCancel() | Check if cancelAt is set | 3.3.2 |
| 3.3.9 | Implement daysUntilRenewal() | Calculate days to renewal | 3.3.2 |
| 3.3.10 | Implement daysUntilTrialEnd() | Calculate days to trial end | 3.3.2 |
| 3.3.11 | Implement getEntitlements<T>() | Get typed entitlements from plan | 3.3.2 |
| 3.3.12 | Implement getLimits<T>() | Get typed limits from plan | 3.3.2 |
| 3.3.13 | Implement hasEntitlement(key) | Check single entitlement | 3.3.11 |
| 3.3.14 | Implement getLimit(key) | Get single limit value | 3.3.12 |
| 3.3.15 | Write checkLimit tests | Test limit validation helper | 3.3.1 |
| 3.3.16 | Implement checkLimit() | Project provides count, compare against plan limit | 3.3.15, 3.3.12 |
| 3.3.17 | Write checkOverage tests | Test overage detection for downgrades | 3.3.1 |
| 3.3.18 | Implement checkOverage() | Detect overage before/after downgrade | 3.3.17, 3.3.12 |
| 3.3.19 | Implement hasOverage() | Check if subscription has unresolved overage | 3.3.2 |
| 3.3.20 | Implement getOverageDetails() | Get overage details if in overage state | 3.3.19 |
| 3.3.21 | Implement isInOverageGracePeriod() | Check if in grace period for overage | 3.3.19 |
| 3.3.22 | Implement getOverageGraceDaysRemaining() | Days remaining in overage grace period | 3.3.21 |
| 3.3.23 | Create attachHelpers() | Attach all helpers to subscription | 3.3.3-3.3.22 |

### 3.3B Limit Overage Handling

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3B.1 | Define QZPayOverageHandlingConfig | Config interface for overage handling | 1.2.6 |
| 3.3B.2 | Define QZPayOverageDetails | Interface for overage state on subscription | 1.2.6 |
| 3.3B.3 | Add overageDetails to QZPaySubscription | Store overage state on subscription | 2.2.1 |
| 3.3B.4 | Write overage detection tests | Test detection on changePlan | 3.3.18 |
| 3.3B.5 | Implement overage detection in changePlan | Detect and store overage on downgrade | 3.3B.4, 3.4.17 |
| 3.3B.6 | Write grace period start tests | Test grace period initiation | 3.3B.4 |
| 3.3B.7 | Implement grace period initiation | Start grace period, emit events | 3.3B.6 |
| 3.3B.8 | Create OverageGraceJob | Job for grace period reminders | 3.18.1 |
| 3.3B.9 | Write grace period reminder tests | Test reminder job | 3.3B.8 |
| 3.3B.10 | Implement grace period reminders | Send reminders at configured intervals | 3.3B.9 |
| 3.3B.11 | Create OverageEnforcementJob | Job for enforcement after grace period | 3.18.1 |
| 3.3B.12 | Write enforcement tests | Test enforcement action | 3.3B.11 |
| 3.3B.13 | Implement enforcement action | Apply configured enforcement mode | 3.3B.12 |
| 3.3B.14 | Write overage resolution tests | Test manual resolution detection | 3.3B.4 |
| 3.3B.15 | Implement overage resolution detection | Detect when user resolves overage | 3.3B.14 |
| 3.3B.16 | Emit LIMIT_CHECK_FAILED event | Event when checkLimit returns false | 3.3.16 |
| 3.3B.17 | Emit LIMIT_OVERAGE_DETECTED event | Event when overage detected on downgrade | 3.3B.5 |
| 3.3B.18 | Emit LIMIT_OVERAGE_GRACE_STARTED event | Event when grace period starts | 3.3B.7 |
| 3.3B.19 | Emit LIMIT_OVERAGE_REMINDER event | Event during grace period | 3.3B.10 |
| 3.3B.20 | Emit LIMIT_OVERAGE_RESOLVED event | Event when user resolves overage | 3.3B.15 |
| 3.3B.21 | Emit LIMIT_OVERAGE_ENFORCED event | Event when enforcement applied | 3.3B.13 |
| 3.3B.22 | Optional ENTITLEMENT_CHECK_DENIED event | Emit when hasEntitlement returns false | 3.3.13 |

### 3.3C Subscription Pause Feature

> **Scope**: Subscription pause/resume functionality with limits.
> See PDR.md Section 3.13 FR-SUB-PAUSE-001/002/003 for full specification.

#### 3.3C.1 Pause Configuration

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.1.1 | Define QZPayPauseConfig interface | All pause configuration options | 1.2.6 |
| 3.3C.1.2 | Define QZPayYearDefinition const | 'calendar' and 'rolling' | 1.2.6 |
| 3.3C.1.3 | Define QZPayResumeType const | 'early', 'scheduled', 'auto' | 1.2.6 |
| 3.3C.1.4 | Define QZPayDefaultPauseConfig | Default values for all options | 3.3C.1.1 |
| 3.3C.1.5 | Add pause config to QZPayBillingConfig | subscriptions.pause section | 3.3C.1.1 |
| 3.3C.1.6 | Validate pause config on init | Validate config values on startup | 3.3C.1.5 |

#### 3.3C.2 Pause Helper Methods

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.2.1 | Write isPaused tests | Test status check | 3.3.1 |
| 3.3C.2.2 | Implement isPaused() | Return true if status === 'paused' | 3.3C.2.1, 3.3.2 |
| 3.3C.2.3 | Write canPause tests | Test all limit conditions | 3.3.1 |
| 3.3C.2.4 | Implement canPause() | Return { allowed, reason, nextAvailableDate } | 3.3C.2.3, 3.3.2 |
| 3.3C.2.5 | Write pausesRemaining tests | Test calendar vs rolling year | 3.3.1 |
| 3.3C.2.6 | Implement pausesRemaining() | Calculate remaining pauses for year | 3.3C.2.5, 3.3.2 |
| 3.3C.2.7 | Write pausedUntil tests | Test scheduled end date | 3.3.1 |
| 3.3C.2.8 | Implement pausedUntil() | Return Date or null | 3.3C.2.7, 3.3.2 |
| 3.3C.2.9 | Write canResumeEarly tests | Test config check | 3.3.1 |
| 3.3C.2.10 | Implement canResumeEarly() | Check config and pause state | 3.3C.2.9, 3.3.2 |
| 3.3C.2.11 | Write daysUntilResume tests | Test countdown | 3.3.1 |
| 3.3C.2.12 | Implement daysUntilResume() | Calculate days remaining | 3.3C.2.11, 3.3.2 |
| 3.3C.2.13 | Write getPauseCooldown tests | Test cooldown status | 3.3.1 |
| 3.3C.2.14 | Implement getPauseCooldown() | Return { active, daysRemaining, availableDate } | 3.3C.2.13, 3.3.2 |
| 3.3C.2.15 | Write getPauseHistory tests | Test history retrieval | 3.3.1 |
| 3.3C.2.16 | Implement getPauseHistory() | Return array of QZPayPauseDetails | 3.3C.2.15, 3.3.2 |
| 3.3C.2.17 | Write getCurrentPause tests | Test current pause retrieval | 3.3.1 |
| 3.3C.2.18 | Implement getCurrentPause() | Return QZPayPauseDetails or null | 3.3C.2.17, 3.3.2 |
| 3.3C.2.19 | Integrate pause helpers into attachHelpers() | Add all pause helpers | 3.3.23, 3.3C.2.2-3.3C.2.18 |

#### 3.3C.3 Pause Service Methods

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.3.1 | Write pause validation tests | Test all error conditions | 3.3.1 |
| 3.3C.3.2 | Implement validatePause() | Check all limits and conditions | 3.3C.3.1, 3.3C.2.4 |
| 3.3C.3.3 | Write pause tests | Test pause subscription | 3.3.1 |
| 3.3C.3.4 | Implement pause() | Pause subscription with validation | 3.3C.3.3, 3.3C.3.2 |
| 3.3C.3.5 | Calculate scheduledEndDate | Based on pauseDays or pauseUntil | 3.3C.3.4 |
| 3.3C.3.6 | Enforce maxDurationDays | Cap at config limit | 3.3C.3.5 |
| 3.3C.3.7 | Record pause in history | Save to subscription_pauses table | 3.3C.3.4 |
| 3.3C.3.8 | Emit SUBSCRIPTION_PAUSED event | With pauseDetails payload | 3.3C.3.4 |
| 3.3C.3.9 | Write resume validation tests | Test resume conditions | 3.3.1 |
| 3.3C.3.10 | Implement validateResume() | Check canResumeEarly if early | 3.3C.3.9 |
| 3.3C.3.11 | Write resume tests | Test resume subscription | 3.3.1 |
| 3.3C.3.12 | Implement resume() | Resume subscription with validation | 3.3C.3.11, 3.3C.3.10 |
| 3.3C.3.13 | Calculate totalPauseDays | Actual days paused | 3.3C.3.12 |
| 3.3C.3.14 | Shift billing date | Add pause days to next billing date | 3.3C.3.13 |
| 3.3C.3.15 | Update pause history | Set actualEndDate | 3.3C.3.12 |
| 3.3C.3.16 | Emit SUBSCRIPTION_RESUMED event | With resumeDetails payload | 3.3C.3.12 |

#### 3.3C.4 Pause Scheduled Jobs

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.4.1 | Create AutoResumeJob | Job for scheduled auto-resume | 3.18.1 |
| 3.3C.4.2 | Write auto-resume tests | Test scheduled resume | 3.3C.4.1 |
| 3.3C.4.3 | Implement scheduled resume | Resume at pauseUntil date | 3.3C.4.2, 3.3C.3.12 |
| 3.3C.4.4 | Create MaxDurationResumeJob | Safety auto-resume at max duration | 3.18.1 |
| 3.3C.4.5 | Write max duration tests | Test safety resume | 3.3C.4.4 |
| 3.3C.4.6 | Implement safety resume | Resume at maxDurationDays | 3.3C.4.5, 3.3C.3.12 |
| 3.3C.4.7 | Register pause jobs | Add to job scheduler | 3.18.2, 3.3C.4.3, 3.3C.4.6 |

#### 3.3C.5 Pause Year Calculation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.5.1 | Write calendar year tests | Test reset on Jan 1 | 3.3.1 |
| 3.3C.5.2 | Implement calendar year calculation | Count pauses since Jan 1 | 3.3C.5.1 |
| 3.3C.5.3 | Write rolling year tests | Test 365-day window | 3.3.1 |
| 3.3C.5.4 | Implement rolling year calculation | Count pauses in last 365 days | 3.3C.5.3 |
| 3.3C.5.5 | Write year reset tests | Test pausesRemaining reset | 3.3.1 |
| 3.3C.5.6 | Implement year reset logic | Reset counter based on yearDefinition | 3.3C.5.5, 3.3C.5.2, 3.3C.5.4 |

#### 3.3C.6 Pause Database Schema

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.6.1 | Create subscription_pauses table | Store pause history | 2.2.1 |
| 3.3C.6.2 | Add columns: pauseId, subscriptionId | Core identifiers | 3.3C.6.1 |
| 3.3C.6.3 | Add columns: startDate, scheduledEndDate | Pause dates | 3.3C.6.1 |
| 3.3C.6.4 | Add columns: actualEndDate, resumeType | Resume info | 3.3C.6.1 |
| 3.3C.6.5 | Add columns: reason, pauseNumber | Metadata | 3.3C.6.1 |
| 3.3C.6.6 | Add index on subscriptionId | Fast lookup | 3.3C.6.1 |
| 3.3C.6.7 | Add pauseCount to subscriptions | Track total pauses | 2.3.3 |
| 3.3C.6.8 | Add lastPauseEndDate to subscriptions | For cooldown calculation | 2.3.3 |
| 3.3C.6.9 | Create migration for pause tables | Single migration | 3.3C.6.1-3.3C.6.8 |

#### 3.3C.7 Pause Error Handling

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.3C.7.1 | Define PAUSE_NOT_ALLOWED_PLAN error | Error code and message | 1.2.7 |
| 3.3C.7.2 | Define PAUSE_LIMIT_REACHED error | Error with next available date | 1.2.7 |
| 3.3C.7.3 | Define PAUSE_COOLDOWN_ACTIVE error | Error with cooldown end date | 1.2.7 |
| 3.3C.7.4 | Define PAUSE_DURATION_EXCEEDED error | Error with max allowed | 1.2.7 |
| 3.3C.7.5 | Define SUBSCRIPTION_ALREADY_PAUSED error | Error with current pause end | 1.2.7 |
| 3.3C.7.6 | Define SUBSCRIPTION_NOT_PAUSED error | For invalid resume | 1.2.7 |
| 3.3C.7.7 | Define EARLY_RESUME_NOT_ALLOWED error | When canResumeEarly: false | 1.2.7 |
| 3.3C.7.8 | Integrate errors in pause service | Use in validation | 3.3C.3.2, 3.3C.7.1-3.3C.7.7 |

### 3.4 Subscription Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.4.1 | Write subscription creation tests | Test create subscription | 1.2.7, 1.8.2 |
| 3.4.2 | Write subscription trial tests | Test createWithTrial, with/without card | 1.2.7 |
| 3.4.3 | Write subscription query tests | Test get, getByCustomer operations | 1.2.7 |
| 3.4.4 | Write subscription cancellation tests | Test cancel operation | 1.2.7 |
| 3.4.5 | Write subscription plan change tests | Test changePlan, proration | 1.2.7 |
| 3.4.6 | Write subscription trial extension tests | Test extendTrial | 1.2.7 |
| 3.4.7 | Write subscription free access tests | Test grant/revoke free access | 1.2.7 |
| 3.4.8 | Write subscription renewal tests | Test renew, expire operations | 1.2.7 |
| 3.4.9 | Create subscription.service.ts | QZPaySubscriptionService class | 1.8.2, 3.4.1-3.4.8 |
| 3.4.10 | Implement create() | Create subscription | 3.4.9 |
| 3.4.11 | Implement createWithTrial() | Create with trial, optionally without card | 3.4.9 |
| 3.4.12 | Implement get() | Get subscription | 3.4.9 |
| 3.4.13 | Implement getWithHelpers() | Get with helper methods attached | 3.4.12, 3.3.13 |
| 3.4.14 | Implement getByCustomer() | List customer subs | 3.4.9 |
| 3.4.15 | Implement getActiveByCustomerExternalId() | Get active by user ID | 3.4.9 |
| 3.4.16 | Implement cancel() | Cancel subscription | 3.4.9 |
| 3.4.17 | Implement changePlan() | Upgrade/downgrade | 3.4.9 |
| 3.4.18 | Implement calculateProration() | Calculate proration | 3.4.17 |
| 3.4.19 | Implement extendTrial() | Extend trial period | 3.4.9 |
| 3.4.20 | Implement grantFreeAccess() | Admin free access | 3.4.9 |
| 3.4.21 | Implement revokeFreeAccess() | Remove free access | 3.4.9 |
| 3.4.22 | Implement renew() | Renew subscription | 3.4.9 |
| 3.4.23 | Implement expire() | Expire subscription | 3.4.9 |
| 3.4.24 | Implement calculatePeriodEnd() | Period calculation | 3.4.9 |
| 3.4.25 | Add trial handling logic | Trial start/end/reminder | 3.4.10 |
| 3.4.26 | Add trial without card logic | Handle no payment method trials | 3.4.11 |
| 3.4.27 | Add grace period logic | Grace period handling | 3.4.23 |

---

## Phase 3B: Payment & Invoice

> **Scope**: Payment processing, refunds, invoice generation and management.

### 3.5 Payment Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.5.1 | Write one-time payment tests | Test createOneTime | 1.2.7, 1.8.2 |
| 3.5.2 | Write payment query tests | Test get, getByCustomer | 1.2.7 |
| 3.5.3 | Write recurring payment tests | Test processSubscriptionPayment | 1.2.7 |
| 3.5.4 | Write refund tests | Test full/partial refund | 1.2.7 |
| 3.5.5 | Write payment retry tests | Test retry, scheduling | 1.2.7 |
| 3.5.6 | Write payment status tests | Test markFailed, markSucceeded | 1.2.7 |
| 3.5.7 | Create payment.service.ts | QZPayPaymentService class | 1.8.2, 3.5.1-3.5.6 |
| 3.5.8 | Implement createOneTime() | One-time payment | 3.5.7 |
| 3.5.9 | Implement get() | Get payment | 3.5.7 |
| 3.5.10 | Implement getByCustomer() | Customer payments | 3.5.7 |
| 3.5.11 | Implement processSubscriptionPayment() | Recurring payment | 3.5.7 |
| 3.5.12 | Implement refund() | Full/partial refund | 3.5.7 |
| 3.5.13 | Implement retry() | Retry failed payment | 3.5.7 |
| 3.5.14 | Implement markFailed() | Mark as failed | 3.5.7 |
| 3.5.15 | Implement markSucceeded() | Mark as succeeded | 3.5.7 |
| 3.5.16 | Add currency conversion | Convert amounts | 3.5.8 |
| 3.5.17 | Add retry scheduling | Schedule retries | 3.5.13 |

### 3.6 Invoice Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.6.1 | Write invoice creation tests | Test create invoice | 1.2.7, 1.8.2 |
| 3.6.2 | Write invoice query tests | Test get, getByCustomer | 1.2.7 |
| 3.6.3 | Write invoice number tests | Test generateNumber | 1.2.7 |
| 3.6.4 | Write invoice status tests | Test markPaid, void | 1.2.7 |
| 3.6.5 | Write invoice PDF tests | Test generatePdf | 1.2.7 |
| 3.6.6 | Create invoice.service.ts | QZPayInvoiceService class | 1.8.2, 3.6.1-3.6.5 |
| 3.6.7 | Implement create() | Create invoice | 3.6.6 |
| 3.6.8 | Implement get() | Get invoice | 3.6.6 |
| 3.6.9 | Implement getByCustomer() | List customer invoices | 3.6.6 |
| 3.6.10 | Implement generateNumber() | Invoice number generation | 3.6.6 |
| 3.6.11 | Implement markPaid() | Mark as paid | 3.6.6 |
| 3.6.12 | Implement void() | Void invoice | 3.6.6 |
| 3.6.13 | Implement generatePdf() | PDF generation | 3.6.6 |

---

## Phase 3C: Discounts & Promo Codes

> **Scope**: Promo code service, automatic discounts, and discount stacking logic.

### 3.7 Promo Code Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.7.1 | Write promo code CRUD tests | Test create, get, list, deactivate | 1.2.7, 1.8.2 |
| 3.7.2 | Write promo validation tests | Test validate for customer | 1.2.7 |
| 3.7.3 | Write PERCENTAGE discount tests | Test percentage calculation | 1.2.7 |
| 3.7.4 | Write FIXED discount tests | Test fixed amount calculation | 1.2.7 |
| 3.7.5 | Write FREE_PERIOD tests | Test free period handling | 1.2.7 |
| 3.7.6 | Write REDUCED_PERIOD tests | Test reduced price periods | 1.2.7 |
| 3.7.7 | Write VOLUME tests | Test quantity-based discount | 1.2.7 |
| 3.7.8 | Write AMOUNT_THRESHOLD tests | Test amount threshold discount | 1.2.7 |
| 3.7.9 | Write TRIAL_EXTENSION tests | Test extend trial days | 1.2.7 |
| 3.7.10 | Create promo-code.service.ts | QZPayPromoCodeService class | 1.8.2, 3.7.1-3.7.9 |
| 3.7.11 | Implement create() | Create promo code | 3.7.10 |
| 3.7.12 | Implement get() | Get promo code | 3.7.10 |
| 3.7.13 | Implement getByCode() | Get by code string | 3.7.10 |
| 3.7.14 | Implement list() | List with filters | 3.7.10 |
| 3.7.15 | Implement validate() | Validate for customer | 3.7.10 |
| 3.7.16 | Implement calculateDiscount() | Calculate discount amount | 3.7.10 |
| 3.7.17 | Implement apply() | Apply to payment/sub | 3.7.10 |
| 3.7.18 | Implement deactivate() | Deactivate code | 3.7.10 |
| 3.7.19 | Add PERCENTAGE logic | Percentage calculation | 3.7.16 |
| 3.7.20 | Add FIXED logic | Fixed amount calculation | 3.7.16 |
| 3.7.21 | Add FREE_PERIOD logic | Free period handling | 3.7.16 |
| 3.7.22 | Add REDUCED_PERIOD logic | Reduced price periods | 3.7.16 |
| 3.7.23 | Add VOLUME logic | Quantity-based discount | 3.7.16 |
| 3.7.24 | Add AMOUNT_THRESHOLD logic | Amount threshold discount | 3.7.16 |
| 3.7.25 | Add TRIAL_EXTENSION logic | Extend trial days | 3.7.16 |

### 3.8 Automatic Discounts Service

> **V1 Scope**: One condition per discount, max 1 automatic discount per transaction, can stack with 1 promo code.
> See PDR Section 3.6.2 (FR-AUTO-001 to FR-AUTO-007) for full specification.

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.8.1 | Write automatic discount CRUD tests | Test create, get, list, update, deactivate | 1.2.7, 1.8.2 |
| 3.8.2 | Write MIN_AMOUNT condition tests | Test minimum purchase amount (cents) | 1.2.7 |
| 3.8.3 | Write MIN_QUANTITY condition tests | Test minimum items in cart | 1.2.7 |
| 3.8.4 | Write SPECIFIC_PRODUCTS condition tests | Test specific product IDs | 1.2.7 |
| 3.8.5 | Write SPECIFIC_CATEGORIES condition tests | Test specific category IDs | 1.2.7 |
| 3.8.6 | Write FIRST_PURCHASE condition tests | Test customer first purchase ever | 1.2.7 |
| 3.8.7 | Write CUSTOMER_SEGMENTS condition tests | Test customer segment membership | 1.2.7 |
| 3.8.8 | Write CUSTOMER_TENURE condition tests | Test customer account age in days | 1.2.7 |
| 3.8.9 | Write BILLING_INTERVAL condition tests | Test subscription interval (month/year) | 1.2.7 |
| 3.8.10 | Write SPECIFIC_PLANS condition tests | Test specific plan IDs | 1.2.7 |
| 3.8.11 | Write DATE_RANGE condition tests | Test startsAt/endsAt date range | 1.2.7 |
| 3.8.12 | Write SCHEDULE condition tests | Test days/hours/timezone (happy hour) | 1.2.7 |
| 3.8.13 | Write DAY_OF_WEEK condition tests | Test specific days of week | 1.2.7 |
| 3.8.14 | Write discount type tests | Test PERCENTAGE, FIXED_AMOUNT, VOLUME, etc. | 1.2.7 |
| 3.8.15 | Write selection strategy tests | Test FIRST_MATCH, BEST_FOR_CUSTOMER, HIGHEST_PRIORITY | 1.2.7 |
| 3.8.16 | Write usage limits tests | Test maxTotalUses, maxUsesPerCustomer | 1.2.7 |
| 3.8.17 | Create automatic-discount.service.ts | QZPayAutomaticDiscountService class | 1.8.2, 3.8.1-3.8.16 |
| 3.8.18 | Implement create() | FR-AUTO-001: Create automatic discount rule | 3.8.17 |
| 3.8.19 | Implement get() | Get discount by ID | 3.8.17 |
| 3.8.20 | Implement list() | FR-AUTO-005: List discounts with filters | 3.8.17 |
| 3.8.21 | Implement update() | FR-AUTO-006: Update discount rule (emit event) | 3.8.17 |
| 3.8.22 | Implement deactivate() | FR-AUTO-007: Deactivate discount (emit event) | 3.8.17 |
| 3.8.23 | Implement evaluate() | FR-AUTO-004: Evaluate eligible discounts for context | 3.8.17 |
| 3.8.24 | Add MIN_AMOUNT condition evaluator | Check amount >= minAmount | 3.8.23 |
| 3.8.25 | Add MIN_QUANTITY condition evaluator | Check quantity >= minQuantity | 3.8.23 |
| 3.8.26 | Add SPECIFIC_PRODUCTS condition evaluator | Check productIds intersection | 3.8.23 |
| 3.8.27 | Add SPECIFIC_CATEGORIES condition evaluator | Check categoryIds intersection | 3.8.23 |
| 3.8.28 | Add FIRST_PURCHASE condition evaluator | Check isFirstPurchase flag | 3.8.23 |
| 3.8.29 | Add CUSTOMER_SEGMENTS condition evaluator | Check segments intersection | 3.8.23 |
| 3.8.30 | Add CUSTOMER_TENURE condition evaluator | Check customerCreatedAt >= minDays | 3.8.23 |
| 3.8.31 | Add BILLING_INTERVAL condition evaluator | Check billingInterval match | 3.8.23 |
| 3.8.32 | Add SPECIFIC_PLANS condition evaluator | Check planId in planIds | 3.8.23 |
| 3.8.33 | Add DATE_RANGE condition evaluator | Check evaluatedAt in range | 3.8.23 |
| 3.8.34 | Add SCHEDULE condition evaluator | Check day/hour/timezone match | 3.8.23 |
| 3.8.35 | Add DAY_OF_WEEK condition evaluator | Check current day in days array | 3.8.23 |
| 3.8.36 | Implement FIRST_MATCH strategy | Select first qualifying by creation order | 3.8.23 |
| 3.8.37 | Implement BEST_FOR_CUSTOMER strategy | Select discount with highest savings | 3.8.23 |
| 3.8.38 | Implement HIGHEST_PRIORITY strategy | Select discount with lowest priority number | 3.8.23 |
| 3.8.39 | Add PERCENTAGE type calculation | Calculate percentage of amount | 3.8.23 |
| 3.8.40 | Add FIXED_AMOUNT type calculation | Subtract fixed amount | 3.8.23 |
| 3.8.41 | Add usage tracking | Increment usedCount on apply | 3.8.23 |
| 3.8.42 | Emit AUTOMATIC_DISCOUNT_CREATED event | On create() success | 3.8.18 |
| 3.8.43 | Emit AUTOMATIC_DISCOUNT_APPLIED event | On successful application | 3.8.23 |
| 3.8.44 | Emit AUTOMATIC_DISCOUNT_EVALUATED event | On evaluation (even if not applied) | 3.8.23 |

### 3.9 Discount Combination Service

> **V1 Scope**: Max 1 automatic discount + max 1 promo code per transaction.
> Multiple automatic discount stacking planned for future version.

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.9.1 | Write discount combination tests | Test auto discount + promo code | 1.2.7 |
| 3.9.2 | Write promo code only tests | Test promo code without auto discount | 1.2.7 |
| 3.9.3 | Write auto discount only tests | Test auto discount without promo code | 1.2.7 |
| 3.9.4 | Write discount order tests | Test auto discount applied first, then promo | 1.2.7 |
| 3.9.5 | Create discount-combination.service.ts | QZPayDiscountCombinationService class | 3.8.17, 3.7.10, 3.9.1-3.9.4 |
| 3.9.6 | Implement combine() | Apply auto discount + promo code to amount | 3.9.5 |
| 3.9.7 | Implement getBreakdown() | Return detailed breakdown of both discounts | 3.9.5 |
| 3.9.8 | Add validation | Ensure max 1 of each type | 3.9.6 |

---

## Phase 3D: Checkout & Marketplace

> **Scope**: Checkout service, bank transfers, marketplace (vendors/payouts), and metrics.

### 3.10 Checkout Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.10.1 | Write checkout session tests | Test create, createEmbedded | 1.2.7, 1.8.2 |
| 3.10.2 | Write subscription checkout tests | Test createForSubscription | 1.2.7 |
| 3.10.3 | Write trial without card checkout tests | Test createForTrialWithoutCard | 1.2.7 |
| 3.10.4 | Write checkout completion tests | Test complete, expire | 1.2.7 |
| 3.10.5 | Write promo validation tests | Test validate at checkout | 1.2.7 |
| 3.10.6 | Write split payment tests | Test marketplace checkout | 1.2.7 |
| 3.10.7 | Create checkout.service.ts | QZPayCheckoutService class | 1.8.2, 3.10.1-3.10.6 |
| 3.10.8 | Implement create() | Create checkout session | 3.10.7 |
| 3.10.9 | Implement createEmbedded() | Embedded checkout | 3.10.7 |
| 3.10.10 | Implement createForSubscription() | Subscription checkout | 3.10.7 |
| 3.10.11 | Implement createForTrialWithoutCard() | Trial without card | 3.10.7 |
| 3.10.12 | Implement complete() | Complete checkout | 3.10.7 |
| 3.10.13 | Implement expire() | Expire session | 3.10.7 |
| 3.10.14 | Add promo code validation | Validate at checkout | 3.10.8 |
| 3.10.15 | Add split payment logic | Marketplace checkout | 3.10.8 |

### 3.11 Bank Transfer Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.11.1 | Write bank transfer generation tests | Test generateInstructions | 1.2.7, 1.8.2 |
| 3.11.2 | Write pending payment tests | Test createPending | 1.2.7 |
| 3.11.3 | Write validation tests | Test validate, reject | 1.2.7 |
| 3.11.4 | Write expiration tests | Test expire pending transfers | 1.2.7 |
| 3.11.5 | Create bank-transfer.service.ts | QZPayBankTransferService class | 1.8.2, 3.11.1-3.11.4 |
| 3.11.6 | Implement generateInstructions() | Generate transfer details | 3.11.5 |
| 3.11.7 | Implement createPending() | Create pending payment | 3.11.5 |
| 3.11.8 | Implement validate() | Admin validation | 3.11.5 |
| 3.11.9 | Implement reject() | Admin rejection | 3.11.5 |
| 3.11.10 | Implement expire() | Expire pending transfers | 3.11.5 |

### 3.12 Marketplace Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12.1 | Write vendor CRUD tests | Test vendor operations | 1.2.7, 1.8.2 |
| 3.12.2 | Write vendor onboarding tests | Test onboarding flow | 1.2.7 |
| 3.12.3 | Write vendor balance tests | Test balance operations | 1.2.7 |
| 3.12.4 | Write payout tests | Test payout operations | 1.2.7 |
| 3.12.5 | Write commission tests | Test commission calculation | 1.2.7 |
| 3.12.6 | Create marketplace.service.ts | QZPayMarketplaceService class | 1.8.2, 3.12.1-3.12.5 |
| 3.12.7 | Implement createVendor() | Create vendor | 3.12.6 |
| 3.12.8 | Implement getVendor() | Get vendor | 3.12.6 |
| 3.12.9 | Implement updateVendor() | Update vendor | 3.12.6 |
| 3.12.10 | Implement createOnboardingLink() | Onboarding URL | 3.12.6 |
| 3.12.11 | Implement getVendorStatus() | Check onboarding status | 3.12.6 |
| 3.12.12 | Implement completeOnboarding() | Mark onboarding complete | 3.12.6 |
| 3.12.13 | Implement getVendorBalance() | Get pending/available | 3.12.6 |
| 3.12.14 | Implement createPayout() | Trigger payout | 3.12.6 |
| 3.12.15 | Implement listPayouts() | List vendor payouts | 3.12.6 |
| 3.12.16 | Implement calculateCommission() | Calculate platform fee | 3.12.6 |

### 3.12B Commission Rate Management

> **Scope**: Vendor commission rate updates, refund handling, tier changes.
> See PDR.md Section 3.7 (FR-MKT-007, FR-MKT-008, FR-MKT-009) and ARCHITECTURE.md Section 8.3.1.

#### 3.12B.1 Commission Rate Update API

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12B.1.1 | Write updateCommissionRate tests | Test rate update with validation | 1.2.7, 3.12.6 |
| 3.12B.1.2 | Write scheduled rate change tests | Test future effectiveDate | 1.2.7 |
| 3.12B.1.3 | Write rate history tests | Test audit trail recording | 1.2.7 |
| 3.12B.1.4 | Create vendor-commission.service.ts | QZPayVendorCommissionService class | 3.12.6, 3.12B.1.1-3.12B.1.3 |
| 3.12B.1.5 | Implement updateCommissionRate() | Update rate with immediate/scheduled | 3.12B.1.4 |
| 3.12B.1.6 | Implement rate validation | Validate rate 0.0-1.0, required reason | 3.12B.1.5 |
| 3.12B.1.7 | Implement history recording | Save to vendor_commission_history table | 3.12B.1.5 |
| 3.12B.1.8 | Implement scheduled change | Queue future rate change | 3.12B.1.5, 3.19.1 |
| 3.12B.1.9 | Emit VENDOR_COMMISSION_CHANGED | Immediate changes | 3.12B.1.5 |
| 3.12B.1.10 | Emit VENDOR_COMMISSION_SCHEDULED | Scheduled changes | 3.12B.1.8 |

#### 3.12B.2 Commission Rate Priority Resolution

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12B.2.1 | Write priority resolution tests | Test all 4 priority levels | 1.2.7, 3.12B.1.4 |
| 3.12B.2.2 | Write transaction override tests | Test override for specific txn | 1.2.7 |
| 3.12B.2.3 | Write platform default tests | Test fallback to config | 1.2.7 |
| 3.12B.2.4 | Implement resolveCommissionRate() | Resolve from highest priority | 3.12B.1.4, 3.12B.2.1-3.12B.2.3 |
| 3.12B.2.5 | Add transaction override check | Check payment metadata | 3.12B.2.4 |
| 3.12B.2.6 | Add vendor rate check | Check vendor.commissionRate | 3.12B.2.4 |
| 3.12B.2.7 | Add plan tier check | Check vendor tier commission | 3.12B.2.4 |
| 3.12B.2.8 | Add platform default fallback | Check config.marketplace.defaultCommission | 3.12B.2.4 |
| 3.12B.2.9 | Return breakdown details | Include all levels in result | 3.12B.2.4 |

#### 3.12B.3 Vendor Refund Processing

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12B.3.1 | Write full refund tests | Test 100% refund split | 1.2.7, 3.12B.1.4 |
| 3.12B.3.2 | Write partial refund tests | Test proportional split | 1.2.7 |
| 3.12B.3.3 | Write negative balance tests | Test balance going negative | 1.2.7 |
| 3.12B.3.4 | Write pending payout tests | Test deduction from pending | 1.2.7 |
| 3.12B.3.5 | Implement processVendorRefund() | Process refund with commission split | 3.12B.1.4, 3.12B.3.1-3.12B.3.4 |
| 3.12B.3.6 | Calculate vendor portion | refundAmount * (1 - commissionRate) | 3.12B.3.5 |
| 3.12B.3.7 | Calculate platform portion | refundAmount * commissionRate | 3.12B.3.5 |
| 3.12B.3.8 | Update vendor balance | Deduct vendor portion from balance | 3.12B.3.5 |
| 3.12B.3.9 | Handle pending payout deduction | Deduct from pending if before payout | 3.12B.3.5 |
| 3.12B.3.10 | Emit VENDOR_REFUND_PROCESSED | With breakdown details | 3.12B.3.5 |
| 3.12B.3.11 | Emit VENDOR_BALANCE_NEGATIVE | If balance goes negative | 3.12B.3.8 |

#### 3.12B.4 Vendor Tier Changes

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12B.4.1 | Write tier upgrade tests | Test immediate commission change | 1.2.7, 3.12B.1.4 |
| 3.12B.4.2 | Write tier downgrade tests | Test period-end commission change | 1.2.7 |
| 3.12B.4.3 | Write tier event tests | Test UPGRADED/DOWNGRADED events | 1.2.7 |
| 3.12B.4.4 | Implement handleTierChange() | Process tier change | 3.12B.1.4, 3.12B.4.1-3.12B.4.3 |
| 3.12B.4.5 | Determine change direction | Compare commission rates | 3.12B.4.4 |
| 3.12B.4.6 | Apply upgrade immediately | Lower commission = immediate | 3.12B.4.4 |
| 3.12B.4.7 | Schedule downgrade | Higher commission = period end | 3.12B.4.4, 3.19.1 |
| 3.12B.4.8 | Emit VENDOR_TIER_UPGRADED | On upgrade | 3.12B.4.6 |
| 3.12B.4.9 | Emit VENDOR_TIER_DOWNGRADED | On downgrade | 3.12B.4.7 |

#### 3.12B.5 Database Schema for Commission

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.12B.5.1 | Create vendor_commission_history table | Store rate change history | 2.2.1 |
| 3.12B.5.2 | Add columns: previousRate, newRate, effectiveDate | Core fields | 3.12B.5.1 |
| 3.12B.5.3 | Add columns: reason, adminUserId | Audit fields | 3.12B.5.1 |
| 3.12B.5.4 | Add vendor_tiers table | Define commission tiers | 2.2.1 |
| 3.12B.5.5 | Add tierId to vendors table | Reference to tier | 3.12B.5.4 |
| 3.12B.5.6 | Add commissionUpdatedAt to vendors | Track last update | 2.3.4 |
| 3.12B.5.7 | Add transaction_commission_overrides table | Per-transaction overrides | 2.2.1 |
| 3.12B.5.8 | Add migration for all commission tables | Single migration | 3.12B.5.1-3.12B.5.7 |

### 3.13 Metrics Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.13.1 | Write revenue metrics tests | Test MRR, ARR, total | 1.2.7, 1.8.2 |
| 3.13.2 | Write subscription metrics tests | Test active, churn, conversion | 1.2.7 |
| 3.13.3 | Write payment metrics tests | Test success rate, avg value | 1.2.7 |
| 3.13.4 | Write customer metrics tests | Test LTV, ARPU | 1.2.7 |
| 3.13.5 | Write vendor metrics tests | Test vendor stats | 1.2.7 |
| 3.13.6 | Create metrics.service.ts | QZPayMetricsService class | 1.8.2, 3.13.1-3.13.5 |
| 3.13.7 | Implement getRevenue() | MRR, ARR, total | 3.13.6 |
| 3.13.8 | Implement getRevenueByPeriod() | Time series revenue | 3.13.6 |
| 3.13.9 | Implement getRevenueByPlan() | Revenue per plan | 3.13.6 |
| 3.13.10 | Implement getSubscriptionMetrics() | Active, churn, conversion | 3.13.6 |
| 3.13.11 | Implement getPaymentMetrics() | Success rate, avg value | 3.13.6 |
| 3.13.12 | Implement getCustomerMetrics() | LTV, ARPU | 3.13.6 |
| 3.13.13 | Implement getVendorMetrics() | Vendor stats | 3.13.6 |
| 3.13.14 | Add caching layer | Cache frequently accessed | 3.13.8-3.13.13 |

---

## Phase 3E: Notifications & Jobs

> **Scope**: Notification service, usage tracking, background jobs, job definitions, and webhook handling.

### 3.14 Notification Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.14.1 | Write notification tests | Test notification sending | 1.2.7, 1.8.2 |
| 3.14.2 | Write suppress array tests | Test suppress logic | 1.2.7 |
| 3.14.3 | Write template tests | Test template rendering | 1.2.7 |
| 3.14.4 | Create notification.service.ts | QZPayNotificationService class | 1.8.2, 3.14.1-3.14.3 |
| 3.14.5 | Implement notify() | Send notification | 3.14.4 |
| 3.14.6 | Implement shouldSendEmail() | Check suppress array | 3.14.4 |
| 3.14.7 | Implement setEmailSentByPackage() | Set flag in event | 3.14.4 |
| 3.14.8 | Create default templates | Default email templates | 3.14.4 |
| 3.14.9 | Implement template rendering | Render with data | 3.14.4 |

### 3.15 Usage-Based Billing Service (Hybrid Architecture)

> **Architecture**: Hybrid approach where project tracks usage in real-time (own storage), and package handles reported usage for billing. See PDR.md Section 3.2.1 for complete specification.

> **Responsibility Split**:
> - **Project**: Real-time tracking in Redis/DB, limit enforcement, UI display
> - **Package**: Store reported usage, calculate overages, generate invoices, emit events

#### 3.15.1 Usage Report API

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.1.1 | Write usage report tests | Test billing.usage.report() | 1.2.7, 1.8.2 |
| 3.15.1.2 | Write idempotency tests | Test duplicate report handling | 1.2.7 |
| 3.15.1.3 | Write period validation tests | Test usage within billing period | 1.2.7 |
| 3.15.1.4 | Create usage.service.ts | QZPayUsageService class | 1.8.2, 3.15.1.1-3.15.1.3 |
| 3.15.1.5 | Implement report() | Store reported usage with idempotency | 3.15.1.4 |
| 3.15.1.6 | Implement idempotency check | Check idempotency_key, skip duplicates | 3.15.1.5 |
| 3.15.1.7 | Implement period validation | Validate usage timestamp within period | 3.15.1.5 |
| 3.15.1.8 | Implement aggregation | Add to usage_records table | 3.15.1.5 |
| 3.15.1.9 | Emit USAGE_REPORTED event | Fire event after successful report | 3.15.1.5 |

#### 3.15.2 Usage Query API

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.2.1 | Write get usage tests | Test billing.usage.get() | 1.2.7 |
| 3.15.2.2 | Write history tests | Test billing.usage.getHistory() | 1.2.7 |
| 3.15.2.3 | Implement get() | Get current period usage with summaries | 3.15.1.4, 3.15.2.1 |
| 3.15.2.4 | Implement getHistory() | Get past periods usage | 3.15.1.4, 3.15.2.2 |
| 3.15.2.5 | Calculate summaries | Compute overage, percentUsed, overageAmount | 3.15.2.3 |

#### 3.15.3 Usage Threshold Alerts

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.3.1 | Write threshold tests | Test warning/critical/overage thresholds | 1.2.7 |
| 3.15.3.2 | Implement threshold check | Check thresholds on report() | 3.15.1.5, 3.15.3.1 |
| 3.15.3.3 | Emit USAGE_THRESHOLD_WARNING | Fire at 80% (configurable) | 3.15.3.2 |
| 3.15.3.4 | Emit USAGE_THRESHOLD_CRITICAL | Fire at 100% (configurable) | 3.15.3.2 |
| 3.15.3.5 | Emit USAGE_THRESHOLD_OVERAGE | Fire at 150% (configurable) | 3.15.3.2 |
| 3.15.3.6 | Track threshold fired status | Prevent duplicate alerts per period | 3.15.3.2 |

#### 3.15.4 Period Reset and Overage Calculation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.4.1 | Write period reset tests | Test usage reset at period start | 1.2.7 |
| 3.15.4.2 | Write overage calculation tests | Test overage formula | 1.2.7 |
| 3.15.4.3 | Implement resetPeriodUsage() | Archive old, create new period records | 3.15.1.4, 3.15.4.1 |
| 3.15.4.4 | Emit USAGE_PERIOD_RESET event | Fire when period resets | 3.15.4.3 |
| 3.15.4.5 | Implement calculateOverages() | Calculate overages at period end | 3.15.1.4, 3.15.4.2 |
| 3.15.4.6 | Emit USAGE_OVERAGE_CALCULATED | Fire before invoice generation | 3.15.4.5 |
| 3.15.4.7 | Add overages to invoice | Create line items for each metric | 3.15.4.5 |
| 3.15.4.8 | Emit USAGE_OVERAGE_BILLED | Fire after invoice paid | 3.15.4.7 |

#### 3.15.5 Plan Usage Configuration

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.5.1 | Write plan usage config tests | Test QZPayPlanUsageConfig | 1.2.7 |
| 3.15.5.2 | Implement getUsageConfig() | Get usage config from plan | 3.15.1.4, 3.15.5.1 |
| 3.15.5.3 | Validate metric against plan | Check metric in plan config | 3.15.1.5 |
| 3.15.5.4 | Log warning for unknown metrics | Warn if metric not in plan | 3.15.5.3 |

#### 3.15.6 Usage Storage

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.15.6.1 | Create usage_records table migration | Per-period aggregated usage | 1.8.2 |
| 3.15.6.2 | Create usage_reports table migration | Individual reports with idempotency | 1.8.2 |
| 3.15.6.3 | Add indexes for queries | Subscription, period, metric indexes | 3.15.6.1, 3.15.6.2 |
| 3.15.6.4 | Add partial index for idempotency | Fast idempotency lookups | 3.15.6.2 |
| 3.15.6.5 | Add partial index for unbilled | Fast unbilled records query | 3.15.6.1 |

### 3.16 Background Jobs Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.16.1 | Write jobs service tests | Test job management | 1.2.7, 1.8.2 |
| 3.16.2 | Write job execution tests | Test run, runDue | 1.2.7 |
| 3.16.3 | Create jobs.service.ts | QZPayJobsService class | 1.8.2, 3.16.1-3.16.2 |
| 3.16.4 | Implement getAll() | Get all job definitions | 3.16.3 |
| 3.16.5 | Implement getByName() | Get specific job | 3.16.3 |
| 3.16.6 | Implement run() | Run job manually | 3.16.3 |
| 3.16.7 | Implement runDue() | Run all due jobs | 3.16.3 |
| 3.16.8 | Add job execution tracking | Log executions | 3.16.3 |
| 3.16.9 | Add job result reporting | Return results | 3.16.7 |

### 3.17 Job Definitions

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.17.1 | Write expired subscriptions job tests | Test processExpiredSubscriptions | 1.2.7 |
| 3.17.2 | Create processExpiredSubscriptions | Expire ended subs | 3.16.3, 3.17.1 |
| 3.17.3 | Write trial expirations job tests | Test processTrialExpirations | 1.2.7 |
| 3.17.4 | Create processTrialExpirations | Handle trial ends | 3.16.3, 3.17.3 |
| 3.17.5 | Write trial no card job tests | Test processTrialNoCard | 1.2.7 |
| 3.17.6 | Create processTrialNoCard | Handle trials without card | 3.16.3, 3.17.5 |
| 3.17.7 | Write expiration warnings job tests | Test sendExpirationWarnings | 1.2.7 |
| 3.17.8 | Create sendExpirationWarnings | Send expiring notices | 3.16.3, 3.17.7 |
| 3.17.9 | Write payment reminders job tests | Test sendPaymentReminders | 1.2.7 |
| 3.17.10 | Create sendPaymentReminders | Payment due reminders | 3.16.3, 3.17.9 |
| 3.17.11 | Write retry failed payments job tests | Test retryFailedPayments | 1.2.7 |
| 3.17.12 | Create retryFailedPayments | Retry failed payments | 3.16.3, 3.17.11 |
| 3.17.13 | Write cleanup pending payments job tests | Test cleanupPendingPayments | 1.2.7 |
| 3.17.14 | Create cleanupPendingPayments | Expire bank transfers | 3.16.3, 3.17.13 |
| 3.17.15 | Write trial reminders job tests | Test sendTrialReminders | 1.2.7 |
| 3.17.16 | Create sendTrialReminders | Trial ending notices | 3.16.3, 3.17.15 |
| 3.17.17 | Write grace periods job tests | Test processGracePeriods | 1.2.7 |
| 3.17.18 | Create processGracePeriods | Handle grace period end | 3.16.3, 3.17.17 |
| 3.17.19 | Write reset usage job tests | Test resetPeriodUsage | 1.2.7 |
| 3.17.20 | Create resetPeriodUsage | Reset usage counters | 3.16.3, 3.17.19 |

### 3.18 Webhook Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.18.1 | Write webhook handling tests | Test handleStripe, handleMercadoPago | 1.2.7, 1.8.2 |
| 3.18.2 | Write idempotency tests | Test duplicate prevention | 1.2.7 |
| 3.18.3 | Create webhook.service.ts | QZPayWebhookService class | 1.8.2, 3.18.1-3.18.2 |
| 3.18.4 | Implement handleStripe() | Process Stripe webhooks | 3.18.3 |
| 3.18.5 | Implement handleMercadoPago() | Process MP webhooks | 3.18.3 |
| 3.18.6 | Add idempotency check | Prevent duplicate processing | 3.18.4, 3.18.5 |
| 3.18.7 | Add error logging | Log failed webhooks | 3.18.4, 3.18.5 |

---

## Phase 3F: Security & Resilience

> **Scope**: Security services (fraud detection, rate limiting, ownership validation) and resilience patterns (circuit breaker, retry logic).

### 3.19 Security Services

#### 3.19.1 Ownership Validator

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.1.1 | Write ownership validator tests | Test IDOR protection | 1.2.7, 1.8.2 |
| 3.19.1.2 | Create ownership-validator.service.ts | QZPayOwnershipValidatorService class | 1.8.2, 3.19.1.1 |
| 3.19.1.3 | Implement validateCustomerOwnership() | Check customer belongs to user | 3.19.1.2 |
| 3.19.1.4 | Implement validateSubscriptionOwnership() | Check subscription belongs to user | 3.19.1.2 |
| 3.19.1.5 | Implement validatePaymentOwnership() | Check payment belongs to user | 3.19.1.2 |
| 3.19.1.6 | Implement validateInvoiceOwnership() | Check invoice belongs to user | 3.19.1.2 |
| 3.19.1.7 | Implement validateVendorOwnership() | Check vendor belongs to user | 3.19.1.2 |
| 3.19.1.8 | Add caching layer for validations | Cache ownership lookups | 3.19.1.3-3.19.1.7 |

#### 3.19.2 Input Validation Schemas

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.2.1 | Write Zod schema tests | Test all validation schemas | 1.2.7 |
| 3.19.2.2 | Create schemas/customer.schema.ts | Customer validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.3 | Create schemas/subscription.schema.ts | Subscription validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.4 | Create schemas/payment.schema.ts | Payment validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.5 | Create schemas/invoice.schema.ts | Invoice validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.6 | Create schemas/plan.schema.ts | Plan validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.7 | Create schemas/promo-code.schema.ts | Promo code validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.8 | Create schemas/vendor.schema.ts | Vendor validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.9 | Create schemas/checkout.schema.ts | Checkout validation schemas | 1.2.6, 3.19.2.1 |
| 3.19.2.10 | Create schemas/index.ts | Export all schemas | 3.19.2.2-3.19.2.9 |
| 3.19.2.11 | Add custom refinements | Currency, dates, amounts validation | 3.19.2.10 |

#### 3.19.3 Webhook Security

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.3.1 | Write webhook security tests | Test timing-safe, replay, idempotency | 1.2.7, 3.18.3 |
| 3.19.3.2 | Implement timingSafeSignatureVerify() | Prevent timing attacks | 3.18.3, 3.19.3.1 |
| 3.19.3.3 | Implement timestamp validation | Reject webhooks > 5 min old | 3.18.3, 3.19.3.1 |
| 3.19.3.4 | Implement idempotency storage | Store processed webhook IDs | 3.18.3, 3.19.3.1 |
| 3.19.3.5 | Implement checkProcessed() | Check webhook already processed | 3.19.3.4 |
| 3.19.3.6 | Implement markProcessed() | Mark webhook as processed | 3.19.3.4 |
| 3.19.3.7 | Add webhook event TTL cleanup | Auto-expire old webhook records | 3.19.3.4 |

#### 3.19.4 Metadata Sanitization

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.4.1 | Write metadata sanitizer tests | Test PCI pattern removal | 1.2.7 |
| 3.19.4.2 | Create metadata-sanitizer.service.ts | QZPayMetadataSanitizerService class | 1.8.2, 3.19.4.1 |
| 3.19.4.3 | Implement sanitize() | Remove sensitive patterns | 3.19.4.2 |
| 3.19.4.4 | Add PCI pattern detection | Credit card regex patterns | 3.19.4.3 |
| 3.19.4.5 | Add Luhn algorithm validation | Detect valid card numbers | 3.19.4.3 |
| 3.19.4.6 | Add SSN/tax ID detection | Detect government IDs | 3.19.4.3 |
| 3.19.4.7 | Add configurable patterns | Custom sensitive patterns | 3.19.4.3 |
| 3.19.4.8 | Add deep object sanitization | Sanitize nested metadata | 3.19.4.3 |

#### 3.19.5 Field Encryption Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.5.1 | Write field encryption tests | Test AES-256-GCM encryption | 1.2.7 |
| 3.19.5.2 | Create field-encryption.service.ts | QZPayFieldEncryptionService class | 1.8.2, 3.19.5.1 |
| 3.19.5.3 | Implement encrypt() | AES-256-GCM encryption | 3.19.5.2 |
| 3.19.5.4 | Implement decrypt() | AES-256-GCM decryption | 3.19.5.2 |
| 3.19.5.5 | Implement key rotation support | Support multiple key versions | 3.19.5.2 |
| 3.19.5.6 | Add encrypted field detection | Detect encrypted values | 3.19.5.2 |
| 3.19.5.7 | Implement batch operations | Encrypt/decrypt multiple fields | 3.19.5.3, 3.19.5.4 |
| 3.19.5.8 | Add key derivation | HKDF for field-specific keys | 3.19.5.2 |

#### 3.19.6 Rate Limiting Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.6.1 | Write rate limiter tests | Test sliding window algorithm | 1.2.7 |
| 3.19.6.2 | Create rate-limiter.service.ts | QZPayRateLimiterService class | 1.8.2, 3.19.6.1 |
| 3.19.6.3 | Implement checkLimit() | Check if within limits | 3.19.6.2 |
| 3.19.6.4 | Implement recordRequest() | Record request timestamp | 3.19.6.2 |
| 3.19.6.5 | Implement sliding window algorithm | Time-based rate limiting | 3.19.6.2 |
| 3.19.6.6 | Add per-endpoint configuration | Different limits per endpoint | 3.19.6.2 |
| 3.19.6.7 | Add IP-based limiting | Rate limit by IP address | 3.19.6.2 |
| 3.19.6.8 | Add customer-based limiting | Rate limit by customer ID | 3.19.6.2 |
| 3.19.6.9 | Implement getRemainingRequests() | Return remaining quota | 3.19.6.2 |
| 3.19.6.10 | Add Redis storage adapter | Optional Redis backend | 3.19.6.2 |

#### 3.19.7 Fraud Detection Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.7.1 | Write fraud detection tests | Test all fraud rules | 1.2.7 |
| 3.19.7.2 | Create fraud-detection.service.ts | QZPayFraudDetectionService class | 1.8.2, 3.19.7.1 |
| 3.19.7.3 | Implement analyzePayment() | Analyze payment for fraud | 3.19.7.2 |
| 3.19.7.4 | Add card testing detection | Detect rapid low-value attempts | 3.19.7.3 |
| 3.19.7.5 | Add velocity checks | Detect unusual payment volume | 3.19.7.3 |
| 3.19.7.6 | Add promo code abuse detection | Detect promo stacking/cycling | 3.19.7.3 |
| 3.19.7.7 | Add trial abuse detection | Detect trial cycling patterns | 3.19.7.3 |
| 3.19.7.8 | Implement risk scoring | Calculate fraud risk score | 3.19.7.3 |
| 3.19.7.9 | Add configurable thresholds | Custom fraud rules | 3.19.7.3 |
| 3.19.7.10 | Implement blockCustomer() | Block fraudulent customers | 3.19.7.2 |
| 3.19.7.11 | Add fraud event emission | Emit fraud detection events | 3.19.7.3 |

#### 3.19.8 Security Middleware

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.19.8.1 | Write security middleware tests | Test all middleware | 1.2.7 |
| 3.19.8.2 | Create createOwnershipMiddleware() | Ownership validation middleware | 3.19.1.2, 3.19.8.1 |
| 3.19.8.3 | Create createRateLimitMiddleware() | Rate limiting middleware | 3.19.6.2, 3.19.8.1 |
| 3.19.8.4 | Create createValidationMiddleware() | Input validation middleware | 3.19.2.10, 3.19.8.1 |
| 3.19.8.5 | Create createAdminMiddleware() | Admin role enforcement | 3.19.8.1 |
| 3.19.8.6 | Create createFraudCheckMiddleware() | Fraud detection middleware | 3.19.7.2, 3.19.8.1 |
| 3.19.8.7 | Add middleware composition | Combine multiple middleware | 3.19.8.2-3.19.8.6 |

### 3.20 Resilience Services

#### 3.20.1 Idempotency Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.1.1 | Write idempotency service tests | Test lock, complete, release | 1.2.7 |
| 3.20.1.2 | Create idempotency.service.ts | QZPayIdempotencyService class | 1.8.2, 3.20.1.1 |
| 3.20.1.3 | Implement checkAndLock() | Check existing and acquire lock | 3.20.1.2 |
| 3.20.1.4 | Implement complete() | Mark operation as completed | 3.20.1.2 |
| 3.20.1.5 | Implement release() | Release lock on failure | 3.20.1.2 |
| 3.20.1.6 | Implement hashRequest() | Generate request hash | 3.20.1.2 |
| 3.20.1.7 | Add TTL cleanup job | Clean expired idempotency keys | 3.20.1.2 |
| 3.20.1.8 | Integrate with services | Add idempotency to create operations | 3.20.1.2 |

#### 3.20.2 Transaction Support

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.2.1 | Write transaction tests | Test transaction rollback | 1.2.7, 2.4.2 |
| 3.20.2.2 | Add transaction() to storage adapter | Transaction method in interface | 1.5.2, 3.20.2.1 |
| 3.20.2.3 | Implement Drizzle transaction | Drizzle transaction wrapper | 2.4.2, 3.20.2.2 |
| 3.20.2.4 | Create TransactionClient interface | Typed transaction collections | 3.20.2.2 |
| 3.20.2.5 | Refactor subscription.create | Use transaction for atomic create | 3.4.10, 3.20.2.3 |
| 3.20.2.6 | Refactor subscription.cancel | Use transaction for atomic cancel | 3.4.16, 3.20.2.3 |
| 3.20.2.7 | Refactor payment.refund | Use transaction for atomic refund | 3.5.12, 3.20.2.3 |
| 3.20.2.8 | Refactor checkout.complete | Use transaction for atomic complete | 3.10.12, 3.20.2.3 |

#### 3.20.3 Optimistic Locking

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.3.1 | Write optimistic lock tests | Test version conflict detection | 1.2.7 |
| 3.20.3.2 | Create OptimisticLockError | Error class for conflicts | 1.6.2, 3.20.3.1 |
| 3.20.3.3 | Update collection update methods | Add version check in WHERE | 2.4.4-2.4.34, 3.20.3.1 |
| 3.20.3.4 | Implement updateWithRetry() | Auto-retry on conflict | 3.20.3.3 |
| 3.20.3.5 | Add version to service responses | Include version in all responses | 3.20.3.3 |

#### 3.20.4 Provider Retry Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.4.1 | Write retry utility tests | Test exponential backoff | 1.2.7 |
| 3.20.4.2 | Create utils/retry.ts | withRetry() function | 1.2.6, 3.20.4.1 |
| 3.20.4.3 | Implement exponential backoff | Calculate delay with multiplier | 3.20.4.2 |
| 3.20.4.4 | Implement jitter | Add random jitter to delays | 3.20.4.2 |
| 3.20.4.5 | Implement isRetryable() | Check if error is retryable | 3.20.4.2 |
| 3.20.4.6 | Create RetryConfig interface | Configurable retry parameters | 3.20.4.2 |
| 3.20.4.7 | Create QZPayProviderRetryExhaustedError | Error for max retries | 1.6.2, 3.20.4.2 |
| 3.20.4.8 | Integrate with Stripe adapter | Wrap Stripe calls with retry | 4.2.9, 3.20.4.2 |
| 3.20.4.9 | Integrate with MercadoPago adapter | Wrap MP calls with retry | 4.6.7, 3.20.4.2 |

#### 3.20.5 Circuit Breaker

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.5.1 | Write circuit breaker tests | Test all states and transitions | 1.2.7 |
| 3.20.5.2 | Create utils/circuit-breaker.ts | CircuitBreaker class | 1.2.6, 3.20.5.1 |
| 3.20.5.3 | Implement CLOSED state | Normal operation, pass through | 3.20.5.2 |
| 3.20.5.4 | Implement OPEN state | Reject requests, fail fast | 3.20.5.2 |
| 3.20.5.5 | Implement HALF_OPEN state | Test recovery | 3.20.5.2 |
| 3.20.5.6 | Implement state transitions | Failure/success thresholds | 3.20.5.3-3.20.5.5 |
| 3.20.5.7 | Add error rate calculation | Sliding window error rate | 3.20.5.2 |
| 3.20.5.8 | Create QZPayCircuitOpenError | Error when circuit is open | 1.6.2, 3.20.5.2 |
| 3.20.5.9 | Add circuit state events | Emit events on state change | 3.20.5.6 |
| 3.20.5.10 | Integrate with Stripe adapter | Add circuit breaker to Stripe | 4.2.9, 3.20.5.2 |
| 3.20.5.11 | Integrate with MercadoPago adapter | Add circuit breaker to MP | 4.6.7, 3.20.5.2 |

#### 3.20.6 Event Queue Service

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.6.1 | Write event queue tests | Test enqueue, process, retry | 1.2.7 |
| 3.20.6.2 | Create event-queue.service.ts | QZPayEventQueueService class | 1.8.2, 3.20.6.1 |
| 3.20.6.3 | Implement emit() | Route sync vs async events | 3.20.6.2 |
| 3.20.6.4 | Implement enqueue() | Add event to queue | 3.20.6.2 |
| 3.20.6.5 | Implement processQueue() | Process pending events | 3.20.6.2 |
| 3.20.6.6 | Implement retry logic | Exponential backoff for failed events | 3.20.6.5 |
| 3.20.6.7 | Implement dead letter | Move failed events to dead letter | 3.20.6.5 |
| 3.20.6.8 | Create processEventQueue job | Background job for queue processing | 3.16.3, 3.20.6.5 |
| 3.20.6.9 | Add event handler configuration | Configure sync vs async per event type | 3.20.6.2 |

#### 3.20.7 Subscription Helpers Refactoring

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.20.7.1 | Write refactored helper tests | Test class-based helpers | 1.2.7, 3.3.1 |
| 3.20.7.2 | Refactor to class-based helpers | QZPaySubscriptionWithHelpers class | 3.3.2, 3.20.7.1 |
| 3.20.7.3 | Add isPaused() helper | Check paused status | 3.20.7.2 |
| 3.20.7.4 | Add daysUntilPauseEnd() helper | Calculate pause remaining | 3.20.7.2 |
| 3.20.7.5 | Implement toJSON() | Serialize to plain object | 3.20.7.2 |
| 3.20.7.6 | Update getWithHelpers() | Return class instance | 3.4.13, 3.20.7.2 |

---

## Phase 3G: Advanced Features (P2 - v1.1)

> **Note**: These are P2 features planned for version 1.1. They can be developed in parallel with Phase 4 after completing Phase 3F.

### 3.21 Advanced Subscription Features

#### 3.21.1 Subscription Pause/Resume

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.21.1.1 | Write pause service tests | Test pause, resume, auto-resume | 1.2.7 |
| 3.21.1.2 | Add pause fields to subscription schema | paused_at, pause_until, pause_count | 2.3.2 |
| 3.21.1.3 | Add PAUSED to QZPaySubscriptionStatus | Update status constant | 1.3.1 |
| 3.21.1.4 | Implement pause() | Pause subscription with options | 3.4.2, 3.21.1.1 |
| 3.21.1.5 | Implement resume() | Resume paused subscription | 3.4.2, 3.21.1.1 |
| 3.21.1.6 | Add canPause() check | Validate plan allows pause | 3.21.1.4 |
| 3.21.1.7 | Add pause count tracking | Track pauses per year | 3.21.1.4 |
| 3.21.1.8 | Implement processAutoResume job | Auto-resume when pause_until reached | 3.16.3, 3.21.1.5 |
| 3.21.1.9 | Add isPaused() helper | Check paused status | 3.20.7.2 |
| 3.21.1.10 | Add pausesRemaining() helper | Calculate remaining pauses | 3.20.7.2 |
| 3.21.1.11 | Add pausedUntil() helper | Get resume date | 3.20.7.2 |
| 3.21.1.12 | Emit SUBSCRIPTION_PAUSED event | Event with pause details | 1.7.2 |
| 3.21.1.13 | Emit SUBSCRIPTION_RESUMED event | Event with pause duration | 1.7.2 |
| 3.21.1.14 | Update hasAccess() for pause | Check retainAccessDuringPause | 3.3.5 |

#### 3.21.2 Sandbox/Test Mode

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.21.2.1 | Write sandbox mode tests | Test livemode isolation | 1.2.7 |
| 3.21.2.2 | Add livemode field to all entities | customers, subscriptions, payments, etc. | 2.3.1-2.3.17 |
| 3.21.2.3 | Add environment to QZPayBillingConfig | 'test' or 'production' option | 1.4.11 |
| 3.21.2.4 | Create environment context | Track current environment | 1.8.2, 3.21.2.1 |
| 3.21.2.5 | Add livemode filter to all queries | Filter by current environment | 2.4.2 |
| 3.21.2.6 | Add livemode validation | Prevent mixing test/prod data | 3.21.2.5 |
| 3.21.2.7 | Add provider credential switching | Use test credentials in test mode | 4.2.9, 4.6.7 |
| 3.21.2.8 | Add admin viewBothModes option | Admin can see all data | 3.21.2.5 |
| 3.21.2.9 | Update unique constraints | Include livemode in unique constraints | 2.3.1-2.3.17 |
| 3.21.2.10 | Add livemode to all responses | Include livemode in API responses | 3.1.2-3.18.2 |

#### 3.21.3 Subscription Add-ons

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.21.3.1 | Write add-on service tests | Test CRUD for add-ons | 1.2.7 |
| 3.21.3.2 | Create subscription_addons schema | New table for add-ons | 2.2.5 |
| 3.21.3.3 | Create addon_definitions schema | New table for add-on definitions | 2.2.5 |
| 3.21.3.4 | Add subscriptionAddons collection | CRUD operations | 2.1.1 |
| 3.21.3.5 | Add addonDefinitions collection | CRUD operations | 2.1.1 |
| 3.21.3.6 | Create addon.service.ts | QZPayAddonService class | 1.8.2, 3.21.3.1 |
| 3.21.3.7 | Implement createAddon() | Define new add-on product | 3.21.3.6 |
| 3.21.3.8 | Implement listAddons() | List available add-ons | 3.21.3.6 |
| 3.21.3.9 | Implement addAddonToSubscription() | Attach add-on to subscription | 3.21.3.6 |
| 3.21.3.10 | Implement removeAddonFromSubscription() | Remove add-on | 3.21.3.6 |
| 3.21.3.11 | Implement getSubscriptionAddons() | List subscription add-ons | 3.21.3.6 |
| 3.21.3.12 | Add proration for add-ons | Calculate prorated charges | 3.6.2, 3.21.3.9 |
| 3.21.3.13 | Add compatibility validation | Check addon compatible with plan | 3.21.3.9 |
| 3.21.3.14 | Add getAddons() helper | Subscription helper method | 3.20.7.2 |
| 3.21.3.15 | Add hasAddon() helper | Check if addon attached | 3.20.7.2 |
| 3.21.3.16 | Emit ADDON_ADDED event | Event when addon added | 1.7.2 |
| 3.21.3.17 | Emit ADDON_REMOVED event | Event when addon removed | 1.7.2 |

#### 3.21.4 Per-Seat Pricing

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.21.4.1 | Write per-seat pricing tests | Test quantity changes | 1.2.7 |
| 3.21.4.2 | Add quantity field to subscriptions | Track seat count | 2.3.2 |
| 3.21.4.3 | Add per-seat config to plans | minQuantity, maxQuantity, perSeatPrice | 2.3.7 |
| 3.21.4.4 | Implement updateQuantity() | Change seat count | 3.4.2, 3.21.4.1 |
| 3.21.4.5 | Add quantity validation | Check min/max limits | 3.21.4.4 |
| 3.21.4.6 | Add proration for quantity changes | Calculate prorated charges | 3.6.2, 3.21.4.4 |
| 3.21.4.7 | Calculate total price with quantity | Base + (additional * perSeatPrice) | 3.21.4.4 |
| 3.21.4.8 | Add getQuantity() helper | Get current seat count | 3.20.7.2 |
| 3.21.4.9 | Add getIncludedQuantity() helper | Get included seats | 3.20.7.2 |
| 3.21.4.10 | Add getAdditionalSeats() helper | Calculate extra seats | 3.20.7.2 |
| 3.21.4.11 | Add canAddSeats() helper | Check if within limits | 3.20.7.2 |
| 3.21.4.12 | Emit QUANTITY_UPDATED event | Event when quantity changes | 1.7.2 |
| 3.21.4.13 | Update invoice line items | Include quantity in invoices | 3.7.2 |
| 3.21.4.14 | Add quantity to checkout | Pass quantity in checkout session | 3.10.2 |

---

### 3.22 Analytics & Monitoring

#### 3.22.1 Promo Code Analytics

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.22.1.1 | Write promo analytics tests | Test ROI calculation, usage stats | 1.2.7 |
| 3.22.1.2 | Create promo_code_analytics table | Daily aggregated metrics | 2.3.3 |
| 3.22.1.3 | Create PromoCodeAnalytics type | TypeScript interface | 2.1.2 |
| 3.22.1.4 | Implement analytics aggregation job | Daily rollup job | 3.19.1, 3.22.1.2 |
| 3.22.1.5 | Calculate total uses | Count redemptions | 3.22.1.4 |
| 3.22.1.6 | Calculate unique customers | Distinct customer count | 3.22.1.4 |
| 3.22.1.7 | Segment new vs existing customers | Track customer type | 3.22.1.4 |
| 3.22.1.8 | Calculate total discount given | Sum discounts applied | 3.22.1.4 |
| 3.22.1.9 | Calculate revenue generated | Sum payments with promo | 3.22.1.4 |
| 3.22.1.10 | Calculate ROI | (Revenue - Discount) / Discount | 3.22.1.8, 3.22.1.9 |
| 3.22.1.11 | Track conversion rate | Checkouts started vs completed | 3.22.1.4 |
| 3.22.1.12 | Track plan breakdown | Usage by plan | 3.22.1.4 |
| 3.22.1.13 | Implement getPromoCodeAnalytics() | Query analytics | 3.22.1.2 |
| 3.22.1.14 | Implement getPromoCodeROI() | Calculate ROI for period | 3.22.1.13 |
| 3.22.1.15 | Add analytics to admin portal | Dashboard widget | 3.22.1.13 |

#### 3.22.2 Customer Discounts

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.22.2.1 | Write customer discount tests | Test CRUD, application | 1.2.7 |
| 3.22.2.2 | Create customer_discounts table | Permanent discounts | 2.3.3 |
| 3.22.2.3 | Create CustomerDiscount type | TypeScript interface | 2.1.2 |
| 3.22.2.4 | Implement setCustomerDiscount() | Create/update discount | 3.22.2.2, 3.22.2.1 |
| 3.22.2.5 | Implement getCustomerDiscounts() | List active discounts | 3.22.2.2 |
| 3.22.2.6 | Implement removeCustomerDiscount() | Deactivate discount | 3.22.2.2 |
| 3.22.2.7 | Add discount types | percentage, fixed_amount | 3.22.2.3 |
| 3.22.2.8 | Add validity period | valid_from, valid_until | 3.22.2.2 |
| 3.22.2.9 | Add plan restrictions | applicable_plans array | 3.22.2.2 |
| 3.22.2.10 | Add priority for stacking | Multiple discount handling | 3.22.2.2 |
| 3.22.2.11 | Integrate with price calculation | Apply discounts at checkout | 3.6.2, 3.22.2.5 |
| 3.22.2.12 | Emit CUSTOMER_DISCOUNT_SET event | Event when discount added | 1.7.2 |
| 3.22.2.13 | Emit CUSTOMER_DISCOUNT_REMOVED event | Event when discount removed | 1.7.2 |
| 3.22.2.14 | Add audit trail | Track who set discount | 3.22.2.4 |

#### 3.22.3 Vendor Analytics (Marketplace)

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.22.3.1 | Write vendor analytics tests | Test sales, commissions | 1.2.7 |
| 3.22.3.2 | Create vendor_analytics table | Daily aggregated metrics | 2.3.3 |
| 3.22.3.3 | Create VendorAnalytics type | TypeScript interface | 2.1.2 |
| 3.22.3.4 | Implement analytics aggregation job | Daily rollup job | 3.19.1, 3.22.3.2 |
| 3.22.3.5 | Calculate total sales | Gross sales amount | 3.22.3.4 |
| 3.22.3.6 | Calculate total commissions | Platform fees | 3.22.3.4 |
| 3.22.3.7 | Calculate net revenue | Sales - commissions | 3.22.3.5, 3.22.3.6 |
| 3.22.3.8 | Track transaction counts | Success/fail/refund | 3.22.3.4 |
| 3.22.3.9 | Calculate refund rate | Refunds / transactions | 3.22.3.8 |
| 3.22.3.10 | Track product breakdown | Sales by product | 3.22.3.4 |
| 3.22.3.11 | Track customer metrics | Unique/new customers | 3.22.3.4 |
| 3.22.3.12 | Implement getVendorAnalytics() | Query analytics | 3.22.3.2 |
| 3.22.3.13 | Implement getVendorDashboard() | Aggregated view | 3.22.3.12 |
| 3.22.3.14 | Add vendor portal integration | Dashboard for vendors | 3.22.3.13 |

#### 3.22.4 Job Monitoring

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.22.4.1 | Write job monitoring tests | Test status, health check | 1.2.7 |
| 3.22.4.2 | Create job_executions table | Execution history | 2.3.3 |
| 3.22.4.3 | Create JobExecution type | TypeScript interface | 2.1.2 |
| 3.22.4.4 | Create JobStatus type | Current job state | 2.1.2 |
| 3.22.4.5 | Record job start | Log start timestamp | 3.22.4.2, 3.19.1 |
| 3.22.4.6 | Record job completion | Log end, duration, status | 3.22.4.5 |
| 3.22.4.7 | Track items processed | Count success/failed | 3.22.4.6 |
| 3.22.4.8 | Capture error details | Store error message, stack | 3.22.4.6 |
| 3.22.4.9 | Implement getJobStatus() | Current job status | 3.22.4.2 |
| 3.22.4.10 | Implement getJobHistory() | Recent executions | 3.22.4.2 |
| 3.22.4.11 | Implement healthCheck() | All jobs health | 3.22.4.9 |
| 3.22.4.12 | Emit JOB_STARTED event | Event when job starts | 1.7.2 |
| 3.22.4.13 | Emit JOB_COMPLETED event | Event when job ends | 1.7.2 |
| 3.22.4.14 | Add alerting integration | Notify on failures | 3.22.4.8 |

#### 3.22.5 Manual Job Execution

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.22.5.1 | Write manual execution tests | Test trigger, dry-run | 1.2.7 |
| 3.22.5.2 | Implement triggerJob() | Manually start job | 3.19.1, 3.22.5.1 |
| 3.22.5.3 | Add dry-run mode | Preview without changes | 3.22.5.2 |
| 3.22.5.4 | Add user attribution | Track who triggered | 3.22.5.2 |
| 3.22.5.5 | Add parameter override | Custom job config | 3.22.5.2 |
| 3.22.5.6 | Add execution lock | Prevent concurrent runs | 3.22.5.2 |
| 3.22.5.7 | Return execution result | Status, items processed | 3.22.5.2 |
| 3.22.5.8 | Add admin API endpoint | POST /admin/jobs/:name/run | 3.22.5.2 |
| 3.22.5.9 | Add dry-run API endpoint | POST /admin/jobs/:name/dry-run | 3.22.5.3 |
| 3.22.5.10 | Add job list API endpoint | GET /admin/jobs | 3.22.4.9 |

---

### 3.23 Data & Financial Features

#### 3.23.1 Multi-Currency System

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.1.1 | Write multi-currency tests | Test rate fetching, conversion, locking | 1.2.7 |
| 3.23.1.2 | Create exchange_rates table | Store rates with caching | 2.3.3 |
| 3.23.1.3 | Create ExchangeRate type | TypeScript interface | 2.1.2 |
| 3.23.1.4 | Create QZPayPlanPricing type | Multi-currency pricing config | 2.1.2 |
| 3.23.1.5 | Implement getRate() | Fetch current rate with cache | 3.23.1.2, 3.23.1.1 |
| 3.23.1.6 | Implement lockRate() | Lock rate for checkout (30 min) | 3.23.1.5 |
| 3.23.1.7 | Add OpenExchangeRates provider | Primary rate provider | 3.23.1.5 |
| 3.23.1.8 | Implement setManualRate() | Admin rate override | 3.23.1.2 |
| 3.23.1.9 | Add rate cache TTL config | Configurable cache duration | 3.23.1.5 |
| 3.23.1.10 | Implement getPlanPrice() | Get price in specific currency | 3.23.1.5 |
| 3.23.1.11 | Add per-currency pricing | Direct pricing per currency | 3.23.1.10 |
| 3.23.1.12 | Implement fallback behavior | convert_from_base or error | 3.23.1.10 |
| 3.23.1.13 | Add exchange rate to checkout | Lock and track rate | 3.10.2, 3.23.1.6 |
| 3.23.1.14 | Store rate in payment | Track actual rate used | 3.4.2 |

#### 3.23.2 Credit Notes

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.2.1 | Write credit note tests | Test creation, application, void | 1.2.7 |
| 3.23.2.2 | Create credit_notes table | Store credit notes | 2.3.3 |
| 3.23.2.3 | Create CreditNote type | TypeScript interface | 2.1.2 |
| 3.23.2.4 | Add credit note number sequence | CN-YYYY-NNNNN format | 3.23.2.2 |
| 3.23.2.5 | Implement createCreditNote() | Create draft credit note | 3.23.2.2, 3.23.2.1 |
| 3.23.2.6 | Implement issueCreditNote() | Transition to issued | 3.23.2.5 |
| 3.23.2.7 | Implement applyCreditToInvoice() | Apply to outstanding invoice | 3.23.2.6 |
| 3.23.2.8 | Add partial application | Apply part of credit | 3.23.2.7 |
| 3.23.2.9 | Implement voidCreditNote() | Cancel credit note | 3.23.2.6 |
| 3.23.2.10 | Implement getCustomerCredit() | Get available balance | 3.23.2.2 |
| 3.23.2.11 | Auto-create on refund | Generate credit note on refund | 3.5.5, 3.23.2.5 |
| 3.23.2.12 | Emit CREDIT_NOTE_CREATED event | Event when created | 1.7.2 |
| 3.23.2.13 | Emit CREDIT_NOTE_ISSUED event | Event when issued | 1.7.2 |
| 3.23.2.14 | Emit CREDIT_NOTE_APPLIED event | Event when applied | 1.7.2 |
| 3.23.2.15 | Emit CREDIT_NOTE_VOIDED event | Event when voided | 1.7.2 |
| 3.23.2.16 | Add credit notes to invoice | Show applied credits | 3.7.2 |

#### 3.23.3 Data Export

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.3.1 | Write export tests | Test CSV, XLSX, JSON | 1.2.7 |
| 3.23.3.2 | Create exports table | Store export jobs | 2.3.3 |
| 3.23.3.3 | Create Export type | TypeScript interface | 2.1.2 |
| 3.23.3.4 | Implement requestExport() | Create export job | 3.23.3.2, 3.23.3.1 |
| 3.23.3.5 | Implement CSV export | Generate CSV file | 3.23.3.4 |
| 3.23.3.6 | Implement XLSX export | Generate Excel file | 3.23.3.4 |
| 3.23.3.7 | Implement JSON export | Generate JSON file | 3.23.3.4 |
| 3.23.3.8 | Add field selection | Choose columns to export | 3.23.3.4 |
| 3.23.3.9 | Add filter support | Status, date range filters | 3.23.3.4 |
| 3.23.3.10 | Add async processing | Background job for large exports | 3.19.1, 3.23.3.4 |
| 3.23.3.11 | Add file storage | Store generated files | 3.23.3.10 |
| 3.23.3.12 | Add download URL | Signed URL with expiration | 3.23.3.11 |
| 3.23.3.13 | Implement getExportStatus() | Check job status | 3.23.3.2 |
| 3.23.3.14 | Emit EXPORT_REQUESTED event | Event when requested | 1.7.2 |
| 3.23.3.15 | Emit EXPORT_COMPLETED event | Event when done | 1.7.2 |
| 3.23.3.16 | Emit EXPORT_FAILED event | Event on failure | 1.7.2 |
| 3.23.3.17 | Add export API endpoints | POST /exports, GET /exports/:id | 3.23.3.4 |

#### 3.23.4 Audit Logging

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.4.1 | Write audit log tests | Test logging, querying | 1.2.7 |
| 3.23.4.2 | Create audit_logs table | Immutable audit storage | 2.3.3 |
| 3.23.4.3 | Create AuditLog type | TypeScript interface | 2.1.2 |
| 3.23.4.4 | Add immutability trigger | Prevent UPDATE/DELETE | 3.23.4.2 |
| 3.23.4.5 | Implement logAudit() | Record audit event | 3.23.4.2, 3.23.4.1 |
| 3.23.4.6 | Add change tracking | Capture old/new values | 3.23.4.5 |
| 3.23.4.7 | Add actor capture | User, admin, system, api, webhook | 3.23.4.5 |
| 3.23.4.8 | Add context capture | IP, user agent, request ID | 3.23.4.5 |
| 3.23.4.9 | Implement queryAuditLogs() | Search with filters | 3.23.4.2 |
| 3.23.4.10 | Implement getEntityHistory() | All changes for entity | 3.23.4.9 |
| 3.23.4.11 | Add audit to customer ops | Log customer changes | 3.23.4.5 |
| 3.23.4.12 | Add audit to subscription ops | Log subscription changes | 3.23.4.5 |
| 3.23.4.13 | Add audit to payment ops | Log payment changes | 3.23.4.5 |
| 3.23.4.14 | Add audit to admin ops | Log admin actions | 3.23.4.5 |
| 3.23.4.15 | Add audit API endpoints | GET /admin/audit | 3.23.4.9 |

#### 3.23.5 Admin Middleware Enforcement

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.5.1 | Write middleware validation tests | Test error on missing middleware | 1.2.7 |
| 3.23.5.2 | Add config validation | Check adminMiddleware presence | 3.23.5.1 |
| 3.23.5.3 | Throw on missing middleware | Error if adminRoutes without middleware | 3.23.5.2 |
| 3.23.5.4 | Add warning on disabled routes | Console.warn if adminRoutes: false | 3.23.5.2 |
| 3.23.5.5 | Document requirement | Update docs with requirement | 3.23.5.2 |

#### 3.23.6 State Reconciliation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.6.1 | Write reconciliation tests | Test detection, resolution | 1.2.7 |
| 3.23.6.2 | Create reconciliation_issues table | Store detected issues | 2.3.3 |
| 3.23.6.3 | Create ReconciliationIssue type | TypeScript interface | 2.1.2 |
| 3.23.6.4 | Implement findInconsistencies() | Compare DB vs provider | 3.23.6.2, 3.23.6.1 |
| 3.23.6.5 | Detect status mismatches | Subscription status differs | 3.23.6.4 |
| 3.23.6.6 | Detect missing in DB | Provider has, DB doesn't | 3.23.6.4 |
| 3.23.6.7 | Detect missing in provider | DB has, provider doesn't | 3.23.6.4 |
| 3.23.6.8 | Implement reconcile() | Apply resolution strategy | 3.23.6.4 |
| 3.23.6.9 | Add provider_wins strategy | Sync from provider to DB | 3.23.6.8 |
| 3.23.6.10 | Add db_wins strategy | Sync from DB to provider | 3.23.6.8 |
| 3.23.6.11 | Add manual strategy | Flag for manual review | 3.23.6.8 |
| 3.23.6.12 | Implement reconciliation job | Daily scheduled check | 3.19.1, 3.23.6.4 |
| 3.23.6.13 | Emit RECONCILIATION_ISSUE_FOUND event | Event on detection | 1.7.2 |
| 3.23.6.14 | Emit RECONCILIATION_ISSUE_RESOLVED event | Event on resolution | 1.7.2 |
| 3.23.6.15 | Add reconciliation API endpoints | GET /admin/reconciliation | 3.23.6.4 |

#### 3.23.7 Usage Events Partitioning

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.7.1 | Write partitioning tests | Test partition creation, queries | 1.2.7 |
| 3.23.7.2 | Create partitioned usage_events table | PARTITION BY RANGE | 2.3.3 |
| 3.23.7.3 | Add partition creation function | Auto-create monthly partitions | 3.23.7.2 |
| 3.23.7.4 | Add partition management job | Create future partitions | 3.19.1, 3.23.7.3 |
| 3.23.7.5 | Add partition retention config | Keep N months of data | 3.23.7.4 |
| 3.23.7.6 | Add old partition archival | Archive/drop old partitions | 3.23.7.5 |

#### 3.23.8 Pricing Snapshots

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.23.8.1 | Write snapshot tests | Test capture, retrieval | 1.2.7 |
| 3.23.8.2 | Create pricing_snapshots table | Store plan snapshots | 2.3.3 |
| 3.23.8.3 | Create PricingSnapshot type | TypeScript interface | 2.1.2 |
| 3.23.8.4 | Implement captureSnapshot() | Save plan state at subscription | 3.23.8.2, 3.23.8.1 |
| 3.23.8.5 | Capture on subscription create | Auto-capture on create | 3.4.2, 3.23.8.4 |
| 3.23.8.6 | Capture on plan change | Save new plan snapshot | 3.6.7, 3.23.8.4 |
| 3.23.8.7 | Implement getSnapshot() | Get current snapshot | 3.23.8.2 |
| 3.23.8.8 | Implement getSnapshotHistory() | Get all snapshots | 3.23.8.2 |
| 3.23.8.9 | Include applied discounts | Store promo/customer discounts | 3.23.8.4 |
| 3.23.8.10 | Include exchange rate | Store locked rate if converted | 3.23.1.6, 3.23.8.4 |

### 3.24 Internationalization & Developer Tools

#### 3.24.1 Email Template Localization

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.24.1.1 | Write i18n tests | Test locale resolution, fallbacks | 1.2.7 |
| 3.24.1.2 | Define QZPayLocale type | Union type: 'en' \| 'es' \| 'pt' \| etc | 2.1.2 |
| 3.24.1.3 | Define QZPayNotificationConfig | Interface with translations map | 2.1.2 |
| 3.24.1.4 | Add preferredLanguage to customers | Store customer locale preference | 2.3.3 |
| 3.24.1.5 | Implement locale resolution | Customer > config > 'en' fallback | 3.24.1.2, 3.24.1.4, 3.24.1.1 |
| 3.24.1.6 | Create default templates per locale | en, es, pt default templates | 3.24.1.5 |
| 3.24.1.7 | Implement template inheritance | Custom > locale-specific > default | 3.24.1.6 |
| 3.24.1.8 | Add locale-aware date formatting | Format dates per locale | 3.24.1.5 |
| 3.24.1.9 | Add locale-aware currency formatting | Format amounts per locale | 3.24.1.5 |
| 3.24.1.10 | Update NotificationService | Use locale-aware templates | 3.14.1, 3.24.1.7 |
| 3.24.1.11 | Add i18n config validation | Validate translations structure | 3.24.1.3 |
| 3.24.1.12 | Export i18n utilities | formatDate, formatCurrency helpers | 3.24.1.8, 3.24.1.9 |

#### 3.24.2 Webhook UI for Testing

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.24.2.1 | Write webhook delivery tests | Test delivery tracking, retries | 1.2.7 |
| 3.24.2.2 | Create webhook_deliveries table | Store outgoing webhook attempts | 2.3.3 |
| 3.24.2.3 | Create WebhookDelivery type | TypeScript interface | 2.1.2 |
| 3.24.2.4 | Implement delivery tracking | Log each delivery attempt | 3.24.2.2, 3.24.2.1 |
| 3.24.2.5 | Track response status/body | Store response details | 3.24.2.4 |
| 3.24.2.6 | Calculate delivery latency | Measure delivery time in ms | 3.24.2.4 |
| 3.24.2.7 | Implement retry mechanism | Exponential backoff retries | 3.24.2.4 |
| 3.24.2.8 | Add manual send capability | Send test events manually | 3.24.2.4 |
| 3.24.2.9 | Add GET /admin/webhooks/deliveries | List delivery history | 3.24.2.4 |
| 3.24.2.10 | Add GET /admin/webhooks/deliveries/:id | Get delivery details | 3.24.2.9 |
| 3.24.2.11 | Add POST /admin/webhooks/test | Send test webhook | 3.24.2.8 |
| 3.24.2.12 | Add POST /admin/webhooks/retry/:id | Retry failed delivery | 3.24.2.7 |
| 3.24.2.13 | Add endpoint validation | Validate URL before saving | 3.18.1 |
| 3.24.2.14 | Filter deliveries by type/status | Query parameters support | 3.24.2.9 |
| 3.24.2.15 | Add delivery dashboard data | Aggregated stats for UI | 3.24.2.9 |

#### 3.24.3 Unified Constants

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.24.3.1 | Write constants tests | Test all exported values | 1.2.7 |
| 3.24.3.2 | Create QZPaySubscriptionStatus const | All subscription states as const | 2.1.2, 3.24.3.1 |
| 3.24.3.3 | Create QZPayPaymentStatus const | All payment states as const | 2.1.2 |
| 3.24.3.4 | Create QZPayInvoiceStatus const | All invoice states as const | 2.1.2 |
| 3.24.3.5 | Create discount type hierarchy | QZPayDiscountTypeBase, QZPayPromoCodeType, QZPayAutomaticDiscountType, QZPayDiscountType | 2.1.2 |
| 3.24.3.6 | Create QZPayBillingInterval const | All interval types as const | 2.1.2 |
| 3.24.3.7 | Create QZPayEventType const | All event types as const | 2.1.2 |
| 3.24.3.8 | Add type inference helpers | typeof const[keyof] patterns | 3.24.3.2-3.24.3.7 |
| 3.24.3.9 | Update all library code | Replace magic strings with consts | 3.24.3.2-3.24.3.7 |
| 3.24.3.10 | Export all constants from index | Central export point | 3.24.3.9 |
| 3.24.3.11 | Update documentation | Reference constants, not literals | 3.24.3.10 |
| 3.24.3.12 | Add deprecation warnings | Warn on string literal usage | 3.24.3.9 |

#### 3.24.4 Subscription Helper Methods

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.24.4.1 | Write helper tests | Test all helper methods | 1.2.7 |
| 3.24.4.2 | Implement isTrialing() | Check if in trial | 3.4.2, 3.24.4.1 |
| 3.24.4.3 | Implement isActive() | Check if active/access allowed | 3.24.4.2 |
| 3.24.4.4 | Implement isPastDue() | Check if past due | 3.24.4.2 |
| 3.24.4.5 | Implement isInGracePeriod() | Check grace period status | 3.24.4.2, 3.24.5.4 |
| 3.24.4.6 | Implement canAccessFeatures() | Determine feature access | 3.24.4.3, 3.24.4.4, 3.24.4.5 |
| 3.24.4.7 | Implement getDaysUntilExpiry() | Calculate days remaining | 3.24.4.2 |
| 3.24.4.8 | Implement getEffectiveGracePeriod() | Cascading grace resolution | 3.24.5.4 |
| 3.24.4.9 | Document sync vs async methods | Clear separation in docs | 3.24.4.2-3.24.4.8 |
| 3.24.4.10 | Add helper to subscription object | Attach methods to subscription | 3.24.4.2-3.24.4.8 |
| 3.24.4.11 | Export standalone helpers | Also export as functions | 3.24.4.2-3.24.4.8 |

#### 3.24.5 Grace Period Configuration

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.24.5.1 | Write grace period tests | Test cascading resolution | 1.2.7 |
| 3.24.5.2 | Add gracePeriodDays to QZPayConfig | Global default setting | 2.1.2, 3.24.5.1 |
| 3.24.5.3 | Add gracePeriodDays to Plan type | Per-plan override | 2.1.2 |
| 3.24.5.4 | Add gracePeriodDays to Subscription | Per-subscription override | 2.1.2 |
| 3.24.5.5 | Implement cascading resolution | Sub > plan > global | 3.24.5.2-3.24.5.4 |
| 3.24.5.6 | Update grace period expiry logic | Use effective grace period | 3.24.5.5, 3.4.2 |
| 3.24.5.7 | Add grace period to subscription create | Allow setting on creation | 3.24.5.4 |
| 3.24.5.8 | Add grace period to subscription update | Allow updating | 3.24.5.4 |
| 3.24.5.9 | Document grace period behavior | Clear cascade documentation | 3.24.5.5 |
| 3.24.5.10 | Add grace period validation | Validate reasonable values | 3.24.5.2-3.24.5.4 |

### 3.25 Customer & Promo Features (P2 - v1.1)

#### 3.25.1 Customer Duplicate Detection

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.25.1.1 | Write duplicate detection tests | Test matching algorithms | 1.2.7 |
| 3.25.1.2 | Create DuplicateDetectionOptions interface | Match configuration | 2.1.2 |
| 3.25.1.3 | Implement email exact matching | Match on email field | 3.1.1, 3.25.1.1 |
| 3.25.1.4 | Implement name fuzzy matching | Levenshtein/similar algo | 3.25.1.1 |
| 3.25.1.5 | Implement metadata matching | Custom field comparison | 3.25.1.1 |
| 3.25.1.6 | Implement threshold filtering | Configurable confidence | 3.25.1.3-3.25.1.5 |
| 3.25.1.7 | Group duplicates by score | Return grouped results | 3.25.1.6 |
| 3.25.1.8 | Add findDuplicates() method | CustomerService method | 3.25.1.7 |
| 3.25.1.9 | Add GET /admin/customers/duplicates | Admin API endpoint | 3.25.1.8 |

#### 3.25.2 Customer Merge

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.25.2.1 | Write merge tests | Test all strategies | 1.2.7 |
| 3.25.2.2 | Create customer_merges table | Store merge history | 2.3.3 |
| 3.25.2.3 | Create CustomerMergeOptions interface | Merge configuration | 2.1.2 |
| 3.25.2.4 | Implement dry run preview | Show merge effects | 3.25.2.1 |
| 3.25.2.5 | Implement subscription move | Transfer subscriptions | 3.4.2, 3.25.2.1 |
| 3.25.2.6 | Implement payment move | Transfer payments | 3.5.1, 3.25.2.1 |
| 3.25.2.7 | Implement invoice move | Transfer invoices | 3.6.1, 3.25.2.1 |
| 3.25.2.8 | Implement metadata merge strategies | merge/target_wins/source_wins | 3.25.2.1 |
| 3.25.2.9 | Detect conflicts | Overlapping subscriptions, etc | 3.25.2.4 |
| 3.25.2.10 | Update provider customer IDs | Migrate Stripe/MP IDs | 3.25.2.1 |
| 3.25.2.11 | Create source snapshot | Save before merge | 3.25.2.2 |
| 3.25.2.12 | Implement source deletion | Optional delete after merge | 3.25.2.11 |
| 3.25.2.13 | Add merge() method | CustomerService method | 3.25.2.5-3.25.2.12 |
| 3.25.2.14 | Emit CUSTOMER_MERGED event | Event on successful merge | 1.7.2 |
| 3.25.2.15 | Add POST /admin/customers/merge | Admin API endpoint | 3.25.2.13 |

#### 3.25.3 Product-Specific Promo Codes

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.25.3.1 | Write product restriction tests | Test all restriction types | 1.2.7 |
| 3.25.3.2 | Add product fields to promo_codes | valid_products, excluded_products | 2.3.3 |
| 3.25.3.3 | Add category fields | valid_categories, excluded_categories | 2.3.3 |
| 3.25.3.4 | Add vendor fields | valid_vendors, excluded_vendors | 2.3.3 |
| 3.25.3.5 | Add order amount fields | min/max_order_amount | 2.3.3 |
| 3.25.3.6 | Extend QZPayPromoCodeRestrictions type | Add new fields | 2.1.2 |
| 3.25.3.7 | Implement product validation | Check product restrictions | 3.7.1, 3.25.3.1 |
| 3.25.3.8 | Implement category validation | Check category restrictions | 3.25.3.7 |
| 3.25.3.9 | Implement vendor validation | Check vendor restrictions | 3.25.3.7 |
| 3.25.3.10 | Implement order amount validation | Check min/max amounts | 3.25.3.7 |
| 3.25.3.11 | Update validateForCheckout | Include product checks | 3.25.3.7-3.25.3.10 |
| 3.25.3.12 | Add product context to checkout | Pass product info | 3.10.1, 3.25.3.11 |

#### 3.25.4 Plan Versioning

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.25.4.1 | Write plan versioning tests | Test all scenarios | 1.2.7 |
| 3.25.4.2 | Create plan_versions table | Store version history | 2.3.3 |
| 3.25.4.3 | Create PlanVersion interface | Version data structure | 2.1.2 |
| 3.25.4.4 | Add locked_plan_version_id to subscriptions | Lock to version | 2.3.3 |
| 3.25.4.5 | Implement createVersion() | Create new plan version | 3.2.1, 3.25.4.1 |
| 3.25.4.6 | Implement detectChangeType | Identify change category | 3.25.4.5 |
| 3.25.4.7 | Implement getPlanVersionAt | Get version at date | 3.25.4.2 |
| 3.25.4.8 | Implement getEffectivePlan | Get plan for subscription | 3.25.4.4, 3.25.4.7 |
| 3.25.4.9 | Lock version on subscription create | Save version reference | 3.4.2, 3.25.4.4 |
| 3.25.4.10 | Apply transition rules | Price/feature change rules | 3.25.4.6 |
| 3.25.4.11 | Notify affected subscribers | Email for required changes | 3.14.1, 3.25.4.10 |
| 3.25.4.12 | Add POST /admin/plans/:id/versions | Create new version | 3.25.4.5 |
| 3.25.4.13 | Add GET /admin/plans/:id/versions | List version history | 3.25.4.2 |

#### 3.25.5 Webhook Replay

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.25.5.1 | Write webhook replay tests | Test replay scenarios | 1.2.7 |
| 3.25.5.2 | Create webhook_records table | Extended webhook storage | 2.3.3 |
| 3.25.5.3 | Create WebhookRecord interface | Record data structure | 2.1.2 |
| 3.25.5.4 | Store all incoming webhooks | Save on receive | 3.18.1, 3.25.5.1 |
| 3.25.5.5 | Track processing attempts | Log each attempt | 3.25.5.4 |
| 3.25.5.6 | Implement dead letter queue | Move after max retries | 3.25.5.5 |
| 3.25.5.7 | Implement replay() method | Replay single webhook | 3.25.5.4, 3.25.5.1 |
| 3.25.5.8 | Implement replayDeadLetter() | Bulk replay with filters | 3.25.5.7 |
| 3.25.5.9 | Increment retry count on replay | Track replay attempts | 3.25.5.7 |
| 3.25.5.10 | Add attempt to history | Record replay in attempts | 3.25.5.7 |
| 3.25.5.11 | Emit WEBHOOK_REPLAYED event | Event on successful replay | 1.7.2 |
| 3.25.5.12 | Emit WEBHOOK_REPLAY_FAILED event | Event on failed replay | 1.7.2 |
| 3.25.5.13 | Add GET /admin/webhooks/dead-letter | List dead letter queue | 3.25.5.6 |
| 3.25.5.14 | Add GET /admin/webhooks/:id | Get webhook details | 3.25.5.4 |
| 3.25.5.15 | Add POST /admin/webhooks/:id/replay | Replay single webhook | 3.25.5.7 |
| 3.25.5.16 | Add POST /admin/webhooks/dead-letter/replay | Bulk replay | 3.25.5.8 |

### 3.26 Observability & Testing (P2 - v1.1)

#### 3.26.1 Structured Logging

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.26.1.1 | Write logging tests | Test log formats and redaction | 1.2.7 |
| 3.26.1.2 | Create QZPayLoggerConfig interface | Configure logging options | 2.1.2 |
| 3.26.1.3 | Implement log levels | debug, info, warn, error levels | 3.26.1.1 |
| 3.26.1.4 | Implement JSON format | Structured JSON log output | 3.26.1.3 |
| 3.26.1.5 | Implement pretty format | Human-readable log output | 3.26.1.3 |
| 3.26.1.6 | Implement field redaction | Configurable PCI field redaction | 3.26.1.4 |
| 3.26.1.7 | Add request ID injection | Inject requestId into all logs | 3.26.1.4 |
| 3.26.1.8 | Add timestamp injection | ISO 8601 timestamps | 3.26.1.4 |
| 3.26.1.9 | Implement context propagation | Correlation across services | 3.26.1.7 |
| 3.26.1.10 | Create createQZPayLogger() factory | Main logger factory function | 3.26.1.3-3.26.1.9 |
| 3.26.1.11 | Add logging to all services | Instrument existing services | 3.26.1.10 |

#### 3.26.2 Metrics Collection

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.26.2.1 | Write metrics tests | Test collectors and exporters | 1.2.7 |
| 3.26.2.2 | Create QZPayMetricsCollector interface | Custom metrics interface | 2.1.2 |
| 3.26.2.3 | Implement counter metrics | payment.success, payment.failed, etc. | 3.26.2.1 |
| 3.26.2.4 | Implement gauge metrics | subscription.active, etc. | 3.26.2.1 |
| 3.26.2.5 | Implement histogram metrics | Request durations, amounts | 3.26.2.1 |
| 3.26.2.6 | Add Prometheus exporter | /metrics endpoint for Prometheus | 3.26.2.3-3.26.2.5 |
| 3.26.2.7 | Add Datadog exporter | Datadog agent integration | 3.26.2.3-3.26.2.5 |
| 3.26.2.8 | Implement default labels | Environment, service name labels | 3.26.2.3 |
| 3.26.2.9 | Implement metric prefix | Configurable metric prefix | 3.26.2.3 |
| 3.26.2.10 | Create createQZPayMetrics() factory | Main metrics factory function | 3.26.2.6-3.26.2.9 |
| 3.26.2.11 | Add metrics to all services | Instrument existing services | 3.26.2.10 |

#### 3.26.3 Enhanced CLI

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.26.3.1 | Write enhanced CLI tests | Test new CLI commands | 1.2.7 |
| 3.26.3.2 | Implement qzpay install | Interactive DB setup wizard | 7.1.1, 3.26.3.1 |
| 3.26.3.3 | Implement qzpay validate | Config validation command | 7.1.1, 3.26.3.1 |
| 3.26.3.4 | Implement qzpay health | System health check command | 7.1.1, 3.26.3.1 |
| 3.26.3.5 | Add provider health checks | Test Stripe/MP connectivity | 3.26.3.4 |
| 3.26.3.6 | Add database health checks | Test DB connectivity | 3.26.3.4 |
| 3.26.3.7 | Implement qzpay studio | Launch local admin UI | 7.1.1, 3.26.3.1 |
| 3.26.3.8 | Add --json flag | JSON output for all commands | 3.26.3.2-3.26.3.7 |
| 3.26.3.9 | Add --verbose flag | Verbose output for debugging | 3.26.3.2-3.26.3.7 |
| 3.26.3.10 | Add qzpay doctor | Diagnose common issues | 3.26.3.4 |

#### 3.26.4 Event Sourcing

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.26.4.1 | Write event store tests | Test event persistence/replay | 1.2.7 |
| 3.26.4.2 | Create billing_event_store table | Append-only event storage | 2.3.3 |
| 3.26.4.3 | Create QZPayStoredEvent interface | Event data structure | 2.1.2 |
| 3.26.4.4 | Implement appendEvent() | Store event with version | 3.26.4.2, 3.26.4.1 |
| 3.26.4.5 | Implement optimistic locking | Version conflict detection | 3.26.4.4 |
| 3.26.4.6 | Implement getEventsForAggregate() | Retrieve events for aggregate | 3.26.4.2 |
| 3.26.4.7 | Implement getEventsAfterVersion() | Event replay from version | 3.26.4.6 |
| 3.26.4.8 | Implement replayEvents() | Rebuild state from events | 3.26.4.7 |
| 3.26.4.9 | Add causation_id tracking | Track event causality | 3.26.4.4 |
| 3.26.4.10 | Add correlation_id tracking | Track event correlation | 3.26.4.4 |
| 3.26.4.11 | Add actor tracking | Track who triggered event | 3.26.4.4 |
| 3.26.4.12 | Implement event snapshots | Periodic aggregate snapshots | 3.26.4.8 |
| 3.26.4.13 | Add GET /admin/events | Query event store | 3.26.4.6 |
| 3.26.4.14 | Add GET /admin/events/:aggregate | Events for aggregate | 3.26.4.6 |

#### 3.26.5 Integration Testing Utilities

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.26.5.1 | Write testing utility tests | Test the test helpers | 1.2.7 |
| 3.26.5.2 | Create MockStripeAdapter | Mock Stripe operations | 1.5.1, 3.26.5.1 |
| 3.26.5.3 | Create MockMercadoPagoAdapter | Mock MP operations | 1.5.1, 3.26.5.1 |
| 3.26.5.4 | Create MockStorageAdapter | In-memory storage mock | 1.5.2, 3.26.5.1 |
| 3.26.5.5 | Implement mock failure injection | Simulate provider failures | 3.26.5.2-3.26.5.3 |
| 3.26.5.6 | Implement mock latency injection | Simulate slow responses | 3.26.5.2-3.26.5.3 |
| 3.26.5.7 | Create WebhookTestHelper | Generate test webhooks | 3.26.5.1 |
| 3.26.5.8 | Implement Stripe webhook mocks | Mock Stripe webhook payloads | 3.26.5.7 |
| 3.26.5.9 | Implement MP webhook mocks | Mock MP webhook payloads | 3.26.5.7 |
| 3.26.5.10 | Create TestClock class | Control time in tests | 3.26.5.1 |
| 3.26.5.11 | Implement now() | Get current mock time | 3.26.5.10 |
| 3.26.5.12 | Implement advance() | Advance time by duration | 3.26.5.10 |
| 3.26.5.13 | Implement advanceToTrialEnd() | Jump to trial expiry | 3.26.5.12 |
| 3.26.5.14 | Implement advanceToRenewal() | Jump to next renewal | 3.26.5.12 |
| 3.26.5.15 | Create createTestBilling() factory | Factory for test instances | 3.26.5.2-3.26.5.10 |
| 3.26.5.16 | Export from @qzpay/testing package | Public testing utilities | 3.26.5.15 |

### 3.27 Security & Edge Cases (P2 - v1.1)

#### 3.27.1 Row-Level Security (RLS)

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.1.1 | Write RLS policy tests | Test tenant isolation | 1.2.7 |
| 3.27.1.2 | Create QZPayRLSConfig interface | RLS configuration options | 2.1.2 |
| 3.27.1.3 | Enable RLS on billing_customers | ALTER TABLE ENABLE RLS | 2.3.3 |
| 3.27.1.4 | Enable RLS on billing_subscriptions | ALTER TABLE ENABLE RLS | 2.3.3 |
| 3.27.1.5 | Enable RLS on billing_invoices | ALTER TABLE ENABLE RLS | 2.3.3 |
| 3.27.1.6 | Enable RLS on billing_payments | ALTER TABLE ENABLE RLS | 2.3.3 |
| 3.27.1.7 | Enable RLS on all other tables | Cover remaining tables | 2.3.3 |
| 3.27.1.8 | Create tenant_isolation policy | Filter by tenant_id | 3.27.1.3-3.27.1.7 |
| 3.27.1.9 | Create livemode_isolation policy | Filter by livemode | 3.27.1.8 |
| 3.27.1.10 | Create CI validation script | Validate RLS in CI | 3.27.1.9 |
| 3.27.1.11 | Add bypass role configuration | Admin bypass support | 3.27.1.8 |
| 3.27.1.12 | Document RLS requirements | Security documentation | 3.27.1.10 |

#### 3.27.2 Timezone & DST Handling

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.2.1 | Write timezone tests | Test all edge cases | 1.2.7 |
| 3.27.2.2 | Create QZPayDateConfig interface | Date handling options | 2.1.2 |
| 3.27.2.3 | Create QZPayDateService class | Date utility service | 3.27.2.1 |
| 3.27.2.4 | Implement getNextBillingDate() | Calculate next billing | 3.27.2.3 |
| 3.27.2.5 | Handle Feb 29 edge case | Fallback to Feb 28 | 3.27.2.4 |
| 3.27.2.6 | Implement scheduleSafeTime() | Avoid DST transition hours | 3.27.2.3 |
| 3.27.2.7 | Implement isDSTTransitionDay() | Detect DST changes | 3.27.2.6 |
| 3.27.2.8 | Handle timezone changes | Recalculate billing dates | 3.27.2.4 |
| 3.27.2.9 | Implement monthly vs 30-day mode | Configurable billing mode | 3.27.2.4 |
| 3.27.2.10 | Integrate with subscription service | Use date service | 3.4.2, 3.27.2.4 |

#### 3.27.3 Chargebacks & Disputes

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.3.1 | Write dispute tests | Test all dispute flows | 1.2.7 |
| 3.27.3.2 | Create billing_disputes table | Store dispute records | 2.3.3 |
| 3.27.3.3 | Create QZPayDispute interface | Dispute data structure | 2.1.2 |
| 3.27.3.4 | Create QZPayDisputeStatus constant | Status enum | 1.3.14 |
| 3.27.3.5 | Create QZPayDisputeReason constant | Reason enum | 1.3.14 |
| 3.27.3.6 | Implement DisputeService | Core dispute service | 3.27.3.1 |
| 3.27.3.7 | Implement handleDisputeOpened() | Process new dispute | 3.27.3.6 |
| 3.27.3.8 | Auto-pause subscription on dispute | Pause affected sub | 3.21.1, 3.27.3.7 |
| 3.27.3.9 | Implement submitEvidence() | Submit to provider | 3.27.3.6 |
| 3.27.3.10 | Implement validateRefundAllowed() | Block refund during dispute | 3.27.3.6 |
| 3.27.3.11 | Track disputes for fraud | Fraud pattern detection | 3.19.7, 3.27.3.6 |
| 3.27.3.12 | Emit DISPUTE_OPENED event | Event notification | 1.7.2 |
| 3.27.3.13 | Emit DISPUTE_WON event | Event notification | 1.7.2 |
| 3.27.3.14 | Emit DISPUTE_LOST event | Event notification | 1.7.2 |
| 3.27.3.15 | Map Stripe dispute webhooks | Handle Stripe events | 4.4.4 |
| 3.27.3.16 | Map MP dispute webhooks | Handle MP events | 4.8.4 |

#### 3.27.4 Promo Code Race Conditions

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.4.1 | Write atomic redemption tests | Test race conditions | 1.2.7 |
| 3.27.4.2 | Create billing_promo_code_reservations table | Reservation storage | 2.3.3 |
| 3.27.4.3 | Implement row-level locking | FOR UPDATE NOWAIT | 3.7.1, 3.27.4.1 |
| 3.27.4.4 | Check expiration at redemption | Re-validate expiry | 3.27.4.3 |
| 3.27.4.5 | Atomic max redemptions check | COUNT in transaction | 3.27.4.3 |
| 3.27.4.6 | Implement reserveForCheckout() | Create reservation | 3.27.4.2, 3.27.4.1 |
| 3.27.4.7 | Implement TTL for reservations | 15-minute expiry | 3.27.4.6 |
| 3.27.4.8 | Cleanup expired reservations | Background job | 3.27.4.7 |
| 3.27.4.9 | Handle NOWAIT lock failure | Graceful error handling | 3.27.4.3 |
| 3.27.4.10 | Update checkout to use reservation | Integrate with checkout | 3.10.1, 3.27.4.6 |

#### 3.27.5 Trial Edge Cases

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.5.1 | Write trial edge case tests | Test all scenarios | 1.2.7 |
| 3.27.5.2 | Create billing_trial_history table | Track trial usage | 2.3.3 |
| 3.27.5.3 | Create QZPayTrialConfig interface | Trial configuration | 2.1.2 |
| 3.27.5.4 | Implement upgradeDuringTrial() | Preserve trial days | 3.4.2, 3.27.5.1 |
| 3.27.5.5 | Calculate remaining trial days | Days calculation | 3.27.5.4 |
| 3.27.5.6 | Implement reactivateAfterCancel() | Same-day reactivation | 3.4.2, 3.27.5.1 |
| 3.27.5.7 | Skip payment if in period | No charge for reactivation | 3.27.5.6 |
| 3.27.5.8 | Implement checkTrialEligibility() | Abuse prevention | 3.27.5.2, 3.27.5.1 |
| 3.27.5.9 | Hash email for tracking | SHA-256 email hash | 3.27.5.8 |
| 3.27.5.10 | Track device fingerprint | Optional device ID | 3.27.5.8 |
| 3.27.5.11 | Track card fingerprint | Payment method tracking | 3.27.5.8 |
| 3.27.5.12 | Implement cooldown period | Days between trials | 3.27.5.8 |
| 3.27.5.13 | Enforce extension limits | Max trial extensions | 3.27.5.3 |

#### 3.27.6 Concurrency Protection

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.6.1 | Write concurrency tests | Test race conditions | 1.2.7 |
| 3.27.6.2 | Create billing_webhook_processing table | Processing tracking | 2.3.3 |
| 3.27.6.3 | Create QZPayLockConfig interface | Lock configuration | 2.1.2 |
| 3.27.6.4 | Create QZPayLockService class | Distributed locks | 3.27.6.1 |
| 3.27.6.5 | Implement withSubscriptionLock() | Subscription-level lock | 3.27.6.4 |
| 3.27.6.6 | Implement lock TTL | 30-second default | 3.27.6.5 |
| 3.27.6.7 | Implement stale lock cleanup | 5-minute timeout | 3.27.6.5 |
| 3.27.6.8 | Implement processWebhookOnce() | Webhook deduplication | 3.27.6.2, 3.27.6.1 |
| 3.27.6.9 | Return cached result for duplicate | Skip reprocessing | 3.27.6.8 |
| 3.27.6.10 | Implement waitForEntity() | Entity polling | 3.27.6.4 |
| 3.27.6.11 | Handle webhook before response | Wait for entity | 3.27.6.10 |
| 3.27.6.12 | Implement executeJobOnce() | Job deduplication | 3.27.6.4 |
| 3.27.6.13 | Add locked_by tracking | Instance identification | 3.27.6.12 |

#### 3.27.7 Data Validation & Sanitization

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.7.1 | Write validation tests | Test all validators | 1.2.7 |
| 3.27.7.2 | Create QZPayValidationConfig interface | Validation options | 2.1.2 |
| 3.27.7.3 | Create email validation schema | Max 254 chars, format | 3.19.2, 3.27.7.1 |
| 3.27.7.4 | Create name validation schema | Max 255 chars | 3.27.7.1 |
| 3.27.7.5 | Implement sanitizeCustomerName() | Strip HTML, control chars | 3.27.7.1 |
| 3.27.7.6 | Implement emoji stripping | Configurable emoji removal | 3.27.7.5 |
| 3.27.7.7 | Implement unicode normalization | NFC form | 3.27.7.5 |
| 3.27.7.8 | Implement normalizeEmail() | Lowercase, plus removal | 3.27.7.1 |
| 3.27.7.9 | Handle gmail dot removal | Optional gmail normalization | 3.27.7.8 |
| 3.27.7.10 | Implement sanitizeMetadata() | Clean metadata object | 3.27.7.1 |
| 3.27.7.11 | Validate metadata keys | Alphanumeric only | 3.27.7.10 |
| 3.27.7.12 | Limit metadata values | 1000 char max | 3.27.7.10 |
| 3.27.7.13 | Implement escapeForDisplay() | XSS prevention | 3.27.7.1 |
| 3.27.7.14 | Integrate with all inputs | Apply to services | 3.27.7.3-3.27.7.13 |

#### 3.27.8 Multi-Tenancy Feature

This section implements the complete multi-tenancy feature as specified in PDR.md FR-TENANT-003 through FR-TENANT-006.

##### 3.27.8.1 Tenancy Configuration

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.1.1 | Define QZPayTenancyMode const | 'single' and 'multi' modes | 1.3.14 |
| 3.27.8.1.2 | Define QZPayMissingTenantAction const | 'reject', 'default', 'public' | 1.3.14 |
| 3.27.8.1.3 | Define QZPayJobType const | 'tenant' and 'global' | 1.3.14 |
| 3.27.8.1.4 | Define QZPaySuperadminOperation const | 'read', 'write', 'delete', 'impersonate' | 1.3.14 |
| 3.27.8.1.5 | Define QZPayImpersonationEndReason const | 'manual', 'expired', 'logout' | 1.3.14 |
| 3.27.8.1.6 | Create QZPayTenancyConfig interface | Complete tenancy config | 2.1.2 |
| 3.27.8.1.7 | Create QZPaySuperadminConfig interface | Superadmin options | 2.1.2 |
| 3.27.8.1.8 | Create QZPayDefaultTenancyConfig const | Default values | 3.27.8.1.6 |
| 3.27.8.1.9 | Add tenancy to QZPayBillingConfig | tenancy: QZPayTenancyConfig section | 3.27.8.1.6 |
| 3.27.8.1.10 | Validate tenancy config on init | Validate all tenancy options | 3.27.8.1.9 |

##### 3.27.8.2 Tenant Context Middleware

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.2.1 | Write tenant context tests | Test all resolution scenarios | 1.2.7 |
| 3.27.8.2.2 | Create AsyncLocalStorage for tenant | Store tenant in async context | 3.27.8.2.1 |
| 3.27.8.2.3 | Create getCurrentTenant() helper | Get current tenant from context | 3.27.8.2.2 |
| 3.27.8.2.4 | Create setTenantContext() helper | Set tenant programmatically | 3.27.8.2.2 |
| 3.27.8.2.5 | Create billing.withTenant() method | Run code in tenant context | 3.27.8.2.4 |
| 3.27.8.2.6 | Implement tenantResolver priority | header → JWT → subdomain → null | 3.27.8.2.1 |
| 3.27.8.2.7 | Write onMissingTenant tests | Test all three modes | 3.27.8.2.1 |
| 3.27.8.2.8 | Implement onMissingTenant: 'reject' | Return 401 with TENANT_REQUIRED | 3.27.8.2.7 |
| 3.27.8.2.9 | Implement onMissingTenant: 'default' | Use defaultTenantId | 3.27.8.2.7 |
| 3.27.8.2.10 | Implement onMissingTenant: 'public' | Allow only publicEndpoints | 3.27.8.2.7 |
| 3.27.8.2.11 | Create TENANT_REQUIRED error | Error code and message | 1.2.7 |
| 3.27.8.2.12 | Add checkedSources to error details | Track resolution attempts | 3.27.8.2.11 |
| 3.27.8.2.13 | Create tenant middleware for Hono | Integrate with Hono adapter | 5.2.2, 3.27.8.2.6 |
| 3.27.8.2.14 | Create tenant middleware for NestJS | Integrate with NestJS adapter | 5.3.2, 3.27.8.2.6 |

##### 3.27.8.3 Background Jobs Tenant Context

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.3.1 | Write tenant job tests | Test tenant job requirements | 1.2.7 |
| 3.27.8.3.2 | Create QZPayJobConfig interface | Job configuration with type | 2.1.2 |
| 3.27.8.3.3 | Create JOB_TENANT_REQUIRED error | Error code and message | 1.2.7 |
| 3.27.8.3.4 | Validate tenantId on tenant job enqueue | Error if tenantId missing | 3.27.8.3.1 |
| 3.27.8.3.5 | Write global job tests | Test global job behavior | 1.2.7 |
| 3.27.8.3.6 | Allow global jobs without tenantId | Skip validation for type: 'global' | 3.27.8.3.5 |
| 3.27.8.3.7 | Auto-set tenant context in job processor | Set context from job.tenantId | 3.27.8.2.4 |
| 3.27.8.3.8 | Add tenantId to job execution logs | Include for audit trail | 3.27.8.3.7 |
| 3.27.8.3.9 | Write billing.tenants.list() tests | Test tenant listing | 1.2.7 |
| 3.27.8.3.10 | Implement billing.tenants.list() | List all tenants for global jobs | 3.27.8.3.9 |
| 3.27.8.3.11 | Implement tenant iteration in global jobs | withTenant for each tenant | 3.27.8.2.5, 3.27.8.3.10 |
| 3.27.8.3.12 | Update all existing jobs | Add type: 'tenant' and tenantId | 3.17.1-3.17.20, 3.27.8.3.4 |

##### 3.27.8.4 Superadmin Impersonation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.4.1 | Write impersonation tests | Test all impersonation flows | 1.2.7 |
| 3.27.8.4.2 | Create QZPayImpersonationSession interface | Session data structure | 2.1.2 |
| 3.27.8.4.3 | Create billing_impersonation_sessions table | Store active sessions | 2.3.3 |
| 3.27.8.4.4 | Implement isSuperadmin check | Validate superadmin status | 3.27.8.4.1 |
| 3.27.8.4.5 | Implement billing.admin.impersonate() | Start impersonation session | 3.27.8.4.1 |
| 3.27.8.4.6 | Require reason parameter | Error if reason missing | 3.27.8.4.5 |
| 3.27.8.4.7 | Create IMPERSONATION_REASON_REQUIRED error | Error code | 1.2.7 |
| 3.27.8.4.8 | Generate unique sessionId | UUID for session correlation | 3.27.8.4.5 |
| 3.27.8.4.9 | Set session expiry | Default 1 hour from start | 3.27.8.4.5 |
| 3.27.8.4.10 | Emit ADMIN_IMPERSONATION_STARTED event | Include all session details | 1.7.2 |
| 3.27.8.4.11 | Implement billing.admin.endImpersonation() | End session manually | 3.27.8.4.1 |
| 3.27.8.4.12 | Emit ADMIN_IMPERSONATION_ENDED event | Include session duration | 1.7.2 |
| 3.27.8.4.13 | Implement session expiry check | Auto-expire after sessionDuration | 3.27.8.4.9 |
| 3.27.8.4.14 | Add impersonatedBy to all operations | Track in metadata | 3.27.8.4.5 |
| 3.27.8.4.15 | Add impersonatedBy to webhook payloads | Include in webhook metadata | 3.27.8.4.14 |
| 3.27.8.4.16 | Create IMPERSONATION_NOT_ALLOWED error | When disabled or unauthorized | 1.2.7 |
| 3.27.8.4.17 | Create IMPERSONATION_SESSION_EXPIRED error | When session expired | 1.2.7 |
| 3.27.8.4.18 | Enforce allowedOperations | Restrict superadmin actions | 3.27.8.4.5 |

##### 3.27.8.5 Cross-Tenant Query

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.5.1 | Write cross-tenant query tests | Test query functionality | 1.2.7 |
| 3.27.8.5.2 | Create QZPayCrossTenantQueryOptions interface | Query options | 2.1.2 |
| 3.27.8.5.3 | Implement billing.admin.crossTenantQuery() | Query across tenants | 3.27.8.5.1 |
| 3.27.8.5.4 | Require reason parameter | Error if reason missing | 3.27.8.5.3 |
| 3.27.8.5.5 | Support entity: customers | Cross-tenant customer query | 3.27.8.5.3 |
| 3.27.8.5.6 | Support entity: subscriptions | Cross-tenant subscription query | 3.27.8.5.3 |
| 3.27.8.5.7 | Support entity: payments | Cross-tenant payment query | 3.27.8.5.3 |
| 3.27.8.5.8 | Support entity: invoices | Cross-tenant invoice query | 3.27.8.5.3 |
| 3.27.8.5.9 | Add tenantId to each result | Include tenant in response | 3.27.8.5.3 |
| 3.27.8.5.10 | Support pagination (limit, offset) | Paginate results | 3.27.8.5.3 |
| 3.27.8.5.11 | Support tenantIds filter | Query specific tenants | 3.27.8.5.3 |
| 3.27.8.5.12 | Emit ADMIN_CROSS_TENANT_QUERY event | Include query details | 1.7.2 |
| 3.27.8.5.13 | Track execution time | Log query performance | 3.27.8.5.12 |
| 3.27.8.5.14 | Track row count | Log result size | 3.27.8.5.12 |

##### 3.27.8.6 Tenant Context in Events

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.6.1 | Write event tenant context tests | Test all event scenarios | 1.2.7 |
| 3.27.8.6.2 | Add tenantId to base event payload | Include in all events | 1.7.2 |
| 3.27.8.6.3 | Add metadata to base event payload | impersonatedBy, jobId, requestId | 1.7.2 |
| 3.27.8.6.4 | Auto-populate tenantId from context | Get from getCurrentTenant() | 3.27.8.2.3 |
| 3.27.8.6.5 | Set tenantId: null for global events | TENANT_*, ADMIN_* events | 3.27.8.6.2 |
| 3.27.8.6.6 | Add impersonatedBy to event metadata | Track impersonation | 3.27.8.4.14 |
| 3.27.8.6.7 | Add jobId to event metadata | Track job origin | 3.27.8.3.7 |
| 3.27.8.6.8 | Add requestId to event metadata | HTTP correlation ID | 3.27.8.6.3 |
| 3.27.8.6.9 | Add X-QZPay-Tenant-Id webhook header | Include tenant in header | 3.27.8.6.2 |
| 3.27.8.6.10 | Add tenantId to webhook body | Include in JSON payload | 3.27.8.6.2 |
| 3.27.8.6.11 | Add metadata to webhook body | Include impersonatedBy etc. | 3.27.8.6.3 |
| 3.27.8.6.12 | Set tenant context in event handlers | Auto-set from event.tenantId | 3.27.8.2.4 |

##### 3.27.8.7 Tenancy Events

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.7.1 | Define TENANT_CREATED event constant | tenant.created | 1.3.14 |
| 3.27.8.7.2 | Define TENANT_SUSPENDED event constant | tenant.suspended | 1.3.14 |
| 3.27.8.7.3 | Define TENANT_REACTIVATED event constant | tenant.reactivated | 1.3.14 |
| 3.27.8.7.4 | Define ADMIN_IMPERSONATION_STARTED event | admin.impersonation.started | 1.3.14 |
| 3.27.8.7.5 | Define ADMIN_IMPERSONATION_ENDED event | admin.impersonation.ended | 1.3.14 |
| 3.27.8.7.6 | Define ADMIN_CROSS_TENANT_QUERY event | admin.cross_tenant.query | 1.3.14 |
| 3.27.8.7.7 | Create TENANT_CREATED payload interface | tenantId, tenantName, createdBy | 2.1.2 |
| 3.27.8.7.8 | Create TENANT_SUSPENDED payload interface | tenantId, suspendedBy, reason | 2.1.2 |
| 3.27.8.7.9 | Create ADMIN_IMPERSONATION_STARTED payload | Full session details | 2.1.2 |
| 3.27.8.7.10 | Create ADMIN_IMPERSONATION_ENDED payload | Session summary | 2.1.2 |
| 3.27.8.7.11 | Create ADMIN_CROSS_TENANT_QUERY payload | Query details and metrics | 2.1.2 |
| 3.27.8.7.12 | Add events to QZPayBillingEvent enum | Include all tenancy events | 1.3.14 |

##### 3.27.8.8 Tenancy Database Schema (Multi-Tenant Only)

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.8.1 | Create billing_tenants table | Store tenant records | 2.3.3 |
| 3.27.8.8.2 | Add tenant_id column to all tables | Conditional on mode: 'multi' | 2.3.1-2.3.17 |
| 3.27.8.8.3 | Update unique constraints (see detailed list below) | Include tenant_id in unique keys | 3.27.8.8.2 |
| 3.27.8.8.4 | Create indexes on tenant_id | Fast tenant filtering | 3.27.8.8.2 |

**Task 3.27.8.8.3 Detail: Unique Constraints to Update in Multi-Tenant Mode**

| Sub-ID | Table | Single-Tenant Constraint | Multi-Tenant Constraint | Purpose |
|--------|-------|--------------------------|-------------------------|---------|
| 3.27.8.8.3.a | billing_customers | `UNIQUE (external_id, livemode)` | `UNIQUE (tenant_id, external_id, livemode)` | Each tenant can have customer with same external_id |
| 3.27.8.8.3.b | billing_invoices | `UNIQUE (number)` | `UNIQUE (tenant_id, number)` | Each tenant can have invoice #INV-0001 |
| 3.27.8.8.3.c | billing_promo_codes | `UNIQUE (code)` | `UNIQUE (tenant_id, code)` | Each tenant can have promo code "SALE20" |
| 3.27.8.8.3.d | billing_vendors | `UNIQUE (external_id)` | `UNIQUE (tenant_id, external_id)` | Each tenant can have vendor with same external_id |
| 3.27.8.8.3.e | billing_idempotency_keys | `UNIQUE (key)` | `UNIQUE (tenant_id, key)` | Idempotency scoped per tenant |
| 3.27.8.8.3.f | billing_credit_notes | `UNIQUE (number)` | `UNIQUE (tenant_id, number)` | Each tenant can have credit note #CN-0001 |
| 3.27.8.8.3.g | billing_plans | `UNIQUE (plan_id)` | `UNIQUE (tenant_id, plan_id)` | Each tenant can define their own "pro" plan |
| 3.27.8.8.3.h | billing_automatic_discounts | `UNIQUE (discount_id)` | `UNIQUE (tenant_id, discount_id)` | Each tenant can have "summer-sale" discount |
| 3.27.8.8.3.i | billing_addon_definitions | `UNIQUE (addon_id)` | `UNIQUE (tenant_id, addon_id)` | Each tenant can define "extra-users" addon |
| 3.27.8.8.3.j | billing_webhook_processing | `UNIQUE (webhook_id)` | `UNIQUE (tenant_id, webhook_id)` | Webhook tracking per tenant |

**Constraints that DO NOT need modification** (already include tenant-specific FKs):
- `billing_promo_code_usage (promo_code_id, customer_id, subscription_id)`
- `billing_invoice_payments (invoice_id, payment_id)`
- `billing_usage_records (subscription_id, metric_name, period_start)`
- `billing_exchange_rates (from_currency, to_currency, is_manual_override)` - Global, shared across tenants
| 3.27.8.8.5 | Create billing_impersonation_sessions table | Active impersonation sessions | 2.3.3 |
| 3.27.8.8.6 | Add columns: sessionId, adminId, adminEmail | Core identifiers | 3.27.8.8.5 |
| 3.27.8.8.7 | Add columns: targetTenantId, reason | Impersonation target | 3.27.8.8.5 |
| 3.27.8.8.8 | Add columns: allowedOperations | JSON array | 3.27.8.8.5 |
| 3.27.8.8.9 | Add columns: startedAt, expiresAt, endedAt | Session lifecycle | 3.27.8.8.5 |
| 3.27.8.8.10 | Add index on sessionId | Fast lookup | 3.27.8.8.5 |
| 3.27.8.8.11 | Add index on adminId | Audit queries | 3.27.8.8.5 |
| 3.27.8.8.12 | Create migration for tenancy tables | Single migration | 3.27.8.8.1-3.27.8.8.11 |

##### 3.27.8.9 Tenancy Error Handling

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.27.8.9.1 | Create TENANT_REQUIRED error | code, message, details | 1.2.7 |
| 3.27.8.9.2 | Create JOB_TENANT_REQUIRED error | code, message, details | 1.2.7 |
| 3.27.8.9.3 | Create IMPERSONATION_NOT_ALLOWED error | code, message | 1.2.7 |
| 3.27.8.9.4 | Create IMPERSONATION_REASON_REQUIRED error | code, message | 1.2.7 |
| 3.27.8.9.5 | Create IMPERSONATION_SESSION_EXPIRED error | code, message | 1.2.7 |
| 3.27.8.9.6 | Create CROSS_TENANT_QUERY_NOT_ALLOWED error | code, message | 1.2.7 |
| 3.27.8.9.7 | Add hint to TENANT_REQUIRED error | Explain resolution sources | 3.27.8.9.1 |
| 3.27.8.9.8 | Add hint to JOB_TENANT_REQUIRED error | Explain type: 'global' option | 3.27.8.9.2 |
| 3.27.8.9.9 | Integrate errors in tenancy middleware | Use in request handling | 3.27.8.2.8, 3.27.8.9.1 |
| 3.27.8.9.10 | Integrate errors in job service | Use in job validation | 3.27.8.3.4, 3.27.8.9.2 |
| 3.27.8.9.11 | Integrate errors in admin service | Use in impersonation | 3.27.8.4.5, 3.27.8.9.3-5 |

### 3.28 Architecture & Data Improvements (P2 - v1.1)

#### 3.28.1 Status Mapping with Fallback

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.28.1.1 | Write status mapping tests | Test fallback behavior | 1.2.7 |
| 3.28.1.2 | Add UNKNOWN to QZPaySubscriptionStatus | New status constant | 1.3.1 |
| 3.28.1.3 | Add UNKNOWN to QZPayPaymentStatus | New status constant | 1.3.2 |
| 3.28.1.4 | Add UNKNOWN to QZPayInvoiceStatus | New status constant | 1.3.3 |
| 3.28.1.5 | Create QZPayStatusMapperConfig interface | Mapper configuration | 2.1.2 |
| 3.28.1.6 | Create QZPayStatusMapper class | Core mapper service | 3.28.1.1 |
| 3.28.1.7 | Implement Stripe status mappings | Map all Stripe statuses | 3.28.1.6 |
| 3.28.1.8 | Implement MP status mappings | Map all MP statuses | 3.28.1.6 |
| 3.28.1.9 | Implement fallback to UNKNOWN | Return UNKNOWN for unmapped | 3.28.1.6 |
| 3.28.1.10 | Implement reportUnknownStatus() | Log and emit event | 3.28.1.9 |
| 3.28.1.11 | Add custom handler support | Configurable callback | 3.28.1.10 |
| 3.28.1.12 | Emit UNKNOWN_STATUS_RECEIVED event | Event for monitoring | 1.7.2 |
| 3.28.1.13 | Integrate with Stripe adapter | Use mapper in adapter | 4.2.9, 3.28.1.6 |
| 3.28.1.14 | Integrate with MP adapter | Use mapper in adapter | 4.6.7, 3.28.1.6 |

#### 3.28.2 Query Builder Pattern

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.28.2.1 | Write query builder tests | Test all operators | 1.2.7 |
| 3.28.2.2 | Create QZPayQueryOptions interface | Query options type | 2.1.2 |
| 3.28.2.3 | Create QZPayWhereClause interface | Where clause type | 2.1.2 |
| 3.28.2.4 | Create QZPayWhereOperator interface | Operator types | 2.1.2 |
| 3.28.2.5 | Create QZPayIncludeOptions interface | Include options type | 2.1.2 |
| 3.28.2.6 | Create QZPayOrderByClause type | Order by type | 2.1.2 |
| 3.28.2.7 | Implement equals operator | Exact match | 3.28.2.1 |
| 3.28.2.8 | Implement in/notIn operators | Array membership | 3.28.2.1 |
| 3.28.2.9 | Implement gt/gte/lt/lte operators | Comparisons | 3.28.2.1 |
| 3.28.2.10 | Implement contains/startsWith/endsWith | String operators | 3.28.2.1 |
| 3.28.2.11 | Implement isNull operator | Null check | 3.28.2.1 |
| 3.28.2.12 | Implement include resolution | Load related entities | 3.28.2.1 |
| 3.28.2.13 | Implement orderBy | Multi-field sorting | 3.28.2.1 |
| 3.28.2.14 | Implement limit/offset | Offset pagination | 3.28.2.1 |
| 3.28.2.15 | Implement cursor pagination | Cursor-based pagination | 3.28.2.1 |
| 3.28.2.16 | Create QZPaySubscriptionQuery class | Fluent builder | 3.28.2.7-3.28.2.15 |
| 3.28.2.17 | Add findMany() to SubscriptionService | Object-based query | 3.4.2, 3.28.2.16 |
| 3.28.2.18 | Add query() to SubscriptionService | Fluent query builder | 3.4.2, 3.28.2.16 |
| 3.28.2.19 | Apply to CustomerService | Query builder for customers | 3.1.1, 3.28.2.16 |
| 3.28.2.20 | Apply to InvoiceService | Query builder for invoices | 3.6.1, 3.28.2.16 |
| 3.28.2.21 | Apply to PaymentService | Query builder for payments | 3.5.1, 3.28.2.16 |

#### 3.28.3 Data Integrity Constraints

**IMPORTANT**: Use correct column names. See DATA-MODEL.md "Column Reference for Constraints".

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.28.3.1 | Write constraint tests | Test all constraints | 1.2.7 |
| 3.28.3.2 | Create validate_payment_customer trigger | Customer consistency | 2.3.3 |
| 3.28.3.3 | Add chk_invoice_positive_amounts | Check: subtotal, total, amount_paid, discount, tax >= 0 | 2.3.4 |
| 3.28.3.4 | Add chk_subscription_dates | Check: period_end > period_start, trial dates | 2.3.2 |
| 3.28.3.5 | Add chk_promo_usage_limit | Check: max_uses IS NULL OR used_count <= max_uses | 2.3.5 |
| 3.28.3.6 | Add chk_payment_amount_precision | Two decimal places | 2.3.3 |
| 3.28.3.7 | Add migration for constraints | Database migration | 3.28.3.2-3.28.3.6 |
| 3.28.3.8 | Handle constraint violations | Error mapping | 3.28.3.7 |
| 3.28.3.9 | Document constraint errors | Error documentation | 3.28.3.8 |

##### 3.28.3A Column Reference for Constraints

| Table | ❌ Wrong Column | ✅ Correct Column | Used In |
|-------|-----------------|-------------------|---------|
| `billing_invoices` | `amount` | `total` | chk_invoice_positive_amounts |
| `billing_invoices` | `amount_due` | `amount_remaining` | Covering indexes |
| `billing_promo_codes` | `max_redemptions` | `max_uses` | chk_promo_usage_limit |
| `billing_promo_codes` | `times_redeemed` | `used_count` | chk_promo_usage_limit |
| `billing_promo_codes` | `discount_type` | `type` | Covering indexes |
| `billing_promo_codes` | `discount_value` | `value` | Covering indexes |

#### 3.28.4 Covering Indexes

**IMPORTANT**: Use correct column names in INCLUDE clause. See 3.28.3A for reference.

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 3.28.4.1 | Analyze query patterns | Identify hot queries | 2.3.3 |
| 3.28.4.2 | Create idx_subscriptions_customer_status_covering | Subscription by customer | 2.3.2 |
| 3.28.4.3 | Create idx_subscriptions_period_end_covering | Expiring subscriptions | 2.3.2 |
| 3.28.4.4 | Create idx_subscriptions_trial_end_covering | Trial ending | 2.3.2 |
| 3.28.4.5 | Create idx_invoices_customer_covering | INCLUDE: total, amount_remaining (not amount, amount_due) | 2.3.4 |
| 3.28.4.6 | Create idx_invoices_unpaid_covering | INCLUDE: amount_remaining (not amount_due) | 2.3.4 |
| 3.28.4.7 | Create idx_payments_customer_covering | Customer payments | 2.3.3 |
| 3.28.4.8 | Create idx_payments_pending_covering | Pending payments | 2.3.3 |
| 3.28.4.9 | Create idx_promo_codes_active_covering | INCLUDE: type, value, max_uses, used_count | 2.3.5 |
| 3.28.4.10 | Add migration for indexes | Database migration | 3.28.4.2-3.28.4.9 |
| 3.28.4.11 | Create index usage monitoring query | Performance monitoring | 3.28.4.10 |
| 3.28.4.12 | Document index maintenance | Maintenance guide | 3.28.4.11 |

---

## Phase 4: Payment Providers

### 4.1 Stripe Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.1.1 | Create packages/stripe directory | Initialize package | 1.1.1 |
| 4.1.2 | Create stripe package.json | Dependencies: stripe | 4.1.1 |
| 4.1.3 | Create stripe tsconfig.json | Extend base config | 4.1.1 |
| 4.1.4 | Setup tsup config | Bundle configuration | 4.1.2 |
| 4.1.5 | Create src/index.ts | Main exports | 4.1.1 |

### 4.2 Stripe Adapter Implementation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.2.1 | Write Stripe adapter base tests | Test createQZPayStripeAdapter() factory | 4.1.5, 1.5.1 |
| 4.2.2 | Write customer operations tests | Test customer CRUD | 4.1.5 |
| 4.2.3 | Write payment intent tests | Test payment creation, confirmation | 4.1.5 |
| 4.2.4 | Write refund tests | Test refund operations | 4.1.5 |
| 4.2.5 | Write subscription tests | Test subscription lifecycle | 4.1.5 |
| 4.2.6 | Write trial tests | Test trial with/without card | 4.1.5 |
| 4.2.7 | Write checkout tests | Test checkout session creation | 4.1.5 |
| 4.2.8 | Write payment method tests | Test payment method operations | 4.1.5 |
| 4.2.9 | Create adapter.ts base | createQZPayStripeAdapter() factory | 4.1.5, 1.5.1, 4.2.1-4.2.8 |
| 4.2.10 | Implement createCustomer | Create Stripe customer | 4.2.9 |
| 4.2.11 | Implement getCustomer | Retrieve customer | 4.2.9 |
| 4.2.12 | Implement updateCustomer | Update customer | 4.2.9 |
| 4.2.13 | Implement deleteCustomer | Delete customer | 4.2.9 |
| 4.2.14 | Implement createPaymentIntent | Create payment intent | 4.2.9 |
| 4.2.15 | Implement confirmPayment | Confirm payment | 4.2.9 |
| 4.2.16 | Implement refundPayment | Create refund | 4.2.9 |
| 4.2.17 | Implement createSubscription | Create Stripe subscription | 4.2.9 |
| 4.2.18 | Implement createTrialSubscription | Trial with/without card | 4.2.17 |
| 4.2.19 | Implement updateSubscription | Update subscription | 4.2.9 |
| 4.2.20 | Implement cancelSubscription | Cancel subscription | 4.2.9 |
| 4.2.21 | Implement createCheckoutSession | Create checkout session | 4.2.9 |
| 4.2.22 | Implement createEmbeddedCheckout | Embedded checkout | 4.2.21 |
| 4.2.23 | Implement createPortalSession | Customer portal | 4.2.9 |
| 4.2.24 | Implement attachPaymentMethod | Attach payment method | 4.2.9 |
| 4.2.25 | Implement detachPaymentMethod | Detach payment method | 4.2.9 |
| 4.2.26 | Implement listPaymentMethods | List customer methods | 4.2.9 |
| 4.2.27 | Implement setDefaultPaymentMethod | Set default method | 4.2.9 |

### 4.3 Stripe Connect

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.3.1 | Write Stripe Connect tests | Test Connect operations | 4.1.5 |
| 4.3.2 | Create connect.ts | Stripe Connect module | 4.1.5, 4.3.1 |
| 4.3.3 | Implement createAccount | Create Connect account | 4.3.2 |
| 4.3.4 | Implement createAccountLink | Onboarding link | 4.3.2 |
| 4.3.5 | Implement getAccountStatus | Get account status | 4.3.2 |
| 4.3.6 | Implement createTransfer | Transfer to Connect account | 4.3.2 |
| 4.3.7 | Implement createPayout | Trigger payout | 4.3.2 |
| 4.3.8 | Implement getBalance | Get Connect balance | 4.3.2 |

### 4.4 Stripe Webhooks

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.4.1 | Write Stripe webhook tests | Test webhook handling | 4.1.5 |
| 4.4.2 | Create webhooks.ts | Webhook handler module | 4.1.5, 4.4.1 |
| 4.4.3 | Implement verifySignature | Verify webhook signature | 4.4.2 |
| 4.4.4 | Implement parseEvent | Parse webhook event | 4.4.2 |
| 4.4.5 | Map checkout.session.completed | Handle checkout complete | 4.4.4 |
| 4.4.6 | Map invoice.paid | Handle invoice paid | 4.4.4 |
| 4.4.7 | Map invoice.payment_failed | Handle payment failed | 4.4.4 |
| 4.4.8 | Map customer.subscription.* | Handle subscription events | 4.4.4 |
| 4.4.9 | Map payment_intent.* | Handle payment events | 4.4.4 |
| 4.4.10 | Map account.updated | Handle Connect account updates | 4.4.4 |

### 4.5 MercadoPago Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.5.1 | Create packages/mercadopago directory | Initialize package | 1.1.1 |
| 4.5.2 | Create mp package.json | Dependencies: mercadopago | 4.5.1 |
| 4.5.3 | Create mp tsconfig.json | Extend base config | 4.5.1 |
| 4.5.4 | Setup tsup config | Bundle configuration | 4.5.2 |
| 4.5.5 | Create src/index.ts | Main exports | 4.5.1 |

### 4.6 MercadoPago Adapter

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.6.1 | Write MP adapter base tests | Test createQZPayMercadoPagoAdapter() factory | 4.5.5, 1.5.1 |
| 4.6.2 | Write MP customer tests | Test customer operations | 4.5.5 |
| 4.6.3 | Write MP payment tests | Test payment operations | 4.5.5 |
| 4.6.4 | Write MP refund tests | Test refund operations | 4.5.5 |
| 4.6.5 | Write MP preference tests | Test checkout preference | 4.5.5 |
| 4.6.6 | Write MP subscription tests | Test preapproval operations | 4.5.5 |
| 4.6.7 | Create adapter.ts base | createQZPayMercadoPagoAdapter() factory | 4.5.5, 1.5.1, 4.6.1-4.6.6 |
| 4.6.8 | Implement createCustomer | Create MP customer | 4.6.7 |
| 4.6.9 | Implement getCustomer | Retrieve customer | 4.6.7 |
| 4.6.10 | Implement createPayment | Create payment | 4.6.7 |
| 4.6.11 | Implement getPayment | Get payment status | 4.6.7 |
| 4.6.12 | Implement refundPayment | Create refund | 4.6.7 |
| 4.6.13 | Implement createPreference | Create checkout preference | 4.6.7 |
| 4.6.14 | Implement createSubscription | Create preapproval | 4.6.7 |
| 4.6.15 | Implement updateSubscription | Update preapproval | 4.6.7 |
| 4.6.16 | Implement cancelSubscription | Cancel preapproval | 4.6.7 |

### 4.7 MercadoPago Marketplace

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.7.1 | Write MP Marketplace tests | Test marketplace operations | 4.5.5 |
| 4.7.2 | Create marketplace.ts | MP Marketplace module | 4.5.5, 4.7.1 |
| 4.7.3 | Implement createAuthLink | OAuth authorization link | 4.7.2 |
| 4.7.4 | Implement exchangeCode | Exchange code for token | 4.7.2 |
| 4.7.5 | Implement getAccountStatus | Get merchant status | 4.7.2 |
| 4.7.6 | Implement createSplitPayment | Split payment creation | 4.7.2 |

### 4.8 MercadoPago Webhooks

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 4.8.1 | Write MP webhook tests | Test webhook handling | 4.5.5 |
| 4.8.2 | Create webhooks.ts | Webhook handler module | 4.5.5, 4.8.1 |
| 4.8.3 | Implement verifySignature | Verify webhook | 4.8.2 |
| 4.8.4 | Implement parseEvent | Parse IPN notification | 4.8.2 |
| 4.8.5 | Map payment events | Handle payment notifications | 4.8.4 |
| 4.8.6 | Map subscription events | Handle preapproval notifications | 4.8.4 |

---

## Phase 5: Framework Integration

### 5.1 Hono Package

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 5.1.1 | Create packages/hono directory | Initialize package | 1.1.1 |
| 5.1.2 | Create hono package.json | Dependencies: hono | 5.1.1 |
| 5.1.3 | Create hono tsconfig.json | Extend base config | 5.1.1 |
| 5.1.4 | Create src/index.ts | Main exports | 5.1.1 |
| 5.1.5 | Write Hono routes tests | Integration tests | 5.1.4 |
| 5.1.6 | Create routes.ts | createQZPayBillingRoutes() factory | 5.1.4, 5.1.5 |
| 5.1.7 | Implement route registration logic | Register based on config | 5.1.6 |
| 5.1.8 | Implement conditional webhook routes | Only if adapter configured | 5.1.7 |
| 5.1.9 | Implement checkout routes | Checkout endpoints | 5.1.6 |
| 5.1.10 | Implement subscription routes | Subscription endpoints | 5.1.6 |
| 5.1.11 | Implement payment routes | Payment endpoints | 5.1.6 |
| 5.1.12 | Implement customer routes | Customer endpoints | 5.1.6 |
| 5.1.13 | Implement invoice routes | Invoice endpoints | 5.1.6 |
| 5.1.14 | Implement vendor routes | Marketplace endpoints | 5.1.6 |
| 5.1.15 | Implement admin routes | Admin endpoints | 5.1.6 |
| 5.1.16 | Implement jobs/run-due route | Job execution endpoint | 5.1.6 |
| 5.1.17 | Create middleware | Auth, validation | 5.1.4 |

### 5.2 NestJS Package

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 5.2.1 | Create packages/nestjs directory | Initialize package | 1.1.1 |
| 5.2.2 | Create nestjs package.json | Dependencies: @nestjs/* | 5.2.1 |
| 5.2.3 | Create nestjs tsconfig.json | Extend base config | 5.2.1 |
| 5.2.4 | Create src/index.ts | Main exports | 5.2.1 |
| 5.2.5 | Write NestJS module tests | Integration tests | 5.2.4 |
| 5.2.6 | Create module.ts | QZPayBillingModule class | 5.2.4, 5.2.5 |
| 5.2.7 | Implement forRoot() | Sync configuration | 5.2.6 |
| 5.2.8 | Implement forRootAsync() | Async configuration | 5.2.6 |
| 5.2.9 | Implement conditional controller registration | Based on config | 5.2.6 |
| 5.2.10 | Create WebhooksController | Webhook endpoints | 5.2.6 |
| 5.2.11 | Create BillingController | Main endpoints | 5.2.6 |
| 5.2.12 | Create AdminController | Admin endpoints | 5.2.6 |
| 5.2.13 | Create JobsController | Jobs endpoint | 5.2.6 |
| 5.2.14 | Create custom decorators | @InjectQZPayBilling, etc. | 5.2.6 |
| 5.2.15 | Create guards | Auth guards | 5.2.6 |

---

## Phase 6: React Components

### 6.1 React Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 6.1.1 | Create packages/react directory | Initialize package | 1.1.1 |
| 6.1.2 | Create react package.json | Dependencies: react | 6.1.1 |
| 6.1.3 | Create react tsconfig.json | JSX config | 6.1.1 |
| 6.1.4 | Setup tsup for React | Bundle configuration | 6.1.2 |
| 6.1.5 | Create src/index.ts | Main exports | 6.1.1 |
| 6.1.6 | Create styles/variables.css | CSS custom properties | 6.1.1 |
| 6.1.7 | Setup React Testing Library | Test configuration | 6.1.2 |
| 6.1.8 | Setup Storybook | Component documentation | 6.1.2 |

### 6.2 Context and Hooks

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 6.2.1 | Write context provider tests | Test QZPayBillingProvider | 6.1.7 |
| 6.2.2 | Create QZPayBillingProvider | React context provider | 6.1.5, 6.2.1 |
| 6.2.3 | Write useQZPayBilling tests | Test context hook | 6.1.7 |
| 6.2.4 | Create useQZPayBilling | Context hook | 6.2.2, 6.2.3 |
| 6.2.5 | Write useQZPaySubscription tests | Test subscription hook | 6.1.7 |
| 6.2.6 | Create useQZPaySubscription | Subscription with helpers | 6.2.2, 6.2.5 |
| 6.2.7 | Write useQZPayPaymentMethod tests | Test payment operations hook | 6.1.7 |
| 6.2.8 | Create useQZPayPaymentMethod | Payment operations | 6.2.2, 6.2.7 |
| 6.2.9 | Write useQZPayCheckout tests | Test checkout flow hook | 6.1.7 |
| 6.2.10 | Create useQZPayCheckout | Checkout flow | 6.2.2, 6.2.9 |
| 6.2.11 | Write useQZPayCustomer tests | Test customer data hook | 6.1.7 |
| 6.2.12 | Create useQZPayCustomer | Customer data | 6.2.2, 6.2.11 |
| 6.2.13 | Write useQZPayVendor tests | Test vendor operations hook | 6.1.7 |
| 6.2.14 | Create useQZPayVendor | Vendor operations | 6.2.2, 6.2.13 |
| 6.2.15 | Write useQZPayPromoCode tests | Test promo code validation hook | 6.1.7 |
| 6.2.16 | Create useQZPayPromoCode | Promo code validation | 6.2.2, 6.2.15 |
| 6.2.17 | Write useQZPayEntitlements tests | Test entitlements hook | 6.1.7 |
| 6.2.18 | Create useQZPayEntitlements | Get subscription entitlements | 6.2.6, 6.2.17 |
| 6.2.19 | Write useQZPayLimits tests | Test limits hook | 6.1.7 |
| 6.2.20 | Create useQZPayLimits | Get subscription limits | 6.2.6, 6.2.19 |

### 6.3 Components

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 6.3.1 | Write component tests | Test all components | 6.1.7 |
| 6.3.2 | Create component stories | Stories for all components | 6.1.8 |
| 6.3.3 | Create QZPayPricingTable | Plan display | 6.2.2, 6.3.1 |
| 6.3.4 | Create QZPayCheckoutButton | Checkout trigger | 6.2.10, 6.3.1 |
| 6.3.5 | Create QZPayCheckoutForm | Embedded checkout | 6.2.10, 6.3.1 |
| 6.3.6 | Create QZPaySubscriptionCard | Subscription status | 6.2.6, 6.3.1 |
| 6.3.7 | Create QZPayPaymentHistory | Payment list | 6.2.8, 6.3.1 |
| 6.3.8 | Create QZPayPaymentMethodManager | Manage cards | 6.2.8, 6.3.1 |
| 6.3.9 | Create QZPayInvoiceList | Invoice list | 6.2.2, 6.3.1 |
| 6.3.10 | Create QZPayUsageDisplay | Usage metrics | 6.2.6, 6.3.1 |
| 6.3.11 | Create QZPayUpgradeModal | Plan change dialog | 6.2.6, 6.3.1 |
| 6.3.12 | Create QZPayCancelSubscriptionFlow | Cancel wizard | 6.2.6, 6.3.1 |
| 6.3.13 | Create QZPayPromoCodeInput | Promo code field | 6.2.16, 6.3.1 |
| 6.3.14 | Create QZPayTrialBanner | Trial status | 6.2.6, 6.3.1 |
| 6.3.15 | Create QZPayPaymentDueBanner | Payment alert | 6.2.6, 6.3.1 |
| 6.3.16 | Create QZPayQuotaUsageBar | Usage bar | 6.2.6, 6.3.1 |
| 6.3.17 | Create QZPayBillingPortal | Full billing page | 6.3.3-6.3.16 |
| 6.3.18 | Create QZPayReceiptView | Receipt display | 6.2.8, 6.3.1 |
| 6.3.19 | Create QZPayRefundRequestForm | Refund form | 6.2.8, 6.3.1 |
| 6.3.20 | Create QZPayVendorOnboarding | Onboarding flow | 6.2.14, 6.3.1 |
| 6.3.21 | Create QZPayVendorDashboard | Vendor stats | 6.2.14, 6.3.1 |
| 6.3.22 | Create QZPayVendorPayoutHistory | Payout list | 6.2.14, 6.3.1 |
| 6.3.23 | Create QZPayAdminCustomerList | Customer list | 6.2.2, 6.3.1 |
| 6.3.24 | Create QZPayAdminSubscriptionManager | Manage sub | 6.2.6, 6.3.1 |
| 6.3.25 | Create QZPayAdminPromoCodeManager | Promo CRUD | 6.2.16, 6.3.1 |
| 6.3.26 | Create QZPayAdminRevenueChart | Revenue chart | 6.2.2, 6.3.1 |

---

## Phase 7: CLI Tools

### 7.1 CLI Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 7.1.1 | Create bin directory in core | CLI entry point | 1.2.1 |
| 7.1.2 | Create init command handler | Handle init subcommands | 7.1.1 |
| 7.1.3 | Setup commander.js | CLI argument parsing | 7.1.1 |

### 7.2 Environment Generator

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 7.2.1 | Write env generator tests | Test .env generation | 1.2.7 |
| 7.2.2 | Create init:env command | Generate .env.example | 7.1.2, 7.2.1 |
| 7.2.3 | Implement adapter detection | Detect configured adapters | 7.2.2 |
| 7.2.4 | Generate Stripe vars | Add Stripe env vars | 7.2.3 |
| 7.2.5 | Generate MP vars | Add MP env vars | 7.2.3 |
| 7.2.6 | Generate DB vars | Add database env vars | 7.2.3 |
| 7.2.7 | Generate email vars | Add email env vars | 7.2.3 |
| 7.2.8 | Generate bank transfer vars | Add bank transfer vars | 7.2.3 |
| 7.2.9 | Add validation comments | Add description comments | 7.2.2 |

### 7.3 Environment Validation

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 7.3.1 | Write env validation tests | Test validation logic | 1.2.7 |
| 7.3.2 | Create validateEnv function | Validate required vars | 1.6.12, 7.3.1 |
| 7.3.3 | Add adapter-specific validation | Check vars based on adapters | 7.3.2 |
| 7.3.4 | Add descriptive error messages | Clear missing var errors | 7.3.2 |

### 7.4 Postinstall Script

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 7.4.1 | Create scripts directory | Create packages/core/scripts/ | 1.2.1 |
| 7.4.2 | Write postinstall tests | Test postinstall script | 1.2.7 |
| 7.4.3 | Create postinstall.js | Main postinstall script | 7.4.1, 7.4.2 |
| 7.4.4 | Add CI environment detection | Skip message in CI/CD | 7.4.3 |
| 7.4.5 | Create info box message | Formatted install success message | 7.4.3 |
| 7.4.6 | Add package.json postinstall | Add script to package.json | 7.4.3 |

---

## Phase 8: Documentation & Examples

### 8.1 Docs Package Setup

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 8.1.1 | Create packages/docs directory | Initialize package | 1.1.1 |
| 8.1.2 | Setup documentation framework | Astro/Nextra/Docusaurus | 8.1.1 |
| 8.1.3 | Create basic site structure | Navigation, layout | 8.1.2 |
| 8.1.4 | Setup MDX support | MDX processing | 8.1.2 |

### 8.2 Documentation Content

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 8.2.1 | Write Getting Started guide | Quick start | 8.1.3 |
| 8.2.2 | Write Installation guide | All packages | 8.1.3 |
| 8.2.3 | Write Configuration guide | All config options | 8.1.3 |
| 8.2.4 | Write Constants guide | All exported constants | 8.1.3 |
| 8.2.5 | Write Customers guide | Customer management | 8.1.3 |
| 8.2.6 | Write Subscriptions guide | Lifecycle, helpers, entitlements | 8.1.3 |
| 8.2.7 | Write Payments guide | Payment processing | 8.1.3 |
| 8.2.8 | Write Promo Codes guide | All types, examples | 8.1.3 |
| 8.2.9 | Write Trials guide | Trials with/without card | 8.1.3 |
| 8.2.10 | Write Marketplace guide | Vendor setup | 8.1.3 |
| 8.2.11 | Write Webhooks guide | Webhook handling | 8.1.3 |
| 8.2.12 | Write Events guide | Events, suppress, emailSentByPackage | 8.1.3 |
| 8.2.13 | Write Jobs guide | Background jobs | 8.1.3 |
| 8.2.14 | Write React Components guide | Component usage | 8.1.3 |
| 8.2.15 | Write Hono Integration guide | Hono setup | 8.1.3 |
| 8.2.16 | Write NestJS Integration guide | NestJS setup | 8.1.3 |
| 8.2.17 | Write Environment Variables guide | .env setup, CLI | 8.1.3 |
| 8.2.18 | Generate API Reference | TypeDoc/similar | 8.1.3 |

### 8.3 Examples

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 8.3.1 | Create Hono example (HOSPEDA) | Full Hono implementation | 5.1.17 |
| 8.3.2 | Create NestJS example (ASISTIA) | Full NestJS implementation | 5.2.15 |
| 8.3.3 | Create React example | React components demo | 6.3.26 |
| 8.3.4 | Create marketplace example (GEMFOLIO) | Marketplace scenario | 3.12.16 |

### 8.4 Final Polish

| ID | Task | Description | Dependencies |
|----|------|-------------|--------------|
| 8.4.1 | Review all TypeScript types | Strict type safety | All phases |
| 8.4.2 | Review constant usage | No magic strings | All phases |
| 8.4.3 | Review all error messages | Clear, helpful messages | All phases |
| 8.4.4 | Review all JSDoc comments | Complete documentation | All phases |
| 8.4.5 | Review package exports | Clean public API | All phases |
| 8.4.6 | Final README for each package | Package documentation | All phases |
| 8.4.7 | Create CHANGELOG | Initial changelog | All phases |
| 8.4.8 | Create CONTRIBUTING guide | Contribution guidelines | All phases |
| 8.4.9 | NPM publish preparation | Package metadata | All phases |

---

## Task Status Legend

- Not Started
- In Progress
- Completed
- Blocked
- Cancelled

---

## Notes

### Critical Path

The critical path for MVP is:
1. Phase 1 (Core Foundation with Constants)
2. Phase 2 (Storage Layer, Drizzle only)
3. Phase 3.1-3.18 (Business Logic with TDD)
4. Phase 3.19 (Security Services - Critical for production)
5. Phase 3.20 (Resilience Services - Critical for reliability)
6. Phase 3.21 (Advanced Subscription Features - Pause, Sandbox, Add-ons, Per-Seat)
7. Phase 4.1-4.4 (Stripe only)
8. Phase 5.1 (Hono adapter)
9. Phase 7 (CLI tools)
10. Phase 8.1-8.2 (Essential docs)

### Parallel Work Opportunities

After Phase 1, the following can be done in parallel:
- Phase 2 (Storage) + Phase 4 (Payment Adapters)
- Phase 3 (Business Logic) sections can be parallelized by service
- Phase 5 (Framework Adapters) + Phase 6 (React)
- Phase 7 (CLI) can start after Phase 1
- Phase 8 (Docs) can start after Phase 3

### TDD Approach

All implementation follows Test-Driven Development:
1. Write tests first for expected behavior
2. Implement feature to pass tests
3. Refactor while keeping tests green

This ensures high code quality and test coverage from the start.

### Key Features

1. **Exported Constants** (Phase 1.3). All status, type, and event constants with QZPay prefix
2. **Subscription Helpers** (Phase 3.3). isActive(), hasAccess(), getEntitlements(), etc.
3. **Entitlements & Limits** (Phase 3.2). Plan-based feature flags and limits
4. **Trial Without Card** (Phase 3.4, 3.10). Support for card-less trials
5. **Auto Route Registration** (Phase 5). Conditional route registration
6. **Notification Suppress** (Phase 3.14). emailSentByPackage tracking
7. **CLI Tools** (Phase 7). Environment generation and validation
8. **Usage Service** (Phase 3.15). Usage tracking against limits
9. **Postinstall Script** (Phase 7.4). Safe message-only postinstall for npm/pnpm/yarn/bun
10. **IDOR Protection** (Phase 3.19.1). Ownership validation for all resources
11. **Input Validation** (Phase 3.19.2). Zod schemas for all API inputs
12. **Webhook Security** (Phase 3.19.3). Timing-safe signatures, replay protection, idempotency
13. **Metadata Sanitization** (Phase 3.19.4). PCI-compliant metadata handling
14. **Field Encryption** (Phase 3.19.5). AES-256-GCM encryption at rest
15. **Rate Limiting** (Phase 3.19.6). Sliding window rate limiting per endpoint
16. **Fraud Detection** (Phase 3.19.7). Card testing, promo abuse, trial cycling detection
17. **Idempotency Keys** (Phase 3.20.1). Prevent duplicate operations from double-clicks
18. **Transaction Support** (Phase 3.20.2). Atomic multi-step operations
19. **Provider Retry** (Phase 3.20.4). Exponential backoff with jitter
20. **Circuit Breaker** (Phase 3.20.5). Fail fast when providers are down
21. **Event Queue** (Phase 3.20.6). Async processing for slow event handlers
22. **Subscription Pause/Resume** (Phase 3.21.1). Pause subscriptions with auto-resume
23. **Sandbox/Test Mode** (Phase 3.21.2). Environment isolation with livemode flag
24. **Subscription Add-ons** (Phase 3.21.3). Extra features attached to subscriptions
25. **Per-Seat Pricing** (Phase 3.21.4). Quantity-based billing for team plans
26. **Promo Code Analytics** (Phase 3.22.1). ROI tracking, usage stats, conversion rates
27. **Customer Discounts** (Phase 3.22.2). Permanent VIP/loyalty discounts
28. **Vendor Analytics** (Phase 3.22.3). Marketplace vendor performance tracking
29. **Job Monitoring** (Phase 3.22.4). Background job status and health checks
30. **Manual Job Execution** (Phase 3.22.5). Trigger jobs with dry-run support
31. **Multi-Currency System** (Phase 3.23.1). Per-currency pricing, exchange rate locking
32. **Credit Notes** (Phase 3.23.2). Formal credit notes for refunds and adjustments
33. **Data Export** (Phase 3.23.3). CSV, XLSX, JSON export with async processing
34. **Audit Logging** (Phase 3.23.4). Immutable audit logs for compliance
35. **Admin Middleware Enforcement** (Phase 3.23.5). Mandatory admin route protection
36. **State Reconciliation** (Phase 3.23.6). DB/provider consistency detection and resolution
37. **Usage Partitioning** (Phase 3.23.7). Monthly partitioning for high-volume usage events
38. **Pricing Snapshots** (Phase 3.23.8). Historical pricing at subscription creation
39. **Email Localization** (Phase 3.24.1). Multi-locale email templates with customer preference
40. **Webhook UI Testing** (Phase 3.24.2). Delivery tracking, manual testing, retry mechanism
41. **Unified Constants** (Phase 3.24.3). Single source of truth for all status values
42. **Subscription Helper Methods** (Phase 3.24.4). Rich helper methods for subscription state checks
43. **Grace Period Configuration** (Phase 3.24.5). Cascading grace period configuration
44. **Customer Duplicate Detection** (Phase 3.25.1, P2). Find and group potential duplicate customers
45. **Customer Merge** (Phase 3.25.2, P2). Merge duplicate customer records with strategy
46. **Product-Specific Promo Codes** (Phase 3.25.3, P2). Promo code restrictions by product/vendor
47. **Plan Versioning** (Phase 3.25.4, P2). Grandfathering for plan changes
48. **Webhook Replay** (Phase 3.25.5, P2). Dead letter queue and replay capability
49. **Structured Logging** (Phase 3.26.1, P2). JSON logging with field redaction and correlation
50. **Metrics Collection** (Phase 3.26.2, P2). Prometheus/Datadog metrics with counters/gauges/histograms
51. **Enhanced CLI** (Phase 3.26.3, P2). install, validate, health, studio, doctor commands
52. **Event Sourcing** (Phase 3.26.4, P2). Append-only event store with replay capability
53. **Integration Testing Utilities** (Phase 3.26.5, P2). Mock adapters, WebhookTestHelper, TestClock
54. **Row-Level Security** (Phase 3.27.1, P2). RLS policies on all tables with CI validation
55. **Timezone & DST Handling** (Phase 3.27.2, P2). Feb 29, DST, timezone change edge cases
56. **Chargebacks & Disputes** (Phase 3.27.3, P2). Dispute tracking, evidence submission, auto-pause
57. **Promo Code Race Conditions** (Phase 3.27.4, P2). Atomic redemption with row-level locking
58. **Trial Edge Cases** (Phase 3.27.5, P2). Upgrade during trial, abuse prevention
59. **Concurrency Protection** (Phase 3.27.6, P2). Distributed locks, webhook deduplication
60. **Data Validation & Sanitization** (Phase 3.27.7, P2). XSS prevention, unicode normalization
61. **Status Mapping with Fallback** (Phase 3.28.1, P2). UNKNOWN status, automatic reporting
62. **Query Builder Pattern** (Phase 3.28.2, P2). Flexible queries with operators and includes
63. **Data Integrity Constraints** (Phase 3.28.3, P2). CHECK constraints and validation triggers
64. **Covering Indexes** (Phase 3.28.4, P2). Optimized indexes for frequent queries

### Security Audit Checklist

Pre-production security validation checklist. All items must pass before v1.0 release.

#### 1. Authentication & Authorization

| Item | Phase | Validation |
|------|-------|------------|
| IDOR protection on all endpoints | 3.19.1 | ☐ Ownership validated for customer, subscription, invoice resources |
| Admin middleware enforcement | 3.23.5 | ☐ All /admin/* routes require valid admin token |
| API key rotation support | 3.19.6 | ☐ Keys can be rotated without downtime |
| Webhook signature validation | 3.19.3 | ☐ Timing-safe comparison, no early return |
| Session management | 3.19 | ☐ Secure cookie flags (HttpOnly, Secure, SameSite) |

#### 2. Input Validation

| Item | Phase | Validation |
|------|-------|------------|
| Zod schemas for all inputs | 3.19.2 | ☐ All API endpoints use Zod validation |
| Metadata sanitization | 3.19.4 | ☐ HTML stripped, PCI fields rejected |
| SQL injection prevention | 3.19.2 | ☐ Parameterized queries only (Drizzle) |
| XSS prevention | 3.27.7 | ☐ Output encoding, CSP headers |
| Unicode normalization | 3.27.7 | ☐ NFKC normalization on text inputs |
| File upload validation | N/A | ☐ Not applicable (no file uploads in v1) |

#### 3. Encryption & Secrets

| Item | Phase | Validation |
|------|-------|------------|
| Field encryption at rest | 3.19.5 | ☐ AES-256-GCM for sensitive fields |
| Key rotation mechanism | 3.19.5 | ☐ Key version stored with encrypted data |
| Secrets in env vars only | 7.2 | ☐ No secrets in code or config files |
| TLS 1.2+ enforced | Infra | ☐ Provider connections use TLS 1.2+ |
| Database encryption | Infra | ☐ At-rest encryption enabled on database |

#### 4. Payment Security

| Item | Phase | Validation |
|------|-------|------------|
| No raw card data stored | 3.19.4 | ☐ Only tokenized payment methods |
| PCI-compliant metadata | 3.19.4 | ☐ Blocked: card_number, cvv, pin, etc. |
| Idempotency for payments | 3.20.1 | ☐ Duplicate charges prevented |
| Webhook replay protection | 3.19.3 | ☐ Processed webhook IDs tracked |
| Currency validation | 3.23.1 | ☐ Only supported currencies accepted |

#### 5. Fraud Prevention

| Item | Phase | Validation |
|------|-------|------------|
| Card testing detection | 3.19.7 | ☐ Rate limiting on payment attempts |
| Promo code enumeration blocked | 3.19.7 | ☐ Rate limit: 5 attempts/min, generic errors |
| Trial abuse prevention | 3.27.5 | ☐ Customer flagged after trial limit |
| Velocity checks | 3.19.7 | ☐ Unusual activity triggers review |
| Vendor payout fraud protection | 3.7 | ☑ balance_reserved, balance_pending, balance_available, cooling-off period (14 days default), vendor_pending_balances table |

#### 6. Rate Limiting & DoS Protection

| Item | Phase | Validation |
|------|-------|------------|
| API rate limiting | 3.19.6 | ☐ Sliding window per endpoint |
| Webhook retry limits | 3.20 | ☐ Exponential backoff, circuit breaker |
| Query complexity limits | 3.28.2 | ☐ Max page size, max includes depth |
| Background job limits | 3.22.4 | ☐ Concurrent job limits enforced |

#### 7. Logging & Audit

| Item | Phase | Validation |
|------|-------|------------|
| Audit logging enabled | 3.23.4 | ☐ All mutations logged immutably |
| Sensitive data redacted | 3.26.1 | ☐ PII/PCI data never in logs |
| Correlation IDs | 3.26.1 | ☐ Request tracing across services |
| Failed auth attempts logged | 3.19 | ☐ With IP, timestamp, reason |
| Log retention policy | 9 | ☐ 90 days hot, 2 years archive |

#### 8. Data Protection

| Item | Phase | Validation |
|------|-------|------------|
| Soft delete implemented | 2.1 | ☐ Partial unique indexes (WHERE deleted_at IS NULL) |
| Data retention enforced | 9 | ☐ Automated cleanup jobs configured |
| Backup encryption | DR | ☐ Backups encrypted with separate key |
| Export includes all PII | 3.23.3 | ☐ GDPR export covers all customer data |
| Delete cascades properly | 2.1 | ☐ No orphaned records after deletion |

#### 9. Error Handling

| Item | Phase | Validation |
|------|-------|------------|
| Generic error responses | 3.19 | ☐ No stack traces in production |
| Error codes documented | 5.14 | ☐ All codes in error catalog |
| Validation errors detailed | 3.19.2 | ☐ Field-level errors for inputs |
| Provider errors mapped | 4 | ☐ Stripe/MP errors normalized |

#### 10. Dependency Security

| Item | Phase | Validation |
|------|-------|------------|
| npm audit clean | CI | ☐ No high/critical vulnerabilities |
| Dependabot enabled | CI | ☐ Automated security updates |
| Lock file committed | 1.1 | ☐ pnpm-lock.yaml in repo |
| Minimal dependencies | All | ☐ Review each dependency's necessity |

#### Security Audit Schedule

| Milestone | Audit Type | Scope |
|-----------|------------|-------|
| Pre-Alpha | Self-audit | Checklist sections 1-4 |
| Pre-Beta | Self-audit | Checklist sections 5-8 |
| Pre-RC | External audit | Full penetration test |
| Pre-Release | Self-audit | Sections 9-10, final review |
| Post-Release | Ongoing | Quarterly dependency audit |

#### Security Contact

Security vulnerabilities should be reported to: security@qazuor.com (configure before release)

### Dependencies on External APIs

- Stripe API: Required for Phase 4.1-4.4
- MercadoPago API: Required for Phase 4.5-4.8
- Both require test mode credentials for development

### Future Features (P3 - v2.0+)

The following features are **explicitly out of scope for v1.x** but should be considered when making implementation decisions. Design choices should keep these potential extensions in mind.

| ID | Feature | Category | Current Workaround | Design Consideration |
|----|---------|----------|-------------------|---------------------|
| FUTURE-001 | Customer Lifecycle States | Customer | Use metadata or CRM | Keep metadata extensible |
| FUTURE-002 | Multiple Payment Accounts | Customer | Separate accounts | Flexible customer-subscription relation |
| FUTURE-003 | Installment Payments | Payment | Providers handle natively | Store installment data in metadata |
| FUTURE-004 | Partial Payments | Payment | Use credit notes | amount_due supports partial |
| FUTURE-005 | Scheduled Plan Changes | Subscription | Immediate or period-end | Reserve subscription fields |
| FUTURE-006 | Dynamic Commission Tiers | Marketplace | Fixed commission | Vendor model extensible |
| FUTURE-007 | Multi-Vendor Split | Marketplace | One vendor per purchase | vendor_id could become array |
| FUTURE-008 | Cohort Analysis | Analytics | External tools | Capture all timestamps |
| FUTURE-009 | Revenue Recognition | Analytics | External accounting | Invoice has service period |
| FUTURE-010 | Jurisdiction Taxes | Tax | Manual or external | Tax interface extensible |
| FUTURE-011 | Custom Jobs | System | Project cron jobs | Job hooks possible |
| FUTURE-012 | Migration Tools | System | Manual documented | Bulk import API possible |
| FUTURE-013 | Provider Fallback | System | One provider at a time | Adapter supports multi-provider |
| FUTURE-014 | Graceful Degradation | System | App-layer retry | Circuit breaker foundation |
| FUTURE-015 | PCI Documentation | Compliance | Providers handle PCI | Document scope |
| FUTURE-016 | GDPR Export | Compliance | Generic export API | Include all entities |

**Implementation Guidelines for Future Compatibility:**

When implementing v1.x features, developers should:

1. **Extensible Metadata**: Use metadata fields for additional data rather than new columns
2. **Timestamp Preservation**: Capture all relevant dates for future analytics needs
3. **Interface Design**: Allow optional fields in interfaces for extension
4. **Documentation**: Document current workarounds as starting points for future features
5. **Loose Coupling**: Keep services loosely coupled to enable additions
6. **Provider Abstraction**: Maintain clean adapter interfaces for multi-provider support

**Potential v2.0 Phases:**

| Phase | Features | Estimated Scope |
|-------|----------|-----------------|
| v2.0 | Installments, Partial Payments, Scheduled Changes | Medium |
| v2.1 | Multi-vendor, Commission Tiers | Medium |
| v2.2 | Cohort Analysis, Revenue Recognition | Large |
| v2.3 | Jurisdiction Taxes, GDPR Tools | Medium |
| v2.4 | Provider Fallback, Graceful Degradation | Large |

---

*Document Version: 3.1*
*Last Updated: 2025-12-28*
