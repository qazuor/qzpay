# Testing Requirements

## Overview

This document defines comprehensive testing requirements for QZPay, including test strategy, coverage targets, test categories, and specific test scenarios for critical functionality.

**Coverage Target**: 90% across all metrics (lines, functions, branches, statements)

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Categories](#test-categories)
3. [Unit Test Requirements](#unit-test-requirements)
4. [Integration Test Requirements](#integration-test-requirements)
5. [End-to-End Test Requirements](#end-to-end-test-requirements)
6. [Security Test Requirements](#security-test-requirements)
7. [Performance Test Requirements](#performance-test-requirements)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration](#continuous-integration)

---

## Testing Strategy

### Testing Pyramid

```
        /\
       /E2E\        (~10%) - Critical user journeys
      /------\
     /  INT   \     (~20%) - API and integration tests
    /----------\
   /    UNIT    \   (~70%) - Business logic, utilities
  /______________\
```

### Test Principles

1. **Isolation**: Tests must be independent and not share state
2. **Determinism**: Same inputs produce same outputs every time
3. **Speed**: Unit tests < 100ms, Integration < 5s, E2E < 30s
4. **Clarity**: Test names describe scenario and expected outcome
5. **Coverage**: All critical paths tested, edge cases documented

### Testing Framework

| Category | Tool | Purpose |
|----------|------|---------|
| Unit Tests | Vitest | Fast unit testing with TypeScript |
| Integration | Vitest | API testing with mocked providers |
| E2E | Playwright | Full user journey testing |
| Mocking | MSW | HTTP request interception |
| Fixtures | @faker-js/faker | Test data generation |
| Coverage | v8 | Code coverage reporting |

---

## Test Categories

### TR-CAT-001: Unit Tests

**Purpose**: Test individual functions and classes in isolation

**Coverage Requirements**:
- All public functions must have tests
- All error paths must be tested
- All branch conditions must be covered

**Naming Convention**:
```typescript
describe('FunctionName', () => {
  it('should [expected behavior] when [condition]', () => {});
});

// Examples:
describe('calculateProration', () => {
  it('should return full amount when subscription starts on billing date', () => {});
  it('should return half amount when mid-cycle', () => {});
  it('should throw when dates are invalid', () => {});
});
```

### TR-CAT-002: Integration Tests

**Purpose**: Test interactions between components and external services

**Coverage Requirements**:
- All API endpoints must have integration tests
- All adapter methods must be tested with mocked providers
- All database operations must be tested

### TR-CAT-003: End-to-End Tests

**Purpose**: Test complete user journeys through the system

**Coverage Requirements**:
- All critical user flows must be tested
- Happy path and primary error scenarios
- Cross-browser testing for React components

### TR-CAT-004: Security Tests

**Purpose**: Verify security controls and identify vulnerabilities

**Coverage Requirements**:
- Authentication and authorization
- Input validation
- Injection prevention
- Data protection

### TR-CAT-005: Performance Tests

**Purpose**: Verify system meets performance requirements

**Coverage Requirements**:
- Response time under load
- Concurrent user handling
- Resource utilization

---

## Unit Test Requirements

### TR-UNIT-001: Customer Module Tests

```typescript
// test/unit/customers.test.ts

describe('Customer Module', () => {
  describe('createCustomer', () => {
    it('should create customer with valid email and externalId', async () => {});
    it('should reject duplicate externalId', async () => {});
    it('should reject invalid email format', async () => {});
    it('should store optional name and phone', async () => {});
    it('should initialize empty providerCustomerIds', async () => {});
    it('should set createdAt and updatedAt timestamps', async () => {});
  });

  describe('getCustomerByExternalId', () => {
    it('should return customer when exists', async () => {});
    it('should return null when not found', async () => {});
    it('should not return soft-deleted customers', async () => {});
  });

  describe('updateCustomer', () => {
    it('should update allowed fields', async () => {});
    it('should merge metadata non-destructively', async () => {});
    it('should update updatedAt timestamp', async () => {});
    it('should reject update on deleted customer', async () => {});
  });

  describe('deleteCustomer', () => {
    it('should soft delete by setting deletedAt', async () => {});
    it('should preserve historical records', async () => {});
    it('should prevent future subscriptions', async () => {});
  });
});
```

### TR-UNIT-002: Subscription Module Tests

```typescript
// test/unit/subscriptions.test.ts

describe('Subscription Module', () => {
  describe('createSubscription', () => {
    it('should create subscription with valid customer and plan', async () => {});
    it('should reject non-existent customer', async () => {});
    it('should reject non-existent plan', async () => {});
    it('should set initial status to "incomplete" without payment', async () => {});
    it('should set status to "active" after successful payment', async () => {});
    it('should set status to "trialing" when trial configured', async () => {});
  });

  describe('hasAccess', () => {
    it('should return true for "active" status', () => {});
    it('should return true for "trialing" status', () => {});
    it('should return true for "past_due" within grace period', () => {});
    it('should return false for "past_due" after grace period', () => {});
    it('should return false for "canceled" status', () => {});
    it('should return false for "expired" status', () => {});
    it('should return false for "paused" status', () => {});
  });

  describe('cancelSubscription', () => {
    it('should set cancelAtPeriodEnd when immediate=false', async () => {});
    it('should cancel immediately when immediate=true', async () => {});
    it('should issue prorated refund when specified', async () => {});
    it('should send cancellation email', async () => {});
    it('should reject cancellation of already canceled subscription', async () => {});
  });

  describe('changePlan', () => {
    it('should upgrade with proration charge', async () => {});
    it('should downgrade at period end by default', async () => {});
    it('should downgrade immediately with credit when specified', async () => {});
    it('should reject downgrade when usage exceeds new plan limits', async () => {});
    it('should preserve subscription metadata', async () => {});
  });
});
```

### TR-UNIT-003: Payment Module Tests

```typescript
// test/unit/payments.test.ts

describe('Payment Module', () => {
  describe('processPayment', () => {
    it('should process payment with valid payment method', async () => {});
    it('should reject when payment method is invalid', async () => {});
    it('should update payment status on success', async () => {});
    it('should record failure reason on decline', async () => {});
    it('should respect idempotency key', async () => {});
  });

  describe('refundPayment', () => {
    it('should process full refund', async () => {});
    it('should process partial refund', async () => {});
    it('should reject refund exceeding original amount', async () => {});
    it('should reject refund on already refunded payment', async () => {});
    it('should update payment refunded amount', async () => {});
  });

  describe('retryPayment', () => {
    it('should attempt retry on failed payment', async () => {});
    it('should increment retry count', async () => {});
    it('should stop after max retries', async () => {});
    it('should update subscription status on success', async () => {});
  });
});
```

### TR-UNIT-004: Proration Calculator Tests

```typescript
// test/unit/proration.test.ts

describe('Proration Calculator', () => {
  describe('calculateUpgradeProration', () => {
    it('should calculate correct amount for mid-cycle upgrade', () => {
      // Day 15 of 30-day cycle
      // Old plan: $30/month, New plan: $50/month
      // Expected: ($50 - $30) * (15/30) = $10
    });

    it('should calculate zero proration on billing date', () => {});
    it('should handle annual billing correctly', () => {});
    it('should round to nearest cent', () => {});
  });

  describe('calculateDowngradeCredit', () => {
    it('should calculate correct credit for mid-cycle downgrade', () => {
      // Day 10 of 30-day cycle
      // Old plan: $50/month, New plan: $30/month
      // Remaining days: 20
      // Expected credit: ($50 - $30) * (20/30) = $13.33
    });

    it('should not issue credit when downgrade at period end', () => {});
  });

  describe('calculateCancellationRefund', () => {
    it('should calculate prorated refund for immediate cancellation', () => {});
    it('should return zero for cancel at period end', () => {});
    it('should not refund setup fees', () => {});
  });
});
```

### TR-UNIT-005: Entitlements and Limits Tests

```typescript
// test/unit/entitlements.test.ts

describe('Entitlements', () => {
  describe('hasFeature', () => {
    it('should return true when feature in plan', () => {});
    it('should return true when feature from add-on', () => {});
    it('should return false when feature not available', () => {});
    it('should respect feature overrides', () => {});
  });

  describe('getLimit', () => {
    it('should return plan limit', () => {});
    it('should add add-on limits', () => {});
    it('should respect limit overrides', () => {});
    it('should return Infinity for unlimited', () => {});
  });

  describe('checkUsage', () => {
    it('should return true when under limit', () => {});
    it('should return false when at limit', () => {});
    it('should handle soft limits with overage', () => {});
  });
});
```

### TR-UNIT-006: Webhook Processor Tests

```typescript
// test/unit/webhooks.test.ts

describe('Webhook Processor', () => {
  describe('verifySignature', () => {
    it('should accept valid Stripe signature', () => {});
    it('should accept valid MercadoPago signature', () => {});
    it('should reject invalid signature', () => {});
    it('should reject expired timestamp', () => {});
  });

  describe('processEvent', () => {
    it('should handle payment_intent.succeeded', async () => {});
    it('should handle payment_intent.failed', async () => {});
    it('should handle customer.subscription.updated', async () => {});
    it('should handle customer.subscription.deleted', async () => {});
    it('should be idempotent for duplicate events', async () => {});
  });

  describe('handleIdempotency', () => {
    it('should return cached response for duplicate event', async () => {});
    it('should process first occurrence', async () => {});
    it('should handle concurrent duplicate events', async () => {});
  });
});
```

### TR-UNIT-007: Error Handling Tests

```typescript
// test/unit/errors.test.ts

describe('Error Handling', () => {
  describe('QZPayError', () => {
    it('should include error code', () => {});
    it('should include user-friendly message', () => {});
    it('should include developer details', () => {});
    it('should include request ID', () => {});
    it('should be serializable to JSON', () => {});
  });

  describe('ValidationError', () => {
    it('should list all validation failures', () => {});
    it('should include field names', () => {});
  });

  describe('ProviderError', () => {
    it('should include original provider error', () => {});
    it('should map provider codes to QZPay codes', () => {});
  });
});
```

---

## Integration Test Requirements

### TR-INT-001: Customer API Tests

```typescript
// test/integration/api/customers.test.ts

describe('Customer API', () => {
  describe('POST /customers', () => {
    it('should create customer and return 201', async () => {});
    it('should return 400 for invalid email', async () => {});
    it('should return 409 for duplicate externalId', async () => {});
  });

  describe('GET /customers/:id', () => {
    it('should return customer details', async () => {});
    it('should return 404 for non-existent customer', async () => {});
  });

  describe('PATCH /customers/:id', () => {
    it('should update customer and return 200', async () => {});
    it('should return 400 for invalid updates', async () => {});
  });

  describe('DELETE /customers/:id', () => {
    it('should soft delete and return 204', async () => {});
    it('should return 404 for non-existent customer', async () => {});
  });
});
```

### TR-INT-002: Subscription API Tests

```typescript
// test/integration/api/subscriptions.test.ts

describe('Subscription API', () => {
  describe('POST /subscriptions', () => {
    it('should create subscription with payment', async () => {});
    it('should create trial subscription', async () => {});
    it('should return 400 for invalid plan', async () => {});
  });

  describe('POST /subscriptions/:id/cancel', () => {
    it('should cancel at period end', async () => {});
    it('should cancel immediately with refund', async () => {});
  });

  describe('POST /subscriptions/:id/change-plan', () => {
    it('should upgrade with proration', async () => {});
    it('should schedule downgrade', async () => {});
  });
});
```

### TR-INT-003: Payment Adapter Tests

```typescript
// test/integration/adapters/stripe.test.ts

describe('Stripe Adapter', () => {
  describe('createCustomer', () => {
    it('should create Stripe customer with email', async () => {});
    it('should handle Stripe API errors', async () => {});
  });

  describe('createSubscription', () => {
    it('should create Stripe subscription', async () => {});
    it('should handle trial period', async () => {});
    it('should apply coupon', async () => {});
  });

  describe('processPayment', () => {
    it('should charge payment method', async () => {});
    it('should handle declined cards', async () => {});
    it('should handle insufficient funds', async () => {});
  });

  describe('processRefund', () => {
    it('should refund charge', async () => {});
    it('should handle partial refund', async () => {});
  });
});

// test/integration/adapters/mercadopago.test.ts

describe('MercadoPago Adapter', () => {
  describe('createPayment', () => {
    it('should create PIX payment', async () => {});
    it('should create boleto payment', async () => {});
    it('should handle card payment', async () => {});
  });

  describe('processWebhook', () => {
    it('should verify webhook signature', async () => {});
    it('should handle payment notification', async () => {});
  });
});
```

### TR-INT-004: Webhook Processing Tests

```typescript
// test/integration/webhooks.test.ts

describe('Webhook Processing', () => {
  describe('Stripe Webhooks', () => {
    it('should process invoice.paid', async () => {});
    it('should process invoice.payment_failed', async () => {});
    it('should process customer.subscription.updated', async () => {});
    it('should reject invalid signature', async () => {});
  });

  describe('MercadoPago Webhooks', () => {
    it('should process payment approved', async () => {});
    it('should process payment rejected', async () => {});
  });

  describe('Retry Mechanism', () => {
    it('should retry on 5xx response', async () => {});
    it('should not retry on 4xx response', async () => {});
    it('should move to DLQ after max retries', async () => {});
  });
});
```

### TR-INT-005: Database Operations Tests

```typescript
// test/integration/database.test.ts

describe('Database Operations', () => {
  describe('Transactions', () => {
    it('should rollback on error', async () => {});
    it('should commit on success', async () => {});
  });

  describe('Migrations', () => {
    it('should apply migrations in order', async () => {});
    it('should rollback migrations', async () => {});
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent subscription updates', async () => {});
    it('should prevent double-charging with locks', async () => {});
  });
});
```

---

## End-to-End Test Requirements

### TR-E2E-001: Subscription Journey Tests

```typescript
// test/e2e/subscription-journey.test.ts

describe('Subscription Journey', () => {
  it('should complete full subscription lifecycle', async () => {
    // 1. Create customer
    // 2. Subscribe to plan
    // 3. Verify active status
    // 4. Upgrade plan
    // 5. Verify new entitlements
    // 6. Cancel subscription
    // 7. Verify cancelled
  });

  it('should handle trial to paid conversion', async () => {
    // 1. Start trial without card
    // 2. Add payment method
    // 3. Wait for trial end
    // 4. Verify paid subscription
  });

  it('should handle failed payment recovery', async () => {
    // 1. Create subscription
    // 2. Simulate payment failure
    // 3. Verify grace period access
    // 4. Update payment method
    // 5. Verify recovered subscription
  });
});
```

### TR-E2E-002: Checkout Flow Tests

```typescript
// test/e2e/checkout.test.ts

describe('Checkout Flow', () => {
  it('should complete checkout with card', async () => {
    // 1. Select plan
    // 2. Enter payment details
    // 3. Apply promo code
    // 4. Complete payment
    // 5. Verify subscription created
  });

  it('should handle declined card gracefully', async () => {
    // 1. Attempt checkout
    // 2. Card declined
    // 3. Show error message
    // 4. Allow retry with different card
  });
});
```

### TR-E2E-003: Admin Operations Tests

```typescript
// test/e2e/admin.test.ts

describe('Admin Operations', () => {
  it('should process refund through admin', async () => {
    // 1. Login as admin
    // 2. Find customer payment
    // 3. Process refund
    // 4. Verify refund completed
    // 5. Verify audit log
  });

  it('should extend subscription through admin', async () => {
    // 1. Login as admin
    // 2. Find subscription
    // 3. Extend by 7 days
    // 4. Verify new end date
  });
});
```

---

## Security Test Requirements

### TR-SEC-001: Authentication Tests

```typescript
// test/security/authentication.test.ts

describe('Authentication Security', () => {
  describe('API Key Authentication', () => {
    it('should reject request without API key', async () => {
      const response = await api.get('/customers');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('MISSING_API_KEY');
    });

    it('should reject invalid API key', async () => {
      const response = await api.get('/customers', {
        headers: { 'X-API-Key': 'invalid_key' }
      });
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    it('should reject expired API key', async () => {});
    it('should reject revoked API key', async () => {});

    it('should log failed authentication attempts', async () => {
      await api.get('/customers', {
        headers: { 'X-API-Key': 'invalid_key' }
      });
      const logs = await getSecurityLogs();
      expect(logs).toContainEqual(
        expect.objectContaining({
          type: 'auth_failure',
          reason: 'invalid_api_key'
        })
      );
    });
  });

  describe('Admin Authentication', () => {
    it('should reject regular API key on admin endpoints', async () => {
      const response = await api.get('/admin/customers', {
        headers: { 'X-API-Key': regularApiKey }
      });
      expect(response.status).toBe(403);
    });

    it('should require admin:read for read operations', async () => {});
    it('should require admin:write for write operations', async () => {});
    it('should require admin:super for delete operations', async () => {});
  });
});
```

### TR-SEC-002: Authorization Tests

```typescript
// test/security/authorization.test.ts

describe('Authorization Security', () => {
  describe('Resource Ownership', () => {
    it('should prevent customer A from accessing customer B data', async () => {
      const customerA = await createTestCustomer();
      const customerB = await createTestCustomer();

      // Try to access customerB's subscription with customerA's token
      const response = await api.get(
        `/subscriptions/${customerB.subscriptionId}`,
        { headers: { 'X-Customer-Token': customerA.token } }
      );
      expect(response.status).toBe(403);
    });

    it('should prevent accessing other customer payments', async () => {});
    it('should prevent accessing other customer invoices', async () => {});
  });

  describe('Role-Based Access', () => {
    it('should enforce admin:read for reports', async () => {});
    it('should enforce admin:write for refunds', async () => {});
    it('should enforce admin:super for hard deletes', async () => {});
  });

  describe('Webhook Verification', () => {
    it('should reject webhook with invalid signature', async () => {
      const response = await api.post('/webhooks/stripe', {
        body: webhookPayload,
        headers: { 'Stripe-Signature': 'invalid' }
      });
      expect(response.status).toBe(401);
    });

    it('should reject webhook with expired timestamp', async () => {});
    it('should reject replayed webhooks', async () => {});
  });
});
```

### TR-SEC-003: Input Validation Tests

```typescript
// test/security/input-validation.test.ts

describe('Input Validation Security', () => {
  describe('SQL Injection Prevention', () => {
    it('should sanitize customer email input', async () => {
      const response = await api.post('/customers', {
        body: {
          externalId: 'user_123',
          email: "test@example.com'; DROP TABLE customers;--"
        }
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_EMAIL_FORMAT');
    });

    it('should sanitize search queries', async () => {
      const response = await api.get('/customers', {
        query: { search: "'; DELETE FROM customers;--" }
      });
      // Should not cause error, just return no results
      expect(response.status).toBe(200);
    });

    it('should use parameterized queries', async () => {
      // Verify by checking query logs that params are used
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in customer name', async () => {
      const customer = await api.post('/customers', {
        body: {
          externalId: 'user_123',
          email: 'test@example.com',
          name: '<script>alert("xss")</script>'
        }
      });
      expect(customer.body.name).not.toContain('<script>');
    });

    it('should escape HTML in metadata values', async () => {});
  });

  describe('Command Injection Prevention', () => {
    it('should sanitize file paths', async () => {
      const response = await api.get('/invoices/download', {
        query: { filename: '../../../etc/passwd' }
      });
      expect(response.status).toBe(400);
    });
  });

  describe('Data Validation', () => {
    it('should reject negative payment amounts', async () => {
      const response = await api.post('/payments', {
        body: { amount: -100, currency: 'USD' }
      });
      expect(response.status).toBe(400);
    });

    it('should reject invalid currency codes', async () => {});
    it('should reject future dates for historical queries', async () => {});
    it('should limit string lengths', async () => {});
  });
});
```

### TR-SEC-004: Data Protection Tests

```typescript
// test/security/data-protection.test.ts

describe('Data Protection Security', () => {
  describe('PCI Compliance', () => {
    it('should never log full card numbers', async () => {
      await api.post('/payment-methods', {
        body: { cardNumber: '4242424242424242', ... }
      });

      const logs = await getAllLogs();
      for (const log of logs) {
        expect(log).not.toContain('4242424242424242');
      }
    });

    it('should only store card tokens', async () => {
      const db = await getDatabase();
      const paymentMethods = await db.query('SELECT * FROM payment_methods');
      for (const pm of paymentMethods) {
        expect(pm).not.toHaveProperty('cardNumber');
        expect(pm).toHaveProperty('providerToken');
      }
    });

    it('should mask card numbers in responses', async () => {
      const response = await api.get('/payment-methods');
      for (const pm of response.body) {
        expect(pm.last4).toHaveLength(4);
        expect(pm).not.toHaveProperty('fullNumber');
      }
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt sensitive data at rest', async () => {});
    it('should use TLS for all external communications', async () => {});
  });

  describe('Data Retention', () => {
    it('should hard delete PII after retention period', async () => {});
    it('should retain anonymized transaction records', async () => {});
  });

  describe('GDPR Compliance', () => {
    it('should export all customer data on request', async () => {
      const exportData = await api.post('/customers/:id/export');
      expect(exportData.body).toHaveProperty('personalData');
      expect(exportData.body).toHaveProperty('subscriptions');
      expect(exportData.body).toHaveProperty('payments');
      expect(exportData.body).toHaveProperty('invoices');
    });

    it('should anonymize data on deletion request', async () => {
      await api.delete('/customers/:id?gdpr=true');
      const customer = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
      expect(customer.email).toBe('anonymized@deleted.local');
      expect(customer.name).toBeNull();
    });
  });
});
```

### TR-SEC-005: Rate Limiting Tests

```typescript
// test/security/rate-limiting.test.ts

describe('Rate Limiting', () => {
  it('should limit API requests per minute', async () => {
    const requests = Array(150).fill(null).map(() =>
      api.get('/customers')
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should return Retry-After header when limited', async () => {
    // Exhaust rate limit
    // Check for Retry-After header
  });

  it('should have separate limits for different endpoints', async () => {
    // Admin endpoints should have different limits
  });

  it('should limit webhook retries', async () => {});
});
```

### TR-SEC-006: Session Security Tests

```typescript
// test/security/session.test.ts

describe('Session Security', () => {
  it('should expire session after timeout', async () => {});
  it('should invalidate session on logout', async () => {});
  it('should prevent session fixation', async () => {});
  it('should rotate session tokens', async () => {});
});
```

---

## Performance Test Requirements

### TR-PERF-001: Response Time Tests

```typescript
// test/performance/response-time.test.ts

describe('Response Time', () => {
  it('should return customer list within 200ms', async () => {
    const start = Date.now();
    await api.get('/customers?limit=100');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('should create subscription within 500ms', async () => {});
  it('should process payment within 2000ms', async () => {});
  it('should generate invoice within 1000ms', async () => {});
});
```

### TR-PERF-002: Load Tests

```typescript
// test/performance/load.test.ts

describe('Load Testing', () => {
  it('should handle 100 concurrent subscription creates', async () => {
    const results = await Promise.all(
      Array(100).fill(null).map(() => createSubscription())
    );

    const successful = results.filter(r => r.success);
    expect(successful.length).toBe(100);
  });

  it('should handle 1000 concurrent access checks', async () => {});
  it('should handle 50 concurrent webhooks', async () => {});
});
```

### TR-PERF-003: Memory and Resource Tests

```typescript
// test/performance/resources.test.ts

describe('Resource Usage', () => {
  it('should not leak memory on repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await createAndDeleteCustomer();
    }

    // Force garbage collection
    global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / initialMemory;

    expect(growth).toBeLessThan(0.1); // Less than 10% growth
  });

  it('should release database connections', async () => {});
});
```

---

## Test Data Management

### TR-DATA-001: Test Fixtures

```typescript
// test/fixtures/index.ts

/**
 * Test data factories using @faker-js/faker
 */

export function createTestCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: faker.string.uuid(),
    externalId: `user_${faker.string.alphanumeric(16)}`,
    email: faker.internet.email(),
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    providerCustomerIds: {},
    metadata: {},
    livemode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export function createTestSubscription(overrides?: Partial<Subscription>): Subscription {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    planId: faker.helpers.arrayElement(['plan_starter', 'plan_pro', 'plan_enterprise']),
    status: 'active',
    interval: 'month',
    quantity: 1,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialStart: null,
    trialEnd: null,
    cancelAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    providerSubscriptionIds: {},
    metadata: {},
    livemode: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

export function createTestTrialSubscription(overrides?: Partial<Subscription>): Subscription {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  return createTestSubscription({
    status: 'trialing',
    trialStart: now,
    trialEnd: trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
    ...overrides,
  });
}

export function createTestPayment(overrides?: Partial<Payment>): Payment {
  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    subscriptionId: null,
    invoiceId: null,
    amount: faker.number.int({ min: 100, max: 100000 }),
    currency: 'USD',
    status: 'succeeded',
    providerPaymentIds: {},
    metadata: {},
    livemode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestWebhookEvent(
  type: string,
  data?: Record<string, unknown>
): WebhookEvent {
  return {
    id: `evt_${faker.string.alphanumeric(24)}`,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: data ?? {},
    },
  };
}
```

### TR-DATA-002: Mock Providers

```typescript
// test/mocks/stripe.ts

export const mockStripeAdapter: QZPayPaymentAdapter = {
  createCustomer: vi.fn().mockResolvedValue({
    id: 'cus_mock_123',
    email: 'test@example.com',
  }),

  createSubscription: vi.fn().mockResolvedValue({
    id: 'sub_mock_123',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }),

  processPayment: vi.fn().mockResolvedValue({
    id: 'pi_mock_123',
    status: 'succeeded',
    amount: 1000,
  }),

  // ... other methods
};

// Simulate payment decline
export function mockPaymentDecline() {
  mockStripeAdapter.processPayment.mockRejectedValueOnce(
    new ProviderError('CARD_DECLINED', 'Your card was declined')
  );
}

// Simulate network error
export function mockNetworkError() {
  mockStripeAdapter.processPayment.mockRejectedValueOnce(
    new ProviderError('NETWORK_ERROR', 'Could not connect to payment provider')
  );
}
```

### TR-DATA-003: Database Seeding

```typescript
// test/seed/index.ts

export async function seedTestDatabase() {
  // Create test customers
  const customers = await Promise.all(
    Array(10).fill(null).map(() =>
      db.insert(customers).values(createTestCustomer())
    )
  );

  // Create subscriptions
  for (const customer of customers) {
    await db.insert(subscriptions).values(
      createTestSubscription({ customerId: customer.id })
    );
  }

  // Create payments
  // ...
}

export async function clearTestDatabase() {
  await db.delete(payments);
  await db.delete(subscriptions);
  await db.delete(customers);
}
```

---

## Continuous Integration

### TR-CI-001: CI Pipeline Configuration

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:integration

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:security

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm playwright install
      - run: pnpm test:e2e
```

### TR-CI-002: Coverage Requirements

| Metric | Minimum | Target |
|--------|---------|--------|
| Lines | 90% | 95% |
| Functions | 90% | 95% |
| Branches | 90% | 95% |
| Statements | 90% | 95% |

**Coverage enforcement**:
- PR blocked if coverage drops below minimum
- Warning if coverage doesn't meet target
- Coverage reports required for all PRs

### TR-CI-003: Test Reporting

```typescript
// vitest.config.ts

export default defineConfig({
  test: {
    reporters: ['default', 'html', 'json'],
    outputFile: {
      html: './test-results/index.html',
      json: './test-results/results.json',
    },
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
```

---

## Test Naming Conventions

### Pattern: `should [expected behavior] when [condition]`

**Good Examples**:
```typescript
it('should return active subscription when status is active')
it('should throw ValidationError when email is invalid')
it('should retry payment when initial attempt fails')
it('should send email when subscription is canceled')
```

**Bad Examples**:
```typescript
it('test subscription')
it('works correctly')
it('handles error')
```

---

## Test Organization

```
test/
├── unit/                    # Unit tests
│   ├── customers.test.ts
│   ├── subscriptions.test.ts
│   ├── payments.test.ts
│   ├── proration.test.ts
│   ├── entitlements.test.ts
│   ├── webhooks.test.ts
│   └── errors.test.ts
├── integration/             # Integration tests
│   ├── api/
│   │   ├── customers.test.ts
│   │   ├── subscriptions.test.ts
│   │   └── webhooks.test.ts
│   ├── adapters/
│   │   ├── stripe.test.ts
│   │   └── mercadopago.test.ts
│   └── database.test.ts
├── e2e/                     # End-to-end tests
│   ├── subscription-journey.test.ts
│   ├── checkout.test.ts
│   └── admin.test.ts
├── security/                # Security tests
│   ├── authentication.test.ts
│   ├── authorization.test.ts
│   ├── input-validation.test.ts
│   ├── data-protection.test.ts
│   └── rate-limiting.test.ts
├── performance/             # Performance tests
│   ├── response-time.test.ts
│   ├── load.test.ts
│   └── resources.test.ts
├── fixtures/                # Test data factories
│   └── index.ts
├── mocks/                   # Mock implementations
│   ├── stripe.ts
│   └── mercadopago.ts
├── seed/                    # Database seeding
│   └── index.ts
└── setup.ts                 # Global test setup
```

---

## Related Documents

- [User Stories](./USER-STORIES.md) - User scenarios to test
- [Functional Requirements](./FUNCTIONAL.md) - Requirements to verify
- [Non-Functional Requirements](./NON-FUNCTIONAL.md) - Performance targets
- [Security Standards](../../.claude/docs/standards/security-standards.md) - Security requirements
