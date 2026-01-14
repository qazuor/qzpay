# Adapter Specifications

Complete interface specifications for all QZPay adapters. This document is the authoritative reference for implementing payment and storage adapters.

## Table of Contents

1. [Payment Adapter Interface](#payment-adapter-interface)
2. [Storage Adapter Interface](#storage-adapter-interface)
3. [Error Handling](#error-handling)
4. [Implementation Checklist](#implementation-checklist)

---

## Payment Adapter Interface

### QZPayPaymentAdapter

The payment adapter uses a modular structure with sub-adapters for each operation domain.

```typescript
export interface QZPayPaymentAdapter {
  /** Provider identifier */
  readonly provider: QZPayPaymentProvider;

  /** Customer operations */
  customers: QZPayPaymentCustomerAdapter;

  /** Subscription operations */
  subscriptions: QZPayPaymentSubscriptionAdapter;

  /** Payment operations */
  payments: QZPayPaymentPaymentAdapter;

  /** Checkout operations */
  checkout: QZPayPaymentCheckoutAdapter;

  /** Price operations */
  prices: QZPayPaymentPriceAdapter;

  /** Webhook handling */
  webhooks: QZPayPaymentWebhookAdapter;

  /** Vendor/Connect operations (marketplace) - optional */
  vendors?: QZPayPaymentVendorAdapter;
}
```

---

### Sub-Adapter Interfaces

#### QZPayPaymentCustomerAdapter

```typescript
export interface QZPayPaymentCustomerAdapter {
  create(input: QZPayProviderCreateCustomerInput): Promise<string>;
  update(providerCustomerId: string, input: Partial<QZPayProviderCreateCustomerInput>): Promise<void>;
  delete(providerCustomerId: string): Promise<void>;
  retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer>;
}

export interface QZPayProviderCreateCustomerInput {
  email: string;
  name?: string | null;
  metadata?: Record<string, string>;
  externalId?: string;
}

export interface QZPayProviderCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string>;
}
```

#### QZPayPaymentSubscriptionAdapter

```typescript
export interface QZPayPaymentSubscriptionAdapter {
  create(
    providerCustomerId: string,
    input: QZPayCreateSubscriptionInput,
    providerPriceId: string
  ): Promise<QZPayProviderSubscription>;
  update(
    providerSubscriptionId: string,
    input: QZPayUpdateSubscriptionInput
  ): Promise<QZPayProviderSubscription>;
  cancel(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void>;
  pause(providerSubscriptionId: string): Promise<void>;
  resume(providerSubscriptionId: string): Promise<void>;
  retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription>;
}

export interface QZPayProviderSubscription {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  metadata: Record<string, string>;
}
```

#### QZPayPaymentPaymentAdapter

```typescript
export interface QZPayPaymentPaymentAdapter {
  create(
    providerCustomerId: string,
    input: QZPayCreatePaymentInput
  ): Promise<QZPayProviderPayment>;
  capture(providerPaymentId: string): Promise<QZPayProviderPayment>;
  cancel(providerPaymentId: string): Promise<void>;
  refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund>;
  retrieve(providerPaymentId: string): Promise<QZPayProviderPayment>;
}

export interface QZPayProviderPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
}

export interface QZPayProviderRefund {
  id: string;
  status: string;
  amount: number;
}
```

#### QZPayPaymentCheckoutAdapter

```typescript
export interface QZPayPaymentCheckoutAdapter {
  create(
    input: QZPayCreateCheckoutInput,
    providerPriceIds: string[]
  ): Promise<QZPayProviderCheckout>;
  retrieve(providerSessionId: string): Promise<QZPayProviderCheckout>;
  expire(providerSessionId: string): Promise<void>;
}

export interface QZPayProviderCheckout {
  id: string;
  url: string;
  status: string;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  metadata: Record<string, string>;
}
```

#### QZPayPaymentPriceAdapter

```typescript
export interface QZPayPaymentPriceAdapter {
  create(input: QZPayCreatePriceInput, providerProductId: string): Promise<string>;
  archive(providerPriceId: string): Promise<void>;
  retrieve(providerPriceId: string): Promise<QZPayProviderPrice>;
  createProduct(name: string, description?: string): Promise<string>;
}

export interface QZPayProviderPrice {
  id: string;
  active: boolean;
  unitAmount: number;
  currency: string;
  recurring: {
    interval: string;
    intervalCount: number;
  } | null;
}
```

#### QZPayPaymentWebhookAdapter

```typescript
export interface QZPayPaymentWebhookAdapter {
  constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent;
  verifySignature(payload: string | Buffer, signature: string): boolean;
}

export interface QZPayWebhookEvent {
  id: string;
  type: string;
  data: unknown;
  created: Date;
}
```

#### QZPayPaymentVendorAdapter (Optional)

```typescript
export interface QZPayPaymentVendorAdapter {
  createAccount(vendor: QZPayVendor): Promise<string>;
  updateAccount(providerAccountId: string, vendor: Partial<QZPayVendor>): Promise<void>;
  deleteAccount(providerAccountId: string): Promise<void>;
  createPayout(providerAccountId: string, amount: number, currency: string): Promise<string>;
  retrievePayout(providerPayoutId: string): Promise<QZPayProviderPayout>;
  createTransfer(
    providerAccountId: string,
    amount: number,
    currency: string,
    paymentId: string
  ): Promise<string>;
}

export interface QZPayProviderPayout {
  id: string;
  status: string;
  amount: number;
  currency: string;
  arrivalDate: Date;
}
```

---

## Storage Adapter Interface

### QZPayStorageAdapter

The storage adapter uses a modular structure with collection interfaces for each entity type.

```typescript
export interface QZPayStorageAdapter {
  // Customer operations
  customers: QZPayCustomerStorage;

  // Subscription operations
  subscriptions: QZPaySubscriptionStorage;

  // Payment operations
  payments: QZPayPaymentStorage;

  // Payment method operations
  paymentMethods: QZPayPaymentMethodStorage;

  // Invoice operations
  invoices: QZPayInvoiceStorage;

  // Plan operations
  plans: QZPayPlanStorage;

  // Price operations
  prices: QZPayPriceStorage;

  // Promo code operations
  promoCodes: QZPayPromoCodeStorage;

  // Vendor operations (marketplace)
  vendors: QZPayVendorStorage;

  // Entitlement operations
  entitlements: QZPayEntitlementStorage;

  // Limit operations
  limits: QZPayLimitStorage;

  // Add-on operations
  addons: QZPayAddOnStorage;

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

---

### Collection Interfaces

#### QZPayCustomerStorage

```typescript
export interface QZPayCustomerStorage {
  create(input: QZPayCreateCustomerInput): Promise<QZPayCustomer>;
  update(id: string, input: QZPayUpdateCustomerInput): Promise<QZPayCustomer>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayCustomer | null>;
  findByExternalId(externalId: string): Promise<QZPayCustomer | null>;
  findByEmail(email: string): Promise<QZPayCustomer | null>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayCustomer>>;
}
```

#### QZPaySubscriptionStorage

```typescript
export interface QZPaySubscriptionStorage {
  create(input: QZPayCreateSubscriptionInput & { id: string }): Promise<QZPaySubscription>;
  update(id: string, input: QZPayUpdateSubscriptionInput): Promise<QZPaySubscription>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPaySubscription | null>;
  findByCustomerId(customerId: string): Promise<QZPaySubscription[]>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPaySubscription>>;
}
```

#### QZPayPaymentStorage

```typescript
export interface QZPayPaymentStorage {
  create(payment: QZPayPayment): Promise<QZPayPayment>;
  update(id: string, payment: Partial<QZPayPayment>): Promise<QZPayPayment>;
  findById(id: string): Promise<QZPayPayment | null>;
  findByCustomerId(customerId: string): Promise<QZPayPayment[]>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPayment>>;
}
```

#### QZPayPaymentMethodStorage

```typescript
export interface QZPayPaymentMethodStorage {
  create(input: QZPayCreatePaymentMethodInput & { id: string }): Promise<QZPayPaymentMethod>;
  update(id: string, input: QZPayUpdatePaymentMethodInput): Promise<QZPayPaymentMethod>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayPaymentMethod | null>;
  findByCustomerId(customerId: string): Promise<QZPayPaymentMethod[]>;
  findDefaultByCustomerId(customerId: string): Promise<QZPayPaymentMethod | null>;
  setDefault(customerId: string, paymentMethodId: string): Promise<void>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPaymentMethod>>;
}
```

#### QZPayInvoiceStorage

```typescript
export interface QZPayInvoiceStorage {
  create(input: QZPayCreateInvoiceInput & { id: string }): Promise<QZPayInvoice>;
  update(id: string, invoice: Partial<QZPayInvoice>): Promise<QZPayInvoice>;
  findById(id: string): Promise<QZPayInvoice | null>;
  findByCustomerId(customerId: string): Promise<QZPayInvoice[]>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayInvoice>>;
}
```

#### QZPayPlanStorage

```typescript
export interface QZPayPlanStorage {
  create(input: QZPayCreatePlanInput & { id: string }): Promise<QZPayPlan>;
  update(id: string, plan: Partial<QZPayPlan>): Promise<QZPayPlan>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayPlan | null>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPlan>>;
}
```

#### QZPayPriceStorage

```typescript
export interface QZPayPriceStorage {
  create(input: QZPayCreatePriceInput & { id: string }): Promise<QZPayPrice>;
  update(id: string, price: Partial<QZPayPrice>): Promise<QZPayPrice>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayPrice | null>;
  findByPlanId(planId: string): Promise<QZPayPrice[]>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPrice>>;
}
```

#### QZPayPromoCodeStorage

```typescript
export interface QZPayPromoCodeStorage {
  create(input: QZPayCreatePromoCodeInput & { id: string }): Promise<QZPayPromoCode>;
  update(id: string, promoCode: Partial<QZPayPromoCode>): Promise<QZPayPromoCode>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayPromoCode | null>;
  findByCode(code: string): Promise<QZPayPromoCode | null>;
  incrementRedemptions(id: string): Promise<void>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPromoCode>>;
}
```

#### QZPayVendorStorage

```typescript
export interface QZPayVendorStorage {
  create(input: QZPayCreateVendorInput & { id: string }): Promise<QZPayVendor>;
  update(id: string, input: QZPayUpdateVendorInput): Promise<QZPayVendor>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayVendor | null>;
  findByExternalId(externalId: string): Promise<QZPayVendor | null>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayVendor>>;
  createPayout(payout: QZPayVendorPayout): Promise<QZPayVendorPayout>;
  findPayoutsByVendorId(vendorId: string): Promise<QZPayVendorPayout[]>;
}
```

#### QZPayEntitlementStorage

```typescript
export interface QZPayEntitlementStorage {
  createDefinition(entitlement: QZPayEntitlement): Promise<QZPayEntitlement>;
  findDefinitionByKey(key: string): Promise<QZPayEntitlement | null>;
  listDefinitions(): Promise<QZPayEntitlement[]>;
  grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement>;
  revoke(customerId: string, entitlementKey: string): Promise<void>;
  findByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]>;
  check(customerId: string, entitlementKey: string): Promise<boolean>;
}
```

#### QZPayLimitStorage

```typescript
export interface QZPayLimitStorage {
  createDefinition(limit: QZPayLimit): Promise<QZPayLimit>;
  findDefinitionByKey(key: string): Promise<QZPayLimit | null>;
  listDefinitions(): Promise<QZPayLimit[]>;
  set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit>;
  increment(input: QZPayIncrementLimitInput): Promise<QZPayCustomerLimit>;
  findByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]>;
  check(customerId: string, limitKey: string): Promise<QZPayCustomerLimit | null>;
  recordUsage(record: QZPayUsageRecord): Promise<QZPayUsageRecord>;
}
```

#### QZPayAddOnStorage

```typescript
export interface QZPayAddOnStorage {
  create(input: QZPayCreateAddOnInput & { id: string }): Promise<QZPayAddOn>;
  update(id: string, input: QZPayUpdateAddOnInput): Promise<QZPayAddOn>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<QZPayAddOn | null>;
  findByPlanId(planId: string): Promise<QZPayAddOn[]>;
  list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayAddOn>>;

  // Subscription add-on operations
  addToSubscription(input: {
    id: string;
    subscriptionId: string;
    addOnId: string;
    quantity: number;
    unitAmount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<QZPaySubscriptionAddOn>;
  removeFromSubscription(subscriptionId: string, addOnId: string): Promise<void>;
  updateSubscriptionAddOn(
    subscriptionId: string,
    addOnId: string,
    input: Partial<QZPaySubscriptionAddOn>
  ): Promise<QZPaySubscriptionAddOn>;
  findBySubscriptionId(subscriptionId: string): Promise<QZPaySubscriptionAddOn[]>;
  findSubscriptionAddOn(
    subscriptionId: string,
    addOnId: string
  ): Promise<QZPaySubscriptionAddOn | null>;
}
```

---

### Common Types

```typescript
export interface QZPayListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface QZPayPaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

---

## Error Handling

### Adapter Error Types

All adapter methods must throw typed errors that can be handled by the core services.

```typescript
import { QZPayAdapterError, QZPayErrorCode } from '@qazuor/qzpay-core';

// In adapter implementation:
try {
  const result = await stripe.subscriptions.create(params);
  return mapStripeSubscription(result);
} catch (error) {
  if (error instanceof Stripe.errors.StripeCardError) {
    throw new QZPayAdapterError({
      code: QZPayErrorCode.PAYMENT_CARD_DECLINED,
      message: error.message,
      provider: 'stripe',
      providerCode: error.code,
      retryable: false,
      originalError: error,
    });
  }
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    throw new QZPayAdapterError({
      code: QZPayErrorCode.PROVIDER_RATE_LIMITED,
      message: 'Rate limit exceeded, please retry',
      provider: 'stripe',
      providerCode: 'rate_limit',
      retryable: true,
      retryAfter: 1000,
      originalError: error,
    });
  }
}
```

### Retryable Errors

| Error Code | Retry Strategy |
|------------|----------------|
| `PROVIDER_UNAVAILABLE` | Exponential backoff, max 3 attempts |
| `PROVIDER_RATE_LIMITED` | Wait for `retryAfter`, max 3 attempts |
| `PROVIDER_TIMEOUT` | Immediate retry, max 2 attempts |
| `NETWORK_ERROR` | Exponential backoff, max 3 attempts |

### Non-Retryable Errors

| Error Code | Reason |
|------------|--------|
| `PAYMENT_CARD_DECLINED` | User must update payment method |
| `CUSTOMER_NOT_FOUND` | Data integrity issue |
| `INVALID_PARAMETERS` | Developer error |
| `AUTHENTICATION_FAILED` | Configuration error |

---

## Implementation Checklist

When implementing a new adapter, ensure:

- [ ] All interface methods are implemented
- [ ] All input types are validated with Zod before provider calls
- [ ] Errors are typed and include `retryable` flag
- [ ] Idempotency keys are passed to provider
- [ ] Health check verifies actual connectivity
- [ ] Unit tests cover all methods
- [ ] Integration tests use provider's test mode
- [ ] TypeScript strict mode passes

---

## References

- [Public API](./PUBLIC-API.md)
- [Error Catalog](./ERROR-CATALOG.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
- [Stripe API Reference](https://stripe.com/docs/api)
- [MercadoPago API Reference](https://www.mercadopago.com/developers/en/reference)
