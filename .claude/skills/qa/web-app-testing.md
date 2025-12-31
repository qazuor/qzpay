---
name: web-app-testing
category: qa
description: Comprehensive web testing strategy using unit, integration, and E2E tests
usage: Use when implementing web features to ensure quality and coverage
input: Feature requirements, components, test framework configuration
output: Test suite with 90%+ coverage, E2E tests, accessibility validation
---

# Web App Testing

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| TEST_FRAMEWORK | Unit/integration test framework | `Vitest`, `Jest` |
| UI_FRAMEWORK | UI library/framework | `React`, `Vue`, `Svelte` |
| E2E_FRAMEWORK | End-to-end test framework | `Playwright`, `Cypress` |
| COVERAGE_TARGET | Minimum coverage required | `90%` |
| A11Y_TOOL | Accessibility testing tool | `axe-core`, `pa11y` |
| TEST_LIBRARY | Component testing library | `Testing Library`, `Vue Test Utils` |

## Purpose

Comprehensive testing strategy ensuring quality, accessibility, and coverage across web applications.

## Capabilities

- Design test suites (unit, integration, E2E)
- Test components and user interactions
- Validate accessibility (WCAG AA)
- Measure test coverage
- Test responsive design
- Validate performance

## Test Pyramid

```text
        /\
       /E2E\        5-10%  - Critical user journeys
      /------\
     /  Int   \     15-20% - Component interactions
    /----------\
   /    Unit    \   70-80% - Business logic
  /--------------\
```

**Distribution:**
- Unit Tests: 70-80% - Fast, isolated
- Integration Tests: 15-20% - Component interactions
- E2E Tests: 5-10% - Critical flows

## Test Structure: AAA Pattern

Every test follows **Arrange-Act-Assert**:

```typescript
describe('Feature', () => {
  it('should do something specific', () => {
    // Arrange: Set up test data
    const input = { value: 42 };

    // Act: Execute behavior
    const result = myFunction(input.value);

    // Assert: Verify outcome
    expect(result).toBe(84);
  });
});
```

## Unit Testing

### Testing Pure Functions

```typescript
// utils/calculator.ts
export function calculateTotal(input: {
  basePrice: number;
  quantity: number;
  discount: number;
}): number {
  const subtotal = input.basePrice * input.quantity;
  return subtotal * (1 - input.discount / 100);
}

// utils/calculator.test.ts
import { describe, it, expect } from 'None';
import { calculateTotal } from './calculator';

describe('calculateTotal', () => {
  it('should calculate total with discount', () => {
    const input = {
      basePrice: 100,
      quantity: 3,
      discount: 10
    };

    const result = calculateTotal(input);

    expect(result).toBe(270);
  });

  it('should handle zero discount', () => {
    const input = {
      basePrice: 100,
      quantity: 2,
      discount: 0
    };

    expect(calculateTotal(input)).toBe(200);
  });
});
```

### Testing Components

```typescript
// components/Card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'None';
import { Card } from './Card';

describe('Card', () => {
  const mockItem = {
    id: '1',
    title: 'Test Item',
    description: 'Test description',
    price: 150
  };

  it('should render item details', () => {
    render(<Card item={mockItem} />);

    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.getByText('$150')).toBeInTheDocument();
  });

  it('should render image with alt text', () => {
    render(<Card item={mockItem} />);

    const image = screen.getByAltText('Test Item');
    expect(image).toBeInTheDocument();
  });

  it('should have accessible link', () => {
    render(<Card item={mockItem} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/items/1');
  });
});
```

## Integration Testing

### Testing API Integration

