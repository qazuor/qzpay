# GEMFolio Single Store - Integration Example

Complete integration example for GEMFolio deployed as a single-store e-commerce for "Joyeria Pepito".

> **Note on Discount Types**: This example uses `QZPayDiscountType` (unified type). For better type safety:
> - Use `QZPayPromoCodeType` for promo codes (manual codes entered by customers)
> - Use `QZPayAutomaticDiscountType` for automatic discounts (system-applied)
> - See ARCHITECTURE.md for the complete type hierarchy.

## Project Context

**GEMFolio Single Store** is the same platform as GEMFolio Marketplace, but deployed for a single jewelry store:

- One owner/seller (Joyeria Pepito)
- Direct sales to customers
- No split payments (all revenue to store owner)
- Customer loyalty program with membership tiers
- Product bundles and volume discounts
- Promo codes for customers

## Business Model

```
+-------------------------------------------------------------------+
|                      JOYERIA PEPITO                                |
|                   (GEMFolio Single Store)                          |
+-------------------------------------------------------------------+
|                                                                     |
|  +---------------+    +---------------+    +---------------+        |
|  |   Anillos     |    |   Collares    |    |   Pulseras    |        |
|  |   de Oro      |    |   de Plata    |    |   Artesanales |        |
|  +-------+-------+    +-------+-------+    +-------+-------+        |
|          |                    |                    |                 |
|          +--------------------+--------------------+                 |
|                               |                                      |
|                    +----------v----------+                           |
|                    |    Carrito Unico    |                           |
|                    |    (Single Seller)  |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |  Pago Directo       |                           |
|                    |  (Sin Split)        |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |  Joyeria Pepito     |                           |
|                    |  100% del pago      |                           |
|                    +---------------------+                           |
|                                                                     |
+-------------------------------------------------------------------+
```

## Differences from Marketplace Version

| Aspect | Marketplace | Single Store |
|--------|-------------|--------------|
| Vendors | Multiple | One (store owner) |
| Payments | Split to vendors | Direct to owner |
| Onboarding | Stripe Connect | Regular Stripe |
| Commissions | Platform takes % | No commissions |
| Subscriptions | Vendor tiers | Customer loyalty |
| Complexity | Higher | Lower |

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
# Backend packages (no Connect needed)
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-mercadopago @qazuor/qzpay-drizzle

# Frontend packages
pnpm add @qazuor/qzpay-react

# CLI for environment setup
pnpm add -D @qazuor/qzpay-cli
```

### 1.2 Generate Environment Variables

```bash
# Generate .env.example (simpler than marketplace)
npx @qazuor/qzpay-cli env:generate --adapters stripe,mercadopago,resend

# Output:
# =================================
# @qazuor/qzpay Configuration
# =================================
#
# Stripe (Regular, not Connect)
# STRIPE_SECRET_KEY=  # Required
# STRIPE_WEBHOOK_SECRET=  # Required
# # STRIPE_PUBLISHABLE_KEY=  # Optional
#
# MercadoPago
# MP_ACCESS_TOKEN=  # Required
# # MP_WEBHOOK_SECRET=  # Optional
#
# Resend
# RESEND_API_KEY=  # Required
#
# App
# APP_URL=http://localhost:3000
```

**.env completo:**

```env
# .env
DATABASE_URL=postgres://user:pass@neon.tech/joyeria_pepito

# Stripe (cuenta directa de Joyeria Pepito)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Mercado Pago (cuenta de Joyeria Pepito)
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# App
APP_URL=https://joyeriapepito.com
STORE_NAME="Joyeria Pepito"
```

### 1.3 Database Schema (Simplified)

```typescript
// src/db/schema/index.ts
import {
  pgTable,
  text,
  decimal,
  timestamp,
  boolean,
  jsonb,
  integer,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ============================================
// APP TABLES (Joyeria Pepito specific)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  phone: varchar('phone', { length: 50 }),
  // Customer loyalty tier (synced from billing subscription)
  loyaltyTier: varchar('loyalty_tier', { length: 50 }).default('standard'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Addresses for shipping
export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  label: varchar('label', { length: 100 }), // "Casa", "Trabajo"
  street: text('street').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 2 }).default('AR'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Product categories
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  image: varchar('image', { length: 500 }),
  parentId: uuid('parent_id').references(() => categories.id),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Products (simplified - no vendorId)
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => categories.id),

  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 500 }),
  images: jsonb('images').$type<string[]>().default([]),

  // Pricing
  priceAmount: integer('price_amount').notNull(), // in cents
  priceCurrency: text('price_currency').notNull().default('ARS'),
  compareAtPrice: integer('compare_at_price'), // original price for sales

  // Member pricing (loyalty tiers)
  memberPricing: jsonb('member_pricing').$type<{
    silver: number;   // price for silver members
    gold: number;     // price for gold members
    platinum: number; // price for platinum members
  }>(),

  // Volume pricing
  volumePricing: jsonb('volume_pricing').$type<{
    minQuantity: number;
    priceAmount: number;
  }[]>(),

  // Inventory
  sku: varchar('sku', { length: 100 }),
  stock: integer('stock').notNull().default(0),
  trackInventory: boolean('track_inventory').default(true),
  allowBackorder: boolean('allow_backorder').default(false),
  lowStockThreshold: integer('low_stock_threshold').default(5),

  // Physical properties
  weight: decimal('weight', { precision: 10, scale: 2 }),
  material: varchar('material', { length: 100 }), // oro, plata, etc.
  gemstone: varchar('gemstone', { length: 100 }), // diamante, rubi, etc.

  // SEO
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: varchar('meta_description', { length: 500 }),

  // Status
  status: text('status').notNull().default('draft'), // draft, active, archived
  isFeatured: boolean('is_featured').default(false),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Product bundles (sets de joyas)
export const bundles = pgTable('bundles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  images: jsonb('images').$type<string[]>().default([]),

  // Bundle discount
  discountType: text('discount_type').notNull(), // 'percentage' | 'fixed'
  discountValue: integer('discount_value').notNull(),

  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bundleProducts = pgTable('bundle_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  bundleId: uuid('bundle_id').references(() => bundles.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull().default(1),
});

