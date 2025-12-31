---
name: error-handling-patterns
category: patterns
description: Standardized error handling patterns for database, API, and frontend layers
usage: Use when implementing error handling across application layers
input: Error scenarios, application context, error types
output: Error handling code, custom error classes
  database_error_codes: "Database-specific error codes mapping (e.g., PostgreSQL, MySQL)"
  http_status_codes: "HTTP status codes used in API responses"
  error_logging_service: "Error logging service (e.g., Sentry, LogRocket, console)"
  frontend_framework: "Frontend framework (React, Vue, Angular, etc.)"
---

# Error Handling Patterns

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `database_error_codes` | Database-specific error codes for constraint violations | PostgreSQL: `23505` (unique), `23503` (foreign key) |
| `http_status_codes` | HTTP status codes for different error types | `400` (validation), `404` (not found), `500` (server) |
| `error_logging_service` | Service for logging unexpected errors | Sentry, LogRocket, console |
| `frontend_framework` | Framework for UI error boundaries | React, Vue, Angular |

## Purpose

Provide consistent, type-safe error handling across database, service, API, and frontend layers with:
- Custom error class hierarchy
- Secure error messages (no internal leaks)
- Operational vs programming error distinction
- Proper error propagation

## Error Class Hierarchy

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

// Domain-specific errors
export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}
```

## Layer-Specific Patterns

### Database Layer

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Resource Not Found | Record doesn't exist | Throw `NotFoundError` |
| Constraint Violation | Unique, FK violations | Map DB codes to `ConflictError`/`ValidationError` |
| Unexpected Error | Unknown DB errors | Throw `AppError` with `isOperational: false` |

```typescript
try {
  const record = await db.table.findFirst({ where: eq(table.id, id) });
  if (!record) throw new NotFoundError('Resource', id);
  return record;
} catch (error) {
  if (error instanceof AppError) throw error;

  // Map database-specific codes
  if (error.code === '23505') {
    throw new ConflictError('Resource already exists');
  }

  throw new AppError('Database operation failed', 500, 'DATABASE_ERROR', false);
}
```

### Service Layer

```typescript
async create(data: Input): Promise<Output> {
  // Validate business rules
  if (data.startDate >= data.endDate) {
    throw new ValidationError('End date must be after start date', {
      startDate: 'Must be before end date',
      endDate: 'Must be after start date'
    });
  }

  // Check availability
  const isAvailable = await this.checkAvailability(data);
  if (!isAvailable) {
    throw new ConflictError('Resource not available');
  }

  try {
    return await this.repository.create(data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Create failed', 500, 'CREATE_FAILED', false);
  }
}
```

### API Layer

```typescript
// Global error handler
export const errorHandler = async (err: Error, context: Context) => {
  // Log non-operational errors
  if (err instanceof AppError && !err.isOperational) {
    console.error('Non-operational error:', err);
  }

  // Handle operational errors
  if (err instanceof AppError) {
    return context.json({
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && { fields: err.fields })
      }
    }, err.statusCode);
  }

  // Schema validation errors
  if (err instanceof ZodError) {
    return context.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        fields: err.flatten().fieldErrors
      }
    }, 400);
  }

  // Unknown errors (sanitized)
  console.error('Unexpected error:', err);
  return context.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500);
};
```

### Frontend Layer

```typescript
// Error Boundary (React)
export class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Query error handling
const { data, error } = useQuery({
  queryFn: async () => {
    const response = await fetch('/api/resource');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    return response.json();
  },
  retry: (failureCount, error) => {
    // Don't retry client errors
    if (error.message.includes('400') || error.message.includes('404')) {
      return false;
    }
    // Retry server errors up to 3 times
    return failureCount < 3;
  }
});
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Custom Error Classes** | Use domain-specific errors for clarity |
| **Fail Fast** | Validate early, throw errors immediately |
| **Preserve Stack Traces** | Use `Error.captureStackTrace` |
| **Don't Leak Internals** | Sanitize error messages in production |
| **Log Unexpected Errors** | Always log non-operational errors |
| **Type-Safe Errors** | Use TypeScript for error types |
| **Operational vs Programming** | Distinguish between expected and unexpected errors |
| **Error Boundaries** | Catch UI errors with error boundaries |

## Anti-Patterns to Avoid

- ❌ Catching all errors without handling them
- ❌ Exposing stack traces in production
- ❌ Generic error messages without context
- ❌ Silently swallowing errors
- ❌ Using error codes inconsistently

## Related Skills

- `tdd-methodology` - Test error scenarios
- `api-app-testing` - Test error responses
