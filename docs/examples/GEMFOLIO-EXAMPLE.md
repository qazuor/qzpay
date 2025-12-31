# GEMFolio - Marketplace Integration Example

Complete integration example for GEMFolio, a jewelry e-commerce marketplace with artisan vendors.

> **Note on Discount Types**: This example uses `QZPayDiscountType` (unified type). For better type safety:
> - Use `QZPayPromoCodeType` for promo codes (manual codes entered by customers)
> - Use `QZPayAutomaticDiscountType` for automatic discounts (system-applied)
> - See ARCHITECTURE.md for the complete type hierarchy.

## Project Context

**GEMFolio** is a marketplace platform where:
- Independent jewelry artisans sell their products
- Platform takes commission on each sale
- Vendors receive payouts via Stripe Connect or Mercado Pago Marketplace
- Each purchase is from a single vendor (multi-vendor cart planned for future version)
- Bundle discounts and volume pricing available
- Vendors can subscribe to premium tiers for lower commissions

## Business Model

```
+-------------------------------------------------------------------+
|                        GEMFOLIO MARKETPLACE                        |
+-------------------------------------------------------------------+
|                                                                     |
|  +---------------+    +---------------+    +---------------+        |
|  |   Artisan 1   |    |   Artisan 2   |    |   Artisan 3   |        |
|  |  Gold Rings   |    | Silver Chain  |    |  Gemstones    |        |
|  +---------------+    +-------+-------+    +---------------+        |
|                               |                                      |
|                    +----------v----------+                           |
|                    |  Customer Purchase  |                           |
|                    |  (Single Vendor)    |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------v----------+                           |
|                    |     Checkout        |                           |
|                    |  Split Payment      |                           |
|                    +----------+----------+                           |
|                               |                                      |
|                    +----------+----------+                           |
|                    |                     |                           |
|            +-------v-------+    +--------v-------+                   |
|            | Artisan 2     |    | Platform       |                   |
|            | 85% - $127.50 |    | 15% - $22.50   |                   |
|            +---------------+    +----------------+                   |
|                                                                     |
|  Note: Each purchase is from a single vendor.                       |
|  Multi-vendor cart planned for future version.                      |
+-------------------------------------------------------------------+
```

## Tech Stack

- **Framework**: TanStack Start (Full-stack React)
- **Database**: PostgreSQL with Drizzle
- **Frontend**: React with Tailwind
- **Provider**: Stripe Connect primary, Mercado Pago Marketplace secondary
- **Auth**: Clerk

---

## Part 1: Initial Setup

### 1.1 Installation

```bash
# Backend packages
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-mercadopago @qazuor/qzpay-drizzle

# Frontend packages
pnpm add @qazuor/qzpay-react

# CLI for environment setup
pnpm add -D @qazuor/qzpay-cli
```

### 1.2 Generate and Validate Environment Variables

```bash
# Generate .env.example with all required variables
npx @qazuor/qzpay-cli env:generate --adapters stripe-connect,mercadopago-marketplace,resend

# This generates:
# =================================
# @qazuor/qzpay Configuration
# =================================
#
# Stripe Connect
# STRIPE_SECRET_KEY=  # Required
# STRIPE_WEBHOOK_SECRET=  # Required
# STRIPE_CONNECT_WEBHOOK_SECRET=  # Required for Connect events
# # STRIPE_PUBLISHABLE_KEY=  # Optional
#
# MercadoPago Marketplace
# MP_ACCESS_TOKEN=  # Required
# MP_CLIENT_ID=  # Required for OAuth
# MP_CLIENT_SECRET=  # Required for OAuth
# # MP_WEBHOOK_SECRET=  # Optional
#
# Resend
# RESEND_API_KEY=  # Required
#
# App
# APP_URL=http://localhost:3000
```

**.env complete:**

```env
# .env
DATABASE_URL=postgres://user:pass@neon.tech/gemfolio

# Stripe Connect
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_connect_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Mercado Pago Marketplace
MP_ACCESS_TOKEN=APP_USR-xxx
MP_CLIENT_ID=xxx
MP_CLIENT_SECRET=xxx
MP_WEBHOOK_SECRET=whsec_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# App
APP_URL=https://gemfolio.com
```

### 1.3 Database Schema

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
import { relations } from 'drizzle-orm';

// ============================================
// APP TABLES (GEMFolio specific)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: varchar('role', { length: 50 }).default('customer'), // customer, vendor, admin
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Vendors (Artisans)
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  storeName: text('store_name').notNull(),
  storeSlug: text('store_slug').unique().notNull(),
  description: text('description'),
  logo: text('logo'),
  banner: text('banner'),

  // Stripe Connect
  stripeAccountId: text('stripe_account_id'),
  stripeAccountStatus: text('stripe_account_status'), // pending, active, restricted
  stripeOnboardingComplete: boolean('stripe_onboarding_complete').default(false),

  // Mercado Pago Marketplace
  mpUserId: text('mp_user_id'),
  mpAccessToken: text('mp_access_token'),
  mpRefreshToken: text('mp_refresh_token'),
  mpOnboardingComplete: boolean('mp_onboarding_complete').default(false),

  // Tier (from billing subscription)
  tier: varchar('tier', { length: 50 }).default('basic'), // basic, professional, premium
  commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }), // null = use tier default

  // Status
  status: text('status').notNull().default('pending'), // pending, active, suspended
  verifiedAt: timestamp('verified_at'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').references(() => vendors.id).notNull(),

  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  images: jsonb('images').$type<string[]>().default([]),

  priceAmount: integer('price_amount').notNull(), // in cents
  priceCurrency: text('price_currency').notNull().default('USD'),
  compareAtPrice: integer('compare_at_price'),

  volumePricing: jsonb('volume_pricing').$type<{
    minQuantity: number;
    priceAmount: number;
  }[]>(),

  stock: integer('stock').notNull().default(0),
  trackInventory: boolean('track_inventory').default(true),
  allowBackorder: boolean('allow_backorder').default(false),

  weight: decimal('weight', { precision: 10, scale: 2 }),
  shippingClass: text('shipping_class'),

  status: text('status').notNull().default('draft'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Product Bundles
export const bundles = pgTable('bundles', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').references(() => vendors.id).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),

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
  sessionId: text('session_id'),
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

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),

  paymentId: text('payment_id').notNull(),

  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  shipping: integer('shipping').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull(),
  currency: text('currency').notNull(),

  status: text('status').notNull().default('pending'),

  shippingAddress: jsonb('shipping_address'),

  promoCodeId: text('promo_code_id'),
  promoDiscount: integer('promo_discount'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Order Items (per vendor)
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  vendorId: uuid('vendor_id').references(() => vendors.id).notNull(),
  productId: uuid('product_id').references(() => products.id),
  bundleId: uuid('bundle_id').references(() => bundles.id),

  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),

  vendorAmount: integer('vendor_amount').notNull(),
  platformAmount: integer('platform_amount').notNull(),
  transferId: text('transfer_id'),
  transferStatus: text('transfer_status'),

  fulfillmentStatus: text('fulfillment_status').default('pending'),
  trackingNumber: text('tracking_number'),
  trackingUrl: text('tracking_url'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Vendor Payouts
export const vendorPayouts = pgTable('vendor_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').references(() => vendors.id).notNull(),

  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),

  provider: text('provider').notNull(),
  providerPayoutId: text('provider_payout_id'),

  status: text('status').notNull().default('pending'),

  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),

  orderItemIds: jsonb('order_item_ids').$type<string[]>(),

  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// BILLING TABLES (generated by @qazuor/qzpay-drizzle)
// ============================================

import { createQZPayBillingSchema } from '@qazuor/qzpay-drizzle/schema';

export const billingSchema = createQZPayBillingSchema({
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
  usageRecords: billingUsageRecords,
  paymentMethods: billingPaymentMethods,
  auditLogs: billingAuditLogs,
  webhookEvents: billingWebhookEvents,
  jobExecutions: billingJobExecutions,
} = billingSchema;
```

---

## Part 2: Billing Configuration

### 2.1 Vendor Subscription Plans with Entitlements and Limits

```typescript
// src/config/plans.ts
import {
  QZPayBillingInterval,
  type QZPayPlanDefinition,
  type QZPayEntitlements,
  type QZPayLimits,
} from '@qazuor/qzpay-core';

/**
 * Entitlements for GEMFolio vendors (boolean features)
 */
export interface GemfolioEntitlements extends QZPayEntitlements {
  canAccessAnalytics: boolean;
  canAccessPrioritySupport: boolean;
  canUsePromoCodes: boolean;
  canUseFeaturedListings: boolean;
  canUseCustomBranding: boolean;
  canExportReports: boolean;
  canUseBulkUpload: boolean;
  canAccessApiIntegrations: boolean;
}

/**
 * Limits for GEMFolio vendors (numeric restrictions)
 * -1 means unlimited
 */
export interface GemfolioLimits extends QZPayLimits {
  maxProducts: number;
  maxImagesPerProduct: number;
  maxBundles: number;
  maxPromoCodes: number;
  maxFeaturedListingsPerMonth: number;
}

/**
 * Commission rates by tier
 */
export const COMMISSION_RATES = {
  basic: 0.15,      // 15% commission
  professional: 0.12, // 12% commission
  premium: 0.08,    // 8% commission
} as const;

/**
 * Vendor subscription plans
 */
export const VENDOR_PLANS: QZPayPlanDefinition<GemfolioEntitlements, GemfolioLimits>[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Start selling on GEMFolio',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 0, currency: 'USD' },
      [QZPayBillingInterval.YEAR]: { amount: 0, currency: 'USD' },
    },
    entitlements: {
      canAccessAnalytics: false,
      canAccessPrioritySupport: false,
      canUsePromoCodes: false,
      canUseFeaturedListings: false,
      canUseCustomBranding: false,
      canExportReports: false,
      canUseBulkUpload: false,
      canAccessApiIntegrations: false,
    },
    limits: {
      maxProducts: 25,
      maxImagesPerProduct: 5,
      maxBundles: 3,
      maxPromoCodes: 0,
      maxFeaturedListingsPerMonth: 0,
    },
    trial: null,
    metadata: {
      commissionRate: COMMISSION_RATES.basic,
    },
    displayFeatures: [
      '15% platform commission',
      'Up to 25 products',
      '5 images per product',
      '3 bundles',
      'Standard support',
    ],
  },

  {
    id: 'professional',
    name: 'Professional',
    description: 'For serious artisans',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 2900, currency: 'USD' }, // $29.00
      [QZPayBillingInterval.YEAR]: { amount: 29000, currency: 'USD' }, // $290.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUsePromoCodes: true,
      canUseFeaturedListings: true,
      canUseCustomBranding: false,
      canExportReports: true,
      canUseBulkUpload: true,
      canAccessApiIntegrations: false,
    },
    limits: {
      maxProducts: 100,
      maxImagesPerProduct: 10,
      maxBundles: 10,
      maxPromoCodes: 10,
      maxFeaturedListingsPerMonth: 5,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false, // Trial without card!
    },
    isFeatured: true,
    badgeText: 'Most Popular',
    metadata: {
      commissionRate: COMMISSION_RATES.professional,
    },
    displayFeatures: [
      '12% platform commission',
      'Up to 100 products',
      '10 images per product',
      '10 bundles',
      '10 promo codes',
      '5 featured listings/month',
      'Sales analytics',
      'CSV export',
      'Bulk upload',
      'Priority support',
    ],
  },

  {
    id: 'premium',
    name: 'Premium',
    description: 'For established brands',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 9900, currency: 'USD' }, // $99.00
      [QZPayBillingInterval.YEAR]: { amount: 99000, currency: 'USD' }, // $990.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUsePromoCodes: true,
      canUseFeaturedListings: true,
      canUseCustomBranding: true,
      canExportReports: true,
      canUseBulkUpload: true,
      canAccessApiIntegrations: true,
    },
    limits: {
      maxProducts: -1, // unlimited
      maxImagesPerProduct: 20,
      maxBundles: -1,
      maxPromoCodes: -1,
      maxFeaturedListingsPerMonth: 20,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    metadata: {
      commissionRate: COMMISSION_RATES.premium,
    },
    displayFeatures: [
      '8% platform commission',
      'Unlimited products',
      '20 images per product',
      'Unlimited bundles',
      'Unlimited promo codes',
      '20 featured listings/month',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'Dedicated support',
    ],
  },
];