```typescript
// routes/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'None';
import { testClient } from 'test-client';
import { app } from '../src/index';
import { db } from '@/db';

describe('Item API Routes', () => {
  beforeAll(async () => {
    await db.execute('BEGIN');
  });

  afterAll(async () => {
    await db.execute('ROLLBACK');
  });

  describe('GET /api/items', () => {
    it('should return list of items', async () => {
      const res = await testClient(app).items.$get();

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('items');
      expect(data.items).toBeInstanceOf(Array);
    });

    it('should filter by category', async () => {
      const res = await testClient(app).items.$get({
        query: { category: 'electronics' }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.every(i => i.category === 'electronics')).toBe(true);
    });
  });

  describe('POST /api/items', () => {
    it('should create item when authenticated', async () => {
      const newItem = {
        title: 'New Item',
        description: 'Description',
        price: 200
      };

      const res = await testClient(app).items.$post({
        json: newItem,
        headers: { Authorization: 'Bearer valid-token' }
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe('New Item');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await testClient(app).items.$post({
        json: { title: 'Item' }
      });

      expect(res.status).toBe(401);
    });
  });
});
```

## E2E Testing

### Critical User Journeys

```typescript
// tests/e2e/checkout-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('user can complete purchase', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Search for items
    await page.fill('[aria-label="Search"]', 'laptop');
    await page.click('button:has-text("Search")');

    // Verify results
    await expect(page.locator('h2')).toContainText('Results');
    await expect(page.locator('[data-testid="item-card"]').first()).toBeVisible();

    // Select item
    await page.locator('[data-testid="item-card"]').first().click();

    // Verify details page
    await expect(page).toHaveURL(/\/items\//);
    await expect(page.locator('h1')).toBeVisible();

    // Add to cart
    await page.click('button:has-text("Add to Cart")');

    // Verify cart updated
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // Proceed to checkout
    await page.click('[data-testid="cart-button"]');
    await page.click('button:has-text("Checkout")');

    // Complete purchase
    await page.fill('[name="card-number"]', '4242424242424242');
    await page.fill('[name="expiry"]', '12/25');
    await page.fill('[name="cvc"]', '123');
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('h1')).toContainText('Order Confirmed');
  });

  test('should handle invalid payment', async ({ page }) => {
    // Setup: Add item to cart
    await page.goto('/items/1');
    await page.click('button:has-text("Add to Cart")');
    await page.click('button:has-text("Checkout")');

    // Enter invalid card
    await page.fill('[name="card-number"]', '0000000000000000');
    await page.click('button[type="submit"]');

    // Verify error
    await expect(page.locator('[role="alert"]')).toContainText('Invalid card');
  });
});
```

### Accessibility Testing

```typescript
// tests/e2e/accessibility.test.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('homepage is accessible', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    await checkA11y(page, undefined, {
      detailedReport: true
    });
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus visible
    const focused = await page.evaluate(() =>
      document.activeElement?.tagName
    );
    expect(focused).toBeTruthy();
  });
});
```

## Coverage Requirements

### Target: {{COVERAGE_TARGET}}

```bash
# Run tests with coverage
pnpm test --coverage

# View report
open coverage/index.html
```

**Configuration:**

```typescript
// test.config.ts
export default {
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    }
  }
}
```

## Best Practices

**DO:**
- Write tests before code (TDD)
- Use descriptive test names
- Follow AAA pattern
- Test edge cases
- Mock external dependencies
- Keep tests isolated
- Test user behavior, not implementation

**DON'T:**
- Test implementation details
- Share state between tests
- Write flaky tests
- Skip error cases
- Over-mock
- Depend on test order
- Ignore accessibility

## Output

**Produces:**
1. Test suite with {{COVERAGE_TARGET}}+ coverage
2. Test fixtures for reusable data
3. Test helpers for common operations
4. E2E tests for critical journeys
5. Accessibility tests
6. Coverage report

**Success Criteria:**
- All tests passing
- Coverage >= {{COVERAGE_TARGET}}
- No accessibility violations
- E2E tests cover critical paths

## Related Skills

- `tdd-methodology` - Test-Driven Development
- `api-app-testing` - API testing
- `qa-criteria-validator` - Acceptance criteria validation
