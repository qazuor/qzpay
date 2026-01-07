# @qazuor/qzpay-hono

Hono middleware and routes for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-hono hono zod
```

## Features

- **Billing Routes**: REST API for billing operations
- **Admin Routes**: Administrative endpoints
- **Webhook Routes**: Webhook handling
- **Rate Limiting**: Request rate limiting middleware
- **Zod Validation**: Input validation schemas
- **Type Safety**: Full TypeScript support

## Usage

### Basic Setup

```typescript
import { createBillingRoutes } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';

const app = new Hono();

const billingRoutes = createBillingRoutes({
  billing,
  prefix: '/billing',
  customers: true,
  subscriptions: true,
  payments: true,
  invoices: true,
  plans: true
});

app.route('/api', billingRoutes);
```

### Rate Limiting

```typescript
import { createRateLimitMiddleware } from '@qazuor/qzpay-hono';

app.use('/api/*', createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  keyGenerator: (c) => c.req.header('x-api-key') || 'anonymous'
}));
```

### Webhook Routes

```typescript
import { createWebhookRoutes } from '@qazuor/qzpay-hono';

const webhookRoutes = createWebhookRoutes({
  billing,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});

app.route('/webhooks', webhookRoutes);
```

### Admin Routes

```typescript
import { createAdminRoutes } from '@qazuor/qzpay-hono';

const adminRoutes = createAdminRoutes({
  billing,
  prefix: '/admin'
});

app.route('/api', adminRoutes);
```

### Custom Validation

```typescript
import { CustomerBaseSchema, z } from '@qazuor/qzpay-hono';

// Extend the base schema
const MyCustomerSchema = CustomerBaseSchema.extend({
  companyName: z.string(),
  taxId: z.string().regex(/^\d{11}$/)
});
```

## API Endpoints

### Customers
- `GET /billing/customers` - List customers
- `GET /billing/customers/:id` - Get customer
- `POST /billing/customers` - Create customer
- `PATCH /billing/customers/:id` - Update customer
- `DELETE /billing/customers/:id` - Delete customer

### Subscriptions
- `GET /billing/subscriptions` - List subscriptions
- `GET /billing/subscriptions/:id` - Get subscription
- `POST /billing/subscriptions` - Create subscription
- `POST /billing/subscriptions/:id/cancel` - Cancel subscription

### Payments
- `GET /billing/payments` - List payments
- `GET /billing/payments/:id` - Get payment
- `POST /billing/payments` - Process payment
- `POST /billing/payments/:id/refund` - Refund payment

### Invoices
- `GET /billing/invoices` - List invoices
- `GET /billing/invoices/:id` - Get invoice
- `POST /billing/invoices` - Create invoice
- `POST /billing/invoices/:id/void` - Void invoice

### Plans
- `GET /billing/plans` - List plans
- `GET /billing/plans/:id` - Get plan

## Validation Schemas

Exported schemas for extension:
- `CustomerBaseSchema`
- `SubscriptionBaseSchema`
- `PaymentBaseSchema`
- `InvoiceBaseSchema`, `InvoiceLineSchema`
- `PaginationSchema`

## Rate Limit Store Interface

For custom stores (e.g., Redis):

```typescript
import type { QZPayRateLimitStore } from '@qazuor/qzpay-hono';

class RedisRateLimitStore implements QZPayRateLimitStore {
  async get(key: string) { ... }
  async increment(key: string, windowMs: number) { ... }
  async reset(key: string) { ... }
}

app.use('/api/*', createRateLimitMiddleware({
  store: new RedisRateLimitStore(redisClient)
}));
```

## License

MIT
