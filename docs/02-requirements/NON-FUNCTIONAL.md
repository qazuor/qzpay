# Non-Functional Requirements

## Overview

This document defines the non-functional requirements (NFRs) for @qazuor/qzpay, covering performance, reliability, security, and quality attributes.

---

## 1. Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| API Response Time | < 200ms | 95th percentile |
| Webhook Processing | < 500ms | Average |
| Checkout Load Time | < 1s | Time to interactive |
| Database Queries | < 50ms | Average query time |

### Performance Guidelines

- Use database indexes on frequently queried columns
- Implement connection pooling for database connections
- Lazy load UI components
- Cache plan and pricing data
- Batch webhook processing where possible

---

## 2. Reliability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% |
| Data Durability | 99.999% |
| Webhook Delivery | At least once |
| Payment Accuracy | 100% |

### Reliability Measures

- Idempotency keys for all payment operations
- Automatic retry with exponential backoff
- Dead letter queue for failed webhooks
- Database transaction isolation
- Comprehensive audit logging

---

## 3. Security

### 3.1 Core Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| PCI Compliance | No card data handled (provider elements) |
| API Authentication | JWT/API key per project |
| Webhook Verification | Signature validation with timing-safe comparison |
| Sensitive Data | AES-256-GCM encryption at rest |
| Audit Logging | All financial operations logged (immutable) |

### 3.2 Authorization Requirements

| Requirement | Implementation |
|-------------|----------------|
| IDOR Protection | Ownership validation on all resource endpoints |
| Input Validation | Zod schemas for all API inputs |
| Admin Routes | Require admin middleware when enabled |
| Resource Isolation | Users can only access their own billing data |

### 3.3 Input Validation Schemas

All public API inputs MUST be validated using Zod schemas:

```typescript
import { z } from 'zod';

const QZPayValidators = {
  // UUID format
  uuid: z.string().uuid(),

  // Currency code (ISO 4217)
  currency: z.string().length(3).toUpperCase(),

  // Amount in cents (positive integer)
  amountCents: z.number().int().positive().max(999999999999),

  // Email
  email: z.string().email().max(255),

  // External ID
  externalId: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),

  // Idempotency key
  idempotencyKey: z.string().min(16).max(255),

  // Metadata object
  metadata: z.record(z.string(), z.unknown()).refine(
    (obj) => JSON.stringify(obj).length <= 65536,
    { message: 'Metadata must be less than 64KB' }
  ),

  // Date (ISO 8601)
  isoDate: z.string().datetime(),

  // Promo code format
  promoCode: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/i),

  // Reason text
  reason: z.string().min(1).max(500),
} as const;
```

### 3.4 Validation Error Response

```typescript
interface QZPayValidationError {
  code: 'VALIDATION_ERROR';
  message: 'Input validation failed';
  details: {
    field: string;      // e.g., "amount", "email"
    code: string;       // e.g., "too_small", "invalid_type"
    message: string;    // Human-readable message
    expected?: string;  // Expected type/format
    received?: string;  // Actual value type
  }[];
}
```

---

## 4. Scalability

| Requirement | Target |
|-------------|--------|
| Concurrent Users | 10,000+ |
| Transactions/Second | 100+ |
| Database Size | 10M+ customers |
| Webhook Throughput | 1,000/minute |

### Scalability Measures

- Horizontal scaling for webhook processing
- Database partitioning for high-volume tables
- Read replicas for reporting queries
- CDN for React component assets

---

## 5. Maintainability

| Requirement | Target |
|-------------|--------|
| Test Coverage | 90%+ for core |
| Documentation | Complete API reference |
| Code Standards | Biome linting, TypeScript strict |
| Dependency Updates | Monthly review |

---

## 6. Compatibility

| Requirement | Support |
|-------------|---------|
| Node.js | 18+ |
| TypeScript | 5.0+ |
| Databases | PostgreSQL 14+, MySQL 8+ |
| Frameworks | Hono, NestJS, Express |
| Payment Providers | Stripe, Mercado Pago |

---

## 7. Observability

| Requirement | Implementation |
|-------------|----------------|
| Structured Logging | JSON format with correlation IDs |
| Metrics | Prometheus-compatible |
| Tracing | OpenTelemetry support |
| Health Checks | Liveness and readiness endpoints |

### Log Levels

| Level | Usage |
|-------|-------|
| ERROR | Payment failures, critical errors |
| WARN | Retry attempts, rate limits |
| INFO | Successful operations, state changes |
| DEBUG | Detailed operation data |

---

## 8. Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Payment Records | 7 years |
| Customer Data | 7 years (or until deletion request) |
| Audit Logs | 7 years |
| Webhook Logs | 90 days |
| Usage Data | 2 years |
| Analytics | 5 years |

---

## 9. Compliance

| Requirement | Implementation |
|-------------|----------------|
| GDPR | Data export, deletion endpoints |
| PCI-DSS | No card data storage |
| SOC 2 | Audit logging, access controls |

---

## NFR Validation Checklist

| Category | Requirement | Validation Method |
|----------|-------------|-------------------|
| Performance | API < 200ms | Load testing |
| Reliability | 99.9% uptime | Monitoring |
| Security | No PCI data | Code review |
| Security | Input validation | Unit tests |
| Scalability | 100 TPS | Load testing |
| Maintainability | 90% coverage | CI pipeline |

---

## Related Documents

- [Functional Requirements](./FUNCTIONAL.md)
- [Security Patterns](../03-architecture/SECURITY.md)
- [Observability](../03-architecture/OBSERVABILITY.md)
