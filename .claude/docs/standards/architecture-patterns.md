# Architecture Patterns

This document defines the architectural patterns and design principles.

---

## Table of Contents

<!-- markdownlint-disable MD051 -->

1. [Layer Architecture](#layer-architecture)
2. [Entity Creation Flow](#entity-creation-flow)
3. [Base Classes & Patterns](#base-classes--patterns)
4. [Database Patterns](#database-patterns)
5. [Service Patterns](#service-patterns)
6. [API Patterns](#api-patterns)
7. [Frontend Patterns](#frontend-patterns)
8. [Authentication & Authorization](#authentication--authorization)
9. [Error Handling](#error-handling)
10. [Validation Flow](#validation-flow)

<!-- markdownlint-enable MD051 -->

---

## Layer Architecture

### Bottom-Up Layers

```text
┌─────────────────────────────────────────┐
│         Frontend Layer                   │
│  (Astro, React, TanStack)               │
│  - UI Components                        │
│  - State Management                     │
│  - Forms & Validation                   │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│         API Layer                        │
│  (Hono Routes)                          │
│  - Request/Response Handling            │
│  - Middleware (auth, validation)        │
│  - Route Factories                      │
└─────────────────┬───────────────────────┘
                  │ Function Calls
┌─────────────────▼───────────────────────┐
│         Service Layer                    │
│  (Business Logic)                       │
│  - Services extending BaseCrudService   │
│  - Business Rules & Validation          │
│  - Transactions                         │
└─────────────────┬───────────────────────┘
                  │ ORM Calls
┌─────────────────▼───────────────────────┐
│         Database Layer                   │
│  (Drizzle ORM + PostgreSQL)             │
│  - Models extending BaseModel           │
│  - Database Schemas                     │
│  - Migrations                           │
└─────────────────────────────────────────┘
```text

### Layer Responsibilities

**Database Layer** (`@repo/db`)

- Define Drizzle schemas
- Implement models (extend `BaseModel`)
- Handle database queries
- Manage migrations

**Service Layer** (`@repo/service-core`)

- Implement business logic
- Enforce business rules
- Handle transactions
- Coordinate between models

**API Layer** (`apps/api`)

- Handle HTTP requests/responses
- Validate input (Zod)
- Authenticate/authorize requests
- Call service methods

**Frontend Layer** (`apps/web`, `apps/admin`)

- Render UI
- Handle user interactions
- Manage client state
- Call API endpoints

---

## Entity Creation Flow

### Complete Order (Never Skip Steps)

When creating a new entity, follow this exact order:

```text

1. Zod Schemas (@repo/schemas)

   ↓

2. Types via z.infer<typeof schema>

   ↓

3. Drizzle Schema (@repo/db/schemas)

   ↓

4. Model extending BaseModel (@repo/db/models)

   ↓

5. Service extending BaseCrudService (@repo/service-core)

   ↓

6. API Routes using factory pattern (apps/api/routes)

   ↓

7. Frontend Components (apps/web or apps/admin)

```text

### Step-by-Step Example: Entity Entity

#### Step 1: Zod Schemas

```typescript
// packages/schemas/src/entity/entity.schema.ts

import { z } from 'zod';

export const entitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(['house', 'apartment', 'room']),
  capacity: z.number().int().positive().max(50),
  pricePerNight: z.number().positive(),
  hostId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export const createEntitySchema = entitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateEntitySchema = createEntitySchema.partial();

export const searchEntitySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['house', 'apartment', 'room']).optional(),
  minCapacity: z.number().optional(),
  maxPrice: z.number().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});
```text

#### Step 2: Infer Types

```typescript
// In the same file or separate types file
export type Entity = z.infer<typeof entitySchema>;
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type SearchEntityInput = z.infer<typeof searchEntitySchema>;
```text

#### Step 3: Drizzle Schema

```typescript
// packages/db/src/schemas/entity/entity.schema.ts

import { pgTable, uuid, varchar, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../user/user.schema';

export const entitys = pgTable('entitys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  capacity: integer('capacity').notNull(),
  pricePerNight: numeric('price_per_night', { precision: 10, scale: 2 }).notNull(),
  hostId: uuid('host_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```text

#### Step 4: Model

```typescript
// packages/db/src/models/entity.model.ts

import { BaseModel } from './base.model';
import { entitys } from '../schemas/entity/entity.schema';
import type { Entity } from '@repo/schemas';
import { eq, and, isNull, ilike, sql } from 'drizzle-orm';

export class EntityModel extends BaseModel<Entity> {
  protected table = entitys;
  protected entityName = 'Entity';

  /**

   * Find entitys with text search

   *

   * @param options - Search options
   * @returns List of entitys matching search

   */
  async findAll(options?: {
    search?: { q?: string };
    page?: number;
    pageSize?: number;
  }) {
    const { search, page = 1, pageSize = 20 } = options ?? {};

    const conditions = [isNull(this.table.deletedAt)];

    if (search?.q) {
      conditions.push(
        ilike(this.table.name, `%${search.q}%`)
      );
    }

    const offset = (page - 1) * pageSize;

    const items = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(and(...conditions));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / pageSize),
      },
    };
  }
}
```text

#### Step 5: Service

```typescript
// packages/service-core/src/services/entity/entity.service.ts

import { BaseCrudService } from '../base-crud.service';
import { EntityModel } from '@repo/db';
import type { ServiceContext } from '../../types';
import type {
  Entity,
  CreateEntityInput,
  UpdateEntityInput,
  SearchEntityInput,
} from '@repo/schemas';

export class EntityService extends BaseCrudService<
  Entity,
  EntityModel,
  CreateEntityInput,
  UpdateEntityInput,
  SearchEntityInput
> {
  constructor(ctx: ServiceContext, model?: EntityModel) {
    super(ctx, model ?? new EntityModel(ctx.db));
  }

  /**

   * Create entity with additional business logic

   */
  async create({ input, user }: { input: CreateEntityInput; user: User }) {
    return this.runWithLoggingAndValidation(
      'create',
      { input, user },
      async () => {
        // Business rule: Only hosts can create entitys
        if (user.role !== 'host') {
          throw new ServiceError(
            'Only hosts can create entitys',
            ServiceErrorCode.FORBIDDEN
          );
        }

        // Business rule: Set hostId to current user
        const entityData = {
          ...input,
          hostId: user.id,
        };

        return super.create({ input: entityData, user });
      }
    );
  }
}
```text

#### Step 6: API Routes

```typescript
// apps/api/src/routes/entity/index.ts

import { Hono } from 'hono';
import { createCRUDRoute, createListRoute } from '../../factories/route-factory';
import { EntityService } from '@repo/service-core';
import {
  createEntitySchema,
  updateEntitySchema,
  searchEntitySchema,
} from '@repo/schemas';

const app = new Hono();

// Public list route (no auth required)
const listRoute = createListRoute({
  service: EntityService,
  schema: searchEntitySchema,
  options: {
    skipAuth: true,
  },
});

// Protected CRUD routes
const crudRoute = createCRUDRoute({
  service: EntityService,
  schemas: {
    create: createEntitySchema,
    update: updateEntitySchema,
    search: searchEntitySchema,
  },
  options: {
    skipAuth: false,
    permissions: ['entity:write'],
  },
});

app.route('/', listRoute); // GET /entitys (public)
app.route('/', crudRoute);  // POST, PUT, DELETE (protected)

export default app;
```text

#### Step 7: Frontend Components

```typescript
// apps/web/src/components/entity/EntityList.tsx

import { useQuery } from '@tanstack/react-query';
import { EntityCard } from './EntityCard';
import type { SearchEntityInput } from '@repo/schemas';

const fetchEntitys = async (params: SearchEntityInput) => {
  const res = await fetch(`/api/entitys?${new URLSearchParams(params)}`);
  return res.json();
};

export const EntityList = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['entitys'],
    queryFn: () => fetchEntitys({ page: 1, pageSize: 20 }),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {data.items.map((entity) => (
        <EntityCard key={entity.id} entity={entity} />
      ))}
    </div>
  );
};
```text

---

## Base Classes & Patterns

### BaseModel Pattern

**All models MUST extend BaseModel:**

```typescript
import { BaseModel } from './base.model';
import type { YourEntity } from '@repo/schemas';

export class YourEntityModel extends BaseModel<YourEntity> {
  protected table = yourEntitiesTable;
  protected entityName = 'YourEntity';

  // Override methods as needed
  async findAll(options?: SearchOptions) {
    // Custom implementation
  }
}
```text

**BaseModel provides:**

- `findById(id)` - Find by primary key
- `findAll(options)` - List with pagination
- `create(data)` - Insert record
- `update(id, data)` - Update record
- `softDelete(id)` - Soft delete (set deletedAt)
- `restore(id)` - Restore soft deleted
- `hardDelete(id)` - Permanent delete

### BaseCrudService Pattern

**All services MUST extend BaseCrudService:**

```typescript
import { BaseCrudService } from '../base-crud.service';

export class YourService extends BaseCrudService<
  Entity,
  EntityModel,
  CreateSchema,
  UpdateSchema,
  SearchSchema
> {
  constructor(ctx: ServiceContext, model?: EntityModel) {
    super(ctx, model ?? new EntityModel(ctx.db));
  }

  // Override or add methods
  async customMethod({ input }: { input: CustomInput }) {
    return this.runWithLoggingAndValidation(
      'customMethod',
      { input },
      async () => {
        // Implementation
      }
    );
  }
}
```text

**BaseCrudService provides:**

- `findById({ id })` - Get single record
- `findAll({ search, page, pageSize })` - List with pagination
- `create({ input, user })` - Create record
- `update({ id, input, user })` - Update record
- `delete({ id, user })` - Soft delete record
- `runWithLoggingAndValidation()` - Wrapper for logging/validation

---

## Database Patterns

### Soft Delete Pattern

**Default behavior: Soft delete**

```typescript
// Soft delete (sets deletedAt)
await model.softDelete(id);

// Restore
await model.restore(id);

// Hard delete (permanent)
await model.hardDelete(id);
```text

### Pagination Pattern

```typescript
// Request pagination
const result = await model.findAll({
  page: 1,
  pageSize: 20,
  orderBy: { field: 'createdAt', direction: 'desc' },
});

// Response format
type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
```text

### Transaction Pattern

```typescript
// Use transactions for multi-step operations
await db.transaction(async (trx) => {
  const entity = await trx
    .insert(entitys)
    .values(data)
    .returning();

  await trx
    .insert(entityImages)
    .values(images.map(img => ({ ...img, entityId: entity.id })));

  return entity;
});
```text

### Query Optimization

```typescript
// Use indexes for frequent queries
CREATE INDEX idx_entitys_host_id ON entitys(host_id);
CREATE INDEX idx_entitys_type ON entitys(type);
CREATE INDEX idx_entitys_created_at ON entitys(created_at DESC);

// Composite index for common filter combinations
CREATE INDEX idx_entitys_type_capacity ON entitys(type, capacity);
```text

---

## Service Patterns

### Business Logic Encapsulation

```typescript
export class BookingService extends BaseCrudService<...> {
  /**

   * Create booking with business rules

   */
  async create({ input, user }: CreateParams) {
    return this.runWithLoggingAndValidation(
      'create',
      { input, user },
      async () => {
        // Business rule 1: Check availability
        const isAvailable = await this.checkAvailability(
          input.entityId,
          input.checkIn,
          input.checkOut
        );

        if (!isAvailable) {
          throw new ServiceError(
            'Entity not available for selected dates',
            ServiceErrorCode.CONFLICT
          );
        }

        // Business rule 2: Calculate total price
        const entity = await this.entityModel.findById(
          input.entityId
        );
        const nights = this.calculateNights(input.checkIn, input.checkOut);
        const totalPrice = entity.pricePerNight * nights;

        // Create booking
        const booking = await this.model.create({
          ...input,
          totalPrice,
          status: 'pending',
          userId: user.id,
        });

        // Business rule 3: Send confirmation email
        await this.emailService.sendBookingConfirmation(booking);

        return { booking };
      }
    );
  }
}
```text

### Service Composition

```typescript
export class EntityService extends BaseCrudService<...> {
  private imageService: ImageService;
  private amenityService: AmenityService;

  constructor(
    ctx: ServiceContext,
    model?: EntityModel,
    imageService?: ImageService,
    amenityService?: AmenityService
  ) {
    super(ctx, model ?? new EntityModel(ctx.db));
    this.imageService = imageService ?? new ImageService(ctx);
    this.amenityService = amenityService ?? new AmenityService(ctx);
  }

  async create({ input, user }: CreateParams) {
    return this.db.transaction(async (trx) => {
      // Create entity
      const entity = await this.model.create(input);

      // Add images
      if (input.images) {
        await this.imageService.createMultiple({
          entityId: entity.id,
          images: input.images,
        });
      }

      // Add amenities
      if (input.amenityIds) {
        await this.amenityService.linkToEntity({
          entityId: entity.id,
          amenityIds: input.amenityIds,
        });
      }

      return { entity };
    });
  }
}
```text

---

## API Patterns

### Route Factory Pattern

**Always use factory functions:**

```typescript
// Simple list route (GET only)
const listRoute = createListRoute({
  service: YourService,
  schema: searchSchema,
  options: {
    skipAuth: true, // Public endpoint
  },
});

// Full CRUD routes
const crudRoute = createCRUDRoute({
  service: YourService,
  schemas: {
    create: createSchema,
    update: updateSchema,
    search: searchSchema,
  },
  options: {
    skipAuth: false, // Protected endpoints
    permissions: ['entity:write'],
  },
});

// Custom route
const customRoute = createSimpleRoute({
  method: 'post',
  path: '/custom-action',
  schema: customSchema,
  handler: async (c) => {
    const input = c.req.valid('json');
    // Custom logic
    return c.json({ success: true, data: result });
  },
  options: {
    skipAuth: false,
    permissions: ['custom:action'],
  },
});
```text

### Middleware Chain

```typescript
// Order matters
app.post(
  '/entitys',
  // 1. CORS (if needed)
  cors(),
  // 2. Authentication
  authenticate(),
  // 3. Authorization
  requirePermissions(['entity:write']),
  // 4. Validation
  zValidator('json', createEntitySchema),
  // 5. Rate limiting
  rateLimit({ max: 10, window: '1m' }),
  // 6. Handler
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    // ...
  }
);
```text

### Error Response Format

```typescript
// Success
type SuccessResponse<T> = {
  success: true;
  data: T;
};

// Error
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// In handler
try {
  const result = await service.method({ input });
  return c.json({ success: true, data: result });
} catch (error) {
  if (error instanceof ServiceError) {
    return c.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.statusCode
    );
  }
  throw error;
}
```text

---

## Frontend Patterns

### Query Key Factory

```typescript
// Define query keys centrally
export const entityKeys = {
  all: ['entitys'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters: Filters) => [...entityKeys.lists(), filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
};
```text

### Query Hooks

```typescript
// Fetch single item
export const useEntity = (id: string) => {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => fetchEntity(id),
    enabled: !!id,
  });
};

// Fetch list
export const useEntitys = (filters: Filters) => {
  return useQuery({
    queryKey: entityKeys.list(filters),
    queryFn: () => fetchEntitys(filters),
  });
};
```text

### Mutation Hooks

```typescript
export const useCreateEntity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: entityKeys.lists()
      });
    },
  });
};
```text

### Component Patterns

```typescript
// Container/Presenter pattern
export const EntityListContainer = () => {
  const { data, isLoading, error } = useEntitys({ page: 1 });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <EntityListPresenter entitys={data.items} />;
};

// Pure presenter component
type EntityListPresenterProps = {
  entitys: Entity[];
};

export const EntityListPresenter = ({
  entitys
}: EntityListPresenterProps) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {entitys.map((entity) => (
        <EntityCard key={entity.id} entity={entity} />
      ))}
    </div>
  );
};
```text

---

## Authentication & Authorization

### Get Actor from Context

```typescript
import { getActorFromContext } from '../utils/auth';

const handler = async (c: Context) => {
  const actor = await getActorFromContext(c);

  // Actor has: role, permissions, userId, etc.
  console.log(actor.role); // 'admin' | 'host' | 'guest'
  console.log(actor.permissions); // ['entity:write', ...]
};
```text

### Role-Based Access

```typescript
// Check role
if (actor.role !== 'admin') {
  return c.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } },
    403
  );
}
```text

### Permission-Based Access

```typescript
// Check permission
if (!actor.permissions.includes('entity:delete')) {
  return c.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
    403
  );
}
```text

### Public Endpoints

```typescript
// Use skipAuth option in route factory
const publicRoute = createListRoute({
  service: EntityService,
  schema: searchSchema,
  options: {
    skipAuth: true, // No authentication required
  },
});
```text

---

## Error Handling

### ServiceError Usage

```typescript
import { ServiceError, ServiceErrorCode } from '@repo/service-core';

// Not found
throw new ServiceError(
  'Entity not found',
  ServiceErrorCode.NOT_FOUND,
  { entityId: id }
);

// Validation error
throw new ServiceError(
  'Invalid input data',
  ServiceErrorCode.VALIDATION_ERROR,
  { errors: validationErrors }
);

// Forbidden
throw new ServiceError(
  'You do not have permission to perform this action',
  ServiceErrorCode.FORBIDDEN
);

// Conflict
throw new ServiceError(
  'Email already in use',
  ServiceErrorCode.CONFLICT,
  { email }
);
```text

### Global Error Handler

```typescript
// In app setup
app.onError((err, c) => {
  if (err instanceof ServiceError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode
    );
  }

  // Log unexpected errors
  logger.error('Unexpected error', { error: err });

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});
```text

---

## Validation Flow

### Client → Server Validation

```text

1. User Input

   ↓

2. Client-Side Validation (Zod schema)
   - Immediate feedback
   - User-friendly errors

   ↓

3. API Request

   ↓

4. Server-Side Validation (Zod middleware)
   - zValidator('json', schema)
   - Security layer

   ↓

5. Business Logic Validation (Service)
   - Business rules
   - Database constraints

   ↓

6. Database Constraints
   - Final safety net

```text

### Example

```typescript
// 1. Client-side (React component)
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(createEntitySchema),
});

// 2. API route (Server-side)
app.post(
  '/entitys',
  zValidator('json', createEntitySchema), // Validates again
  async (c) => {
    const input = c.req.valid('json'); // Validated and typed
    // ...
  }
);

// 3. Service (Business logic)
async create({ input, user }) {
  // Additional business validation
  if (input.capacity > 100) {
    throw new ServiceError('Capacity too high', ServiceErrorCode.VALIDATION_ERROR);
  }
  // ...
}
```text

---

## Summary Checklist

When implementing a new feature, ensure:

- [ ] Follows layer architecture (Database → Service → API → Frontend)
- [ ] Entity created in correct order (Zod → Types → Drizzle → Model → Service → API)
- [ ] Models extend BaseModel
- [ ] Services extend BaseCrudService
- [ ] API routes use factory pattern
- [ ] Proper authentication/authorization
- [ ] Soft delete pattern used
- [ ] Transactions for multi-step operations
- [ ] Validation at all layers
- [ ] Consistent error handling
- [ ] TanStack Query for frontend state

---

**These patterns are mandatory. Deviations must be discussed and approved.**

