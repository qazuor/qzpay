# Ejemplo Completo: Asist.IA

## Contexto de Asist.IA

Asist.IA es una plataforma SaaS de chatbots de IA. El modelo de negocio incluye:

- **Suscripciones**: Mensual/anual para acceso a la plataforma
- **Planes**: Free, Starter, Pro, Enterprise
- **Usage-based billing**: Cobro por mensajes procesados (overage)
- **Bots adicionales**: Compra de bots extra sobre el limite del plan
- **Plugins**: Add-ons para funcionalidades extra
- **Servicios one-time**: Configuracion inicial, entrenamiento personalizado
- **Trials**: 14 dias gratis SIN necesidad de tarjeta

### Tech Stack de Asist.IA

- **Framework**: NestJS
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle
- **Auth**: Better Auth
- **Queue**: BullMQ (Redis)
- **Frontend**: React (Next.js)

---

## Parte 1: Setup Inicial

### 1.1 Instalacion

```bash
# Backend
pnpm add @qazuor/qzpay-core @qazuor/qzpay-stripe @qazuor/qzpay-mercadopago @qazuor/qzpay-drizzle @qazuor/qzpay-nestjs

# Frontend
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
# Redis (para BullMQ)
# REDIS_URL=redis://localhost:6379  # Required
#
# App
# APP_URL=http://localhost:3000
```

**.env completo:**

```env
# .env
DATABASE_URL=postgres://user:pass@neon.tech/asistia

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# Redis (para BullMQ)
REDIS_URL=redis://localhost:6379

# App
APP_URL=https://asist.ia
```

### 1.3 Schema de Base de Datos

```typescript
// src/db/schema/index.ts
import { pgTable, uuid, varchar, timestamp, boolean, integer, text, jsonb, decimal } from 'drizzle-orm/pg-core';

// ============================================
// TABLAS DE LA APP (propias de Asist.IA)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 50 }).default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bots = pgTable('bots', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt'),
  model: varchar('model', { length: 100 }).default('gpt-4'),
  temperature: decimal('temperature', { precision: 3, scale: 2 }).default('0.7'),
  maxTokens: integer('max_tokens').default(2000),
  isActive: boolean('is_active').default(true),
  widgetConfig: jsonb('widget_config').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const botPlugins = pgTable('bot_plugins', {
  id: uuid('id').primaryKey().defaultRandom(),
  botId: uuid('bot_id').notNull().references(() => bots.id),
  pluginId: varchar('plugin_id', { length: 100 }).notNull(),
  config: jsonb('config').default({}),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  botId: uuid('bot_id').notNull().references(() => bots.id),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  visitorId: varchar('visitor_id', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  role: varchar('role', { length: 50 }).notNull(), // user, assistant, system
  content: text('content').notNull(),
  tokensUsed: integer('tokens_used'),
  cost: decimal('cost', { precision: 10, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Tracking de uso mensual por organizacion
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  messagesCount: integer('messages_count').default(0),
  tokensUsed: integer('tokens_used').default(0),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// TABLAS DE BILLING (generadas por @qazuor/qzpay-drizzle)
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
 * Entitlements especificos de Asist.IA (features booleanas)
 */
export interface AsistiaEntitlements extends QZPayEntitlements {
  canAccessAnalytics: boolean;
  canAccessPrioritySupport: boolean;
  canUseCalendarSync: boolean;
  canUseApi: boolean;
  canUseCustomBranding: boolean;
  canInviteTeamMembers: boolean;
  canUseDedicatedSupport: boolean;
  canUseSla: boolean;
}

/**
 * Limits especificos de Asist.IA (restricciones numericas)
 * -1 significa ilimitado
 */
export interface AsistiaLimits extends QZPayLimits {
  maxBots: number;
  maxMessagesPerMonth: number;
  maxSeats: number;
  maxPlugins: number;
}

/**
 * Planes de Asist.IA
 */
export const ASISTIA_PLANS: QZPayPlanDefinition<AsistiaEntitlements, AsistiaLimits>[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Para probar la plataforma',
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
      canUseDedicatedSupport: false,
      canUseSla: false,
    },
    limits: {
      maxBots: 1,
      maxMessagesPerMonth: 100,
      maxSeats: 1,
      maxPlugins: 0, // Solo plugins basicos
    },
    trial: null,
    displayFeatures: [
      '1 bot',
      '100 mensajes/mes',
      'Widget basico',
      'Soporte por email',
    ],
  },

  {
    id: 'starter',
    name: 'Starter',
    description: 'Para pequenos negocios',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 2900, currency: 'USD' }, // $29.00
      [QZPayBillingInterval.YEAR]: { amount: 29000, currency: 'USD' }, // $290.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: false,
      canUseCalendarSync: false,
      canUseApi: false,
      canUseCustomBranding: false,
      canInviteTeamMembers: false,
      canUseDedicatedSupport: false,
      canUseSla: false,
    },
    limits: {
      maxBots: 3,
      maxMessagesPerMonth: 2000,
      maxSeats: 2,
      maxPlugins: 3, // faq, forms, calendar
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false, // NO requiere tarjeta!
    },
    // Usage-based billing (hybrid architecture)
    // See PDR.md Section 3.2.1 - FR-USAGE-003
    usage: {
      messages: {
        included: 2000,
        overageRate: 2,        // $0.02 per message over limit
        unit: 1,
        limitType: 'soft',     // Allow overage, bill at overageRate
        displayName: 'Messages',
      },
      llm_tokens: {
        included: 100000,
        overageRate: 1,        // $0.01 per 1000 tokens over limit
        unit: 1000,
        limitType: 'soft',
        displayName: 'AI Tokens',
      },
    },
    displayFeatures: [
      '3 bots',
      '2,000 mensajes/mes',
      'Widget personalizable',
      'Plugins basicos',
      'Analytics basico',
      'Soporte por email',
    ],
  },

  {
    id: 'pro',
    name: 'Pro',
    description: 'Para empresas en crecimiento',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 9900, currency: 'USD' }, // $99.00
      [QZPayBillingInterval.YEAR]: { amount: 99000, currency: 'USD' }, // $990.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUseCalendarSync: true,
      canUseApi: true,
      canUseCustomBranding: true,
      canInviteTeamMembers: true,
      canUseDedicatedSupport: false,
      canUseSla: false,
    },
    limits: {
      maxBots: 10,
      maxMessagesPerMonth: 10000,
      maxSeats: 5,
      maxPlugins: -1, // Todos los plugins
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    // Usage-based billing (hybrid architecture)
    usage: {
      messages: {
        included: 10000,
        overageRate: 15,       // $0.015 per message over limit (1.5 cents)
        unit: 10,              // Charge per 10 messages
        limitType: 'none',     // No hard limit, just bill overage
        displayName: 'Messages',
      },
      llm_tokens: {
        included: 500000,
        overageRate: 5,        // $0.005 per 1000 tokens
        unit: 1000,
        limitType: 'none',
        displayName: 'AI Tokens',
      },
      api_calls: {
        included: 50000,
        overageRate: 10,       // $0.10 per 1000 API calls
        unit: 1000,
        limitType: 'soft',
        displayName: 'API Calls',
      },
    },
    isFeatured: true,
    badgeText: 'Mas popular',
    displayFeatures: [
      '10 bots',
      '10,000 mensajes/mes',
      'Widget 100% personalizable',
      'Todos los plugins',
      'Analytics avanzado',
      'API access',
      'Soporte prioritario',
      '5 usuarios',
    ],
  },

  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para grandes organizaciones',
    prices: {
      [QZPayBillingInterval.MONTH]: { amount: 49900, currency: 'USD' }, // $499.00
      [QZPayBillingInterval.YEAR]: { amount: 499000, currency: 'USD' }, // $4990.00
    },
    entitlements: {
      canAccessAnalytics: true,
      canAccessPrioritySupport: true,
      canUseCalendarSync: true,
      canUseApi: true,
      canUseCustomBranding: true,
      canInviteTeamMembers: true,
      canUseDedicatedSupport: true,
      canUseSla: true,
    },
    limits: {
      maxBots: -1, // ilimitado
      maxMessagesPerMonth: 100000,
      maxSeats: -1, // ilimitado
      maxPlugins: -1,
    },
    trial: {
      days: 14,
      requiresPaymentMethod: false,
    },
    overage: {
      messagesPrice: 1, // $0.01 por mensaje extra
    },
    displayFeatures: [
      'Bots ilimitados',
      '100,000 mensajes/mes',
      'White-label completo',
      'Todos los plugins + custom',
      'Analytics + exportacion',
      'API ilimitada',
      'Soporte dedicado 24/7',
      'Usuarios ilimitados',
      'SLA garantizado',
      'Entrenamiento incluido',
    ],
  },
];

export type AsistiaPlanId = typeof ASISTIA_PLANS[number]['id'];
```

### 2.2 Definicion de Add-ons y Servicios

