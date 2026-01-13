# @qazuor/qzpay-dev

Development utilities and mock adapters for testing and development with QZPay.

## Installation

```bash
pnpm add -D @qazuor/qzpay-dev
```

## Features

- **Mock Payment Adapter**: Simulates payment provider without external dependencies
- **Memory Storage Adapter**: In-memory storage for fast testing
- **Test Cards**: Predefined test card numbers for various scenarios
- **Data Seeds**: Pre-configured data templates for common use cases

## Usage

### Mock Payment Adapter

Use the mock payment adapter for testing without hitting real payment providers:

```typescript
import { createMockPaymentAdapter } from '@qazuor/qzpay-dev';
import { QZPayBilling } from '@qazuor/qzpay-core';

const mockAdapter = createMockPaymentAdapter({
  // Configure mock behavior
  defaultDelay: 100, // Simulate network delay
  defaultSuccess: true // Default to successful operations
});

const billing = new QZPayBilling({
  storage: storageAdapter,
  paymentAdapter: mockAdapter
});

// Use billing normally - all operations are mocked
const customer = await billing.customers.create({
  email: 'test@example.com',
  name: 'Test User'
});
```

### Memory Storage Adapter

Fast in-memory storage for development and testing:

```typescript
import { createMemoryStorageAdapter } from '@qazuor/qzpay-dev';
import { QZPayBilling } from '@qazuor/qzpay-core';

const memoryStorage = createMemoryStorageAdapter();

const billing = new QZPayBilling({
  storage: memoryStorage,
  paymentAdapter: paymentAdapter
});

// Data persists in memory for the session
// Perfect for unit tests and development
```

### Test Cards

Predefined test card numbers for various scenarios:

```typescript
import { TEST_CARDS } from '@qazuor/qzpay-dev';

// Successful payment
const successCard = TEST_CARDS.VISA_SUCCESS;
// { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' }

// Declined card
const declinedCard = TEST_CARDS.VISA_DECLINED;
// { number: '4000000000000002', exp_month: 12, exp_year: 2030, cvc: '123' }

// Insufficient funds
const insufficientCard = TEST_CARDS.VISA_INSUFFICIENT_FUNDS;
// { number: '4000000000009995', exp_month: 12, exp_year: 2030, cvc: '123' }

// 3D Secure required
const threeDSCard = TEST_CARDS.VISA_3DS_REQUIRED;
// { number: '4000002500003155', exp_month: 12, exp_year: 2030, cvc: '123' }

// Use in tests
await billing.payments.process({
  customerId: 'cus_123',
  amount: 2999,
  currency: 'USD',
  paymentMethodId: successCard.number
});
```

### Data Seeds

Pre-configured data templates for common scenarios:

```typescript
import { seeds } from '@qazuor/qzpay-dev';

// SaaS template with tiered plans
const saasData = seeds.saas();
// Returns: { plans, prices, customers, subscriptions }

// E-commerce template
const ecomData = seeds.ecommerce();
// Returns: { products, prices, customers, orders }

// API/Usage-based template
const apiData = seeds.api();
// Returns: { plans, customers, usage, limits }

// Seed your database
await Promise.all([
  ...saasData.plans.map(plan => billing.plans.create(plan)),
  ...saasData.prices.map(price => billing.prices.create(price))
]);
```

## Mock Adapter Configuration

### Custom Behavior

```typescript
const mockAdapter = createMockPaymentAdapter({
  // Simulate network latency
  defaultDelay: 500,

  // Default operation result
  defaultSuccess: true,

  // Custom responses
  responses: {
    createCustomer: {
      success: true,
      delay: 200,
      data: { id: 'cus_mock_123' }
    },
    createPayment: {
      success: false,
      error: 'card_declined',
      delay: 100
    }
  }
});
```

### Scenario Testing

```typescript
import { createMockPaymentAdapter, MockScenario } from '@qazuor/qzpay-dev';

// Test successful flow
const successAdapter = createMockPaymentAdapter({
  scenario: MockScenario.SUCCESS
});

// Test failure flow
const failureAdapter = createMockPaymentAdapter({
  scenario: MockScenario.CARD_DECLINED
});

// Test 3DS flow
const threeDSAdapter = createMockPaymentAdapter({
  scenario: MockScenario.REQUIRES_3DS
});

// Test rate limiting
const rateLimitAdapter = createMockPaymentAdapter({
  scenario: MockScenario.RATE_LIMITED
});
```