export type GemfolioPlanId = typeof VENDOR_PLANS[number]['id'];
```

### 2.2 Promo Code Examples

```typescript
// src/config/promo-codes.ts
import { QZPayDiscountType, QZPayBillingInterval } from '@qazuor/qzpay-core';

/**
 * Platform promo codes (for vendor subscriptions)
 */
export const PLATFORM_PROMO_CODES = {
  // New vendor discount
  NEWVENDOR25: {
    code: 'NEWVENDOR25',
    type: QZPayDiscountType.PERCENTAGE,
    value: 25, // 25% off
    config: {},
    restrictions: {
      maxUses: 500,
      maxUsesPerCustomer: 1,
      newCustomersOnly: true,
      validPlans: ['professional', 'premium'],
      expiresAt: new Date('2025-12-31'),
    },
  },

  // First month free
  FREEMONTH: {
    code: 'FREEMONTH',
    type: QZPayDiscountType.FREE_PERIOD,
    value: 1,
    config: {},
    restrictions: {
      validIntervals: [QZPayBillingInterval.MONTH],
      newCustomersOnly: true,
      validPlans: ['professional'],
    },
  },

  // 3 months at 50% off
  LAUNCH50: {
    code: 'LAUNCH50',
    type: QZPayDiscountType.REDUCED_PERIOD,
    value: 50,
    config: { periods: 3 },
    restrictions: {
      newCustomersOnly: true,
    },
  },
};

/**
 * Marketplace promo codes (for customer purchases)
 * These are applied to product orders
 */
export const MARKETPLACE_PROMO_CODES = {
  // Platform-wide discount
  SUMMER20: {
    code: 'SUMMER20',
    type: QZPayDiscountType.PERCENTAGE,
    value: 20,
    config: {},
    restrictions: {
      minOrderAmount: 5000, // $50 minimum
      expiresAt: new Date('2025-08-31'),
    },
    scope: 'platform', // Platform absorbs cost
  },

  // Fixed amount off
  SAVE15: {
    code: 'SAVE15',
    type: QZPayDiscountType.FIXED_AMOUNT,
    value: 1500, // $15 off
    config: { currency: 'USD' },
    restrictions: {
      minOrderAmount: 7500, // $75 minimum
    },
    scope: 'platform',
  },

  // Free shipping (special handling)
  FREESHIP: {
    code: 'FREESHIP',
    type: QZPayDiscountType.FIXED_AMOUNT,
    value: 0, // Value calculated at checkout
    config: { freeShipping: true },
    restrictions: {
      minOrderAmount: 10000, // $100 minimum
    },
    scope: 'platform',
  },
};
```

### 2.2.2 Automatic Discounts (Auto-Applied)

```typescript
// src/config/automatic-discounts.ts
import { QZPayDiscountType, QZPayDiscountStackingMode, type QZPayAutomaticDiscount } from '@qazuor/qzpay-core';

/**
 * Automatic discounts for the marketplace
 * Separated by scope: platform (purchases) and vendor (subscriptions)
 */
export const GEMFOLIO_AUTOMATIC_DISCOUNTS: Record<string, QZPayAutomaticDiscount> = {
  // ============================================
  // PLATFORM DISCOUNTS (Customer Purchases)
  // ============================================

  // 10% off orders over $500
  bulkOrderDiscount: {
    id: 'bulk-order-500',
    name: '10% off orders over $500',
    description: 'Thank you for your large order!',
    type: QZPayDiscountType.PERCENTAGE,
    value: 10,
    conditions: {
      minPurchaseAmount: 50000, // $500
    },
    appliesTo: 'order',
    scope: 'platform',
    stackable: true,
    priority: 1,
  },

  // Free shipping over $150
  freeShippingThreshold: {
    id: 'free-shipping-150',
    name: 'Free shipping on orders over $150',
    type: QZPayDiscountType.FREE_SHIPPING,
    value: 0,
    conditions: {
      minPurchaseAmount: 15000, // $150
    },
    appliesTo: 'order',
    scope: 'platform',
    stackable: true,
    priority: 2,
  },

  // 5% first purchase discount
  firstPurchase: {
    id: 'first-purchase-5',
    name: '5% off your first order',
    description: 'Welcome to GEMFolio!',
    type: QZPayDiscountType.PERCENTAGE,
    value: 5,
    conditions: {
      isFirstPurchase: true,
    },
    appliesTo: 'order',
    scope: 'platform',
    stackable: true,
    priority: 3,
  },

  // Buy 3+ items get 15% off
  multiItemDiscount: {
    id: 'multi-item-15',
    name: '15% off when buying 3+ items',
    type: QZPayDiscountType.PERCENTAGE,
    value: 15,
    conditions: {
      minQuantity: 3,
    },
    appliesTo: 'order',
    scope: 'platform',
    stackable: false, // Doesn't stack with bulk order
    priority: 1,
  },

  // ============================================
  // VENDOR DISCOUNTS (Subscriptions)
  // ============================================

  // 10% for vendors with 50+ products
  vendorHighVolume: {
    id: 'vendor-50-products',
    name: '10% for vendors with 50+ products',
    description: 'Thank you for your active catalog!',
    type: QZPayDiscountType.PERCENTAGE,
    value: 10,
    conditions: {
      minQuantity: 50, // 50+ active products
    },
    appliesTo: 'subscription',
    scope: 'vendor',
    stackable: true,
    priority: 1,
  },

  // 15% for vendors earning $10k+/month
  vendorTopSeller: {
    id: 'vendor-top-seller',
    name: '15% for top sellers ($10k+/month)',
    type: QZPayDiscountType.PERCENTAGE,
    value: 15,
    conditions: {
      revenueThreshold: {
        minAmount: 1000000, // $10,000/month
        period: 'month',
      },
    },
    appliesTo: 'subscription',
    scope: 'vendor',
    stackable: false,
    priority: 2,
  },

  // First month free when upgrading to Premium
  vendorUpgradePremium: {
    id: 'vendor-upgrade-premium',
    name: 'First month free on Premium',
    type: QZPayDiscountType.FREE_PERIOD,
    value: 1,
    conditions: {
      isUpgrade: true,
      fromPlans: ['basic'],
      toPlans: ['premium', 'enterprise'],
    },
    appliesTo: 'subscription',
    scope: 'vendor',
    stackable: false,
    priority: 1,
    maxRedemptionsPerCustomer: 1,
  },
};
```

### 2.3 Billing System Instance

```typescript
// src/lib/billing.ts
import {
  QZPayCurrency,
  QZPayCheckoutMode,
  QZPayNotificationMode,
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  QZPayVendorOnboardingStatus,
  createQZPayBilling,
} from '@qazuor/qzpay-core';
import { createQZPayStripeConnectAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayMPMarketplaceAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { createQZPayResendAdapter } from '@qazuor/qzpay-resend';
import { db } from '../db';
import {
  VENDOR_PLANS,
  COMMISSION_RATES,
  type GemfolioEntitlements,
  type GemfolioLimits,
} from '../config/plans';
import { GEMFOLIO_AUTOMATIC_DISCOUNTS } from '../config/automatic-discounts';

// Create billing system instance
export const billing = createQZPayBilling<GemfolioEntitlements, GemfolioLimits>({
  // Storage
  storage: createQZPayDrizzleStorage(db, {
    tablePrefix: 'billing_',
  }),

  // Plans
  plans: VENDOR_PLANS,

  // Automatic discounts
  automaticDiscounts: GEMFOLIO_AUTOMATIC_DISCOUNTS,

  // Stacking rules
  discountStacking: {
    mode: QZPayDiscountStackingMode.ALL_STACKABLE,
    maxStackedDiscounts: 3, // Allow multiple discounts
  },

  // Payment adapters with marketplace support
  paymentAdapters: {
    stripe: createQZPayStripeConnectAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      connectWebhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET!,
      connect: {
        enabled: true,
        accountType: 'express',
        onboarding: {
          returnUrl: `${process.env.APP_URL}/vendor/onboarding/complete`,
          refreshUrl: `${process.env.APP_URL}/vendor/onboarding/refresh`,
        },
        businessProfile: {
          mcc: '5944', // Jewelry stores
          productDescription: 'Handcrafted jewelry marketplace',
        },
      },
    }),
    mercadopago: createQZPayMPMarketplaceAdapter({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      clientId: process.env.MP_CLIENT_ID!,
      clientSecret: process.env.MP_CLIENT_SECRET!,
      marketplace: {
        enabled: true,
        redirectUri: `${process.env.APP_URL}/vendor/mp-connect/callback`,
      },
    }),
  },

  // Email adapter
  emailAdapter: createQZPayResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: 'GEMFolio <billing@gemfolio.com>',
  }),

  // Notifications
  notifications: {
    mode: QZPayNotificationMode.HYBRID,
    templates: {
      [QZPayBillingEvent.SUBSCRIPTION_CREATED]: 'gemfolio-vendor-welcome',
      [QZPayBillingEvent.TRIAL_STARTED]: 'gemfolio-trial-started',
      [QZPayBillingEvent.VENDOR_ONBOARDING_COMPLETE]: 'gemfolio-vendor-verified',
    },
    // GEMFolio handles these emails
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.VENDOR_PAYOUT_SENT,
      QZPayBillingEvent.ORDER_CREATED,
    ],
  },

  // Currency
  currency: {
    base: QZPayCurrency.USD,
    supported: [QZPayCurrency.USD, QZPayCurrency.EUR, QZPayCurrency.ARS, QZPayCurrency.BRL, QZPayCurrency.MXN],
    strategy: 'provider',
  },

  // Marketplace settings
  marketplace: {
    enabled: true,
    defaultCommission: COMMISSION_RATES.basic,
    payouts: {
      automatic: false, // Manual payouts
      minimumAmount: 5000, // $50 minimum
      holdPeriodDays: 7,
    },
  },

  // Subscriptions
  subscriptions: {
    gracePeriodDays: 5,
    retryAttempts: 4,
    retryIntervalHours: 24,
    trialReminderDays: [7, 3, 1],
    expirationWarningDays: [7, 3, 1],
  },

  // Checkout
  checkout: {
    mode: QZPayCheckoutMode.EMBEDDED,
  },
});

