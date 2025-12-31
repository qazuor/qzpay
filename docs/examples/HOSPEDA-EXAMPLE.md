# Ejemplo Completo: HOSPEDA

## Contexto de HOSPEDA

HOSPEDA es una plataforma de publicacion de alojamientos (similar a Airbnb para propietarios). El modelo de negocio incluye:

- **Suscripciones**: Mensual/anual para publicar propiedades
- **Planes**: Free, Starter, Pro, Business
- **Add-ons**: Featured listing, destacado en busquedas, etc.
- **Servicios one-time**: Sesion de fotos profesional, copywriting, etc.
- **Trials**: 14 dias gratis SIN necesidad de tarjeta

### Tech Stack de HOSPEDA

- **Framework**: Hono (Cloudflare Workers)
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle
- **Auth**: Clerk
- **Frontend**: React (Vite)

---

## Parte 1: Setup Inicial

### 1.1 Instalacion

```bash
# Instalar los packages necesarios
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-mercadopago @qazuor/qzpay-drizzle @qazuor/qzpay-hono

# Para el frontend
pnpm add @qazuor/qzpay-react

# CLI para generar .env.example y validar
pnpm add -D @qazuor/qzpay-cli
```

### 1.2 Generar y Validar Variables de Entorno

```bash
# Generar .env.example con todas las variables necesarias
npx @qazuor/qzpay-cli env:generate --adapters stripe,mercadopago,resend

# Esto genera:
# =================================
# @qazuor/qzpay Configuration
# =================================
#
# Stripe
# STRIPE_SECRET_KEY=  # Required
# STRIPE_WEBHOOK_SECRET=  # Required
# # STRIPE_PUBLISHABLE_KEY=  # Optional
#
# MercadoPago
# MP_ACCESS_TOKEN=  # Required
# # MP_PUBLIC_KEY=  # Optional
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
DATABASE_URL=postgres://user:pass@neon.tech/hospeda

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx
MP_WEBHOOK_SECRET=whsec_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# App
APP_URL=https://hospeda.com
```

### 1.3 Schema de Base de Datos

```typescript
// src/db/schema/index.ts
import { pgTable, uuid, varchar, timestamp, boolean, text, jsonb, integer } from 'drizzle-orm/pg-core';

// ============================================
// TABLAS DE LA APP (propias de HOSPEDA)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  address: varchar('address', { length: 500 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  pricePerNight: integer('price_per_night'),
  images: jsonb('images').default([]),
  amenities: jsonb('amenities').default([]),
  status: varchar('status', { length: 50 }).default('draft'),
  isFeatured: boolean('is_featured').default(false),
  featuredUntil: timestamp('featured_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// TABLAS DE BILLING (generadas por @qazuor/qzpay-drizzle)
// ============================================

// Importar schema de billing con prefijo configurable
import { createQZPayBillingSchema } from '@qazuor/qzpay-drizzle/schema';

// Crear schema con prefijo 'billing_'
export const billingSchema = createQZPayBillingSchema({
  tablePrefix: 'billing_',
  // Relacion con tabla de usuarios
  userTable: users,
  userIdColumn: 'id',
});

// Esto exporta automaticamente todas las tablas de billing
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

## Parte 2: Configuracion del Billing System

### 2.1 Definicion de Planes con Entitlements y Limits

```typescript
// src/config/plans.ts
import {
  QZPayBillingInterval,
  type QZPayPlanDefinition,
  type QZPayEntitlements,
  type QZPayLimits,
} from '@qazuor/qzpay-core';

/**
 * Entitlements especificos de HOSPEDA (features booleanas)
 */
export interface HospedaEntitlements extends QZPayEntitlements {
  canAccessAnalytics: boolean;
  canAccessPrioritySupport: boolean;
  canUseCalendarSync: boolean;
  canUseApi: boolean;
  canUseCustomBranding: boolean;
  canInviteTeamMembers: boolean;
}

/**
 * Limits especificos de HOSPEDA (restricciones numericas)
 * -1 significa ilimitado
 */
export interface HospedaLimits extends QZPayLimits {
  maxProperties: number;
  maxPhotosPerProperty: number;
  maxFeaturedPerMonth: number;
  maxTeamMembers: number;
}

/**
 * Planes de HOSPEDA
 */
export const HOSPEDA_PLANS: QZPayPlanDefinition<HospedaEntitlements, HospedaLimits>[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Para empezar a explorar',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 0, currency: 'USD' },
      [QZPayBillingInterval.YEAR]: { amount: 0, currency: 'USD' },
    },
    entitlements: {
      canAccessAnalytics: false,
      canAccessPrioritySupport: false,
      canUseCalendarSync: false,
      canUseApi: false,
      canUseCustomBranding: false,
      canInviteTeamMembers: false,
    },
    limits: {
      maxProperties: 1,
      maxPhotosPerProperty: 5,
      maxFeaturedPerMonth: 0,
      maxTeamMembers: 1,
    },
    trial: null, // Free no tiene trial
    displayFeatures: [
      '1 propiedad',
      'Fotos basicas (5 max)',
      'Listado estandar',
      'Soporte por email',
    ],
  },

  {
    id: 'starter',
    name: 'Starter',
    description: 'Para propietarios individuales',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 1900, currency: 'USD' }, // $19.00
      [QZPayBillingInterval.YEAR]: { amount: 19000, currency: 'USD' }, // $190.00 (~17% descuento)
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: false,
      canUseCalendarSync: false,
      canUseApi: false,
      canUseCustomBranding: false,
      canInviteTeamMembers: false,
    },
    limits: {
      maxProperties: 3,
      maxPhotosPerProperty: -1, // ilimitado
      maxFeaturedPerMonth: 0,
      maxTeamMembers: 1,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false, // NO requiere tarjeta!
    },
    displayFeatures: [
      '3 propiedades',
      'Fotos ilimitadas',
      'Listado estandar',
      'Analytics basico',
      'Soporte por email',
    ],
  },

  {
    id: 'pro',
    name: 'Pro',
    description: 'Para profesionales del alquiler',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 4900, currency: 'USD' }, // $49.00
      [QZPayBillingInterval.YEAR]: { amount: 49000, currency: 'USD' }, // $490.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUseCalendarSync: true,
      canUseApi: false,
      canUseCustomBranding: false,
      canInviteTeamMembers: false,
    },
    limits: {
      maxProperties: 10,
      maxPhotosPerProperty: -1,
      maxFeaturedPerMonth: 1,
      maxTeamMembers: 1,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    isFeatured: true, // Destacar en pricing
    badgeText: 'Mas popular',
    displayFeatures: [
      '10 propiedades',
      'Fotos ilimitadas',
      '1 listado destacado/mes',
      'Analytics avanzado',
      'Soporte prioritario',
      'Integracion con calendarios',
    ],
  },

  {
    id: 'business',
    name: 'Business',
    description: 'Para agencias y empresas',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 14900, currency: 'USD' }, // $149.00
      [QZPayBillingInterval.YEAR]: { amount: 149000, currency: 'USD' }, // $1490.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUseCalendarSync: true,
      canUseApi: true,
      canUseCustomBranding: true,
      canInviteTeamMembers: true,
    },
    limits: {
      maxProperties: -1, // ilimitado
      maxPhotosPerProperty: -1,
      maxFeaturedPerMonth: 5,
      maxTeamMembers: 5,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    displayFeatures: [
      'Propiedades ilimitadas',
      'Fotos ilimitadas',
      '5 listados destacados/mes',
      'Analytics avanzado + exportacion',
      'Soporte dedicado',
      'API access',
      'Multi-usuario (5 seats)',
      'Branding personalizado',
    ],
  },
];

