# Security Architecture

## Overview

Security is built-in at every layer of @qazuor/qzpay. This document details the security architecture and requirements.

---

## 1. API Authentication & Authorization

### Ownership Validation (IDOR Protection)

All resource access must validate ownership:

```typescript
export interface OwnershipValidator {
  validateCustomerAccess(userId: string, customerId: string): Promise<void>;
  validateSubscriptionAccess(userId: string, subscriptionId: string): Promise<void>;
  validatePaymentAccess(userId: string, paymentId: string): Promise<void>;
  validateInvoiceAccess(userId: string, invoiceId: string): Promise<void>;
}
```

### Implementation

```typescript
export class QZPayOwnershipValidator implements OwnershipValidator {
  async validateSubscriptionAccess(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.storage.subscriptions.findById(subscriptionId);
    if (!subscription) {
      throw new QZPaySubscriptionNotFoundError(subscriptionId);
    }

    const customer = await this.storage.customers.findById(subscription.customerId);
    if (!customer || customer.externalId !== userId) {
      throw new QZPayAuthorizationError('Access denied to subscription resource');
    }
  }
}
```

### Route Protection

```typescript
app.get(`${basePath}/subscriptions/:id`, async (c) => {
  const user = c.get('user');
  const subscriptionId = c.req.param('id');

  // ALWAYS validate ownership before returning data
  await billing.security.validateSubscriptionAccess(user.id, subscriptionId);

  const subscription = await billing.subscriptions.get(subscriptionId);
  return c.json(subscription);
});
```

---

## 2. Input Validation

All API inputs are validated using Zod schemas before processing.

### Common Validators

```typescript
const QZPayValidators = {
  uuid: z.string().uuid(),
  currency: z.string().length(3).toUpperCase(),
  amountCents: z.number().int().positive().max(999999999999),
  email: z.string().email().max(255),
  externalId: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),
  idempotencyKey: z.string().min(16).max(255),
  metadata: z.record(z.string(), z.unknown()).refine(
    (obj) => JSON.stringify(obj).length <= 65536,
    { message: 'Metadata must be less than 64KB' }
  ),
};
```

### Operation Schemas

```typescript
const CreateSubscriptionSchema = z.object({
  customerId: QZPayValidators.uuid,
  planId: z.string().min(1).max(100),
  interval: z.enum(['week', 'month', 'quarter', 'year']),
  promoCode: z.string().max(50).optional(),
  idempotencyKey: QZPayValidators.idempotencyKey,
});

const RefundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  idempotencyKey: QZPayValidators.idempotencyKey,
});
```

### Validation Middleware

```typescript
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json({
        error: 'Validation failed',
        details: result.error.flatten(),
      }, 400);
    }

    c.set('validatedBody', result.data);
    await next();
  };
}
```

---

## 3. Webhook Security

### Signature Verification

Always use timing-safe comparison to prevent timing attacks:

```typescript
import { timingSafeEqual, createHmac } from 'crypto';

export class WebhookSecurityService {
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: 'sha256' | 'sha512' = 'sha256'
  ): boolean {
    const computed = createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    const computedBuffer = Buffer.from(computed);
    const providedBuffer = Buffer.from(signature);

    if (computedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedBuffer, providedBuffer);
  }
}
```

### Timestamp Validation

Prevent replay attacks:

```typescript
validateTimestamp(
  timestamp: number,
  toleranceSeconds: number = 300 // 5 minutes
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= toleranceSeconds;
}
```

### Webhook Idempotency

Check if webhook was already processed:

```typescript
async checkAndMark(provider: string, eventId: string): Promise<{ alreadyProcessed: boolean }> {
  const existing = await this.storage.webhookEvents.findByProviderEventId(provider, eventId);

  if (existing?.processed) {
    return { alreadyProcessed: true };
  }

  // Mark as processing...
  return { alreadyProcessed: false };
}
```

---

## 4. Data Protection

### Sensitive Data Encryption

| Data Type | Encryption | Storage |
|-----------|------------|---------|
| Payment tokens | Provider handles | Not stored locally |
| API keys | AES-256-GCM | Encrypted column |
| Webhook secrets | AES-256-GCM | Encrypted column |
| Customer PII | Application layer | Encrypted at rest |

### PCI Compliance

QZPay achieves PCI compliance by **never handling card data**:

- Card input uses provider elements (Stripe Elements, MP Brick)
- Card tokens stored at provider, not locally
- Only token references stored in database

---

## 5. Security Requirements Summary

| Requirement | Implementation |
|-------------|----------------|
| PCI Compliance | No card data handled (provider elements) |
| API Authentication | JWT/API key per project |
| Webhook Verification | Signature validation with timing-safe comparison |
| Sensitive Data | AES-256-GCM encryption at rest |
| Audit Logging | All financial operations logged (immutable) |
| IDOR Protection | Ownership validation on all resource endpoints |
| Input Validation | Zod schemas for all API inputs |
| Admin Routes | Require admin middleware when enabled |
| Resource Isolation | Users can only access their own billing data |

---

## 6. Security Audit Checklist

### Authentication & Authorization

- [ ] All routes require authentication
- [ ] Admin routes require admin middleware
- [ ] Ownership validated before resource access
- [ ] Rate limiting enabled on all endpoints

### Input Validation

- [ ] All inputs validated with Zod schemas
- [ ] No SQL injection possible
- [ ] No XSS possible in responses
- [ ] File uploads validated (if applicable)

### Webhooks

- [ ] Signature verified with timing-safe comparison
- [ ] Timestamp validated to prevent replay
- [ ] Idempotency prevents double processing
- [ ] Unknown event types logged but ignored

### Data Protection

- [ ] No card data stored locally
- [ ] Sensitive data encrypted at rest
- [ ] Audit logs immutable
- [ ] Backups encrypted

---

## Related Documents

- [Architecture Overview](./OVERVIEW.md)
- [Non-Functional Requirements](../02-requirements/NON-FUNCTIONAL.md)
- [Resilience](./RESILIENCE.md)
