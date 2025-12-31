# Functional Requirements: Invoice Management

Requirements for invoice generation, management, and PDF export.

## Table of Contents

1. [Overview](#overview)
2. [FR-INVOICE-001: Generate Invoice](#fr-invoice-001-generate-invoice)
3. [FR-INVOICE-002: Get Invoice](#fr-invoice-002-get-invoice)
4. [FR-INVOICE-003: List Invoices](#fr-invoice-003-list-invoices)
5. [FR-INVOICE-004: Finalize Invoice](#fr-invoice-004-finalize-invoice)
6. [FR-INVOICE-005: Void Invoice](#fr-invoice-005-void-invoice)
7. [FR-INVOICE-006: Generate PDF](#fr-invoice-006-generate-pdf)
8. [FR-INVOICE-007: Send Invoice](#fr-invoice-007-send-invoice)
9. [Invoice Number Generation](#invoice-number-generation)
10. [User Stories](#user-stories)

---

## Overview

Invoices are legal documents that record financial transactions. QZPay generates invoices for:

- Subscription renewals
- One-time payments
- Usage-based charges
- Manual charges

### Invoice Lifecycle

```
Draft → Open → Paid
          ↘ Void
          ↘ Uncollectible
```

| Status | Description |
|--------|-------------|
| `draft` | Invoice being prepared, can be modified |
| `open` | Invoice finalized, awaiting payment |
| `paid` | Payment received, invoice complete |
| `void` | Invoice canceled, no payment expected |
| `uncollectible` | Payment attempts exhausted |

---

## FR-INVOICE-001: Generate Invoice

**Priority**: Critical

**Description**: Create an invoice for a customer.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | Yes | Customer to invoice |
| subscriptionId | string | No | Associated subscription |
| lineItems | LineItem[] | Yes | Items to invoice |
| currency | QZPayCurrency | Yes | Invoice currency |
| dueDate | Date | No | When payment is due |
| memo | string | No | Notes for customer |
| footer | string | No | Legal footer text |
| metadata | object | No | Custom data |
| autoFinalize | boolean | No | Finalize immediately (default: false) |
| autoCharge | boolean | No | Charge on finalization (default: true) |

### Line Item Structure

```typescript
interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number; // in cents
  taxable?: boolean;
  discountable?: boolean;
  metadata?: Record<string, string>;

  // For subscription items
  periodStart?: Date;
  periodEnd?: Date;

  // For proration
  proration?: boolean;
  prorationDate?: Date;
}
```

### Output

```typescript
interface Invoice {
  id: string;
  number: string | null; // Assigned on finalization
  customerId: string;
  subscriptionId: string | null;
  status: InvoiceStatus;

  // Amounts (in cents)
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  amountPaid: number;
  amountDue: number;

  currency: QZPayCurrency;
  lineItems: InvoiceLineItem[];
  discounts: InvoiceDiscount[];

  dueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;

  memo: string | null;
  footer: string | null;

  pdfUrl: string | null;
  hostedUrl: string | null;

  createdAt: Date;
  finalizedAt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;

  metadata: Record<string, unknown>;
}
```

### Business Rules

1. **Draft invoices** can have line items added/removed
2. **Finalized invoices** cannot be modified (only voided)
3. **Invoice number** assigned only on finalization
4. **Auto-charge** attempts payment immediately on finalization
5. **Due date** defaults to finalization date + net terms (default: 0)

### Example

```typescript
const invoice = await billing.invoices.create({
  customerId: 'cust_123',
  lineItems: [
    {
      description: 'Pro Plan - Monthly',
      quantity: 1,
      unitAmount: 4900,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-02-01'),
    },
    {
      description: 'API Overage - 5000 calls @ $0.01',
      quantity: 5000,
      unitAmount: 1,
    },
  ],
  currency: 'USD',
  memo: 'Thank you for your business!',
});
```

### Acceptance Criteria

```gherkin
Scenario: Create draft invoice
  Given a customer exists
  When I create an invoice with line items
  Then invoice is created with status "draft"
  And invoice number is null
  And line items are calculated correctly

Scenario: Create and finalize immediately
  Given a customer with payment method
  When I create invoice with autoFinalize: true and autoCharge: true
  Then invoice is finalized
  And invoice number is assigned
  And payment is attempted
  And if payment succeeds, status is "paid"

Scenario: Invoice with discounts
  Given customer has active promo code "SAVE20"
  When I create invoice with discountable line items
  Then 20% discount is applied
  And discount appears in invoice.discounts
  And total reflects discounted amount
```

---

## FR-INVOICE-002: Get Invoice

**Priority**: Critical

**Description**: Retrieve invoice by ID.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invoiceId | string | Yes | Invoice ID |
| expand | string[] | No | Include related objects |

### Expand Options

- `customer` - Include full customer object
- `subscription` - Include subscription details
- `payment` - Include payment details

### Acceptance Criteria

```gherkin
Scenario: Get invoice with all details
  Given invoice "inv_123" exists
  When I get invoice with expand: ['customer', 'payment']
  Then invoice details are returned
  And customer object is included
  And payment object is included

Scenario: Get non-existent invoice
  Given invoice "inv_invalid" does not exist
  When I try to get the invoice
  Then error INV_NOT_FOUND is returned
```

---

## FR-INVOICE-003: List Invoices

**Priority**: High

**Description**: List invoices with filtering and pagination.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customerId | string | No | Filter by customer |
| subscriptionId | string | No | Filter by subscription |
| status | InvoiceStatus[] | No | Filter by status |
| startDate | Date | No | Invoice date range start |
| endDate | Date | No | Invoice date range end |
| limit | number | No | Max results (default: 20, max: 100) |
| startingAfter | string | No | Cursor for pagination |

### Output

```typescript
{
  data: Invoice[];
  hasMore: boolean;
  totalCount: number;
}
```

### Acceptance Criteria

```gherkin
Scenario: List customer invoices
  Given customer has 15 invoices
  When I list invoices with limit: 10
  Then 10 invoices are returned
  And hasMore is true
  And I can paginate to get remaining 5

Scenario: Filter by status
  Given customer has 5 paid and 2 open invoices
  When I list invoices with status: ['open']
  Then only 2 open invoices are returned

Scenario: Filter by date range
  Given invoices from January and February
  When I filter for January dates
  Then only January invoices are returned
```

---

## FR-INVOICE-004: Finalize Invoice

**Priority**: Critical

**Description**: Finalize a draft invoice, making it immutable and ready for payment.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invoiceId | string | Yes | Invoice to finalize |
| autoCharge | boolean | No | Attempt payment (default: true) |

### Business Rules

1. Only `draft` invoices can be finalized
2. Assigns sequential invoice number
3. Sets `finalizedAt` timestamp
4. Triggers `autoCharge` if enabled
5. Emits `INVOICE_FINALIZED` event

### Acceptance Criteria

```gherkin
Scenario: Finalize draft invoice
  Given invoice "inv_123" has status "draft"
  When I finalize the invoice
  Then status becomes "open"
  And invoice number is assigned
  And finalizedAt is set
  And event INVOICE_FINALIZED is emitted

Scenario: Finalize with auto-charge succeeds
  Given draft invoice for customer with valid payment method
  When I finalize with autoCharge: true
  Then payment is attempted
  And payment succeeds
  And status becomes "paid"
  And paidAt is set

Scenario: Finalize with auto-charge fails
  Given draft invoice for customer with expired card
  When I finalize with autoCharge: true
  Then payment is attempted
  And payment fails
  And status remains "open"
  And event INVOICE_PAYMENT_FAILED is emitted

Scenario: Cannot finalize non-draft
  Given invoice "inv_123" has status "open"
  When I try to finalize it
  Then error INV_ALREADY_FINALIZED is returned

Scenario: Cannot finalize empty invoice
  Given draft invoice with no line items
  When I try to finalize it
  Then error INV_EMPTY is returned
```

---

## FR-INVOICE-005: Void Invoice

**Priority**: High

**Description**: Void an invoice, canceling payment expectations.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invoiceId | string | Yes | Invoice to void |
| reason | string | No | Reason for voiding |

### Business Rules

1. Can void `draft` or `open` invoices
2. Cannot void `paid` invoices (must refund instead)
3. Sets `voidedAt` timestamp
4. Releases any pending payment attempts
5. Emits `INVOICE_VOIDED` event

### Acceptance Criteria

```gherkin
Scenario: Void open invoice
  Given invoice "inv_123" has status "open"
  When I void the invoice
  Then status becomes "void"
  And voidedAt is set
  And event INVOICE_VOIDED is emitted
  And any pending payment is canceled

Scenario: Cannot void paid invoice
  Given invoice "inv_123" has status "paid"
  When I try to void it
  Then error INV_ALREADY_PAID is returned
  And suggestion to use refund is provided
```

---

## FR-INVOICE-006: Generate PDF

**Priority**: High

**Description**: Generate PDF version of an invoice.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invoiceId | string | Yes | Invoice ID |
| template | string | No | PDF template to use |
| locale | string | No | Language for PDF (default: en) |

### Output

```typescript
{
  pdfUrl: string;      // URL to download PDF
  expiresAt: Date;     // When URL expires
}
```

### PDF Contents

The PDF includes:
- Company logo and details
- Customer billing address
- Invoice number and date
- Line items with descriptions and amounts
- Subtotal, discounts, tax, and total
- Payment status and instructions
- Due date
- Footer with legal text

### Business Rules

1. PDF only generated for finalized invoices
2. PDF URL valid for 24 hours
3. PDF regenerated if invoice is updated
4. Support multiple languages via locale

### Acceptance Criteria

```gherkin
Scenario: Generate PDF for paid invoice
  Given finalized invoice "inv_123"
  When I request PDF generation
  Then PDF is generated
  And pdfUrl is returned
  And PDF contains all invoice details

Scenario: PDF in Spanish
  Given finalized invoice for Spanish customer
  When I request PDF with locale: 'es'
  Then PDF is generated in Spanish
  And currency formatting follows locale

Scenario: Cannot generate PDF for draft
  Given draft invoice "inv_123"
  When I try to generate PDF
  Then error INV_NOT_FINALIZED is returned
```

---

## FR-INVOICE-007: Send Invoice

**Priority**: High

**Description**: Email invoice to customer.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invoiceId | string | Yes | Invoice to send |
| to | string[] | No | Email addresses (default: customer email) |
| cc | string[] | No | CC addresses |
| attachPdf | boolean | No | Attach PDF (default: true) |
| customMessage | string | No | Additional message |

### Business Rules

1. Only finalized invoices can be sent
2. Records `sentAt` and `sentTo`
3. Includes link to hosted invoice page
4. PDF attached by default
5. Emits `INVOICE_SENT` event

### Acceptance Criteria

```gherkin
Scenario: Send invoice to customer
  Given finalized invoice "inv_123"
  When I send the invoice
  Then email is sent to customer
  And PDF is attached
  And link to hosted page is included
  And event INVOICE_SENT is emitted

Scenario: Send to multiple recipients
  Given finalized invoice
  When I send to customer + accounting@company.com
  Then both receive the invoice email
  And sentTo records both addresses

Scenario: Cannot send draft invoice
  Given draft invoice "inv_123"
  When I try to send it
  Then error INV_NOT_FINALIZED is returned
```

---

## Invoice Number Generation

### Format

```
{PREFIX}-{YEAR}-{SEQUENCE}
```

### Configuration

```typescript
interface InvoiceNumberConfig {
  /** Prefix for invoice numbers */
  prefix: string; // Default: "INV"

  /** Include year in number */
  includeYear: boolean; // Default: true

  /** Reset sequence annually */
  resetAnnually: boolean; // Default: true

  /** Minimum sequence digits (zero-padded) */
  sequenceDigits: number; // Default: 6

  /** Separator character */
  separator: string; // Default: "-"

  /** Multi-tenant: include tenant prefix */
  includeTenantPrefix: boolean; // Default: false
}

// Example numbers:
// INV-2025-000001
// INV-2025-000002
// ACME-INV-2025-000001 (with tenant prefix)
```

### Implementation

```typescript
async function generateInvoiceNumber(
  config: InvoiceNumberConfig,
  tenantId?: string
): Promise<string> {
  const year = new Date().getFullYear();
  const yearKey = config.resetAnnually ? year : 'all';

  // Atomic increment with database
  const sequence = await db.execute(sql`
    INSERT INTO billing_invoice_sequences (tenant_id, year, sequence)
    VALUES (${tenantId ?? 'default'}, ${yearKey}, 1)
    ON CONFLICT (tenant_id, year)
    DO UPDATE SET sequence = billing_invoice_sequences.sequence + 1
    RETURNING sequence
  `);

  const parts: string[] = [];

  if (config.includeTenantPrefix && tenantId) {
    parts.push(tenantId.toUpperCase());
  }

  parts.push(config.prefix);

  if (config.includeYear) {
    parts.push(year.toString());
  }

  parts.push(sequence.toString().padStart(config.sequenceDigits, '0'));

  return parts.join(config.separator);
}
```

### Business Rules

1. Invoice numbers are unique within tenant
2. Sequence never decreases (gaps allowed)
3. Numbers assigned only on finalization
4. Cannot be changed after assignment
5. Voided invoices retain their numbers

---

## User Stories

### US-INVOICE-001: View Invoice

**As a** customer
**I want to** view my invoices
**So that** I can understand my charges and keep records

**Priority**: High

**Acceptance Criteria**:
- [ ] List all my invoices with status
- [ ] View invoice details and line items
- [ ] Download PDF
- [ ] See payment status and history

```gherkin
Scenario: View invoice list
  Given I am logged in as a customer
  When I visit the invoices page
  Then I see list of my invoices:
    | Number | Date | Amount | Status |
    | INV-2025-000042 | Jan 15, 2025 | $49.00 | Paid |
    | INV-2025-000038 | Dec 15, 2024 | $49.00 | Paid |
  And I can click to view details

Scenario: View invoice details
  Given I click on invoice INV-2025-000042
  Then I see:
    | Description | Qty | Unit Price | Amount |
    | Pro Plan - Monthly | 1 | $49.00 | $49.00 |
  And I see subtotal, tax, and total
  And I see payment date and method

Scenario: Download PDF
  Given I am viewing an invoice
  When I click "Download PDF"
  Then PDF file downloads
  And PDF matches invoice details
```

### US-INVOICE-002: Pay Outstanding Invoice

**As a** customer with an open invoice
**I want to** pay my outstanding balance
**So that** my subscription remains active

**Priority**: Critical

**Acceptance Criteria**:
- [ ] See outstanding balance clearly
- [ ] Pay with saved payment method
- [ ] Add new payment method if needed
- [ ] Receive confirmation

```gherkin
Scenario: Pay with saved card
  Given I have open invoice for $49.00
  And I have saved credit card ending in 4242
  When I click "Pay Now"
  Then payment is processed
  And invoice status becomes "paid"
  And I receive email confirmation
  And subscription access is restored

Scenario: Pay with new card
  Given I have open invoice
  And my saved card is expired
  When I enter new card details and pay
  Then new card is saved
  And payment is processed
  And old card is optionally replaced

Scenario: Payment fails
  Given I have open invoice
  When payment is declined
  Then I see error message
  And I can try different payment method
  And invoice remains "open"
```

### US-INVOICE-003: Receive Invoice Email

**As a** customer
**I want to** receive invoice emails
**So that** I have records and know when payment is due

**Priority**: High

**Acceptance Criteria**:
- [ ] Receive email when invoice is created
- [ ] Email includes invoice details
- [ ] PDF is attached
- [ ] Link to pay online

```gherkin
Scenario: Receive invoice email
  Given my subscription renews today
  When invoice is generated
  Then I receive email with:
    - Invoice number and date
    - Amount due
    - Link to view invoice
    - PDF attachment
  And I can pay directly from email link

Scenario: Receive payment reminder
  Given I have unpaid invoice due in 3 days
  When reminder is sent
  Then email reminds me of due date
  And includes easy pay link
```

### US-INVOICE-004: Admin Creates Manual Invoice

**As an** administrator
**I want to** create invoices manually
**So that** I can bill for custom services

**Priority**: Medium

**Acceptance Criteria**:
- [ ] Create invoice for any customer
- [ ] Add custom line items
- [ ] Set custom due date
- [ ] Send to customer

```gherkin
Scenario: Create custom invoice
  Given I am an admin
  When I create invoice for customer "cust_123":
    | Description | Amount |
    | Consulting - 2 hours | $200.00 |
    | Setup fee | $50.00 |
  And I set due date to 30 days
  Then invoice is created as "draft"
  And I can review before finalizing

Scenario: Finalize and send
  Given I have reviewed draft invoice
  When I finalize and send
  Then invoice number is assigned
  And customer receives email
  And invoice appears in their portal
```

### US-INVOICE-005: Export Invoices for Accounting

**As a** business owner
**I want to** export invoices
**So that** I can import them into my accounting software

**Priority**: Medium

**Acceptance Criteria**:
- [ ] Export invoices to CSV
- [ ] Filter by date range
- [ ] Include all financial details
- [ ] Compatible with common accounting tools

```gherkin
Scenario: Export month's invoices
  Given I want January 2025 invoices
  When I export to CSV
  Then CSV includes:
    - Invoice number
    - Date
    - Customer name
    - Line items
    - Subtotal, tax, total
    - Payment status
    - Payment date
  And file downloads successfully

Scenario: Export for QuickBooks
  Given I use QuickBooks
  When I export in QuickBooks format
  Then file is compatible with QuickBooks import
  And all fields map correctly
```

---

## Database Schema

```sql
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(50) UNIQUE,
  customer_id UUID NOT NULL REFERENCES billing_customers(id),
  subscription_id UUID REFERENCES billing_subscriptions(id),

  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  currency VARCHAR(3) NOT NULL,

  subtotal INTEGER NOT NULL DEFAULT 0,
  total_discount INTEGER NOT NULL DEFAULT 0,
  total_tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  amount_due INTEGER NOT NULL DEFAULT 0,

  due_date TIMESTAMP,
  period_start TIMESTAMP,
  period_end TIMESTAMP,

  memo TEXT,
  footer TEXT,

  pdf_url TEXT,
  hosted_url TEXT,

  finalized_at TIMESTAMP,
  paid_at TIMESTAMP,
  voided_at TIMESTAMP,
  sent_at TIMESTAMP,
  sent_to TEXT[],

  metadata JSONB NOT NULL DEFAULT '{}',
  livemode BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX idx_invoices_customer (customer_id),
  INDEX idx_invoices_subscription (subscription_id),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_number (number)
);

CREATE TABLE billing_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount INTEGER NOT NULL,
  amount INTEGER NOT NULL,

  taxable BOOLEAN NOT NULL DEFAULT true,
  discountable BOOLEAN NOT NULL DEFAULT true,

  period_start TIMESTAMP,
  period_end TIMESTAMP,
  proration BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX idx_line_items_invoice (invoice_id)
);

CREATE TABLE billing_invoice_sequences (
  tenant_id VARCHAR(100) NOT NULL,
  year VARCHAR(10) NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (tenant_id, year)
);
```

---

## Events

| Event | When |
|-------|------|
| `INVOICE_CREATED` | Draft invoice created |
| `INVOICE_FINALIZED` | Invoice finalized, number assigned |
| `INVOICE_PAID` | Payment received |
| `INVOICE_PAYMENT_FAILED` | Payment attempt failed |
| `INVOICE_SENT` | Invoice emailed |
| `INVOICE_VOIDED` | Invoice canceled |
| `INVOICE_MARKED_UNCOLLECTIBLE` | Payment abandoned |

---

## References

- [Functional Requirements](./FUNCTIONAL.md)
- [Payment Processing](./FUNCTIONAL.md#3-payment-processing)
- [Events Reference](../05-api/EVENTS.md)
- [PDF Generation](../03-architecture/PATTERNS.md#pdf-generation)
