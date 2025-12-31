# Resilience Patterns

## Overview

This document describes the resilience and reliability patterns implemented in @qazuor/qzpay to ensure robust operation in production environments.

---

## 1. Idempotency

All mutating operations support idempotency keys to prevent duplicate processing.

### Implementation

```typescript
export interface IdempotencyRecord {
  key: string;
  entityType: string;
  entityId: string;
  requestHash: string;
  response: unknown;
  createdAt: Date;
  expiresAt: Date;
}

export class QZPayIdempotencyService {
  async checkAndLock(
    key: string,
    entityType: string,
    requestHash: string,
  ): Promise<IdempotencyResult> {
    const existing = await this.storage.idempotencyKeys.findByKey(key);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new QZPayIdempotencyConflictError(
          key,
          'Idempotency key reused with different request parameters',
        );
      }
      return {
        alreadyProcessed: true,
        cachedResponse: existing.response,
      };
    }

    // Lock for processing (with TTL to prevent deadlocks)
    await this.storage.idempotencyKeys.create({
      key,
      entityType,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
    });

    return { alreadyProcessed: false };
  }
}
```

### Usage

```typescript
async create(input: CreateSubscriptionInput): Promise<QZPaySubscription> {
  const idempotencyResult = await this.idempotency.checkAndLock(
    input.idempotencyKey,
    'subscription',
    this.hashRequest(input),
  );

  if (idempotencyResult.alreadyProcessed) {
    return idempotencyResult.cachedResponse as QZPaySubscription;
  }

  try {
    const subscription = await this.doCreate(input);
    await this.idempotency.complete(input.idempotencyKey, subscription.id, subscription);
    return subscription;
  } catch (error) {
    await this.idempotency.release(input.idempotencyKey);
    throw error;
  }
}
```

---

## 2. Transaction Support

### Isolation Levels

Different operations require different isolation levels:

| Operation | Isolation Level | Reason |
|-----------|-----------------|--------|
| `subscription.changePlan()` | SERIALIZABLE | Prevents concurrent plan changes |
| `subscription.cancel()` | SERIALIZABLE | Prevents race with renewal |
| `promoCode.apply()` | REPEATABLE READ | Prevents double redemption |
| `payment.create()` | READ COMMITTED | Idempotency prevents duplicates |
| `payment.refund()` | SERIALIZABLE | Prevents double refunds |
| `invoice.finalize()` | SERIALIZABLE | Prevents line items during finalization |
| `vendor.payout()` | SERIALIZABLE | Prevents double payouts |

### Implementation

```typescript
export const QZPayTransactionIsolation = {
  SERIALIZABLE: 'serializable',
  REPEATABLE_READ: 'repeatable_read',
  READ_COMMITTED: 'read_committed',
} as const;

export interface TransactionOptions {
  isolationLevel?: QZPayTransactionIsolationType;
  timeout?: number;      // Default: 30000ms
  maxRetries?: number;   // Default: 3
}
```

### Deadlock Detection and Retry

```typescript
export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    maxRetries: 3,
    initialDelayMs: 50,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    ...config,
  };

  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw new QZPayTransactionRetryExhaustedError();
}
```

---

## 3. Rollback Scenarios

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Payment provider error | Rollback DB changes | Retry with idempotency key |
| Validation failure | Rollback all changes | Return validation error |
| Serialization failure | Auto-retry up to 3 times | If exhausted, return error |
| Deadlock detected | Auto-retry up to 3 times | If exhausted, return error |
| Timeout exceeded | Rollback and close connection | Return timeout error |
| Network error mid-transaction | Connection closed, changes rollback | Client should retry |

---

## 4. Circuit Breaker

Protects against cascading failures when external services are unavailable.

### States

```typescript
export const QZPayCircuitBreakerState = {
  CLOSED: 'closed',       // Normal operation
  OPEN: 'open',           // Service unavailable, fail fast
  HALF_OPEN: 'half_open', // Testing if service recovered
} as const;
```

### Configuration

```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening (default: 5)
  successThreshold: number;      // Successes to close (default: 3)
  timeout: number;               // Time in OPEN before HALF_OPEN (default: 30000ms)
  resetTimeout: number;          // Time to reset failure count (default: 60000ms)
}
```

### Events

```typescript
// Emitted when circuit state changes
QZPayBillingEvent.CIRCUIT_BREAKER_OPENED
QZPayBillingEvent.CIRCUIT_BREAKER_CLOSED
QZPayBillingEvent.CIRCUIT_BREAKER_HALF_OPEN
```

---

## 5. Retry Strategies

### Payment Retry

```typescript
export interface PaymentRetryConfig {
  maxAttempts: number;           // Default: 4
  intervals: number[];           // Days between retries: [1, 3, 5]
  gracePeriodDays: number;       // Access during retries: 7
}
```

### Webhook Retry

```typescript
export interface WebhookRetryConfig {
  maxAttempts: number;           // Default: 5
  initialDelayMs: number;        // Default: 1000
  maxDelayMs: number;            // Default: 300000 (5 min)
  backoffMultiplier: number;     // Default: 2
}
```

### Exponential Backoff

```
Attempt 1: 1 second
Attempt 2: 2 seconds
Attempt 3: 4 seconds
Attempt 4: 8 seconds
Attempt 5: 16 seconds (capped at max)
```

---

## 6. Dead Letter Queue

Failed webhook events are stored for later processing:

```typescript
export interface DeadLetterEntry {
  id: string;
  provider: string;
  eventType: string;
  payload: unknown;
  error: string;
  attempts: number;
  createdAt: Date;
  lastAttemptAt: Date;
}
```

### Processing

```bash
# Via CLI
npx @qazuor/qzpay-cli webhooks:retry-dlq --limit 100

# Via API
await billing.webhooks.retryDeadLetterQueue({ limit: 100 });
```

---

## 7. Graceful Degradation

### Provider Fallback

If primary provider fails, operations can fall back:

```typescript
// If Stripe is down, queue for later processing
if (circuitBreaker.isOpen('stripe')) {
  await billing.queue.enqueue('payment', paymentData);
  return { status: 'queued', message: 'Payment will be processed shortly' };
}
```

### Read Replicas

For high-traffic read operations:

```typescript
// Metrics queries can use read replica
const metrics = await billing.metrics.getRevenue({
  useReadReplica: true,
});
```

---

## Related Documents

- [Architecture Overview](./OVERVIEW.md)
- [Security](./SECURITY.md)
- [Observability](./OBSERVABILITY.md)