```typescript
// src/config/addons.ts
import { QZPayCurrency } from '@qazuor/qzpay-core';

// Add-ons de suscripcion (cobro mensual recurrente)
export const SUBSCRIPTION_ADDONS = {
  extraBots: {
    id: 'extra-bots',
    name: 'Bots adicionales',
    description: 'Agrega mas bots a tu plan',
    pricePerUnit: 1500, // $15/mes por bot extra (en centavos)
    currency: QZPayCurrency.USD,
    unit: 'bot',
  },

  extraMessages: {
    id: 'extra-messages-pack',
    name: 'Pack de mensajes',
    description: 'Pack de 5,000 mensajes adicionales',
    pricePerUnit: 4900, // $49/mes por pack
    currency: QZPayCurrency.USD,
    unit: 'pack',
    messagesPerPack: 5000,
  },

  extraSeats: {
    id: 'extra-seats',
    name: 'Usuarios adicionales',
    description: 'Mas usuarios en tu organizacion',
    pricePerUnit: 1000, // $10/mes por usuario
    currency: QZPayCurrency.USD,
    unit: 'usuario',
  },

  prioritySupport: {
    id: 'priority-support',
    name: 'Soporte prioritario',
    description: 'Respuesta en menos de 4 horas',
    pricePerUnit: 4900, // $49/mes
    currency: QZPayCurrency.USD,
    unit: 'mes',
    requiredPlan: ['free', 'starter'], // Solo para planes que no lo incluyen
  },
} as const;
```

### 2.3 Definicion de Plugins

```typescript
// src/config/plugins.ts

export const PLUGINS = {
  faq: {
    id: 'plugin-faq',
    name: 'FAQ Automatico',
    description: 'Responde preguntas frecuentes automaticamente',
    price: 0, // Incluido en Starter+
    includedIn: ['starter', 'pro', 'enterprise'],
  },

  forms: {
    id: 'plugin-forms',
    name: 'Formularios',
    description: 'Captura datos con formularios en el chat',
    price: 0,
    includedIn: ['starter', 'pro', 'enterprise'],
  },

  calendar: {
    id: 'plugin-calendar',
    name: 'Agenda de citas',
    description: 'Integracion con Google Calendar / Calendly',
    price: 0,
    includedIn: ['starter', 'pro', 'enterprise'],
  },

  crm: {
    id: 'plugin-crm',
    name: 'Integracion CRM',
    description: 'Conecta con HubSpot, Salesforce, etc.',
    price: 1900, // $19/mes
    includedIn: ['pro', 'enterprise'],
  },

  ecommerce: {
    id: 'plugin-ecommerce',
    name: 'E-commerce',
    description: 'Integracion con Shopify, WooCommerce',
    price: 2900, // $29/mes
    includedIn: ['pro', 'enterprise'],
  },

  whatsapp: {
    id: 'plugin-whatsapp',
    name: 'WhatsApp Business',
    description: 'Conecta tu bot a WhatsApp',
    price: 4900, // $49/mes
    includedIn: ['enterprise'],
  },

  telegram: {
    id: 'plugin-telegram',
    name: 'Telegram',
    description: 'Conecta tu bot a Telegram',
    price: 1900, // $19/mes
    includedIn: ['pro', 'enterprise'],
  },

  slack: {
    id: 'plugin-slack',
    name: 'Slack',
    description: 'Usa tu bot en canales de Slack',
    price: 2900, // $29/mes
    includedIn: ['pro', 'enterprise'],
  },

  customTraining: {
    id: 'plugin-custom-training',
    name: 'Entrenamiento personalizado',
    description: 'Entrena tu bot con tus documentos',
    price: 9900, // $99/mes
    includedIn: ['enterprise'],
  },
} as const;

export type PluginId = keyof typeof PLUGINS;
```

### 2.4 Definicion de Promo Codes

```typescript
// src/config/promo-codes.ts
// Use QZPayPromoCodeType for promo codes (manual codes entered by customers)
import { QZPayPromoCodeType, QZPayBillingInterval } from '@qazuor/qzpay-core';

/**
 * Ejemplos de promo codes que Asist.IA puede crear via admin
 */
export const PROMO_CODE_EXAMPLES = {
  // Descuento porcentual para nuevos usuarios
  WELCOME30: {
    code: 'WELCOME30',
    type: QZPayPromoCodeType.PERCENTAGE,
    value: 30, // 30% de descuento
    config: {},
    restrictions: {
      maxUses: 500,
      maxUsesPerCustomer: 1,
      newCustomersOnly: true,
      validPlans: ['starter', 'pro', 'enterprise'],
      expiresAt: new Date('2025-12-31'),
    },
  },

  // Monto fijo para plan Pro
  PRO25OFF: {
    code: 'PRO25OFF',
    type: QZPayPromoCodeType.FIXED_AMOUNT,
    value: 2500, // $25 de descuento
    config: { currency: 'USD' },
    restrictions: {
      validPlans: ['pro'],
      minAmount: 9900, // Minimo $99 de compra
    },
  },

  // Primer mes gratis
  FREEMONTH: {
    code: 'FREEMONTH',
    type: QZPayPromoCodeType.FREE_PERIOD,
    value: 1, // 1 periodo gratis
    config: {},
    restrictions: {
      validIntervals: [QZPayBillingInterval.MONTH],
      newCustomersOnly: true,
    },
  },

  // Extension de trial (+7 dias)
  TRIAL7EXTRA: {
    code: 'TRIAL7EXTRA',
    type: QZPayPromoCodeType.TRIAL_EXTENSION,
    value: 7, // 7 dias extra de trial
    config: {},
    restrictions: {
      maxUses: 1000,
    },
  },

  // 3 meses al 50%
  STARTUP50: {
    code: 'STARTUP50',
    type: QZPayPromoCodeType.REDUCED_PERIOD,
    value: 50, // 50% de descuento
    config: {
      periods: 3, // Por 3 periodos
    },
    restrictions: {
      newCustomersOnly: true,
    },
  },
};
```

### 2.4.2 Descuentos Automaticos (Auto-Applied)

```typescript
// src/config/automatic-discounts.ts
// Use QZPayAutomaticDiscountType for automatic discounts (system-applied based on conditions)
import { QZPayAutomaticDiscountType, QZPayDayOfWeek, type QZPayAutomaticDiscount } from '@qazuor/qzpay-core';

/**
 * Descuentos que se aplican automaticamente
 * Ideal para SaaS con descuentos por uso/volumen
 */
export const ASISTIA_AUTOMATIC_DISCOUNTS: Record<string, QZPayAutomaticDiscount> = {
  // 10% para clientes con 3+ bots activos
  multiBotDiscount: {
    id: 'multi-bot-10',
    name: '10% por tener 3+ bots',
    description: 'Descuento automatico por volumen de bots',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 10,
    conditions: {
      minQuantity: 3, // 3+ bots activos
    },
    appliesTo: 'subscription',
    stackable: true,
    priority: 1,
  },

  // 15% para clientes con alto volumen de mensajes
  highVolumeDiscount: {
    id: 'high-volume-15',
    name: '15% por alto volumen',
    description: 'Premiamos tu crecimiento',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 15,
    conditions: {
      usageThreshold: {
        metric: 'monthlyMessages',
        minValue: 50000, // 50k+ mensajes/mes
      },
    },
    appliesTo: 'subscription',
    stackable: true,
    priority: 2,
  },

  // Primer mes gratis al subir a Agency
  agencyUpgrade: {
    id: 'agency-first-month-free',
    name: 'Primer mes gratis en Agency',
    description: 'Prueba Agency sin compromiso',
    type: QZPayAutomaticDiscountType.FREE_PERIOD,
    value: 1, // 1 periodo gratis
    conditions: {
      isUpgrade: true,
      fromPlans: ['starter', 'professional'],
      toPlans: ['agency'],
    },
    appliesTo: 'subscription',
    stackable: false,
    priority: 1,
    maxRedemptionsPerCustomer: 1,
  },

  // Descuento para nuevos usuarios
  welcomeDiscount: {
    id: 'welcome-20',
    name: '20% bienvenida',
    description: 'Bienvenido a Asist.IA',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 20,
    conditions: {
      isFirstPurchase: true,
    },
    appliesTo: 'subscription',
    stackable: false,
    priority: 3,
    validUntil: new Date('2025-12-31'),
  },

  // Happy hour en servicios one-time
  serviceHappyHour: {
    id: 'service-happy-hour',
    name: '25% en servicios (horario especial)',
    description: 'Descuento especial de 14-16hs',
    type: QZPayAutomaticDiscountType.PERCENTAGE,
    value: 25,
    conditions: {
      schedule: {
        hours: { from: 14, to: 16 },
        days: [QZPayDayOfWeek.MONDAY, QZPayDayOfWeek.TUESDAY, QZPayDayOfWeek.WEDNESDAY, QZPayDayOfWeek.THURSDAY, QZPayDayOfWeek.FRIDAY],
        timezone: 'America/Argentina/Buenos_Aires',
      },
    },
    appliesTo: 'one-time', // Solo servicios, no suscripciones
    stackable: false,
    priority: 1,
  },
};
```

### 2.5 Servicios One-Time

```typescript
// src/config/services.ts
import { QZPayCurrency } from '@qazuor/qzpay-core';

export const ONE_TIME_SERVICES = {
  setupBasic: {
    id: 'setup-basic',
    name: 'Configuracion basica',
    description: 'Te ayudamos a configurar tu primer bot',
    price: 9900, // $99
    currency: QZPayCurrency.USD,
  },

  setupAdvanced: {
    id: 'setup-advanced',
    name: 'Configuracion avanzada',
    description: 'Configuracion completa + integracion CRM',
    price: 29900, // $299
    currency: QZPayCurrency.USD,
  },

  customTraining: {
    id: 'custom-training-session',
    name: 'Sesion de entrenamiento',
    description: '2 horas de entrenamiento personalizado',
    price: 19900, // $199
    currency: QZPayCurrency.USD,
  },

  customDevelopment: {
    id: 'custom-development',
    name: 'Desarrollo a medida',
    description: 'Plugin o integracion personalizada (por hora)',
    price: 15000, // $150 por hora
    currency: QZPayCurrency.USD,
    unit: 'hora',
  },

  dataMigration: {
    id: 'data-migration',
    name: 'Migracion de datos',
    description: 'Migramos tus datos desde otra plataforma',
    price: 49900, // $499
    currency: QZPayCurrency.USD,
  },
} as const;
```

