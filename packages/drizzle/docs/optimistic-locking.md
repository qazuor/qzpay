# Optimistic Locking Implementation Guide

## Overview

Optimistic locking is a concurrency control mechanism that prevents lost updates when multiple processes attempt to modify the same record simultaneously. This implementation uses UUID-based versioning to detect and prevent concurrent modifications.

## How It Works

1. Each record has a `version` field (UUID) that changes on every update
2. When updating, you provide the expected current version
3. The update only succeeds if the version matches
4. If the version doesn't match, `QZPayOptimisticLockError` is thrown
5. The application can then retry with the latest version

## Basic Usage

### Using `updateWithVersionHelper` Directly

```typescript
import { updateWithVersionHelper } from '@qazuor/qzpay-drizzle';
import { billingCustomers } from '@qazuor/qzpay-drizzle/schema';

// Read the current record
const customer = await db
  .select()
  .from(billingCustomers)
  .where(eq(billingCustomers.id, customerId))
  .limit(1);

const currentVersion = customer[0].version;

// Update with version check
const updated = await updateWithVersionHelper(
  db,
  billingCustomers,
  customerId,
  currentVersion,
  { name: 'Updated Name' },
  { entityType: 'Customer', entityId: customerId }
);

console.log(updated.version); // New version (different from currentVersion)
```

### Using Repository Method

```typescript
import { QZPayCustomersRepository } from '@qazuor/qzpay-drizzle';

const customerRepo = new QZPayCustomersRepository(db);

// Read customer
const customer = await customerRepo.findById('cust-123');

if (!customer) {
  throw new Error('Customer not found');
}

// Update with version check
try {
  const updated = await customerRepo.updateWithVersion(
    'cust-123',
    customer.version,
    { name: 'New Name', email: 'newemail@example.com' }
  );

  console.log('Update successful', updated);
} catch (error) {
  if (error instanceof QZPayOptimisticLockError) {
    console.log('Concurrent modification detected, please retry');
  }
  throw error;
}
```

## Race Condition Scenario

```typescript
// Initial state: customer.version = "v1"

// Process A reads the customer
const customerA = await customerRepo.findById('cust-123');
// customerA.version = "v1"

// Process B reads the customer
const customerB = await customerRepo.findById('cust-123');
// customerB.version = "v1"

// Process A updates successfully
await customerRepo.updateWithVersion('cust-123', customerA.version, {
  name: 'Process A Update'
});
// Now customer.version = "v2"

// Process B tries to update with stale version
await customerRepo.updateWithVersion('cust-123', customerB.version, {
  name: 'Process B Update'
});
// ❌ Throws QZPayOptimisticLockError because version "v1" != "v2"
```

## Retry Logic

### Manual Retry

```typescript
async function updateWithRetry(
  customerId: string,
  updateFn: (customer: QZPayBillingCustomer) => Partial<QZPayBillingCustomerInsert>,
  maxRetries = 3
): Promise<QZPayBillingCustomer> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current version
      const customer = await customerRepo.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Apply update function
      const updates = updateFn(customer);

      // Attempt update with version
      return await customerRepo.updateWithVersion(
        customerId,
        customer.version,
        updates
      );
    } catch (error) {
      if (error instanceof QZPayOptimisticLockError && attempt < maxRetries - 1) {
        // Retry on optimistic lock error
        await sleep(100 * (attempt + 1)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const updated = await updateWithRetry('cust-123', (customer) => ({
  name: customer.name + ' (Updated)'
}));
```

### Using Built-in Retry Utility

```typescript
import { withOptimisticRetry } from '@qazuor/qzpay-drizzle';

const updated = await withOptimisticRetry(
  async () => {
    const customer = await customerRepo.findById('cust-123');
    if (!customer) {
      throw new Error('Customer not found');
    }

    return await customerRepo.updateWithVersion(
      'cust-123',
      customer.version,
      { name: 'Updated Name' }
    );
  },
  {
    maxRetries: 5,
    retryDelay: 100,
    backoffMultiplier: 2,
    maxDelay: 1000
  }
);
```

## Advanced Options

### Including Soft-Deleted Records

```typescript
const updated = await updateWithVersionHelper(
  db,
  billingCustomers,
  customerId,
  expectedVersion,
  { name: 'Updated' },
  {
    entityType: 'Customer',
    entityId: customerId,
    includeSoftDeleted: true // Allow updating soft-deleted records
  }
);
```

### Custom Transformation

```typescript
const updated = await updateWithVersionHelper(
  db,
  billingCustomers,
  customerId,
  expectedVersion,
  { name: 'test' },
  {
    entityType: 'Customer',
    entityId: customerId,
    transform: (record) => ({
      ...record,
      name: record.name.toUpperCase() // Transform before returning
    })
  }
);
```

### Async Transformation

