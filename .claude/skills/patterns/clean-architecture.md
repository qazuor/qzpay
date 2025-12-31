---
name: clean-architecture
category: patterns
description: Clean Architecture with concentric layers and dependency inversion for maintainable codebases
usage: Use when building applications that need clear separation of concerns and testability
input: Application requirements, domain models, use cases
output: Layered architecture with entities, use cases, interfaces, and frameworks
---

# Clean Architecture

## Overview

Clean Architecture, introduced by Robert C. Martin (Uncle Bob), organizes code in concentric layers where dependencies point inward. The core business logic remains independent of external concerns like databases, UI, or frameworks.

## Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| DOMAIN_DIR | Domain entities | `src/domain/`, `core/entities/` |
| USE_CASES_DIR | Application/Use cases | `src/application/`, `core/use-cases/` |
| INTERFACES_DIR | Interface adapters | `src/interfaces/`, `adapters/` |
| INFRASTRUCTURE_DIR | External frameworks | `src/infrastructure/`, `external/` |

## The Dependency Rule

**Dependencies ALWAYS point inward.** Inner layers know nothing about outer layers.

```
┌─────────────────────────────────────────────────┐
│              Frameworks & Drivers               │  ← External (DB, Web, UI)
│  ┌─────────────────────────────────────────┐    │
│  │         Interface Adapters              │    │  ← Controllers, Gateways
│  │  ┌─────────────────────────────────┐    │    │
│  │  │       Application Layer         │    │    │  ← Use Cases
│  │  │  ┌─────────────────────────┐    │    │    │
│  │  │  │    Enterprise Layer     │    │    │    │  ← Entities
│  │  │  └─────────────────────────┘    │    │    │
│  │  └─────────────────────────────────┘    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Layer Details

### 1. Enterprise Layer (Entities)

**Purpose:** Core business rules and domain objects.

```typescript
// domain/entities/User.ts
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// domain/entities/Order.ts
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';

// domain/value-objects/Email.ts
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    if (!this.isValid(email)) {
      throw new Error('Invalid email format');
    }
    return new Email(email);
  }

  static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getValue(): string {
    return this.value;
  }
}
```

### 2. Application Layer (Use Cases)

**Purpose:** Application-specific business rules.

```typescript
// application/use-cases/CreateOrder.ts
import type { Order } from '../../domain/entities/Order';
import type { OrderRepository } from '../ports/OrderRepository';
import type { UserRepository } from '../ports/UserRepository';
import type { NotificationService } from '../ports/NotificationService';

interface CreateOrderInput {
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface CreateOrderOutput {
  order: Order;
}

export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private userRepository: UserRepository,
    private notificationService: NotificationService
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    // Validate user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate total
    const total = await this.calculateTotal(input.items);

    // Create order
    const order = await this.orderRepository.create({
      userId: input.userId,
      items: input.items,
      total,
      status: 'pending',
    });

    // Send notification
    await this.notificationService.sendOrderConfirmation(user.email, order);

    return { order };
  }

  private async calculateTotal(items: CreateOrderInput['items']): Promise<number> {
    // Business logic for calculating total
    return items.reduce((sum, item) => sum + item.quantity * 10, 0);
  }
}
```

### 3. Interface Adapters

**Purpose:** Convert data between use cases and external agencies.

```typescript
// interfaces/controllers/OrderController.ts
import type { Request, Response } from 'express';
import type { CreateOrderUseCase } from '../../application/use-cases/CreateOrder';

export class OrderController {
  constructor(private createOrderUseCase: CreateOrderUseCase) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createOrderUseCase.execute({
        userId: req.body.userId,
        items: req.body.items,
      });

      res.status(201).json({
        success: true,
        data: this.toPresentation(result.order),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private toPresentation(order: Order) {
    return {
      id: order.id,
      items: order.items,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    };
  }
}

// interfaces/presenters/OrderPresenter.ts
export class OrderPresenter {
  static toJSON(order: Order) {
    return {
      id: order.id,
      total: `$${order.total.toFixed(2)}`,
      itemCount: order.items.length,
      status: order.status,
    };
  }
}
```

### 4. Frameworks & Drivers

**Purpose:** External frameworks, tools, and infrastructure.

```typescript
// infrastructure/repositories/PostgresOrderRepository.ts
import type { Order } from '../../domain/entities/Order';
import type { OrderRepository } from '../../application/ports/OrderRepository';
import { db } from '../database/connection';

export class PostgresOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const result = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async create(data: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const result = await db.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.userId, JSON.stringify(data.items), data.total, data.status]
    );
    return this.toDomain(result.rows[0]);
  }

  private toDomain(row: any): Order {
    return {
      id: row.id,
      userId: row.user_id,
      items: row.items,
      total: parseFloat(row.total),
      status: row.status,
      createdAt: row.created_at,
    };
  }
}