// Cart
export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  sessionId: text('session_id'), // for guest checkout
  promoCodeId: text('promo_code_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').references(() => carts.id).notNull(),
  productId: uuid('product_id').references(() => products.id),
  bundleId: uuid('bundle_id').references(() => bundles.id),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Orders (simplified - no vendor splits)
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  userId: uuid('user_id').references(() => users.id),
  guestEmail: varchar('guest_email', { length: 255 }), // for guest checkout

  // Payment reference
  paymentId: text('payment_id'), // @qazuor/payments payment ID

  // Totals
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  memberDiscount: integer('member_discount').default(0), // loyalty discount
  shipping: integer('shipping').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull(),
  currency: text('currency').notNull(),

  // Status
  paymentStatus: text('payment_status').notNull().default('pending'),
  // pending, paid, failed, refunded, partially_refunded
  fulfillmentStatus: text('fulfillment_status').notNull().default('unfulfilled'),
  // unfulfilled, partially_fulfilled, fulfilled, shipped, delivered

  // Shipping
  shippingAddress: jsonb('shipping_address'),
  billingAddress: jsonb('billing_address'),
  shippingMethod: varchar('shipping_method', { length: 100 }),

  // Tracking
  trackingNumber: varchar('tracking_number', { length: 255 }),
  trackingUrl: varchar('tracking_url', { length: 500 }),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),

  // Promo
  promoCodeId: text('promo_code_id'),
  promoDiscount: integer('promo_discount'),

  // Notes
  customerNote: text('customer_note'),
  internalNote: text('internal_note'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Order Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id),
  bundleId: uuid('bundle_id').references(() => bundles.id),

  // Snapshot at time of purchase
  name: text('name').notNull(),
  sku: varchar('sku', { length: 100 }),
  image: varchar('image', { length: 500 }),

  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Wishlist
export const wishlistItems = pgTable('wishlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// BILLING TABLES (generated by @qazuor/qzpay-drizzle)
// ============================================

import { createBillingSchema } from '@qazuor/qzpay-drizzle/schema';

export const billingSchema = createBillingSchema({
  tablePrefix: 'billing_',
  userTable: users,
  userIdColumn: 'id',
});

export const {
  customers: billingCustomers,
  subscriptions: billingSubscriptions,
  payments: billingPayments,
  invoices: billingInvoices,
  promoCodes: billingPromoCodes,
  promoCodeUsage: billingPromoCodeUsage,
  plans: billingPlans,
  paymentMethods: billingPaymentMethods,
  auditLogs: billingAuditLogs,
  webhookEvents: billingWebhookEvents,
} = billingSchema;
```

---

## Part 2: Billing Configuration

### 2.1 Customer Loyalty Plans (Memberships)

```typescript
// src/config/plans.ts
import {
  QZPayBillingInterval,
  type QZPayPlanDefinition,
  type QZPayEntitlements,
  type QZPayLimits,
} from '@qazuor/qzpay-core';

/**
 * Customer loyalty entitlements (boolean features)
 */
export interface QZPayPepitoEntitlements extends QZPayEntitlements {
  hasEarlyAccess: boolean;        // Access to new collections first
  hasFreeShipping: boolean;       // Free shipping on all orders
  hasExclusiveProducts: boolean;  // Access to exclusive items
  hasBirthdayGift: boolean;       // Birthday gift/discount
  hasPrioritySupport: boolean;    // Priority customer support
  hasGiftWrapping: boolean;       // Free gift wrapping
}

/**
 * Customer loyalty limits (numeric restrictions)
 * -1 means unlimited
 */
export interface QZPayPepitoLimits extends QZPayLimits {
  discountPercent: number;        // % discount on all purchases
  freeRepairsPerYear: number;     // Free jewelry repairs
  reservationDays: number;        // Days to reserve items
}

/**
 * Customer loyalty tiers
 */
export const LOYALTY_PLANS: QZPayPlanDefinition<QZPayPepitoEntitlements, QZPayPepitoLimits>[] = [
  {
    id: 'standard',
    name: 'Cliente',
    description: 'Cliente regular de Joyeria Pepito',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 0, currency: 'ARS' },
      [QZPayBillingInterval.YEAR]: { amount: 0, currency: 'ARS' },
    },
    entitlements: {
      hasEarlyAccess: false,
      hasFreeShipping: false,
      hasExclusiveProducts: false,
      hasBirthdayGift: false,
      hasPrioritySupport: false,
      hasGiftWrapping: false,
    },
    limits: {
      discountPercent: 0,
      freeRepairsPerYear: 0,
      reservationDays: 0,
    },
    trial: null,
    displayFeatures: [
      'Acceso a catalogo completo',
      'Garantia estandar',
      'Soporte por email',
    ],
  },

  {
    id: 'silver',
    name: 'Miembro Plata',
    description: 'Beneficios exclusivos para clientes frecuentes',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 99900, currency: 'ARS' }, // $999 ARS/mes
      [QZPayBillingInterval.YEAR]: { amount: 999900, currency: 'ARS' }, // $9.999 ARS/anio
    },
    entitlements: {
      hasEarlyAccess: false,
      hasFreeShipping: false,
      hasExclusiveProducts: false,
      hasBirthdayGift: true,
      hasPrioritySupport: false,
      hasGiftWrapping: true,
    },
    limits: {
      discountPercent: 5,
      freeRepairsPerYear: 1,
      reservationDays: 3,
    },
    trial: {
      days: 30,
      requiresPaymentMethod: false, // Trial sin tarjeta
    },
    displayFeatures: [
      '5% de descuento en todo',
      'Regalo de cumpleanos',
      'Envoltorio de regalo gratis',
      '1 reparacion gratis/ano',
      'Reservar items por 3 dias',
    ],
  },

  {
    id: 'gold',
    name: 'Miembro Oro',
    description: 'Para amantes de las joyas',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 249900, currency: 'ARS' }, // $2.499 ARS/mes
      [QZPayBillingInterval.YEAR]: { amount: 2499900, currency: 'ARS' }, // $24.999 ARS/anio
    },
    entitlements: {
      hasEarlyAccess: true,
      hasFreeShipping: false,
      hasExclusiveProducts: true,
      hasBirthdayGift: true,
      hasPrioritySupport: true,
      hasGiftWrapping: true,
    },
    limits: {
      discountPercent: 10,
      freeRepairsPerYear: 3,
      reservationDays: 7,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    isFeatured: true,
    badgeText: 'Mas Popular',
    displayFeatures: [
      '10% de descuento en todo',
      'Acceso anticipado a colecciones',
      'Productos exclusivos',
      'Regalo de cumpleanos premium',
      'Soporte prioritario',
      '3 reparaciones gratis/ano',
      'Reservar items por 7 dias',
    ],
  },

  {
    id: 'platinum',
    name: 'Miembro Platino',
    description: 'La experiencia VIP completa',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 499900, currency: 'ARS' }, // $4.999 ARS/mes
      [QZPayBillingInterval.YEAR]: { amount: 4999900, currency: 'ARS' }, // $49.999 ARS/anio
    },
    entitlements: {
      hasEarlyAccess: true,
      hasFreeShipping: true,
      hasExclusiveProducts: true,
      hasBirthdayGift: true,
      hasPrioritySupport: true,
      hasGiftWrapping: true,
    },
    limits: {
      discountPercent: 15,
      freeRepairsPerYear: -1, // unlimited
      reservationDays: 14,
    },
    trial: {
      days: 7,
      requiresPaymentMethod: true, // VIP requiere tarjeta
    },
    displayFeatures: [
      '15% de descuento en todo',
      'Envio gratis siempre',
      'Acceso VIP a colecciones',
      'Productos exclusivos Platino',
      'Atencion personalizada',
      'Reparaciones ilimitadas',
      'Reservar items por 14 dias',
      'Invitaciones a eventos',
    ],
  },
];

