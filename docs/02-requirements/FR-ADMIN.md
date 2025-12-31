# FR-ADMIN: Admin API Requirements

## Overview

Admin endpoints provide privileged operations for internal tools, customer support, and administrative dashboards. All admin endpoints require elevated authentication and produce detailed audit logs.

---

## FR-ADMIN-001: Admin Authentication

### Description

Admin API endpoints require separate authentication from customer-facing APIs with role-based access control.

### Functional Requirements

1. **Admin API Keys**: Admin operations require special API keys with `admin:` prefix
2. **Role-Based Access**: Support roles: `admin:read`, `admin:write`, `admin:super`
3. **IP Allowlisting**: Optional IP restriction for admin endpoints
4. **Audit Logging**: All admin actions logged with actor, action, target, and timestamp

### Configuration

```typescript
interface AdminAuthConfig {
  /** Require admin API key for all admin endpoints */
  requireAdminApiKey: boolean;

  /** Allowed IP addresses/CIDR ranges (empty = allow all) */
  allowedIPs: string[];

  /** Session timeout in minutes */
  sessionTimeoutMinutes: number;

  /** Require MFA for sensitive operations */
  requireMFAForSensitive: boolean;
}

const defaultAdminAuthConfig: AdminAuthConfig = {
  requireAdminApiKey: true,
  allowedIPs: [],
  sessionTimeoutMinutes: 30,
  requireMFAForSensitive: true,
};
```

### Admin Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin:read` | Support agent | View customers, subscriptions, payments |
| `admin:write` | Senior support | + Refunds, credits, subscription changes |
| `admin:super` | Administrator | + Delete operations, config changes, API key management |

### Acceptance Criteria

- [ ] Admin endpoints reject regular API keys with `ADMIN_AUTH_REQUIRED` error
- [ ] Admin actions are logged to separate audit log
- [ ] IP restriction returns `ADMIN_IP_NOT_ALLOWED` when enforced
- [ ] Session expires after configured timeout

---

## FR-ADMIN-002: Customer Administration

### Description

Admin endpoints for managing customer accounts beyond self-service capabilities.

### API Endpoints

```typescript
// List customers with advanced filters
admin.customers.list(filters: AdminCustomerFilters): Promise<PaginatedResult<Customer>>

// Get detailed customer view including provider data
admin.customers.getDetailed(customerId: string): Promise<DetailedCustomer>

// Manually link customer to provider
admin.customers.linkProvider(customerId: string, provider: string, providerId: string): Promise<void>

// Merge duplicate customers
admin.customers.merge(sourceId: string, targetId: string): Promise<MergeResult>

// Hard delete customer (GDPR)
admin.customers.hardDelete(customerId: string, reason: string): Promise<void>

// Add internal note to customer
admin.customers.addNote(customerId: string, note: string): Promise<Note>

// Block customer from making purchases
admin.customers.block(customerId: string, reason: string): Promise<void>

// Unblock customer
admin.customers.unblock(customerId: string): Promise<void>
```

### Admin Customer Filters

```typescript
interface AdminCustomerFilters {
  email?: string;
  externalId?: string;
  provider?: string;
  providerId?: string;
  hasActiveSubscription?: boolean;
  hasPaymentMethod?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  totalSpentMin?: number;
  totalSpentMax?: number;
  status?: 'active' | 'blocked' | 'deleted';
  search?: string; // Full-text search
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'totalSpent' | 'lastActivity';
  orderDir?: 'asc' | 'desc';
}
```

### Detailed Customer Response

```typescript
interface DetailedCustomer {
  // Base customer data
  customer: Customer;

  // Provider-specific data
  providerData: {
    stripe?: StripeCustomerData;
    mercadopago?: MercadoPagoCustomerData;
  };

  // Statistics
  stats: {
    totalSpent: number;
    totalRefunded: number;
    subscriptionCount: number;
    paymentCount: number;
    failedPaymentCount: number;
    firstPurchaseAt: Date | null;
    lastPurchaseAt: Date | null;
  };

  // Related entities
  subscriptions: Subscription[];
  paymentMethods: PaymentMethod[];
  recentPayments: Payment[];
  notes: Note[];

  // Audit info
  auditLog: AuditEntry[];
}
```