```typescript
const updated = await updateWithVersionHelper(
  db,
  billingCustomers,
  customerId,
  expectedVersion,
  { email: 'new@example.com' },
  {
    entityType: 'Customer',
    entityId: customerId,
    transform: async (record) => {
      // Perform async operations
      await sendEmailChangeNotification(record.email);
      return record;
    }
  }
);
```

## Error Handling

### Distinguishing Between Errors

```typescript
import {
  QZPayOptimisticLockError,
  QZPayEntityNotFoundError
} from '@qazuor/qzpay-drizzle';

try {
  const updated = await customerRepo.updateWithVersion(
    customerId,
    expectedVersion,
    { name: 'New Name' }
  );
} catch (error) {
  if (error instanceof QZPayOptimisticLockError) {
    // Version mismatch - record was modified by another process
    console.error('Concurrent modification detected');
    console.error('Entity:', error.entityType, 'ID:', error.entityId);
    // Retry with fresh version
  } else if (error instanceof QZPayEntityNotFoundError) {
    // Record doesn't exist or was soft-deleted
    console.error('Record not found');
    console.error('Entity:', error.entityType, 'ID:', error.entityId);
  } else {
    // Other database errors
    console.error('Unexpected error:', error);
  }
}
```

## When to Use Optimistic Locking

### ✅ Good Use Cases

- **User profile updates**: Multiple clients editing the same profile
- **Inventory management**: Concurrent stock updates
- **Financial transactions**: Balance updates
- **Configuration changes**: Settings that change infrequently
- **Any critical data**: Where data integrity is essential

### ❌ When Not to Use

- **High-contention scenarios**: If conflicts happen frequently (>10%), consider pessimistic locking
- **Simple reads**: No need for versioning
- **Append-only data**: Logs, events that never update
- **Performance-critical paths**: The extra version check adds latency

## Testing Optimistic Locking

```typescript
import { describe, it, expect } from 'vitest';

describe('Optimistic Locking', () => {
  it('should prevent concurrent modifications', async () => {
    // Create initial record
    const customer = await customerRepo.create({
      externalId: 'test',
      email: 'test@example.com',
      name: 'Original',
      livemode: true
    });

    const version = customer.version;

    // First update succeeds
    const update1 = await customerRepo.updateWithVersion(
      customer.id,
      version,
      { name: 'Update 1' }
    );

    // Second update with stale version fails
    await expect(
      customerRepo.updateWithVersion(
        customer.id,
        version, // Old version
        { name: 'Update 2' }
      )
    ).rejects.toThrow(QZPayOptimisticLockError);

    // Verify first update persisted
    const final = await customerRepo.findById(customer.id);
    expect(final?.name).toBe('Update 1');
  });
});
```

## Best Practices

1. **Always read before update**: Get the current version immediately before updating
2. **Implement retry logic**: Handle `QZPayOptimisticLockError` gracefully
3. **Use exponential backoff**: Avoid thundering herd on retries
4. **Set max retries**: Prevent infinite retry loops
5. **Log conflicts**: Monitor for high conflict rates
6. **Consider UI feedback**: Inform users of concurrent modifications
7. **Transaction boundaries**: Keep read-update cycles short
8. **Document critical sections**: Mark code that requires versioning

## Common Patterns

### Read-Modify-Update

```typescript
// ✅ Correct: Read immediately before update
async function incrementBalance(customerId: string, amount: number) {
  const customer = await customerRepo.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  return await customerRepo.updateWithVersion(
    customerId,
    customer.version,
    { balance: (customer.balance || 0) + amount }
  );
}

// ❌ Incorrect: Stale version
async function incrementBalanceWrong(customerId: string, amount: number) {
  const customer = await customerRepo.findById(customerId);
  // ... long-running operations ...
  await someSlowOperation();
  // Version might be stale now!
  return await customerRepo.updateWithVersion(
    customerId,
    customer.version, // Stale version
    { balance: (customer.balance || 0) + amount }
  );
}
```

### Batch Updates with Versioning

```typescript
async function updateMultipleCustomers(
  updates: Array<{ id: string; data: Partial<QZPayBillingCustomerInsert> }>
) {
  const results = await Promise.allSettled(
    updates.map(async ({ id, data }) => {
      const customer = await customerRepo.findById(id);
      if (!customer) {
        throw new Error(`Customer ${id} not found`);
      }

      return await customerRepo.updateWithVersion(id, customer.version, data);
    })
  );

  // Process results
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  return { succeeded, failed };
}
```

## Performance Considerations

- **Extra SELECT**: Version checking adds one SELECT query per update
- **Network round-trips**: In distributed systems, version checks increase latency
- **Retry overhead**: Failed updates require re-reading and re-attempting
- **Database load**: High conflict rates increase database load

### Optimization Tips

1. **Batch reads**: Fetch multiple records in one query
2. **Cache versions**: Short-lived cache for frequently accessed records
3. **Reduce scope**: Only version critical fields
4. **Monitor conflicts**: Track conflict rates and adjust strategy
