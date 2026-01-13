# Error Handling Guide

Comprehensive guide to handling errors in QZPay across all packages.

## Overview

QZPay provides consistent error handling across all packages with:

- **Typed Error Classes**: Specific error types for different scenarios
- **Error Codes**: Standardized error codes for programmatic handling
- **Error Mapping**: Provider-specific errors mapped to QZPay errors
- **Contextual Information**: Original errors and context preserved

## Error Hierarchy

### Base Error Class

All QZPay errors extend from the base error class:

```typescript
class QZPayError extends Error {
  code: string;
  statusCode: number;
  originalError?: unknown;
  details?: Record<string, unknown>;
}
```

### Provider-Specific Errors

#### Stripe Errors

```typescript
import { QZPayError, QZPayErrorCode, mapStripeError } from '@qazuor/qzpay-stripe';

try {
  const payment = await stripeAdapter.payments.create({
    customerId: 'cus_123',
    amount: 2999,
    currency: 'USD'
  });
} catch (error) {
  const qzpayError = mapStripeError(error);

  console.log('Error code:', qzpayError.code);
  // 'card_declined', 'insufficient_funds', 'authentication_required', etc.

  console.log('Status code:', qzpayError.statusCode);
  // HTTP status code (402, 500, etc.)

  console.log('Original error:', qzpayError.originalError);
  // Original Stripe error for debugging
}
```

#### MercadoPago Errors

```typescript
import { QZPayMercadoPagoError, QZPayErrorCode } from '@qazuor/qzpay-mercadopago';

try {
  const payment = await mpAdapter.payments.create(customerId, {
    amount: 10000,
    currency: 'ARS',
    paymentMethodId: 'visa'
  });
} catch (error) {
  if (error instanceof QZPayMercadoPagoError) {
    console.log('Error code:', error.code);
    // 'card_declined', 'insufficient_funds', 'invalid_card', etc.

    console.log('Status detail:', error.statusDetail);
    // MercadoPago-specific status detail
    // 'cc_rejected_insufficient_amount', 'cc_rejected_bad_filled_security_code', etc.

    console.log('Original error:', error.originalError);
    // Original MercadoPago error
  }
}
```

## Error Codes by Category

### Card Errors

| Code | Description | User Action |
|------|-------------|-------------|
| `card_declined` | Card was declined by issuer | Try another card |
| `insufficient_funds` | Insufficient funds | Use different payment method |
| `expired_card` | Card has expired | Update card details |
| `incorrect_cvc` | Invalid CVV/CVC | Re-enter security code |
| `incorrect_number` | Invalid card number | Check card number |
| `invalid_expiry` | Invalid expiry date | Check expiration date |

### Authentication Errors

| Code | Description | User Action |
|------|-------------|-------------|
| `authentication_required` | 3DS authentication needed | Complete authentication |
| `authentication_failed` | 3DS authentication failed | Try again or use different card |
| `authentication_error` | API authentication failed | Check API credentials |

### Validation Errors

| Code | Description | User Action |
|------|-------------|-------------|
| `invalid_request` | Invalid request parameters | Check request data |
| `invalid_parameter` | Specific parameter invalid | Fix the invalid parameter |
| `resource_not_found` | Resource not found | Verify resource ID |

### Processing Errors

| Code | Description | User Action |
|------|-------------|-------------|
| `processing_error` | Payment processing error | Try again |
| `provider_error` | Provider API error | Try again later |
| `rate_limit_error` | Rate limit exceeded | Wait and retry |
| `duplicate_transaction` | Duplicate transaction detected | Check existing transactions |

## Handling Errors

### Basic Error Handling

```typescript
import { QZPayBilling } from '@qazuor/qzpay-core';

const billing = new QZPayBilling({ storage, paymentAdapter });

try {
  const customer = await billing.customers.create({
    email: 'user@example.com',
    name: 'John Doe'
  });
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed to create customer:', error.message);

    // Check if it's a QZPay error
    if ('code' in error) {
      const qzpayError = error as QZPayError;

      switch (qzpayError.code) {
        case 'VALIDATION_ERROR':
          // Handle validation error
          console.error('Validation failed:', qzpayError.details);
          break;
        case 'DUPLICATE_CUSTOMER':
          // Handle duplicate customer
          console.log('Customer already exists');
          break;
        default:
          // Handle other errors
          console.error('Unexpected error:', qzpayError.code);
      }
    }
  }
}
```

