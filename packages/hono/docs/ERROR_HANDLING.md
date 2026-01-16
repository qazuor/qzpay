# Error Handling in @qazuor/qzpay-hono

This document describes the error handling system in the QZPay Hono package.

## Overview

The error handling system provides consistent HTTP status codes and error responses across all API routes. It automatically maps common error patterns to appropriate HTTP status codes.

## Components

### 1. QZPayHttpError

Custom error class for explicit HTTP errors.

```typescript
import { QZPayHttpError, HttpStatus } from '@qazuor/qzpay-hono';

throw new QZPayHttpError(
  HttpStatus.NOT_FOUND,
  'CUSTOMER_NOT_FOUND',
  'Customer with ID cus_123 not found'
);
```

### 2. HttpStatus

Constants for standard HTTP status codes.

```typescript
import { HttpStatus } from '@qazuor/qzpay-hono';

HttpStatus.OK                    // 200
HttpStatus.CREATED               // 201
HttpStatus.BAD_REQUEST           // 400
HttpStatus.UNAUTHORIZED          // 401
HttpStatus.FORBIDDEN             // 403
HttpStatus.NOT_FOUND             // 404
HttpStatus.CONFLICT              // 409
HttpStatus.UNPROCESSABLE_ENTITY  // 422
HttpStatus.TOO_MANY_REQUESTS     // 429
HttpStatus.INTERNAL_SERVER_ERROR // 500
```

### 3. Error Mapper

Automatically maps error messages to HTTP status codes based on patterns.

```typescript
import { mapErrorToHttpStatus } from '@qazuor/qzpay-hono';

const error = new Error('Customer not found');
const { status, code, message } = mapErrorToHttpStatus(error);
// { status: 404, code: 'NOT_FOUND', message: 'Customer not found' }
```

#### Mapping Rules

| Pattern | Status | Code |
|---------|--------|------|
| "not found", "does not exist" | 404 | NOT_FOUND |
| "already exists", "duplicate" | 409 | CONFLICT |
| "invalid", "validation", "required" | 422 | VALIDATION_ERROR |
| "bad request", "malformed" | 400 | BAD_REQUEST |
| "unauthorized", "authentication" | 401 | UNAUTHORIZED |
| "forbidden", "permission" | 403 | FORBIDDEN |
| "rate limit", "too many requests" | 429 | RATE_LIMIT_EXCEEDED |
| Default | 500 | INTERNAL_ERROR |

### 4. Error Middleware

Global error handling middleware.

```typescript
import { Hono } from 'hono';
import { createErrorMiddleware } from '@qazuor/qzpay-hono';

const app = new Hono();

// Add global error handler
app.use('*', createErrorMiddleware({
  includeStackTrace: process.env.NODE_ENV === 'development',
  logErrors: true
}));

// Your routes
app.get('/customers/:id', async (c) => {
  const customer = await getCustomer(c.req.param('id'));
  if (!customer) {
    throw new Error('Customer not found'); // Will return 404
  }
  return c.json(customer);
});
```

## Usage Patterns

### Throwing Explicit Errors

```typescript
import { throwHttpError, HttpStatus } from '@qazuor/qzpay-hono';

app.get('/customers/:id', async (c) => {
  const customer = await getCustomer(c.req.param('id'));
  if (!customer) {
    throwHttpError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
  }
  return c.json(customer);
});
```

### Using withErrorHandling

Wrap route handlers for automatic error handling.

```typescript
import { withErrorHandling } from '@qazuor/qzpay-hono';

app.get('/customers/:id', withErrorHandling(async (c) => {
  const customer = await getCustomer(c.req.param('id'));
  if (!customer) {
    throw new Error('Customer not found'); // Automatically mapped to 404
  }
  return { success: true, data: customer };
}));
```

### Custom Error Handlers

```typescript
const app = new Hono();

app.use('*', createErrorMiddleware({
  onError: async (error, c) => {
    // Log to monitoring service
    await logError(error);

    // Custom response format
    return c.json({
      status: 'error',
      message: error.message,
      requestId: c.req.header('x-request-id')
    }, 500);
  }
}));
```

### 404 Handler

Handle unmatched routes.

```typescript
import { notFoundMiddleware } from '@qazuor/qzpay-hono';

const app = new Hono();

// Add at the end of your routes
app.use('*', notFoundMiddleware);
```

## Error Response Format

All errors return a consistent JSON format:

```typescript
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Customer not found",
    "stack": "..." // Only in development when includeStackTrace: true
  }
}
```

