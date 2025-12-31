# GEMFolio Direct Sales - Integration Example

Complete integration example for GEMFolio as a simple e-commerce with direct sales only (no subscriptions).

> **Note on Discount Types**: This example uses `QZPayDiscountType` (unified type). For better type safety:
> - Use `QZPayPromoCodeType` for promo codes (manual codes entered by customers)
> - Use `QZPayAutomaticDiscountType` for automatic discounts (system-applied)
> - See ARCHITECTURE.md for the complete type hierarchy.

## Project Context

**GEMFolio Direct Sales** is the simplest deployment mode:

- Single jewelry store
- One-time payments only (no subscriptions)
- Cart → Checkout → Payment
- Promo codes for discounts
- Guest checkout supported
- No membership tiers

## Business Model

```
+-------------------------------------------------------------------+
|                      JOYERIA AURORA                                |
|                   (GEMFolio Direct Sales)                          |
+-------------------------------------------------------------------+
|                                                                     |
|  +---------------+    +---------------+    +---------------+        |
|  |   Anillos     |    |   Collares    |    |   Pulseras    |        |
|  |   $150-500    |    |   $80-300     |    |   $50-200     |        |
|  +-------+-------+    +-------+-------+    +-------+-------+        |
|          |                    |                    |                 |
|          +--------------------+--------------------+                 |
|                               |                                      |
|                    +----------v----------+                           |
|                    |      Carrito        |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |    Promo Code?      |                           |
|                    |  VERANO20 = -20%    |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |   Pago Unico        |                           |
|                    |   (Stripe/MP)       |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |   Pedido Creado     |                           |
|                    |   Envio a Cliente   |                           |
|                    +---------------------+                           |
|                                                                     |
+-------------------------------------------------------------------+
```

## Comparison with Other Modes

| Feature | Direct Sales | Single Store | Marketplace |
|---------|--------------|--------------|-------------|
| Subscriptions | None | Customer loyalty | Vendor tiers |
| Payment type | One-time only | One-time + recurring | Split payments |
| Complexity | Minimal | Medium | High |
| Promo codes | Store purchases | Purchases + memberships | Platform + vendor |
| Use case | Simple store | Loyalty program | Multi-vendor |

## Tech Stack

- **Framework**: TanStack Start (Full-stack React)
- **Database**: PostgreSQL with Drizzle
- **Frontend**: React with Tailwind
- **Payments**: Stripe (primary), Mercado Pago (secondary)
- **Auth**: Better Auth

---

## Part 1: Initial Setup

### 1.1 Installation

```bash
# Backend packages (minimal setup)
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-mercadopago @qazuor/qzpay-drizzle

# Frontend packages
pnpm add @qazuor/qzpay-react

# CLI for environment setup
pnpm add -D @qazuor/qzpay-cli
```

### 1.2 Generate Environment Variables

```bash
# Generate .env.example (no subscriptions needed)
npx @qazuor/qzpay-cli env:generate --adapters stripe,mercadopago,resend

# Validate configuration
npx @qazuor/qzpay-cli env:validate
```

### 1.3 Environment Variables

```env
# =================================
# @qazuor/qzpay Configuration
# =================================

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx

# Resend
RESEND_API_KEY=re_xxx

# App
APP_URL=https://joyeria-aurora.com
```

---

## Part 2: Database Schema (Simplified)

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp, integer, boolean, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// ENUMS
// ============================================

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

// ============================================
// USERS (Optional - supports guest checkout)
// ============================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// PRODUCTS
// ============================================

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(),
  price: integer('price').notNull(), // in cents
  compareAtPrice: integer('compare_at_price'), // original price for discounts
  sku: text('sku').unique(),
  stock: integer('stock').default(0),
  category: text('category'),
  images: text('images').array(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// CARTS
// ============================================

export const carts = pgTable('carts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  sessionId: text('session_id'), // for guest carts
  promoCodeId: text('promo_code_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cartItems = pgTable('cart_items', {
  id: text('id').primaryKey(),
  cartId: text('cart_id').references(() => carts.id).notNull(),
  productId: text('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(), // price at time of adding
});

// ============================================
// ORDERS
// ============================================

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: text('user_id').references(() => users.id),

  // Guest info (when no user)
  guestEmail: text('guest_email'),
  guestName: text('guest_name'),
  guestPhone: text('guest_phone'),

  // Amounts
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').default(0),
  shipping: integer('shipping').default(0),
  tax: integer('tax').default(0),
  total: integer('total').notNull(),

  // Promo code
  promoCodeId: text('promo_code_id'),
  promoCodeCode: text('promo_code_code'),

  // Status
  status: orderStatusEnum('status').default('pending').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),

  // Payment info
  paymentProvider: text('payment_provider'), // 'stripe' | 'mercadopago'
  paymentIntentId: text('payment_intent_id'),

  // Shipping
  shippingAddress: text('shipping_address'), // JSON
  billingAddress: text('billing_address'), // JSON
  shippingMethod: text('shipping_method'),
  trackingNumber: text('tracking_number'),

  // Notes
  customerNote: text('customer_note'),
  internalNote: text('internal_note'),

  // Timestamps
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  productId: text('product_id').references(() => products.id).notNull(),
  productName: text('product_name').notNull(), // snapshot
  productSku: text('product_sku'),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  total: integer('total').notNull(),
});