### 2.6 Modulo de Billing en NestJS

```typescript
// src/billing/billing.module.ts
import { Module, Global } from '@nestjs/common';
import { QZPayBillingModule } from '@qazuor/qzpay-nestjs';
import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayResendAdapter } from '@qazuor/qzpay-resend';
import { DrizzleService } from '../drizzle/drizzle.service';
import { ConfigService } from '@nestjs/config';
import { BillingEventsService } from './billing-events.service';
import { UsageService } from './usage.service';
import {
  QZPayCurrency,
  QZPayCheckoutMode,
  QZPayNotificationMode,
  QZPayBillingEvent,
  QZPayDiscountStackingMode,
} from '@qazuor/qzpay-core';
import {
  ASISTIA_PLANS,
  type AsistiaEntitlements,
  type AsistiaLimits,
} from '../config/plans';
import { ASISTIA_AUTOMATIC_DISCOUNTS } from '../config/automatic-discounts';

@Global()
@Module({
  imports: [
    QZPayBillingModule.forRootAsync<AsistiaEntitlements, AsistiaLimits>({
      inject: [DrizzleService, ConfigService],
      useFactory: (drizzle: DrizzleService, config: ConfigService) => ({
        projectId: 'asistia',

        storage: createQZPayDrizzleStorage(drizzle.db, {
          tablePrefix: 'billing_',
        }),

        plans: ASISTIA_PLANS,

        // Descuentos automaticos
        automaticDiscounts: ASISTIA_AUTOMATIC_DISCOUNTS,

        // Reglas de combinacion
        discountStacking: {
          mode: QZPayDiscountStackingMode.ALL_STACKABLE,
          maxStackedDiscounts: 2,
        },

        paymentAdapters: {
          stripe: createQZPayStripeAdapter({
            secretKey: config.get('STRIPE_SECRET_KEY')!,
            webhookSecret: config.get('STRIPE_WEBHOOK_SECRET')!,
          }),
          mercadopago: createQZPayMercadoPagoAdapter({
            accessToken: config.get('MP_ACCESS_TOKEN')!,
          }),
        },

        emailAdapter: createQZPayResendAdapter({
          apiKey: config.get('RESEND_API_KEY')!,
          from: 'Asist.IA <billing@asist.ia>',
        }),

        notifications: {
          mode: QZPayNotificationMode.HYBRID,
          templates: {
            [QZPayBillingEvent.SUBSCRIPTION_CREATED]: 'asistia-welcome',
            [QZPayBillingEvent.PAYMENT_SUCCEEDED]: 'asistia-payment-success',
            [QZPayBillingEvent.TRIAL_STARTED]: 'asistia-trial-started',
          },
          // Estos eventos: Asist.IA los maneja, package NO envia email
          suppress: [
            QZPayBillingEvent.TRIAL_EXPIRING,
            QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
            QZPayBillingEvent.USAGE_LIMIT_WARNING,
          ],
        },

        currency: {
          base: QZPayCurrency.USD,
          strategy: 'provider',
        },

        subscriptions: {
          gracePeriodDays: 5,
          retryAttempts: 4,
          retryIntervalHours: 24,
          trialReminderDays: [7, 3, 1],
          expirationWarningDays: [7, 3, 1],
        },

        checkout: {
          mode: QZPayCheckoutMode.EMBEDDED,
        },
      }),
    }),
  ],
  providers: [BillingEventsService, UsageService],
  exports: [UsageService],
})
export class QZPayBillingModule {}
```

### 2.7 Servicio de Uso (Usage Tracking - Hybrid Architecture)

> **Arquitectura Hibrida** (See PDR.md Section 3.2.1):
> - **Asist.IA (este proyecto)**: Tracking en tiempo real en Redis (rapido)
> - **qzpay**: Almacena uso reportado, calcula overages, genera facturas

```typescript
// src/billing/usage.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QZPAY_BILLING } from '@qazuor/qzpay-nestjs';
import { QZPayBillingSystem } from '@qazuor/qzpay-core';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  ASISTIA_PLANS,
  type AsistiaEntitlements,
  type AsistiaLimits,
} from '../config/plans';

@Injectable()
export class UsageService {
  constructor(
    @Inject(QZPAY_BILLING) private readonly billing: QZPayBillingSystem<AsistiaEntitlements, AsistiaLimits>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ============================================================
  // REAL-TIME TRACKING (in Redis - fast, low latency)
  // This is Asist.IA's responsibility, NOT qzpay's
  // ============================================================

  /**
   * Track message usage in real-time.
   * Called every time a user sends a message.
   * See PDR.md US-USAGE-001 for specification.
   */
  async trackMessage(organizationId: string, tokensUsed: number): Promise<void> {
    const period = this.getCurrentPeriodKey();
    const messageKey = `usage:${organizationId}:messages:${period}`;
    const tokenKey = `usage:${organizationId}:llm_tokens:${period}`;

    // Increment counters in Redis (fast, atomic)
    const [messagesCount] = await this.redis.multi()
      .incr(messageKey)
      .incrby(tokenKey, tokensUsed)
      .exec();

    // Check limits in real-time (optional, for hard limits)
    await this.checkRealTimeLimits(organizationId, 'messages', Number(messagesCount));
  }

  /**
   * Track API call usage in real-time.
   */
  async trackApiCall(organizationId: string): Promise<void> {
    const period = this.getCurrentPeriodKey();
    const key = `usage:${organizationId}:api_calls:${period}`;
    await this.redis.incr(key);
  }

  /**
   * Get current usage from Redis for UI display.
   * Returns instantly (no qzpay call needed).
   */
  async getCurrentUsage(organizationId: string): Promise<{
    messages: number;
    llm_tokens: number;
    api_calls: number;
  }> {
    const period = this.getCurrentPeriodKey();

    const [messages, llm_tokens, api_calls] = await this.redis.mget(
      `usage:${organizationId}:messages:${period}`,
      `usage:${organizationId}:llm_tokens:${period}`,
      `usage:${organizationId}:api_calls:${period}`,
    );

    return {
      messages: parseInt(messages || '0', 10),
      llm_tokens: parseInt(llm_tokens || '0', 10),
      api_calls: parseInt(api_calls || '0', 10),
    };
  }

  /**
   * Check limits in real-time for hard limits.
   * For soft limits, just display warning but allow operation.
   */
  private async checkRealTimeLimits(
    organizationId: string,
    metric: string,
    currentValue: number,
  ): Promise<void> {
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(organizationId);
    if (!subscription) return;

    const plan = subscription.getPlan();
    const usageConfig = plan.usage?.[metric];
    if (!usageConfig) return;

    const { included, limitType } = usageConfig;

    // For hard limits, block operation when exceeded
    if (limitType === 'hard' && currentValue > included) {
      throw new UsageLimitExceededError(metric, included, currentValue);
    }

    // For soft limits, we allow but could show UI warning
    // The actual overage charge happens when reported to qzpay
  }

  // ============================================================
  // PERIODIC REPORTING TO QZPAY (for billing)
  // This syncs our real-time data to qzpay for overage calculation
  // See PDR.md FR-USAGE-001, US-USAGE-002
  // ============================================================

  /**
   * Report usage to qzpay every hour.
   * qzpay will calculate overages at period end and bill the customer.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async reportUsageToQZPay(): Promise<void> {
    const activeSubscriptions = await this.billing.subscriptions.list({
      status: ['active', 'trialing'],
    });

    for (const subscription of activeSubscriptions) {
      try {
        const organizationId = subscription.customer.externalId;
        const usage = await this.getCurrentUsage(organizationId);
        const period = this.getCurrentPeriodKey();

        // Report to qzpay for billing (See PDR.md FR-USAGE-001)
        await this.billing.usage.report(subscription.id, [
          {
            metric: 'messages',
            quantity: usage.messages,
            idempotencyKey: `${subscription.id}:messages:${period}:hourly`,
          },
          {
            metric: 'llm_tokens',
            quantity: usage.llm_tokens,
            idempotencyKey: `${subscription.id}:llm_tokens:${period}:hourly`,
          },
          {
            metric: 'api_calls',
            quantity: usage.api_calls,
            idempotencyKey: `${subscription.id}:api_calls:${period}:hourly`,
          },
        ]);
      } catch (error) {
        // Log error but continue with other subscriptions
        console.error(`Failed to report usage for ${subscription.id}:`, error);
      }
    }
  }

  /**
   * Get usage summary from qzpay for billing dashboard.
   * Shows current period usage with overage calculations.
   */
  async getUsageSummary(subscriptionId: string) {
    // This calls qzpay's usage.get() (See PDR.md FR-USAGE-002)
    return this.billing.usage.get(subscriptionId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getCurrentPeriodKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Custom error for hard limits
export class UsageLimitExceededError extends Error {
  constructor(
    public readonly metric: string,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(`Usage limit exceeded for ${metric}: ${current}/${limit}`);
  }
}
```

> **Nota**: El codigo anterior de `recordOverage()` y `getUsage()` ha sido reemplazado por la arquitectura hibrida. Ahora:
> - `trackMessage()` usa Redis para tracking en tiempo real
> - `reportUsageToQZPay()` sincroniza con qzpay cada hora para billing
> - `getUsageSummary()` obtiene datos de qzpay para el dashboard de facturacion
> - Los overages se calculan automaticamente en qzpay al final del periodo