### Acceptance Criteria

- [ ] `admin:read` can list and view customers
- [ ] `admin:write` required for merge, link, block operations
- [ ] `admin:super` required for hard delete
- [ ] Merge operation transfers all subscriptions and payments
- [ ] Hard delete removes all PII and notifies providers

---

## FR-ADMIN-003: Subscription Administration

### Description

Admin endpoints for managing subscriptions with capabilities beyond what customers can do.

### API Endpoints

```typescript
// List subscriptions with advanced filters
admin.subscriptions.list(filters: AdminSubscriptionFilters): Promise<PaginatedResult<Subscription>>

// Force status change (override normal flow)
admin.subscriptions.forceStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  reason: string
): Promise<void>

// Extend subscription without charge
admin.subscriptions.extend(
  subscriptionId: string,
  days: number,
  reason: string
): Promise<void>

// Backdate subscription change
admin.subscriptions.backdate(
  subscriptionId: string,
  field: 'currentPeriodStart' | 'currentPeriodEnd' | 'trialEnd',
  date: Date,
  reason: string
): Promise<void>

// Transfer subscription to another customer
admin.subscriptions.transfer(
  subscriptionId: string,
  targetCustomerId: string,
  reason: string
): Promise<void>

// Comp/gift subscription (no payment required)
admin.subscriptions.createComp(
  customerId: string,
  planId: string,
  durationDays: number,
  reason: string
): Promise<Subscription>

// Override entitlements temporarily
admin.subscriptions.overrideEntitlements(
  subscriptionId: string,
  entitlements: Record<string, boolean>,
  expiresAt: Date,
  reason: string
): Promise<void>

// Get subscription timeline/history
admin.subscriptions.getTimeline(subscriptionId: string): Promise<SubscriptionTimeline>
```

### Subscription Timeline

```typescript
interface SubscriptionTimeline {
  subscriptionId: string;
  events: TimelineEvent[];
}

interface TimelineEvent {
  timestamp: Date;
  type:
    | 'created'
    | 'activated'
    | 'trial_started'
    | 'trial_ended'
    | 'plan_changed'
    | 'renewed'
    | 'payment_failed'
    | 'entered_grace_period'
    | 'paused'
    | 'resumed'
    | 'canceled'
    | 'expired'
    | 'reactivated'
    | 'admin_action';
  description: string;
  actor: 'system' | 'customer' | 'admin' | 'webhook';
  actorId?: string;
  metadata: Record<string, unknown>;
}
```

### Acceptance Criteria

- [ ] Force status change bypasses normal state machine validation
- [ ] Extension adds days to currentPeriodEnd without creating invoice
- [ ] Transfer preserves subscription history
- [ ] Comp subscriptions have `isComp: true` flag
- [ ] All admin changes recorded in timeline

---

## FR-ADMIN-004: Payment Administration

### Description

Admin endpoints for managing payments, refunds, and financial operations.

### API Endpoints

```typescript
// List payments with advanced filters
admin.payments.list(filters: AdminPaymentFilters): Promise<PaginatedResult<Payment>>

// Get payment with full provider details
admin.payments.getDetailed(paymentId: string): Promise<DetailedPayment>

// Process manual refund
admin.payments.refund(
  paymentId: string,
  amount?: number, // Partial refund if specified
  reason: RefundReason,
  notifyCustomer: boolean
): Promise<Refund>

// Void pending payment
admin.payments.void(paymentId: string, reason: string): Promise<void>

// Retry failed payment
admin.payments.retry(paymentId: string): Promise<Payment>

// Mark disputed payment
admin.payments.markDisputed(
  paymentId: string,
  disputeId: string,
  reason: string
): Promise<void>

// Write off uncollectable payment
admin.payments.writeOff(paymentId: string, reason: string): Promise<void>

// Manual payment entry (cash, check, wire)
admin.payments.recordManual(
  customerId: string,
  amount: number,
  currency: string,
  method: 'cash' | 'check' | 'wire' | 'other',
  reference: string,
  reason: string
): Promise<Payment>
```