// infrastructure/services/EmailNotificationService.ts
import type { NotificationService } from '../../application/ports/NotificationService';

export class EmailNotificationService implements NotificationService {
  async sendOrderConfirmation(email: string, order: Order): Promise<void> {
    // Implementation using email provider
    console.log(`Sending confirmation to ${email} for order ${order.id}`);
  }
}
```

## Ports (Interfaces)

```typescript
// application/ports/OrderRepository.ts
import type { Order } from '../../domain/entities/Order';

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  create(data: Omit<Order, 'id' | 'createdAt'>): Promise<Order>;
  update(id: string, data: Partial<Order>): Promise<Order>;
}

// application/ports/NotificationService.ts
export interface NotificationService {
  sendOrderConfirmation(email: string, order: Order): Promise<void>;
  sendShippingUpdate(email: string, order: Order): Promise<void>;
}
```

## Project Structure

```
src/
├── domain/                     # Enterprise Business Rules
│   ├── entities/
│   │   ├── User.ts
│   │   └── Order.ts
│   └── value-objects/
│       ├── Email.ts
│       └── Money.ts
├── application/                # Application Business Rules
│   ├── use-cases/
│   │   ├── CreateOrder.ts
│   │   ├── GetUserOrders.ts
│   │   └── UpdateOrderStatus.ts
│   └── ports/                  # Interfaces for external services
│       ├── OrderRepository.ts
│       ├── UserRepository.ts
│       └── NotificationService.ts
├── interfaces/                 # Interface Adapters
│   ├── controllers/
│   │   ├── OrderController.ts
│   │   └── UserController.ts
│   ├── presenters/
│   │   └── OrderPresenter.ts
│   └── gateways/
│       └── PaymentGateway.ts
└── infrastructure/             # Frameworks & Drivers
    ├── database/
    │   ├── connection.ts
    │   └── migrations/
    ├── repositories/
    │   ├── PostgresOrderRepository.ts
    │   └── PostgresUserRepository.ts
    ├── services/
    │   └── EmailNotificationService.ts
    └── web/
        ├── routes.ts
        └── middleware/
```

## Dependency Injection

```typescript
// infrastructure/container.ts
import { CreateOrderUseCase } from '../application/use-cases/CreateOrder';
import { PostgresOrderRepository } from './repositories/PostgresOrderRepository';
import { PostgresUserRepository } from './repositories/PostgresUserRepository';
import { EmailNotificationService } from './services/EmailNotificationService';
import { OrderController } from '../interfaces/controllers/OrderController';

// Create implementations
const orderRepository = new PostgresOrderRepository();
const userRepository = new PostgresUserRepository();
const notificationService = new EmailNotificationService();

// Create use cases with injected dependencies
const createOrderUseCase = new CreateOrderUseCase(
  orderRepository,
  userRepository,
  notificationService
);

// Create controllers
export const orderController = new OrderController(createOrderUseCase);
```

## Testing Strategy

```typescript
// tests/application/use-cases/CreateOrder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CreateOrderUseCase } from '../../../src/application/use-cases/CreateOrder';

describe('CreateOrderUseCase', () => {
  it('should create order for valid user', async () => {
    // Arrange - Use mock implementations
    const mockOrderRepo = {
      create: vi.fn().mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 2 }],
        total: 20,
        status: 'pending',
      }),
    };

    const mockUserRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      }),
    };

    const mockNotification = {
      sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new CreateOrderUseCase(
      mockOrderRepo as any,
      mockUserRepo as any,
      mockNotification as any
    );

    // Act
    const result = await useCase.execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    // Assert
    expect(result.order.id).toBe('order-1');
    expect(mockNotification.sendOrderConfirmation).toHaveBeenCalled();
  });
});
```

## Best Practices

### Do's

- Keep entities pure (no framework dependencies)
- Use dependency injection for all external services
- Define ports (interfaces) in the application layer
- Test use cases independently of infrastructure
- Cross boundaries with simple data structures

### Don'ts

- Don't import from outer layers into inner layers
- Don't put business logic in controllers
- Don't let entities depend on databases
- Don't skip the use case layer for "simple" operations
- Don't create circular dependencies between layers

## When to Use Clean Architecture

**Good for:**

- Large applications with complex business logic
- Applications requiring high testability
- Teams following domain-driven design
- Long-term maintainable codebases
- Applications needing framework independence

**Less suitable for:**

- Simple CRUD applications
- Prototypes or MVPs
- Small teams with tight deadlines
- Applications with minimal business logic

## Output

**Produces:**

- Layered project structure
- Framework-independent business logic
- Testable use cases
- Clear separation of concerns

**Success Criteria:**

- Inner layers have no outer layer imports
- Use cases are fully unit testable
- Entities contain only business logic
- Infrastructure is easily swappable
