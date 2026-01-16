# QZPay Error Handling

This document describes the error handling strategy in QZPay Core.

## Error Classes

All QZPay errors extend the base `QZPayError` class and provide structured error information.

### Available Error Classes

| Error Class | Purpose | Example |
|------------|---------|---------|
| `QZPayError` | Base error class | Generic errors with metadata |
| `QZPayValidationError` | Input validation failures | Invalid email, negative amount |
| `QZPayNotFoundError` | Entity not found | Customer not found, Plan not found |
| `QZPayConflictError` | Resource conflicts | Duplicate resource, incompatible state |
| `QZPayProviderSyncError` | Provider sync failures | Failed to create customer in Stripe |

### Error Codes

All errors include standardized error codes from `QZPayErrorCode`:

```typescript
import { QZPayErrorCode, QZPayProviderSyncError } from '@qazuor/qzpay-core';

try {
  await billing.customers.create(input);
} catch (error) {
  if (error instanceof QZPayProviderSyncError) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Operation: ${error.operation}`);
    console.error(`Code: ${error.metadata?.code}`); // QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED
  }
}
```

## Provider Sync Error Strategy

When syncing with payment providers (Stripe, MercadoPago), failures can be handled in two ways:

### Strategy 1: Throw (Production Default)

```typescript
const billing = createQZPayBilling({
  storage: myStorage,
  paymentAdapter: stripeAdapter,
  providerSyncErrorStrategy: 'throw', // Default in livemode
  livemode: true,
});

try {
  const customer = await billing.customers.create({
    email: 'user@example.com',
    externalId: 'user-123',
  });
  // Customer created in both local storage AND Stripe
} catch (error) {
  if (error instanceof QZPayProviderSyncError) {
    // Provider sync failed - customer was NOT created locally
    console.error('Failed to sync with provider:', error.message);
    // Show error to user
  }
}
```

**Behavior:**
- If provider sync fails, throw `QZPayProviderSyncError`
- Local customer record is rolled back (deleted)
- User must handle the error
- Ensures data consistency between local and provider

**Use this when:**
- In production (`livemode: true`)
- Data consistency is critical
- You want explicit error handling

### Strategy 2: Log (Development Default)

```typescript
const billing = createQZPayBilling({
  storage: myStorage,
  paymentAdapter: stripeAdapter,
  providerSyncErrorStrategy: 'log', // Default in development
  livemode: false,
});

const customer = await billing.customers.create({
  email: 'user@example.com',
  externalId: 'user-123',
});
// Customer created locally even if Stripe sync fails
// Error is logged but operation continues
```

**Behavior:**
- If provider sync fails, log error but continue
- Customer is created locally without provider link
- Operation succeeds from caller's perspective
- Customer can be synced later via `syncUser()`

**Use this when:**
- In development/testing (`livemode: false`)
- Testing without real provider credentials
- Provider downtime shouldn't block operations
- You have a retry/sync mechanism

## Error Code Categories

### Validation Errors (1000-1999)
- `validation_failed` - Generic validation failure
- `invalid_email` - Invalid email format
- `invalid_amount` - Invalid amount value
- `invalid_currency` - Invalid currency code
- `invalid_quantity` - Invalid quantity value
- `missing_required_field` - Required field missing

### Not Found Errors (2000-2999)
- `customer_not_found` - Customer not found
- `subscription_not_found` - Subscription not found
- `plan_not_found` - Plan not found
- `payment_not_found` - Payment not found
- And more...

### Provider Errors (4000-4999)
- `provider_sync_failed` - Generic provider sync failure
- `provider_create_customer_failed` - Failed to create customer
- `provider_update_customer_failed` - Failed to update customer
- `provider_payment_failed` - Payment processing failed
- `provider_not_linked` - Customer not linked to provider

### Payment Errors (5000-5999)
- `payment_failed` - Generic payment failure
- `payment_declined` - Payment declined by provider
- `payment_insufficient_funds` - Insufficient funds
- `payment_card_invalid` - Invalid card details

## Logging

All errors are logged with structured context:

```typescript
logger.error('Provider sync failed during customer creation', {
  provider: 'stripe',
  customerId: 'cus_123',
  externalId: 'user-123',
  operation: 'create_customer',
  error: 'API connection timeout',
  errorCode: QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED
});
```

## Best Practices

### 1. Always Handle Provider Errors in Production

```typescript
// ❌ BAD - Unhandled error in production
const customer = await billing.customers.create(input);