// ============================================
// RELATIONS
// ============================================

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
```

---

## Part 3: Billing Configuration (Minimal)

### 3.1 Type Definitions

```typescript
// src/types/billing.ts
import type { QZPayEntitlements, QZPayLimits } from '@qazuor/qzpay-core';

// No entitlements needed for direct sales
// But we can define empty interfaces for consistency
export interface AuroraEntitlements extends QZPayEntitlements {
  // No subscription-based entitlements
}

export interface AuroraLimits extends QZPayLimits {
  // No limits
}
```

### 3.2 Billing Instance

```typescript
// src/lib/billing.ts
import { QZPayBilling, QZPayBillingEvent, QZPayDiscountType, QZPayDiscountStackingMode, QZPayDayOfWeek } from '@qazuor/qzpay-core';
import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { QZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { QZPayResendAdapter } from '@qazuor/qzpay-resend';
import { db } from '../db';

export const billing = new QZPayBilling({
  // ============================================
  // STORAGE
  // ============================================
  storage: new QZPayDrizzleStorage(db),

  // ============================================
  // PAYMENT PROVIDERS
  // ============================================
  paymentAdapters: {
    stripe: new QZPayStripeAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
    mercadopago: new QZPayMercadoPagoAdapter({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    }),
  },

  defaultProvider: 'stripe',

  // ============================================
  // EMAIL (Optional)
  // ============================================
  email: new QZPayResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: 'Joyeria Aurora <pedidos@joyeria-aurora.com>',
  }),

  // ============================================
  // NO PLANS (Direct sales only)
  // ============================================
  plans: [], // Empty - no subscriptions

  // ============================================
  // PROMO CODES
  // ============================================
  promoCodes: {
    // Percentage discount
    VERANO20: {
      code: 'VERANO20',
      type: QZPayDiscountType.PERCENTAGE,
      value: 20,
      description: '20% de descuento en toda la tienda',
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-03-31'),
      maxRedemptions: 500,
      minPurchaseAmount: 5000, // $50 minimum
    },

    // Fixed amount discount
    BIENVENIDA: {
      code: 'BIENVENIDA',
      type: QZPayDiscountType.FIXED_AMOUNT,
      value: 1500, // $15 off
      description: '$15 de descuento en tu primera compra',
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      maxRedemptionsPerCustomer: 1, // Only once per customer
      minPurchaseAmount: 5000, // $50 minimum
    },

    // Free shipping
    ENVIOGRATIS: {
      code: 'ENVIOGRATIS',
      type: QZPayDiscountType.FREE_SHIPPING,
      value: 0,
      description: 'Envio gratis en tu pedido',
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      minPurchaseAmount: 10000, // $100 minimum for free shipping
    },

    // VIP discount (high value)
    VIP50: {
      code: 'VIP50',
      type: QZPayDiscountType.PERCENTAGE,
      value: 50,
      description: '50% de descuento exclusivo VIP',
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      maxRedemptions: 10, // Very limited
      maxDiscountAmount: 50000, // Cap at $500 discount
    },

    // Category-specific discount
    ANILLOS30: {
      code: 'ANILLOS30',
      type: QZPayDiscountType.PERCENTAGE,
      value: 30,
      description: '30% en anillos de compromiso',
      validFrom: new Date('2025-02-01'),
      validUntil: new Date('2025-02-28'),
      metadata: {
        category: 'anillos-compromiso',
      },
    },

    // Minimum quantity discount
    PACK3X2: {
      code: 'PACK3X2',
      type: QZPayDiscountType.PERCENTAGE,
      value: 33.33,
      description: 'Lleva 3 y paga 2 (33% off)',
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      minQuantity: 3,
    },
  },

  // ============================================
  // AUTOMATIC DISCOUNTS (No code needed)
  // ============================================
  automaticDiscounts: {
    // 10% off orders over $100
    bulkOrder: {
      id: 'bulk-order-10',
      name: '10% en compras mayores a $100',
      type: QZPayDiscountType.PERCENTAGE,
      value: 10,
      conditions: {
        minPurchaseAmount: 10000, // $100
      },
      stackable: true,
      priority: 1,
    },

    // Free shipping over $75
    freeShipping: {
      id: 'free-shipping-75',
      name: 'Envio gratis en compras > $75',
      type: QZPayDiscountType.FREE_SHIPPING,
      value: 0,
      conditions: {
        minPurchaseAmount: 7500, // $75
      },
      stackable: true,
      priority: 2,
    },

    // 5% first purchase
    firstPurchase: {
      id: 'first-purchase-5',
      name: '5% bienvenida',
      description: 'En tu primera compra',
      type: QZPayDiscountType.PERCENTAGE,
      value: 5,
      conditions: {
        isFirstPurchase: true,
      },
      stackable: true,
      priority: 3,
    },

    // 15% buying 3+ items
    multiItem: {
      id: 'multi-item-15',
      name: '15% comprando 3+ articulos',
      type: QZPayDiscountType.PERCENTAGE,
      value: 15,
      conditions: {
        minQuantity: 3,
      },
      stackable: false,
      priority: 1,
    },

    // Happy hour Fridays
    happyHour: {
      id: 'happy-hour-friday',
      name: '20% Happy Hour Viernes',
      type: QZPayDiscountType.PERCENTAGE,
      value: 20,
      conditions: {
        schedule: {
          days: [QZPayDayOfWeek.FRIDAY],
          hours: { from: 18, to: 21 },
          timezone: 'America/Argentina/Buenos_Aires',
        },
      },
      stackable: false,
      priority: 1,
    },
  },

  // Stacking rules
  discountStacking: {
    mode: QZPayDiscountStackingMode.ALL_STACKABLE,
    maxStackedDiscounts: 2,
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================
  notifications: {
    templates: {
      // Order confirmation
      [QZPayBillingEvent.PAYMENT_SUCCEEDED]: {
        subject: 'Pedido confirmado #{{orderNumber}}',
        template: 'order-confirmed',
      },
      // Payment failed
      [QZPayBillingEvent.PAYMENT_FAILED]: {
        subject: 'Problema con tu pago',
        template: 'payment-failed',
      },
    },
  },
});
```

---

## Part 4: Services

### 4.1 Cart Service

```typescript
// src/services/cart.service.ts
import { nanoid } from 'nanoid';
import { db } from '../db';
import { carts, cartItems, products } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { billing } from '../lib/billing';