// Exportar tipo para el plan ID
export type HospedaPlanId = typeof HOSPEDA_PLANS[number]['id'];
```

### 2.2 Definicion de Promo Codes

```typescript
// src/config/promo-codes.ts
// Use QZPayPromoCodeType for promo codes (manual codes entered by customers)
// Use QZPayAutomaticDiscountType for automatic discounts (system-applied)
import { QZPayPromoCodeType, QZPayBillingInterval } from '@qazuor/qzpay-core';

/**
 * Ejemplos de promo codes que HOSPEDA puede crear via admin
 */
export const PROMO_CODE_EXAMPLES = {
  // Descuento porcentual
  WELCOME20: {
    code: 'WELCOME20',
    type: QZPayPromoCodeType.PERCENTAGE,
    value: 20, // 20% de descuento
    config: {},
    restrictions: {
      maxUses: 1000,
      maxUsesPerCustomer: 1,
      newCustomersOnly: true,
      validPlans: ['starter', 'pro', 'business'],
      expiresAt: new Date('2025-12-31'),
    },
  },

  // Monto fijo
  SAVE10: {
    code: 'SAVE10',
    type: QZPayPromoCodeType.FIXED_AMOUNT,
    value: 1000, // $10 de descuento
    config: { currency: 'USD' },
    restrictions: {
      minAmount: 1900, // Minimo $19 de compra
    },
  },

  // Periodo gratis
  PROMONTH: {
    code: 'PROMONTH',
    type: QZPayPromoCodeType.FREE_PERIOD,
    value: 1, // 1 periodo gratis
    config: {},
    restrictions: {
      validPlans: ['pro'],
      validIntervals: [QZPayBillingInterval.MONTH],
      newCustomersOnly: true,
    },
  },

  // Periodo con precio reducido
  TRIAL50: {
    code: 'TRIAL50',
    type: QZPayPromoCodeType.REDUCED_PERIOD,
    value: 50, // 50% de descuento
    config: {
      periods: 3, // Por 3 periodos
    },
    restrictions: {
      newCustomersOnly: true,
    },
  },

  // Descuento porcentual con restriccion de propiedades minimas
  // Nota: Para descuentos automaticos por volumen, usar QZPayAutomaticDiscountType.VOLUME
  BULK10: {
    code: 'BULK10',
    type: QZPayPromoCodeType.PERCENTAGE,
    value: 10, // 10% de descuento
    config: {},
    restrictions: {
      validPlans: ['business'],
      minProperties: 5, // Restriccion: solo si tiene 5+ propiedades
    },
  },
};
```

### 2.2.2 Descuentos Automaticos (Auto-Applied)

```typescript
// src/config/automatic-discounts.ts
// Use QZPayAutomaticDiscountType for automatic discounts (system-applied based on conditions)
import { QZPayAutomaticDiscountType, QZPayDiscountStackingMode, type QZPayAutomaticDiscount } from '@qazuor/qzpay-core';

/**
 * Descuentos que se aplican automaticamente sin codigo
 * El usuario ve el descuento aplicado sin hacer nada
 */
