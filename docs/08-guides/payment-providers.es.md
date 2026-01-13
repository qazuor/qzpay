# Guía de Configuración de Proveedores de Pago

Esta guía explica cómo configurar proveedores de pago para QZPay, tanto en el Playground como en aplicaciones de producción.

## Tabla de Contenidos

- [Resumen](#resumen)
- [Proveedor Mock (Desarrollo)](#proveedor-mock-desarrollo)
- [Stripe](#stripe)
- [MercadoPago](#mercadopago)
- [Cambiar entre Proveedores](#cambiar-entre-proveedores)

---

## Resumen

QZPay soporta múltiples proveedores de pago mediante su patrón de adaptadores:

| Proveedor | Paquete | Ideal Para |
|-----------|---------|------------|
| Mock | Incluido | Desarrollo y Testing |
| Stripe | `@qazuor/qzpay-stripe` | Pagos globales, enfoque US/EU |
| MercadoPago | `@qazuor/qzpay-mercadopago` | Latinoamérica |

---

## Proveedor Mock (Desarrollo)

El proveedor mock simula el procesamiento de pagos sin llamadas reales a APIs. Perfecto para desarrollo y testing.

### Tarjetas de Prueba

| Número de Tarjeta | Resultado |
|-------------------|-----------|
| `4242 4242 4242 4242` | Éxito |
| `4000 0000 0000 0002` | Rechazada |
| `4000 0000 0000 9995` | Fondos Insuficientes |
| `4000 0000 0000 3220` | Requiere 3DS |

### Configuración en Playground

1. En Setup, selecciona **Payment Mode: Mock**
2. Haz clic en **Initialize**
3. No se requieren claves API

---

## Stripe

### Paso 1: Crear una Cuenta de Stripe

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com)
2. Regístrate o inicia sesión
3. Completa la verificación de cuenta (para pagos en vivo)

### Paso 2: Obtener Claves API

1. En el Dashboard de Stripe, ve a **Developers → API Keys**
2. Copia tus claves:
   - **Publishable key**: `pk_test_...` (frontend)
   - **Secret key**: `sk_test_...` (backend - ¡mantener segura!)

> **Importante**: Usa claves de prueba (`pk_test_`, `sk_test_`) para desarrollo. Las claves live (`pk_live_`, `sk_live_`) son solo para producción.

### Paso 3: Configurar Webhooks (Producción)

1. Ve a **Developers → Webhooks**
2. Haz clic en **Add endpoint**
3. Ingresa tu URL de webhook: `https://tu-dominio.com/api/webhooks/stripe`
4. Selecciona los eventos a escuchar:
   - `customer.created`
   - `customer.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copia el **Webhook signing secret**: `whsec_...`

### Paso 4: Configuración en Playground

1. En Setup, selecciona **Payment Mode: Stripe**
2. Ingresa tu **Secret Key** (`sk_test_...`)
3. Haz clic en **Initialize**

### Paso 5: Integración en Código

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';

const stripeAdapter = createQZPayStripeAdapter({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

const billing = createQZPayBilling({
  storage: yourStorageAdapter,
  paymentAdapter: stripeAdapter,
});
```

### Tarjetas de Prueba de Stripe

| Número de Tarjeta | Resultado |
|-------------------|-----------|
| `4242 4242 4242 4242` | Éxito |
| `4000 0000 0000 0002` | Rechazada |
| `4000 0000 0000 9995` | Fondos Insuficientes |
| `4000 0000 0000 3220` | Requiere 3DS |
| `4000 0000 0000 0069` | Tarjeta Expirada |
| `4000 0000 0000 0127` | CVC Incorrecto |

> Lista completa: [Documentación de Testing de Stripe](https://stripe.com/docs/testing)

---

## MercadoPago

### Paso 1: Crear una Cuenta de Desarrollador

1. Ve a [MercadoPago Developers](https://www.mercadopago.com/developers)
2. Regístrate o inicia sesión con tu cuenta de MercadoPago
3. Crea una aplicación

### Paso 2: Crear una Aplicación

1. Haz clic en **Crear aplicación**
2. Completa:
   - **Nombre de la aplicación**: El nombre de tu app
   - **Tipo de integración**: Selecciona **Checkout API**
   - **Producto a integrar**: Selecciona **API de Pagos**
3. Haz clic en **Crear**

> **¿Por qué Checkout API + API de Pagos?**
> - **Checkout API** te da control total sobre el flujo de pago
> - **API de Pagos** es la API directa de pagos que usa QZPay
> - No elijas "Suscripciones" - QZPay maneja su propia lógica de suscripciones internamente

### Paso 3: Obtener Credenciales

1. En tu aplicación, ve a **Credenciales de prueba**
2. Copia el **Access Token**: `TEST-xxxx...`

> **Importante**:
> - Usa **Credenciales de prueba** para desarrollo
> - Usa **Credenciales de producción** solo para pagos reales
> - Nunca expongas tu Access Token en código frontend

### Paso 4: Configuración en Playground

1. En Setup, selecciona **Payment Mode: MercadoPago**
2. Ingresa tu **Access Token** (`TEST-...`)
3. Haz clic en **Initialize**

### Paso 5: Integración en Código

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

const mercadopagoAdapter = createQZPayMercadoPagoAdapter({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const billing = createQZPayBilling({
  storage: yourStorageAdapter,
  paymentAdapter: mercadopagoAdapter,
});
```

### Tarjetas de Prueba de MercadoPago

#### Argentina (ARS)

| Tarjeta | Número | CVV | Vencimiento |
|---------|--------|-----|-------------|
| Mastercard (Aprobada) | `5031 7557 3453 0604` | `123` | `11/25` |
| Mastercard (Rechazada) | `5031 7557 3453 0604` | `456` | `11/25` |
| Visa (Aprobada) | `4509 9535 6623 3704` | `123` | `11/25` |

#### Brasil (BRL)

| Tarjeta | Número | CVV | Vencimiento |
|---------|--------|-----|-------------|
| Mastercard (Aprobada) | `5031 4332 1540 6351` | `123` | `11/25` |
| Visa (Aprobada) | `4235 6477 2802 5682` | `123` | `11/25` |

#### México (MXN)

| Tarjeta | Número | CVV | Vencimiento |
|---------|--------|-----|-------------|
| Mastercard (Aprobada) | `5474 9254 3267 0366` | `123` | `11/25` |
| Visa (Aprobada) | `4075 5957 1648 3764` | `123` | `11/25` |

> Lista completa: [Tarjetas de Prueba de MercadoPago](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards)

### Usuarios de Prueba (Opcional)

Para testing completo, MercadoPago recomienda crear usuarios de prueba:

1. Ve a **Credenciales de prueba → Usuarios de prueba**
2. Crea un usuario de prueba **Vendedor**
3. Crea un usuario de prueba **Comprador**
4. Usa las credenciales del comprador para simular compras

---

## Cambiar entre Proveedores

### En Playground

Simplemente cambia el Payment Mode en Setup y re-inicializa.

> **Nota**: Al cambiar de proveedor, los clientes existentes necesitan re-sincronizarse con el nuevo proveedor. Lo más fácil es limpiar los datos y recargar una plantilla.

### En Producción

```typescript
// Selección de proveedor basada en entorno
function createPaymentAdapter() {
  const provider = process.env.PAYMENT_PROVIDER;

  switch (provider) {
    case 'stripe':
      return createQZPayStripeAdapter({
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      });

    case 'mercadopago':
      return createQZPayMercadoPagoAdapter({
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      });

    default:
      throw new Error(`Proveedor de pago desconocido: ${provider}`);
  }
}
```

---

## Mejores Prácticas de Seguridad

1. **Nunca expongas claves secretas** en código frontend o control de versiones
2. **Usa variables de entorno** para todas las credenciales
3. **Usa credenciales de prueba** durante el desarrollo
4. **Valida los webhooks** usando el secreto de webhook
5. **Implementa idempotencia** para operaciones de pago
6. **Registra eventos de pago** para debugging y auditoría

---

## Solución de Problemas

### "Customer not linked to provider"

**Causa**: El cliente no tiene una entrada `providerCustomerIds` para el proveedor actual.

**Soluciones**:
1. Limpia localStorage y recarga plantillas (los clientes se re-sincronizarán)
2. Crea nuevos clientes a través de la API de billing
3. Sincroniza manualmente clientes existentes usando `billing.customers.syncUser()`

### "Invalid API Key"

**Causa**: El formato de la clave API es incorrecto o está expirada.

**Soluciones**:
1. Verifica que estés usando el tipo de clave correcto (test vs live)
2. Revisa si hay espacios o caracteres extra
3. Regenera la clave en el dashboard del proveedor

### "Payment Failed"

**Causa**: Varias razones dependiendo de la tarjeta/método de pago.

**Soluciones**:
1. Revisa el `failureMessage` en el objeto de pago
2. Usa una tarjeta de prueba diferente
3. Verifica que los datos de la tarjeta sean correctos

---

## Documentación Relacionada

- [Referencia API de Stripe](https://stripe.com/docs/api)
- [Referencia API de MercadoPago](https://www.mercadopago.com/developers/es/reference)
- [Documentación de QZPay Core](../05-api/README.md)
