# Adapter Specifications

Complete interface specifications for all QZPay adapters. This document is the authoritative reference for implementing payment and storage adapters.

## Table of Contents

1. [Payment Adapter Interface](#payment-adapter-interface)
2. [Storage Adapter Interface](#storage-adapter-interface)
3. [Email Adapter Interface](#email-adapter-interface)
4. [Data Mapping Patterns](#data-mapping-patterns)
5. [Error Handling](#error-handling)

---

## Payment Adapter Interface

### QZPayPaymentAdapter

The payment adapter abstracts all interactions with payment providers (Stripe, MercadoPago, etc.).

```typescript
export interface QZPayPaymentAdapter {
  /** Provider identifier */
  readonly provider: QZPayPaymentProvider;

  /** Whether this is a live or test connection */
  readonly livemode: boolean;

  // Customer Operations
  createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomerResult>;
  getCustomer(providerCustomerId: string): Promise<ProviderCustomerResult | null>;
  updateCustomer(providerCustomerId: string, input: UpdateProviderCustomerInput): Promise<ProviderCustomerResult>;
  deleteCustomer(providerCustomerId: string): Promise<void>;

  // Subscription Operations
  createSubscription(input: CreateProviderSubscriptionInput): Promise<ProviderSubscriptionResult>;
  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult | null>;
  updateSubscription(providerSubscriptionId: string, input: UpdateProviderSubscriptionInput): Promise<ProviderSubscriptionResult>;
  cancelSubscription(providerSubscriptionId: string, input: CancelProviderSubscriptionInput): Promise<ProviderSubscriptionResult>;
  pauseSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult>;
  resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult>;

  // Payment Operations
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentResult | null>;
  capturePayment(providerPaymentId: string, amount?: number): Promise<ProviderPaymentResult>;
  refundPayment(providerPaymentId: string, input: RefundProviderPaymentInput): Promise<ProviderRefundResult>;

  // Payment Method Operations
  attachPaymentMethod(providerCustomerId: string, providerPaymentMethodId: string): Promise<ProviderPaymentMethodResult>;
  detachPaymentMethod(providerPaymentMethodId: string): Promise<void>;
  listPaymentMethods(providerCustomerId: string): Promise<ProviderPaymentMethodResult[]>;
  setDefaultPaymentMethod(providerCustomerId: string, providerPaymentMethodId: string): Promise<void>;

  // Checkout Operations
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<ProviderCheckoutSessionResult>;
  expireCheckoutSession(providerSessionId: string): Promise<void>;

  // Webhook Operations
  constructWebhookEvent(payload: string | Buffer, signature: string): Promise<ProviderWebhookEvent>;

  // Price/Plan Operations
  createPrice(input: CreateProviderPriceInput): Promise<ProviderPriceResult>;
  updatePrice(providerPriceId: string, input: UpdateProviderPriceInput): Promise<ProviderPriceResult>;
  deactivatePrice(providerPriceId: string): Promise<void>;

  // Invoice Operations
  getInvoice(providerInvoiceId: string): Promise<ProviderInvoiceResult | null>;
  finalizeInvoice(providerInvoiceId: string): Promise<ProviderInvoiceResult>;
  voidInvoice(providerInvoiceId: string): Promise<ProviderInvoiceResult>;

  // Utility
  healthCheck(): Promise<boolean>;
}
```

---

### Input Types

#### CreateProviderCustomerInput

```typescript
interface CreateProviderCustomerInput {
  /** External reference ID from host application */
  externalId: string;

  /** Customer email address */
  email: string;

  /** Customer display name */
  name?: string;

  /** Phone number in E.164 format */
  phone?: string;

  /** Preferred locale (e.g., 'en', 'es') */
  locale?: string;

  /** Custom metadata (max 50 keys, each key max 40 chars, value max 500 chars) */
  metadata?: Record<string, string>;

  /** Idempotency key for this operation */
  idempotencyKey: string;
}
```

#### UpdateProviderCustomerInput

```typescript
interface UpdateProviderCustomerInput {
  email?: string;
  name?: string;
  phone?: string;
  locale?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}
```

#### CreateProviderSubscriptionInput

```typescript
interface CreateProviderSubscriptionInput {
  /** Provider customer ID */
  providerCustomerId: string;

  /** Provider price ID */
  providerPriceId: string;

  /** Billing interval */
  interval: QZPayBillingInterval;

  /** Quantity (for per-seat pricing) */
  quantity?: number;

  /** Trial configuration */
  trial?: {
    /** Trial end date (UTC) */
    endDate?: Date;
    /** Trial days from now */
    days?: number;
  };

  /** Promo code to apply */
  promoCode?: string;

  /** Automatic tax calculation */
  automaticTax?: boolean;

  /** Payment behavior on creation */
  paymentBehavior: 'default_incomplete' | 'error_if_incomplete' | 'allow_incomplete';

  /** Provider payment method ID */
  defaultPaymentMethod?: string;

  /** Proration behavior for mid-cycle changes */
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';

  /** Custom metadata */
  metadata?: Record<string, string>;

  idempotencyKey: string;
}
```

#### UpdateProviderSubscriptionInput

```typescript
interface UpdateProviderSubscriptionInput {
  /** New price ID for plan change */
  providerPriceId?: string;

  /** New quantity */
  quantity?: number;

  /** When to apply changes */
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';

  /** New payment method */
  defaultPaymentMethod?: string;

  /** Cancel at period end */
  cancelAtPeriodEnd?: boolean;

  /** Pause collection */
  pauseCollection?: {
    behavior: 'mark_uncollectible' | 'keep_as_draft' | 'void';
  };

  metadata?: Record<string, string>;

  idempotencyKey: string;
}
```

#### CancelProviderSubscriptionInput

```typescript
interface CancelProviderSubscriptionInput {
  /** Cancel immediately or at period end */
  cancelAtPeriodEnd: boolean;

  /** Cancellation reason */
  cancellationReason?: string;

  /** Whether to prorate final invoice */
  prorate?: boolean;

  /** Whether to invoice immediately on cancel */
  invoiceNow?: boolean;

  idempotencyKey: string;
}
```

#### CreateProviderPaymentInput

```typescript
interface CreateProviderPaymentInput {
  /** Provider customer ID */
  providerCustomerId: string;

  /** Amount in smallest currency unit (cents) */
  amount: number;

  /** Three-letter ISO currency code */
  currency: QZPayCurrency;

  /** Provider payment method ID */
  paymentMethodId?: string;

  /** Description shown on statement */
  statementDescriptor?: string;

  /** Payment description */
  description?: string;

  /** Capture behavior */
  captureMethod?: 'automatic' | 'manual';

  /** Whether to confirm immediately */
  confirm?: boolean;

  /** Return URL for 3D Secure */
  returnUrl?: string;

  /** Custom metadata */
  metadata?: Record<string, string>;

  idempotencyKey: string;
}
```

#### RefundProviderPaymentInput

```typescript
interface RefundProviderPaymentInput {
  /** Amount to refund (defaults to full amount if not specified) */
  amount?: number;

  /** Reason for refund */
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';

  /** Internal notes for audit */
  internalNotes?: string;

  idempotencyKey: string;
}
```

#### CreateCheckoutSessionInput

```typescript
interface CreateCheckoutSessionInput {
  /** Provider customer ID */
  providerCustomerId: string;

  /** Mode: subscription, payment, or setup */
  mode: 'subscription' | 'payment' | 'setup';

  /** Line items for checkout */
  lineItems: Array<{
    providerPriceId: string;
    quantity: number;
  }>;

  /** Success redirect URL */
  successUrl: string;

  /** Cancel redirect URL */
  cancelUrl: string;

  /** Allow promo code entry */
  allowPromotionCodes?: boolean;

  /** Pre-filled promo code */
  promotionCode?: string;

  /** Trial days for subscription mode */
  trialDays?: number;

  /** Whether payment method is required for trial */
  trialRequiresPaymentMethod?: boolean;

  /** Automatic tax collection */
  automaticTax?: boolean;

  /** Session expiration time (seconds, min 1800, max 86400) */
  expiresAfter?: number;

  /** Custom metadata */
  metadata?: Record<string, string>;

  idempotencyKey: string;
}
```

---

### Result Types

All adapter methods return result types that represent normalized data from any provider.

#### ProviderCustomerResult

```typescript
interface ProviderCustomerResult {
  /** Provider's customer ID */
  providerCustomerId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Customer email */
  email: string;

  /** Customer name */
  name: string | null;

  /** Customer phone */
  phone: string | null;

  /** Whether customer is in live mode */
  livemode: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Default payment method ID */
  defaultPaymentMethodId: string | null;

  /** Customer's balance (in cents) */
  balance: number;

  /** Currency for balance */
  currency: QZPayCurrency | null;

  /** Whether customer is deleted in provider */
  deleted: boolean;

  /** Raw provider response for debugging */
  rawProviderData: unknown;
}
```

#### ProviderSubscriptionResult

```typescript
interface ProviderSubscriptionResult {
  /** Provider's subscription ID */
  providerSubscriptionId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Provider customer ID */
  providerCustomerId: string;

  /** Subscription status */
  status: QZPaySubscriptionStatus;

  /** Current billing period start */
  currentPeriodStart: Date;

  /** Current billing period end */
  currentPeriodEnd: Date;

  /** Whether subscription cancels at period end */
  cancelAtPeriodEnd: boolean;

  /** Cancellation date if scheduled */
  cancelAt: Date | null;

  /** When subscription was canceled */
  canceledAt: Date | null;

  /** Trial start date */
  trialStart: Date | null;

  /** Trial end date */
  trialEnd: Date | null;

  /** Provider price ID */
  providerPriceId: string;

  /** Quantity */
  quantity: number;

  /** Latest invoice ID */
  latestInvoiceId: string | null;

  /** Default payment method ID */
  defaultPaymentMethodId: string | null;

  /** Whether in live mode */
  livemode: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

#### ProviderPaymentResult

```typescript
interface ProviderPaymentResult {
  /** Provider's payment ID (payment_intent or similar) */
  providerPaymentId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Provider customer ID */
  providerCustomerId: string;

  /** Payment status */
  status: QZPayPaymentStatus;

  /** Amount in smallest currency unit */
  amount: number;

  /** Currency */
  currency: QZPayCurrency;

  /** Amount captured (for manual capture) */
  amountCaptured: number;

  /** Amount refunded */
  amountRefunded: number;

  /** Payment method type (card, bank_transfer, etc.) */
  paymentMethodType: string | null;

  /** Last 4 digits if card */
  last4: string | null;

  /** Card brand if applicable */
  brand: string | null;

  /** Statement descriptor */
  statementDescriptor: string | null;

  /** Associated invoice ID */
  invoiceId: string | null;

  /** Failure code if failed */
  failureCode: string | null;

  /** Failure message if failed */
  failureMessage: string | null;

  /** Receipt URL */
  receiptUrl: string | null;

  /** Whether in live mode */
  livemode: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

#### ProviderRefundResult

```typescript
interface ProviderRefundResult {
  /** Provider's refund ID */
  providerRefundId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Associated payment ID */
  providerPaymentId: string;

  /** Refund status */
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';

  /** Refund amount */
  amount: number;

  /** Currency */
  currency: QZPayCurrency;

  /** Reason for refund */
  reason: string | null;

  /** Receipt number */
  receiptNumber: string | null;

  /** Creation timestamp */
  createdAt: Date;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

#### ProviderPaymentMethodResult

```typescript
interface ProviderPaymentMethodResult {
  /** Provider's payment method ID */
  providerPaymentMethodId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Associated customer ID */
  providerCustomerId: string | null;

  /** Payment method type */
  type: 'card' | 'bank_account' | 'sepa_debit' | 'ideal' | 'other';

  /** Card details (if type is card) */
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: 'credit' | 'debit' | 'prepaid' | 'unknown';
    country: string | null;
  };

  /** Bank account details (if type is bank_account) */
  bankAccount?: {
    bankName: string | null;
    last4: string;
    routingNumber: string | null;
    accountHolderType: 'individual' | 'company';
  };

  /** Billing details */
  billingDetails: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    } | null;
  };

  /** Whether in live mode */
  livemode: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

#### ProviderCheckoutSessionResult

```typescript
interface ProviderCheckoutSessionResult {
  /** Provider's session ID */
  providerSessionId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Session URL for redirect */
  url: string;

  /** Session status */
  status: 'open' | 'complete' | 'expired';

  /** Session mode */
  mode: 'subscription' | 'payment' | 'setup';

  /** Associated customer ID */
  providerCustomerId: string | null;

  /** Associated subscription ID (after completion) */
  providerSubscriptionId: string | null;

  /** Associated payment ID (after completion) */
  providerPaymentId: string | null;

  /** Expiration timestamp */
  expiresAt: Date;

  /** Whether in live mode */
  livemode: boolean;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

#### ProviderWebhookEvent

```typescript
interface ProviderWebhookEvent {
  /** Provider's event ID */
  providerEventId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Event type */
  type: string;

  /** Whether in live mode */
  livemode: boolean;

  /** Event creation timestamp */
  createdAt: Date;

  /** Event data object */
  data: {
    object: unknown;
    previousAttributes?: Record<string, unknown>;
  };

  /** Raw event payload */
  rawEvent: unknown;
}
```

#### ProviderInvoiceResult

```typescript
interface ProviderInvoiceResult {
  /** Provider's invoice ID */
  providerInvoiceId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Associated customer ID */
  providerCustomerId: string;

  /** Associated subscription ID */
  providerSubscriptionId: string | null;

  /** Invoice number */
  number: string | null;

  /** Invoice status */
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';

  /** Subtotal (before discounts/tax) */
  subtotal: number;

  /** Total discount amount */
  totalDiscount: number;

  /** Tax amount */
  tax: number;

  /** Total amount due */
  total: number;

  /** Amount paid */
  amountPaid: number;

  /** Amount remaining */
  amountRemaining: number;

  /** Currency */
  currency: QZPayCurrency;

  /** Invoice PDF URL */
  invoicePdfUrl: string | null;

  /** Hosted invoice URL */
  hostedInvoiceUrl: string | null;

  /** Due date */
  dueDate: Date | null;

  /** Line items */
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    amount: number;
    priceId: string | null;
  }>;

  /** Applied discounts */
  discounts: Array<{
    couponId: string;
    amount: number;
  }>;

  /** Whether in live mode */
  livemode: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Finalization timestamp */
  finalizedAt: Date | null;

  /** Payment timestamp */
  paidAt: Date | null;

  /** Raw provider data */
  rawProviderData: unknown;
}
```

---

## Storage Adapter Interface

### QZPayStorageAdapter

The storage adapter abstracts all database operations.

```typescript
export interface QZPayStorageAdapter {
  /** Database provider identifier */
  readonly provider: 'drizzle' | 'prisma' | 'custom';

  /** Collection accessors */
  customers: QZPayCustomerCollection;
  subscriptions: QZPaySubscriptionCollection;
  payments: QZPayPaymentCollection;
  invoices: QZPayInvoiceCollection;
  paymentMethods: QZPayPaymentMethodCollection;
  promoCodes: QZPayPromoCodeCollection;
  usageRecords: QZPayUsageRecordCollection;
  webhookEvents: QZPayWebhookEventCollection;
  auditLogs: QZPayAuditLogCollection;

  /** Transaction support */
  transaction<T>(callback: (tx: QZPayTransaction) => Promise<T>): Promise<T>;

  /** Health check */
  healthCheck(): Promise<boolean>;

  /** Close connection */
  close(): Promise<void>;
}
```

---

### Collection Interfaces

#### QZPayBaseCollection

Base interface for all collections:

```typescript
interface QZPayBaseCollection<T, CreateInput, UpdateInput> {
  /** Find by ID */
  findById(id: string): Promise<T | null>;

  /** Find one by criteria */
  findOne(where: Partial<T>): Promise<T | null>;

  /** Find many with pagination */
  findMany(options: {
    where?: Partial<T>;
    orderBy?: { field: keyof T; direction: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
  }): Promise<{ data: T[]; total: number }>;

  /** Create new record */
  create(input: CreateInput): Promise<T>;

  /** Update existing record */
  update(id: string, input: UpdateInput, version: number): Promise<T>;

  /** Soft delete record */
  softDelete(id: string): Promise<void>;

  /** Count records */
  count(where?: Partial<T>): Promise<number>;
}
```

#### QZPayCustomerCollection

```typescript
interface QZPayCustomerCollection extends QZPayBaseCollection<
  QZPayCustomer,
  CreateCustomerInput,
  UpdateCustomerInput
> {
  /** Find by external ID */
  findByExternalId(externalId: string, livemode: boolean): Promise<QZPayCustomer | null>;

  /** Find by provider customer ID */
  findByProviderCustomerId(
    provider: QZPayPaymentProvider,
    providerCustomerId: string
  ): Promise<QZPayCustomer | null>;

  /** Find by email */
  findByEmail(email: string, livemode: boolean): Promise<QZPayCustomer[]>;

  /** Update provider customer ID */
  updateProviderCustomerId(
    id: string,
    provider: QZPayPaymentProvider,
    providerCustomerId: string
  ): Promise<QZPayCustomer>;

  /** Restore soft-deleted customer */
  restore(id: string): Promise<QZPayCustomer>;
}
```

#### QZPaySubscriptionCollection

```typescript
interface QZPaySubscriptionCollection extends QZPayBaseCollection<
  QZPaySubscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput
> {
  /** Find by provider subscription ID */
  findByProviderSubscriptionId(
    provider: QZPayPaymentProvider,
    providerSubscriptionId: string
  ): Promise<QZPaySubscription | null>;

  /** Find active subscriptions for customer */
  findActiveByCustomerId(customerId: string): Promise<QZPaySubscription[]>;

  /** Find subscriptions expiring soon */
  findExpiringSoon(days: number): Promise<QZPaySubscription[]>;

  /** Find trials expiring soon */
  findTrialsExpiringSoon(days: number): Promise<QZPaySubscription[]>;

  /** Find past due subscriptions */
  findPastDue(): Promise<QZPaySubscription[]>;

  /** Update status */
  updateStatus(id: string, status: QZPaySubscriptionStatus): Promise<QZPaySubscription>;

  /** Schedule cancellation */
  scheduleCancellation(id: string, cancelAt: Date): Promise<QZPaySubscription>;

  /** Remove scheduled cancellation */
  removeCancellation(id: string): Promise<QZPaySubscription>;
}
```

#### QZPayPaymentCollection

```typescript
interface QZPayPaymentCollection extends QZPayBaseCollection<
  QZPayPayment,
  CreatePaymentInput,
  UpdatePaymentInput
> {
  /** Find by provider payment ID */
  findByProviderPaymentId(
    provider: QZPayPaymentProvider,
    providerPaymentId: string
  ): Promise<QZPayPayment | null>;

  /** Find by idempotency key */
  findByIdempotencyKey(idempotencyKey: string): Promise<QZPayPayment | null>;

  /** Find payments for subscription */
  findBySubscriptionId(subscriptionId: string): Promise<QZPayPayment[]>;

  /** Find payments for customer */
  findByCustomerId(customerId: string, options?: {
    status?: QZPayPaymentStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: QZPayPayment[]; total: number }>;

  /** Find failed payments for retry */
  findFailedForRetry(): Promise<QZPayPayment[]>;

  /** Record refund */
  recordRefund(id: string, refundData: {
    amount: number;
    providerRefundId: string;
    reason?: string;
  }): Promise<QZPayPayment>;
}
```

#### QZPayWebhookEventCollection

```typescript
interface QZPayWebhookEventCollection {
  /** Check if event already processed (idempotency) */
  exists(providerEventId: string): Promise<boolean>;

  /** Record processed event */
  record(event: {
    providerEventId: string;
    provider: QZPayPaymentProvider;
    type: string;
    processedAt: Date;
    payload: unknown;
  }): Promise<void>;

  /** Move failed event to DLQ */
  moveToDeadLetter(event: {
    providerEventId: string;
    provider: QZPayPaymentProvider;
    payload: unknown;
    error: string;
    attempts: number;
  }): Promise<void>;

  /** Get events from DLQ for reprocessing */
  getDeadLetterEvents(limit?: number): Promise<Array<{
    id: string;
    providerEventId: string;
    provider: QZPayPaymentProvider;
    payload: unknown;
    error: string;
    attempts: number;
    createdAt: Date;
  }>>;

  /** Mark DLQ event as processed */
  markDeadLetterProcessed(id: string): Promise<void>;
}
```

---

## Email Adapter Interface

### QZPayEmailAdapter

```typescript
export interface QZPayEmailAdapter {
  /** Send email */
  send(input: SendEmailInput): Promise<SendEmailResult>;

  /** Send templated email */
  sendTemplate(input: SendTemplateEmailInput): Promise<SendEmailResult>;

  /** Health check */
  healthCheck(): Promise<boolean>;
}

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface SendTemplateEmailInput {
  to: string | string[];
  templateId: QZPayEmailTemplate;
  variables: Record<string, unknown>;
  from?: string;
  replyTo?: string;
}

interface SendEmailResult {
  messageId: string;
  success: boolean;
  error?: string;
}

enum QZPayEmailTemplate {
  WELCOME = 'welcome',
  TRIAL_STARTED = 'trial_started',
  TRIAL_EXPIRING = 'trial_expiring',
  TRIAL_EXPIRED = 'trial_expired',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_FAILED_FINAL = 'payment_failed_final',
  REFUND_PROCESSED = 'refund_processed',
  INVOICE_READY = 'invoice_ready',
  PAYMENT_METHOD_EXPIRING = 'payment_method_expiring',
}
```

---

## Data Mapping Patterns

### Provider to Internal Mapping

All adapters must implement consistent mapping from provider data to internal types.

#### Mapping Rules

1. **Dates**: Always convert to UTC Date objects
2. **Amounts**: Always store in smallest currency unit (cents)
3. **Status**: Map provider-specific status to `QZPaySubscriptionStatus` or `QZPayPaymentStatus`
4. **Nulls**: Prefer `null` over `undefined` for optional fields
5. **Raw Data**: Always preserve original provider response in `rawProviderData`

#### Example Mapper Implementation

```typescript
// packages/stripe/src/mappers/subscription.mapper.ts

import Stripe from 'stripe';
import { ProviderSubscriptionResult, QZPaySubscriptionStatus, QZPayPaymentProvider } from '@qazuor/qzpay-core';

export function mapStripeSubscription(
  sub: Stripe.Subscription
): ProviderSubscriptionResult {
  return {
    providerSubscriptionId: sub.id,
    provider: QZPayPaymentProvider.STRIPE,
    providerCustomerId: typeof sub.customer === 'string'
      ? sub.customer
      : sub.customer.id,
    status: mapStripeSubscriptionStatus(sub.status),
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    providerPriceId: sub.items.data[0]?.price.id ?? '',
    quantity: sub.items.data[0]?.quantity ?? 1,
    latestInvoiceId: typeof sub.latest_invoice === 'string'
      ? sub.latest_invoice
      : sub.latest_invoice?.id ?? null,
    defaultPaymentMethodId: typeof sub.default_payment_method === 'string'
      ? sub.default_payment_method
      : sub.default_payment_method?.id ?? null,
    livemode: sub.livemode,
    createdAt: new Date(sub.created * 1000),
    rawProviderData: sub,
  };
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): QZPaySubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, QZPaySubscriptionStatus> = {
    active: QZPaySubscriptionStatus.ACTIVE,
    trialing: QZPaySubscriptionStatus.TRIALING,
    past_due: QZPaySubscriptionStatus.PAST_DUE,
    canceled: QZPaySubscriptionStatus.CANCELED,
    unpaid: QZPaySubscriptionStatus.UNPAID,
    paused: QZPaySubscriptionStatus.PAUSED,
    incomplete: QZPaySubscriptionStatus.INCOMPLETE,
    incomplete_expired: QZPaySubscriptionStatus.EXPIRED,
  };
  return statusMap[status] ?? QZPaySubscriptionStatus.ACTIVE;
}
```

---

## Error Handling

### Adapter Error Types

All adapter methods must throw typed errors that can be handled by the core services.

```typescript
// See ERROR-CATALOG.md for complete error hierarchy
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
      provider: QZPayPaymentProvider.STRIPE,
      providerCode: error.code,
      retryable: false,
      originalError: error,
    });
  }
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    throw new QZPayAdapterError({
      code: QZPayErrorCode.PROVIDER_RATE_LIMITED,
      message: 'Rate limit exceeded, please retry',
      provider: QZPayPaymentProvider.STRIPE,
      providerCode: 'rate_limit',
      retryable: true,
      retryAfter: 1000, // ms
      originalError: error,
    });
  }
  // ... handle other error types
}
```

### Retryable Errors

The following errors should be marked as `retryable: true`:

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
- [ ] All responses are mapped to internal types
- [ ] Raw provider data is preserved in results
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