export type LoyaltyTier = 'standard' | 'silver' | 'gold' | 'platinum';
```

### 2.2 Promo Codes for Customers

```typescript
// src/config/promo-codes.ts
import { QZPayDiscountType, QZPayBillingInterval } from '@qazuor/qzpay-core';

/**
 * Promo codes for product purchases
 */
export const STORE_PROMO_CODES = {
  // First purchase discount
  BIENVENIDO15: {
    code: 'BIENVENIDO15',
    type: QZPayDiscountType.PERCENTAGE,
    value: 15, // 15% off
    config: {},
    restrictions: {
      maxUses: 1000,
      maxUsesPerCustomer: 1,
      newCustomersOnly: true,
      minOrderAmount: 1000000, // $10.000 ARS minimum
    },
  },

  // Fixed amount discount
  DESCUENTO5000: {
    code: 'DESCUENTO5000',
    type: QZPayDiscountType.FIXED_AMOUNT,
    value: 500000, // $5.000 ARS off
    config: { currency: 'ARS' },
    restrictions: {
      minOrderAmount: 2500000, // $25.000 ARS minimum
    },
  },

  // Holiday sale
  NAVIDAD20: {
    code: 'NAVIDAD20',
    type: QZPayDiscountType.PERCENTAGE,
    value: 20, // 20% off
    config: {},
    restrictions: {
      expiresAt: new Date('2025-12-31'),
      validCategories: ['anillos', 'collares', 'pulseras'],
    },
  },

  // Free shipping
  ENVIOGRATIS: {
    code: 'ENVIOGRATIS',
    type: QZPayDiscountType.FIXED_AMOUNT,
    value: 0, // Calculated at checkout
    config: { freeShipping: true },
    restrictions: {
      minOrderAmount: 5000000, // $50.000 ARS minimum
    },
  },

  // Birthday discount (generated per customer)
  CUMPLE20: {
    code: 'CUMPLE20',
    type: QZPayDiscountType.PERCENTAGE,
    value: 20, // 20% off
    config: {},
    restrictions: {
      maxUsesPerCustomer: 1,
      validDays: 7, // Valid for 7 days from birthday
    },
  },
};

/**
 * Promo codes for membership subscriptions
 */
export const MEMBERSHIP_PROMO_CODES = {
  // First month free
  MEMBRESIA1MES: {
    code: 'MEMBRESIA1MES',
    type: QZPayDiscountType.FREE_PERIOD,
    value: 1, // 1 month free
    config: {},
    restrictions: {
      validPlans: ['silver', 'gold'],
      validIntervals: [QZPayBillingInterval.MONTH],
      newCustomersOnly: true,
    },
  },

  // 30% off for 3 months
  VIP30: {
    code: 'VIP30',
    type: QZPayDiscountType.REDUCED_PERIOD,
    value: 30, // 30% off
    config: { periods: 3 },
    restrictions: {
      validPlans: ['gold', 'platinum'],
    },
  },
};
```

### 2.2.2 Descuentos Automaticos (Auto-Applied)

```typescript
// src/config/automatic-discounts.ts
import { QZPayDiscountType, QZPayDiscountStackingMode, QZPayDayOfWeek, type QZPayAutomaticDiscount } from '@qazuor/qzpay-core';

/**
 * Descuentos automaticos para Joyeria Pepito
 * Se aplican sin que el cliente ingrese codigo
 */
export const QZPayPepitoAutomaticDiscounts: Record<string, QZPayAutomaticDiscount> = {
  // ============================================
  // DESCUENTOS EN COMPRAS
  // ============================================

  // 10% en compras mayores a $100.000
  compraGrande: {
    id: 'compra-grande-10',
    name: '10% en compras mayores a $100.000',
    description: 'Gracias por tu compra grande!',
    type: QZPayDiscountType.PERCENTAGE,
    value: 10,
    conditions: {
      minPurchaseAmount: 10000000, // $100.000 ARS
    },
    appliesTo: 'order',
    stackable: true,
    priority: 1,
  },

  // Envio gratis en compras mayores a $50.000
  envioGratis: {
    id: 'envio-gratis-50k',
    name: 'Envio gratis en compras > $50.000',
    type: QZPayDiscountType.FREE_SHIPPING,
    value: 0,
    conditions: {
      minPurchaseAmount: 5000000, // $50.000 ARS
    },
    appliesTo: 'order',
    stackable: true,
    priority: 2,
  },

  // 5% primera compra
  primeraCompra: {
    id: 'primera-compra-5',
    name: '5% de bienvenida',
    description: 'Bienvenido a Joyeria Pepito!',
    type: QZPayDiscountType.PERCENTAGE,
    value: 5,
    conditions: {
      isFirstPurchase: true,
    },
    appliesTo: 'order',
    stackable: true,
    priority: 3,
  },

  // 15% comprando 3+ articulos
  pack3: {
    id: 'pack-3-items',
    name: '15% comprando 3+ articulos',
    type: QZPayDiscountType.PERCENTAGE,
    value: 15,
    conditions: {
      minQuantity: 3,
    },
    appliesTo: 'order',
    stackable: false,
    priority: 1,
  },

  // Happy Hour Viernes 18-21hs
  happyHourViernes: {
    id: 'happy-hour-viernes',
    name: '20% Happy Hour Viernes',
    description: 'Viernes de 18 a 21hs',
    type: QZPayDiscountType.PERCENTAGE,
    value: 20,
    conditions: {
      schedule: {
        days: [QZPayDayOfWeek.FRIDAY],
        hours: { from: 18, to: 21 },
        timezone: 'America/Argentina/Buenos_Aires',
      },
    },
    appliesTo: 'order',
    stackable: false,
    priority: 1,
  },

  // ============================================
  // DESCUENTOS EN MEMBRESIAS
  // ============================================

  // Primer mes gratis al subir a Gold
  upgradeGold: {
    id: 'upgrade-gold-free',
    name: 'Primer mes gratis en Gold',
    type: QZPayDiscountType.FREE_PERIOD,
    value: 1,
    conditions: {
      isUpgrade: true,
      fromPlans: ['standard', 'silver'],
      toPlans: ['gold'],
    },
    appliesTo: 'subscription',
    stackable: false,
    priority: 1,
    maxRedemptionsPerCustomer: 1,
  },

  // 20% extra en plan anual para nuevos miembros
  anualNuevo: {
    id: 'anual-nuevo-20',
    name: '20% extra en plan anual',
    description: 'Para nuevos miembros',
    type: QZPayDiscountType.PERCENTAGE,
    value: 20,
    conditions: {
      isFirstPurchase: true,
      billingInterval: 'year',
    },
    appliesTo: 'subscription',
    stackable: true,
    priority: 3,
  },
};
```

### 2.3 Billing System Instance (Simplified)

```typescript
// src/lib/billing.ts
import {
  createQZPayBilling,
  QZPayCurrency,
  QZPayCheckoutMode,
  QZPayNotificationMode,
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
} from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { createQZPayResendAdapter } from '@qazuor/qzpay-resend';
import { db } from '../db';
import {
  LOYALTY_PLANS,
  type QZPayPepitoEntitlements,
  type QZPayPepitoLimits,
} from '../config/plans';
import { QZPayPepitoAutomaticDiscounts } from '../config/automatic-discounts';