### 2.8 Verificacion de Limites de Bots

```typescript
// src/billing/bot-limits.service.ts

/**
 * Obtener cantidad de bots de una organizacion.
 * RESPONSABILIDAD DEL PROYECTO: tracking de recursos.
 */
async getBotCount(organizationId: string): Promise<number> {
  const result = await this.drizzle.db
    .select({ count: sql<number>`count(*)` })
    .from(bots)
    .where(eq(bots.organizationId, organizationId));

  return result[0]?.count || 0;
}

/**
 * Verificar si puede crear mas bots usando el nuevo checkLimit API.
 *
 * ARQUITECTURA HIBRIDA:
 * - Proyecto: tracking de recursos (getBotCount)
 * - Paquete: comparacion con limites del plan (checkLimit)
 */
async canCreateBot(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
  percentUsed?: number;
}> {
  const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(organizationId);

  // Sin suscripcion = plan free
  if (!subscription) {
    const freePlan = ASISTIA_PLANS.find(p => p.id === 'free')!;
    const currentCount = await this.getBotCount(organizationId);
    const limit = freePlan.limits.maxBots;

    if (limit === -1) return { allowed: true };
    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Has alcanzado el limite de ${limit} bots del plan gratuito. Actualiza tu plan para crear mas.`,
        remaining: 0,
        percentUsed: 100,
      };
    }
    return {
      allowed: true,
      remaining: limit - currentCount,
      percentUsed: Math.round((currentCount / limit) * 100),
    };
  }

  // Verificar si esta en estado de overage (despues de downgrade)
  if (subscription.hasOverage()) {
    const details = subscription.getOverageDetails();
    if (details?.affectedLimits.includes('maxBots')) {
      return {
        allowed: false,
        reason: `No puedes crear nuevos bots mientras estas sobre el limite. Tienes ${details.graceDaysRemaining} dias para reducir de ${details.metrics.maxBots?.current} a ${details.metrics.maxBots?.limit}.`,
        remaining: 0,
        percentUsed: 100,
      };
    }
  }

  // Obtener conteo actual (responsabilidad del proyecto)
  const currentCount = await this.getBotCount(organizationId);

  // Verificar add-ons de bots extra
  const extraBots = await this.billing.subscriptions.getAddonQuantity(subscription.id, 'extra-bots');
  const effectiveCount = currentCount; // No sumamos los extras al conteo, son parte del limite

  // USAR checkLimit del paquete (responsabilidad del paquete)
  // El proyecto proporciona el conteo, el paquete lo compara con el plan
  const limitCheck = subscription.checkLimit({
    limitKey: 'maxBots',
    currentCount: effectiveCount,
    increment: 1,
  });

  // Ajustar por add-ons (el limite base + extras)
  if (extraBots > 0 && !limitCheck.allowed) {
    // Recalcular con limite extendido
    const extendedLimit = limitCheck.limit + extraBots;
    if (effectiveCount < extendedLimit) {
      return {
        allowed: true,
        remaining: extendedLimit - effectiveCount,
        percentUsed: Math.round((effectiveCount / extendedLimit) * 100),
      };
    }
  }

  if (!limitCheck.allowed) {
    const totalLimit = limitCheck.limit + extraBots;
    return {
      allowed: false,
      reason: `Has alcanzado el limite de ${totalLimit} bots. Actualiza tu plan o compra bots adicionales.`,
      remaining: 0,
      percentUsed: 100,
    };
  }

  return {
    allowed: true,
    remaining: limitCheck.remaining,
    percentUsed: limitCheck.percentUsed,
  };
}

/**
 * Verificar impacto de downgrade en bots.
 * Llamar ANTES de confirmar downgrade para mostrar warning.
 */
async checkDowngradeImpact(organizationId: string, newPlanId: string): Promise<{
  hasImpact: boolean;
  affectedResources: {
    bots?: { current: number; newLimit: number; overage: number };
    seats?: { current: number; newLimit: number; overage: number };
  };
  message?: string;
}> {
  const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(organizationId);

  if (!subscription) {
    return { hasImpact: false, affectedResources: {} };
  }

  // Obtener conteos actuales (responsabilidad del proyecto)
  const currentBots = await this.getBotCount(organizationId);
  const currentSeats = await this.getSeatCount(organizationId);

  // Usar checkOverage del paquete para detectar impacto
  const overage = subscription.checkOverage({
    newPlanId,
    currentCounts: {
      maxBots: currentBots,
      maxSeats: currentSeats,
    },
  });

  if (!overage.hasOverage) {
    return { hasImpact: false, affectedResources: {} };
  }

  const affectedResources: typeof result['affectedResources'] = {};

  if (overage.metrics.maxBots?.overage > 0) {
    affectedResources.bots = {
      current: overage.metrics.maxBots.current,
      newLimit: overage.metrics.maxBots.limit,
      overage: overage.metrics.maxBots.overage,
    };
  }

  if (overage.metrics.maxSeats?.overage > 0) {
    affectedResources.seats = {
      current: overage.metrics.maxSeats.current,
      newLimit: overage.metrics.maxSeats.limit,
      overage: overage.metrics.maxSeats.overage,
    };
  }

  const messages: string[] = [];
  if (affectedResources.bots) {
    messages.push(`${affectedResources.bots.overage} bots sobre el limite`);
  }
  if (affectedResources.seats) {
    messages.push(`${affectedResources.seats.overage} asientos sobre el limite`);
  }

  return {
    hasImpact: true,
    affectedResources,
    message: `Este cambio afectara: ${messages.join(', ')}. Tendras 7 dias para reducir.`,
  };
}

/**
 * Verificar si tiene acceso a un plugin (entitlement check).
 */
async hasPluginAccess(organizationId: string, pluginId: string): Promise<boolean> {
  const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(organizationId);

  const planId = subscription?.planId || 'free';

  // Verificar si el plugin esta incluido en el plan
  const plugin = PLUGINS[pluginId as keyof typeof PLUGINS];
  if (!plugin) return false;

  if (plugin.includedIn.includes(planId)) {
    return true;
  }

  // Verificar si compro el plugin como add-on
  if (subscription) {
    const hasAddon = await this.billing.subscriptions.hasAddon(subscription.id, pluginId);
    return hasAddon;
  }

  return false;
}

/**
 * Verificar entitlement usando helper del paquete.
 */
async checkFeatureAccess(organizationId: string, feature: string): Promise<boolean> {
  const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(organizationId);

  if (!subscription) {
    // Sin suscripcion, verificar features del plan free
    const freePlan = ASISTIA_PLANS.find(p => p.id === 'free')!;
    return freePlan.entitlements[feature] === true;
  }

  // Usar hasEntitlement del paquete
  return subscription.hasEntitlement(feature);
}
}
```

### 2.8 Event Handlers (con constantes, no strings)

```typescript
// src/billing/billing-events.service.ts
import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { QZPAY_BILLING } from '@qazuor/qzpay-nestjs';
import {
  QZPayBillingSystem,
  QZPayBillingEvent,
  QZPaySubscriptionStatus,
  type QZPaySubscriptionCreatedEvent,
  type QZPayTrialExpiringEvent,
  type QZPayPaymentSucceededEvent,
  type QZPayPaymentFailedEvent,
} from '@qazuor/qzpay-core';
import { DrizzleService } from '../drizzle/drizzle.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notification.service';
import { bots, organizations, botPlugins, users } from '../db/schema';
import { eq, and, not, inArray } from 'drizzle-orm';
import {
  ASISTIA_PLANS,
  type AsistiaEntitlements,
  type AsistiaLimits,
} from '../config/plans';
import { PLUGINS } from '../config/plugins';

@Injectable()
export class BillingEventsService implements OnModuleInit {
  constructor(
    @Inject(QZPAY_BILLING) private readonly billing: QZPayBillingSystem<AsistiaEntitlements, AsistiaLimits>,
    private readonly drizzle: DrizzleService,
    private readonly analytics: AnalyticsService,
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit() {
    this.registerEventHandlers();
  }

  private registerEventHandlers() {
    // ============================================
    // EVENTOS DE SUSCRIPCION
    // Usar constantes de QZPayBillingEvent, NUNCA strings
    // ============================================

    this.billing.on(QZPayBillingEvent.SUBSCRIPTION_CREATED, async (event: QZPaySubscriptionCreatedEvent) => {
      const { subscription, customer, emailSentByPackage } = event;

      console.log(`New subscription: ${subscription.id}, email sent: ${emailSentByPackage}`);

      await this.analytics.track('subscription_created', {
        organizationId: customer.externalId,
        planId: subscription.planId,
        interval: subscription.billingInterval,
        isTrial: subscription.isTrial(),
      });
    });

    this.billing.on(QZPayBillingEvent.TRIAL_STARTED, async (event) => {
      const { subscription, customer, emailSentByPackage } = event;

      console.log(`Trial started: ${subscription.id}, days: ${subscription.getTrialDaysRemaining()}`);

      // Enviar tips de onboarding
      await this.email.sendOnboardingSequence(customer.email, {
        trialEndsAt: subscription.trialEnd,
        planName: subscription.getPlanName(),
      });
    });

    // Email custom de trial expirando (esta en suppress)
    this.billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event: QZPayTrialExpiringEvent) => {
      const { subscription, customer, daysRemaining, emailSentByPackage } = event;

      // emailSentByPackage === false porque esta en suppress
      // Asist.IA envia su propio email

      const org = await this.drizzle.db.query.organizations.findFirst({
        where: eq(organizations.id, customer.externalId),
      });

      // Obtener estadisticas de uso durante el trial
      const usage = await this.getTrialUsageStats(customer.externalId);
      // hasPaymentMethod is a pre-calculated property, not a method
      const { hasPaymentMethod } = subscription;

      await this.email.send({
        to: customer.email,
        template: 'asistia-trial-expiring',
        data: {
          userName: org?.name,
          daysLeft: daysRemaining,
          planName: subscription.getPlanName(),
          usage: {
            messagesProcessed: usage.messages,
            conversationsHandled: usage.conversations,
            timeSaved: usage.estimatedTimeSaved,
          },
          hasPaymentMethod,
          addPaymentMethodUrl: hasPaymentMethod
            ? null
            : `${process.env.APP_URL}/settings/billing?add-payment`,
          upgradeUrl: `${process.env.APP_URL}/settings/billing`,
        },
      });

      // Tambien notificacion in-app
      await this.notifications.send(customer.externalId, {
        type: 'trial_expiring',
        title: `Tu trial termina en ${daysRemaining} dias`,
        message: hasPaymentMethod
          ? 'Tu suscripcion se renovara automaticamente'
          : 'Agrega un metodo de pago para continuar usando Asist.IA',
        action: hasPaymentMethod ? null : {
          label: 'Agregar metodo de pago',
          url: '/settings/billing',
        },
      });
    });