## Testing Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { QZPayBilling } from '@qazuor/qzpay-core';
import {
  createMockPaymentAdapter,
  createMemoryStorageAdapter,
  TEST_CARDS
} from '@qazuor/qzpay-dev';

describe('Payment Flow', () => {
  let billing: QZPayBilling;

  beforeEach(() => {
    billing = new QZPayBilling({
      storage: createMemoryStorageAdapter(),
      paymentAdapter: createMockPaymentAdapter()
    });
  });

  it('should process successful payment', async () => {
    const customer = await billing.customers.create({
      email: 'test@example.com',
      name: 'Test User'
    });

    const payment = await billing.payments.process({
      customerId: customer.id,
      amount: 2999,
      currency: 'USD',
      paymentMethodId: TEST_CARDS.VISA_SUCCESS.number
    });

    expect(payment.status).toBe('succeeded');
    expect(payment.amount).toBe(2999);
  });

  it('should handle card decline', async () => {
    const customer = await billing.customers.create({
      email: 'test@example.com',
      name: 'Test User'
    });

    await expect(
      billing.payments.process({
        customerId: customer.id,
        amount: 2999,
        currency: 'USD',
        paymentMethodId: TEST_CARDS.VISA_DECLINED.number
      })
    ).rejects.toThrow('card_declined');
  });
});
```

## Available Test Cards

| Card Type | Number | Scenario |
|-----------|--------|----------|
| Visa Success | 4242424242424242 | Successful payment |
| Visa Declined | 4000000000000002 | Card declined |
| Visa Insufficient | 4000000000009995 | Insufficient funds |
| Visa 3DS | 4000002500003155 | Requires 3D Secure |
| Visa Expired | 4000000000000069 | Expired card |
| Visa Processing Error | 4000000000000119 | Processing error |
| Mastercard Success | 5555555555554444 | Successful payment |
| Mastercard Declined | 5100000000000008 | Card declined |
| Amex Success | 378282246310005 | Successful payment |

## Data Seed Templates

### SaaS Template

```typescript
const saasData = seeds.saas();

// Plans: Free, Basic, Pro, Enterprise
// Prices: Monthly and annual for each plan
// Features: Different entitlements per plan
// Limits: API calls, users, storage per plan
```

### E-commerce Template

```typescript
const ecomData = seeds.ecommerce();

// Products: Digital and physical products
// Prices: Various price points and currencies
// Customers: Sample customer data
// Orders: Sample order history
```

### API Template

```typescript
const apiData = seeds.api();

// Plans: Usage-based API plans
// Customers: API consumers
// Usage: Sample API usage data
// Limits: Rate limits per plan
```

## Mock Adapter Features

- **Deterministic**: Same inputs produce same outputs
- **Fast**: No network calls, instant responses
- **Configurable**: Control behavior per test
- **Realistic**: Simulates real provider behavior
- **Error Simulation**: Test error scenarios easily

## Memory Storage Features

- **Fast**: In-memory operations
- **Isolated**: Each instance is independent
- **Reset**: Easy to clear between tests
- **Complete**: Implements full storage adapter interface
- **Transactions**: Supports transaction semantics

## Best Practices

### 1. Use Memory Storage for Unit Tests

```typescript
// ✅ Good - Fast and isolated
const storage = createMemoryStorageAdapter();

// ❌ Avoid - Slower and requires cleanup
const storage = createDrizzleAdapter(testDb);
```

### 2. Configure Mock Adapter Per Test

```typescript
// ✅ Good - Test-specific behavior
it('handles declined card', async () => {
  const adapter = createMockPaymentAdapter({
    scenario: MockScenario.CARD_DECLINED
  });
  // ... test
});

// ❌ Avoid - Shared mock state
const adapter = createMockPaymentAdapter();
describe('tests', () => {
  // All tests share same mock
});
```

### 3. Use Seed Data for Development

```typescript
// ✅ Good - Rich development data
async function seedDevelopment() {
  const data = seeds.saas();
  await populateDatabase(data);
}

// ❌ Avoid - Manual data creation
async function seedDevelopment() {
  await createPlan({ name: 'Free', ... });
  await createPlan({ name: 'Pro', ... });
  // Tedious and error-prone
}
```

## License

MIT