// Store configuration
const STORE_CONFIG = {
  name: process.env.STORE_NAME || 'Joyeria Pepito',
  currency: 'ARS' as const,
  country: 'AR',
};

// Create billing system instance (NO marketplace/connect)
export const billing = createQZPayBilling<QZPayPepitoEntitlements, QZPayPepitoLimits>({
  projectId: 'joyeria-pepito',

  // Storage
  storage: createQZPayDrizzleStorage(db, {
    tablePrefix: 'billing_',
  }),

  // Plans (customer loyalty tiers)
  plans: LOYALTY_PLANS,

  // Descuentos automaticos
  automaticDiscounts: QZPayPepitoAutomaticDiscounts,

  // Reglas de combinacion
  discountStacking: {
    mode: QZPayDiscountStackingMode.ALL_STACKABLE,
    maxStackedDiscounts: 2,
  },

  // Payment adapters (regular, not Connect)
  paymentAdapters: {
    stripe: createQZPayStripeAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      // NO connect configuration - direct payments
    }),
    mercadopago: createQZPayMercadoPagoAdapter({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      // NO marketplace configuration - direct payments
    }),
  },

  // Email adapter
  emailAdapter: createQZPayResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: `${STORE_CONFIG.name} <ventas@joyeriapepito.com>`,
  }),

  // Notifications
  notifications: {
    mode: QZPayNotificationMode.HYBRID,
    templates: {
      [QZPayBillingEvent.PAYMENT_SUCCEEDED]: 'pepito-order-confirmation',
      [QZPayBillingEvent.SUBSCRIPTION_CREATED]: 'pepito-membership-welcome',
      [QZPayBillingEvent.TRIAL_STARTED]: 'pepito-trial-started',
    },
    // Store handles these
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
    ],
  },

  // Currency
  currency: {
    base: QZPayCurrency.ARS,
    supported: [QZPayCurrency.ARS, QZPayCurrency.USD],
    strategy: 'provider',
  },

  // Subscriptions (for loyalty memberships)
  subscriptions: {
    gracePeriodDays: 7,
    retryAttempts: 3,
    retryIntervalHours: 48,
    trialReminderDays: [7, 3, 1],
    expirationWarningDays: [7, 3, 1],
  },

  // Checkout
  checkout: {
    mode: QZPayCheckoutMode.EMBEDDED,
  },
});

// ============================================
// CUSTOMER HELPERS
// ============================================

/**
 * Get customer's loyalty tier and benefits
 */
