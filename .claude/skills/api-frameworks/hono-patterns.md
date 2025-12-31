# Hono Framework Patterns

## Overview

Hono is a lightweight, ultrafast web framework for the Edge. This skill provides patterns for implementing APIs with Hono.

---

## App Setup

**Pattern**: Modular app with middleware chain

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { itemRoutes } from './routes/items';
import { errorHandler } from './middleware/error-handler';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors());

// Routes
app.route('/api/v1/items', itemRoutes);

// Error handler
app.onError(errorHandler);

export { app };
```

---

## Route Definition

### Factory-Based Routes (Preferred)

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createItemSchema, updateItemSchema } from '../schemas/items';
import { itemService } from '../services/items';
import { requireAuth } from '../middleware/auth';
import { successResponse } from '../utils/response';

const app = new Hono();

// GET /items
app.get('/', async (c) => {
  const items = await itemService.findAll();
  return successResponse(c, items);
});

// GET /items/:id
app.get('/:id', async (c) => {
  const item = await itemService.findById(c.req.param('id'));
  if (!item) {
    return c.json({ error: 'Not found' }, 404);
  }
  return successResponse(c, item);
});

// POST /items
app.post('/',
  requireAuth,
  zValidator('json', createItemSchema),
  async (c) => {
    const data = c.req.valid('json');
    const actor = c.get('user');
    const item = await itemService.create({ data, actor });
    return successResponse(c, item, 201);
  }
);

// PUT /items/:id
app.put('/:id',
  requireAuth,
  zValidator('json', updateItemSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const actor = c.get('user');
    const item = await itemService.update({ id, data, actor });
    return successResponse(c, item);
  }
);

// DELETE /items/:id
app.delete('/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  await itemService.delete({ id, actor });
  return c.json({ success: true }, 204);
});

export { app as itemRoutes };
```

### CRUD Factory Pattern

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

interface CRUDRouteOptions<T> {
  service: {
    findAll: () => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    create: (data: unknown) => Promise<T>;
    update: (id: string, data: unknown) => Promise<T>;
    delete: (id: string) => Promise<void>;
  };
  createSchema: z.ZodSchema;
  updateSchema: z.ZodSchema;
  requireAuth?: boolean;
}

export function createCRUDRoute<T>(options: CRUDRouteOptions<T>) {
  const app = new Hono();
  const { service, createSchema, updateSchema } = options;

  app.get('/', async (c) => {
    const items = await service.findAll();
    return c.json({ data: items });
  });

  app.get('/:id', async (c) => {
    const item = await service.findById(c.req.param('id'));
    if (!item) return c.json({ error: 'Not found' }, 404);
    return c.json({ data: item });
  });

  app.post('/', zValidator('json', createSchema), async (c) => {
    const data = c.req.valid('json');
    const item = await service.create(data);
    return c.json({ data: item }, 201);
  });

  app.put('/:id', zValidator('json', updateSchema), async (c) => {
    const item = await service.update(c.req.param('id'), c.req.valid('json'));
    return c.json({ data: item });
  });

  app.delete('/:id', async (c) => {
    await service.delete(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
```

---

## Middleware Patterns

### Authentication Middleware

```typescript
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  const user = await verifyToken(token);
  if (!user) {
    throw new HTTPException(401, { message: 'Invalid token' });
  }

  c.set('user', user);
  await next();
};

export const optionalAuth: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      c.set('user', user);
    }
  }

  await next();
};
```

### Validation Middleware

```typescript
import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

// Body validation
app.post('/', zValidator('json', createItemSchema), handler);

// Query validation
app.get('/', zValidator('query', listQuerySchema), handler);

// Params validation
app.get('/:id', zValidator('param', idParamSchema), handler);
```

### Error Handler

```typescript
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        message: err.message,
        code: err.status.toString(),
      },
    }, err.status);
  }

  console.error('Unhandled error:', err);

  return c.json({
    success: false,
    error: {
      message: 'Internal server error',
      code: '500',
    },
  }, 500);
};
```

---

## Response Helpers

```typescript
import type { Context } from 'hono';

export function successResponse<T>(
  c: Context,
  data: T,
  status: 200 | 201 = 200
) {
  return c.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId'),
    },
  }, status);
}

export function paginatedResponse<T>(
  c: Context,
  data: T[],
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  }
) {
  return c.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}
```

---

## Testing with Hono

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../app';

describe('Item Routes', () => {
  describe('GET /api/v1/items', () => {
    it('should return all items', async () => {
      const res = await app.request('/api/v1/items');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/items', () => {
    it('should create item with valid data', async () => {
      const res = await app.request('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({ title: 'Test Item' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.title).toBe('Test Item');
    });

    it('should return 400 with invalid data', async () => {
      const res = await app.request('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({ title: '' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      });

      expect(res.status).toBe(401);
    });
  });
});
```

---

## Project Structure

```
{API_PATH}/
├── routes/
│   ├── index.ts           # Route aggregator
│   ├── items.ts           # Item routes
│   └── users.ts           # User routes
├── middleware/
│   ├── auth.ts            # Authentication
│   ├── validate.ts        # Validation helpers
│   └── error-handler.ts   # Error handling
├── services/
│   └── items.service.ts   # Business logic
├── schemas/
│   └── items.ts           # Zod schemas
├── utils/
│   └── response.ts        # Response helpers
└── app.ts                 # App entry point
```

---

## Best Practices

### Good

- Use `zValidator` for request validation
- Use `HTTPException` for error responses
- Use middleware composition
- Keep routes thin, business logic in services
- Use factory patterns for common CRUD

### Bad

- Inline validation logic
- Raw try-catch in every handler
- Business logic in route handlers
- Ignoring TypeScript types