### Refund Reasons

```typescript
enum RefundReason {
  CUSTOMER_REQUEST = 'customer_request',
  DUPLICATE_CHARGE = 'duplicate_charge',
  FRAUDULENT = 'fraudulent',
  SERVICE_NOT_RENDERED = 'service_not_rendered',
  PRODUCT_DEFECTIVE = 'product_defective',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  BILLING_ERROR = 'billing_error',
  GOODWILL = 'goodwill',
  CHARGEBACK_PREVENTION = 'chargeback_prevention',
  OTHER = 'other',
}
```

### Acceptance Criteria

- [ ] Partial refunds must be <= original amount minus previous refunds
- [ ] Void only works for pending payments
- [ ] Manual payments marked as `source: 'manual'`
- [ ] Write-off updates payment status to `written_off`
- [ ] Refund notification optional via `notifyCustomer` flag

---

## FR-ADMIN-005: Invoice Administration

### Description

Admin endpoints for managing invoices beyond automatic generation.

### API Endpoints

```typescript
// List invoices with filters
admin.invoices.list(filters: AdminInvoiceFilters): Promise<PaginatedResult<Invoice>>

// Create manual invoice
admin.invoices.create(
  customerId: string,
  lineItems: InvoiceLineItem[],
  options?: ManualInvoiceOptions
): Promise<Invoice>

// Add/remove line items from draft
admin.invoices.addLineItem(invoiceId: string, item: InvoiceLineItem): Promise<Invoice>
admin.invoices.removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice>

// Apply credit to invoice
admin.invoices.applyCredit(
  invoiceId: string,
  amount: number,
  reason: string
): Promise<Invoice>

// Finalize draft invoice
admin.invoices.finalize(invoiceId: string): Promise<Invoice>

// Void invoice
admin.invoices.void(invoiceId: string, reason: string): Promise<Invoice>

// Mark invoice as paid (external payment)
admin.invoices.markPaid(
  invoiceId: string,
  paymentMethod: string,
  reference: string
): Promise<Invoice>

// Send/resend invoice email
admin.invoices.send(invoiceId: string, email?: string): Promise<void>

// Download invoice PDF
admin.invoices.downloadPdf(invoiceId: string): Promise<Buffer>

// Regenerate PDF (after corrections)
admin.invoices.regeneratePdf(invoiceId: string): Promise<void>
```

### Manual Invoice Options

```typescript
interface ManualInvoiceOptions {
  /** Custom invoice number (auto-generated if not provided) */
  invoiceNumber?: string;

  /** Due date (default: net 30) */
  dueDate?: Date;

  /** Tax rates to apply */
  taxRates?: TaxRate[];

  /** Memo/notes for customer */
  memo?: string;

  /** Internal notes */
  internalNotes?: string;

  /** Auto-send when finalized */
  autoSend?: boolean;

  /** Currency (default: customer's default) */
  currency?: string;
}
```

### Acceptance Criteria

- [ ] Only draft invoices can be modified
- [ ] Finalizing assigns invoice number and freezes content
- [ ] Voided invoices retain history but show as void
- [ ] Credits reduce invoice total and create credit record
- [ ] PDF regeneration updates storage but preserves original

---

## FR-ADMIN-006: Credit Management

### Description

System for managing customer credits, both promotional and from refunds.

### API Endpoints

