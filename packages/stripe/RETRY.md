# Retry Logic with Exponential Backoff

This document describes the retry logic implementation in the Stripe adapter.

## Overview

The Stripe adapter automatically retries failed operations that are likely to succeed on retry (transient errors). This improves reliability without requiring changes to your application code.

## Configuration

Retry behavior is configured when creating the adapter:

```typescript
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';

const adapter = createQZPayStripeAdapter({
  secretKey: 'sk_test_...',
  webhookSecret: 'whsec_...',
  retry: {
    enabled: true,           // Enable/disable retry (default: true)
    maxAttempts: 3,          // Maximum retry attempts (default: 3)
    initialDelayMs: 1000,    // Initial delay in ms (default: 1000)
    maxDelayMs: 8000,        // Maximum delay in ms (default: 8000)
    backoffMultiplier: 2,    // Delay multiplier (default: 2)
    logger: (msg, ctx) => {  // Optional logger
      console.log(msg, ctx);
    }
  }
});
```

## Retriable Errors

The following errors are automatically retried:

### Network Errors
- Connection timeouts
- Connection resets (ECONNRESET)
- Connection refused (ECONNREFUSED)
- Network timeouts (ETIMEDOUT)

### Rate Limiting
- HTTP 429 (Too Many Requests)
- Stripe rate limit errors

### Server Errors
- HTTP 500 (Internal Server Error)
- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- Stripe API errors

## Non-Retriable Errors

The following errors are NOT retried (fail immediately):

### Validation Errors
- HTTP 400 (Bad Request)
- Invalid parameters
- Missing required fields

### Authentication Errors
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- Invalid API key

### Resource Errors
- HTTP 404 (Not Found)
- Resource already exists
- Resource deleted

### Card Errors
- Card declined
- Insufficient funds
- Expired card
- Incorrect CVC
- Invalid card number

## Exponential Backoff

Retry delays increase exponentially:

1. First retry: 1 second
2. Second retry: 2 seconds
3. Third retry: 4 seconds

Formula: `delay = initialDelayMs * (backoffMultiplier ^ attempt)`

Maximum delay is capped at `maxDelayMs` (default 8 seconds).

## Operations with Retry

The following adapter operations use retry logic:

### Payment Operations
- `payments.create()` - Create payment
- `payments.capture()` - Capture payment
- `payments.cancel()` - Cancel payment
- `payments.refund()` - Refund payment
- `payments.retrieve()` - Retrieve payment

### Subscription Operations
- `subscriptions.create()` - Create subscription
- `subscriptions.update()` - Update subscription
- `subscriptions.cancel()` - Cancel subscription
- `subscriptions.pause()` - Pause subscription
- `subscriptions.resume()` - Resume subscription
- `subscriptions.retrieve()` - Retrieve subscription

### Customer Operations
- `customers.create()` - Create customer
- `customers.update()` - Update customer
- `customers.delete()` - Delete customer
- `customers.retrieve()` - Retrieve customer

### Other Operations
- Checkout sessions
- Prices
- Setup intents
- Vendor operations (if Connect enabled)

## Webhook Processing

Webhook event verification (`webhooks.constructEvent()`) does NOT use retry logic because:

1. Signature verification is deterministic (succeeds or fails immediately)
2. Webhook payloads should be processed exactly once
3. Stripe automatically retries failed webhooks

## Logging

Enable logging to debug retry behavior:

```typescript
const adapter = createQZPayStripeAdapter({
  secretKey: 'sk_test_...',
  webhookSecret: 'whsec_...',
  retry: {
    logger: (message, context) => {
      console.log(`[RETRY] ${message}`, {
        attempt: context.attempt,
        maxAttempts: context.maxAttempts,
        delay: context.delay,
        error: context.error
      });
    }
  }
});
```

Example log output:

```
[RETRY] Create payment failed, retrying in 1000ms {
  attempt: 1,
  maxAttempts: 3,
  delay: 1000,
  error: 'Connection timeout'
}

[RETRY] Create payment failed, retrying in 2000ms {
  attempt: 2,
  maxAttempts: 3,
  delay: 2000,
  error: 'Connection timeout'
}
```

## Disabling Retry

To disable retry for all operations:

```typescript
const adapter = createQZPayStripeAdapter({
  secretKey: 'sk_test_...',
  webhookSecret: 'whsec_...',
  retry: {
    enabled: false
  }
});
```

## Advanced Usage

For custom retry logic, use the `withRetry` utility directly:

```typescript
import { withRetry } from '@qazuor/qzpay-stripe';

const result = await withRetry(
  async () => {
    // Your operation
    return await someApiCall();
  },
  {
    maxAttempts: 5,
    initialDelayMs: 500,
    logger: console.log
  },
  'Custom operation'
);
```

## Error Classification

To check if an error is retriable:

```typescript
import { isRetriableError } from '@qazuor/qzpay-stripe';

try {
  await adapter.payments.create(...);
} catch (error) {
  if (isRetriableError(error)) {
    // Transient error that could be retried
    console.log('Temporary error, will retry');
  } else {
    // Permanent error, don't retry
    console.log('Permanent error, fix required');
  }
}
```

## Best Practices

1. **Use default configuration** for most cases (3 retries, 1s initial delay)
2. **Enable logging** during development to understand retry behavior
3. **Increase maxAttempts** for critical operations or unreliable networks
4. **Decrease maxAttempts** for non-critical operations or tight SLAs
5. **Monitor retry metrics** to identify infrastructure issues
6. **Don't retry idempotent operations multiple times** at application level (adapter handles this)

## Performance Impact

- **Latency**: Failed operations take longer (sum of delays)
- **Throughput**: Minimal impact on successful operations
- **Memory**: Negligible (only stores error state during retry)
- **Network**: Additional requests on transient failures

Example worst-case latency:
- 3 failed attempts: ~7 seconds total (1s + 2s + 4s)
- 5 failed attempts: ~15 seconds total (1s + 2s + 4s + 8s)

## Testing

Test retry behavior in development:

```typescript
// Simulate network errors
const adapter = createQZPayStripeAdapter({
  secretKey: 'sk_test_...',
  webhookSecret: 'whsec_...',
  retry: {
    maxAttempts: 5,
    logger: console.log
  }
});

// This will retry automatically on network failures
try {
  const payment = await adapter.payments.create(...);
  console.log('Payment created:', payment.id);
} catch (error) {
  console.error('Payment failed after retries:', error);
}
```
