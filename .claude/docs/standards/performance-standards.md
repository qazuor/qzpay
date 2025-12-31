# Performance Standards

This document defines the performance standards and targets for the project.

---

## Table of Contents

<!-- markdownlint-disable MD051 -->

1. [Performance Philosophy](#performance-philosophy)
2. [Core Web Vitals](#core-web-vitals)
3. [API Performance](#api-performance)
4. [Bundle Size](#bundle-size)
5. [Database Performance](#database-performance)
6. [Caching Strategy](#caching-strategy)
7. [Image Optimization](#image-optimization)
8. [Monitoring](#monitoring)
9. [Performance Checklist](#performance-checklist)

<!-- markdownlint-enable MD051 -->

---

## Configuration

<!-- AUTO-GENERATED: Configured values -->
| Metric | Target |
|--------|--------|
| **LCP (Largest Contentful Paint)** | {{LCP_TARGET}}ms |
| **FID (First Input Delay)** | {{FID_TARGET}}ms |
| **CLS (Cumulative Layout Shift)** | {{CLS_TARGET}} |
| **Initial Bundle Size** | {{BUNDLE_SIZE_TARGET}}KB |
| **API Response Time** | {{API_RESPONSE_TARGET}}ms |
<!-- END AUTO-GENERATED -->

---

## Performance Philosophy

### Core Principles

**Speed is a Feature:**

- Performance directly impacts user experience
- Slow sites lose users and revenue
- Every millisecond matters

**Measure, Don't Guess:**

- Use real data from monitoring
- Profile before optimizing
- A/B test performance changes

**Budget-Based Approach:**

- Set performance budgets
- Fail builds that exceed budgets
- Track performance over time

---

## Core Web Vitals

### LCP (Largest Contentful Paint)

**Target: {{LCP_TARGET}}ms**

LCP measures loading performance. It marks the time at which the largest content element becomes visible.

**Optimization strategies:**

```typescript
// 1. Preload critical resources
<link rel="preload" href="/hero-image.webp" as="image" />
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />

// 2. Use next/image for automatic optimization
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // Preloads the image
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>

// 3. Server-side rendering for above-the-fold content
export const getServerSideProps = async () => {
  const heroData = await fetchHeroData();
  return { props: { heroData } };
};
```

**Common issues:**

- Large images without optimization
- Render-blocking CSS/JS
- Slow server response time
- Client-side rendering of critical content

### FID (First Input Delay)

**Target: {{FID_TARGET}}ms**

FID measures interactivity. It measures the time from when a user first interacts with your page to when the browser responds.

**Optimization strategies:**

```typescript
// 1. Split large JavaScript bundles
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// 2. Use web workers for heavy computations
const worker = new Worker('/workers/calculation.js');
worker.postMessage({ data: largeDataset });
worker.onmessage = (e) => setResult(e.data);

// 3. Defer non-critical JavaScript
<script src="/analytics.js" defer />

// 4. Break up long tasks
const processItems = async (items: Item[]) => {
  for (const chunk of chunks(items, 100)) {
    processChunk(chunk);
    await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
  }
};
```

**Common issues:**

- Large JavaScript bundles blocking main thread
- Heavy computations on user interaction
- Too many event listeners
- Unoptimized third-party scripts

### CLS (Cumulative Layout Shift)

**Target: {{CLS_TARGET}}**

CLS measures visual stability. It quantifies how often users experience unexpected layout shifts.

**Optimization strategies:**

```tsx
// 1. Always set dimensions on images
<Image
  src="/photo.jpg"
  alt="Photo"
  width={400}
  height={300}
/>

// 2. Reserve space for dynamic content
<div className="min-h-[200px]">
  {isLoading ? <Skeleton /> : <Content />}
</div>

// 3. Use CSS aspect-ratio
.video-container {
  aspect-ratio: 16 / 9;
}

// 4. Font loading strategy
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />

// In CSS:
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap; // or 'optional' for less CLS
}
```

**Common issues:**

- Images without dimensions
- Ads or embeds without reserved space
- Dynamically injected content
- Web fonts causing FOIT/FOUT

---

## API Performance

### Response Time Target: {{API_RESPONSE_TARGET}}ms

**Optimization strategies:**

```typescript
// 1. Database query optimization
// Bad: N+1 queries
const users = await db.query.users.findMany();
for (const user of users) {
  const bookings = await db.query.bookings.findMany({
    where: eq(bookings.userId, user.id),
  });
}

// Good: Single query with join
const usersWithBookings = await db.query.users.findMany({
  with: {
    bookings: true,
  },
});

// 2. Pagination for large datasets
const findAll = async ({ page = 1, pageSize = 20 }: PaginationInput) => {
  const [items, total] = await Promise.all([
    db.query.entities.findMany({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ count: count() }).from(entities),
  ]);

  return { items, total: total[0].count };
};

// 3. Response compression
import { compress } from 'hono/compress';
app.use('*', compress());

// 4. Parallel requests when possible
const [user, bookings, reviews] = await Promise.all([
  fetchUser(userId),
  fetchBookings(userId),
  fetchReviews(userId),
]);
```

### API Performance Budgets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Simple GET | <50ms | <100ms |
| List with pagination | <100ms | <200ms |
| Create/Update | <150ms | <300ms |
| Complex queries | <200ms | <500ms |
| Bulk operations | <500ms | <1000ms |

---

## Bundle Size

### Target: {{BUNDLE_SIZE_TARGET}}KB (initial)

**Analysis tools:**

```bash
# Analyze bundle size
pnpm build --analyze

# Using next-bundle-analyzer
ANALYZE=true pnpm build
```

**Optimization strategies:**

```typescript
// 1. Dynamic imports for route-based code splitting
const AdminDashboard = lazy(() => import('./AdminDashboard'));

// 2. Tree shaking - use named imports
// Bad
import _ from 'lodash';
// Good
import { debounce } from 'lodash-es';

// 3. Replace heavy libraries
// Instead of moment.js (300KB)
import { format, parseISO } from 'date-fns'; // 12KB

// Instead of lodash (70KB)
// Use native methods or lodash-es with tree shaking

// 4. External dependencies for SSR
// next.config.js
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'canvas'],
  },
};
```

### Bundle Size Budgets

| Category | Budget |
|----------|--------|
| Main JS bundle | <100KB gzipped |
| Route-specific JS | <50KB gzipped |
| CSS total | <50KB gzipped |
| Images above fold | <200KB |
| Total page weight | <500KB |

---

## Database Performance

### Query Optimization

```typescript
// 1. Use indexes for frequently queried columns
// In migration:
export const entitiesTable = pgTable('entities', {
  id: uuid('id').primaryKey(),
  hostId: uuid('host_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  hostIdIdx: index('entities_host_id_idx').on(table.hostId),
  typeIdx: index('entities_type_idx').on(table.type),
  createdAtIdx: index('entities_created_at_idx').on(table.createdAt),
}));

// 2. Select only needed columns
const entities = await db.query.entities.findMany({
  columns: {
    id: true,
    name: true,
    type: true,
    pricePerNight: true,
    // Don't select large columns like 'description' if not needed
  },
});

// 3. Use explain to analyze queries
const result = await db.execute(sql`
  EXPLAIN ANALYZE
  SELECT * FROM entities
  WHERE type = ${type}
  ORDER BY created_at DESC
  LIMIT 20
`);
```

### Connection Pooling

```typescript
// Configure connection pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## Caching Strategy

### Multi-Layer Caching

```typescript
// 1. In-memory cache for hot data
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, unknown>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// 2. Redis for distributed cache
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const getCached = async <T>(key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> => {
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  const data = await fetcher();
  await redis.setex(key, ttl, data);
  return data;
};

// 3. HTTP caching headers
const setCacheHeaders = (c: Context, maxAge: number) => {
  c.header('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge * 2}`);
  c.header('CDN-Cache-Control', `public, max-age=${maxAge * 2}`);
};
```

### Cache Invalidation

```typescript
// Invalidate on mutation
const updateEntity = async (id: string, data: UpdateEntityInput) => {
  await db.update(entities).set(data).where(eq(entities.id, id));

  // Invalidate caches
  await redis.del(`entity:${id}`);
  await redis.del(`entities:list:*`); // Pattern delete
};
```

---

## Image Optimization

### Image Guidelines

```typescript
// Use next/image or similar
import Image from 'next/image';

<Image
  src={entity.image}
  alt={entity.name}
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  loading="lazy" // or "eager" for above-fold
  placeholder="blur"
/>
```

### Image Formats

| Format | Use Case |
|--------|----------|
| WebP | Primary format (30% smaller than JPEG) |
| AVIF | Modern browsers (50% smaller) |
| JPEG | Fallback for older browsers |
| PNG | Graphics with transparency |
| SVG | Icons and logos |

### Image Sizes

| Use Case | Max Width | Quality |
|----------|-----------|---------|
| Thumbnail | 200px | 80% |
| Card image | 400px | 80% |
| Hero image | 1200px | 85% |
| Full width | 1920px | 85% |

---

## Monitoring

### Performance Monitoring Setup

```typescript
// Using Web Vitals
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

const sendToAnalytics = (metric: Metric) => {
  // Send to your analytics service
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify(metric),
  });
};

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

### Server-Side Monitoring

```typescript
// Track API response times
const timingMiddleware = async (c: Context, next: Next) => {
  const start = performance.now();

  await next();

  const duration = performance.now() - start;
  c.header('Server-Timing', `total;dur=${duration.toFixed(2)}`);

  // Log slow requests
  if (duration > {{API_RESPONSE_TARGET}}) {
    console.warn(`Slow request: ${c.req.path} took ${duration}ms`);
  }
};
```

---

## Performance Checklist

Before deploying:

**Core Web Vitals:**

- [ ] LCP < {{LCP_TARGET}}ms
- [ ] FID < {{FID_TARGET}}ms
- [ ] CLS < {{CLS_TARGET}}

**Frontend:**

- [ ] Initial bundle < {{BUNDLE_SIZE_TARGET}}KB
- [ ] Images optimized (WebP, proper sizing)
- [ ] Critical CSS inlined
- [ ] Fonts preloaded
- [ ] Lazy loading for below-fold content

**Backend:**

- [ ] API responses < {{API_RESPONSE_TARGET}}ms
- [ ] Database queries optimized
- [ ] Caching implemented
- [ ] Response compression enabled

**Monitoring:**

- [ ] Web Vitals tracking enabled
- [ ] API performance monitoring
- [ ] Error tracking configured
- [ ] Alerts for performance regressions

---

**Performance is a feature. All code must meet these standards.**
