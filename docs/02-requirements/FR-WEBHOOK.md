# Functional Requirements: Webhook Processing

Requirements for receiving and processing webhooks from payment providers.

## Table of Contents

1. [Overview](#overview)
2. [FR-WEBHOOK-001: Receive Provider Webhooks](#fr-webhook-001-receive-provider-webhooks)
3. [FR-WEBHOOK-002: Validate Webhook Signatures](#fr-webhook-002-validate-webhook-signatures)
4. [FR-WEBHOOK-003: Process Events Idempotently](#fr-webhook-003-process-events-idempotently)
5. [FR-WEBHOOK-004: Handle Failed Webhooks](#fr-webhook-004-handle-failed-webhooks)
6. [FR-WEBHOOK-005: Dead Letter Queue](#fr-webhook-005-dead-letter-queue)
7. [Event Mapping Reference](#event-mapping-reference)
8. [User Stories](#user-stories)

---

## Overview

Webhooks are critical for keeping QZPay in sync with payment providers. When events occur in Stripe or MercadoPago (payment succeeded, subscription canceled, etc.), the provider sends a webhook notification that must be processed reliably.

### Design Principles

1. **Reliability**: Every webhook must be processed exactly once
2. **Security**: All webhooks must have valid signatures
3. **Performance**: Webhooks must be acknowledged within 500ms
4. **Observability**: All webhook processing must be logged and monitored

---

## FR-WEBHOOK-001: Receive Provider Webhooks

**Priority**: Critical

**Description**: Expose endpoints to receive webhooks from payment providers.

### Endpoints

| Provider | Endpoint | Method |
|----------|----------|--------|
| Stripe | `/billing/webhooks/stripe` | POST |
| MercadoPago | `/billing/webhooks/mercadopago` | POST |

### Input

Raw HTTP request body and headers from provider.

**Stripe Headers**:
- `stripe-signature`: Signature for validation

**MercadoPago Headers**:
- `x-signature`: HMAC signature
- `x-request-id`: Request identifier

### Output

| Status | Response | Meaning |
|--------|----------|---------|
| 200 | `{ "received": true }` | Webhook accepted |
| 400 | `{ "error": "..." }` | Invalid payload |
| 401 | `{ "error": "..." }` | Invalid signature |
| 500 | `{ "error": "..." }` | Processing failed (will retry) |

### Business Rules

1. Always return 200 after successful validation, even if processing is async
2. Return 200 for duplicate events (idempotency)
3. Return 401 for invalid signatures (security)
4. Return 500 only for transient failures (triggers provider retry)
5. Response must be sent within 500ms

### Acceptance Criteria

```gherkin
Scenario: Receive valid Stripe webhook
  Given Stripe sends a webhook with valid signature
  And event type is "invoice.payment_succeeded"
  When webhook endpoint receives the request
  Then signature is validated
  And response 200 is returned within 500ms
  And event is queued for processing

Scenario: Reject webhook with invalid signature
  Given an attacker sends a webhook with invalid signature
  When webhook endpoint receives the request
  Then signature validation fails
  And response 401 is returned
  And security event is logged
  And no processing occurs

Scenario: Handle duplicate webhook
  Given webhook with eventId "evt_123" was already processed
  When same webhook is received again
  Then idempotency check detects duplicate
  And response 200 is returned
  And no reprocessing occurs
```

---

## FR-WEBHOOK-002: Validate Webhook Signatures

**Priority**: Critical

**Description**: Cryptographically validate webhook signatures to prevent spoofing.

### Stripe Signature Validation

```typescript
interface StripeSignatureValidation {
  /** Raw request body (must NOT be parsed) */
  payload: string | Buffer;

  /** stripe-signature header value */
  signature: string;

  /** Webhook signing secret from Stripe dashboard */
  webhookSecret: string;

  /** Tolerance for timestamp validation (seconds) */
  tolerance?: number; // Default: 300 (5 minutes)
}
```

**Stripe Signature Format**:
```
t=1614556800,v1=abc123...,v0=def456...
```

**Validation Steps**:
1. Parse timestamp (`t`) and signatures (`v1`)
2. Check timestamp is within tolerance (prevent replay attacks)
3. Construct signed payload: `${timestamp}.${payload}`
4. Compute HMAC SHA-256 with webhook secret
5. Compare computed signature with `v1` using timing-safe comparison

### MercadoPago Signature Validation

```typescript
interface MercadoPagoSignatureValidation {
  /** x-signature header value */
  signature: string;

  /** x-request-id header value */
  requestId: string;

  /** URL query parameters as string */
  queryString: string;

  /** Webhook secret from MercadoPago dashboard */
  webhookSecret: string;
}
```

**Validation Steps**:
1. Parse `ts` and `v1` from x-signature header
2. Extract `data.id` from query string
3. Construct manifest: `id:${data.id};request-id:${requestId};ts:${ts};`
4. Compute HMAC SHA-256 with webhook secret
5. Compare with timing-safe comparison

### Business Rules

1. **MUST** use timing-safe comparison to prevent timing attacks
2. **MUST** validate timestamp to prevent replay attacks
3. **MUST** reject requests with missing or malformed signatures
4. **MUST** log all signature validation failures
5. **SHOULD** alert on multiple validation failures (potential attack)

### Acceptance Criteria

```gherkin
Scenario: Valid Stripe signature
  Given a webhook with signature "t=1614556800,v1=abc123..."
  And payload matches the signature
  And timestamp is within 5 minutes
  When signature is validated
  Then validation passes
  And webhook is processed

Scenario: Expired timestamp (replay attack)
  Given a webhook with valid signature
  But timestamp is 10 minutes old
  When signature is validated
  Then validation fails with WEBHOOK_SIGNATURE_EXPIRED
  And security event is logged

Scenario: Tampered payload
  Given a webhook with valid signature
  But payload was modified after signing
  When signature is validated
  Then validation fails with WEBHOOK_INVALID_SIGNATURE
  And security event is logged

Scenario: Timing attack prevention
  Given an attacker measures response times
  When they send webhooks with different invalid signatures
  Then all responses take the same time
  And signature bytes cannot be guessed via timing
```

---

## FR-WEBHOOK-003: Process Events Idempotently

**Priority**: Critical

**Description**: Ensure each webhook event is processed exactly once, even if received multiple times.

### Idempotency Implementation

```typescript
interface WebhookIdempotency {
  /** Provider event ID (unique per event) */
  providerEventId: string;

  /** Provider name */
  provider: QZPayPaymentProvider;

  /** Event processing status */
  status: 'processing' | 'completed' | 'failed';

  /** When processing started */
  startedAt: Date;

  /** When processing completed */
  completedAt?: Date;

  /** Processing duration in ms */
  durationMs?: number;

  /** Error message if failed */
  error?: string;
}
```

### Storage Schema

```sql
CREATE TABLE billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  payload JSONB NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_webhook_events_status ON billing_webhook_events(status);
CREATE INDEX idx_webhook_events_created ON billing_webhook_events(created_at);
```

### Business Rules

1. Check idempotency BEFORE processing
2. Use database transaction to prevent race conditions
3. If event is "processing" for > 5 minutes, consider it stale and allow retry
4. Store all events for audit trail (90 day retention)
5. Return success for completed duplicates

### Acceptance Criteria

```gherkin
Scenario: First time receiving event
  Given event "evt_abc123" has never been received
  When webhook is processed
  Then record is created with status "processing"
  And event is processed
  And record is updated to status "completed"

Scenario: Duplicate event received
  Given event "evt_abc123" was already processed successfully
  When same webhook is received again
  Then idempotency check finds existing record
  And response 200 is returned immediately
  And no reprocessing occurs

Scenario: Event stuck in processing
  Given event "evt_abc123" has status "processing"
  And started_at was 10 minutes ago
  When same webhook is received
  Then stale lock is cleared
  And event is reprocessed

Scenario: Concurrent webhook delivery
  Given event "evt_abc123" is received simultaneously on 2 servers
  When both try to process
  Then only one succeeds (database constraint)
  And the other returns 200 without processing
```

---

## FR-WEBHOOK-004: Handle Failed Webhooks

**Priority**: High

**Description**: Gracefully handle webhook processing failures with retry logic.

### Failure Categories

| Category | Action | Retry |
|----------|--------|-------|
| Invalid signature | Reject with 401 | No |
| Invalid payload | Reject with 400 | No |
| Unknown event type | Log and return 200 | No |
| Processing error | Return 500 | Yes (by provider) |
| Database error | Return 500 | Yes |
| Timeout | Return 500 | Yes |

### Retry Behavior (Provider-side)

**Stripe Retry Schedule**:
- Retries up to 3 days
- Exponential backoff: 1h, 5h, 24h, 48h

**MercadoPago Retry Schedule**:
- Retries for 48 hours
- Intervals: 5min, 45min, 6h, 24h, 48h

### Business Rules

1. Return 500 only for transient failures (will trigger provider retry)
2. Return 200 for permanent failures (log and alert, no retry)
3. Log all failures with full context for debugging
4. Alert on repeated failures for same event type
5. Move to DLQ after max retries

### Acceptance Criteria

```gherkin
Scenario: Transient database error
  Given webhook processing encounters database connection error
  When error is detected
  Then error is logged with full context
  And response 500 is returned
  And provider will retry

Scenario: Unknown event type
  Given webhook has event type "unknown.event.type"
  When webhook is received
  Then event is logged as "unhandled"
  And response 200 is returned
  And no error is raised

Scenario: Business logic error
  Given webhook processing throws validation error
  When error is caught
  Then error is logged
  And event is moved to DLQ
  And response 200 is returned (no retry)
  And alert is triggered
```

---

## FR-WEBHOOK-005: Dead Letter Queue

**Priority**: High

**Description**: Store failed webhooks for manual review and reprocessing.

### DLQ Schema

```sql
CREATE TABLE billing_webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_dlq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_dlq_unresolved ON billing_webhook_dlq(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_dlq_created ON billing_webhook_dlq(created_at);
```

### DLQ Operations

```typescript
interface DLQOperations {
  /** Add failed event to DLQ */
  add(event: FailedWebhookEvent): Promise<void>;

  /** Get unresolved events */
  getUnresolved(options?: { limit?: number; offset?: number }): Promise<DLQEntry[]>;

  /** Retry a specific event */
  retry(id: string): Promise<{ success: boolean; error?: string }>;

  /** Retry all unresolved events */
  retryAll(): Promise<{ succeeded: number; failed: number }>;

  /** Mark event as resolved */
  resolve(id: string, options: { notes?: string; resolvedBy: string }): Promise<void>;
}
```

### Business Rules

1. Events move to DLQ after 3 failed processing attempts
2. DLQ events are retained for 30 days
3. Admin can manually retry or resolve DLQ events
4. Alert when DLQ size exceeds 10 events
5. Daily report of DLQ status

### Acceptance Criteria

```gherkin
Scenario: Move to DLQ after failures
  Given webhook processing has failed 3 times
  When 4th attempt fails
  Then event is moved to DLQ
  And original event record is updated
  And alert is triggered

Scenario: Admin retries DLQ event
  Given an event in DLQ with id "dlq_123"
  When admin triggers retry
  Then event is reprocessed
  And if successful, marked as resolved
  And if failed, attempts counter increments

Scenario: Admin resolves without retry
  Given an event in DLQ that cannot be fixed
  When admin marks as resolved with notes
  Then resolved_at is set
  And resolution_notes are stored
  And event is no longer in "unresolved" list
```

---

## Event Mapping Reference

### Stripe Events

| Stripe Event | QZPay Event | Action |
|--------------|-------------|--------|
| `customer.created` | `CUSTOMER_SYNCED` | Update provider customer ID |
| `customer.updated` | `CUSTOMER_UPDATED` | Sync customer data |
| `customer.deleted` | `CUSTOMER_DELETED` | Mark customer as deleted |
| `customer.subscription.created` | `SUBSCRIPTION_CREATED` | Create/update subscription |
| `customer.subscription.updated` | `SUBSCRIPTION_UPDATED` | Update subscription status |
| `customer.subscription.deleted` | `SUBSCRIPTION_CANCELED` | Cancel subscription |
| `customer.subscription.trial_will_end` | `TRIAL_EXPIRING` | Send trial reminder |
| `invoice.created` | `INVOICE_CREATED` | Create invoice record |
| `invoice.finalized` | `INVOICE_FINALIZED` | Finalize invoice |
| `invoice.paid` | `INVOICE_PAID` | Mark invoice as paid |
| `invoice.payment_failed` | `PAYMENT_FAILED` | Handle payment failure |
| `invoice.payment_succeeded` | `PAYMENT_SUCCEEDED` | Record payment success |
| `payment_intent.succeeded` | `PAYMENT_SUCCEEDED` | Record one-time payment |
| `payment_intent.payment_failed` | `PAYMENT_FAILED` | Handle payment failure |
| `charge.refunded` | `REFUND_PROCESSED` | Record refund |
| `payment_method.attached` | `PAYMENT_METHOD_ADDED` | Record new payment method |
| `payment_method.detached` | `PAYMENT_METHOD_REMOVED` | Remove payment method |

### MercadoPago Events

| MercadoPago Event | QZPay Event | Action |
|-------------------|-------------|--------|
| `payment.created` | `PAYMENT_CREATED` | Create payment record |
| `payment.updated` | `PAYMENT_UPDATED` | Update payment status |
| `subscription_preapproval.created` | `SUBSCRIPTION_CREATED` | Create subscription |
| `subscription_preapproval.updated` | `SUBSCRIPTION_UPDATED` | Update subscription |

### Event Processing Flow

```
┌─────────────────┐
│  Webhook Received │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Signature │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Idempotency │
└────────┬────────┘
         │ (new event)
         ▼
┌─────────────────┐
│ Parse Event Type │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute Handler │──────────┐
└────────┬────────┘         │ (failure)
         │ (success)         ▼
         ▼              ┌────────────┐
┌─────────────────┐    │ Move to DLQ │
│ Emit Internal Event │ └────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return 200 OK │
└─────────────────┘
```

---

## User Stories

### US-WEBHOOK-001: Process Provider Webhooks

**As a** system operator
**I want** webhooks from payment providers to be processed reliably
**So that** billing data stays in sync

**Priority**: Critical

**Acceptance Criteria**:
- [ ] Webhooks are received and validated within 500ms
- [ ] Invalid signatures are rejected with 401
- [ ] Duplicate events are handled idempotently
- [ ] Failed events are retried or moved to DLQ
- [ ] All events are logged for audit

### US-WEBHOOK-002: Monitor Webhook Health

**As a** system operator
**I want** to monitor webhook processing health
**So that** I can detect and resolve issues quickly

**Priority**: High

**Acceptance Criteria**:
- [ ] Dashboard shows webhook processing metrics
- [ ] Alerts trigger when error rate exceeds 5%
- [ ] DLQ size is monitored with alerts
- [ ] Processing latency is tracked

### US-WEBHOOK-003: Manually Resolve Failed Webhooks

**As an** administrator
**I want** to review and resolve failed webhooks
**So that** edge cases can be handled manually

**Priority**: Medium

**Acceptance Criteria**:
- [ ] Admin can view DLQ events
- [ ] Admin can retry individual events
- [ ] Admin can mark events as resolved
- [ ] Resolution history is tracked

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Webhook acknowledgment | < 500ms | Time to return HTTP response |
| Event processing | < 2s | Time to complete handler |
| Signature validation | < 10ms | Time for crypto operation |
| Idempotency check | < 50ms | Database lookup time |
| Throughput | 1000 webhooks/min | Sustained processing rate |

---

## Security Requirements

1. **Signature validation is MANDATORY** - Never process unsigned webhooks
2. **Use timing-safe comparison** - Prevent timing attacks on signatures
3. **Validate timestamp** - Prevent replay attacks (5 minute tolerance)
4. **Log security events** - Track all validation failures
5. **Rate limit endpoints** - Prevent DoS attacks
6. **Restrict IP addresses** - Optional: whitelist provider IPs

### Provider IP Ranges

**Stripe**: [Stripe Webhook IPs](https://stripe.com/docs/ips#webhook-notifications)
**MercadoPago**: Configure in MercadoPago dashboard

---

## References

- [Events Reference](../05-api/EVENTS.md)
- [Error Catalog](../05-api/ERROR-CATALOG.md)
- [Security Standards](../.claude/docs/standards/security-standards.md)
- [Resilience Patterns](../03-architecture/RESILIENCE.md)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [MercadoPago Webhooks](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)