// ✅ GOOD - Handle provider sync errors
try {
  const customer = await billing.customers.create(input);
} catch (error) {
  if (error instanceof QZPayProviderSyncError) {
    // Show user-friendly error message
    showError('Failed to create account. Please try again.');
  }
  throw error;
}
```

### 2. Check Payment Status After Processing

```typescript
// Payment processing never throws - always returns payment record
const payment = await billing.payments.process({
  customerId: 'cus_123',
  amount: 1000,
  currency: 'USD',
});

// Always check status
if (payment.status === 'failed') {
  console.error('Payment failed:', payment.failureMessage);
  console.error('Error code:', payment.failureCode);
  // Handle failure (show error, retry, etc.)
}
```

### 3. Use Error Codes for Programmatic Handling

```typescript
import { QZPayErrorCode } from '@qazuor/qzpay-core';

try {
  await billing.customers.create(input);
} catch (error) {
  if (error instanceof QZPayError) {
    switch (error.metadata?.code) {
      case QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED:
        // Provider-specific error handling
        break;
      case QZPayErrorCode.INVALID_EMAIL:
        // Validation error handling
        break;
      default:
        // Generic error handling
        break;
    }
  }
}
```

### 4. Configure Strategy Based on Environment

```typescript
const billing = createQZPayBilling({
  storage: myStorage,
  paymentAdapter: stripeAdapter,
  livemode: process.env.NODE_ENV === 'production',
  // Let library choose default based on livemode
  // production: 'throw', development: 'log'
});
```

## Known Issues and Future Improvements

### Event Handler Error Logging

The batch event handler in `event-handler.ts` currently uses `console.error` for error logging:

```typescript
// Line 207 in event-handler.ts
flush().catch(console.error);
```

**Recommendation:** Update this to use structured logging when a logger is available. This requires changing the function signature to accept an optional logger parameter.

**Tracking:** See issue #[TBD]

### Additional Error Classes Needed

Consider adding these specialized error classes in the future:

- `QZPayAuthenticationError` - For authentication/authorization failures
- `QZPayRateLimitError` - For rate limiting errors
- `QZPayTimeoutError` - For operation timeouts
- `QZPayNetworkError` - For network connectivity issues

## Migration Guide

If you have existing code that relies on the previous silent error behavior:

```typescript
// Before (silent errors)
const customer = await billing.customers.create(input);
// Customer created even if provider sync failed (no way to know)

// After (with strategy)
const billing = createQZPayBilling({
  // ... config
  providerSyncErrorStrategy: 'log', // Keep old behavior
});
const customer = await billing.customers.create(input);
// Same behavior but errors are now logged

// Or use 'throw' for better error handling
const billing = createQZPayBilling({
  // ... config
  providerSyncErrorStrategy: 'throw', // Better error handling
});
try {
  const customer = await billing.customers.create(input);
} catch (error) {
  // Handle provider sync failures explicitly
}
```

## Testing

```typescript
// Test error handling
describe('Customer creation with provider sync', () => {
  it('should throw on provider sync failure when strategy is throw', async () => {
    const billing = createQZPayBilling({
      storage: mockStorage,
      paymentAdapter: failingAdapter,
      providerSyncErrorStrategy: 'throw',
    });

    await expect(
      billing.customers.create({ email: 'test@example.com', externalId: 'test' })
    ).rejects.toThrow(QZPayProviderSyncError);
  });

  it('should log and continue on provider sync failure when strategy is log', async () => {
    const billing = createQZPayBilling({
      storage: mockStorage,
      paymentAdapter: failingAdapter,
      providerSyncErrorStrategy: 'log',
    });

    const customer = await billing.customers.create({
      email: 'test@example.com',
      externalId: 'test',
    });

    expect(customer).toBeDefined();
    expect(customer.providerCustomerIds).toEqual({});
  });
});
```