export const cartService = {
  async getOrCreateCart(userId?: string, sessionId?: string) {
    // Find existing cart
    let cart = await db.query.carts.findFirst({
      where: userId
        ? eq(carts.userId, userId)
        : eq(carts.sessionId, sessionId!),
      with: { items: { with: { product: true } } },
    });

    if (!cart) {
      const id = `cart_${nanoid()}`;
      await db.insert(carts).values({
        id,
        userId,
        sessionId: userId ? undefined : sessionId,
      });
      cart = await db.query.carts.findFirst({
        where: eq(carts.id, id),
        with: { items: { with: { product: true } } },
      });
    }

    return cart!;
  },

  async addItem(cartId: string, productId: string, quantity: number = 1) {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      throw new Error('Producto no encontrado');
    }

    if (!product.isActive) {
      throw new Error('Producto no disponible');
    }

    if (product.stock !== null && product.stock < quantity) {
      throw new Error('Stock insuficiente');
    }

    // Check if item already in cart
    const existingItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.productId, productId)
      ),
    });

    if (existingItem) {
      await db.update(cartItems)
        .set({ quantity: existingItem.quantity + quantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({
        id: `ci_${nanoid()}`,
        cartId,
        productId,
        quantity,
        unitPrice: product.price,
      });
    }

    return this.getCart(cartId);
  },

  async updateItemQuantity(cartId: string, itemId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }

    await db.update(cartItems)
      .set({ quantity })
      .where(and(
        eq(cartItems.id, itemId),
        eq(cartItems.cartId, cartId)
      ));

    return this.getCart(cartId);
  },

  async removeItem(cartId: string, itemId: string) {
    await db.delete(cartItems)
      .where(and(
        eq(cartItems.id, itemId),
        eq(cartItems.cartId, cartId)
      ));

    return this.getCart(cartId);
  },

  async getCart(cartId: string) {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: { items: { with: { product: true } } },
    });

    if (!cart) return null;

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    let discount = 0;
    let promoDescription = '';

    if (cart.promoCodeId) {
      const promoResult = await billing.promoCodes.calculateDiscount({
        promoCodeId: cart.promoCodeId,
        amount: subtotal,
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
      });
      discount = promoResult.discountAmount;
      promoDescription = promoResult.description;
    }

    return {
      ...cart,
      subtotal,
      discount,
      promoDescription,
      total: subtotal - discount,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  },

  async applyPromoCode(cartId: string, code: string, customerId?: string) {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Carrito no encontrado');
    }

    // Validate promo code
    const result = await billing.promoCodes.validate({
      code,
      customerId,
      context: {
        cartId,
        amount: cart.subtotal,
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
          category: item.product?.category,
        })),
      },
    });

    if (!result.valid) {
      throw new Error(result.message || 'Codigo invalido');
    }

    // Save to cart
    await db.update(carts)
      .set({ promoCodeId: result.promoCodeId })
      .where(eq(carts.id, cartId));

    return this.getCart(cartId);
  },

  async removePromoCode(cartId: string) {
    await db.update(carts)
      .set({ promoCodeId: null })
      .where(eq(carts.id, cartId));

    return this.getCart(cartId);
  },

  async clearCart(cartId: string) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
    await db.update(carts)
      .set({ promoCodeId: null })
      .where(eq(carts.id, cartId));
  },
};
```

### 4.2 Checkout Service

```typescript
// src/services/checkout.service.ts
import { nanoid } from 'nanoid';
import { db } from '../db';
import { orders, orderItems, carts, products } from '../db/schema';
import { eq } from 'drizzle-orm';
import { billing } from '../lib/billing';
import { cartService } from './cart.service';