## Best Practices

### 1. Use Descriptive Error Messages

```typescript
// Bad
throw new Error('Error');

// Good
throw new Error('Customer with ID cus_123 not found');
```

### 2. Use Appropriate Error Patterns

```typescript
// These will automatically map to 404
throw new Error('Customer not found');
throw new Error('Resource does not exist');

// These will automatically map to 409
throw new Error('Customer already exists');
throw new Error('Duplicate email address');

// These will automatically map to 422
throw new Error('Invalid email format');
throw new Error('Email is required');
throw new Error('Validation failed for field');
```

### 3. Use Explicit Errors for Ambiguous Cases

```typescript
// If error message doesn't match patterns, be explicit
throw new QZPayHttpError(
  HttpStatus.CONFLICT,
  'SUBSCRIPTION_ACTIVE',
  'Cannot delete customer with active subscription'
);
```

### 4. Enable Stack Traces in Development

```typescript
app.use('*', createErrorMiddleware({
  includeStackTrace: process.env.NODE_ENV === 'development'
}));
```

### 5. Log Errors for Monitoring

```typescript
app.use('*', createErrorMiddleware({
  logErrors: true,
  onError: async (error, c) => {
    // Send to monitoring service
    await monitoring.captureException(error, {
      context: {
        path: c.req.path,
        method: c.req.method,
        userId: c.get('userId')
      }
    });

    // Return default error response
    const { response, status } = createErrorResponse(error);
    return c.json(response, status);
  }
}));
```

## Testing

### Testing Error Status Codes

```typescript
import { describe, it, expect } from 'vitest';

describe('Customer Routes', () => {
  it('should return 404 for non-existent customer', async () => {
    const response = await app.request('/customers/invalid');

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('should return 409 for duplicate customer', async () => {
    const response = await app.request('/customers', {
      method: 'POST',
      body: JSON.stringify({ email: 'existing@example.com' })
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe('CONFLICT');
  });
});
```

## Migration Guide

### From Legacy Error Handling

Before:
```typescript
try {
  const customer = await billing.customers.get(id);
  if (!customer) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }
  return c.json({ success: true, data: customer });
} catch (error) {
  return c.json({ success: false, error: error.message }, 500);
}
```

After:
```typescript
try {
  const customer = await billing.customers.get(id);
  if (!customer) {
    throw new Error('Customer not found'); // Auto-mapped to 404
  }
  return c.json({ success: true, data: customer });
} catch (error) {
  const [errorResponse, statusCode] = createErrorResponse(error);
  return c.json(errorResponse, statusCode);
}
```

Or with global middleware:
```typescript
app.get('/customers/:id', async (c) => {
  const customer = await billing.customers.get(c.req.param('id'));
  if (!customer) {
    throw new Error('Customer not found');
  }
  return c.json({ success: true, data: customer });
});
```

## Utilities

### Check Error Types

```typescript
import {
  isNotFoundError,
  isValidationError,
  isConflictError
} from '@qazuor/qzpay-hono';

try {
  await operation();
} catch (error) {
  if (isNotFoundError(error)) {
    // Handle 404
  } else if (isValidationError(error)) {
    // Handle 422
  } else if (isConflictError(error)) {
    // Handle 409
  } else {
    // Handle other errors
  }
}
```

## Common Scenarios

### Validation Errors

```typescript
app.post('/customers', async (c) => {
  const body = await c.req.json();

  if (!body.email) {
    throw new Error('Email is required'); // 422
  }

  if (!isValidEmail(body.email)) {
    throw new Error('Invalid email format'); // 422
  }

  // ... create customer
});
```

### Not Found Errors

```typescript
app.get('/customers/:id', async (c) => {
  const customer = await billing.customers.get(c.req.param('id'));

  if (!customer) {
    throw new Error('Customer not found'); // 404
  }

  return c.json({ success: true, data: customer });
});
```

### Conflict Errors

```typescript
app.post('/customers', async (c) => {
  const body = await c.req.json();

  const existing = await billing.customers.getByEmail(body.email);
  if (existing) {
    throw new Error('Customer already exists'); // 409
  }

  // ... create customer
});
```

### Authorization Errors

```typescript
app.delete('/customers/:id', async (c) => {
  const userId = c.get('userId');
  const customer = await billing.customers.get(c.req.param('id'));

  if (customer.userId !== userId) {
    throw new QZPayHttpError(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'You do not have permission to delete this customer'
    ); // 403
  }

  // ... delete customer
});
```
