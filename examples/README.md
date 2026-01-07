# QZPay Examples

Ejemplos completos de integración de QZPay para diferentes casos de uso.

## Casos de Uso

### 1. Hospeda - Portal Turístico

**Modelo**: Suscripciones + Add-ons + Servicios únicos

Un portal donde propietarios publican alojamientos turísticos.

- **Suscripción mensual**: Planes Básico ($9.99), Profesional ($29.99), Agencia ($99.99)
- **Add-ons mensuales**: Destacar Plus, Galería Extended, Stats Pro, Badge Verificado
- **Servicios únicos**: Sesión de Fotos ($149), Video Tour ($299), Setup Premium ($49)

```
examples/hospeda/
├── types.ts      # Tipos y configuración de planes
├── config.ts     # Configuración de QZPay
├── plans.ts      # Inicialización de planes y precios
├── services.ts   # Lógica de negocio
├── routes.ts     # API REST con Hono
└── webhooks.ts   # Manejo de eventos
```

### 2. Asistia - Plataforma de Asistentes IA

**Modelo**: Suscripción con límites + Overage + Add-ons

Una plataforma SaaS de asistentes IA con modelo basado en uso.

- **Suscripción mensual**: Starter ($19), Growth ($49), Business ($149), Enterprise (custom)
- **Uso incluido**: Mensajes, tokens, bots según plan
- **Overage**: $0.01/mensaje extra, $0.002/1K tokens extra
- **Add-ons**: Analytics Pro, API Access, White Label, Priority Support
- **Servicios únicos**: Bot Setup ($99), Custom Integration ($299)

```
examples/asistia/
├── types.ts      # Tipos y límites de planes
├── config.ts     # Configuración de QZPay
├── plans.ts      # Inicialización de planes
├── usage.ts      # Tracking de uso y overage
├── services.ts   # Lógica de negocio
└── routes.ts     # API REST con Hono
```

### 3. GemFolio - Plataforma White-Label de Ventas

**Modelo**: Multi-tenant donde TU CLIENTE vende

Una plataforma donde cada cliente (vendor) configura su propia tienda y vende sus productos. Sin comisión tuya.

- **Multi-tenant**: Cada vendor tiene su cuenta Stripe Connect
- **Productos configurables**: Cada vendor define sus productos y precios
- **Pagos directos**: El dinero va al vendor, sin comisión
- **Checkout**: Stripe Checkout integrado por vendor

```
examples/gemfolio/
├── types.ts      # Tipos para vendors, productos, órdenes
├── config.ts     # Configuración multi-tenant
├── store.ts      # Gestión de vendors/tiendas
├── products.ts   # Gestión de productos
├── checkout.ts   # Proceso de checkout
└── routes.ts     # API REST con Hono
```

## Comparación de Modelos

| Característica | Hospeda | Asistia | GemFolio |
|---------------|---------|---------|----------|
| Suscripciones | ✅ | ✅ | ❌ |
| Pago único | ✅ | ✅ | ✅ |
| Add-ons | ✅ | ✅ | ❌ |
| Uso medido | ❌ | ✅ | ❌ |
| Overage | ❌ | ✅ | ❌ |
| Multi-tenant | ❌ | ❌ | ✅ |
| Stripe Connect | ❌ | ❌ | ✅ |
| Tu comisión | 100% | 100% | 0% |

## Variables de Entorno

Todos los ejemplos requieren:

```bash
DATABASE_URL=postgres://...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

## Ejecutar Ejemplos

1. Instala dependencias:
   ```bash
   pnpm install
   ```

2. Configura variables de entorno

3. Inicializa la base de datos (migraciones)

4. Inicializa planes (ejecutar una vez):
   ```typescript
   import { initializeHospedaPlans } from './hospeda/plans';
   await initializeHospedaPlans();
   ```

5. Inicia el servidor:
   ```typescript
   import app from './hospeda/routes';
   // Bun: export default app
   // Node: app.listen(3000)
   ```

---

## Provider-Specific Examples

### NestJS + MercadoPago

Complete NestJS integration with MercadoPago for Latin American markets.

```
examples/nestjs-mercadopago/
├── README.md               # Setup and usage guide
├── billing.module.ts       # NestJS dynamic module
├── billing.service.ts      # Billing operations with MP
├── webhooks.controller.ts  # IPN webhook handling
└── types.ts               # Type definitions
```

**Features:**
- Full MercadoPago adapter integration
- Subscription management (preapprovals)
- 3D Secure support
- IPN webhook handling with HMAC verification

**Environment:**
```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
MERCADOPAGO_WEBHOOK_SECRET=xxx
```

### Provider Comparison

| Feature | Stripe Examples | MercadoPago Examples |
|---------|-----------------|---------------------|
| Markets | Global | LATAM |
| Subscriptions | Hospeda, Asistia | NestJS-MP |
| Marketplace | GemFolio | v2 planned |
| 3D Secure | Automatic | Manual handling |
| Webhooks | Stripe CLI | IPN endpoints |

---

## Notas Importantes

- Los ejemplos usan almacenamiento en memoria para simplificar. En producción, usa `@qazuor/qzpay-drizzle`.
- Los webhooks de Stripe necesitan un endpoint público. Usa `stripe listen --forward-to` para desarrollo local.
- Los webhooks de MercadoPago (IPN) también necesitan un endpoint público. Usa ngrok o similar.
- GemFolio requiere Stripe Connect configurado en tu cuenta de Stripe.

## MercadoPago Limitations

See the [MercadoPago README](/packages/mercadopago/README.md#limitations-vs-stripe) for detailed information about:
- Customer metadata limitations
- Split payment availability
- Subscription feature differences
- Regional payment methods