```typescript
// Get customer credit balance
admin.credits.getBalance(customerId: string): Promise<CreditBalance>

// Add credit to customer
admin.credits.add(
  customerId: string,
  amount: number,
  currency: string,
  type: CreditType,
  reason: string,
  expiresAt?: Date
): Promise<Credit>

// Adjust credit (correction)
admin.credits.adjust(
  customerId: string,
  amount: number, // Can be negative
  reason: string
): Promise<CreditAdjustment>

// List credit history
admin.credits.listHistory(
  customerId: string,
  filters?: CreditHistoryFilters
): Promise<PaginatedResult<CreditTransaction>>

// Transfer credit between customers
admin.credits.transfer(
  sourceCustomerId: string,
  targetCustomerId: string,
  amount: number,
  reason: string
): Promise<void>
```

### Credit Types

```typescript
enum CreditType {
  PROMOTIONAL = 'promotional',      // Marketing/acquisition
  REFUND = 'refund',               // From refund
  GOODWILL = 'goodwill',           // Customer satisfaction
  REFERRAL = 'referral',           // Referral program
  CORRECTION = 'correction',        // Billing error correction
  MIGRATION = 'migration',          // From legacy system
  MANUAL = 'manual',               // Other manual entry
}
```

### Credit Balance Response

```typescript
interface CreditBalance {
  customerId: string;

  // Available credit by currency
  available: Record<string, number>;

  // Pending credit (not yet usable)
  pending: Record<string, number>;

  // Expiring soon (next 30 days)
  expiringSoon: {
    currency: string;
    amount: number;
    expiresAt: Date;
  }[];

  // Total ever credited
  totalCredited: Record<string, number>;

  // Total ever used
  totalUsed: Record<string, number>;
}
```

### Credit Application Rules

1. **Automatic Application**: Credits applied automatically to invoices
2. **Currency Matching**: Credits only apply to matching currency
3. **Expiration Priority**: Oldest/soonest-expiring credits used first
4. **Partial Application**: Credits can partially cover invoices
5. **Non-Transferable**: Credits cannot be converted to cash

### Acceptance Criteria

- [ ] Credits automatically apply to new invoices
- [ ] Expired credits handled in nightly job
- [ ] Credit history shows all transactions
- [ ] Negative balance prevented (except for corrections)
- [ ] Multi-currency support per customer

---

## FR-ADMIN-007: Promo Code Administration

### Description

Admin endpoints for creating and managing promotional codes.

### API Endpoints

```typescript
// List promo codes
admin.promoCodes.list(filters?: PromoCodeFilters): Promise<PaginatedResult<PromoCode>>

// Create new promo code
admin.promoCodes.create(input: CreatePromoCodeInput): Promise<PromoCode>

// Update promo code
admin.promoCodes.update(code: string, updates: UpdatePromoCodeInput): Promise<PromoCode>

// Deactivate promo code
admin.promoCodes.deactivate(code: string, reason: string): Promise<void>

// Get usage statistics
admin.promoCodes.getStats(code: string): Promise<PromoCodeStats>

// List redemptions
admin.promoCodes.listRedemptions(code: string): Promise<PaginatedResult<PromoRedemption>>

// Generate bulk codes
admin.promoCodes.generateBulk(
  template: BulkPromoTemplate,
  count: number
): Promise<PromoCode[]>
```

### Create Promo Code Input

```typescript
interface CreatePromoCodeInput {
  /** Unique code (auto-generated if not provided) */
  code?: string;

  /** Discount type */
  discountType: 'percentage' | 'fixed_amount' | 'trial_extension';

  /** Discount value (percent or cents) */
  discountValue: number;

  /** Currency (required for fixed_amount) */
  currency?: string;

  /** Maximum redemptions (null = unlimited) */
  maxRedemptions?: number;

  /** Maximum redemptions per customer */
  maxRedemptionsPerCustomer?: number;

  /** Valid from date */
  validFrom?: Date;

  /** Expiration date */
  expiresAt?: Date;

  /** Minimum purchase amount */
  minimumAmount?: number;

  /** Restrict to specific plans */
  applicablePlanIds?: string[];

  /** Restrict to specific products */
  applicableProductIds?: string[];

  /** First-time customers only */
  firstTimeOnly?: boolean;

  /** Duration for recurring discounts */
  duration?: 'once' | 'repeating' | 'forever';

  /** Number of periods for repeating */
  durationInMonths?: number;

  /** Internal description */
  description?: string;

  /** Metadata */
  metadata?: Record<string, unknown>;
}
```