export const HOSPEDA_AUTOMATIC_DISCOUNTS: Record<string, QZPayAutomaticDiscount> = {
  // 10% para clientes con mas de 5 propiedades activas
  loyaltyDiscount: {
    id: 'loyalty-5-properties',
    name: '10% por tener 5+ propiedades',
    description: 'Descuento automatico para landlords con portfolio grande',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 10,
    conditions: {
      minQuantity: 5, // 5+ propiedades activas
    },
    appliesTo: 'subscription', // Aplica a la suscripcion
    stackable: true,
    priority: 1,
  },

  // 15% para clientes de mas de 1 año
  anniversaryDiscount: {
    id: 'anniversary-1-year',
    name: '15% por aniversario',
    description: 'Gracias por estar con nosotros mas de 1 año',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 15,
    conditions: {
      customerAge: { minMonths: 12 }, // Cliente hace mas de 12 meses
    },
    appliesTo: 'subscription',
    stackable: false, // No se combina con otros
    priority: 2,
  },

  // Primer mes gratis al subir a Professional
  upgradeIncentive: {
    id: 'upgrade-first-month-free',
    name: 'Primer mes gratis al subir a Professional',
    description: 'Prueba Professional sin riesgo',
    type: QZPayAutomaticDiscountType.FREE_PERIOD,
    value: 1, // 1 periodo gratis
    conditions: {
      isUpgrade: true,
      fromPlans: ['free', 'starter'],
      toPlans: ['professional'],
    },
    appliesTo: 'subscription',
    stackable: false,
    priority: 1,
    maxRedemptionsPerCustomer: 1, // Solo 1 vez
  },

  // Descuento para nuevos usuarios en plan anual
  annualNewUser: {
    id: 'annual-new-user-20',
    name: '20% extra en plan anual para nuevos usuarios',
    description: 'Aprovecha el mejor precio al empezar',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 20,
    conditions: {
      isFirstPurchase: true,
      billingInterval: 'year',
    },
    appliesTo: 'subscription',
    stackable: true, // Se suma al descuento anual base
    priority: 3,
    validUntil: new Date('2025-12-31'),
  },
};
```

### 2.3 Instancia del Billing System

```typescript
// src/lib/billing.ts
import {
  createQZPayBilling,
  QZPayCurrency,
  QZPayCheckoutMode,
  QZPayNotificationMode,
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  QZPayDiscountStackingMode,
} from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { createQZPayResendAdapter } from '@qazuor/qzpay-resend';
import { db } from '../db';
import { HOSPEDA_PLANS, type HospedaEntitlements, type HospedaLimits } from '../config/plans';
import { HOSPEDA_AUTOMATIC_DISCOUNTS } from '../config/automatic-discounts';

// Crear instancia del billing system
export const billing = createQZPayBilling<HospedaEntitlements, HospedaLimits>({
  // Storage adapter (Drizzle + PostgreSQL)
  storage: createQZPayDrizzleStorage(db, {
    tablePrefix: 'billing_',
  }),

  // Plans (el billing system los conoce)
  plans: HOSPEDA_PLANS,

  // Descuentos automaticos (se aplican sin codigo)
  automaticDiscounts: HOSPEDA_AUTOMATIC_DISCOUNTS,

  // Reglas de combinacion de descuentos
  discountStacking: {
    mode: QZPayDiscountStackingMode.ALL_STACKABLE, // Aplica todos los que sean stackable: true
    maxStackedDiscounts: 2, // Maximo 2 descuentos simultaneos
  },

  // Payment adapters
  paymentAdapters: {
    stripe: createQZPayStripeAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
    mercadopago: createQZPayMercadoPagoAdapter({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      webhookSecret: process.env.MP_WEBHOOK_SECRET,
    }),
  },

  // Email adapter
  emailAdapter: createQZPayResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: 'HOSPEDA <billing@hospeda.com>',
  }),

  // Configuracion de notificaciones
  notifications: {
    mode: QZPayNotificationMode.HYBRID,

    // Templates personalizados de HOSPEDA
    templates: {
      [QZPayBillingEvent.SUBSCRIPTION_CREATED]: 'hospeda-welcome',
      [QZPayBillingEvent.TRIAL_STARTED]: 'hospeda-trial-started',
      [QZPayBillingEvent.PAYMENT_SUCCEEDED]: 'hospeda-payment-success',
    },

    // Estos eventos: el package NO envia email, HOSPEDA los maneja
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.TRIAL_EXPIRED,
      QZPayBillingEvent.SUBSCRIPTION_CANCELED,
    ],
  },

  // Configuracion de moneda
  currency: {
    base: QZPayCurrency.USD,
    strategy: 'provider', // Stripe/MP hacen la conversion
  },

  // Configuracion de suscripciones
  subscriptions: {
    gracePeriodDays: 3,
    retryAttempts: 4,
    retryIntervalHours: 24,
    trialReminderDays: [7, 3, 1],
    expirationWarningDays: [7, 3, 1],
  },

  // Configuracion de checkout
  checkout: {
    mode: QZPayCheckoutMode.EMBEDDED,
  },

  // Impuestos (preparado para futuro)
  taxes: {
    enabled: false,
    defaultRate: 0,
  },
});

// El billing valida las env vars automaticamente al inicializar
// Si faltan, lanza error descriptivo

// ============================================
// HELPERS QUE USA LA SUBSCRIPTION ENRICHED
// ============================================

/**
 * Obtener features del usuario.
 * Usa los metodos helper de QZPaySubscriptionWithHelpers.
 */
export async function getUserAccess(userId: string) {
  // getActiveByCustomerExternalId retorna QZPaySubscriptionWithHelpers
  const subscription = await billing.subscriptions.getActiveByCustomerExternalId(userId);

  if (!subscription) {
    // Sin suscripcion = plan free
    const freePlan = HOSPEDA_PLANS.find(p => p.id === 'free')!;
    return {
      hasAccess: true, // Free siempre tiene acceso basico
      plan: freePlan,
      entitlements: freePlan.entitlements,
      limits: freePlan.limits,
      subscription: null,
    };
  }

  // Usar metodos helper en vez de comparar strings
  return {
    hasAccess: subscription.hasAccess(), // true si active, trialing, o grace period
    plan: subscription.getPlan(),
    entitlements: subscription.getEntitlements(),
    limits: subscription.getLimits(),
    subscription: {
      id: subscription.id,
      status: subscription.status,
      isTrial: subscription.isTrial(),
      trialDaysRemaining: subscription.getTrialDaysRemaining(),
      daysRemaining: subscription.getDaysRemaining(),
      willRenew: subscription.willRenew(),
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  };
}

/**
 * Verificar si usuario puede publicar mas propiedades
 */
export async function canPublishProperty(userId: string): Promise<boolean> {
  const access = await getUserAccess(userId);

  if (!access.hasAccess) return false;

  const currentCount = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
    columns: { id: true },
  });

  // -1 significa ilimitado
  if (access.limits.maxProperties === -1) return true;

  return currentCount.length < access.limits.maxProperties;
}

/**
 * Verificar si usuario puede destacar propiedad
 */