interface CheckoutInput {
  cartId: string;
  userId?: string;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: object;
  shippingMethod: 'standard' | 'express';
  customerNote?: string;
  provider?: 'stripe' | 'mercadopago';
}

const SHIPPING_COSTS = {
  standard: 500, // $5
  express: 1500, // $15
};

export const checkoutService = {
  async createCheckout(input: CheckoutInput) {
    const cart = await cartService.getCart(input.cartId);

    if (!cart || cart.items.length === 0) {
      throw new Error('Carrito vacio');
    }

    // Validate stock
    for (const item of cart.items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
      });

      if (!product?.isActive) {
        throw new Error(`${item.product?.name} ya no esta disponible`);
      }

      if (product.stock !== null && product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${item.product?.name}`);
      }
    }

    // Calculate shipping
    let shippingCost = SHIPPING_COSTS[input.shippingMethod];

    // Check if free shipping promo applies
    if (cart.promoCodeId) {
      const promo = await billing.promoCodes.get(cart.promoCodeId);
      if (promo?.type === 'free_shipping') {
        shippingCost = 0;
      }
    }

    // Calculate totals
    const subtotal = cart.subtotal;
    const discount = cart.discount;
    const shipping = shippingCost;
    const tax = 0; // Simplified - no tax calculation
    const total = subtotal - discount + shipping + tax;

    // Generate order number
    const orderNumber = `AU-${Date.now().toString(36).toUpperCase()}`;

    // Create order
    const orderId = `order_${nanoid()}`;
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: input.userId,
      guestEmail: input.guestEmail,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      promoCodeId: cart.promoCodeId,
      promoCodeCode: cart.promoDescription ? cart.promoDescription.split(' ')[0] : null,
      shippingAddress: JSON.stringify(input.shippingAddress),
      billingAddress: input.billingAddress ? JSON.stringify(input.billingAddress) : null,
      shippingMethod: input.shippingMethod,
      customerNote: input.customerNote,
      paymentProvider: input.provider || 'stripe',
    });

    // Create order items
    for (const item of cart.items) {
      await db.insert(orderItems).values({
        id: `oi_${nanoid()}`,
        orderId,
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        productSku: item.product?.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.quantity,
      });
    }

    // Get customer email
    const customerEmail = input.guestEmail ||
      (input.userId ? (await db.query.users.findFirst({ where: eq(users.id, input.userId) }))?.email : null);

    // Create payment session
    const session = await billing.checkout.create({
      mode: 'payment', // One-time payment
      provider: input.provider || 'stripe',

      // Customer info
      customerEmail,

      // Line items for payment
      lineItems: cart.items.map(item => ({
        name: item.product?.name || 'Producto',
        description: item.product?.description,
        amount: item.unitPrice,
        quantity: item.quantity,
        images: item.product?.images,
      })),

      // Add shipping as line item if not free
      ...(shippingCost > 0 && {
        shippingOptions: [{
          name: input.shippingMethod === 'express' ? 'Envio Express' : 'Envio Estandar',
          amount: shippingCost,
        }],
      }),

      // Discount
      ...(discount > 0 && {
        discounts: [{
          amount: discount,
          description: cart.promoDescription,
        }],
      }),

      // Metadata
      metadata: {
        orderId,
        orderNumber,
        promoCode: cart.promoCodeId,
      },

      // Redirect URLs
      successUrl: `${process.env.APP_URL}/pedido/confirmado?order=${orderNumber}`,
      cancelUrl: `${process.env.APP_URL}/carrito?cancelled=true`,
    });

    return {
      orderId,
      orderNumber,
      checkoutUrl: session.url,
      clientSecret: session.clientSecret,
      total,
    };
  },

  async handlePaymentSuccess(paymentIntentId: string, metadata: Record<string, string>) {
    const { orderId } = metadata;

    // Update order status
    await db.update(orders)
      .set({
        status: 'paid',
        paymentStatus: 'completed',
        paymentIntentId,
        paidAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Get order with items
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) return;

    // Reduce stock
    for (const item of order.items) {
      await db.update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
        })
        .where(eq(products.id, item.productId));
    }

    // Mark promo code as used
    if (order.promoCodeId) {
      await billing.promoCodes.recordRedemption({
        promoCodeId: order.promoCodeId,
        customerId: order.userId || order.guestEmail,
        orderId: order.id,
        amount: order.discount,
      });
    }

    // Clear cart (find by user or guest)
    if (order.userId) {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.userId, order.userId),
      });
      if (cart) {
        await cartService.clearCart(cart.id);
      }
    }

    return order;
  },

  async getOrder(orderNumber: string) {
    return db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: { with: { product: true } } },
    });
  },
};

import { sql } from 'drizzle-orm';
import { users } from '../db/schema';
```

### 4.3 Order Service

```typescript
// src/services/order.service.ts
import { db } from '../db';
import { orders } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const orderService = {
  async getOrdersByUser(userId: string) {
    return db.query.orders.findMany({
      where: eq(orders.userId, userId),
      orderBy: desc(orders.createdAt),
      with: { items: true },
    });
  },

  async getOrderByNumber(orderNumber: string, email?: string) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: { with: { product: true } } },
    });

    // For guest orders, verify email
    if (order && !order.userId && email) {
      if (order.guestEmail !== email) {
        return null;
      }
    }

    return order;
  },

  async updateStatus(orderId: string, status: string, note?: string) {
    const updates: Record<string, unknown> = { status };

    if (status === 'shipped') {
      updates.shippedAt = new Date();
    } else if (status === 'delivered') {
      updates.deliveredAt = new Date();
    }

    if (note) {
      updates.internalNote = note;
    }

    await db.update(orders)
      .set(updates)
      .where(eq(orders.id, orderId));
  },

  async addTrackingNumber(orderId: string, trackingNumber: string) {
    await db.update(orders)
      .set({
        trackingNumber,
        status: 'shipped',
        shippedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  },
};
```

---

## Part 5: Event Handlers

```typescript
// src/lib/billing-events.ts
import { QZPayBillingEvent } from '@qazuor/qzpay-core';
import { billing } from './billing';
import { checkoutService } from '../services/checkout.service';
import { db } from '../db';
import { orders } from '../db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// PAYMENT EVENTS
// ============================================

billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, async (event) => {
  const { paymentIntentId, metadata } = event.data;

  console.log(`Payment succeeded: ${paymentIntentId}`);

  // Process order
  const order = await checkoutService.handlePaymentSuccess(
    paymentIntentId,
    metadata
  );

  if (order) {
    console.log(`Order ${order.orderNumber} marked as paid`);
  }
});

billing.on(QZPayBillingEvent.PAYMENT_FAILED, async (event) => {
  const { paymentIntentId, metadata, error } = event.data;

  console.error(`Payment failed: ${paymentIntentId}`, error);

  if (metadata?.orderId) {
    await db.update(orders)
      .set({
        paymentStatus: 'failed',
        internalNote: `Payment failed: ${error?.message}`,
      })
      .where(eq(orders.id, metadata.orderId));
  }
});

billing.on(QZPayBillingEvent.REFUND_CREATED, async (event) => {
  const { paymentIntentId, amount, metadata } = event.data;

  console.log(`Refund created: ${amount} for ${paymentIntentId}`);

  if (metadata?.orderId) {
    await db.update(orders)
      .set({
        status: 'refunded',
        paymentStatus: 'refunded',
      })
      .where(eq(orders.id, metadata.orderId));
  }
});

// ============================================
// PROMO CODE EVENTS
// ============================================

billing.on(QZPayBillingEvent.PROMO_CODE_REDEEMED, async (event) => {
  const { promoCodeId, code, customerId, orderId, discount } = event.data;

  console.log(`Promo code ${code} redeemed by ${customerId} for order ${orderId}`);
  console.log(`Discount applied: $${(discount / 100).toFixed(2)}`);
});

billing.on(QZPayBillingEvent.PROMO_CODE_EXHAUSTED, async (event) => {
  const { promoCodeId, code } = event.data;

  console.log(`Promo code ${code} has reached max redemptions`);

  // Could notify admin here
});
```

---

## Part 6: API Routes (TanStack Start)

### 6.1 Webhook Route

```typescript
// app/routes/api/billing/webhook.ts
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { billing } from '~/lib/billing';

export const APIRoute = createAPIFileRoute('/api/billing/webhook')({
  POST: async ({ request }) => {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    try {
      await billing.webhooks.handleStripe(body, signature!);
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Webhook Error', { status: 400 });
    }
  },
});
```

### 6.2 Cart Server Functions

```typescript
// app/server/cart.ts
import { createServerFn } from '@tanstack/react-start/server';
import { cartService } from '~/services/cart.service';
import { getCurrentUser, getSessionId } from '~/auth';

export const getCart = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.getCart(cart.id);
  });

export const addToCart = createServerFn({ method: 'POST' })
  .validator((data: { productId: string; quantity?: number }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.addItem(cart.id, data.productId, data.quantity || 1);
  });

export const updateCartItem = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string; quantity: number }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.updateItemQuantity(cart.id, data.itemId, data.quantity);
  });

export const removeCartItem = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.removeItem(cart.id, data.itemId);
  });

export const applyPromoCode = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.applyPromoCode(cart.id, data.code, user?.id);
  });

export const removePromoCode = createServerFn({ method: 'POST' })
  .handler(async ({ context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    return cartService.removePromoCode(cart.id);
  });
```

### 6.3 Checkout Server Functions

```typescript
// app/server/checkout.ts
import { createServerFn } from '@tanstack/react-start/server';
import { checkoutService } from '~/services/checkout.service';
import { cartService } from '~/services/cart.service';
import { getCurrentUser, getSessionId } from '~/auth';

interface CheckoutData {
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: object;
  shippingMethod: 'standard' | 'express';
  customerNote?: string;
  provider?: 'stripe' | 'mercadopago';
}

export const createCheckout = createServerFn({ method: 'POST' })
  .validator((data: CheckoutData) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    // Must have user or guest email
    if (!user && !data.guestEmail) {
      throw new Error('Se requiere email para compra como invitado');
    }

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);

    return checkoutService.createCheckout({
      cartId: cart.id,
      userId: user?.id,
      guestEmail: data.guestEmail,
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      shippingMethod: data.shippingMethod,
      customerNote: data.customerNote,
      provider: data.provider,
    });
  });

export const getCheckoutSummary = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const user = await getCurrentUser(context.request);
    const sessionId = getSessionId(context.request);

    const cart = await cartService.getOrCreateCart(user?.id, sessionId);
    const cartData = await cartService.getCart(cart.id);

    if (!cartData || cartData.items.length === 0) {
      return null;
    }

    return {
      items: cartData.items,
      subtotal: cartData.subtotal,
      discount: cartData.discount,
      promoDescription: cartData.promoDescription,
      shippingOptions: [
        { id: 'standard', name: 'Envio Estandar (5-7 dias)', price: 500 },
        { id: 'express', name: 'Envio Express (1-2 dias)', price: 1500 },
      ],
    };
  });
```

### 6.4 Order Server Functions

```typescript
// app/server/orders.ts
import { createServerFn } from '@tanstack/react-start/server';
import { orderService } from '~/services/order.service';
import { getCurrentUser } from '~/auth';

export const getMyOrders = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const user = await getCurrentUser(context.request);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return orderService.getOrdersByUser(user.id);
  });

export const getOrderByNumber = createServerFn({ method: 'GET' })
  .validator((data: { orderNumber: string; email?: string }) => data)
  .handler(async ({ data }) => {
    return orderService.getOrderByNumber(data.orderNumber, data.email);
  });

export const trackOrder = createServerFn({ method: 'GET' })
  .validator((data: { orderNumber: string; email: string }) => data)
  .handler(async ({ data }) => {
    const order = await orderService.getOrderByNumber(data.orderNumber, data.email);

    if (!order) {
      throw new Error('Pedido no encontrado');
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
      })),
    };
  });
```

---

## Part 7: Frontend Components

### 7.1 Cart Page

```tsx
// app/routes/carrito.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCart, updateCartItem, removeCartItem, applyPromoCode, removePromoCode } from '~/server/cart';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/carrito')({
  component: CartPage,
});

function CartPage() {
  const queryClient = useQueryClient();
  const { data: cart } = useSuspenseQuery({
    queryKey: ['cart'],
    queryFn: () => getCart(),
  });

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');

  const updateMutation = useMutation({
    mutationFn: updateCartItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const applyPromoMutation = useMutation({
    mutationFn: applyPromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setPromoCode('');
      setPromoError('');
    },
    onError: (error) => {
      setPromoError(error.message);
    },
  });

  const removePromoMutation = useMutation({
    mutationFn: removePromoCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Tu carrito esta vacio</h1>
        <p className="text-gray-600 mb-8">Agrega algunos productos para continuar</p>
        <Link to="/productos" className="btn btn-primary">
          Ver Productos
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">Tu Carrito ({cart.itemCount} items)</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
              <img
                src={item.product?.images?.[0] || '/placeholder.jpg'}
                alt={item.product?.name}
                className="w-24 h-24 object-cover rounded"
              />

              <div className="flex-1">
                <h3 className="font-semibold">{item.product?.name}</h3>
                <p className="text-gray-600">${(item.unitPrice / 100).toFixed(2)}</p>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateMutation.mutate({
                      itemId: item.id,
                      quantity: item.quantity - 1
                    })}
                    className="btn btn-sm"
                    disabled={updateMutation.isPending}
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateMutation.mutate({
                      itemId: item.id,
                      quantity: item.quantity + 1
                    })}
                    className="btn btn-sm"
                    disabled={updateMutation.isPending}
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeMutation.mutate({ itemId: item.id })}
                    className="btn btn-sm btn-ghost text-red-500 ml-4"
                    disabled={removeMutation.isPending}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="font-bold">
                  ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="border rounded-lg p-6 sticky top-4">
            <h2 className="text-lg font-bold mb-4">Resumen</h2>

            {/* Promo Code Input */}
            {!cart.promoCodeId ? (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Codigo de descuento
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="VERANO20"
                    className="input input-bordered flex-1"
                  />
                  <button
                    onClick={() => applyPromoMutation.mutate({ code: promoCode })}
                    disabled={!promoCode || applyPromoMutation.isPending}
                    className="btn btn-secondary"
                  >
                    Aplicar
                  </button>
                </div>
                {promoError && (
                  <p className="text-red-500 text-sm mt-1">{promoError}</p>
                )}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-green-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-green-700 font-medium">{cart.promoDescription}</p>
                  <p className="text-green-600 text-sm">
                    -${(cart.discount / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => removePromoMutation.mutate()}
                  className="text-gray-500 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(cart.subtotal / 100).toFixed(2)}</span>
              </div>

              {cart.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-${(cart.discount / 100).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-500">
                <span>Envio</span>
                <span>Calculado en checkout</span>
              </div>

              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>${(cart.total / 100).toFixed(2)}</span>
              </div>
            </div>

            <Link
              to="/checkout"
              className="btn btn-primary w-full mt-6"
            >
              Proceder al Checkout
            </Link>

            <p className="text-center text-sm text-gray-500 mt-4">
              Envio gratis en compras mayores a $100
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 7.2 Checkout Page

```tsx
// app/routes/checkout.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';
import { getCheckoutSummary, createCheckout } from '~/server/checkout';
import { useState } from 'react';
import { useAuth } from '~/hooks/useAuth';

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: summary } = useSuspenseQuery({
    queryKey: ['checkout-summary'],
    queryFn: () => getCheckoutSummary(),
  });

  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [formData, setFormData] = useState({
    guestEmail: '',
    guestName: '',
    guestPhone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Argentina',
    customerNote: '',
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      // Redirect to Stripe/MP checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
  });

  if (!summary) {
    navigate({ to: '/carrito' });
    return null;
  }

  const shippingCost = shippingMethod === 'express' ? 1500 : 500;
  const total = summary.subtotal - summary.discount + shippingCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    checkoutMutation.mutate({
      guestEmail: user ? undefined : formData.guestEmail,
      guestName: user ? undefined : formData.guestName,
      guestPhone: user ? undefined : formData.guestPhone,
      shippingAddress: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
      },
      shippingMethod,
      customerNote: formData.customerNote,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Guest Info (if not logged in) */}
          {!user && (
            <div className="border rounded-lg p-6">
              <h2 className="font-bold mb-4">Informacion de Contacto</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    className="input input-bordered w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.guestName}
                      onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                      className="input input-bordered w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Telefono</label>
                    <input
                      type="tel"
                      value={formData.guestPhone}
                      onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                      className="input input-bordered w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Address */}
          <div className="border rounded-lg p-6">
            <h2 className="font-bold mb-4">Direccion de Envio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Direccion *</label>
                <input
                  type="text"
                  required
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Calle y numero"
                  className="input input-bordered w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ciudad *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provincia *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Codigo Postal *</label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pais</label>
                  <input
                    type="text"
                    value={formData.country}
                    readOnly
                    className="input input-bordered w-full bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Method */}
          <div className="border rounded-lg p-6">
            <h2 className="font-bold mb-4">Metodo de Envio</h2>
            <div className="space-y-3">
              {summary.shippingOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer ${
                    shippingMethod === option.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      value={option.id}
                      checked={shippingMethod === option.id}
                      onChange={() => setShippingMethod(option.id as 'standard' | 'express')}
                      className="radio radio-primary"
                    />
                    <span>{option.name}</span>
                  </div>
                  <span className="font-medium">
                    ${(option.price / 100).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-6">
            <h2 className="font-bold mb-4">Notas (opcional)</h2>
            <textarea
              value={formData.customerNote}
              onChange={(e) => setFormData({ ...formData, customerNote: e.target.value })}
              placeholder="Instrucciones especiales para tu pedido..."
              className="textarea textarea-bordered w-full"
              rows={3}
            />
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="border rounded-lg p-6 sticky top-4">
            <h2 className="font-bold mb-4">Resumen del Pedido</h2>

            <div className="space-y-3 mb-4">
              {summary.items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img
                    src={item.product?.images?.[0] || '/placeholder.jpg'}
                    alt={item.product?.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.product?.name}</p>
                    <p className="text-sm text-gray-500">Cant: {item.quantity}</p>
                  </div>
                  <p className="font-medium">
                    ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(summary.subtotal / 100).toFixed(2)}</span>
              </div>

              {summary.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{summary.promoDescription}</span>
                  <span>-${(summary.discount / 100).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Envio</span>
                <span>${(shippingCost / 100).toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>${(total / 100).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={checkoutMutation.isPending}
              className="btn btn-primary w-full mt-6"
            >
              {checkoutMutation.isPending ? 'Procesando...' : 'Pagar Ahora'}
            </button>

            <div className="flex items-center justify-center gap-4 mt-4">
              <img src="/stripe-logo.svg" alt="Stripe" className="h-6" />
              <img src="/mp-logo.svg" alt="Mercado Pago" className="h-6" />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
```

### 7.3 Order Confirmation Page

```tsx
// app/routes/pedido/confirmado.tsx
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getOrderByNumber } from '~/server/orders';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/pedido/confirmado')({
  component: OrderConfirmedPage,
  validateSearch: (search: Record<string, unknown>) => ({
    order: search.order as string,
  }),
});

function OrderConfirmedPage() {
  const { order: orderNumber } = useSearch({ from: '/pedido/confirmado' });

  const { data: order } = useSuspenseQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => getOrderByNumber({ orderNumber }),
  });

  if (!order) {
    return (
      <div className="container mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Pedido no encontrado</h1>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-16 max-w-2xl">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-3xl font-bold text-green-600 mb-2">
          ¡Gracias por tu compra!
        </h1>
        <p className="text-gray-600">
          Pedido #{order.orderNumber}
        </p>
      </div>

      <div className="border rounded-lg p-6 mb-6">
        <h2 className="font-bold mb-4">Detalles del Pedido</h2>

        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.productName} x {item.quantity}</span>
              <span>${(item.total / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t mt-4 pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${(order.subtotal / 100).toFixed(2)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Descuento ({order.promoCodeCode})</span>
              <span>-${(order.discount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Envio</span>
            <span>${(order.shipping / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>${(order.total / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 mb-6">
        <h2 className="font-bold mb-4">Direccion de Envio</h2>
        <p className="text-gray-600">
          {JSON.parse(order.shippingAddress || '{}').street}<br />
          {JSON.parse(order.shippingAddress || '{}').city}, {JSON.parse(order.shippingAddress || '{}').state}<br />
          {JSON.parse(order.shippingAddress || '{}').postalCode}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-blue-700 mb-2">
          Enviamos un email de confirmacion a <strong>{order.guestEmail || order.user?.email}</strong>
        </p>
        <p className="text-blue-600 text-sm">
          Te notificaremos cuando tu pedido sea enviado
        </p>
      </div>

      <div className="flex gap-4 mt-8">
        <Link to="/productos" className="btn btn-outline flex-1">
          Seguir Comprando
        </Link>
        <Link to="/rastrear" className="btn btn-primary flex-1">
          Rastrear Pedido
        </Link>
      </div>
    </div>
  );
}
```

### 7.4 Order Tracking Page

```tsx
// app/routes/rastrear.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { trackOrder } from '~/server/orders';
import { useState } from 'react';

export const Route = createFileRoute('/rastrear')({
  component: TrackOrderPage,
});

const STATUS_STEPS = [
  { key: 'paid', label: 'Confirmado' },
  { key: 'processing', label: 'En Preparacion' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'delivered', label: 'Entregado' },
];

function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');

  const trackMutation = useMutation({
    mutationFn: trackOrder,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    trackMutation.mutate({ orderNumber, email });
  };

  const getCurrentStep = (status: string) => {
    const index = STATUS_STEPS.findIndex(s => s.key === status);
    return index >= 0 ? index : 0;
  };

  return (
    <div className="container mx-auto py-16 max-w-xl">
      <h1 className="text-2xl font-bold text-center mb-8">Rastrear Pedido</h1>

      <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Numero de Pedido
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="AU-XXXXXX"
              className="input input-bordered w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="input input-bordered w-full"
              required
            />
          </div>
          <button
            type="submit"
            disabled={trackMutation.isPending}
            className="btn btn-primary w-full"
          >
            {trackMutation.isPending ? 'Buscando...' : 'Rastrear'}
          </button>
        </div>
      </form>

      {trackMutation.isError && (
        <div className="alert alert-error mb-8">
          Pedido no encontrado. Verifica el numero y email.
        </div>
      )}

      {trackMutation.data && (
        <div className="border rounded-lg p-6">
          <h2 className="font-bold mb-6">
            Pedido #{trackMutation.data.orderNumber}
          </h2>

          {/* Progress Steps */}
          <div className="flex justify-between mb-8">
            {STATUS_STEPS.map((step, index) => {
              const currentStep = getCurrentStep(trackMutation.data!.status);
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm ${isCompleted ? 'font-medium' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tracking Number */}
          {trackMutation.data.trackingNumber && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-blue-600 mb-1">Numero de Seguimiento:</p>
              <p className="font-mono font-bold">{trackMutation.data.trackingNumber}</p>
            </div>
          )}

          {/* Items */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Items del Pedido:</h3>
            <ul className="list-disc list-inside text-gray-600">
              {trackMutation.data.items.map((item, i) => (
                <li key={i}>{item.name} x {item.quantity}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Part 8: Available Promo Codes Summary

| Code | Type | Value | Description | Conditions |
|------|------|-------|-------------|------------|
| `VERANO20` | Percentage | 20% | Summer sale | Min $50, max 500 uses |
| `BIENVENIDA` | Fixed | $15 | First purchase | Min $50, once per customer |
| `ENVIOGRATIS` | Free Shipping | - | Free shipping | Min $100 |
| `VIP50` | Percentage | 50% | VIP exclusive | Max $500 discount, 10 uses only |
| `ANILLOS30` | Percentage | 30% | Engagement rings | Category: anillos-compromiso |
| `PACK3X2` | Percentage | 33% | Buy 3 pay 2 | Min 3 items |

---

## Complete Flow

```
1. BROWSING
   User → Views products → Adds to cart

2. CART
   Cart page → Shows items
            → Apply promo code (optional)
            → See discount applied
            → Proceed to checkout

3. CHECKOUT
   Guest or logged in → Fill shipping info
                     → Select shipping method
                     → Review order
                     → Click "Pay Now"

4. PAYMENT
   Redirect to Stripe/MP → Complete payment
                        → Return to confirmation

5. CONFIRMATION
   Order confirmed → Email sent
                  → Stock reduced
                  → Promo code marked as used

6. TRACKING
   Guest can track → Enter order # + email
                  → See status updates
```

---

## Summary: Direct Sales vs Other Modes

| Feature | Direct Sales | Single Store | Marketplace |
|---------|--------------|--------------|-------------|
| Plans | None | Customer loyalty | Vendor tiers |
| Payments | One-time only | One-time + recurring | Splits |
| Promo codes | Store purchases | + memberships | + vendor codes |
| Checkout | Simple | + member pricing | + split calc |
| Complexity | **Minimal** | Medium | High |
| Configuration | **30 min** | 1 hour | 2+ hours |

---

*Example for @qazuor/qzpay v2.0 - Direct Sales Mode (Simplest)*