### Promo Code Statistics

```typescript
interface PromoCodeStats {
  code: string;
  totalRedemptions: number;
  uniqueCustomers: number;
  totalDiscountGiven: number;
  averageOrderValue: number;
  redemptionsByDay: { date: string; count: number }[];
  topPlans: { planId: string; count: number }[];
  conversionRate: number; // Percentage who became paying customers
}
```

### Acceptance Criteria

- [ ] Code uniqueness enforced case-insensitively
- [ ] Bulk generation creates unique codes with pattern
- [ ] Deactivated codes immediately stop working
- [ ] Stats include conversion tracking
- [ ] First-time validation checks customer history

---

## FR-ADMIN-008: Reports and Analytics

### Description

Admin endpoints for generating business reports and analytics.

### API Endpoints

```typescript
// Revenue report
admin.reports.revenue(params: RevenueReportParams): Promise<RevenueReport>

// Subscription metrics
admin.reports.subscriptionMetrics(params: DateRangeParams): Promise<SubscriptionMetrics>

// Churn analysis
admin.reports.churnAnalysis(params: ChurnAnalysisParams): Promise<ChurnReport>

// MRR breakdown
admin.reports.mrrBreakdown(date?: Date): Promise<MRRBreakdown>

// Payment success rates
admin.reports.paymentSuccessRates(params: DateRangeParams): Promise<PaymentSuccessReport>

// Cohort analysis
admin.reports.cohortAnalysis(params: CohortParams): Promise<CohortReport>

// Export data
admin.reports.export(type: ExportType, params: ExportParams): Promise<ExportJob>
```

### Revenue Report

```typescript
interface RevenueReport {
  period: DateRange;

  // Gross revenue
  grossRevenue: number;

  // Net revenue (after refunds)
  netRevenue: number;

  // Breakdown by source
  bySource: {
    subscriptions: number;
    oneTime: number;
    addons: number;
    usage: number;
  };

  // Breakdown by plan
  byPlan: { planId: string; amount: number }[];

  // Breakdown by period
  byPeriod: { period: string; gross: number; net: number; refunds: number }[];

  // Refunds
  totalRefunds: number;
  refundCount: number;

  // Failed payments
  failedPayments: number;
  failedAmount: number;

  // Comparison to previous period
  comparison?: {
    previousPeriodRevenue: number;
    growthRate: number;
  };
}
```

### MRR Breakdown

```typescript
interface MRRBreakdown {
  date: Date;

  // Total MRR
  totalMRR: number;

  // MRR components
  newMRR: number;          // From new subscriptions
  expansionMRR: number;    // From upgrades
  contractionMRR: number;  // From downgrades
  churnedMRR: number;      // From cancellations
  reactivationMRR: number; // From reactivations

  // Net new MRR
  netNewMRR: number;

  // By plan
  byPlan: { planId: string; mrr: number; count: number }[];

  // Movement details
  movements: {
    newSubscriptions: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
    reactivations: number;
  };
}
```

### Subscription Metrics

```typescript
interface SubscriptionMetrics {
  period: DateRange;

  // Current state
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;

  // Period activity
  newSubscriptions: number;
  canceledSubscriptions: number;
  upgrades: number;
  downgrades: number;

  // Trial metrics
  trialsStarted: number;
  trialsConverted: number;
  trialsExpired: number;
  trialConversionRate: number;

  // Churn
  churnRate: number;
  netChurnRate: number;

  // ARPU
  arpu: number;
  arpuChange: number;
}
```