### Payment Error Handling

```typescript
async function processPayment(customerId: string, amount: number) {
  try {
    const payment = await billing.payments.process({
      customerId,
      amount,
      currency: 'USD',
      paymentMethodId: 'pm_123'
    });

    return { success: true, payment };
  } catch (error) {
    // Map error to user-friendly message
    const userMessage = getPaymentErrorMessage(error);

    return {
      success: false,
      error: userMessage,
      code: error instanceof Error && 'code' in error ? error.code : 'unknown'
    };
  }
}

function getPaymentErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !('code' in error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const code = (error as { code: string }).code;

  const messages: Record<string, string> = {
    card_declined: 'Your card was declined. Please try another payment method.',
    insufficient_funds: 'Your payment method has insufficient funds. Please try another card.',
    expired_card: 'Your card has expired. Please update your payment method.',
    incorrect_cvc: 'Invalid security code. Please check and try again.',
    authentication_required: 'Additional authentication is required. Please complete the verification.',
    authentication_failed: 'Authentication failed. Please try again or use a different card.',
    processing_error: 'We couldn\'t process your payment. Please try again.',
    rate_limit_error: 'Too many requests. Please wait a moment and try again.'
  };

  return messages[code] || 'Payment could not be processed. Please try again or contact support.';
}
```

### Subscription Error Handling

```typescript
async function createSubscription(customerId: string, planId: string) {
  try {
    const subscription = await billing.subscriptions.create({
      customerId,
      planId,
      priceId: 'price_123'
    });

    return { success: true, subscription };
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: string }).code;

      switch (code) {
        case 'PAYMENT_METHOD_REQUIRED':
          return {
            success: false,
            error: 'Please add a payment method to continue.',
            requiresPaymentMethod: true
          };

        case 'TRIAL_ALREADY_USED':
          return {
            success: false,
            error: 'You have already used your free trial for this plan.',
            trialUsed: true
          };

        case 'SUBSCRIPTION_LIMIT_EXCEEDED':
          return {
            success: false,
            error: 'You have reached the maximum number of subscriptions.',
            limitExceeded: true
          };

        default:
          return {
            success: false,
            error: 'Failed to create subscription. Please try again.'
          };
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred.'
    };
  }
}
```

### 3D Secure Error Handling

```typescript
async function handlePaymentWith3DS(customerId: string, amount: number) {
  try {
    const payment = await billing.payments.process({
      customerId,
      amount,
      currency: 'EUR',
      paymentMethodId: 'pm_card'
    });

    // Check if 3DS is required
    if (payment.status === 'requires_action') {
      return {
        requiresAction: true,
        clientSecret: payment.clientSecret,
        nextAction: payment.nextAction
      };
    }

    return {
      success: true,
      payment
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: string }).code;

      if (code === 'authentication_required') {
        return {
          requiresAction: true,
          error: 'Please complete the authentication challenge.'
        };
      }

      if (code === 'authentication_failed') {
        return {
          success: false,
          error: 'Authentication failed. Please try again or use a different card.'
        };
      }
    }

    return {
      success: false,
      error: 'Payment failed. Please try again.'
    };
  }
}
```

## Frontend Error Handling (React)

### Using ErrorBoundary

```tsx
import { QZPayErrorBoundary } from '@qazuor/qzpay-react';

function App() {
  return (
    <QZPayErrorBoundary
      fallback={(error) => (
        <div role="alert" style={{ padding: '20px', color: 'red' }}>
          <h2>Payment Error</h2>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      )}
      onError={(error, errorInfo) => {
        // Log to error tracking service
        console.error('Payment component error:', error);
        console.error('Component stack:', errorInfo.componentStack);

        // Send to monitoring service
        logErrorToSentry({
          error,
          errorInfo,
          context: 'PaymentFlow'
        });
      }}
    >
      <PaymentFlow />
    </QZPayErrorBoundary>
  );
}
```

### Hook Error Handling

