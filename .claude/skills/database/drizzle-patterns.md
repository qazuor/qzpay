# Drizzle ORM Patterns

## Overview

Drizzle is a TypeScript ORM with maximum type safety. This skill provides patterns for database operations with Drizzle.

---

## Schema Definition

### Table with Relations

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
}));

// Items table
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  price: integer('price').notNull(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  authorIdx: index('idx_items_author').on(table.authorId),
  statusIdx: index('idx_items_status').on(table.status),
  priceCheck: check('check_price_positive', sql`${table.price} > 0`),
}));

// Tags table (many-to-many)
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
});

// Junction table
export const itemTags = pgTable('item_tags', {
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));
```

### Relations Definition

```typescript
// Relations
export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  author: one(users, {
    fields: [items.authorId],
    references: [users.id],
  }),
  tags: many(itemTags),
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id],
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id],
  }),
}));
```

### Type Inference

```typescript
// Infer types from schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
```

---

## Query Patterns

### Basic CRUD

```typescript
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

// Create
const [newItem] = await db
  .insert(items)
  .values({
    title: 'New Item',
    price: 100,
    authorId: userId,
  })
  .returning();

// Read one
const item = await db.query.items.findFirst({
  where: eq(items.id, itemId),
  with: {
    author: true,
    tags: {
      with: {
        tag: true,
      },
    },
  },
});

// Read many
const activeItems = await db.query.items.findMany({
  where: and(
    eq(items.status, 'active'),
    isNull(items.deletedAt)
  ),
  orderBy: [desc(items.createdAt)],
  limit: 10,
});

// Update
const [updated] = await db
  .update(items)
  .set({
    title: 'Updated Title',
    updatedAt: new Date(),
  })
  .where(eq(items.id, itemId))
  .returning();

// Delete
await db
  .delete(items)
  .where(eq(items.id, itemId));
```

### Pagination

```typescript
async function findPaginated(input: {
  page: number;
  pageSize: number;
  status?: string;
}) {
  const { page, pageSize, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [isNull(items.deletedAt)];
  if (status) {
    conditions.push(eq(items.status, status));
  }

  const [results, [{ count }]] = await Promise.all([
    db.query.items.findMany({
      where: and(...conditions),
      limit: pageSize,
      offset,
      orderBy: [desc(items.createdAt)],
      with: { author: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(...conditions)),
  ]);

  return {
    data: results,
    pagination: {
      total: Number(count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(count) / pageSize),
    },
  };
}
```

### Soft Delete

```typescript
// Soft delete
await db
  .update(items)
  .set({ deletedAt: new Date() })
  .where(eq(items.id, itemId));

// Restore
await db
  .update(items)
  .set({ deletedAt: null })
  .where(eq(items.id, itemId));

// Query non-deleted only
const activeItems = await db.query.items.findMany({
  where: isNull(items.deletedAt),
});
```

### Transactions

```typescript
// Transaction with rollback on error
const result = await db.transaction(async (tx) => {
  // Create item
  const [item] = await tx
    .insert(items)
    .values({ title: 'New', price: 100, authorId: userId })
    .returning();

  // Add tags
  await tx.insert(itemTags).values(
    tagIds.map((tagId) => ({
      itemId: item.id,
      tagId,
    }))
  );

  // Update user stats
  await tx
    .update(users)
    .set({
      itemsCount: sql`${users.itemsCount} + 1`,
    })
    .where(eq(users.id, userId));

  return item;
});
```

---

## Model Class Pattern

```typescript
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { Database } from './client';

export class ItemModel {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.query.items.findFirst({
      where: and(eq(items.id, id), isNull(items.deletedAt)),
      with: { author: true },
    });
  }

  async findByAuthor(authorId: string) {
    return this.db.query.items.findMany({
      where: and(
        eq(items.authorId, authorId),
        isNull(items.deletedAt)
      ),
      orderBy: [desc(items.createdAt)],
    });
  }

  async create(data: NewItem) {
    const [item] = await this.db
      .insert(items)
      .values(data)
      .returning();
    return item;
  }

  async update(id: string, data: Partial<NewItem>) {
    const [item] = await this.db
      .update(items)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return item;
  }

  async softDelete(id: string) {
    const [item] = await this.db
      .update(items)
      .set({ deletedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return item;
  }
}
```

---

## Migrations

### Generate Migration

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Push schema directly (development only)
pnpm drizzle-kit push
```

### Migration File Example

```sql
-- 0001_create_items.sql
CREATE TABLE IF NOT EXISTS "items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "price" integer NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX "idx_items_author" ON "items"("author_id");
CREATE INDEX "idx_items_status" ON "items"("status");

ALTER TABLE "items" ADD CONSTRAINT "check_price_positive"
  CHECK ("price" > 0);
```

---

## Database Client Setup

```typescript
// client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

---

## Testing

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
import { ItemModel } from '../models/item.model';

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});
const db = drizzle(pool, { schema });

describe('ItemModel', () => {
  const model = new ItemModel(db);

  beforeEach(async () => {
    await db.delete(schema.items);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('create', () => {
    it('should create item', async () => {
      const item = await model.create({
        title: 'Test Item',
        price: 100,
        authorId: testUserId,
      });

      expect(item.id).toBeDefined();
      expect(item.title).toBe('Test Item');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent', async () => {
      const item = await model.findById('non-existent-id');
      expect(item).toBeNull();
    });
  });
});
```

---

## Best Practices

### Good

- Use type inference from schema (`$inferSelect`, `$inferInsert`)
- Use `relations` for type-safe joins
- Use transactions for multi-step operations
- Use `returning()` to get inserted/updated data
- Use indexes for frequently queried columns

### Bad

- Manually defining types that duplicate schema
- Using raw SQL when Drizzle has type-safe alternatives
- Forgetting to add indexes
- Not using transactions for related operations
- Ignoring soft delete patterns