### Acceptance Criteria

- [ ] Reports support date range filtering
- [ ] Currency conversion applied for multi-currency
- [ ] Export supports CSV, JSON, and Excel formats
- [ ] Large exports processed as background jobs
- [ ] Cohort analysis supports monthly/weekly cohorts

---

## FR-ADMIN-009: System Configuration

### Description

Admin endpoints for managing system-wide configuration.

### API Endpoints

```typescript
// Get current configuration
admin.config.get(): Promise<SystemConfig>

// Update configuration (partial)
admin.config.update(updates: Partial<SystemConfig>): Promise<SystemConfig>

// Get config history
admin.config.getHistory(): Promise<ConfigChange[]>

// Validate configuration
admin.config.validate(config: Partial<SystemConfig>): Promise<ValidationResult>

// Test email configuration
admin.config.testEmail(recipientEmail: string): Promise<void>

// Test webhook endpoint
admin.config.testWebhook(webhookId: string): Promise<WebhookTestResult>
```

### System Configuration

```typescript
interface SystemConfig {
  // General
  general: {
    defaultCurrency: string;
    supportedCurrencies: string[];
    timezone: string;
    dateFormat: string;
  };

  // Billing
  billing: {
    gracePeriodDays: number;
    maxRetryAttempts: number;
    retryIntervals: number[];
    autoSuspendAfterGrace: boolean;
  };

  // Trials
  trials: {
    defaultDays: number;
    requirePaymentMethod: boolean;
    reminderDays: number[];
    extendOnRequest: boolean;
    maxExtensions: number;
  };

  // Emails
  emails: {
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
    sendInvoices: boolean;
    sendReceipts: boolean;
    sendReminders: boolean;
  };

  // Security
  security: {
    apiKeyRotationDays: number;
    webhookSignatureAlgorithm: 'sha256' | 'sha512';
    auditLogRetentionDays: number;
  };

  // Integrations
  integrations: {
    stripeEnabled: boolean;
    mercadoPagoEnabled: boolean;
    defaultProvider: string;
  };
}
```

### Acceptance Criteria

- [ ] Configuration changes require `admin:super` role
- [ ] All changes recorded in history
- [ ] Validation prevents invalid configurations
- [ ] Test operations don't affect production data
- [ ] Sensitive values masked in responses

---

## FR-ADMIN-010: Audit Log

### Description

Comprehensive audit logging for all administrative actions.

### API Endpoints

```typescript
// List audit entries
admin.audit.list(filters: AuditFilters): Promise<PaginatedResult<AuditEntry>>

// Get specific entry
admin.audit.get(entryId: string): Promise<AuditEntry>

// Export audit log
admin.audit.export(filters: AuditFilters, format: 'csv' | 'json'): Promise<ExportJob>
```

### Audit Entry Structure

```typescript
interface AuditEntry {
  id: string;
  timestamp: Date;

  // Actor
  actor: {
    type: 'admin' | 'system' | 'customer' | 'webhook';
    id: string;
    email?: string;
    ip?: string;
    userAgent?: string;
  };

  // Action
  action: string;
  category: 'customer' | 'subscription' | 'payment' | 'invoice' | 'config' | 'auth';

  // Target
  target: {
    type: string;
    id: string;
  };

  // Changes
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];

  // Context
  reason?: string;
  metadata?: Record<string, unknown>;

  // Result
  success: boolean;
  errorMessage?: string;
}
```

### Audit Filters

```typescript
interface AuditFilters {
  actorId?: string;
  actorType?: 'admin' | 'system' | 'customer' | 'webhook';
  action?: string;
  category?: string;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
```

### Audited Actions

| Category | Actions |
|----------|---------|
| auth | login, logout, api_key_created, api_key_revoked |
| customer | created, updated, merged, deleted, blocked, unblocked |
| subscription | created, updated, canceled, paused, resumed, transferred, force_status |
| payment | created, refunded, voided, disputed, written_off |
| invoice | created, updated, voided, sent |
| config | updated, email_tested, webhook_tested |