    this.billing.on(QZPayBillingEvent.SUBSCRIPTION_EXPIRED, async (event) => {
      const { subscription, customer } = event;

      console.log(`Subscription expired: ${subscription.id}`);

      // Desactivar bots extra (mantener solo el limite del free)
      await this.handleDowngradeToFree(customer.externalId);

      // Enviar email de "te extranamos"
      await this.email.send({
        to: customer.email,
        template: 'asistia-subscription-expired',
        data: {
          reactivateUrl: `${process.env.APP_URL}/settings/billing`,
          // Oferta especial de reactivacion
          specialOffer: {
            code: `COMEBACK20`,
            discount: '20% off por 3 meses',
          },
        },
      });
    });

    this.billing.on(QZPayBillingEvent.SUBSCRIPTION_UPGRADED, async (event) => {
      // oldPlan y newPlan son strings con el ID del plan
      const { subscription, customer, oldPlan, newPlan, proratedAmount } = event;

      await this.analytics.track('plan_upgraded', {
        organizationId: customer.externalId,
        fromPlan: oldPlan,
        toPlan: newPlan,
        proratedAmount,
      });
    });

    this.billing.on(QZPayBillingEvent.SUBSCRIPTION_DOWNGRADED, async (event) => {
      // oldPlan y newPlan son strings con el ID del plan
      const { subscription, customer, oldPlan, newPlan, effectiveAt } = event;

      // Downgrade: manejar limites (se aplica al final del periodo)
      await this.scheduleDowngradeHandler(customer.externalId, newPlan, effectiveAt);

      await this.analytics.track('plan_downgraded', {
        organizationId: customer.externalId,
        fromPlan: oldPlan,
        toPlan: newPlan,
        effectiveAt,
      });
    });

    // ============================================
    // EVENTOS DE PAGO
    // ============================================

    this.billing.on(QZPayBillingEvent.PAYMENT_SUCCEEDED, async (event: QZPayPaymentSucceededEvent) => {
      const { payment, customer, emailSentByPackage } = event;

      console.log(`Payment succeeded: ${payment.id}, email sent: ${emailSentByPackage}`);

      // Si es compra de servicio one-time
      if (payment.metadata?.serviceId) {
        await this.processServicePurchase(payment);
      }

      // Si es compra de plugin
      if (payment.metadata?.pluginId) {
        await this.activatePlugin(
          customer.externalId,
          payment.metadata.pluginId,
          payment.metadata.botId,
        );
      }

      await this.analytics.track('payment_succeeded', {
        organizationId: customer.externalId,
        amount: payment.amount,
        type: payment.subscriptionId ? 'subscription' : 'one_time',
      });
    });

    this.billing.on(QZPayBillingEvent.PAYMENT_FAILED, async (event: QZPayPaymentFailedEvent) => {
      const { payment, customer, error, willRetry, emailSentByPackage } = event;

      console.log(`Payment failed: ${payment.id}, will retry: ${willRetry}`);

      const org = await this.drizzle.db.query.organizations.findFirst({
        where: eq(organizations.id, customer.externalId),
      });

      // Email adicional (el package ya envio si emailSentByPackage === true)
      if (!emailSentByPackage) {
        await this.email.send({
          to: customer.email,
          template: 'asistia-payment-failed',
          data: {
            orgName: org?.name,
            amount: payment.amount,
            willRetry,
            updatePaymentUrl: `${process.env.APP_URL}/settings/billing`,
          },
        });
      }

      // Notificacion in-app
      await this.notifications.send(customer.externalId, {
        type: 'payment_failed',
        title: 'Pago fallido',
        message: willRetry
          ? 'Reintentaremos el cobro. Actualiza tu metodo de pago.'
          : 'Actualiza tu metodo de pago para mantener el servicio.',
        action: {
          label: 'Actualizar pago',
          url: '/settings/billing',
        },
        priority: 'high',
      });
    });

    // ============================================
    // EVENTOS DE USO
    // ============================================

    this.billing.on('usage.warning', async (event) => {
      const { organizationId, percent, messagesCount, limit } = event;

      const org = await this.drizzle.db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });

      if (!org) return;

      const owner = await this.drizzle.db.query.users.findFirst({
        where: eq(users.id, org.ownerId),
      });

      if (!owner) return;

      // Notificacion de uso
      await this.notifications.send(organizationId, {
        type: 'usage_warning',
        title: `Has usado el ${percent}% de tus mensajes`,
        message: `${messagesCount.toLocaleString()} de ${limit.toLocaleString()} mensajes este mes`,
        action: {
          label: 'Ver opciones',
          url: '/settings/billing#usage',
        },
      });

