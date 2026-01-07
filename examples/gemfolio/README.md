# GemFolio - Plataforma White-Label de Ventas

Ejemplo completo de integración de QZPay para una plataforma donde TU CLIENTE vende sus propios productos. No cobras comisión, solo facilitas la herramienta.

## Modelo de Negocio

- **Tu cliente** es un vendedor (joyero, artista, artesano, etc.)
- **Tu cliente configura** sus propios productos y precios
- **Las ventas van directo** a la cuenta Stripe de tu cliente
- **Sin comisión tuya** - solo la comisión estándar de Stripe
- **Multi-tenant**: Cada cliente tiene su propio "store" aislado

## Estructura

```
gemfolio/
├── config.ts           # Configuración multi-tenant
├── store.ts            # Gestión de tiendas
├── products.ts         # Gestión de productos
├── checkout.ts         # Proceso de checkout
├── routes.ts           # API routes (Hono)
├── webhooks.ts         # Webhooks por tienda
└── types.ts            # Tipos específicos
```

## Arquitectura Multi-Tenant

Cada cliente (vendor) de GemFolio tiene:
- Su propia cuenta Stripe Connect
- Sus propios productos y precios
- Su propio billing history
- Clientes finales aislados

## Flujo de Compra

```
1. Comprador visita tienda de vendor (gemfolio.com/tienda/joyeria-luna)
2. Selecciona productos, va al checkout
3. Pago procesado via Stripe del vendor
4. Vendor recibe el dinero (menos fee de Stripe)
5. GemFolio no recibe comisión
```

## Configuración por Vendor

Cada vendor necesita:
- Stripe Account ID (Connect)
- Webhook endpoint propio
- Productos y precios configurados
