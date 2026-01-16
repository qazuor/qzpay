# Retry Logic with Exponential Backoff

This document describes the retry logic implementation in the MercadoPago adapter.

## Overview

The MercadoPago adapter automatically retries failed operations that are likely to succeed on retry (transient errors). This improves reliability without requiring changes to your application code.

## Configuration

Retry behavior is configured when creating the adapter:

```typescript
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

const adapter = createQZPayMercadoPagoAdapter({
  accessToken: 'APP_USR-...',
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
- MercadoPago rate limit errors (code: 429)

### Server Errors
- HTTP 500 (Internal Server Error)
- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- MercadoPago provider errors

## Non-Retriable Errors

The following errors are NOT retried (fail immediately):

### Validation Errors
- HTTP 400 (Bad Request)
- MercadoPago error code: 400
- Invalid parameters
- Missing required fields

### Authentication Errors
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- MercadoPago error codes: 401, 403
- Invalid access token

### Resource Errors
- HTTP 404 (Not Found)
- MercadoPago error code: 404
- Resource not found

### Card Errors
- Card declined (`cc_rejected_*`)
- Insufficient funds (`cc_rejected_insufficient_amount`)
- Invalid card (`cc_rejected_bad_filled_*`)
- Card disabled (`cc_rejected_card_disabled`)
- High risk (`cc_rejected_high_risk`)

### Duplicate Transaction
- MercadoPago error code: 101
- Resource already exists
- Duplicate payment (`cc_rejected_duplicated_payment`)

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
- Checkout preference creation
- Price/plan creation and management
- Card tokenization (for saved cards)

## Webhook Processing

IPN/Webhook event verification does NOT use retry logic because:

1. Signature verification is deterministic (succeeds or fails immediately)
2. Webhook payloads should be processed exactly once
3. MercadoPago automatically retries failed webhooks

## Logging

Enable logging to debug retry behavior:

```typescript
const adapter = createQZPayMercadoPagoAdapter({
  accessToken: 'APP_USR-...',
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
const adapter = createQZPayMercadoPagoAdapter({
  accessToken: 'APP_USR-...',
  retry: {
    enabled: false
  }
});
```

## Advanced Usage

For custom retry logic, use the `withRetry` utility directly:

```typescript
import { withRetry } from '@qazuor/qzpay-mercadopago';

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
import { isRetriableError } from '@qazuor/qzpay-mercadopago';

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

## MercadoPago-Specific Considerations

### Idempotency Keys

The payment adapter automatically generates idempotency keys to prevent duplicate payments:

```typescript
const idempotencyKey = `qzpay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
```

This ensures that retried requests don't create duplicate charges.

### Card Tokenization

When using saved cards, the adapter generates a new token from the card ID before creating a payment. If token generation fails with a transient error, it will be retried.

### Status Details

MercadoPago provides detailed status information (`status_detail`) for failed payments. The retry logic correctly identifies non-retriable card errors like:

- `cc_rejected_bad_filled_card_number`
- `cc_rejected_bad_filled_security_code`
- `cc_rejected_insufficient_amount`
- `cc_rejected_high_risk`

## Best Practices

1. **Use default configuration** for most cases (3 retries, 1s initial delay)
2. **Enable logging** during development to understand retry behavior
3. **Handle duplicate transaction errors** gracefully (these are not retried)
4. **Monitor card error rates** to identify user experience issues
5. **Test with sandbox credentials** before going to production
6. **Consider increasing maxAttempts** for markets with unreliable connectivity (e.g., LATAM)

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
// Use test credentials
const adapter = createQZPayMercadoPagoAdapter({
  accessToken: 'TEST-...',
  retry: {
    maxAttempts: 5,
    logger: console.log
  }
});

// This will retry automatically on network failures
try {
  const payment = await adapter.payments.create({
    customerId: 'cust_123',
    amount: 10000,
    currency: 'ARS',
    payerEmail: 'test@example.com'
  });
  console.log('Payment created:', payment.id);
} catch (error) {
  console.error('Payment failed after retries:', error);
}
```

## Common Error Scenarios

### Scenario 1: Network Timeout (Retriable)
```
Error: ETIMEDOUT
→ Retry 1 in 1s
→ Retry 2 in 2s
→ Success or fail after max attempts
```

### Scenario 2: Invalid Card (Not Retriable)
```
Error: cc_rejected_bad_filled_card_number
→ Fail immediately (don't retry)
```

### Scenario 3: Rate Limit (Retriable)
```
Error: 429 Too Many Requests
→ Retry 1 in 1s
→ Retry 2 in 2s
→ Success (rate limit lifted)
```

### Scenario 4: Duplicate Payment (Not Retriable)
```
Error: 101 Resource already exists
→ Fail immediately (payment already processed)
```