// ============================================
// VENDOR HELPERS
// ============================================

/**
 * Get vendor access with typed entitlements and limits
 */
export async function getVendorAccess(vendorId: string) {
  // Get vendor's billing customer
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(vendorId);

  if (!subscription) {
    const basicPlan = VENDOR_PLANS.find(p => p.id === 'basic')!;
    return {
      hasAccess: true,
      plan: basicPlan,
      tier: 'basic' as const,
      commissionRate: COMMISSION_RATES.basic,
      entitlements: basicPlan.entitlements,
      limits: basicPlan.limits,
      subscription: null,
    };
  }

  const plan = subscription.getPlan();

  return {
    hasAccess: subscription.hasAccess(),
    plan,
    tier: plan.id as keyof typeof COMMISSION_RATES,
    commissionRate: plan.metadata?.commissionRate ?? COMMISSION_RATES.basic,
    entitlements: subscription.getEntitlements(),
    limits: subscription.getLimits(),
    subscription: {
      id: subscription.id,
      status: subscription.status,
      isTrial: subscription.isTrial(),
      hasPaymentMethod: subscription.hasPaymentMethod, // Pre-calculated property
      trialDaysRemaining: subscription.getTrialDaysRemaining(),
      daysRemaining: subscription.getDaysRemaining(),
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  };
}

/**
 * Check if vendor can add more products
 */
export async function canAddProduct(vendorId: string): Promise<{ allowed: boolean; reason?: string }> {
  const access = await getVendorAccess(vendorId);

  if (!access.hasAccess) {
    return { allowed: false, reason: 'Subscription inactive' };
  }

  // -1 means unlimited
  if (access.limits.maxProducts === -1) {
    return { allowed: true };
  }

  const currentCount = await db.query.products.findMany({
    where: eq(products.vendorId, vendorId),
    columns: { id: true },
  });

  if (currentCount.length >= access.limits.maxProducts) {
    return {
      allowed: false,
      reason: `You've reached the limit of ${access.limits.maxProducts} products. Upgrade your plan for more.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if vendor can create promo codes
 */
export async function canCreatePromoCode(vendorId: string): Promise<boolean> {
  const access = await getVendorAccess(vendorId);

  if (!access.entitlements.canUsePromoCodes) {
    return false;
  }

  if (access.limits.maxPromoCodes === -1) {
    return true;
  }

  const currentCount = await db.query.vendorPromoCodes.findMany({
    where: and(
      eq(vendorPromoCodes.vendorId, vendorId),
      eq(vendorPromoCodes.isActive, true)
    ),
    columns: { id: true },
  });

  return currentCount.length < access.limits.maxPromoCodes;
}

/**
 * Get vendor's commission rate
 */
export async function getVendorCommissionRate(vendorId: string): Promise<number> {
  const access = await getVendorAccess(vendorId);
  return access.commissionRate;
}
```

### 2.4 Commission Rate Management

```typescript
// src/services/vendor-commission.service.ts
import {
  QZPayBillingEvent,
  type QZPayCommissionRateUpdateInput,
  type QZPayVendorRefundResult,
} from '@qazuor/qzpay-core';
import { billing, COMMISSION_RATES } from '../lib/billing';
import { db } from '../db';
import { vendors, vendorCommissionHistory } from '../db/schema';
import { eq } from 'drizzle-orm';

export class VendorCommissionService {
  /**
   * Update a vendor's commission rate (admin only).
   * See FR-MKT-007 in PDR.md Section 3.7.
   *
   * Priority resolution:
   * 1. Transaction override (highest)
   * 2. Vendor-specific rate
   * 3. Plan tier rate
   * 4. Platform default (lowest)
   */
  async updateCommissionRate(
    vendorId: string,
    newRate: number,
    reason: string,
    options?: {
      effectiveDate?: Date;
      adminUserId?: string;
    }
  ): Promise<{
    success: boolean;
    previousRate: number;
    newRate: number;
    isScheduled: boolean;
    changeId: string;
  }> {
    // Use the package's commission rate update API
    const result = await billing.vendors.updateCommissionRate({
      vendorId,
      newRate,
      reason,
      effectiveDate: options?.effectiveDate,
      adminUserId: options?.adminUserId,
    });

    // Log for audit
    console.log(`Commission rate ${result.isScheduled ? 'scheduled' : 'updated'} for vendor ${vendorId}: ${result.previousRate * 100}% -> ${result.newRate * 100}%`);

    return result;
  }

  /**
   * Process a refund with commission split.
   * See FR-MKT-008 in PDR.md Section 3.7.
   *
   * Example: $100 sale with 15% commission
   * - Vendor received: $85
   * - Platform received: $15
   *
   * On full refund:
   * - Customer gets: $100 back
   * - Vendor balance: -$85 (deducted)
   * - Platform absorbs: $15 (commission return)
   */
  async processRefundWithCommissionSplit(
    paymentId: string,
    refundAmount: number,
    options?: { isPartial?: boolean }
  ): Promise<QZPayVendorRefundResult> {
    const result = await billing.vendors.processRefund(
      paymentId,
      refundAmount,
      options
    );

    // Handle negative balance notification
    if (result.balanceWentNegative) {
      console.warn(`Vendor ${result.vendorId} balance went negative: ${result.newVendorBalance}`);
      // Platform may need to pause payouts or contact vendor
    }

    return result;
  }

  /**
   * Handle tier change and its effect on commission.
   * See FR-MKT-009 in PDR.md Section 3.7.
   *
   * Rules:
   * - Upgrade (lower commission): applies IMMEDIATELY
   * - Downgrade (higher commission): applies at PERIOD END
   */
  async handleTierUpgrade(
    vendorId: string,
    newTierId: string
  ): Promise<{
    previousRate: number;
    newRate: number;
    effectiveDate: Date;
    direction: 'upgrade' | 'downgrade';
  }> {
    const result = await billing.vendors.handleTierChange(vendorId, newTierId);

    // Update local vendor record
    if (result.direction === 'upgrade') {
      await db.update(vendors)
        .set({
          tier: newTierId,
          commissionRate: result.newCommissionRate,
        })
        .where(eq(vendors.id, vendorId));
    }

    return {
      previousRate: result.previousCommissionRate,
      newRate: result.newCommissionRate,
      effectiveDate: result.effectiveDate,
      direction: result.direction,
    };
  }

  /**
   * Get commission rate for a specific transaction.
   * Resolves priority: override > vendor > tier > default
   */
  async resolveCommissionRate(
    vendorId: string,
    transactionId?: string
  ): Promise<{
    rate: number;
    source: 'transaction_override' | 'vendor_rate' | 'plan_tier' | 'platform_default';
  }> {
    const resolution = await billing.vendors.resolveCommissionRate(vendorId, transactionId);

    return {
      rate: resolution.resolvedRate,
      source: resolution.source,
    };
  }
}

export const vendorCommissionService = new VendorCommissionService();
```

#### 2.4.1 Admin API Routes for Commission Management

```typescript
// app/routes/api/admin/vendors/[vendorId]/commission.ts
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { vendorCommissionService } from '~/services/vendor-commission.service';
import { requireAdmin } from '~/lib/auth';

export const APIRoute = createAPIFileRoute('/api/admin/vendors/$vendorId/commission')({
  // GET: Get current commission rate and history
  GET: async ({ request, params }) => {
    await requireAdmin(request);
    const { vendorId } = params;

    const resolution = await vendorCommissionService.resolveCommissionRate(vendorId);

    return Response.json({
      vendorId,
      currentRate: resolution.rate,
      source: resolution.source,
    });
  },

  // PATCH: Update commission rate
  PATCH: async ({ request, params }) => {
    const admin = await requireAdmin(request);
    const { vendorId } = params;
    const body = await request.json();

    const { newRate, reason, effectiveDate } = body;

    // Validate rate
    if (newRate < 0 || newRate > 1) {
      return Response.json(
        { error: 'Rate must be between 0 and 1' },
        { status: 400 }
      );
    }

    const result = await vendorCommissionService.updateCommissionRate(
      vendorId,
      newRate,
      reason,
      {
        effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
        adminUserId: admin.id,
      }
    );

    return Response.json(result);
  },
});
```

#### 2.4.2 Commission Event Handlers

```typescript
// src/lib/billing/commission-events.ts
import { QZPayBillingEvent } from '@qazuor/qzpay-core';
import { billing } from './billing';
import { sendEmail } from '../email';
import { db } from '../../db';
import { vendors } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Handle immediate commission rate changes
billing.on(QZPayBillingEvent.VENDOR_COMMISSION_CHANGED, async (event) => {
  const { vendorId, previousRate, newRate, changeId } = event;

  console.log(`Commission changed for vendor ${vendorId}: ${previousRate * 100}% -> ${newRate * 100}%`);

  // Notify vendor
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-commission-changed',
      data: {
        storeName: vendor.storeName,
        previousRate: `${previousRate * 100}%`,
        newRate: `${newRate * 100}%`,
        effectiveDate: 'Immediately',
        dashboardUrl: `${process.env.APP_URL}/vendor/settings/billing`,
      },
    });
  }
});

// Handle scheduled commission rate changes
billing.on(QZPayBillingEvent.VENDOR_COMMISSION_SCHEDULED, async (event) => {
  const { vendorId, previousRate, newRate, effectiveDate, changeId } = event;

  console.log(`Commission scheduled for vendor ${vendorId}: ${previousRate * 100}% -> ${newRate * 100}% on ${effectiveDate}`);

  // Notify vendor of upcoming change
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-commission-scheduled',
      data: {
        storeName: vendor.storeName,
        previousRate: `${previousRate * 100}%`,
        newRate: `${newRate * 100}%`,
        effectiveDate: new Date(effectiveDate).toLocaleDateString(),
      },
    });
  }
});

// Handle vendor refund processing
billing.on(QZPayBillingEvent.VENDOR_REFUND_PROCESSED, async (event) => {
  const {
    vendorId,
    paymentId,
    refundAmount,
    breakdown,
  } = event;

  console.log(`Refund processed for vendor ${vendorId}:`, {
    total: refundAmount,
    vendorPortion: breakdown.vendorPortion,
    platformPortion: breakdown.platformPortion,
  });

  // Update internal records if needed
  await analytics.track('vendor_refund_processed', {
    vendorId,
    paymentId,
    refundAmount,
    vendorPortion: breakdown.vendorPortion,
    platformPortion: breakdown.platformPortion,
  });
});

// Handle vendor balance going negative
billing.on(QZPayBillingEvent.VENDOR_BALANCE_NEGATIVE, async (event) => {
  const { vendorId, balance, cause, refundId } = event;

  console.warn(`Vendor ${vendorId} balance went negative: ${balance}`);

  // Notify vendor and admin
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    // Notify vendor
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-balance-negative',
      data: {
        storeName: vendor.storeName,
        balance: balance / 100,
        cause: cause === 'refund' ? 'a customer refund' : 'an adjustment',
        dashboardUrl: `${process.env.APP_URL}/vendor/payouts`,
      },
    });

    // Notify admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL!,
      template: 'admin-vendor-negative-balance',
      data: {
        vendorId,
        storeName: vendor.storeName,
        balance: balance / 100,
        cause,
      },
    });
  }
});

// Handle tier upgrades (lower commission)
billing.on(QZPayBillingEvent.VENDOR_TIER_UPGRADED, async (event) => {
  const { vendorId, previousTier, newTier, previousRate, newRate, effectiveDate } = event;

  console.log(`Vendor ${vendorId} upgraded: ${previousTier} -> ${newTier}`);

  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-tier-upgraded',
      data: {
        storeName: vendor.storeName,
        previousTier,
        newTier,
        previousRate: `${previousRate * 100}%`,
        newRate: `${newRate * 100}%`,
        effectiveDate: 'Immediately',
        savings: `${(previousRate - newRate) * 100}%`,
      },
    });
  }
});

// Handle tier downgrades (higher commission, deferred)
billing.on(QZPayBillingEvent.VENDOR_TIER_DOWNGRADED, async (event) => {
  const { vendorId, previousTier, newTier, previousRate, newRate, effectiveDate } = event;

  console.log(`Vendor ${vendorId} downgraded: ${previousTier} -> ${newTier} (effective: ${effectiveDate})`);

  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-tier-downgraded',
      data: {
        storeName: vendor.storeName,
        previousTier,
        newTier,
        previousRate: `${previousRate * 100}%`,
        newRate: `${newRate * 100}%`,
        effectiveDate: new Date(effectiveDate).toLocaleDateString(),
        upgradeUrl: `${process.env.APP_URL}/vendor/pricing`,
      },
    });
  }
});
```

---

### 2.5 Subscription Pause Management

GEMFolio allows vendors to temporarily pause their subscriptions. This is useful when vendors need to take a break from selling (vacation, inventory restocking, personal reasons).

#### 2.5.1 Pause Configuration

The pause feature is configured at the billing instance level:

```typescript
// In billing.config.ts - subscriptions.pause configuration
const billing = createBilling({
  // ... other config ...
  subscriptions: {
    pause: {
      allowed: true,                        // Enable pause feature globally
      maxDurationDays: 90,                  // Maximum 90 days per pause
      maxPausesPerYear: 1,                  // 1 pause per year
      yearDefinition: 'calendar',           // Resets on January 1st
      retainAccessDuringPause: false,       // No access during pause (can't sell)
      minDaysBetweenPauses: 30,             // 30-day cooldown between pauses
      canResumeEarly: true,                 // Vendor can end pause early
    },
  },
});
```

**Configuration Options Explained:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowed` | `boolean` | `false` | Whether pause is available |
| `maxDurationDays` | `number` | `90` | Maximum days subscription can be paused |
| `maxPausesPerYear` | `number` | `1` | How many times per year pause is allowed |
| `yearDefinition` | `'calendar' \| 'rolling'` | `'calendar'` | How "year" is calculated |
| `retainAccessDuringPause` | `boolean` | `false` | Whether vendor keeps access while paused |
| `minDaysBetweenPauses` | `number` | `30` | Cooldown days between pauses |
| `canResumeEarly` | `boolean` | `true` | Whether vendor can cut pause short |

**Year Definition Behavior:**

| yearDefinition | Behavior | Reset Date |
|----------------|----------|------------|
| `'calendar'` | Pause count resets January 1st | Jan 1 each year |
| `'rolling'` | 365-day window from first pause | 365 days after first pause |

#### 2.5.2 Pause Helper Methods

The subscription object provides several helper methods for pause management:

```typescript
// src/services/subscription-pause.service.ts
import { billing } from '../lib/billing';

/**
 * Check if vendor can pause their subscription
 * Returns detailed information about pause availability
 */
export async function checkVendorPauseAvailability(vendorId: string) {
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(vendorId);

  if (!subscription) {
    return { canPause: false, reason: 'No active subscription' };
  }

  // Check if subscription is currently paused
  if (subscription.isPaused()) {
    const pausedUntil = subscription.pausedUntil();
    const daysUntilResume = subscription.daysUntilResume();

    return {
      canPause: false,
      reason: 'SUBSCRIPTION_ALREADY_PAUSED',
      currentPause: subscription.getCurrentPause(),
      pausedUntil,
      daysUntilResume,
      canResumeEarly: subscription.canResumeEarly(),
    };
  }

  // Check if vendor can pause (limits, cooldown, etc.)
  const canPauseResult = subscription.canPause();

  if (!canPauseResult.allowed) {
    return {
      canPause: false,
      reason: canPauseResult.reason,
      // Detailed info based on reason:
      // - PAUSE_NOT_ALLOWED_PLAN: Plan doesn't allow pause
      // - PAUSE_LIMIT_REACHED: Used all pauses this year
      // - PAUSE_COOLDOWN_ACTIVE: Need to wait before next pause
      nextAvailableDate: canPauseResult.nextAvailableDate,
      pausesRemaining: subscription.pausesRemaining(),
      cooldownStatus: subscription.getPauseCooldown(),
    };
  }

  return {
    canPause: true,
    pausesRemaining: subscription.pausesRemaining(),
    maxDurationDays: 90, // From config
    cooldownStatus: subscription.getPauseCooldown(),
    pauseHistory: subscription.getPauseHistory(),
  };
}

/**
 * Get pause history for a vendor's subscription
 */
export async function getVendorPauseHistory(vendorId: string) {
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(vendorId);

  if (!subscription) {
    return { pauses: [], total: 0 };
  }

  const pauses = subscription.getPauseHistory();

  return {
    pauses: pauses.map((pause) => ({
      pauseId: pause.pauseId,
      startDate: pause.startDate,
      scheduledEndDate: pause.scheduledEndDate,
      actualEndDate: pause.actualEndDate,
      resumeType: pause.resumeType, // 'early' | 'scheduled' | 'auto'
      reason: pause.reason,
      pauseNumber: pause.pauseNumber,
      totalDays: pause.actualEndDate
        ? Math.ceil((pause.actualEndDate.getTime() - pause.startDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    })),
    total: pauses.length,
    pausesUsedThisYear: subscription.pausesRemaining()
      ? (1 - subscription.pausesRemaining()) // 1 max - remaining = used
      : 0,
  };
}
```

#### 2.5.3 Pause and Resume Operations

```typescript
// src/services/subscription-pause.service.ts (continued)

/**
 * Pause a vendor's subscription
 * @param vendorId - The vendor's ID
 * @param options - Pause configuration
 */
export async function pauseVendorSubscription(
  vendorId: string,
  options: {
    pauseDays?: number;        // Number of days to pause (max 90)
    pauseUntil?: Date;         // Or specific date to pause until
    reason?: string;           // Optional reason for records
  }
) {
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(vendorId);

  if (!subscription) {
    throw new Error('NO_ACTIVE_SUBSCRIPTION');
  }

  // Validation is automatic - will throw specific errors:
  // - PAUSE_NOT_ALLOWED_PLAN: Plan config doesn't allow pause
  // - PAUSE_LIMIT_REACHED: Already used 1 pause this year (next available date in error)
  // - PAUSE_COOLDOWN_ACTIVE: Must wait 30 days between pauses (cooldown end in error)
  // - PAUSE_DURATION_EXCEEDED: Requested more than 90 days (max allowed in error)
  // - SUBSCRIPTION_ALREADY_PAUSED: Already paused (current pause end in error)

  const result = await billing.subscriptions.pause(subscription.id, {
    pauseDays: options.pauseDays,      // Takes precedence over pauseUntil
    pauseUntil: options.pauseUntil,    // Alternative: specific end date
    reason: options.reason,
  });

  // result contains:
  // {
  //   success: true,
  //   subscription: { ... },
  //   pauseDetails: {
  //     pauseId: 'pause_abc123',
  //     startDate: Date,
  //     scheduledEndDate: Date,       // When pause will auto-end
  //     reason: string | null,
  //     pauseNumber: 1,               // 1st pause this year
  //   }
  // }

  return result;
}

/**
 * Resume a paused subscription early
 * @param vendorId - The vendor's ID
 */
export async function resumeVendorSubscription(vendorId: string) {
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(vendorId);

  if (!subscription) {
    throw new Error('NO_ACTIVE_SUBSCRIPTION');
  }

  // Validation will throw specific errors:
  // - SUBSCRIPTION_NOT_PAUSED: Subscription is not currently paused
  // - EARLY_RESUME_NOT_ALLOWED: Config has canResumeEarly: false

  const result = await billing.subscriptions.resume(subscription.id);

  // result contains:
  // {
  //   success: true,
  //   subscription: { ... },
  //   resumeDetails: {
  //     pauseId: 'pause_abc123',
  //     startDate: Date,
  //     actualEndDate: Date,          // Today (early resume)
  //     scheduledEndDate: Date,       // Original scheduled end
  //     resumeType: 'early',          // 'early' | 'scheduled' | 'auto'
  //     totalPauseDays: 15,           // Actual days paused
  //     newBillingDate: Date,         // Next billing shifted by pause days
  //   }
  // }

  return result;
}
```

#### 2.5.4 Pause Event Handlers

```typescript
// src/lib/billing.events.ts (add to existing events)

// Handle subscription paused
billing.on('subscription_paused', async (event) => {
  const { subscription, customer, pauseDetails, emailSentByPackage } = event;

  console.log(`Vendor subscription paused: ${subscription.id}`);
  console.log(`Pause details: ${JSON.stringify(pauseDetails)}`);

  // Update vendor status in database
  await db.update(vendors)
    .set({
      status: 'paused',
      pausedUntil: pauseDetails.scheduledEndDate,
    })
    .where(eq(vendors.id, customer.externalId));

  // Hide vendor's store from marketplace
  await db.update(vendors)
    .set({ isVisible: false })
    .where(eq(vendors.id, customer.externalId));

  // Send notification if package didn't send email
  if (!emailSentByPackage) {
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, customer.externalId),
      with: { user: true },
    });

    if (vendor) {
      await sendEmail({
        to: vendor.user.email,
        template: 'gemfolio-subscription-paused',
        data: {
          storeName: vendor.storeName,
          pauseStart: pauseDetails.startDate.toLocaleDateString(),
          pauseEnd: pauseDetails.scheduledEndDate.toLocaleDateString(),
          totalDays: Math.ceil(
            (pauseDetails.scheduledEndDate.getTime() - pauseDetails.startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
          canResumeEarly: true,
          resumeUrl: `${process.env.APP_URL}/vendor/subscription`,
          reason: pauseDetails.reason || 'Not specified',
        },
      });
    }
  }

  // Track analytics
  await analytics.track('vendor_subscription_paused', {
    vendorId: customer.externalId,
    pauseDays: Math.ceil(
      (pauseDetails.scheduledEndDate.getTime() - pauseDetails.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ),
    pauseNumber: pauseDetails.pauseNumber,
    reason: pauseDetails.reason,
  });
});

// Handle subscription resumed
billing.on('subscription_resumed', async (event) => {
  const { subscription, customer, resumeDetails, emailSentByPackage } = event;

  console.log(`Vendor subscription resumed: ${subscription.id}`);
  console.log(`Resume details: ${JSON.stringify(resumeDetails)}`);

  // Update vendor status in database
  await db.update(vendors)
    .set({
      status: 'active',
      pausedUntil: null,
    })
    .where(eq(vendors.id, customer.externalId));

  // Make vendor's store visible again
  await db.update(vendors)
    .set({ isVisible: true })
    .where(eq(vendors.id, customer.externalId));

  // Send notification if package didn't send email
  if (!emailSentByPackage) {
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, customer.externalId),
      with: { user: true },
    });

    if (vendor) {
      await sendEmail({
        to: vendor.user.email,
        template: 'gemfolio-subscription-resumed',
        data: {
          storeName: vendor.storeName,
          resumeType: resumeDetails.resumeType, // 'early' | 'scheduled' | 'auto'
          totalPauseDays: resumeDetails.totalPauseDays,
          newBillingDate: resumeDetails.newBillingDate.toLocaleDateString(),
          wasEarlyResume: resumeDetails.resumeType === 'early',
          dashboardUrl: `${process.env.APP_URL}/vendor/dashboard`,
        },
      });
    }
  }

  // Track analytics
  await analytics.track('vendor_subscription_resumed', {
    vendorId: customer.externalId,
    resumeType: resumeDetails.resumeType,
    totalPauseDays: resumeDetails.totalPauseDays,
    wasScheduled: resumeDetails.resumeType === 'scheduled',
    wasAuto: resumeDetails.resumeType === 'auto',
  });
});
```

#### 2.5.5 Pause UI Component Example

```tsx
// src/components/vendor/SubscriptionPauseManager.tsx
import { useState } from 'react';
import { useQZPaySubscription } from '@qazuor/qzpay-react';

export function SubscriptionPauseManager() {
  const { subscription, loading, pauseSubscription, resumeSubscription } = useQZPaySubscription();
  const [pauseDays, setPauseDays] = useState(30);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (loading || !subscription) return null;

  const isPaused = subscription.isPaused();
  const canPauseResult = subscription.canPause();
  const pausesRemaining = subscription.pausesRemaining();
  const cooldownStatus = subscription.getPauseCooldown();

  const handlePause = async () => {
    try {
      setError(null);
      await pauseSubscription({ pauseDays, reason: reason || undefined });
    } catch (err: any) {
      // Handle specific error codes
      switch (err.code) {
        case 'PAUSE_LIMIT_REACHED':
          setError(`You've used your pause this year. Next available: ${err.nextAvailableDate?.toLocaleDateString()}`);
          break;
        case 'PAUSE_COOLDOWN_ACTIVE':
          setError(`Please wait ${err.daysRemaining} days before pausing again.`);
          break;
        case 'PAUSE_DURATION_EXCEEDED':
          setError(`Maximum pause duration is ${err.maxAllowed} days.`);
          break;
        default:
          setError(err.message);
      }
    }
  };

  const handleResume = async () => {
    try {
      setError(null);
      await resumeSubscription();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Show resume UI if paused
  if (isPaused) {
    const currentPause = subscription.getCurrentPause();
    const daysUntilResume = subscription.daysUntilResume();
    const canResumeEarly = subscription.canResumeEarly();

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800">Subscription Paused</h3>
        <p className="text-yellow-700 mt-2">
          Your subscription is paused until {currentPause?.scheduledEndDate.toLocaleDateString()}.
        </p>
        <p className="text-yellow-600 text-sm mt-1">
          {daysUntilResume} days remaining
        </p>

        {canResumeEarly && (
          <button
            onClick={handleResume}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Resume Subscription Early
          </button>
        )}

        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  // Show pause UI if can pause
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold">Pause Subscription</h3>

      {!canPauseResult.allowed ? (
        <div className="mt-4">
          <p className="text-red-600">
            {canPauseResult.reason === 'PAUSE_LIMIT_REACHED' && (
              <>You've used your pause this year. Next available: {canPauseResult.nextAvailableDate?.toLocaleDateString()}</>
            )}
            {canPauseResult.reason === 'PAUSE_COOLDOWN_ACTIVE' && (
              <>Please wait until {cooldownStatus.availableDate?.toLocaleDateString()} to pause again.</>
            )}
            {canPauseResult.reason === 'PAUSE_NOT_ALLOWED_PLAN' && (
              <>Your current plan doesn't support pausing.</>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-gray-600">
            Pauses remaining this year: <strong>{pausesRemaining}</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pause duration (max 90 days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={pauseDays}
              onChange={(e) => setPauseDays(Number(e.target.value))}
              className="mt-1 block w-24 rounded border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Vacation, Inventory restocking"
              className="mt-1 block w-full rounded border-gray-300"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">
            <p><strong>What happens when you pause:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your store will be hidden from the marketplace</li>
              <li>You won't be charged during the pause period</li>
              <li>Your billing date will shift by the number of days paused</li>
              <li>You can resume early at any time</li>
            </ul>
          </div>

          <button
            onClick={handlePause}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
          >
            Pause for {pauseDays} days
          </button>

          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

#### 2.5.6 Error Handling Reference

All pause-related errors include detailed information for user-friendly messages:

| Error Code | When Thrown | Additional Data |
|------------|-------------|-----------------|
| `PAUSE_NOT_ALLOWED_PLAN` | Plan config has `allowed: false` | - |
| `PAUSE_LIMIT_REACHED` | Used all pauses for the year | `nextAvailableDate: Date` |
| `PAUSE_COOLDOWN_ACTIVE` | Within 30-day cooldown period | `daysRemaining: number`, `availableDate: Date` |
| `PAUSE_DURATION_EXCEEDED` | Requested days > 90 | `maxAllowed: number`, `requested: number` |
| `SUBSCRIPTION_ALREADY_PAUSED` | Trying to pause a paused sub | `currentPauseEnd: Date`, `pauseId: string` |
| `SUBSCRIPTION_NOT_PAUSED` | Trying to resume non-paused sub | - |
| `EARLY_RESUME_NOT_ALLOWED` | `canResumeEarly: false` in config | `scheduledEndDate: Date` |

---

### 2.6 Multi-Tenancy Configuration (Optional)

If GEMFolio is sold as a white-label SaaS to multiple marketplace operators, enable multi-tenancy:

#### 2.6.1 Multi-Tenant Billing Setup

```typescript
// src/lib/billing.ts - Multi-tenant configuration
import { createQZPayBilling, getCurrentTenant } from '@qazuor/qzpay-core';

const billing = createQZPayBilling({
  // ... other config ...

  tenancy: {
    mode: 'multi',                       // Enable multi-tenancy
    tenantColumn: 'tenant_id',           // Column in all tables
    enableRLS: true,                     // Row-Level Security

    // Resolve tenant from request
    tenantResolver: async (ctx) => {
      // Priority 1: Explicit header
      const headerTenant = ctx.headers['x-tenant-id'];
      if (headerTenant) return headerTenant;

      // Priority 2: JWT claim
      const jwtTenant = ctx.auth?.tenantId;
      if (jwtTenant) return jwtTenant;

      // Priority 3: Subdomain (e.g., acme.gemfolio.com → 'acme')
      const host = ctx.headers['host'];
      const subdomain = host?.split('.')[0];
      if (subdomain && !['www', 'api'].includes(subdomain)) {
        return subdomain;
      }

      return null;
    },

    // Reject requests without tenant (secure default)
    onMissingTenant: 'reject',
    publicEndpoints: ['/health', '/pricing'],  // These don't need tenant

    // Superadmin impersonation for support
    superadmin: {
      enabled: true,
      isSuperadmin: async (ctx) => ctx.auth?.role === 'superadmin',
      allowedOperations: ['read', 'impersonate'],
      auditAllAccess: true,
      sessionDuration: 3600,  // 1 hour
    },
  },
});

export { billing, getCurrentTenant };
```

#### 2.6.2 Tenant-Scoped Operations

```typescript
// All operations automatically scoped to current tenant
export async function getVendorsForCurrentTenant() {
  const tenant = getCurrentTenant();
  console.log(`Fetching vendors for tenant: ${tenant}`);

  // Automatically filtered by tenant_id
  const customers = await billing.customers.list();
  return customers;
}

// Background job with tenant context
await billing.jobs.enqueue({
  type: 'tenant',
  name: 'sendTrialReminders',
  tenantId: 'acme-marketplace',  // Required for tenant jobs
  payload: { daysBeforeEnd: 3 },
});
```

#### 2.6.3 Superadmin Support Access

```typescript
// src/services/admin-support.service.ts
export async function accessTenantForSupport(
  tenantId: string,
  ticketNumber: string
) {
  // Start impersonation (reason is REQUIRED)
  const session = await billing.admin.impersonate({
    targetTenantId: tenantId,
    reason: `Customer support ticket #${ticketNumber}`,
  });

  // All operations now in target tenant context
  const subscriptions = await billing.subscriptions.list();

  // End when done
  await billing.admin.endImpersonation();

  return subscriptions;
}

// Cross-tenant reporting
export async function getPlatformWideReport() {
  const pastDue = await billing.admin.crossTenantQuery({
    entity: 'subscriptions',
    filter: { status: 'past_due' },
    reason: 'Monthly MRR report',
  });

  // Results include tenantId for each record
  return pastDue.map(sub => ({
    tenant: sub.tenantId,
    amount: sub.amount,
  }));
}
```

#### 2.6.4 Tenant Events

```typescript
// All events include tenantId
billing.on('subscription_created', async (event) => {
  console.log(`Tenant: ${event.tenantId}`);  // Always available
  console.log(`Subscription: ${event.payload.subscription.id}`);

  // If during impersonation
  if (event.metadata?.impersonatedBy) {
    console.log(`Created by admin: ${event.metadata.impersonatedBy}`);
  }
});

// Webhooks include tenant header
// X-QZPay-Tenant-Id: acme-marketplace
// Body: { "tenantId": "acme-marketplace", ... }
```

---

## Part 3: Vendor Onboarding Service

```typescript
// src/services/vendor.service.ts
import {
  QZPayVendorOnboardingStatus,
  QZPayPaymentProvider,
} from '@qazuor/qzpay-core';
import { billing, getVendorAccess, COMMISSION_RATES } from '../lib/billing';
import { db } from '../db';
import { vendors, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CreateVendorInput {
  userId: string;
  storeName: string;
  description?: string;
}

export interface VendorOnboardingResult {
  vendor: typeof vendors.$inferSelect;
  onboardingUrl: string;
}

export class VendorService {
  /**
   * Create a new vendor and initiate onboarding
   */
  async createVendor(
    input: CreateVendorInput,
    provider: 'stripe' | 'mercadopago' = 'stripe'
  ): Promise<VendorOnboardingResult> {
    const vendorId = nanoid();
    const storeSlug = this.generateSlug(input.storeName);

    // Get user email
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create vendor record
    const [vendor] = await db.insert(vendors).values({
      id: vendorId,
      userId: input.userId,
      storeName: input.storeName,
      storeSlug,
      description: input.description,
      tier: 'basic', // Start with basic tier
      status: 'pending',
    }).returning();

    // Sync with billing system
    await billing.customers.syncUser({
      id: vendorId,
      email: user.email,
      name: vendor.storeName,
      metadata: {
        type: 'vendor',
        userId: input.userId,
      },
    });

    // Initiate provider onboarding
    let onboardingUrl: string;

    if (provider === 'stripe') {
      onboardingUrl = await this.initiateStripeOnboarding(vendor, user.email);
    } else {
      onboardingUrl = await this.initiateMPOnboarding(vendor);
    }

    return { vendor, onboardingUrl };
  }

  /**
   * Initiate Stripe Connect onboarding
   */
  private async initiateStripeOnboarding(
    vendor: typeof vendors.$inferSelect,
    email: string
  ): Promise<string> {
    const result = await billing.marketplace.createConnectedAccount({
      provider: QZPayPaymentProvider.STRIPE,
      externalId: vendor.id,
      email,
      metadata: {
        vendorId: vendor.id,
        storeSlug: vendor.storeSlug,
      },
      businessProfile: {
        name: vendor.storeName,
        productDescription: vendor.description || 'Handcrafted jewelry',
      },
    });

    // Save Stripe account ID
    await db.update(vendors)
      .set({
        stripeAccountId: result.accountId,
        stripeAccountStatus: 'pending',
      })
      .where(eq(vendors.id, vendor.id));

    return result.onboardingUrl;
  }

  /**
   * Initiate Mercado Pago Marketplace onboarding
   */
  private async initiateMPOnboarding(
    vendor: typeof vendors.$inferSelect
  ): Promise<string> {
    const result = await billing.marketplace.getOAuthUrl({
      provider: QZPayPaymentProvider.MERCADOPAGO,
      state: vendor.id,
    });

    return result.authorizationUrl;
  }

  /**
   * Complete Stripe onboarding after redirect
   */
  async completeStripeOnboarding(vendorId: string): Promise<boolean> {
    const [vendor] = await db.select()
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    if (!vendor?.stripeAccountId) {
      throw new Error('Vendor not found or no Stripe account');
    }

    const account = await billing.marketplace.getConnectedAccount(
      vendor.stripeAccountId
    );

    // Use constant for status check
    if (account.status === QZPayVendorOnboardingStatus.COMPLETE) {
      await db.update(vendors)
        .set({
          stripeOnboardingComplete: true,
          stripeAccountStatus: 'active',
          status: 'active',
          verifiedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));

      return true;
    }

    // Account still needs more info
    await db.update(vendors)
      .set({
        stripeAccountStatus: account.status === QZPayVendorOnboardingStatus.RESTRICTED
          ? 'restricted'
          : 'pending',
      })
      .where(eq(vendors.id, vendorId));

    return false;
  }

  /**
   * Complete MP onboarding after OAuth callback
   */
  async completeMPOnboarding(
    vendorId: string,
    authorizationCode: string
  ): Promise<boolean> {
    const tokens = await billing.marketplace.exchangeOAuthCode({
      provider: QZPayPaymentProvider.MERCADOPAGO,
      code: authorizationCode,
    });

    const mpUser = await billing.marketplace.getConnectedUserInfo({
      provider: QZPayPaymentProvider.MERCADOPAGO,
      accessToken: tokens.accessToken,
    });

    await db.update(vendors)
      .set({
        mpUserId: mpUser.id,
        mpAccessToken: tokens.accessToken,
        mpRefreshToken: tokens.refreshToken,
        mpOnboardingComplete: true,
        status: 'active',
        verifiedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    return true;
  }

  /**
   * Upgrade vendor subscription
   */
  async upgradeVendor(
    vendorId: string,
    planId: string,
    interval: 'month' | 'year',
    promoCode?: string
  ): Promise<{ requiresPayment: boolean; clientSecret?: string; subscription?: any }> {
    const plan = billing.plans.get(planId);
    if (!plan || plan.id === 'basic') {
      throw new Error('Invalid plan');
    }

    // Get or create customer
    const customer = await billing.customers.getByExternalId(vendorId);
    if (!customer) {
      throw new Error('Vendor not synced with billing');
    }

    // If plan has trial without card
    if (plan.trial && !plan.trial.requiresPaymentMethod) {
      const subscription = await billing.subscriptions.create({
        customerId: customer.id,
        planId: plan.id,
        interval: interval === 'month' ? QZPayBillingInterval.MONTH : QZPayBillingInterval.YEAR,
        startTrial: true,
        promoCodeId: promoCode ? await billing.promoCodes.resolveId(promoCode) : undefined,
      });

      // Update vendor tier
      await db.update(vendors)
        .set({ tier: planId })
        .where(eq(vendors.id, vendorId));

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
        interval,
      }],
      subscriptionData: {
        planId: plan.id,
        interval,
        trialDays: plan.trial?.days || 0,
      },
      promoCode,
      successUrl: `${process.env.APP_URL}/vendor/dashboard?subscription=success`,
      cancelUrl: `${process.env.APP_URL}/vendor/pricing`,
      metadata: {
        vendorId,
      },
    });

    return {
      requiresPayment: true,
      clientSecret: session.clientSecret,
    };
  }

  /**
   * Get vendor dashboard URL
   */
  async getVendorDashboardUrl(vendorId: string): Promise<string> {
    const [vendor] = await db.select()
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    if (!vendor?.stripeAccountId) {
      throw new Error('Vendor not found or no Stripe account');
    }

    const { url } = await billing.marketplace.createLoginLink(
      vendor.stripeAccountId
    );

    return url;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + nanoid(6);
  }
}

export const vendorService = new VendorService();
```

---

## Part 4: Checkout with Split Payments

```typescript
// src/services/checkout.service.ts
import {
  QZPayPaymentProvider,
  QZPayCheckoutMode,
  QZPayCurrency,
  QZPayDiscountType,
} from '@qazuor/qzpay-core';
import { billing, getVendorCommissionRate } from '../lib/billing';
import { db } from '../db';
import {
  carts,
  cartItems,
  products,
  bundles,
  vendors,
  orders,
  orderItems,
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CheckoutInput {
  cartId: string;
  userId: string;
  shippingAddress: any;
  paymentProvider?: 'stripe' | 'mercadopago';
}

export interface CheckoutResult {
  clientSecret: string;
  sessionId: string;
  orderId: string;
}

export class CheckoutService {
  /**
   * Create checkout session with split payments
   * Note: Currently supports single-vendor checkout only.
   * Multi-vendor cart (purchasing from multiple vendors in one checkout)
   * is planned for a future version.
   */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.getCartWithItems(input.cartId);

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // V1: Validate single-vendor cart (multi-vendor planned for future version)
    const vendorIds = new Set(
      cart.items.map(item => item.product?.vendor?.id || item.bundle?.vendor?.id)
    );
    if (vendorIds.size > 1) {
      throw new Error('Multi-vendor checkout not yet supported. Please checkout items from one vendor at a time.');
    }

    // Sync customer
    const customer = await billing.customers.syncUser({
      id: input.userId,
      email: await this.getUserEmail(input.userId),
    });

    // Calculate totals and splits
    const splits = await this.calculateSplits(cart);

    // Create pending order
    const orderId = nanoid();
    const [order] = await db.insert(orders).values({
      id: orderId,
      userId: input.userId,
      paymentId: '', // Will be updated after payment
      subtotal: splits.subtotal,
      discount: splits.discount,
      shipping: splits.shipping,
      tax: splits.tax,
      total: splits.total,
      currency: 'USD',
      status: 'pending',
      shippingAddress: input.shippingAddress,
      promoCodeId: cart.promoCodeId,
      promoDiscount: splits.promoDiscount,
    }).returning();

    // Create order items
    for (const item of splits.items) {
      await db.insert(orderItems).values({
        id: nanoid(),
        orderId,
        vendorId: item.vendorId,
        productId: item.productId,
        bundleId: item.bundleId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        discount: item.discount,
        total: item.total,
        vendorAmount: item.vendorAmount,
        platformAmount: item.platformAmount,
        fulfillmentStatus: 'pending',
      });
    }

    // Create checkout session with splits
    const session = await billing.checkout.create({
      customerId: customer.id,
      mode: 'payment',
      items: splits.items.map(item => ({
        name: item.name,
        description: `From ${item.vendorName}`,
        amount: item.total,
        quantity: 1,
      })),
      splitPayments: {
        enabled: true,
        splits: splits.vendorSplits,
      },
      promoCode: cart.promoCodeId ? await this.getPromoCode(cart.promoCodeId) : undefined,
      successUrl: `${process.env.APP_URL}/order/${orderId}/success`,
      cancelUrl: `${process.env.APP_URL}/cart`,
      metadata: {
        orderId,
        cartId: input.cartId,
      },
    });

    return {
      clientSecret: session.clientSecret,
      sessionId: session.id,
      orderId,
    };
  }

  /**
   * Calculate payment splits for vendor commission
   * V1: Single vendor per cart (multi-vendor planned for future version)
   * Split is between: Vendor (receives sale amount minus commission) and Platform (keeps commission)
   */
  private async calculateSplits(cart: any) {
    const items: any[] = [];
    const vendorTotals = new Map<string, {
      vendorId: string;
      vendorName: string;
      stripeAccountId: string | null;
      mpUserId: string | null;
      subtotal: number;
      commission: number;
      vendorAmount: number;
    }>();

    for (const item of cart.items) {
      const vendor = item.product?.vendor || item.bundle?.vendor;
      if (!vendor) continue;

      // Get vendor's commission rate based on their subscription tier
      const commissionRate = await getVendorCommissionRate(vendor.id);

      const itemTotal = item.unitPrice * item.quantity;
      const platformAmount = Math.round(itemTotal * commissionRate);
      const vendorAmount = itemTotal - platformAmount;

      items.push({
        vendorId: vendor.id,
        vendorName: vendor.storeName,
        productId: item.productId,
        bundleId: item.bundleId,
        name: item.product?.name || item.bundle?.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: itemTotal,
        discount: 0, // Applied at cart level
        total: itemTotal,
        vendorAmount,
        platformAmount,
      });

      // Aggregate per vendor
      const existing = vendorTotals.get(vendor.id);
      if (existing) {
        existing.subtotal += itemTotal;
        existing.commission += platformAmount;
        existing.vendorAmount += vendorAmount;
      } else {
        vendorTotals.set(vendor.id, {
          vendorId: vendor.id,
          vendorName: vendor.storeName,
          stripeAccountId: vendor.stripeAccountId,
          mpUserId: vendor.mpUserId,
          subtotal: itemTotal,
          commission: platformAmount,
          vendorAmount,
        });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    let discount = 0;
    let promoDiscount = 0;

    // Apply promo code if present
    if (cart.promoCodeId) {
      const promoResult = await billing.promoCodes.calculateDiscount({
        promoCodeId: cart.promoCodeId,
        amount: subtotal,
      });
      promoDiscount = promoResult.discountAmount;
      discount += promoDiscount;
    }

    const shipping = 0; // Calculated separately
    const tax = 0; // Calculated separately
    const total = subtotal - discount + shipping + tax;

    // Create split configuration
    const vendorSplits = Array.from(vendorTotals.values()).map(v => ({
      destination: v.stripeAccountId || v.mpUserId!,
      amount: v.vendorAmount,
      metadata: {
        vendorId: v.vendorId,
      },
    }));

    return {
      items,
      subtotal,
      discount,
      promoDiscount,
      shipping,
      tax,
      total,
      vendorSplits,
    };
  }

  private async getCartWithItems(cartId: string) {
    return db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: {
        items: {
          with: {
            product: {
              with: { vendor: true },
            },
            bundle: {
              with: { vendor: true },
            },
          },
        },
      },
    });
  }

  private async getUserEmail(userId: string): Promise<string> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user?.email || '';
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

## Part 5: Event Handlers

```typescript
// src/lib/billing-events.ts
import {
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  QZPayVendorOnboardingStatus,
  type QZPayPaymentSucceededEvent,
  type QZPaySubscriptionCreatedEvent,
  type QZPayVendorPayoutEvent,
} from '@qazuor/qzpay-core';
import { billing, COMMISSION_RATES } from './billing';
import { db } from '../db';
import { vendors, orders, orderItems, vendorPayouts } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendEmail } from './email';
import { analytics } from './analytics';

// ============================================
// SUBSCRIPTION EVENTS
// Use QZPayBillingEvent constants, NEVER strings
// ============================================

billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event: QZPaySubscriptionCreatedEvent) => {
  const { subscription, customer, emailSentByPackage } = event;

  console.log(`Vendor subscription created: ${subscription.id}`);

  // Update vendor tier
  await db.update(vendors)
    .set({ tier: subscription.planId })
    .where(eq(vendors.id, customer.externalId));

  await analytics.track('vendor_subscription_created', {
    vendorId: customer.externalId,
    planId: subscription.planId,
    isTrial: subscription.isTrial(),
  });
});

billing.on(QZPayBillingEvent.TRIAL_STARTED, async (event) => {
  const { subscription, customer, emailSentByPackage } = event;

  console.log(`Vendor trial started: ${subscription.id}`);

  // Send onboarding tips
  await sendEmail({
    to: customer.email,
    template: 'gemfolio-trial-tips',
    data: {
      trialDays: subscription.getTrialDaysRemaining(),
      planName: subscription.getPlanName(),
    },
  });
});

// Custom trial expiring email (suppressed)
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  const { subscription, customer, daysRemaining, emailSentByPackage } = event;

  // emailSentByPackage === false because it's in suppress
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, customer.externalId),
  });

  if (vendor) {
    // hasPaymentMethod is a pre-calculated property, not a method
    const { hasPaymentMethod } = subscription;
    const stats = await getVendorTrialStats(vendor.id);

    await sendEmail({
      to: customer.email,
      template: 'gemfolio-trial-expiring',
      data: {
        storeName: vendor.storeName,
        daysLeft: daysRemaining,
        planName: subscription.getPlanName(),
        stats: {
          productsListed: stats.products,
          salesMade: stats.sales,
          revenue: stats.revenue,
        },
        hasPaymentMethod,
        addPaymentUrl: hasPaymentMethod
          ? null
          : `${process.env.APP_URL}/vendor/settings/billing?add-payment`,
        currentCommission: `${COMMISSION_RATES[vendor.tier as keyof typeof COMMISSION_RATES] * 100}%`,
        newCommission: `${COMMISSION_RATES.basic * 100}%`,
      },
    });
  }
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_EXPIRED, async (event) => {
  const { subscription, customer } = event;

  console.log(`Vendor subscription expired: ${subscription.id}`);

  // Downgrade to basic tier
  await db.update(vendors)
    .set({ tier: 'basic' })
    .where(eq(vendors.id, customer.externalId));

  // Handle limit overages (hide extra products, etc.)
  await handleVendorDowngrade(customer.externalId);
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_UPGRADED, async (event) => {
  const { subscription, customer, oldPlan, newPlan } = event;

  await db.update(vendors)
    .set({ tier: newPlan.id })
    .where(eq(vendors.id, customer.externalId));

  await analytics.track('vendor_upgraded', {
    vendorId: customer.externalId,
    fromPlan: oldPlan.id,
    toPlan: newPlan.id,
  });
});

billing.on(QZPayBillingEvent.SUBSCRIPTION_DOWNGRADED, async (event) => {
  const { subscription, customer, oldPlan, newPlan } = event;

  await db.update(vendors)
    .set({ tier: newPlan.id })
    .where(eq(vendors.id, customer.externalId));

  await handleVendorDowngrade(customer.externalId);

  await analytics.track('vendor_downgraded', {
    vendorId: customer.externalId,
    fromPlan: oldPlan.id,
    toPlan: newPlan.id,
  });
});

// ============================================
// PAYMENT EVENTS (Customer orders)
// ============================================

billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, async (event: QZPayPaymentSucceededEvent) => {
  const { payment, customer, emailSentByPackage } = event;

  console.log(`Payment succeeded: ${payment.id}`);

  // Update order status
  if (payment.metadata?.orderId) {
    await db.update(orders)
      .set({
        status: 'paid',
        paymentId: payment.id,
      })
      .where(eq(orders.id, payment.metadata.orderId));

    // Notify vendors of new orders
    await notifyVendorsOfOrder(payment.metadata.orderId);

    // Clear cart
    if (payment.metadata?.cartId) {
      await db.delete(cartItems)
        .where(eq(cartItems.cartId, payment.metadata.cartId));
    }
  }

  await analytics.track('order_payment_succeeded', {
    customerId: customer.externalId,
    orderId: payment.metadata?.orderId,
    amount: payment.amount,
  });
});

billing.on(QZPayBillingEvent.SPLIT_PAYMENT_COMPLETED, async (event) => {
  const { payment, splits } = event;

  console.log(`Split payment completed: ${payment.id}`);

  // Update order items with transfer IDs
  for (const split of splits) {
    await db.update(orderItems)
      .set({
        transferId: split.transferId,
        transferStatus: 'pending',
      })
      .where(and(
        eq(orderItems.orderId, payment.metadata?.orderId),
        eq(orderItems.vendorId, split.metadata?.vendorId)
      ));
  }
});

// ============================================
// VENDOR PAYOUT EVENTS
// ============================================

billing.on(QZPayBillingEvent.VENDOR_PAYOUT_SENT, async (event: QZPayVendorPayoutEvent) => {
  const { vendorId, amount, currency, payoutId, emailSentByPackage } = event;

  console.log(`Payout sent to vendor ${vendorId}: ${amount} ${currency}`);

  // Record payout
  await db.insert(vendorPayouts).values({
    id: nanoid(),
    vendorId,
    amount,
    currency,
    provider: 'stripe',
    providerPayoutId: payoutId,
    status: 'processing',
    createdAt: new Date(),
  });

  // Custom email (suppressed from package)
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { user: true },
  });

  if (vendor) {
    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-payout-sent',
      data: {
        storeName: vendor.storeName,
        amount: amount / 100,
        currency,
        dashboardUrl: `${process.env.APP_URL}/vendor/payouts`,
      },
    });
  }
});

// ============================================
// VENDOR ONBOARDING EVENTS
// ============================================

billing.on(QZPayBillingEvent.VENDOR_ONBOARDING_COMPLETE, async (event) => {
  const { vendorId, accountId, provider, emailSentByPackage } = event;

  console.log(`Vendor onboarding complete: ${vendorId}`);

  await db.update(vendors)
    .set({
      status: 'active',
      verifiedAt: new Date(),
      ...(provider === 'stripe' ? {
        stripeOnboardingComplete: true,
        stripeAccountStatus: 'active',
      } : {
        mpOnboardingComplete: true,
      }),
    })
    .where(eq(vendors.id, vendorId));

  await analytics.track('vendor_onboarding_complete', {
    vendorId,
    provider,
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

// ============================================
// HELPERS
// ============================================

async function handleVendorDowngrade(vendorId: string) {
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
  });

  if (!vendor) return;

  const newLimits = VENDOR_PLANS.find(p => p.id === vendor.tier)?.limits;
  if (!newLimits) return;

  // Check product limits
  const products = await db.query.products.findMany({
    where: eq(products.vendorId, vendorId),
    orderBy: (products, { asc }) => [asc(products.createdAt)],
  });

  if (newLimits.maxProducts !== -1 && products.length > newLimits.maxProducts) {
    const toArchive = products.slice(newLimits.maxProducts);

    for (const product of toArchive) {
      await db.update(products)
        .set({ status: 'archived' })
        .where(eq(products.id, product.id));
    }

    // Notify vendor
    await sendNotification(vendorId, {
      type: 'products_archived',
      title: 'Products Archived',
      message: `${toArchive.length} products were archived due to plan limits.`,
    });
  }
}

async function notifyVendorsOfOrder(orderId: string) {
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
    with: { vendor: { with: { user: true } } },
  });

  const vendorItems = new Map<string, typeof items>();

  for (const item of items) {
    const existing = vendorItems.get(item.vendorId) || [];
    existing.push(item);
    vendorItems.set(item.vendorId, existing);
  }

  for (const [vendorId, vendorOrderItems] of vendorItems) {
    const vendor = vendorOrderItems[0].vendor;
    const total = vendorOrderItems.reduce((sum, i) => sum + i.vendorAmount, 0);

    await sendEmail({
      to: vendor.user.email,
      template: 'gemfolio-new-order',
      data: {
        storeName: vendor.storeName,
        orderItems: vendorOrderItems,
        total: total / 100,
        dashboardUrl: `${process.env.APP_URL}/vendor/orders`,
      },
    });
  }
}

async function getVendorTrialStats(vendorId: string) {
  // Implementation to get trial period stats
  return { products: 10, sales: 5, revenue: 25000 };
}
```

---

## Part 6: API Routes (TanStack Start)

### 6.1 Billing Webhook Route

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

### 6.2 Vendor Server Functions

```typescript
// app/server/vendor.ts
import { createServerFn } from '@tanstack/react-start/server';
import { getAuth } from '@clerk/tanstack-start/server';
import { db } from '~/db';
import { users, vendors } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { vendorService } from '~/services/vendor.service';

export const registerVendor = createServerFn({ method: 'POST' })
  .validator((data: { storeName: string; description: string; provider: 'stripe' | 'mercadopago' }) => data)
  .handler(async ({ data, context }) => {
    const auth = await getAuth(context.request);
    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const result = await vendorService.createVendor(
      { userId: user.id, storeName: data.storeName, description: data.description },
      data.provider
    );

    return {
      vendorId: result.vendor.id,
      onboardingUrl: result.onboardingUrl,
    };
  });

export const completeOnboarding = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const auth = await getAuth(context.request);
    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, user!.id),
    });

    if (!vendor) {
      return { redirect: '/vendor/register' };
    }

    const complete = await vendorService.completeStripeOnboarding(vendor.id);

    if (complete) {
      return { redirect: '/vendor/dashboard?onboarding=success' };
    }

    return { redirect: '/vendor/onboarding?status=incomplete' };
  });

export const getVendorAccess = createServerFn({ method: 'GET' })
  .handler(async ({ context }) => {
    const auth = await getAuth(context.request);
    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, user!.id),
    });

    if (!vendor) {
      throw new Error('Not a vendor');
    }

    return getVendorAccessData(vendor.id);
  });

export const upgradeVendor = createServerFn({ method: 'POST' })
  .validator((data: { planId: string; interval: 'month' | 'year'; promoCode?: string }) => data)
  .handler(async ({ data, context }) => {
    const auth = await getAuth(context.request);
    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, user!.id),
    });

    if (!vendor) {
      throw new Error('Not a vendor');
    }

    return vendorService.upgradeVendor(
      vendor.id,
      data.planId,
      data.interval,
      data.promoCode
    );
  });
```

### 6.3 Checkout Server Functions

```typescript
// app/server/checkout.ts
import { createServerFn } from '@tanstack/react-start/server';
import { getAuth } from '@clerk/tanstack-start/server';
import { db } from '~/db';
import { users } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { checkoutService } from '~/services/checkout.service';

export const createCheckout = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; shippingAddress: object }) => data)
  .handler(async ({ data, context }) => {
    const auth = await getAuth(context.request);
    if (!auth?.userId) {
      throw new Error('Unauthorized');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    return checkoutService.createCheckout({
      cartId: data.cartId,
      userId: user!.id,
      shippingAddress: data.shippingAddress,
    });
  });
```

### 6.4 MercadoPago OAuth Callback Route

```typescript
// app/routes/api/vendor/mp-connect/callback.ts
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { vendorService } from '~/services/vendor.service';

export const APIRoute = createAPIFileRoute('/api/vendor/mp-connect/callback')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const vendorId = url.searchParams.get('state');

    if (!code || !vendorId) {
      return Response.redirect(`${process.env.APP_URL}/vendor/onboarding?error=missing_params`);
    }

    try {
      await vendorService.completeMPOnboarding(vendorId, code);
      return Response.redirect(`${process.env.APP_URL}/vendor/dashboard?onboarding=success`);
    } catch (error) {
      return Response.redirect(`${process.env.APP_URL}/vendor/onboarding?error=failed`);
    }
  },
});
```

---

## Part 7: Frontend Components

### 7.1 Vendor Pricing Page

```tsx
// src/pages/vendor/pricing.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  QZPayPricingTable,
  QZPayPromoCodeInput,
  useQZPayCheckout,
} from '@qazuor/qzpay-react';
import { useVendor } from '@/hooks/useVendor';
import { QZPayBillingInterval, QZPayDiscountType } from '@qazuor/qzpay-core';

export default function VendorPricingPage() {
  const router = useRouter();
  const { vendor, access, isLoading } = useVendor();
  const { createCheckout, isLoading: checkoutLoading } = useQZPayCheckout();

  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount: number;
    description: string;
  } | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'basic') {
      router.push('/vendor/dashboard');
      return;
    }

    try {
      const response = await fetch('/api/vendor/upgrade', {
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
          onComplete: () => {
            router.push('/vendor/dashboard?subscription=success');
          },
        });
      } else {
        // Trial without card
        router.push('/vendor/dashboard?trial=started');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleValidatePromo = async (code: string) => {
    const res = await fetch('/billing/promo-codes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, planId: 'professional', interval }),
    });
    const result = await res.json();

    if (result.valid) {
      setPromoCode(code);
      setPromoResult({
        valid: true,
        discount: result.discountAmount,
        description: result.description,
      });
      return { valid: true };
    }

    return { valid: false, reason: result.reason };
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="vendor-pricing-page">
      <header className="pricing-header">
        <h1>Grow Your Jewelry Business</h1>
        <p>Lower commissions, more features, more sales</p>

        <div className="interval-toggle">
          <button
            className={interval === 'month' ? 'active' : ''}
            onClick={() => setInterval('month')}
          >
            Monthly
          </button>
          <button
            className={interval === 'year' ? 'active' : ''}
            onClick={() => setInterval('year')}
          >
            Yearly
            <span className="badge">Save 17%</span>
          </button>
        </div>
      </header>

      <div className="promo-section">
        <QZPayPromoCodeInput
          onValidate={handleValidatePromo}
          onRemove={() => {
            setPromoCode('');
            setPromoResult(null);
          }}
          placeholder="Have a promo code?"
          appliedCode={promoCode}
          appliedResult={promoResult}
        />
      </div>

      {promoResult?.valid && (
        <div className="promo-banner">
          Code {promoCode} applied: {promoResult.description}
        </div>
      )}

      <QZPayPricingTable
        apiUrl="/api/vendor/plans"
        interval={interval}
        currentPlanId={access?.plan?.id}
        promoDiscount={promoResult?.valid ? promoResult.discount : undefined}
        onSelectPlan={handleSelectPlan}
        isLoading={checkoutLoading}
        showTrialInfo
        trialText="14 days free, no credit card required"
        highlightCommission
      />
    </div>
  );
}
```

### 7.2 Vendor Trial Banner

```tsx
// src/components/VendorTrialBanner.tsx
'use client';

import { useQZPaySubscription } from '@qazuor/qzpay-react';
import { COMMISSION_RATES } from '@/config/plans';

export function VendorTrialBanner() {
  const { subscription, loading } = useQZPaySubscription();

  if (loading || !subscription) return null;

  // Use helper method
  if (!subscription.isTrial()) return null;

  const daysRemaining = subscription.getTrialDaysRemaining();
  // hasPaymentMethod is a pre-calculated property, not a method
  const { hasPaymentMethod } = subscription;
  const currentTier = subscription.planId;
  const currentCommission = COMMISSION_RATES[currentTier as keyof typeof COMMISSION_RATES];
  const basicCommission = COMMISSION_RATES.basic;

  return (
    <div className={`trial-banner ${daysRemaining <= 3 ? 'urgent' : ''}`}>
      <div className="trial-info">
        <span className="trial-icon">🎁</span>
        <div className="trial-text">
          <strong>
            {daysRemaining > 0
              ? `${daysRemaining} days left in your trial`
              : 'Your trial ends today'}
          </strong>
          <span>
            Enjoying {currentCommission * 100}% commission? After trial it goes to {basicCommission * 100}%.
          </span>
        </div>
      </div>

      {!hasPaymentMethod && (
        <a href="/vendor/settings/billing?add-payment" className="add-payment-button">
          Add Payment Method
        </a>
      )}
    </div>
  );
}
```

---

## Part 8: Complete Flows

### 8.1 Vendor Onboarding + Trial Flow

```
1. Artisan visits /vendor/register
2. Fills store name, description
3. POST /api/vendor/register
4. Backend creates vendor record
5. Syncs with billing.customers.syncUser()
6. Creates Stripe Connect Express account
7. Returns onboarding URL
8. User redirected to Stripe onboarding
9. Completes identity verification
10. Redirected to /vendor/onboarding/complete
11. Backend checks account status
12. If complete: vendor.status = 'active'
13. Redirect to /vendor/dashboard
14. Vendor sees: "Start with Basic (15% commission) or upgrade?"

[Upgrade to Professional]
15. Vendor clicks "Upgrade to Professional"
16. POST /api/vendor/upgrade with planId: 'professional'
17. Backend detects trial.requiresPaymentMethod = false
18. Creates subscription in 'trialing' state
19. Updates vendor.tier = 'professional'
20. Returns requiresPayment: false
21. Vendor redirected to dashboard
22. Commission now 12% for all sales
23. TRIAL_STARTED event emitted

[Day 11 - 3 days before]
24. Job detects trial expiring
25. TRIAL_EXPIRING emitted (emailSentByPackage: false)
26. GEMFolio sends custom email with:
    - Sales stats during trial
    - "Keep your 12% rate, add payment method"
    - Current commission vs after downgrade

[Day 14 - Trial ends]
Option A: Vendor adds payment method
27. Stripe charges subscription
28. Status changes to 'active'
29. Vendor keeps Professional tier

Option B: No payment method
30. Subscription expires
31. SUBSCRIPTION_EXPIRED emitted
32. vendor.tier = 'basic'
33. Commission goes back to 15%
34. Products over limit are archived
```

### 8.2 Single-Vendor Checkout Flow

```
[Customer shopping]
1. Customer browses products from Artisan B
2. Adds Silver Necklace ($150)
3. Cart shows single vendor order

[Applying promo code]
4. Customer enters "SUMMER20"
5. POST /billing/promo-codes/validate
6. Validated: 20% off, platform absorbs
7. Cart updates: $150 - $30 = $120

[Checkout]
8. Customer clicks checkout
9. POST /api/checkout
10. Backend calculates split:
    - Artisan B (Basic, 15%):
      * Item: $150
      * Commission: $22.50
      * Receives: $127.50
    - Platform promo discount: $30 (20% of $150)
    - Customer pays: $120

11. Creates Stripe Checkout with split:
    - $127.50 transfer to Artisan B
    - Platform keeps $22.50 - $30 = -$7.50 (absorbs discount)

12. Returns clientSecret
13. Customer completes payment
14. PAYMENT_SUCCEEDED event
15. SPLIT_PAYMENT_COMPLETED event
16. Order created, vendor notified

[Fulfillment]
17. Artisan B ships the item
18. Updates fulfillment status
19. Customer gets tracking
20. When delivered, payout becomes available (after 7-day hold)
```

> **Note**: Multi-vendor cart (purchasing from multiple vendors in a single checkout) is planned for a future version. Currently, each purchase is processed with a single vendor.

---

## Summary of Improvements

1. **Exported Constants**: All comparisons use `QZPaySubscriptionStatus.ACTIVE`, `QZPayBillingEvent.TRIAL_EXPIRING`, `QZPayVendorOnboardingStatus.COMPLETE`, `QZPayDiscountType.PERCENTAGE`, etc.

2. **Entitlements vs Limits**: Separated into typed interfaces (`GemfolioEntitlements`, `GemfolioLimits`) with clear distinction.

3. **Subscription Helpers**: `subscription.isActive()`, `subscription.isTrial()`, `subscription.hasPaymentMethod` (property), `subscription.getEntitlements()`, `subscription.getLimits()`.

4. **Env Validation**: CLI generates `.env.example`, package validates on init.

5. **Customer-User Sync**: `billing.customers.syncUser()` handles vendor-customer linking.

6. **Email Clarity**: `suppress` array defines which emails GEMFolio handles, `emailSentByPackage` in events.

7. **Trials Without Card**: `trial.requiresPaymentMethod: false` for vendor subscriptions.

8. **Marketplace Split Payments**: Automatic commission calculation based on vendor tier. Each purchase is from a single vendor (multi-vendor cart planned for future version).

9. **Promo Codes**: Platform promos (vendor subscriptions) + marketplace promos (customer orders).

10. **Vendor Onboarding**: Full Stripe Connect + MercadoPago Marketplace integration.

---

*Example updated for @qazuor/qzpay v2.0*
