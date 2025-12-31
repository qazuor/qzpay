# Error Catalog

Complete error hierarchy, codes, and handling guidelines for QZPay.

## Table of Contents

1. [Error Hierarchy](#error-hierarchy)
2. [Error Codes Reference](#error-codes-reference)
3. [Error Response Format](#error-response-format)
4. [Retry Strategy](#retry-strategy)
5. [User-Friendly Messages](#user-friendly-messages)

---

## Error Hierarchy

All QZPay errors extend from a base error class with consistent structure.

```typescript
/**
 * Base error class for all QZPay errors
 */
export class QZPayError extends Error {
  /** Unique error code */
  readonly code: QZPayErrorCode;

  /** HTTP status code for API responses */
  readonly statusCode: number;

  /** Whether this error is safe to retry */
  readonly retryable: boolean;

  /** Milliseconds to wait before retry (if retryable) */
  readonly retryAfter?: number;

  /** Additional context for debugging */
  readonly details?: Record<string, unknown>;

  /** Original error if this wraps another error */
  readonly cause?: Error;

  /** Timestamp when error occurred */
  readonly timestamp: Date;

  /** Correlation ID for tracing */
  readonly correlationId?: string;

  constructor(options: QZPayErrorOptions) {
    super(options.message);
    this.name = 'QZPayError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
    this.cause = options.cause;
    this.timestamp = new Date();
    this.correlationId = options.correlationId;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): QZPayErrorJSON {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
    };
  }
}
```

### Specialized Error Classes

```typescript
/**
 * Validation errors - invalid input data
 */
export class QZPayValidationError extends QZPayError {
  readonly field?: string;
  readonly value?: unknown;

  constructor(options: QZPayValidationErrorOptions) {
    super({
      ...options,
      statusCode: 400,
      retryable: false,
    });
    this.name = 'QZPayValidationError';
    this.field = options.field;
    this.value = options.value;
  }
}

/**
 * Not found errors - resource doesn't exist
 */
export class QZPayNotFoundError extends QZPayError {
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(options: QZPayNotFoundErrorOptions) {
    super({
      ...options,
      statusCode: 404,
      retryable: false,
    });
    this.name = 'QZPayNotFoundError';
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
  }
}

/**
 * Authorization errors - access denied
 */
export class QZPayAuthorizationError extends QZPayError {
  readonly userId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly requiredPermission?: string;

  constructor(options: QZPayAuthorizationErrorOptions) {
    super({
      ...options,
      statusCode: 403,
      retryable: false,
    });
    this.name = 'QZPayAuthorizationError';
    this.userId = options.userId;
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
    this.requiredPermission = options.requiredPermission;
  }
}

/**
 * Payment errors - payment processing failed
 */
export class QZPayPaymentError extends QZPayError {
  readonly provider?: QZPayPaymentProvider;
  readonly providerCode?: string;
  readonly declineCode?: string;

  constructor(options: QZPayPaymentErrorOptions) {
    super({
      ...options,
      statusCode: options.statusCode ?? 402,
    });
    this.name = 'QZPayPaymentError';
    this.provider = options.provider;
    this.providerCode = options.providerCode;
    this.declineCode = options.declineCode;
  }
}

/**
 * Adapter errors - payment provider issues
 */
export class QZPayAdapterError extends QZPayError {
  readonly provider: QZPayPaymentProvider;
  readonly providerCode?: string;
  readonly originalError?: Error;

  constructor(options: QZPayAdapterErrorOptions) {
    super(options);
    this.name = 'QZPayAdapterError';
    this.provider = options.provider;
    this.providerCode = options.providerCode;
    this.originalError = options.originalError;
  }
}

/**
 * Conflict errors - operation conflicts with current state
 */
export class QZPayConflictError extends QZPayError {
  readonly conflictType: string;
  readonly existingValue?: unknown;

  constructor(options: QZPayConflictErrorOptions) {
    super({
      ...options,
      statusCode: 409,
      retryable: false,
    });
    this.name = 'QZPayConflictError';
    this.conflictType = options.conflictType;
    this.existingValue = options.existingValue;
  }
}

/**
 * Rate limit errors
 */
export class QZPayRateLimitError extends QZPayError {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;

  constructor(options: QZPayRateLimitErrorOptions) {
    super({
      ...options,
      statusCode: 429,
      retryable: true,
      retryAfter: options.retryAfter,
    });
    this.name = 'QZPayRateLimitError';
    this.limit = options.limit;
    this.remaining = options.remaining;
    this.resetAt = options.resetAt;
  }
}

/**
 * Internal errors - unexpected system failures
 */
export class QZPayInternalError extends QZPayError {
  constructor(options: QZPayInternalErrorOptions) {
    super({
      ...options,
      code: options.code ?? QZPayErrorCode.INTERNAL_ERROR,
      statusCode: 500,
      retryable: options.retryable ?? true,
    });
    this.name = 'QZPayInternalError';
  }
}
```

---

## Error Codes Reference

### Customer Errors (CUST_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `CUST_NOT_FOUND` | 404 | Customer not found | No | Customer account not found |
| `CUST_ALREADY_EXISTS` | 409 | Customer with this external ID already exists | No | Account already exists with this email |
| `CUST_DELETED` | 410 | Customer was deleted | No | This account has been deactivated |
| `CUST_INVALID_EMAIL` | 400 | Invalid email format | No | Please enter a valid email address |
| `CUST_EMAIL_IN_USE` | 409 | Email already in use by another customer | No | This email is already registered |
| `CUST_PROVIDER_SYNC_FAILED` | 500 | Failed to sync customer with payment provider | Yes | Payment system temporarily unavailable |

### Subscription Errors (SUB_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `SUB_NOT_FOUND` | 404 | Subscription not found | No | Subscription not found |
| `SUB_ALREADY_CANCELED` | 409 | Subscription is already canceled | No | This subscription has already been canceled |
| `SUB_ALREADY_ACTIVE` | 409 | Subscription is already active | No | You already have an active subscription |
| `SUB_CANNOT_UPGRADE` | 400 | Cannot upgrade subscription in current state | No | Unable to change plan at this time |
| `SUB_CANNOT_DOWNGRADE` | 400 | Cannot downgrade subscription in current state | No | Unable to change plan at this time |
| `SUB_TRIAL_ALREADY_USED` | 400 | Trial already used for this plan | No | You have already used your free trial |
| `SUB_LIMIT_EXCEEDED` | 400 | Maximum subscriptions limit reached | No | You have reached the maximum number of subscriptions |
| `SUB_INVALID_PLAN` | 400 | Plan not found or inactive | No | Selected plan is not available |
| `SUB_INVALID_INTERVAL` | 400 | Invalid billing interval for this plan | No | Selected billing period is not available |
| `SUB_REQUIRES_PAYMENT_METHOD` | 400 | Subscription requires a payment method | No | Please add a payment method to continue |
| `SUB_PAUSE_NOT_ALLOWED` | 400 | Subscription pause not allowed for this plan | No | Pausing is not available for your plan |
| `SUB_GRACE_PERIOD_ACTIVE` | 400 | Cannot perform action during grace period | No | Please resolve payment issue first |
| `SUB_PROVIDER_SYNC_FAILED` | 500 | Failed to sync subscription with provider | Yes | Payment system temporarily unavailable |

### Payment Errors (PAY_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `PAY_NOT_FOUND` | 404 | Payment not found | No | Payment record not found |
| `PAY_ALREADY_CAPTURED` | 409 | Payment already captured | No | This payment has already been processed |
| `PAY_ALREADY_REFUNDED` | 409 | Payment already refunded | No | This payment has already been refunded |
| `PAY_REFUND_EXCEEDS_AMOUNT` | 400 | Refund amount exceeds payment amount | No | Refund amount is greater than the original payment |
| `PAY_CARD_DECLINED` | 402 | Card was declined | No | Your card was declined. Please try another card. |
| `PAY_INSUFFICIENT_FUNDS` | 402 | Insufficient funds | No | Insufficient funds. Please try another payment method. |
| `PAY_EXPIRED_CARD` | 402 | Card has expired | No | Your card has expired. Please update your payment method. |
| `PAY_INVALID_CARD` | 400 | Invalid card details | No | Invalid card details. Please check and try again. |
| `PAY_INVALID_CVV` | 400 | Invalid CVV | No | Invalid security code. Please check and try again. |
| `PAY_FRAUD_DETECTED` | 402 | Payment flagged as potentially fraudulent | No | Payment could not be processed. Please contact support. |
| `PAY_PROCESSING_ERROR` | 500 | Payment processing error | Yes | Payment processing failed. Please try again. |
| `PAY_AMOUNT_TOO_SMALL` | 400 | Amount below minimum | No | Amount must be at least $0.50 |
| `PAY_AMOUNT_TOO_LARGE` | 400 | Amount exceeds maximum | No | Amount exceeds maximum allowed |
| `PAY_CURRENCY_MISMATCH` | 400 | Currency mismatch | No | Currency does not match your account |
| `PAY_3DS_REQUIRED` | 402 | 3D Secure authentication required | No | Additional authentication required |
| `PAY_3DS_FAILED` | 402 | 3D Secure authentication failed | No | Authentication failed. Please try again. |

### Payment Method Errors (PM_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `PM_NOT_FOUND` | 404 | Payment method not found | No | Payment method not found |
| `PM_ALREADY_ATTACHED` | 409 | Payment method already attached to customer | No | This payment method is already saved |
| `PM_CANNOT_DELETE_DEFAULT` | 400 | Cannot delete default payment method | No | Please set another payment method as default first |
| `PM_CANNOT_DELETE_ACTIVE_SUB` | 400 | Cannot delete payment method with active subscription | No | This payment method is in use by an active subscription |
| `PM_EXPIRED` | 400 | Payment method has expired | No | This payment method has expired |
| `PM_VERIFICATION_FAILED` | 400 | Payment method verification failed | No | Unable to verify payment method |

### Promo Code Errors (PROMO_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `PROMO_NOT_FOUND` | 404 | Promo code not found | No | Invalid promo code |
| `PROMO_EXPIRED` | 400 | Promo code has expired | No | This promo code has expired |
| `PROMO_MAX_USES_REACHED` | 400 | Promo code usage limit reached | No | This promo code has reached its usage limit |
| `PROMO_ALREADY_USED` | 400 | Customer already used this promo code | No | You have already used this promo code |
| `PROMO_NOT_APPLICABLE` | 400 | Promo code not applicable to this plan | No | This promo code cannot be used with selected plan |
| `PROMO_MIN_NOT_MET` | 400 | Minimum order amount not met | No | Minimum purchase amount not met for this code |
| `PROMO_CANNOT_STACK` | 400 | Cannot combine with other promo codes | No | Only one promo code can be applied |
| `PROMO_INACTIVE` | 400 | Promo code is inactive | No | This promo code is no longer active |

### Invoice Errors (INV_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `INV_NOT_FOUND` | 404 | Invoice not found | No | Invoice not found |
| `INV_ALREADY_PAID` | 409 | Invoice already paid | No | This invoice has already been paid |
| `INV_ALREADY_VOIDED` | 409 | Invoice already voided | No | This invoice has been voided |
| `INV_CANNOT_MODIFY_FINALIZED` | 400 | Cannot modify finalized invoice | No | This invoice cannot be modified |
| `INV_EMPTY` | 400 | Cannot finalize empty invoice | No | Invoice has no items |

### Marketplace Errors (MKT_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `MKT_VENDOR_NOT_FOUND` | 404 | Vendor not found | No | Vendor not found |
| `MKT_VENDOR_NOT_VERIFIED` | 400 | Vendor not verified for payouts | No | Seller account is not verified |
| `MKT_VENDOR_SUSPENDED` | 400 | Vendor account suspended | No | Seller account is currently suspended |
| `MKT_PAYOUT_FAILED` | 500 | Vendor payout failed | Yes | Payout processing failed |
| `MKT_SPLIT_CALCULATION_ERROR` | 500 | Error calculating payment split | Yes | Unable to process payment split |
| `MKT_MINIMUM_NOT_MET` | 400 | Minimum payout amount not met | No | Minimum payout amount not reached |

### Webhook Errors (WEBHOOK_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `WEBHOOK_INVALID_SIGNATURE` | 401 | Invalid webhook signature | No | - |
| `WEBHOOK_PAYLOAD_INVALID` | 400 | Invalid webhook payload | No | - |
| `WEBHOOK_EVENT_UNKNOWN` | 400 | Unknown webhook event type | No | - |
| `WEBHOOK_PROCESSING_FAILED` | 500 | Webhook processing failed | Yes | - |
| `WEBHOOK_DUPLICATE` | 200 | Webhook already processed | No | - |

### Provider Errors (PROVIDER_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `PROVIDER_UNAVAILABLE` | 503 | Payment provider unavailable | Yes | Payment system temporarily unavailable. Please try again. |
| `PROVIDER_TIMEOUT` | 504 | Payment provider timeout | Yes | Request timed out. Please try again. |
| `PROVIDER_RATE_LIMITED` | 429 | Rate limited by payment provider | Yes | Too many requests. Please wait a moment. |
| `PROVIDER_AUTHENTICATION_FAILED` | 500 | Provider authentication failed | No | Payment system configuration error |
| `PROVIDER_API_ERROR` | 500 | Provider API error | Yes | Payment processing error. Please try again. |

### Idempotency Errors (IDEM_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `IDEM_KEY_CONFLICT` | 409 | Idempotency key reused with different parameters | No | Request conflict. Please try again. |
| `IDEM_KEY_EXPIRED` | 400 | Idempotency key has expired | No | Request expired. Please try again. |

### Concurrency Errors (CONC_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `CONC_OPTIMISTIC_LOCK` | 409 | Resource was modified by another request | Yes | Data was updated. Please refresh and try again. |
| `CONC_DEADLOCK` | 500 | Database deadlock detected | Yes | Please try again. |

### Internal Errors (INT_*)

| Code | HTTP | Message | Retryable | User Message |
|------|------|---------|-----------|--------------|
| `INTERNAL_ERROR` | 500 | Internal server error | Yes | An unexpected error occurred. Please try again. |
| `DATABASE_ERROR` | 500 | Database error | Yes | Service temporarily unavailable. Please try again. |
| `CONFIGURATION_ERROR` | 500 | Configuration error | No | Service configuration error. Please contact support. |

---

## Error Response Format

### API Response Structure

```typescript
interface QZPayErrorResponse {
  error: {
    /** Error code for programmatic handling */
    code: QZPayErrorCode;

    /** Human-readable error message */
    message: string;

    /** User-friendly message for display */
    userMessage: string;

    /** HTTP status code */
    statusCode: number;

    /** Whether client should retry */
    retryable: boolean;

    /** Milliseconds to wait before retry */
    retryAfter?: number;

    /** Additional context */
    details?: {
      /** Field that caused validation error */
      field?: string;

      /** Invalid value */
      value?: unknown;

      /** Resource type for not found errors */
      resourceType?: string;

      /** Resource ID for not found errors */
      resourceId?: string;

      /** Provider-specific error code */
      providerCode?: string;

      /** Card decline code */
      declineCode?: string;

      /** Any additional context */
      [key: string]: unknown;
    };

    /** Timestamp of error */
    timestamp: string;

    /** Request correlation ID for support */
    correlationId: string;

    /** Documentation link */
    docsUrl?: string;
  };
}
```

### Example Responses

#### Validation Error

```json
{
  "error": {
    "code": "CUST_INVALID_EMAIL",
    "message": "Invalid email format",
    "userMessage": "Please enter a valid email address",
    "statusCode": 400,
    "retryable": false,
    "details": {
      "field": "email",
      "value": "not-an-email"
    },
    "timestamp": "2025-01-15T10:30:00.000Z",
    "correlationId": "req_abc123xyz",
    "docsUrl": "https://docs.qzpay.dev/errors#CUST_INVALID_EMAIL"
  }
}
```

#### Payment Declined

```json
{
  "error": {
    "code": "PAY_CARD_DECLINED",
    "message": "Card was declined",
    "userMessage": "Your card was declined. Please try another card.",
    "statusCode": 402,
    "retryable": false,
    "details": {
      "providerCode": "card_declined",
      "declineCode": "insufficient_funds"
    },
    "timestamp": "2025-01-15T10:30:00.000Z",
    "correlationId": "req_def456uvw"
  }
}
```

#### Rate Limited

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMITED",
    "message": "Rate limited by payment provider",
    "userMessage": "Too many requests. Please wait a moment.",
    "statusCode": 429,
    "retryable": true,
    "retryAfter": 1000,
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetAt": "2025-01-15T10:31:00.000Z"
    },
    "timestamp": "2025-01-15T10:30:00.000Z",
    "correlationId": "req_ghi789rst"
  }
}
```

---

## Retry Strategy

### Retryable Errors

| Error Category | Max Retries | Backoff Strategy | Initial Delay |
|----------------|-------------|------------------|---------------|
| `PROVIDER_UNAVAILABLE` | 3 | Exponential | 1000ms |
| `PROVIDER_TIMEOUT` | 2 | Exponential | 500ms |
| `PROVIDER_RATE_LIMITED` | 3 | Use `retryAfter` | As specified |
| `PROVIDER_API_ERROR` | 3 | Exponential | 1000ms |
| `DATABASE_ERROR` | 3 | Exponential | 500ms |
| `CONC_OPTIMISTIC_LOCK` | 3 | Linear | 100ms |
| `CONC_DEADLOCK` | 3 | Exponential | 500ms |
| `INTERNAL_ERROR` | 2 | Exponential | 1000ms |

### Retry Implementation

```typescript
import { retry } from 'p-retry';

async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return retry(
    async () => {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof QZPayError && !error.retryable) {
          throw new AbortError(error.message);
        }
        throw error;
      }
    },
    {
      retries: options?.maxRetries ?? 3,
      factor: 2,
      minTimeout: options?.initialDelay ?? 1000,
      maxTimeout: 30000,
      randomize: true, // Add jitter
      onFailedAttempt: (error) => {
        console.log(
          `Attempt ${error.attemptNumber} failed. ` +
          `${error.retriesLeft} retries left.`
        );
      },
    }
  );
}
```

### Jitter for Distributed Systems

```typescript
function calculateBackoffWithJitter(
  attempt: number,
  baseDelay: number = 1000
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
```

---

## User-Friendly Messages

### Message Guidelines

1. **Be specific**: Tell users exactly what went wrong
2. **Be actionable**: Tell users what they can do to fix it
3. **Be reassuring**: Don't alarm users unnecessarily
4. **Be professional**: Avoid technical jargon

### Message Templates by Category

#### Payment Issues

| Scenario | User Message |
|----------|--------------|
| Card declined | Your card was declined. Please try another payment method. |
| Insufficient funds | Your payment method has insufficient funds. Please try another card. |
| Expired card | Your card has expired. Please update your payment method. |
| 3DS required | Additional verification required. Please complete the authentication. |
| 3DS failed | Verification failed. Please try again or use a different card. |
| Generic failure | We couldn't process your payment. Please try again or contact support. |

#### Subscription Issues

| Scenario | User Message |
|----------|--------------|
| Already subscribed | You already have an active subscription to this plan. |
| Plan unavailable | This plan is currently unavailable. Please select another option. |
| Trial used | You've already used your free trial for this plan. |
| Cannot change | We're unable to change your plan right now. Please try again later. |

#### Account Issues

| Scenario | User Message |
|----------|--------------|
| Not found | We couldn't find your account. Please check your details and try again. |
| Already exists | An account with this email already exists. Please sign in instead. |
| Session expired | Your session has expired. Please sign in again. |

#### System Issues

| Scenario | User Message |
|----------|--------------|
| Temporary outage | We're experiencing technical difficulties. Please try again in a few minutes. |
| Rate limited | You've made too many requests. Please wait a moment and try again. |
| Generic error | Something went wrong. Please try again or contact support if the issue persists. |

---

## Error Logging

### What to Log

```typescript
interface ErrorLogEntry {
  // Always log
  level: 'error' | 'warn';
  code: QZPayErrorCode;
  message: string;
  timestamp: string;
  correlationId: string;

  // Context
  customerId?: string;
  subscriptionId?: string;
  paymentId?: string;

  // Technical details
  stack?: string;
  provider?: string;
  providerCode?: string;

  // Request context
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string; // Anonymized

  // Never log
  // - Full credit card numbers
  // - CVV codes
  // - Passwords
  // - Full email addresses (mask as j***@example.com)
}
```

### Log Levels

| Error Type | Log Level | Alert |
|------------|-----------|-------|
| Validation errors | `warn` | No |
| Not found errors | `warn` | No |
| Payment declined | `info` | No |
| Provider unavailable | `error` | Yes (if > 5 in 5 min) |
| Internal errors | `error` | Yes |
| Security errors | `error` | Yes (immediate) |

---

## References

- [Adapter Specifications](./ADAPTER-SPECIFICATIONS.md)
- [Public API](./PUBLIC-API.md)
- [Security Standards](../.claude/docs/standards/security-standards.md)
- [Observability](../03-architecture/OBSERVABILITY.md)
