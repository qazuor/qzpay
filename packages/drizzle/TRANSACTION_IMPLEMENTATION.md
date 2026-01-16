# Transaction Support Implementation Summary

## Overview

Added comprehensive transaction support to `@qazuor/qzpay-drizzle` for multi-table operations requiring ACID guarantees.

## Files Created

### 1. `/src/utils/transaction.ts`
Main transaction utility module with the following functions:

- **`withTransaction(db, fn)`**: Basic transaction wrapper
- **`transactional(db, operations)`**: Execute multiple operations sequentially
- **`retryTransaction(db, fn, options)`**: Automatic retry with exponential backoff
- **`withIsolationLevel(db, level, fn)`**: Transaction with specific isolation level
- **`executeTransaction(db, options, fn)`**: Transaction with custom configuration

### 2. `/src/examples/transactions.example.ts`
Six comprehensive examples demonstrating:

1. Create invoice with lines
2. Create subscription with promo code
3. Handle race conditions with retry
4. Use serializable isolation for critical operations
5. Complex subscription renewal with full configuration
6. Nested transactions (using savepoints)

### 3. `/test/utils/transaction.test.ts`
Complete test suite covering:

- Commit on success
- Rollback on error
- Multiple operations
- Partial failure handling
- Sequential operations
- Retry logic
- Custom isolation levels
- Real-world scenarios (invoice creation)

### 4. `/TRANSACTIONS.md`
Comprehensive documentation including:

- Quick start guide
- API reference for all functions
- Common patterns (6 patterns)
- Error handling strategies
- Isolation level guidance
- Best practices (DO/DON'T lists)
- Performance considerations
- Migration guide from non-transactional code

## Key Features

### Type Safety
```typescript
export type QZPayTransaction = PgTransaction<
    PostgresJsQueryResultHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
>;
```

### Automatic Rollback
```typescript
await withTransaction(db, async (tx) => {
    const invoice = await repo.create(tx, data);
    // If this fails, invoice creation is rolled back
    const lines = await repo.createLines(tx, lineItems);
    return { invoice, lines };
});
```

### Retry Logic
```typescript
await retryTransaction(db, async (tx) => {
    return await operation(tx);
}, {
    maxRetries: 3,
    baseDelay: 100,
    shouldRetry: (error) => error.message.includes('deadlock')
});
```

### Isolation Levels
- Read Uncommitted
- Read Committed (default)
- Repeatable Read
- Serializable

## API

### `withTransaction`
Basic transaction wrapper that commits on success and rolls back on error.

**Usage:**
```typescript
const result = await withTransaction(db, async (tx) => {
    // Operations using tx
    return result;
});
```

### `transactional`
Execute array of operations sequentially in a transaction.

**Usage:**
```typescript
const [sub, usage] = await transactional(db, [
    async (tx) => subscriptionRepo.create(tx, data),
    async (tx) => promoCodeRepo.recordUsage(tx, usage)
]);
```

### `retryTransaction`
Retry transaction on transient errors with exponential backoff.

**Usage:**
```typescript
await retryTransaction(db, async (tx) => {
    return await operation(tx);
}, { maxRetries: 3, baseDelay: 100 });
```

### `withIsolationLevel`
Execute transaction with specific isolation level.

**Usage:**
```typescript
await withIsolationLevel(db, 'serializable', async (tx) => {
    return await criticalOperation(tx);
});
```

### `executeTransaction`
Transaction with full configuration.

**Usage:**
```typescript
await executeTransaction(db, {
    isolationLevel: 'repeatable read',
    autoRetry: true,
    maxRetries: 3
}, async (tx) => {
    return await operation(tx);
});
```

## Common Patterns

### Pattern 1: Create Parent with Children
```typescript
const { invoice, lines } = await withTransaction(db, async (tx) => {
    const invoiceRepo = new QZPayInvoicesRepository(tx);
    const invoice = await invoiceRepo.create(data);
    const lines = await invoiceRepo.createLines(lineItems);
    return { invoice, lines };
});
```

### Pattern 2: Multi-Table Updates
```typescript
await withTransaction(db, async (tx) => {
    await subscriptionRepo.create(tx, subData);
    await promoCodeRepo.recordUsage(tx, usageData);
});
```

### Pattern 3: Conditional Operations
```typescript
await withTransaction(db, async (tx) => {
    const promoCode = await promoCodeRepo.validateAndGet(tx, code);
    if (!promoCode.valid) {
        throw new Error(promoCode.error);
    }
    return await promoCodeRepo.recordUsage(tx, data);
});
```

## Integration Points

### Updated Files

**`/src/repositories/base.repository.ts`**
- Added JSDoc documentation about transaction support
- Links to `withTransaction` utility

**`/src/utils/index.ts`**
- Exported all transaction utilities
- Added proper TypeScript types

## Testing

### Test Coverage
- Basic transaction operations
- Rollback scenarios
- Sequential operations
- Retry logic
- Isolation levels
- Real-world use cases

### Running Tests
```bash
cd packages/drizzle
npx vitest run test/utils/transaction.test.ts
```

## Migration Guide

### Before (No Transactions)
```typescript
// ❌ Not atomic - partial failures possible
const invoice = await invoiceRepo.create(invoiceData);
const lines = await invoiceRepo.createLines(lineItems);
```

### After (With Transactions)
```typescript
// ✅ Atomic - all or nothing
const { invoice, lines } = await withTransaction(db, async (tx) => {
    const invoiceRepoTx = new QZPayInvoicesRepository(tx);
    const invoice = await invoiceRepoTx.create(invoiceData);
    const lines = await invoiceRepoTx.createLines(lineItems);
    return { invoice, lines };
});
```

## Best Practices

### DO
1. Keep transactions short
2. Use appropriate isolation levels
3. Handle errors gracefully
4. Use retry logic for transient errors
5. Pass transaction context to repositories

### DON'T
1. Perform I/O inside transactions (HTTP calls, file operations)
2. Hold transactions open during user interaction
3. Nest transactions unnecessarily
4. Catch errors without re-throwing
5. Mix transactional and non-transactional operations

## Performance Considerations

- **Connection Pooling**: Transactions use connections from the pool
- **Lock Contention**: Keep transactions short to reduce lock contention
- **Deadlock Prevention**: Access tables in consistent order

## Error Handling

### Automatic Rollback
All errors thrown within a transaction trigger automatic rollback:

```typescript
try {
    await withTransaction(db, async (tx) => {
        // Operations...
        throw new Error('Rollback');
    });
} catch (error) {
    // Transaction was rolled back
}
```

### Retry on Transient Errors
Use `retryTransaction` for operations that might fail due to concurrent access:

```typescript
await retryTransaction(db, async (tx) => {
    return await operation(tx);
}, {
    maxRetries: 3,
    shouldRetry: (error) => error.message.includes('deadlock')
});
```

## Future Enhancements

Potential improvements for v2:
1. Nested transaction support with savepoints
2. Transaction timeout configuration
3. Transaction statistics/monitoring
4. Distributed transaction support
5. Transaction hooks (before/after)

## References

- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)
- [ACID Properties](https://en.wikipedia.org/wiki/ACID)
