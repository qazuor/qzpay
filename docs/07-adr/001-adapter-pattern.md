# ADR-001: Adapter Pattern for Extensibility

## Status

Accepted

## Date

2024-12-26

## Context

@qazuor/qzpay needs to support multiple payment providers (Stripe, MercadoPago, future providers), multiple databases (Drizzle, Prisma, custom), and multiple frameworks (Hono, NestJS, Express). Without abstraction, the core logic would be tightly coupled to specific implementations.

## Decision

Use the Adapter Pattern to abstract all external dependencies:

1. **Payment Adapter** - Abstract payment provider operations
2. **Storage Adapter** - Abstract database operations
3. **Email Adapter** - Abstract email sending

Each adapter defines a clear interface that implementations must fulfill.

```typescript
// Payment adapter interface
export interface QZPayPaymentAdapter {
  createCustomer(data: CreateCustomerData): Promise<ProviderCustomer>;
  createPayment(data: CreatePaymentData): Promise<ProviderPayment>;
  // ... other methods
}

// Storage adapter interface
export interface QZPayStorageAdapter {
  customers: QZPayCustomerCollection;
  subscriptions: QZPaySubscriptionCollection;
  transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
  // ... other collections
}
```

## Consequences

### Positive

- Core logic remains unchanged when adding new providers
- Easy to test with mock adapters
- Projects can implement custom adapters
- Clear separation of concerns
- Future-proof architecture

### Negative

- Additional abstraction layer adds complexity
- Adapter interfaces must be carefully designed
- Breaking changes in interfaces affect all implementations

## Alternatives Considered

### 1. Direct Integration

Integrate directly with Stripe/MP without abstraction.

- **Rejected**: Would require rewriting core logic for each provider

### 2. Plugin System

Use a plugin architecture with dynamic loading.

- **Rejected**: Over-engineered for current needs, can add later if needed

### 3. Strategy Pattern Only

Use strategy pattern for algorithms only.

- **Rejected**: Doesn't address storage and framework coupling

## References

- [Design Patterns](../03-architecture/PATTERNS.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