export async function canFeatureProperty(userId: string): Promise<boolean> {
  const access = await getUserAccess(userId);

  if (!access.hasAccess) return false;

  // Verificar limite de featured por mes
  if (access.limits.maxFeaturedPerMonth === 0) return false;
  if (access.limits.maxFeaturedPerMonth === -1) return true;

  // Contar cuantos featured uso este mes
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const featuredThisMonth = await db.query.properties.findMany({
    where: and(
      eq(properties.userId, userId),
      eq(properties.isFeatured, true),
      gte(properties.featuredUntil, startOfMonth)
    ),
    columns: { id: true },
  });

  return featuredThisMonth.length < access.limits.maxFeaturedPerMonth;
}

/**
 * Verificar si usuario tiene acceso a una feature especifica
 */
export async function hasEntitlement(
  userId: string,
  entitlement: keyof HospedaEntitlements
): Promise<boolean> {
  const access = await getUserAccess(userId);

  if (!access.hasAccess) return false;

  return access.entitlements[entitlement] === true;
}
```

---

## Parte 3: Integracion con Hono (Backend)

### 3.1 Setup de Rutas (Auto-registradas)

```typescript
// src/server/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { createQZPayBillingRoutes } from '@qazuor/qzpay-hono';
import { billing } from '../lib/billing';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', clerkMiddleware());

// ============================================
// RUTAS DE BILLING (AUTO-REGISTRADAS)
// ============================================

// Esto registra AUTOMATICAMENTE todas las rutas necesarias:
// - POST /billing/webhooks/stripe (solo si Stripe adapter configurado)
// - POST /billing/webhooks/mercadopago (solo si MP adapter configurado)
// - POST /billing/checkout/create
// - GET  /billing/subscriptions/:id
// - GET  /billing/subscriptions/customer/:externalId
// - POST /billing/subscriptions
// - POST /billing/subscriptions/:id/cancel
// - POST /billing/subscriptions/:id/change-plan
// - POST /billing/subscriptions/:id/add-payment-method
// - GET  /billing/customers/:id
// - GET  /billing/customers/external/:externalId
// - POST /billing/customers
// - POST /billing/customers/sync
// - GET  /billing/payments/:id
// - GET  /billing/payments/customer/:customerId
// - POST /billing/payments/:id/refund
// - POST /billing/promo-codes/validate
// - POST /billing/promo-codes/apply
// - GET  /billing/invoices/:id
// - GET  /billing/invoices/:id/pdf
// - GET  /billing/invoices/customer/:customerId
// - GET  /billing/jobs (lista jobs)
// - POST /billing/jobs/:name/run
// - POST /billing/jobs/run-due (para cron)
// - GET  /billing/metrics/*
// - POST /billing/admin/* (con adminMiddleware)

app.route('/', createQZPayBillingRoutes(billing, {
  basePath: '/billing',

  // Middleware de autenticacion para rutas protegidas
  authMiddleware: async (c, next) => {
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Obtener usuario de la DB
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    c.set('user', user);
    await next();
  },

  // Middleware para rutas de admin
  adminMiddleware: async (c, next) => {
    const user = c.get('user');
    if (user?.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  },

  // Opciones
  adminRoutes: true,
  metricsRoutes: true,
}));

// ============================================
// RUTAS CUSTOM DE HOSPEDA (minimas)
// ============================================

// Obtener planes disponibles
app.get('/api/plans', (c) => {
  // El billing ya conoce los planes
  const plans = billing.plans.getVisible();
  return c.json(plans);
});

// Obtener estado de acceso del usuario actual
app.get('/api/me/access', async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.userId),
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const access = await getUserAccess(user.id);
  return c.json(access);
});

// Iniciar suscripcion (trial sin tarjeta)
app.post('/api/subscribe', async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { planId, interval, promoCode } = await c.req.json<{
    planId: string;
    interval: 'month' | 'year';
    promoCode?: string;
  }>();

  // Validar plan
  const plan = billing.plans.get(planId);
  if (!plan) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  if (plan.id === 'free') {
    return c.json({ error: 'Cannot subscribe to free plan' }, 400);
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    // Sincronizar usuario con billing (crea customer si no existe)
    const customer = await billing.customers.syncUser({
      id: user!.id,
      email: user!.email,
      name: user!.name || undefined,
    });

    // Si el plan tiene trial sin tarjeta, crear subscription directamente
    if (plan.trial && !plan.trial.requiresPaymentMethod) {
      // Crear subscription en trial (sin Stripe aun)
      const subscription = await billing.subscriptions.create({
        customerId: customer.id,
        planId: plan.id,
        interval,
        startTrial: true, // Inicia trial
        promoCodeId: promoCode ? await billing.promoCodes.resolveId(promoCode) : undefined,
      });

      return c.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd,
        },
        // No hay clientSecret porque no pedimos tarjeta
        requiresPayment: false,
      });
    }

    // Si requiere tarjeta, crear checkout session
    const session = await billing.checkout.create({
      customerId: customer.id,
      mode: 'subscription',
      items: [
        {
          planId: plan.id,
          interval,
        },
      ],
      subscriptionData: {
        planId: plan.id,
        interval,
        trialDays: plan.trial?.days || 0,
      },
      promoCode,
      successUrl: `${process.env.APP_URL}/dashboard?subscription=success`,
      cancelUrl: `${process.env.APP_URL}/pricing?subscription=cancelled`,
      metadata: {
        userId: user!.id,
        planId: plan.id,
      },
    });

    return c.json({
      clientSecret: session.clientSecret,
      sessionId: session.id,
      requiresPayment: true,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return c.json({ error: 'Failed to create subscription' }, 500);
  }
});

// Agregar metodo de pago a trial existente
app.post('/api/subscription/add-payment-method', async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });

    const subscription = await billing.subscriptions.getActiveByCustomerExternalId(user!.id);

    if (!subscription) {
      return c.json({ error: 'No active subscription' }, 400);
    }

    // Crear setup session para agregar tarjeta
    const session = await billing.checkout.createSetupSession({
      customerId: subscription.customerId,
      successUrl: `${process.env.APP_URL}/settings/billing?payment-method=added`,
      cancelUrl: `${process.env.APP_URL}/settings/billing`,
      metadata: {
        subscriptionId: subscription.id,
      },
    });

    return c.json({
      clientSecret: session.clientSecret,
    });
  } catch (error) {
    console.error('Error creating setup session:', error);
    return c.json({ error: 'Failed to create setup session' }, 500);
  }
});