export async function getCustomerBenefits(userId: string) {
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(userId);

  if (!subscription || !subscription.hasAccess()) {
    const standardPlan = LOYALTY_PLANS.find(p => p.id === 'standard')!;
    return {
      tier: 'standard' as const,
      plan: standardPlan,
      entitlements: standardPlan.entitlements,
      limits: standardPlan.limits,
      subscription: null,
      isMember: false,
    };
  }

  return {
    tier: subscription.planId as keyof typeof LOYALTY_PLANS,
    plan: subscription.getPlan(),
    entitlements: subscription.getEntitlements(),
    limits: subscription.getLimits(),
    subscription: {
      id: subscription.id,
      status: subscription.status,
      isTrial: subscription.isTrial(),
      trialDaysRemaining: subscription.getTrialDaysRemaining(),
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    isMember: true,
  };
}

/**
 * Calculate product price for customer (with member discount)
 */
export async function getProductPriceForCustomer(
  productId: string,
  userId?: string
): Promise<{ price: number; originalPrice: number; discount: number; tier: string }> {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const originalPrice = product.priceAmount;

  // No user = no discount
  if (!userId) {
    return {
      price: originalPrice,
      originalPrice,
      discount: 0,
      tier: 'guest',
    };
  }

  const benefits = await getCustomerBenefits(userId);

  // Check for tier-specific pricing first
  if (product.memberPricing) {
    const tierPrice = product.memberPricing[benefits.tier as keyof typeof product.memberPricing];
    if (tierPrice && tierPrice < originalPrice) {
      return {
        price: tierPrice,
        originalPrice,
        discount: originalPrice - tierPrice,
        tier: benefits.tier,
      };
    }
  }

  // Apply percentage discount from tier
  const discountPercent = benefits.limits.discountPercent;
  if (discountPercent > 0) {
    const discount = Math.round(originalPrice * (discountPercent / 100));
    return {
      price: originalPrice - discount,
      originalPrice,
      discount,
      tier: benefits.tier,
    };
  }

  return {
    price: originalPrice,
    originalPrice,
    discount: 0,
    tier: benefits.tier,
  };
}

/**
 * Check if customer has free shipping
 */
export async function hasFreeShipping(userId: string): Promise<boolean> {
  const benefits = await getCustomerBenefits(userId);
  return benefits.entitlements.hasFreeShipping;
}

/**
 * Check if customer can access exclusive products
 */
export async function canAccessExclusiveProducts(userId: string): Promise<boolean> {
  const benefits = await getCustomerBenefits(userId);
  return benefits.entitlements.hasExclusiveProducts;
}
```

---

## Part 3: Checkout Service (Simplified)

```typescript
// src/services/checkout.service.ts
import { QZPayCurrency, QZPayDiscountType } from '@qazuor/qzpay-core';
import { billing, getCustomerBenefits, getProductPriceForCustomer } from '../lib/billing';
import { db } from '../db';
import { carts, cartItems, products, bundles, orders, orderItems, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CheckoutInput {
  cartId: string;
  userId?: string;
  guestEmail?: string;
  shippingAddress: any;
  billingAddress?: any;
  shippingMethod: string;
  customerNote?: string;
}

export interface CheckoutResult {
  clientSecret: string;
  sessionId: string;
  orderId: string;
  orderNumber: string;
}

export class CheckoutService {
  /**
   * Create checkout session (NO splits - single seller)
   */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.getCartWithItems(input.cartId);

    if (!cart || cart.items.length === 0) {
      throw new Error('El carrito esta vacio');
    }

    // Calculate totals with member discounts
    const totals = await this.calculateTotals(cart, input.userId);

    // Get or create customer
    let customer;
    if (input.userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      customer = await billing.customers.syncUser({
        id: input.userId,
        email: user!.email,
        name: user?.name,
      });
    } else {
      // Guest checkout
      customer = await billing.customers.create({
        email: input.guestEmail!,
        metadata: { isGuest: true },
      });
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create pending order
    const orderId = nanoid();
    const [order] = await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: input.userId,
      guestEmail: input.guestEmail,
      subtotal: totals.subtotal,
      discount: totals.promoDiscount,
      memberDiscount: totals.memberDiscount,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      currency: 'ARS',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress || input.shippingAddress,
      shippingMethod: input.shippingMethod,
      customerNote: input.customerNote,
      promoCodeId: cart.promoCodeId,
      promoDiscount: totals.promoDiscount,
    }).returning();

    // Create order items
    for (const item of totals.items) {
      await db.insert(orderItems).values({
        id: nanoid(),
        orderId,
        productId: item.productId,
        bundleId: item.bundleId,
        name: item.name,
        sku: item.sku,
        image: item.image,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        discount: item.discount,
        total: item.total,
      });
    }

    // Create checkout session (simple - no splits)
    const session = await billing.checkout.create({
      customerId: customer.id,
      mode: 'payment',
      items: [{
        name: `Pedido #${orderNumber}`,
        description: `${totals.items.length} productos de Joyeria Pepito`,
        amount: totals.total,
        quantity: 1,
      }],
      promoCode: cart.promoCodeId ? await this.getPromoCode(cart.promoCodeId) : undefined,
      successUrl: `${process.env.APP_URL}/pedido/${orderId}/confirmacion`,
      cancelUrl: `${process.env.APP_URL}/carrito`,
      metadata: {
        orderId,
        orderNumber,
        cartId: input.cartId,
      },
    });

    return {
      clientSecret: session.clientSecret,
      sessionId: session.id,
      orderId,
      orderNumber,
    };
  }

  /**
   * Calculate totals with member discounts
   */
  private async calculateTotals(cart: any, userId?: string) {
    const items: any[] = [];
    let subtotal = 0;
    let memberDiscount = 0;

    // Get customer benefits
    const benefits = userId
      ? await getCustomerBenefits(userId)
      : { tier: 'guest', limits: { discountPercent: 0 }, entitlements: { hasFreeShipping: false } };

    for (const item of cart.items) {
      const product = item.product;
      const bundle = item.bundle;

      if (product) {
        // Get price for customer (with member discount)
        const priceInfo = await getProductPriceForCustomer(product.id, userId);

        const itemSubtotal = priceInfo.originalPrice * item.quantity;
        const itemDiscount = priceInfo.discount * item.quantity;
        const itemTotal = priceInfo.price * item.quantity;

        items.push({
          productId: product.id,
          bundleId: null,
          name: product.name,
          sku: product.sku,
          image: product.images?.[0],
          quantity: item.quantity,
          unitPrice: priceInfo.price,
          subtotal: itemSubtotal,
          discount: itemDiscount,
          total: itemTotal,
        });

        subtotal += itemSubtotal;
        memberDiscount += itemDiscount;
      } else if (bundle) {
        // Bundle pricing
        const bundlePrice = await this.calculateBundlePrice(bundle.id);
        const itemTotal = bundlePrice.price * item.quantity;

        items.push({
          productId: null,
          bundleId: bundle.id,
          name: bundle.name,
          sku: null,
          image: bundle.images?.[0],
          quantity: item.quantity,
          unitPrice: bundlePrice.price,
          subtotal: bundlePrice.originalPrice * item.quantity,
          discount: bundlePrice.discount * item.quantity,
          total: itemTotal,
        });

        subtotal += bundlePrice.originalPrice * item.quantity;
        memberDiscount += bundlePrice.discount * item.quantity;
      }
    }

    // Promo code discount
    let promoDiscount = 0;
    if (cart.promoCodeId) {
      const promoResult = await billing.promoCodes.calculateDiscount({
        promoCodeId: cart.promoCodeId,
        amount: subtotal - memberDiscount,
      });
      promoDiscount = promoResult.discountAmount;
    }

    // Shipping
    const shipping = benefits.entitlements.hasFreeShipping ? 0 : this.calculateShipping(subtotal);

    // Tax (21% IVA in Argentina, already included in prices)
    const tax = 0;

    const total = subtotal - memberDiscount - promoDiscount + shipping + tax;

    return {
      items,
      subtotal,
      memberDiscount,
      promoDiscount,
      shipping,
      tax,
      total,
    };
  }

  private calculateShipping(subtotal: number): number {
    // Free shipping over $50.000 ARS
    if (subtotal >= 5000000) {
      return 0;
    }
    // Flat rate shipping
    return 250000; // $2.500 ARS
  }

  private async calculateBundlePrice(bundleId: string) {
    const bundle = await db.query.bundles.findFirst({
      where: eq(bundles.id, bundleId),
      with: {
        products: {
          with: { product: true },
        },
      },
    });

    if (!bundle) {
      throw new Error('Bundle not found');
    }

    let originalPrice = 0;
    for (const bp of bundle.products) {
      originalPrice += bp.product.priceAmount * bp.quantity;
    }

    let discount = 0;
    if (bundle.discountType === 'percentage') {
      discount = Math.round(originalPrice * (bundle.discountValue / 100));
    } else {
      discount = bundle.discountValue;
    }

    return {
      originalPrice,
      discount,
      price: originalPrice - discount,
    };
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `JP${year}${month}-${random}`;
  }

  private async getCartWithItems(cartId: string) {
    return db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: {
        items: {
          with: {
            product: true,
            bundle: true,
          },
        },
      },
    });
  }

  private async getPromoCode(promoCodeId: string): Promise<string | undefined> {
    const promo = await db.query.billingPromoCodes.findFirst({
      where: eq(billingPromoCodes.id, promoCodeId),
    });
    return promo?.code;
  }
}