      // Email solo al 90%
      if (percent >= 90) {
        await this.email.send({
          to: owner.email,
          template: 'asistia-usage-warning',
          data: {
            orgName: org.name,
            percent,
            messagesUsed: messagesCount,
            messagesLimit: limit,
            upgradeUrl: `${process.env.APP_URL}/settings/billing`,
          },
        });
      }
    });

    this.billing.on('usage.limit.reached', async (event) => {
      const { organizationId, messagesCount, limit } = event;

      const org = await this.drizzle.db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });

      if (!org) return;

      // Notificacion urgente
      await this.notifications.send(organizationId, {
        type: 'usage_limit_reached',
        title: 'Limite de mensajes alcanzado',
        message: 'Tus bots no procesaran mas mensajes hasta que actualices tu plan.',
        action: {
          label: 'Actualizar plan',
          url: '/settings/billing',
        },
        priority: 'urgent',
      });

      // Desactivar bots temporalmente
      await this.drizzle.db.update(bots)
        .set({ isActive: false })
        .where(eq(bots.organizationId, organizationId));
    });

    // ============================================
    // EVENTOS DE PROMO CODE
    // ============================================

    this.billing.on(QZPayBillingEvent.PROMO_CODE_APPLIED, async (event) => {
      // code es el objeto QZPayPromoCode, discount es el monto del descuento
      const { code, customer, discount, emailSentByPackage } = event;

      await this.analytics.track('promo_code_applied', {
        userId: customer.externalId,
        promoCode: code.code,
        discountAmount: discount,
      });
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async handleDowngradeToFree(organizationId: string) {
    // Obtener bots
    const orgBots = await this.drizzle.db.query.bots.findMany({
      where: eq(bots.organizationId, organizationId),
      orderBy: (bots, { asc }) => [asc(bots.createdAt)],
    });

    const freePlan = ASISTIA_PLANS.find(p => p.id === 'free')!;

    // Free solo permite maxBots bots
    if (orgBots.length > freePlan.limits.maxBots) {
      const botsToDisable = orgBots.slice(freePlan.limits.maxBots);

      for (const bot of botsToDisable) {
        await this.drizzle.db.update(bots)
          .set({ isActive: false })
          .where(eq(bots.id, bot.id));
      }

      // Notificar
      await this.notifications.send(organizationId, {
        type: 'bots_disabled',
        title: 'Bots desactivados',
        message: `${botsToDisable.length} bots fueron desactivados por limite de plan.`,
        action: {
          label: 'Actualizar plan',
          url: '/settings/billing',
        },
      });
    }

    // Desactivar plugins premium
    await this.drizzle.db.update(botPlugins)
      .set({ isActive: false })
      .where(
        and(
          eq(botPlugins.botId, orgBots[0]?.id || ''),
          not(inArray(botPlugins.pluginId, ['plugin-faq', 'plugin-forms', 'plugin-calendar']))
        )
      );
  }

  private async handlePlanDowngrade(organizationId: string, newPlan: typeof ASISTIA_PLANS[number]) {
    // Verificar limite de bots
    const orgBots = await this.drizzle.db.query.bots.findMany({
      where: eq(bots.organizationId, organizationId),
      orderBy: (bots, { asc }) => [asc(bots.createdAt)],
    });

    if (newPlan.limits.maxBots !== -1 && orgBots.length > newPlan.limits.maxBots) {
      const botsToDisable = orgBots.slice(newPlan.limits.maxBots);

      for (const bot of botsToDisable) {
        await this.drizzle.db.update(bots)
          .set({ isActive: false })
          .where(eq(bots.id, bot.id));
      }
    }

    // Desactivar plugins no incluidos en el nuevo plan
    const includedPlugins = Object.entries(PLUGINS)
      .filter(([_, p]) => p.includedIn.includes(newPlan.id))
      .map(([_, p]) => p.id);

    await this.drizzle.db.update(botPlugins)
      .set({ isActive: false })
      .where(
        and(
          inArray(botPlugins.botId, orgBots.map(b => b.id)),
          not(inArray(botPlugins.pluginId, includedPlugins))
        )
      );
  }

  private async processServicePurchase(payment: any) {
    const { serviceId, organizationId } = payment.metadata || {};

    switch (serviceId) {
      case 'setup-basic':
      case 'setup-advanced':
        // Crear ticket de soporte
        await this.createSupportTicket({
          organizationId,
          type: 'setup_service',
          serviceId,
          paymentId: payment.id,
        });
        break;

      case 'custom-training-session':
        // Agendar sesion
        await this.scheduleTrainingSession({
          organizationId,
          paymentId: payment.id,
        });
        break;
    }
  }

  private async activatePlugin(organizationId: string, pluginId: string, botId?: string) {
    if (botId) {
      // Activar para un bot especifico
      await this.drizzle.db.insert(botPlugins).values({
        botId,
        pluginId,
        isActive: true,
      }).onConflictDoUpdate({
        target: [botPlugins.botId, botPlugins.pluginId],
        set: { isActive: true },
      });
    } else {
      // Activar para todos los bots de la organizacion
      const orgBots = await this.drizzle.db.query.bots.findMany({
        where: eq(bots.organizationId, organizationId),
      });

      for (const bot of orgBots) {
        await this.drizzle.db.insert(botPlugins).values({
          botId: bot.id,
          pluginId,
          isActive: true,
        }).onConflictDoUpdate({
          target: [botPlugins.botId, botPlugins.pluginId],
          set: { isActive: true },
        });
      }
    }
  }

  private async getTrialUsageStats(organizationId: string) {
    const result = await this.drizzle.db.execute(sql`
      SELECT
        COUNT(DISTINCT c.id) as conversations,
        COUNT(m.id) as messages
      FROM ${conversations} c
      INNER JOIN ${bots} b ON c.bot_id = b.id
      LEFT JOIN ${messages} m ON m.conversation_id = c.id
      WHERE b.organization_id = ${organizationId}
    `);

    const data = result[0] || { conversations: 0, messages: 0 };

    return {
      conversations: data.conversations || 0,
      messages: data.messages || 0,
      estimatedTimeSaved: `${Math.round((data.messages || 0) * 2)} minutos`, // ~2 min por mensaje
    };
  }
}
```

---

## Parte 3: Controllers y Endpoints

### 3.1 Billing Controller (usando rutas auto-registradas)

```typescript
// src/billing/billing.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { QZPAY_BILLING } from '@qazuor/qzpay-nestjs';
import {
  QZPayBillingSystem,
  QZPaySubscriptionStatus,
  QZPayBillingInterval,
} from '@qazuor/qzpay-core';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsageService } from './usage.service';
import { ASISTIA_PLANS, type AsistiaEntitlements, type AsistiaLimits } from '../config/plans';
import { PLUGINS } from '../config/plugins';
import { ONE_TIME_SERVICES, SUBSCRIPTION_ADDONS } from '../config';
import { DrizzleService } from '../drizzle/drizzle.service';
import { organizationMembers } from '../db/schema';
import { eq } from 'drizzle-orm';

@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    @Inject(QZPAY_BILLING) private readonly billing: QZPayBillingSystem<AsistiaEntitlements, AsistiaLimits>,
    private readonly usageService: UsageService,
    private readonly drizzle: DrizzleService,
  ) {}

  // Obtener planes disponibles
  @Get('plans')
  getPlans() {
    return {
      plans: this.billing.plans.getVisible(),
      plugins: Object.values(PLUGINS),
      addons: Object.values(SUBSCRIPTION_ADDONS),
      services: Object.values(ONE_TIME_SERVICES),
    };
  }

  // Obtener suscripcion actual con helpers
  @Get('subscription')
  async getSubscription(@CurrentUser() user: User) {
    const org = await this.getOrganization(user.id);

    // getActiveByCustomerExternalId retorna SubscriptionWithHelpers
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription) {
      const freePlan = ASISTIA_PLANS.find(p => p.id === 'free')!;
      return {
        plan: freePlan,
        subscription: null,
        usage: await this.usageService.getUsage(org.id),
        entitlements: freePlan.entitlements,
        limits: freePlan.limits,
      };
    }

    // Usar metodos helper
    const plan = subscription.getPlan();
    const addons = await this.billing.subscriptions.getAddons(subscription.id);

    return {
      plan,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        interval: subscription.billingInterval,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
        cancelAt: subscription.cancelAt,
        // Usar metodos helper en vez de comparar strings
        isActive: subscription.isActive(),
        isTrial: subscription.isTrial(),
        hasAccess: subscription.hasAccess(),
        hasPaymentMethod: subscription.hasPaymentMethod, // Pre-calculated property
        daysRemaining: subscription.getDaysRemaining(),
        trialDaysRemaining: subscription.getTrialDaysRemaining(),
        willRenew: subscription.willRenew(),
      },
      addons,
      usage: await this.usageService.getUsage(org.id),
      // Usar metodos helper tipados
      entitlements: subscription.getEntitlements(),
      limits: subscription.getLimits(),
    };
  }

  // Iniciar suscripcion (soporta trial sin tarjeta)
  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: User,
    @Body() body: { planId: string; interval: 'month' | 'year'; promoCode?: string },
  ) {
    const { planId, interval, promoCode } = body;

    const plan = this.billing.plans.get(planId);
    if (!plan || plan.id === 'free') {
      throw new BadRequestException('Invalid plan');
    }

    const org = await this.getOrganization(user.id);

    // Sincronizar usuario con billing (crea customer si no existe)
    const customer = await this.billing.customers.syncUser({
      id: org.id,
      email: user.email,
      name: org.name,
    });

    // Si el plan tiene trial sin tarjeta, crear subscription directamente
    if (plan.trial && !plan.trial.requiresPaymentMethod) {
      // Crear subscription en trial (sin Stripe aun)
      const subscription = await this.billing.subscriptions.create({
        customerId: customer.id,
        planId: plan.id,
        interval: interval === 'month' ? QZPayBillingInterval.MONTH : QZPayBillingInterval.YEAR,
        startTrial: true,
        promoCodeId: promoCode ? await this.billing.promoCodes.resolveId(promoCode) : undefined,
      });

      return {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd,
          isTrial: subscription.isTrial(),
        },
        requiresPayment: false,
      };
    }

    // Si requiere tarjeta, crear checkout session
    const session = await this.billing.checkout.create({
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
      successUrl: `${process.env.APP_URL}/dashboard?subscription=success`,
      cancelUrl: `${process.env.APP_URL}/pricing?subscription=cancelled`,
      metadata: {
        organizationId: org.id,
        userId: user.id,
      },
    });

    return {
      clientSecret: session.clientSecret,
      sessionId: session.id,
      requiresPayment: true,
    };
  }

  // Agregar metodo de pago a trial existente
  @Post('subscription/add-payment-method')
  async addPaymentMethod(@CurrentUser() user: User) {
    const org = await this.getOrganization(user.id);
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    // Usar metodo helper
    if (!subscription.isTrial()) {
      throw new BadRequestException('Only trial subscriptions need payment method');
    }

    // Crear setup session para agregar tarjeta
    const session = await this.billing.checkout.createSetupSession({
      customerId: subscription.customerId,
      successUrl: `${process.env.APP_URL}/settings/billing?payment-method=added`,
      cancelUrl: `${process.env.APP_URL}/settings/billing`,
      metadata: {
        subscriptionId: subscription.id,
      },
    });

    return {
      clientSecret: session.clientSecret,
    };
  }

  // Comprar add-on de suscripcion
  @Post('addons/purchase')
  async purchaseAddon(
    @CurrentUser() user: User,
    @Body() body: { addonId: string; quantity: number },
  ) {
    const { addonId, quantity } = body;

    const addon = SUBSCRIPTION_ADDONS[addonId as keyof typeof SUBSCRIPTION_ADDONS];
    if (!addon) {
      throw new BadRequestException('Invalid addon');
    }

    const org = await this.getOrganization(user.id);
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription || !subscription.hasAccess()) {
      throw new BadRequestException('No active subscription');
    }

    // Verificar requisitos del addon
    if (addon.requiredPlan && !addon.requiredPlan.includes(subscription.planId)) {
      throw new BadRequestException(`Este add-on requiere plan ${addon.requiredPlan.join(' o ')}`);
    }

    // Agregar add-on a la suscripcion
    await this.billing.subscriptions.addAddon(subscription.id, {
      addonId: addon.id,
      quantity,
      unitPrice: addon.pricePerUnit,
      name: addon.name,
    });

    return { success: true };
  }

  // Comprar plugin
  @Post('plugins/purchase')
  async purchasePlugin(
    @CurrentUser() user: User,
    @Body() body: { pluginId: string; botId?: string },
  ) {
    const { pluginId, botId } = body;

    const plugin = PLUGINS[pluginId as keyof typeof PLUGINS];
    if (!plugin) {
      throw new BadRequestException('Invalid plugin');
    }

    // Si el plugin es gratis, no necesita compra
    if (plugin.price === 0) {
      throw new BadRequestException('Este plugin esta incluido en tu plan');
    }

    const org = await this.getOrganization(user.id);
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription || !subscription.hasAccess()) {
      throw new BadRequestException('Necesitas una suscripcion para comprar plugins');
    }

    // Agregar como add-on mensual
    await this.billing.subscriptions.addAddon(subscription.id, {
      addonId: pluginId,
      quantity: 1,
      unitPrice: plugin.price,
      name: plugin.name,
    });

    // Activar plugin
    await this.activatePlugin(org.id, pluginId, botId);

    return { success: true, type: 'addon' };
  }

  // Comprar servicio one-time
  @Post('services/purchase')
  async purchaseService(
    @CurrentUser() user: User,
    @Body() body: { serviceId: string; quantity?: number },
  ) {
    const { serviceId, quantity = 1 } = body;

    const service = ONE_TIME_SERVICES[serviceId as keyof typeof ONE_TIME_SERVICES];
    if (!service) {
      throw new BadRequestException('Invalid service');
    }

    const org = await this.getOrganization(user.id);

    // Sincronizar usuario
    const customer = await this.billing.customers.syncUser({
      id: org.id,
      email: user.email,
      name: org.name,
    });

    const session = await this.billing.checkout.create({
      customerId: customer.id,
      mode: 'payment',
      items: [{
        name: service.name,
        description: service.description,
        amount: service.price,
        quantity,
      }],
      successUrl: `${process.env.APP_URL}/dashboard?service=success`,
      cancelUrl: `${process.env.APP_URL}/dashboard/services?service=cancelled`,
      metadata: {
        organizationId: org.id,
        userId: user.id,
        serviceId: service.id,
      },
    });

    return {
      clientSecret: session.clientSecret,
      sessionId: session.id,
    };
  }

  // Obtener uso actual
  @Get('usage')
  async getUsage(@CurrentUser() user: User) {
    const org = await this.getOrganization(user.id);
    return this.usageService.getUsage(org.id);
  }

  // Cambiar plan
  @Post('subscription/change-plan')
  async changePlan(
    @CurrentUser() user: User,
    @Body() body: { newPlanId: string; newInterval?: 'month' | 'year' },
  ) {
    const { newPlanId, newInterval } = body;

    const plan = this.billing.plans.get(newPlanId);
    if (!plan) {
      throw new BadRequestException('Invalid plan');
    }

    const org = await this.getOrganization(user.id);
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    // Calcular proracion
    const proration = await this.billing.subscriptions.calculateProration(
      subscription.id,
      newPlanId,
      newInterval ? (newInterval === 'month' ? QZPayBillingInterval.MONTH : QZPayBillingInterval.YEAR) : undefined,
    );

    // Cambiar plan
    const result = await this.billing.subscriptions.changePlan(subscription.id, {
      newPlanId,
      newInterval: newInterval ? (newInterval === 'month' ? QZPayBillingInterval.MONTH : QZPayBillingInterval.YEAR) : undefined,
      proration: QZPayProrationBehavior.IMMEDIATELY,
    });

    return {
      subscription: result,
      proration,
    };
  }

  // Cancelar suscripcion
  @Post('subscription/cancel')
  async cancelSubscription(
    @CurrentUser() user: User,
    @Body() body: { reason?: string; cancelAt: QZPayCancelAtType },
  ) {
    const { reason, cancelAt } = body;

    const org = await this.getOrganization(user.id);
    const subscription = await this.billing.subscriptions.getActiveByCustomerExternalId(org.id);

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    await this.billing.subscriptions.cancel(subscription.id, {
      cancelAt,
      reason,
    });

    return { success: true };
  }

  // Helpers
  private async getOrganization(userId: string) {
    const member = await this.drizzle.db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, userId),
      with: { organization: true },
    });

    if (!member?.organization) {
      throw new BadRequestException('No organization found');
    }

    return member.organization;
  }

  private async activatePlugin(organizationId: string, pluginId: string, botId?: string) {
    // Implementacion similar a billing-events.service.ts
  }
}
```

### 3.2 Background Jobs con BullMQ

```typescript
// src/billing/billing-jobs.processor.ts
import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Inject } from '@nestjs/common';
import { QZPAY_BILLING } from '@qazuor/qzpay-nestjs';
import { QZPayBillingSystem } from '@qazuor/qzpay-core';