export default app;
```

### 3.2 Event Handlers (con constantes, no strings)

```typescript
// src/server/billing-events.ts
import {
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  type QZPaySubscriptionCreatedEvent,
  type QZPayTrialExpiringEvent,
  type QZPayPaymentSucceededEvent,
} from '@qazuor/qzpay-core';
import { billing, getUserAccess } from '../lib/billing';
import { db } from '../db';
import { properties, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '../lib/email';
import { HOSPEDA_PLANS } from '../config/plans';

// ============================================
// EVENTOS DE SUSCRIPCION
// Usar constantes de QZPayBillingEvent, NUNCA strings
// ============================================

// Cuando se crea una suscripcion
billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event: QZPaySubscriptionCreatedEvent) => {
  const { subscription, customer, emailSentByPackage } = event;

  console.log(`New subscription: ${subscription.id} for customer ${customer.id}`);
  console.log(`Email sent by package: ${emailSentByPackage}`); // true si el package envio

  // Tracking
  await analytics.track('subscription_created', {
    userId: customer.externalId,
    planId: subscription.planId,
    interval: subscription.billingInterval,
    isTrial: subscription.isTrial(),
  });
});

// Trial empezado (sin tarjeta)
billing.on(QZPayBillingEvent.TRIAL_STARTED, async (event) => {
  const { subscription, customer, emailSentByPackage } = event;

  console.log(`Trial started: ${subscription.id}, days: ${subscription.getTrialDaysRemaining()}`);

  // El package ya envio email si emailSentByPackage === true
});

// Recordatorio de trial (HOSPEDA lo maneja, suppress en config)
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event: QZPayTrialExpiringEvent) => {
  const { subscription, customer, daysRemaining, emailSentByPackage } = event;

  // emailSentByPackage === false porque esta en suppress
  // HOSPEDA envia su propio email

  const user = await db.query.users.findFirst({
    where: eq(users.id, customer.externalId),
  });

  if (user) {
    // hasPaymentMethod is a pre-calculated property, not a method
    const { hasPaymentMethod } = subscription;

    await sendEmail({
      to: user.email,
      template: 'hospeda-trial-expiring',
      data: {
        userName: user.name,
        daysLeft: daysRemaining,
        planName: subscription.getPlanName(),
        hasPaymentMethod,
        addPaymentMethodUrl: hasPaymentMethod
          ? null
          : `${process.env.APP_URL}/settings/billing?add-payment`,
      },
    });
  }
});

// Trial expirado (HOSPEDA lo maneja)
billing.on(QZPayBillingEvent.TRIAL_EXPIRED, async (event) => {
  const { subscription, customer, emailSentByPackage } = event;

  // Si no tenia metodo de pago, el subscription pasa a canceled
  // Si tenia metodo de pago, el package intenta cobrar

  const user = await db.query.users.findFirst({
    where: eq(users.id, customer.externalId),
  });

  if (user) {
    // hasPaymentMethod is a pre-calculated property
    const { hasPaymentMethod } = subscription;

    if (!hasPaymentMethod) {
      // Trial termino sin pago, enviar email de "vuelve"
      await sendEmail({
        to: user.email,
        template: 'hospeda-trial-expired-no-card',
        data: {
          userName: user.name,
          planName: subscription.getPlanName(),
          resubscribeUrl: `${process.env.APP_URL}/pricing`,
        },
      });

      // Downgrade a free
      await handleDowngradeToFree(customer.externalId);
    }
  }
});

// Cuando se cancela
billing.on(QZPayBillingEvent.SUBSCRIPTION_CANCELED, async (event) => {
  const { subscription, customer, reason, cancelAt, emailSentByPackage } = event;

  console.log(`Subscription canceled: ${subscription.id}, reason: ${reason}`);

  // Si la cancelacion es inmediata, despublicar propiedades extra
  if (!cancelAt) {
    await handleDowngradeToFree(customer.externalId);
  }

  // Tracking
  await analytics.track('subscription_canceled', {
    userId: customer.externalId,
    planId: subscription.planId,
    reason,
  });

  // Enviar encuesta de cancelacion
  const user = await db.query.users.findFirst({
    where: eq(users.id, customer.externalId),
  });

  if (user) {
    await sendEmail({
      to: user.email,
      template: 'hospeda-cancellation-survey',
      data: {
        userName: user.name,
        surveyUrl: `${process.env.APP_URL}/feedback/cancellation`,
      },
    });
  }
});

// ============================================
// EVENTOS DE CAMBIO DE PLAN
// ============================================
// IMPORTANTE: Cambios de plan disparan 2 eventos:
// 1. PLAN_CHANGED (siempre) - para tracking genérico
// 2. UNO de: UPGRADED, DOWNGRADED, o PLAN_LATERAL - específico

// Tracking genérico de todos los cambios de plan
billing.on(QZPayBillingEvent.PLAN_CHANGED, async (event) => {
  const { customer, oldPlanId, newPlanId, direction } = event;

  await analytics.track('plan_changed', {
    userId: customer.externalId,
    fromPlan: oldPlanId,
    toPlan: newPlanId,
    direction, // 'upgrade' | 'downgrade' | 'lateral'
  });
});

// Manejo específico de upgrades (se dispara JUNTO con PLAN_CHANGED)
billing.on(QZPayBillingEvent.SUBSCRIPTION_UPGRADED, async (event) => {
  const { subscription, customer, oldPlanId, newPlanId, proratedAmount } = event;

  // Celebrar el upgrade
  await sendEmail({
    to: customer.email,
    template: 'hospeda-upgrade-thank-you',
    data: {
      userName: customer.name,
      newPlanName: event.newPlanName,
      newFeatures: await getNewFeatures(oldPlanId, newPlanId),
    },
  });
});