export const checkoutService = new CheckoutService();
```

---

## Part 4: Event Handlers

```typescript
// src/lib/billing-events.ts
import {
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  type QZPayPaymentSucceededEvent,
  type QZPaySubscriptionCreatedEvent,
  type QZPayTrialExpiringEvent,
} from '@qazuor/qzpay-core';
import { billing } from './billing';
import { db } from '../db';
import { users, orders, products, cartItems } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { sendEmail } from './email';
import { analytics } from './analytics';

// ============================================
// PAYMENT EVENTS (Product purchases)
// ============================================

billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, async (event: QZPayPaymentSucceededEvent) => {
  const { payment, customer, emailSentByPackage } = event;

  console.log(`Payment succeeded: ${payment.id}`);

  const { orderId, orderNumber, cartId } = payment.metadata || {};

  if (orderId) {
    // Update order status
    await db.update(orders)
      .set({
        paymentId: payment.id,
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Update product stock
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (order) {
      for (const item of order.items) {
        if (item.productId) {
          await db.execute(sql`
            UPDATE ${products}
            SET stock = stock - ${item.quantity}
            WHERE id = ${item.productId}
          `);
        }
      }
    }

    // Clear cart
    if (cartId) {
      await db.delete(cartItems)
        .where(eq(cartItems.cartId, cartId));
    }

    // Send order confirmation (if not sent by package)
    if (!emailSentByPackage) {
      await sendEmail({
        to: customer.email,
        template: 'pepito-order-confirmation',
        data: {
          orderNumber,
          items: order?.items,
          total: payment.amount,
          shippingAddress: order?.shippingAddress,
        },
      });
    }

    await analytics.track('order_completed', {
      orderId,
      orderNumber,
      amount: payment.amount,
      itemCount: order?.items.length,
    });
  }
});

billing.on(QZPayBillingEvent.PAYMENT_FAILED, async (event) => {
  const { payment, customer, error, willRetry, emailSentByPackage } = event;

  console.log(`Payment failed: ${payment.id}, will retry: ${willRetry}`);

  const { orderId } = payment.metadata || {};

  if (orderId) {
    await db.update(orders)
      .set({
        paymentStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  // Email already sent by package for payment failures
});

// ============================================
// MEMBERSHIP EVENTS (Loyalty subscriptions)
// ============================================

billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event: QZPaySubscriptionCreatedEvent) => {
  const { subscription, customer, emailSentByPackage } = event;

  console.log(`Membership created: ${subscription.id}, tier: ${subscription.planId}`);

  // Update user's loyalty tier
  await db.update(users)
    .set({ loyaltyTier: subscription.planId })
    .where(eq(users.id, customer.externalId));

  await analytics.track('membership_created', {
    userId: customer.externalId,
    tier: subscription.planId,
    isTrial: subscription.isTrial(),
  });
});

billing.on(QZPayBillingEvent.TRIAL_STARTED, async (event) => {
  const { subscription, customer } = event;

  console.log(`Trial started: ${subscription.id}`);

  // Update user's loyalty tier
  await db.update(users)
    .set({ loyaltyTier: subscription.planId })
    .where(eq(users.id, customer.externalId));

  // Send trial tips email
  await sendEmail({
    to: customer.email,
    template: 'pepito-trial-tips',
    data: {
      tierName: subscription.getPlanName(),
      daysRemaining: subscription.getTrialDaysRemaining(),
      benefits: subscription.getEntitlements(),
    },
  });
});

// Custom trial expiring email (suppressed)
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event: QZPayTrialExpiringEvent) => {
  const { subscription, customer, daysRemaining, emailSentByPackage } = event;

  // emailSentByPackage === false (suppressed)
  const user = await db.query.users.findFirst({
    where: eq(users.id, customer.externalId),
  });

  if (user) {
    // hasPaymentMethod is a pre-calculated property, not a method
    const { hasPaymentMethod } = subscription;
    const tierName = subscription.getPlanName();
    const benefits = subscription.getEntitlements();

    await sendEmail({
      to: customer.email,
      template: 'pepito-trial-expiring',
      data: {
        userName: user.name,
        tierName,
        daysLeft: daysRemaining,
        benefits,
        hasPaymentMethod,
        addPaymentUrl: hasPaymentMethod
          ? null
          : `${process.env.APP_URL}/mi-cuenta/membresia?add-payment`,
      },
    });
  }
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_EXPIRED, async (event) => {
  const { subscription, customer } = event;

  console.log(`Membership expired: ${subscription.id}`);

  // Downgrade to standard
  await db.update(users)
    .set({ loyaltyTier: 'standard' })
    .where(eq(users.id, customer.externalId));

  await sendEmail({
    to: customer.email,
    template: 'pepito-membership-expired',
    data: {
      reactivateUrl: `${process.env.APP_URL}/membresia`,
    },
  });
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_UPGRADED, async (event) => {
  const { subscription, customer, oldPlan, newPlan } = event;

  await db.update(users)
    .set({ loyaltyTier: newPlan.id })
    .where(eq(users.id, customer.externalId));

  await analytics.track('membership_upgraded', {
    userId: customer.externalId,
    fromTier: oldPlan.id,
    toTier: newPlan.id,
  });
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_DOWNGRADED, async (event) => {
  const { subscription, customer, oldPlan, newPlan } = event;

  await db.update(users)
    .set({ loyaltyTier: newPlan.id })
    .where(eq(users.id, customer.externalId));

  await analytics.track('membership_downgraded', {
    userId: customer.externalId,
    fromTier: oldPlan.id,
    toTier: newPlan.id,
  });
});

// ============================================
// PROMO CODE EVENTS
// ============================================

billing.on(QZPayBillingEvent.PROMO_CODE_APPLIED, async (event) => {
  const { promoCode, customer, discountAmount } = event;

  await analytics.track('promo_code_applied', {
    code: promoCode.code,
    customerId: customer?.externalId,
    discountAmount,
  });
});
```

---

## Part 5: API Routes (TanStack Start)

### 5.1 Billing Webhook Route

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

### 5.2 Product Server Functions

```typescript
// app/server/products.ts
import { createServerFn } from '@tanstack/react-start/server';
import { getProductPriceForCustomer } from '~/lib/billing';
import { getCurrentUser } from '~/auth';

export const getProductPrice = createServerFn({ method: 'GET' })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    return getProductPriceForCustomer(data.productId, user?.id);
  });
```

### 5.3 Membership Server Functions

```typescript
// app/server/membership.ts
import { createServerFn } from '@tanstack/react-start/server';
import { billing, getCustomerBenefits } from '~/lib/billing';
import { getCurrentUser } from '~/auth';
import { QZPayBillingInterval } from '@qazuor/qzpay-core';

export const getMembershipPlans = createServerFn({ method: 'GET' })
  .handler(async () => {
    return billing.plans.getVisible();
  });

export const getMyMembership = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const user = await getCurrentUser(context.request);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return getCustomerBenefits(user.id);
  });