@Processor('billing-jobs')
export class BillingJobsProcessor {
  constructor(
    @Inject(QZPAY_BILLING) private readonly billing: QZPayBillingSystem,
  ) {}

  @Process('processExpiredSubscriptions')
  async handleExpiredSubscriptions(job: Job) {
    console.log(`Processing expired subscriptions...`);
    const billingJob = this.billing.jobs.getByName('processExpiredSubscriptions');
    await billingJob?.handler();
  }

  @Process('processTrialExpirations')
  async handleTrialExpirations(job: Job) {
    console.log(`Processing trial expirations...`);
    const billingJob = this.billing.jobs.getByName('processTrialExpirations');
    await billingJob?.handler();
  }

  @Process('sendPaymentReminders')
  async handlePaymentReminders(job: Job) {
    console.log(`Sending payment reminders...`);
    const billingJob = this.billing.jobs.getByName('sendPaymentReminders');
    await billingJob?.handler();
  }

  @Process('retryFailedPayments')
  async handleRetryPayments(job: Job) {
    console.log(`Retrying failed payments...`);
    const billingJob = this.billing.jobs.getByName('retryFailedPayments');
    await billingJob?.handler();
  }

  @Process('sendExpirationWarnings')
  async handleExpirationWarnings(job: Job) {
    console.log(`Sending expiration warnings...`);
    const billingJob = this.billing.jobs.getByName('sendExpirationWarnings');
    await billingJob?.handler();
  }

  @Process('processUsageOverages')
  async handleUsageOverages(job: Job) {
    console.log(`Processing usage overages...`);
    await this.processMonthlyOverages();
  }

  private async processMonthlyOverages() {
    // Obtener todas las suscripciones activas
    // Calcular overages
    // Crear invoices de overage
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    console.log(`Job ${job.name} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.name} failed:`, error);
  }
}

// src/billing/billing-jobs.scheduler.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BillingJobsScheduler {
  constructor(
    @InjectQueue('billing-jobs') private readonly billingQueue: Queue,
  ) {}

  // Cada hora
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleHourlyJobs() {
    await this.billingQueue.add('processExpiredSubscriptions');
    await this.billingQueue.add('processTrialExpirations');
  }

  // Cada dia a las 9am
  @Cron('0 9 * * *')
  async schedulePaymentReminders() {
    await this.billingQueue.add('sendPaymentReminders');
  }

  // Cada dia a las 10am
  @Cron('0 10 * * *')
  async scheduleExpirationWarnings() {
    await this.billingQueue.add('sendExpirationWarnings');
  }

  // Cada 4 horas
  @Cron('0 */4 * * *')
  async scheduleRetryPayments() {
    await this.billingQueue.add('retryFailedPayments');
  }

  // Primer dia de cada mes a las 2am
  @Cron('0 2 1 * *')
  async scheduleMonthlyOverages() {
    await this.billingQueue.add('processUsageOverages');
  }
}
```

---

## Parte 4: Frontend (React/Next.js)

### 4.1 Provider Setup

```tsx
// src/providers/billing-provider.tsx
'use client';