### Acceptance Criteria

- [ ] All admin actions automatically logged
- [ ] Audit logs immutable (append-only)
- [ ] Retention policy enforced via cron job
- [ ] PII in audit logs follows data retention policy
- [ ] Export includes all fields for compliance

---

## Database Schema

```sql
-- Admin API keys
CREATE TABLE admin_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES admin_users(id),
  allowed_ips TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer notes
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  author_id UUID REFERENCES admin_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer credits
CREATE TABLE customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  type VARCHAR(50) NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  credit_id UUID REFERENCES customer_credits(id),
  invoice_id UUID REFERENCES invoices(id),
  type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'expire', 'adjust'
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_email VARCHAR(255),
  actor_ip INET,
  actor_user_agent TEXT,
  action VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  changes JSONB,
  reason TEXT,
  metadata JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log(target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_log_category ON audit_log(category, created_at DESC);
CREATE INDEX idx_credit_transactions_customer ON credit_transactions(customer_id, created_at DESC);

-- Config history
CREATE TABLE config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by UUID REFERENCES admin_users(id),
  changes JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `admin.customer.merged` | `{ sourceId, targetId, actor }` | Customer merge completed |
| `admin.customer.deleted` | `{ customerId, actor }` | Customer hard deleted |
| `admin.customer.blocked` | `{ customerId, reason, actor }` | Customer blocked |
| `admin.subscription.force_status` | `{ subscriptionId, oldStatus, newStatus, actor }` | Status force changed |
| `admin.subscription.extended` | `{ subscriptionId, days, actor }` | Subscription extended |
| `admin.subscription.transferred` | `{ subscriptionId, fromCustomer, toCustomer, actor }` | Subscription transferred |
| `admin.payment.refunded` | `{ paymentId, amount, reason, actor }` | Manual refund processed |
| `admin.payment.written_off` | `{ paymentId, amount, actor }` | Payment written off |
| `admin.credit.added` | `{ customerId, amount, type, actor }` | Credit added |
| `admin.config.updated` | `{ changes, actor }` | System config changed |
| `admin.promo.created` | `{ code, discountType, actor }` | Promo code created |
| `admin.promo.deactivated` | `{ code, reason, actor }` | Promo code deactivated |

---

## User Stories

### US-ADMIN-001: View Customer Details

**As a** support agent
**I want to** see complete customer information
**So that** I can assist with billing inquiries

```gherkin
Scenario: View customer with full history
  Given I have admin:read access
  And customer "cust_123" has 3 subscriptions and 10 payments
  When I call admin.customers.getDetailed("cust_123")
  Then I see customer profile with all provider data
  And I see statistics including total spent
  And I see all subscriptions and recent payments
```

### US-ADMIN-002: Process Refund

**As a** senior support agent
**I want to** process a partial refund
**So that** I can resolve a customer complaint

```gherkin
Scenario: Process partial refund
  Given I have admin:write access
  And payment "pay_123" was for $100
  When I call admin.payments.refund("pay_123", 5000, "customer_request", true)
  Then $50 is refunded to the customer
  And the customer receives a refund notification email
  And the action is recorded in audit log
```

### US-ADMIN-003: Generate Revenue Report

**As a** finance manager
**I want to** generate monthly revenue reports
**So that** I can track business performance

```gherkin
Scenario: Generate monthly revenue report
  Given I have admin:read access
  When I call admin.reports.revenue for January 2025
  Then I receive gross and net revenue totals
  And I see breakdown by plan and source
  And I see comparison to December 2024
```

---

## Related Documents

- [Functional Requirements](./FUNCTIONAL.md)
- [API Specifications](../05-api/PUBLIC-API.md)
- [Security Standards](../../.claude/docs/standards/security-standards.md)