export const subscribeToPlan = createServerFn({ method: 'POST' })
  .validator((data: { planId: string; interval: 'month' | 'year'; promoCode?: string }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const plan = billing.plans.get(data.planId);
    if (!plan || plan.id === 'standard') {
      throw new Error('Plan invalido');
    }

    // Sync customer
    const customer = await billing.customers.syncUser({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Trial without card?
    if (plan.trial && !plan.trial.requiresPaymentMethod) {
      const subscription = await billing.subscriptions.create({
        customerId: customer.id,
        planId: plan.id,
        interval: data.interval === 'month' ? QZPayBillingInterval.MONTH : QZPayBillingInterval.YEAR,
        startTrial: true,
        promoCodeId: data.promoCode ? await billing.promoCodes.resolveId(data.promoCode) : undefined,
      });

      return {
        requiresPayment: false,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd,
          isTrial: subscription.isTrial(),
        },
      };
    }

    // Create checkout session
    const session = await billing.checkout.create({
      customerId: customer.id,
      mode: 'subscription',
      items: [{
        planId: plan.id,
        interval: data.interval,
      }],
      subscriptionData: {
        planId: plan.id,
        interval: data.interval,
        trialDays: plan.trial?.days || 0,
      },
      promoCode: data.promoCode,
      successUrl: `${process.env.APP_URL}/mi-cuenta/membresia?success=true`,
      cancelUrl: `${process.env.APP_URL}/membresia`,
      metadata: {
        userId: user.id,
      },
    });

    return {
      requiresPayment: true,
      clientSecret: session.clientSecret,
    };
  });

export const cancelMembership = createServerFn({ method: 'POST' })
  .validator((data: { reason?: string; cancelAt?: QZPayCancelAtType }) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const subscription = await billing.subscriptions.getActiveByCustomerExternalId(user.id);

    if (!subscription) {
      throw new Error('No tienes una membresia activa');
    }

    await billing.subscriptions.cancel(subscription.id, {
      cancelAt: data.cancelAt || QZPayCancelAt.PERIOD_END,
      reason: data.reason,
    });

    return { success: true };
  });
```

### 5.4 Checkout Server Functions

```typescript
// app/server/checkout.ts
import { createServerFn } from '@tanstack/react-start/server';
import { getCurrentUser } from '~/auth';
import { checkoutService } from '~/services/checkout.service';

interface CheckoutData {
  cartId: string;
  guestEmail?: string;
  shippingAddress: object;
  billingAddress?: object;
  shippingMethod: string;
  customerNote?: string;
}

export const createCheckout = createServerFn({ method: 'POST' })
  .validator((data: CheckoutData) => data)
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request);

    if (!user && !data.guestEmail) {
      throw new Error('Se requiere email para compra como invitado');
    }

    return checkoutService.createCheckout({
      cartId: data.cartId,
      userId: user?.id,
      guestEmail: user ? undefined : data.guestEmail,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      shippingMethod: data.shippingMethod,
      customerNote: data.customerNote,
    });
  });
```

### 5.5 Cart Server Functions

```typescript
// app/server/cart.ts
import { createServerFn } from '@tanstack/react-start/server';
import { billing } from '~/lib/billing';
import { db } from '~/db';
import { carts } from '~/db/schema';
import { eq } from 'drizzle-orm';

export const applyPromoCode = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; code: string }) => data)
  .handler(async ({ data }) => {
    const result = await billing.promoCodes.validate({
      code: data.code,
      context: { cartId: data.cartId },
    });

    if (!result.valid) {
      return { valid: false, message: result.message };
    }

    await db.update(carts)
      .set({ promoCodeId: result.promoCodeId })
      .where(eq(carts.id, data.cartId));

    // Calculate discount
    const cart = await db.query.carts.findFirst({
      where: eq(carts.id, data.cartId),
      with: { items: true },
    });

    const subtotal = cart?.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) || 0;

    const discount = await billing.promoCodes.calculateDiscount({
      promoCodeId: result.promoCodeId!,
      amount: subtotal,
    });

    return {
      valid: true,
      discount: discount.discountAmount,
      description: discount.description,
    };
  });
```

---

## Part 6: Frontend Components

### 6.1 Membership Benefits Display

```tsx
// src/components/MembershipBadge.tsx
'use client';

import { useCustomerBenefits } from '@/hooks/useCustomerBenefits';

