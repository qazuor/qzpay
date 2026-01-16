# Transaction Support

This document explains how to use transactions in `@qazuor/qzpay-drizzle` for multi-table operations.

## Overview

Transactions ensure that multiple database operations are executed atomically. Either all operations succeed (commit), or none of them do (rollback). This is critical for maintaining data consistency.

## Quick Start

```typescript
import { withTransaction } from '@qazuor/qzpay-drizzle/utils';
import { QZPayInvoicesRepository } from '@qazuor/qzpay-drizzle';

// Create invoice with lines in a transaction
const result = await withTransaction(db, async (tx) => {
  const invoiceRepo = new QZPayInvoicesRepository(tx);

  // Create invoice
  const invoice = await invoiceRepo.create(invoiceData);

  // Create lines
  const lines = await invoiceRepo.createLines(lineItems);

  // If anything fails, everything is rolled back
  return { invoice, lines };
});
```

## API Reference

### `withTransaction`

Execute a callback within a database transaction.

**Signature:**
```typescript
async function withTransaction<T>(
  db: PostgresJsDatabase,
  fn: (tx: PgTransaction) => Promise<T>
): Promise<T>
```

**Example:**
```typescript
const { invoice, lines } = await withTransaction(db, async (tx) => {
  const invoiceRepo = new QZPayInvoicesRepository(tx);

  const invoice = await invoiceRepo.create({
    customerId: 'cust_123',
    number: 'INV-001',
    status: 'open',
    subtotal: 10000,
    total: 10000,
    amountRemaining: 10000,
    currency: 'usd',
    livemode: true
  });

  const lines = await invoiceRepo.createLines([
    {
      invoiceId: invoice.id,
      description: 'Monthly subscription',
      quantity: 1,
      unitAmount: 10000,
      amount: 10000,
      currency: 'usd'
    }
  ]);

  return { invoice, lines };
});
```

### `transactional`

Execute multiple operations sequentially in a transaction.

**Signature:**
```typescript
async function transactional<T extends unknown[]>(
  db: PostgresJsDatabase,
  operations: Array<(tx: PgTransaction) => Promise<unknown>>
): Promise<T>
```

**Example:**
```typescript
const [subscription, usage] = await transactional(db, [
  async (tx) => {
    const repo = new QZPaySubscriptionsRepository(tx);
    return repo.create(subscriptionData);
  },
  async (tx) => {
    const repo = new QZPayPromoCodesRepository(tx);
    return repo.recordUsage(usageData);
  }
]);
```

### `retryTransaction`

Retry a transaction with exponential backoff on transient errors.

**Signature:**
```typescript
async function retryTransaction<T>(
  db: PostgresJsDatabase,
  fn: (tx: PgTransaction) => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T>
```

**Example:**
```typescript
const result = await retryTransaction(
  db,
  async (tx) => {
    // Operation that might fail due to deadlock
    return await updateWithConflict(tx, data);
  },
  {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 1000
  }
);
```

**Default Retry Conditions:**
- `deadlock`
- `serialization`
- `could not serialize`
- `concurrent update`

### `withIsolationLevel`

Execute a transaction with a specific isolation level.

**Signature:**
```typescript
async function withIsolationLevel<T>(
  db: PostgresJsDatabase,
  isolationLevel: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable',
  fn: (tx: PgTransaction) => Promise<T>
): Promise<T>
```

**Example:**
```typescript
const result = await withIsolationLevel(
  db,
  'serializable',
  async (tx) => {
    // Critical operation requiring highest consistency
    return await processPayment(tx, paymentData);
  }
);
```

### `executeTransaction`

Execute a transaction with custom configuration.

**Signature:**
```typescript
async function executeTransaction<T>(
  db: PostgresJsDatabase,
  options: {
    isolationLevel?: QZPayIsolationLevel;
    maxRetries?: number;
    autoRetry?: boolean;
    shouldRetry?: (error: Error) => boolean;
  },
  fn: (tx: PgTransaction) => Promise<T>
): Promise<T>
```

**Example:**
```typescript
const result = await executeTransaction(
  db,
  {
    isolationLevel: 'serializable',
    autoRetry: true,
    maxRetries: 3
  },
  async (tx) => {
    return await criticalOperation(tx);
  }
);
```

## Common Patterns

### Pattern 1: Create Parent with Children

```typescript
// Create invoice with lines
const { invoice, lines } = await withTransaction(db, async (tx) => {
  const repo = new QZPayInvoicesRepository(tx);

  const invoice = await repo.create(invoiceData);
  const lines = await repo.createLines(
    lineItems.map(item => ({ ...item, invoiceId: invoice.id }))
  );

  return { invoice, lines };
});
```

### Pattern 2: Multi-Table Updates

```typescript
// Update subscription and record promo code usage
const result = await withTransaction(db, async (tx) => {
  const subscriptionRepo = new QZPaySubscriptionsRepository(tx);
  const promoCodeRepo = new QZPayPromoCodesRepository(tx);

  const subscription = await subscriptionRepo.create(subscriptionData);
  const usage = await promoCodeRepo.recordUsage({
    promoCodeId: promoCode.id,
    customerId: subscription.customerId,
    subscriptionId: subscription.id,
    discountAmount: 1000,
    usedAt: new Date()
  });

  return { subscription, usage };
});
```

### Pattern 3: Conditional Operations

