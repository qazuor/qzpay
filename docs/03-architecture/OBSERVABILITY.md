# Observability & Monitoring

## Overview

This document defines the observability requirements for @qazuor/qzpay. Proper monitoring is essential for production reliability, debugging, and business insights.

---

## 1. Metrics

All implementations MUST expose the following metrics. Metric names follow Prometheus conventions.

### Payment Metrics

```
# Counters
qzpay_payments_total { provider, status, currency }
qzpay_refunds_total { provider, reason }
qzpay_subscriptions_created_total { plan, has_trial }
qzpay_subscriptions_canceled_total { plan, reason }
qzpay_subscriptions_renewed_total { plan }
qzpay_invoices_created_total { status }
qzpay_webhooks_received_total { provider, event_type }
qzpay_webhooks_processed_total { provider, event_type, status }
qzpay_promo_codes_redeemed_total { code_type }

# Histograms (latency)
qzpay_payment_duration_seconds { provider }
qzpay_webhook_processing_duration_seconds { provider, event_type }
qzpay_invoice_generation_duration_seconds
qzpay_database_query_duration_seconds { operation }
qzpay_provider_api_duration_seconds { provider, operation }

# Gauges (current state)
qzpay_active_subscriptions { plan, status }
qzpay_pending_invoices_total
qzpay_failed_payments_pending_retry
qzpay_webhook_dead_letter_queue_size
qzpay_circuit_breaker_state { provider }  # 0=closed, 1=open, 2=half-open
```

### Business Metrics

```
qzpay_revenue_total { currency, plan }      # Counter, amount in cents
qzpay_mrr_current { currency }              # Gauge, Monthly Recurring Revenue
qzpay_arr_current { currency }              # Gauge, Annual Recurring Revenue
qzpay_churn_rate_percent                    # Gauge, calculated monthly
qzpay_trial_conversion_rate_percent         # Gauge, trials → paid
qzpay_average_revenue_per_user { currency } # Gauge
```

### Configuration

```typescript
export interface QZPayMetricsConfig {
  prefix: string; // Default: 'qzpay'
  labels: {
    provider: boolean;   // Include payment provider label
    plan: boolean;       // Include plan label
    currency: boolean;   // Include currency label
    tenant: boolean;     // Include tenant label (multi-tenant)
  };
}
```

---

## 2. Logging

All financial operations MUST be logged with structured JSON format.

### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| `error` | Failures requiring attention | Payment failed, webhook signature invalid |
| `warn` | Potential issues | Retry scheduled, circuit breaker opened |
| `info` | Business events | Subscription created, invoice paid |
| `debug` | Debugging info | Query executed, cache hit/miss |

### Required Log Fields

```typescript
export interface QZPayLogEntry {
  // Required fields
  timestamp: string;          // ISO 8601
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service: 'qzpay';
  version: string;            // Package version

  // Context (when available)
  tenantId?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentId?: string;
  requestId?: string;         // Correlation ID
  userId?: string;            // Acting user

  // Operation info
  operation?: string;         // e.g., 'subscription.create'
  provider?: string;          // e.g., 'stripe'
  duration_ms?: number;

  // Error info (when level=error)
  error?: {
    code: string;
    message: string;
    stack?: string;
  };

  // Additional context
  metadata?: Record<string, unknown>;
}
```

### Log Examples

```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "message": "Payment succeeded",
  "service": "qzpay",
  "version": "1.0.0",
  "customerId": "cust_456",
  "paymentId": "pay_789",
  "operation": "payment.process",
  "provider": "stripe",
  "duration_ms": 1234,
  "metadata": {
    "amount": 9900,
    "currency": "USD"
  }
}
```

```json
{
  "timestamp": "2025-01-15T10:31:00.456Z",
  "level": "error",
  "message": "Webhook processing failed",
  "service": "qzpay",
  "version": "1.0.0",
  "operation": "webhook.process",
  "provider": "stripe",
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Connection refused"
  }
}
```

---

## 3. Health Checks

All deployments MUST expose health check endpoints.

### Response Structure

```typescript
export interface QZPayHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheckResult;
    stripe?: HealthCheckResult;
    mercadopago?: HealthCheckResult;
    redis?: HealthCheckResult;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  message?: string;
  lastChecked: string;
}
```

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Full health check with dependencies |
| `GET /health/live` | Liveness probe (is process running) |
| `GET /health/ready` | Readiness probe (can accept traffic) |

### Example Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 5,
      "lastChecked": "2025-01-15T10:29:55Z"
    },
    "stripe": {
      "status": "healthy",
      "latency_ms": 120,
      "lastChecked": "2025-01-15T10:29:50Z"
    }
  }
}
```

---

## 4. Tracing

Support for distributed tracing using OpenTelemetry.

### Trace Context

```typescript
export interface QZPayTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}
```

### Instrumented Operations

| Operation | Span Name |
|-----------|-----------|
| API request | `qzpay.http.request` |
| Database query | `qzpay.db.query` |
| Provider API call | `qzpay.provider.{name}` |
| Webhook processing | `qzpay.webhook.process` |
| Job execution | `qzpay.job.{name}` |

---

## 5. Alerts

### Recommended Alert Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| High payment failure rate | failures > 10% in 5 min | Critical |
| Circuit breaker open | state = open | Warning |
| Webhook DLQ growing | size > 100 | Warning |
| High latency | p95 > 2s | Warning |
| Database connection errors | errors > 5 in 1 min | Critical |
| Provider unavailable | health check failed | Critical |

### PagerDuty/Slack Integration

```typescript
billing.on(QZPayBillingEvent.CIRCUIT_BREAKER_OPENED, async (event) => {
  await pagerduty.trigger({
    severity: 'warning',
    summary: `Circuit breaker opened for ${event.data.provider}`,
  });
});
```

---

## 6. Dashboards

### Recommended Grafana Panels

1. **Payment Health**
   - Success rate over time
   - Payment volume by provider
   - Average transaction value

2. **Subscription Metrics**
   - Active subscriptions by plan
   - Churn rate
   - Trial conversion rate

3. **Revenue**
   - MRR/ARR trends
   - Revenue by plan
   - Refund rate

4. **System Health**
   - API latency percentiles
   - Error rate
   - Circuit breaker states
   - DLQ size

---

## Related Documents

- [Architecture Overview](./OVERVIEW.md)
- [Resilience](./RESILIENCE.md)
- [Non-Functional Requirements](../02-requirements/NON-FUNCTIONAL.md)
