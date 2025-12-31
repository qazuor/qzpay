---
name: tdd-methodology
category: patterns
description: Test-Driven Development workflow (RED-GREEN-REFACTOR) ensuring quality and coverage
usage: Use when implementing features to ensure testability and design quality
input: Feature requirements, acceptance criteria, technical specifications
output: Tests written before implementation, well-designed code with high coverage
---

# TDD Methodology

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| TEST_FRAMEWORK | Test framework | `Vitest`, `Jest`, `Mocha` |
| COVERAGE_TARGET | Minimum coverage | `90%` |
| TEST_COMMAND | Run tests command | `pnpm test`, `npm test` |
| WATCH_COMMAND | Watch mode command | `pnpm test:watch` |
| COVERAGE_COMMAND | Coverage command | `pnpm test:coverage` |

## Purpose

Test-Driven Development approach ensuring testable, well-designed code with comprehensive coverage.

## The TDD Cycle

### RED → GREEN → REFACTOR

- **RED**: Write a failing test
- **GREEN**: Write minimum code to pass
- **REFACTOR**: Improve code while keeping tests green

**Cycle time**: 2-10 minutes per iteration

## Workflow

### 1. RED - Write Failing Test

**Objective**: Define expected behavior through failing test

**Actions:**
1. Identify single behavior to test
2. Write test describing expected behavior
3. Run test - it MUST fail
4. Verify failure message is clear

**Example:**

```typescript
// Step 1: RED - Write failing test
describe('OrderService', () => {
  it('should create order with valid data', async () => {
    const service = new OrderService();

    const order = await service.create({
      itemId: 'item-1',
      quantity: 2,
      customerId: 'customer-1'
    });

    expect(order).toHaveProperty('id');
    expect(order.status).toBe('pending');
  });
});

// Run: pnpm test
// Result: FAIL - OrderService is not defined
```

### 2. GREEN - Make Test Pass

**Objective**: Write minimum code to make test pass

**Actions:**
1. Write simplest code that passes
2. Don't add extra features
3. Don't optimize yet
4. Run test - it MUST pass

**Example:**

```typescript
// Step 2: GREEN - Minimum implementation
export class OrderService {
  async create(data) {
    return {
      id: 'order-1',
      status: 'pending',
      ...data
    };
  }
}

// Run: pnpm test
// Result: PASS ✓
```

### 3. REFACTOR - Improve Code

**Objective**: Improve design while keeping tests green

**Actions:**
1. Remove duplication
2. Improve names
3. Extract methods/classes
4. Apply design patterns
5. Run tests after each change
6. Tests MUST stay green

**Example:**

```typescript
// Step 3: REFACTOR - Add proper implementation
export class OrderService extends BaseCrudService<Order> {
  constructor(
    private orderModel: OrderModel,
    private validator: OrderValidator
  ) {
    super(orderModel);
  }

  async create(data: CreateOrderInput): Promise<Order> {
    await this.validator.validate(data);

    const order = await this.orderModel.create({
      ...data,
      status: 'pending'
    });

    return order;
  }
}

// Run: pnpm test
// Result: PASS ✓ (still passing)
```

### 4. Repeat

**Continue cycle for next behavior:**
1. Pick next behavior
2. Write failing test (RED)
3. Make it pass (GREEN)
4. Refactor (REFACTOR)
5. Commit when tests green

## TDD Rules

### Three Laws of TDD

1. **Don't write production code** until you have a failing test
2. **Don't write more test** than needed to fail
3. **Don't write more production code** than needed to pass

### Additional Guidelines

- **One test at a time**: Focus on single behavior
- **Test names describe behavior**: Clear, descriptive names
- **AAA pattern**: Arrange, Act, Assert
- **Fast tests**: Tests should run in seconds
- **Independent tests**: No test dependencies
- **Repeatable**: Same results every time

## Benefits

1. **Design Quality**: Forces modular, testable design
2. **Coverage**: High coverage naturally achieved
3. **Documentation**: Tests document behavior
4. **Confidence**: Safe refactoring
5. **Bug Prevention**: Catches issues early
6. **Focus**: One thing at a time

## Common Mistakes

### ❌ Writing Tests After Code

**Why bad**: Code already designed, tests fit code instead of driving design

**Fix**: Always write test first

### ❌ Writing Too Much Test

**Why bad**: Wastes time, test becomes complex

**Fix**: Write minimal test that fails

### ❌ Writing Too Much Code

**Why bad**: Adds unnecessary complexity

**Fix**: Write just enough to pass

### ❌ Skipping Refactor

**Why bad**: Code becomes messy over time

**Fix**: Refactor after each GREEN

### ❌ Not Running Tests Frequently

**Why bad**: Miss immediate feedback

**Fix**: Run tests after each step

## TDD with Different Layers

### Database Layer

```typescript
// RED: Write failing test
it('should find item by ID', async () => {
  const model = new ItemModel(db);
  const item = await model.findById('item-1');
  expect(item).toBeDefined();
});

// GREEN: Implement
class ItemModel extends BaseModel<Item> {
  async findById(id: string) {
    return await db.items.findFirst({
      where: eq(items.id, id)
    });
  }
}

// REFACTOR: Add error handling
async findById(id: string) {
  const item = await db.items.findFirst({
    where: eq(items.id, id)
  });

  if (!item) {
    throw new NotFoundError('Item not found');
  }

  return item;
}
```

### Service Layer

```typescript
// RED: Business logic test
it('should not allow negative quantity', async () => {
  await expect(
    service.create({
      quantity: -1
    })
  ).rejects.toThrow('Quantity must be positive');
});

// GREEN: Implement validation
async create(data) {
  if (data.quantity < 0) {
    throw new Error('Quantity must be positive');
  }
  return await this.model.create(data);
}

// REFACTOR: Extract validator
class QuantityValidator {
  validatePositive(quantity: number) {
    if (quantity < 0) {
      throw new ValidationError('Quantity must be positive');
    }
  }
}
```

### API Layer

```typescript
// RED: API test
it('POST /api/orders should return 201', async () => {
  const response = await app.request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(validOrder)
  });

  expect(response.status).toBe(201);
});

// GREEN: Implement route
app.post('/api/orders', async (c) => {
  const data = await c.req.json();
  const order = await service.create(data);
  return c.json(order, 201);
});

// REFACTOR: Add validation
app.post('/api/orders',
  validator('json', createOrderSchema),
  async (c) => {
    const data = c.req.valid('json');
    const order = await service.create(data);
    return c.json(order, 201);
  }
);
```

## Coverage Goals

- **Unit Tests**: >= {{COVERAGE_TARGET}}
- **Integration Tests**: All critical paths
- **E2E Tests**: Happy paths

## Best Practices

1. **Start Simple**: Test simplest case first
2. **One Assert**: One logical assertion per test
3. **Clear Names**: Test name explains behavior
4. **Fast Feedback**: Keep tests fast
5. **Isolated**: Tests don't depend on each other
6. **Deterministic**: Always same result
7. **Readable**: Tests as documentation
8. **Maintainable**: Refactor tests too

## Output

**Produces:**
- Test files written before implementation
- Well-designed, modular code
- Coverage >= {{COVERAGE_TARGET}}
- Living documentation through tests

**Success Criteria:**
- All tests passing
- Coverage meets target
- Code well-designed and maintainable
- Tests serve as documentation

## Related Skills

- `api-app-testing` - API-specific testing
- `web-app-testing` - Frontend testing
- `security-testing` - Security testing
- `performance-testing` - Performance testing