```typescript
// Apply promo code only if valid
const result = await withTransaction(db, async (tx) => {
  const promoCodeRepo = new QZPayPromoCodesRepository(tx);

  const validation = await promoCodeRepo.validateAndGet(code, customerId);

  if (!validation.valid || !validation.promoCode) {
    throw new Error(validation.error ?? 'Invalid promo code');
  }

  const hasUsed = await promoCodeRepo.hasCustomerUsedCode(
    validation.promoCode.id,
    customerId
  );

  if (hasUsed) {
    throw new Error('Promo code already used');
  }

  return await promoCodeRepo.recordUsage({
    promoCodeId: validation.promoCode.id,
    customerId,
    subscriptionId,
    discountAmount: validation.promoCode.discountAmount,
    usedAt: new Date()
  });
});
```

### Pattern 4: Batch Operations

```typescript
// Create multiple records atomically
const invoices = await withTransaction(db, async (tx) => {
  const repo = new QZPayInvoicesRepository(tx);

  return Promise.all(
    invoiceDataArray.map(data => repo.create(data))
  );
});
```

### Pattern 5: Read-Modify-Write

```typescript
// Update with read consistency
const result = await withIsolationLevel(db, 'repeatable read', async (tx) => {
  const repo = new QZPaySubscriptionsRepository(tx);

  // Read current state
  const subscription = await repo.findById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Modify based on current state
  const newPeriodEnd = new Date(subscription.currentPeriodEnd);
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

  // Write updated state
  return repo.updateBillingPeriod(subscriptionId, subscription.currentPeriodEnd, newPeriodEnd);
});
```

## Error Handling

### Rollback on Error

Transactions automatically roll back when an error is thrown:

```typescript
try {
  await withTransaction(db, async (tx) => {
    const repo = new QZPayInvoicesRepository(tx);

    const invoice = await repo.create(invoiceData);

    // This will trigger a rollback
    if (invoice.total > 1000000) {
      throw new Error('Invoice amount too large');
    }

    return invoice;
  });
} catch (error) {
  // Transaction was rolled back
  console.error('Transaction failed:', error);
}
```

### Retry on Transient Errors

Use `retryTransaction` for operations that might fail due to concurrent access:

```typescript
const result = await retryTransaction(
  db,
  async (tx) => {
    // Operation that might deadlock
    return await updatePopularRecord(tx, data);
  },
  {
    maxRetries: 3,
    baseDelay: 100
  }
);
```

### Custom Retry Logic

```typescript
const result = await retryTransaction(
  db,
  async (tx) => {
    return await riskyOperation(tx);
  },
  {
    maxRetries: 5,
    baseDelay: 50,
    maxDelay: 2000,
    shouldRetry: (error) => {
      // Only retry on specific errors
      return error.message.includes('temporary failure');
    }
  }
);
```

## Isolation Levels

### Read Committed (Default)

Good for most operations. Prevents dirty reads.

```typescript
const result = await withTransaction(db, async (tx) => {
  // Uses default isolation level
  return await standardOperation(tx);
});
```

### Repeatable Read

Prevents non-repeatable reads. Use for operations that read the same data multiple times.

```typescript
const result = await withIsolationLevel(db, 'repeatable read', async (tx) => {
  const balance = await getBalance(tx, accountId);
  // Balance won't change within this transaction
  return await processWithBalance(tx, balance);
});
```

### Serializable

Highest isolation level. Use for critical operations requiring full consistency.

```typescript
const result = await withIsolationLevel(db, 'serializable', async (tx) => {
  // Guarantees serializable execution
  return await criticalFinancialOperation(tx);
});
```

## Best Practices

### DO

1. **Keep transactions short**: Long transactions increase lock contention
2. **Use appropriate isolation levels**: Don't use higher levels than needed
3. **Handle errors gracefully**: Always wrap transactions in try-catch
4. **Use retry logic for transient errors**: Deadlocks and serialization failures can happen
5. **Pass transaction context to repositories**: Ensure operations use the same transaction

### DON'T

1. **Don't perform I/O inside transactions**: HTTP calls, file operations, etc.
2. **Don't hold transactions open during user interaction**: Keep them short
3. **Don't nest transactions unnecessarily**: Drizzle handles savepoints automatically
4. **Don't catch errors without re-throwing**: This prevents rollback
5. **Don't mix transactional and non-transactional operations**: Use transaction for all related ops

## Performance Considerations

### Connection Pooling

Transactions use connections from the pool. Monitor pool utilization:

```typescript
const stats = await getPoolStats(db);
console.log(`Active connections: ${stats.activeCount}`);
```

### Lock Contention

Reduce lock contention by:
- Keeping transactions short
- Ordering updates consistently
- Using appropriate isolation levels
- Implementing retry logic

### Deadlock Prevention

Prevent deadlocks by:
- Accessing tables in consistent order
- Using `retryTransaction` for high-contention operations
- Keeping transactions brief

## Migration from Non-Transactional Code

### Before

```typescript
// ❌ Not atomic - partial failures possible
const invoice = await invoiceRepo.create(invoiceData);
const lines = await invoiceRepo.createLines(lineItems);
```

### After

```typescript
// ✅ Atomic - all or nothing
const { invoice, lines } = await withTransaction(db, async (tx) => {
  const invoiceRepoTx = new QZPayInvoicesRepository(tx);
  const invoice = await invoiceRepoTx.create(invoiceData);
  const lines = await invoiceRepoTx.createLines(lineItems);
  return { invoice, lines };
});
```

## Testing

See `test/utils/transaction.test.ts` for comprehensive test examples.

## Further Reading

- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)
- [ACID Properties](https://en.wikipedia.org/wiki/ACID)