// Manejo específico de downgrades (se dispara JUNTO con PLAN_CHANGED)
billing.on(QZPayBillingEvent.SUBSCRIPTION_DOWNGRADED, async (event) => {
  const { subscription, customer, oldPlanId, newPlanId, effectiveAt } = event;

  // Ofrecer descuento para retención
  await sendEmail({
    to: customer.email,
    template: 'hospeda-downgrade-offer',
    data: {
      userName: customer.name,
      discountCode: await generateRetentionDiscount(customer.id),
    },
  });

  // Programar el ajuste de límites para cuando se aplique el downgrade
  await scheduleDowngradeHandler(customer.externalId, newPlanId, effectiveAt);
});

// Manejo de cambios laterales (mismo precio, diferentes features)
billing.on(QZPayBillingEvent.SUBSCRIPTION_PLAN_LATERAL, async (event) => {
  const { customer, oldPlanName, newPlanName } = event;

  await sendEmail({
    to: customer.email,
    template: 'hospeda-plan-switch-confirmation',
    data: {
      userName: customer.name,
      oldPlan: oldPlanName,
      newPlan: newPlanName,
    },
  });
});

// ============================================
// EVENTOS DE PAGO
// ============================================

billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, async (event: QZPayPaymentSucceededEvent) => {
  const { payment, customer, invoice, emailSentByPackage } = event;

  console.log(`Payment succeeded: ${payment.id}, email sent: ${emailSentByPackage}`);

  // Si es un servicio one-time, procesar
  if (payment.metadata?.serviceId) {
    await processServicePurchase(payment);
  }

  // Tracking
  await analytics.track('payment_succeeded', {
    userId: customer.externalId,
    amount: payment.amount,
    currency: payment.currency,
    type: payment.subscriptionId ? 'subscription' : 'one_time',
  });
});

billing.on(QZPayBillingEvent.PAYMENT_FAILED, async (event) => {
  const { payment, customer, error, willRetry, emailSentByPackage } = event;

  console.log(`Payment failed: ${payment.id}, will retry: ${willRetry}`);

  // El package ya envio email si emailSentByPackage === true
  // Podemos enviar push notification adicional

  const user = await db.query.users.findFirst({
    where: eq(users.id, customer.externalId),
  });

  if (user) {
    await sendPushNotification(user.id, {
      title: 'Pago fallido',
      body: 'Tu pago no pudo procesarse. Actualiza tu metodo de pago.',
    });
  }
});

// ============================================
// EVENTOS DE PROMO CODE
// ============================================

billing.on(QZPayBillingEvent.PROMO_CODE_APPLIED, async (event) => {
  // code es el objeto QZPayPromoCode, discount es el monto del descuento
  const { code, customer, discount, emailSentByPackage } = event;

  await analytics.track('promo_code_applied', {
    userId: customer.externalId,
    promoCode: code.code, // code.code es el string del codigo (ej: "SUMMER20")
    discountAmount: discount,
  });
});

// ============================================
// HELPERS
// ============================================

async function handleDowngradeToFree(userId: string) {
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
    orderBy: (properties, { desc }) => [desc(properties.createdAt)],
  });

  const freePlan = HOSPEDA_PLANS.find(p => p.id === 'free')!;

  // Free plan solo permite maxProperties propiedades
  if (userProperties.length > freePlan.limits.maxProperties) {
    const toUnpublish = userProperties.slice(freePlan.limits.maxProperties);

    for (const property of toUnpublish) {
      await db.update(properties)
        .set({
          status: 'draft',
          isFeatured: false,
          featuredUntil: null,
        })
        .where(eq(properties.id, property.id));
    }

    // Notificar al usuario
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user) {
      await sendEmail({
        to: user.email,
        template: 'hospeda-properties-unpublished',
        data: {
          userName: user.name,
          unpublishedCount: toUnpublish.length,
          upgradeUrl: `${process.env.APP_URL}/pricing`,
        },
      });
    }
  }

  // Quitar featured de todas
  await db.update(properties)
    .set({
      isFeatured: false,
      featuredUntil: null,
    })
    .where(eq(properties.userId, userId));
}

async function handlePlanDowngrade(userId: string, newPlan: typeof HOSPEDA_PLANS[number]) {
  const userProperties = await db.query.properties.findMany({
    where: and(
      eq(properties.userId, userId),
      eq(properties.status, 'published')
    ),
    orderBy: (properties, { desc }) => [desc(properties.createdAt)],
  });

  // Si tiene mas propiedades publicadas de las permitidas
  if (
    newPlan.limits.maxProperties !== -1 &&
    userProperties.length > newPlan.limits.maxProperties
  ) {
    const toUnpublish = userProperties.slice(newPlan.limits.maxProperties);

    for (const property of toUnpublish) {
      await db.update(properties)
        .set({ status: 'draft' })
        .where(eq(properties.id, property.id));
    }
  }
}

async function processServicePurchase(payment: any) {
  const { serviceId, propertyId, duration } = payment.metadata || {};

  switch (serviceId) {
    case 'featured-week':
    case 'featured-month': {
      if (!propertyId) break;

      const days = duration === 'week' ? 7 : 30;
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + days);

      await db.update(properties)
        .set({
          isFeatured: true,
          featuredUntil,
        })
        .where(eq(properties.id, propertyId));

      break;
    }

    case 'photo-session':
    case 'copywriting':
    case 'setup-assistance': {
      await db.insert(serviceRequests).values({
        userId: payment.metadata.userId,
        propertyId,
        serviceType: serviceId,
        paymentId: payment.id,
        status: 'pending',
      });

      await notifyTeam('new_service_request', {
        serviceType: serviceId,
        userId: payment.metadata.userId,
        propertyId,
      });

      break;
    }
  }
}
```

### 3.3 Cron Jobs (Auto-registrados)

Los jobs se registran automaticamente. Solo necesitas configurar tu cron para llamar al endpoint:

```typescript
// vercel.json (ejemplo para Vercel Cron)
{
  "crons": [
    {
      "path": "/billing/jobs/run-due",
      "schedule": "0 * * * *"
    }
  ]
}
```

O en Cloudflare Workers:

```typescript
// wrangler.toml
[triggers]
crons = ["0 * * * *"]
```

```typescript
// src/worker.ts
export default {
  async fetch(request: Request, env: Env) {
    return app.fetch(request, env);
  },

  async scheduled(event: ScheduledEvent, env: Env) {
    // Llamar al endpoint de jobs
    await fetch(`${env.APP_URL}/billing/jobs/run-due`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
      },
    });
  },
};
```

---

## Parte 4: Frontend (React)

### 4.1 Provider Setup

```tsx
// src/app/providers.tsx
import { QZPayBillingProvider } from '@qazuor/qzpay-react';
import { useAuth } from '@clerk/clerk-react';