import { QZPayBillingProvider } from '@qazuor/qzpay-react';
import { useSession } from 'next-auth/react';

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <QZPayBillingProvider
      apiUrl="/api/billing"
      customerId={session?.user?.organizationId}
      locale="es"
      currency="USD"
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      getAuthHeaders={async () => {
        return {};  // Next.js maneja auth con cookies
      }}
    >
      {children}
    </QZPayBillingProvider>
  );
}
```

### 4.2 Pagina de Pricing con Promo Codes

```tsx
// src/app/pricing/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  QZPayPricingTable,
  QZPayPromoCodeInput,
  useQZPayCheckout,
} from '@qazuor/qzpay-react';
import { QZPayBillingInterval } from '@qazuor/qzpay-core';

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { createCheckout, isLoading } = useQZPayCheckout();

  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount: number;
    description: string;
  } | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (status !== 'authenticated') {
      router.push(`/auth/signin?callbackUrl=/pricing&plan=${planId}`);
      return;
    }

    if (planId === 'free') {
      router.push('/dashboard');
      return;
    }

    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval, promoCode: promoCode || undefined }),
      });

      const result = await response.json();

      if (result.requiresPayment) {
        // Necesita pagar, mostrar checkout
        await createCheckout({
          clientSecret: result.clientSecret,
          onComplete: () => router.push('/dashboard?subscription=success'),
        });
      } else {
        // Trial sin tarjeta, ya esta creada la subscription
        router.push('/dashboard?trial=started');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleValidatePromo = async (code: string) => {
    const res = await fetch('/api/billing/promo-codes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, planId: 'pro', interval }),
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

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Potencia tu negocio con IA</h1>
        <p>Elige el plan perfecto para tus necesidades</p>

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
            <span className="badge">Ahorra 17%</span>
          </button>
        </div>
      </div>

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

      {promoResult?.valid && (
        <div className="promo-applied-banner">
          Codigo {promoCode} aplicado: {promoResult.description}
        </div>
      )}

      <QZPayPricingTable
        apiUrl="/api/billing/plans"
        interval={interval}
        promoDiscount={promoResult?.valid ? promoResult.discount : undefined}
        onSelectPlan={handleSelectPlan}
        isLoading={isLoading}
        showTrialInfo
        trialText="14 dias de prueba gratis, sin tarjeta"
      />
    </div>
  );
}
```

### 4.3 Trial Banner con Metodos Helper

```tsx
// src/components/TrialBanner.tsx
'use client';

import { useQZPaySubscription } from '@qazuor/qzpay-react';

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

### 4.4 Dashboard de Billing con Usage

```tsx
// src/app/dashboard/settings/billing/page.tsx
'use client';

import {
  SubscriptionCard,
  PaymentHistory,
  PaymentMethodManager,
  InvoiceList,
  UpgradeModal,
  CancelSubscriptionFlow,
  QuotaUsageBar,
  TrialBanner,
  PaymentDueBanner,
} from '@qazuor/qzpay-react';
import { useQZPaySubscription } from '@qazuor/qzpay-react';
import { useState, useEffect } from 'react';
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';

interface Usage {
  current: number;
  limit: number;
  percent: number;
  remaining: number;
  overage: {
    enabled: boolean;
    pricePerMessage: number;
    extraMessages: number;
    estimatedCharge: number;
  } | null;
}

export default function BillingPage() {
  const { subscription, loading, cancel, changePlan, refresh } = useQZPaySubscription();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelFlow, setShowCancelFlow] = useState(false);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    const res = await fetch('/api/billing/usage');
    const data = await res.json();
    setUsage(data);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="billing-page">
      {/* Banners - usar metodos helper */}
      {subscription?.isTrial() && (
        <TrialBanner
          trialEnd={subscription.trialEnd!}
          hasPaymentMethod={subscription.hasPaymentMethod}
          onAddPaymentMethod={() => {
            document.getElementById('payment-methods')?.scrollIntoView();
          }}
        />
      )}

      {subscription?.status === QZPaySubscriptionStatus.PAST_DUE && (
        <PaymentDueBanner
          dueDate={subscription.currentPeriodEnd}
          onUpdatePaymentMethod={() => {
            document.getElementById('payment-methods')?.scrollIntoView();
          }}
        />
      )}

      <div className="billing-grid">
        {/* Suscripcion */}
        <section className="subscription-section">
          <h2>Tu plan</h2>
          <SubscriptionCard
            subscription={subscription}
            onUpgrade={() => setShowUpgradeModal(true)}
            onCancel={() => setShowCancelFlow(true)}
          />

          {/* Info adicional usando helpers */}
          {subscription && (
            <div className="subscription-details">
              <p>Estado: {subscription.isActive() ? 'Activo' : subscription.isTrial() ? 'En trial' : 'Inactivo'}</p>
              <p>Tiene acceso: {subscription.hasAccess() ? 'Si' : 'No'}</p>
              <p>Dias restantes: {subscription.getDaysRemaining()}</p>
              <p>Se renovara: {subscription.willRenew() ? 'Si' : 'No'}</p>
            </div>
          )}
        </section>

        {/* Uso */}
        <section className="usage-section">
          <h2>Uso del mes</h2>

          {usage && (
            <>
              <QuotaUsageBar
                current={usage.current}
                limit={usage.limit}
                label="Mensajes procesados"
                warningThreshold={75}
                criticalThreshold={90}
              />

              <div className="usage-details">
                <p>{usage.current.toLocaleString()} / {usage.limit.toLocaleString()} mensajes</p>
                <p>{usage.remaining.toLocaleString()} restantes</p>

                {usage.overage && usage.overage.extraMessages > 0 && (
                  <div className="overage-warning">
                    <p>Has excedido tu limite</p>
                    <p>
                      {usage.overage.extraMessages.toLocaleString()} mensajes extra
                      = ${(usage.overage.estimatedCharge / 100).toFixed(2)} adicionales
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Metodos de pago */}
        <section id="payment-methods" className="payment-methods-section">
          <h2>Metodos de pago</h2>
          <PaymentMethodManager />
        </section>

        {/* Historial de pagos */}
        <section className="payment-history-section">
          <h2>Historial de pagos</h2>
          <PaymentHistory limit={10} />
        </section>

        {/* Facturas */}
        <section className="invoices-section">
          <h2>Facturas</h2>
          <InvoiceList />
        </section>
      </div>

      {/* Modals */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          onChangePlan={async (newPlanId, newInterval) => {
            await changePlan(newPlanId, newInterval);
            setShowUpgradeModal(false);
            refresh();
          }}
        />
      )}

      {showCancelFlow && (
        <CancelSubscriptionFlow
          subscription={subscription!}
          onClose={() => setShowCancelFlow(false)}
          onCancel={async (options) => {
            await cancel(options);
            setShowCancelFlow(false);
            refresh();
          }}
          cancelReasons={[
            { id: 'too_expensive', label: 'Es muy caro' },
            { id: 'not_enough_value', label: 'No le saco suficiente valor' },
            { id: 'missing_features', label: 'Le faltan funcionalidades' },
            { id: 'technical_issues', label: 'Problemas tecnicos' },
            { id: 'switching', label: 'Me cambio a otra herramienta' },
            { id: 'other', label: 'Otro motivo' },
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
6. POST /api/billing/subscribe con planId: 'pro', interval: 'month'
7. Backend detecta que trial.requiresPaymentMethod = false
8. Crea Subscription en estado 'trialing' SIN Stripe
9. Responde con requiresPayment: false
10. Usuario redirigido a /dashboard?trial=started
11. Evento TRIAL_STARTED emitido
12. Email de bienvenida enviado
13. Usuario tiene acceso completo a features de Pro

Dia 11 (3 dias antes):
14. Job detecta trial expiring
15. Evento TRIAL_EXPIRING emitido (emailSentByPackage: false porque esta en suppress)
16. Asist.IA envia email custom con stats de uso
17. Email: "Tu trial termina en 3 dias, agrega tarjeta"

Dia 14 (ultimo dia):
18. Usuario agrega tarjeta en /settings/billing
19. POST /api/billing/subscription/add-payment-method
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
21. Asist.IA envia email "Tu trial termino, vuelve"
22. Bots extra desactivados (downgrade a free)
```

### 5.2 Flujo: Usage-Based Billing

```
[Durante el mes]
1. Usuario envia mensaje a su bot
2. Bot procesa y responde
3. UsageService.recordMessage() incrementa contador
4. Se verifica limite:
   - 75%: notificacion in-app (emailSentByPackage: false, en suppress)
   - 90%: notificacion + email custom de Asist.IA
   - 100%: Si tiene overage → se acumula
          Si no tiene overage → bots desactivados

[Fin del mes - Dia 1 del siguiente]
1. Job 'processUsageOverages' ejecuta
2. Para cada org con overage:
   - Calcula mensajes extra
   - Crea invoice item
   - Se cobra en la proxima factura
3. Contadores se resetean

[Proxima factura]
- Plan mensual: $99
- Overage: 500 mensajes extra x $0.015 = $7.50
- Total: $106.50
```

### 5.3 Flujo: Aplicar Promo Code

```
1. Usuario en /pricing
2. Ingresa codigo "WELCOME30" en QZPayPromoCodeInput
3. POST /api/billing/promo-codes/validate
4. Backend valida:
   - Codigo existe y esta activo
   - No expiro
   - Usuario es nuevo (newCustomersOnly)
   - Plan elegido es valido (validPlans)
   - No excede maxUses
5. Responde con:
   - valid: true
   - discountAmount: 2970 (30% de $99)
   - description: "30% de descuento"
6. UI muestra banner "Codigo WELCOME30 aplicado"
7. QZPayPricingTable muestra precios con descuento tachado
8. Usuario selecciona plan
9. POST /api/billing/subscribe con promoCode: "WELCOME30"
10. Backend aplica descuento a checkout session
11. Evento PROMO_CODE_APPLIED emitido
12. promoCodeUsage creado en DB
13. usedCount incrementado
14. Usuario paga precio con descuento
```

---

## Resumen de Mejoras Implementadas

1. **Constantes/Enums**: Todos los comparisons usan `QZPaySubscriptionStatus.ACTIVE`, `QZPayBillingEvent.TRIAL_EXPIRED`, `QZPayPromoCodeType.PERCENTAGE` (promo codes), `QZPayAutomaticDiscountType.PERCENTAGE` (automatic discounts), etc.

2. **Entitlements vs Limits**: Separados en interfaces distintas con tipado fuerte (`AsistiaEntitlements`, `AsistiaLimits`).

3. **Subscription Helpers**: `subscription.isActive()`, `subscription.getLimits()`, `subscription.hasPaymentMethod` (property), `subscription.getEntitlements()`, etc.

4. **Env Validation**: CLI genera `.env.example` y el package valida al iniciar.

5. **Customer-User Sync**: `billing.customers.syncUser()` maneja el linkeo automaticamente.

6. **Email Clarity**: `suppress` array define que emails maneja Asist.IA, `emailSentByPackage` en eventos.

7. **Trials Sin Tarjeta**: `trial.requiresPaymentMethod: false` permite trials sin pedir tarjeta.

8. **Promo Codes Completos**: Ejemplos de todos los tipos (PERCENTAGE, FIXED_AMOUNT, FREE_PERIOD, TRIAL_EXTENSION, REDUCED_PERIOD), validacion, aplicacion, tracking.

9. **Usage-Based Billing**: Tracking de mensajes, alertas de uso, overage automatico.

---

*Ejemplo actualizado para @qazuor/qzpay v2.0*