```tsx
import { usePayments, useProcessPayment } from '@qazuor/qzpay-react';

function PaymentForm({ customerId }) {
  const { processPayment, isProcessing, error } = useProcessPayment();
  const [userMessage, setUserMessage] = useState<string>('');

  const handleSubmit = async (paymentData) => {
    try {
      const result = await processPayment({
        customerId,
        amount: paymentData.amount,
        currency: 'USD',
        paymentMethodId: paymentData.paymentMethodId
      });

      if (result.requiresAction) {
        // Handle 3DS
        setUserMessage('Please complete authentication');
        // Redirect to authentication URL or show modal
      } else {
        setUserMessage('Payment successful!');
      }
    } catch (err) {
      const message = getPaymentErrorMessage(err);
      setUserMessage(message);
    }
  };

  return (
    <div>
      {userMessage && (
        <div role="alert" aria-live="polite">
          {userMessage}
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive">
          {error.message}
        </div>
      )}

      <button onClick={handleSubmit} disabled={isProcessing}>
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
}
```

## Validation Errors

### Core Validation

```typescript
try {
  const customer = await billing.customers.create({
    email: 'invalid-email', // Invalid email format
    name: 'John Doe'
  });
} catch (error) {
  // error.code === 'VALIDATION_ERROR'
  // error.details contains:
  // {
  //   field: 'email',
  //   message: 'Invalid email format',
  //   value: 'invalid-email'
  // }
}
```

### Promo Code Validation

```typescript
try {
  await billing.promoCodes.validate({
    code: 'SUMMER2024',
    customerId: 'cus_123',
    planId: 'plan_basic'
  });
} catch (error) {
  // Possible error codes:
  // - 'PROMO_NOT_FOUND'
  // - 'PROMO_EXPIRED'
  // - 'PROMO_MAX_USES_REACHED'
  // - 'PROMO_ALREADY_USED'
  // - 'PROMO_NOT_APPLICABLE'
  // - 'PROMO_MIN_NOT_MET'
}
```

## Best Practices

### 1. Always Catch Errors

```typescript
// ✅ Good
try {
  await billing.payments.process(paymentData);
} catch (error) {
  handleError(error);
}

// ❌ Bad
await billing.payments.process(paymentData); // Unhandled promise rejection
```

### 2. Provide User-Friendly Messages

```typescript
// ✅ Good
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    return getUserFriendlyMessage(error.code);
  }
  return 'An unexpected error occurred. Please try again.';
}

// ❌ Bad
console.error(error); // Technical error shown to user
```

### 3. Log Errors with Context

```typescript
// ✅ Good
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', {
    operation: 'createPayment',
    customerId,
    amount,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
}

// ❌ Bad
console.log(error); // No context or structure
```

### 4. Preserve Original Errors

```typescript
// ✅ Good
class ApplicationError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'ApplicationError';
  }
}

try {
  await billing.payments.process(data);
} catch (error) {
  throw new ApplicationError('Payment failed', error as Error);
}

// ❌ Bad
try {
  await billing.payments.process(data);
} catch (error) {
  throw new Error('Payment failed'); // Lost original error
}
```

### 5. Use Typed Error Handling

```typescript
// ✅ Good
import { QZPayError } from '@qazuor/qzpay-core';

function isQZPayError(error: unknown): error is QZPayError {
  return error instanceof Error && 'code' in error && 'statusCode' in error;
}

try {
  await operation();
} catch (error) {
  if (isQZPayError(error)) {
    // TypeScript knows this is a QZPayError
    console.log(error.code, error.statusCode);
  }
}

// ❌ Bad
try {
  await operation();
} catch (error: any) {
  console.log(error.code); // No type safety
}
```

## Error Monitoring

### Integration with Error Tracking Services

```typescript
import * as Sentry from '@sentry/node';

function setupErrorMonitoring() {
  // Capture QZPay errors
  billing.on('error', (event) => {
    Sentry.captureException(event.error, {
      tags: {
        component: 'qzpay',
        operation: event.operation
      },
      extra: {
        customerId: event.customerId,
        details: event.details
      }
    });
  });
}
```

## Related Documentation

- [Error Catalog](../05-api/ERROR-CATALOG.md) - Complete error reference
- [Security](../03-architecture/SECURITY.md) - Security error handling
- [Observability](../03-architecture/OBSERVABILITY.md) - Error monitoring