export function Providers({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useAuth();

  return (
    <QZPayBillingProvider
      apiUrl="/billing"
      customerId={userId || undefined}
      locale="es"
      currency="USD"
      stripePublishableKey={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
      getAuthHeaders={async () => {
        const token = await getToken();
        return {
          Authorization: `Bearer ${token}`,
        };
      }}
    >
      {children}
    </QZPayBillingProvider>
  );
}
```

### 4.2 Pagina de Pricing con Promo Codes

```tsx
// src/pages/pricing.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QZPayPricingTable,
  QZPayPromoCodeInput,
  useQZPayCheckout,
  useQZPaySubscription,
} from '@qazuor/qzpay-react';
import { useAuth } from '@clerk/clerk-react';
import { QZPayBillingInterval } from '@qazuor/qzpay-core';

export function PricingPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { createCheckout, isLoading } = useQZPayCheckout();
  const { subscription } = useQZPaySubscription();

  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount: number;
    type: string;
    description: string;
  } | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (!isSignedIn) {
      navigate(`/sign-in?redirect=/pricing&plan=${planId}`);
      return;
    }

    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }

    try {
      const response = await fetch('/api/subscribe', {
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
        // Necesita pagar, mostrar checkout
        await createCheckout({
          clientSecret: result.clientSecret,
          onComplete: () => {
            navigate('/dashboard?subscription=success');
          },
          onError: (error) => {
            console.error('Checkout error:', error);
          },
        });
      } else {
        // Trial sin tarjeta, ya esta creada la subscription
        navigate('/dashboard?trial=started');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  };

  const handleValidatePromo = async (code: string) => {
    const response = await fetch('/billing/promo-codes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        planId: 'pro', // Validar contra plan mas comun
        interval,
      }),
    });
    const result = await response.json();

    if (result.valid) {
      setPromoCode(code);
      setPromoResult({
        valid: true,
        discount: result.discountAmount,
        type: result.discountType,
        description: result.description, // ej: "20% de descuento"
      });
      return { valid: true };
    }

    return { valid: false, reason: result.reason };
  };

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <h1>Planes y Precios</h1>
        <p>Elige el plan perfecto para tus propiedades</p>

        {/* Toggle mensual/anual */}
        <div className="interval-toggle">
          <button
            className={interval === 'month' ? 'active' : ''}
            onClick={() => setInterval('month')}
          >
            Mensual
          </button>
          <button
            className={interval === 'year' ? 'active' : ''}
            onClick={() => setInterval('year')}
          >
            Anual
            <span className="discount-badge">-17%</span>
          </button>
        </div>
      </header>

      {/* Codigo promocional */}
      <div className="promo-section">
        <QZPayPromoCodeInput
          onValidate={handleValidatePromo}
          onRemove={() => {
            setPromoCode('');
            setPromoResult(null);
          }}
          placeholder="Tienes un codigo promocional?"
          appliedCode={promoCode}
          appliedResult={promoResult}
        />
      </div>

      {/* Info de promo aplicado */}
      {promoResult?.valid && (
        <div className="promo-applied-banner">
          <span className="promo-icon">🎉</span>
          <span>Codigo {promoCode} aplicado: {promoResult.description}</span>
        </div>
      )}

      {/* Tabla de precios */}
      <QZPayPricingTable
        apiUrl="/api/plans"
        interval={interval}
        currentPlanId={subscription?.planId}
        promoDiscount={promoResult?.valid ? promoResult.discount : undefined}
        promoType={promoResult?.type}
        onSelectPlan={handleSelectPlan}
        isLoading={isLoading}
        showTrialInfo
        trialText="14 dias de prueba gratis, sin tarjeta"
        features={{
          free: ['1 propiedad', 'Fotos basicas', 'Soporte email'],
          starter: ['3 propiedades', 'Fotos ilimitadas', 'Analytics basico'],
          pro: ['10 propiedades', '1 destacado/mes', 'Soporte prioritario'],
          business: ['Propiedades ilimitadas', 'API access', 'Multi-usuario'],
        }}
      />
    </div>
  );
}
```

### 4.3 Banner de Trial sin Tarjeta

```tsx
// src/components/TrialBanner.tsx
import { useQZPaySubscription } from '@qazuor/qzpay-react';
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';

export function TrialBanner() {
  const { subscription, loading } = useQZPaySubscription();

  if (loading || !subscription) return null;

  // Usar el metodo helper en vez de comparar string
  if (!subscription.isTrial()) return null;

  const daysRemaining = subscription.getTrialDaysRemaining();
  // hasPaymentMethod is a pre-calculated property, not a method
  const { hasPaymentMethod } = subscription;

  return (
    <div className={`trial-banner ${daysRemaining <= 3 ? 'urgent' : ''}`}>
      <div className="trial-info">
        <span className="trial-icon">🎁</span>
        <span className="trial-text">
          {daysRemaining > 0
            ? `Tu prueba gratuita termina en ${daysRemaining} dias`
            : 'Tu prueba gratuita termina hoy'
          }
        </span>
      </div>

      {!hasPaymentMethod && (
        <a href="/settings/billing?add-payment" className="add-payment-button">
          Agregar metodo de pago
        </a>
      )}
    </div>
  );
}
```

### 4.4 Pagina de Promo Codes en Admin

```tsx
// src/pages/admin/promo-codes.tsx
import { useState } from 'react';
import {
  QZPayAdminPromoCodeList,
  QZPayCreatePromoCodeForm,
} from '@qazuor/qzpay-react';
import { QZPayPromoCodeType, QZPayBillingInterval } from '@qazuor/qzpay-core';