const TIER_COLORS = {
  standard: 'bg-gray-100 text-gray-800',
  silver: 'bg-gray-200 text-gray-900',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const TIER_LABELS = {
  standard: 'Cliente',
  silver: 'Plata',
  gold: 'Oro',
  platinum: 'Platino',
};

export function MembershipBadge() {
  const { benefits, loading } = useCustomerBenefits();

  if (loading) return null;

  const tier = benefits?.tier || 'standard';

  if (tier === 'standard') return null;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${TIER_COLORS[tier]}`}>
      {benefits?.subscription?.isTrial && 'Trial '}
      Miembro {TIER_LABELS[tier]}
      {benefits?.limits?.discountPercent > 0 && (
        <span className="ml-1">({benefits.limits.discountPercent}% off)</span>
      )}
    </span>
  );
}
```

### 6.2 Product Price with Member Discount

```tsx
// src/components/ProductPrice.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface PriceInfo {
  price: number;
  originalPrice: number;
  discount: number;
  tier: string;
}

export function ProductPrice({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);

  useEffect(() => {
    fetch(`/api/products/${productId}/price`)
      .then(res => res.json())
      .then(setPriceInfo);
  }, [productId, session?.user?.id]);

  if (!priceInfo) return <div className="animate-pulse h-6 w-24 bg-gray-200 rounded" />;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(cents / 100);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-bold text-gray-900">
        {formatPrice(priceInfo.price)}
      </span>

      {priceInfo.discount > 0 && (
        <>
          <span className="text-sm text-gray-500 line-through">
            {formatPrice(priceInfo.originalPrice)}
          </span>
          <span className="text-sm text-green-600 font-medium">
            -{Math.round((priceInfo.discount / priceInfo.originalPrice) * 100)}%
          </span>
          {priceInfo.tier !== 'standard' && priceInfo.tier !== 'guest' && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
              Precio {priceInfo.tier}
            </span>
          )}
        </>
      )}
    </div>
  );
}
```

### 6.3 Membership Pricing Page

```tsx
// src/app/membresia/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  QZPayPricingTable,
  QZPayPromoCodeInput,
  useQZPayCheckout,
} from '@qazuor/qzpay-react';
import { useCustomerBenefits } from '@/hooks/useCustomerBenefits';

export default function MembresiaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { benefits } = useCustomerBenefits();
  const { createCheckout, isLoading } = useQZPayCheckout();

  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<any>(null);

  const handleSelectPlan = async (planId: string) => {
    if (status !== 'authenticated') {
      router.push(`/auth/ingresar?callbackUrl=/membresia&plan=${planId}`);
      return;
    }

    if (planId === 'standard') {
      router.push('/mi-cuenta');
      return;
    }

    try {
      const response = await fetch('/api/membresia/suscribirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          interval,
          promoCode: promoCode || undefined,
        }),
      });

      const result = await response.json();

      if (result.requiresPayment) {
        await createCheckout({
          clientSecret: result.clientSecret,
          onComplete: () => router.push('/mi-cuenta/membresia?success=true'),
        });
      } else {
        router.push('/mi-cuenta/membresia?trial=started');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="membership-page max-w-6xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Club Joyeria Pepito
        </h1>
        <p className="text-xl text-gray-600">
          Descuentos exclusivos, acceso anticipado y beneficios VIP
        </p>

        <div className="mt-8 inline-flex rounded-lg border border-gray-200 p-1">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              interval === 'month' ? 'bg-gray-900 text-white' : 'text-gray-700'
            }`}
            onClick={() => setInterval('month')}
          >
            Mensual
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              interval === 'year' ? 'bg-gray-900 text-white' : 'text-gray-700'
            }`}
            onClick={() => setInterval('year')}
          >
            Anual
            <span className="ml-1 text-green-600">Ahorra 17%</span>
          </button>
        </div>
      </header>

      <div className="mb-8 max-w-md mx-auto">
        <QZPayPromoCodeInput
          onValidate={async (code) => {
            const res = await fetch('/api/billing/promo-codes/validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, context: { type: 'membership' } }),
            });
            const result = await res.json();
            if (result.valid) {
              setPromoCode(code);
              setPromoResult(result);
              return { valid: true };
            }
            return { valid: false, reason: result.message };
          }}
          onRemove={() => {
            setPromoCode('');
            setPromoResult(null);
          }}
          placeholder="Codigo promocional"
        />
      </div>

      <QZPayPricingTable
        apiUrl="/api/membresia/planes"
        interval={interval}
        currentPlanId={benefits?.tier}
        promoDiscount={promoResult?.discountAmount}
        onSelectPlan={handleSelectPlan}
        isLoading={isLoading}
        showTrialInfo
        trialText="Prueba gratis, sin tarjeta"
        locale="es"
        currency="ARS"
      />

      <section className="mt-16 text-center">
        <h2 className="text-2xl font-bold mb-8">Beneficios de ser miembro</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-4">💎</div>
            <h3 className="font-semibold mb-2">Descuentos Exclusivos</h3>
            <p className="text-gray-600">Hasta 15% de descuento en todas tus compras</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-4">🎁</div>
            <h3 className="font-semibold mb-2">Regalo de Cumpleanos</h3>
            <p className="text-gray-600">Un regalo especial en tu dia</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-4">🔧</div>
            <h3 className="font-semibold mb-2">Reparaciones Gratis</h3>
            <p className="text-gray-600">Mantenimiento incluido en tu membresia</p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

---

## Part 7: Complete Flows

### 7.1 Guest Checkout Flow

```
1. Guest browses products on joyeriapepito.com
2. Adds gold ring ($50.000 ARS) to cart
3. Enters promo code "BIENVENIDO15"
4. POST /api/carrito/aplicar-codigo
5. Code validated: 15% off for new customers
6. Proceeds to checkout
7. Enters email, shipping address
8. POST /api/checkout with guestEmail
9. Backend creates guest customer
10. Creates order #JP2412-ABC123
11. Creates checkout session (no splits)
12. Returns clientSecret
13. Guest completes payment
14. PAYMENT_SUCCEEDED event
15. Order status = paid
16. Confirmation email sent
17. Guest receives order confirmation page
```

### 7.2 Member Purchase Flow

```
1. Gold member logs in
2. Browses products
3. Product shows:
   - Original: $50.000 ARS
   - Member price: $45.000 ARS (10% off)
4. Adds to cart
5. Cart shows member discount applied
6. Adds promo code "NAVIDAD20" (additional 20%)
7. Checkout totals:
   - Subtotal: $50.000
   - Member discount: -$5.000 (10%)
   - Promo discount: -$9.000 (20% of $45.000)
   - Shipping: $0 (free for Gold)
   - Total: $36.000
8. Completes payment
9. PAYMENT_SUCCEEDED event
10. Stock updated
11. Order confirmation sent
```

### 7.3 Membership Trial Flow

```
1. Customer visits /membresia
2. Sees plans: Plata, Oro, Platino
3. Selects "Oro" ($2.499/mes)
4. Oro has trial.requiresPaymentMethod = false
5. POST /api/membresia/suscribirse
6. Backend creates subscription in 'trialing'
7. User's loyaltyTier = 'gold'
8. Returns requiresPayment: false
9. Redirect to /mi-cuenta/membresia
10. User now has 10% discount on all products
11. TRIAL_STARTED event emitted

[Day 11 - 3 days before]
12. TRIAL_EXPIRING event (emailSentByPackage: false)
13. Joyeria Pepito sends custom email:
    - "Tu trial de Miembro Oro termina en 3 dias"
    - "Agrega metodo de pago para continuar"
    - Link to add payment method

[Day 14 - Trial ends]
Option A: User adds payment
14. Stripe charges subscription
15. Status = active
16. User keeps Gold benefits

Option B: No payment
17. SUBSCRIPTION_EXPIRED event
18. loyaltyTier = 'standard'
19. User loses Gold benefits
20. Email: "Te extrañamos, vuelve con 20% off"
```

---

## Summary: Single Store vs Marketplace

| Feature | Marketplace | Single Store |
|---------|-------------|--------------|
| Vendors | Multiple with onboarding | None (store owner) |
| Payments | Split to vendors | Direct to owner |
| Subscriptions | Vendor tiers | Customer loyalty |
| Checkout | Complex splits | Simple direct |
| Promo codes | Platform + vendor | Store only |
| Configuration | Stripe Connect | Regular Stripe |
| Complexity | Higher | Lower |
| Use case | Multi-vendor platform | Single brand store |

## Key Simplifications

1. **No Stripe Connect**: Direct Stripe account, no splits
2. **No Vendor Schema**: No vendors table, no onboarding
3. **Simpler Checkout**: No split calculations
4. **Customer Focus**: Loyalty tiers instead of vendor tiers
5. **Member Pricing**: Product prices vary by customer tier
6. **Guest Checkout**: Supported without account

---

*Example updated for @qazuor/qzpay v2.0 - Single Store Mode*