export function AdminPromoCodesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="admin-promo-codes">
      <header>
        <h1>Codigos Promocionales</h1>
        <button onClick={() => setShowCreate(true)}>
          Crear Codigo
        </button>
      </header>

      <QZPayAdminPromoCodeList
        onDeactivate={async (codeId) => {
          await fetch(`/billing/admin/promo-codes/${codeId}/deactivate`, {
            method: 'POST',
          });
        }}
        onViewUsage={(codeId) => {
          // Navegar a detalle
        }}
      />

      {showCreate && (
        <QZPayCreatePromoCodeForm
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await fetch('/billing/admin/promo-codes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            setShowCreate(false);
          }}
          promoTypes={[
            { value: QZPayPromoCodeType.PERCENTAGE, label: 'Porcentaje' },
            { value: QZPayPromoCodeType.FIXED_AMOUNT, label: 'Monto fijo' },
            { value: QZPayPromoCodeType.FREE_PERIOD, label: 'Periodo gratis' },
            { value: QZPayPromoCodeType.REDUCED_PERIOD, label: 'Precio reducido' },
          ]}
          plans={[
            { value: 'starter', label: 'Starter' },
            { value: 'pro', label: 'Pro' },
            { value: 'business', label: 'Business' },
          ]}
          intervals={[
            { value: QZPayBillingInterval.MONTH, label: 'Mensual' },
            { value: QZPayBillingInterval.YEAR, label: 'Anual' },
          ]}
        />
      )}
    </div>
  );
}
```

---

## Parte 5: Flujos Completos

### 5.1 Flujo: Trial Sin Tarjeta

```
1. Usuario entra a /pricing
2. Ve los planes, elige "Pro" mensual
3. Click en "Comenzar prueba gratis"
4. Si no esta logueado → redirect a /sign-in
5. Despues de login → vuelve a /pricing
6. POST /api/subscribe con planId: 'pro', interval: 'month'
7. Backend detecta que trial.requiresPaymentMethod = false
8. Crea Subscription en estado 'trialing' SIN Stripe
9. Responde con requiresPayment: false
10. Usuario redirigido a /dashboard?trial=started
11. Evento TRIAL_STARTED emitido
12. Email de bienvenida enviado
13. Usuario tiene acceso completo a features de Pro

Dia 11 (3 dias antes):
14. Job detecta trial expiring
15. Evento TRIAL_EXPIRING emitido
16. HOSPEDA envia email custom (esta en suppress)
17. Email: "Tu trial termina en 3 dias, agrega tarjeta"

Dia 14 (ultimo dia):
18. Usuario agrega tarjeta en /settings/billing
19. POST /api/subscription/add-payment-method
20. Se crea Setup Session de Stripe
21. Usuario ingresa tarjeta
22. Stripe crea subscription real con trial hasta dia 14
23. Subscription actualizada con stripeSubscriptionId

Dia 15 (trial termina):
24. Stripe cobra automaticamente
25. Webhook: payment_intent.succeeded
26. Status cambia a 'active'
27. Usuario sigue con acceso

ALTERNATIVA - No agrega tarjeta:
18. Dia 14: Job detecta trial expired
19. Evento TRIAL_EXPIRED emitido
20. Status cambia a 'canceled'
21. HOSPEDA envia email "Tu trial termino, vuelve"
22. Propiedades extra despublicadas (downgrade a free)
```

### 5.2 Flujo: Aplicar Promo Code

```
1. Usuario en /pricing
2. Ingresa codigo "WELCOME20" en PromoCodeInput
3. POST /billing/promo-codes/validate
4. Backend valida:
   - Codigo existe y esta activo
   - No expiro
   - Usuario es nuevo (newCustomersOnly)
   - Plan elegido es valido (validPlans)
   - No excede maxUses
5. Responde con:
   - valid: true
   - discountAmount: 380 (20% de $19)
   - description: "20% de descuento"
6. UI muestra banner "Codigo WELCOME20 aplicado"
7. PricingTable muestra precios con descuento tachado
8. Usuario selecciona plan
9. POST /api/subscribe con promoCode: "WELCOME20"
10. Backend aplica descuento a checkout session
11. Evento PROMO_CODE_APPLIED emitido
12. promoCodeUsage creado en DB
13. usedCount incrementado
14. Usuario paga precio con descuento
```

---

## Resumen de Mejoras Implementadas

1. **Constantes/Enums**: Todos los comparisons usan `QZPaySubscriptionStatus.ACTIVE`, `QZPayBillingEvent.TRIAL_EXPIRED`, etc.

2. **Entitlements vs Limits**: Separados en interfaces distintas con tipado fuerte.

3. **Subscription Helpers**: `subscription.isActive()`, `subscription.getLimits()`, `subscription.hasPaymentMethod` (property), etc.

4. **Env Validation**: CLI genera `.env.example` y el package valida al iniciar.

5. **Customer-User Sync**: `billing.customers.syncUser()` maneja el linkeo automaticamente.

6. **Email Clarity**: `suppress` array define que emails maneja el proyecto, `emailSentByPackage` en eventos.

7. **Trials Sin Tarjeta**: `trial.requiresPaymentMethod: false` permite trials sin pedir tarjeta.

8. **Rutas Auto-registradas**: `createQZPayBillingRoutes()` registra todo automaticamente segun config.

9. **Jobs Auto-registrados**: Endpoint `/billing/jobs/run-due` para cron, lista en `/billing/jobs`.

10. **Promo Codes Completos**: Ejemplos de todos los tipos, validacion, aplicacion, tracking.

---

*Ejemplo actualizado para @qazuor/qzpay v2.0*
