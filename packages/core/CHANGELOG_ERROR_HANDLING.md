# Error Handling Improvements - Changelog

## Summary

Eliminados errores silenciosos en el paquete Core y estandarizado el manejo de errores con códigos consistentes y logging estructurado.

## Archivos Modificados

### Nuevos Archivos

1. **`src/errors/error-codes.ts`**
   - Constantes de códigos de error estandarizados
   - Organizados por categoría (validación, proveedor, pagos, etc.)
   - Incluye descripciones para cada código

2. **`src/errors/provider-sync.error.ts`**
   - Nueva clase `QZPayProviderSyncError` para errores de sincronización
   - Incluye provider, operation y causa del error
   - Metadata estructurado con contexto completo

3. **`src/errors/README.md`**
   - Documentación completa del sistema de errores
   - Guías de uso y mejores prácticas
   - Ejemplos de testing y manejo de errores

### Archivos Modificados

1. **`src/billing.ts`** (Cambios principales)

#### Nueva Configuración

```typescript
interface QZPayBillingConfig {
  // ... existing config
  providerSyncErrorStrategy?: 'throw' | 'log';
}
```

#### Cambios en `customers.create()`

**Antes:**
```typescript
} catch (error) {
  // If provider sync fails, still return the customer
  this.logger.error('Failed to create customer in provider', {
    provider: paymentAdapter.provider,
    error: error instanceof Error ? error.message : String(error)
  });
  await emitter.emit('customer.created', customer);
  return customer; // ❌ Error silencioso - usuario no sabe que falló
}
```

**Después:**
```typescript
} catch (error) {
  const syncError = new QZPayProviderSyncError(
    `Failed to create customer in ${paymentAdapter.provider}`,
    paymentAdapter.provider,
    'create_customer',
    { customerId: customer.id, externalId: input.externalId },
    error instanceof Error ? error : undefined
  );

  logger.error('Provider sync failed during customer creation', {
    provider: paymentAdapter.provider,
    customerId: customer.id,
    externalId: input.externalId,
    operation: 'create_customer',
    error: error instanceof Error ? error.message : String(error),
    errorCode: QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED
  });

  if (providerSyncErrorStrategy === 'throw') {
    // ✅ Lanza error y hace rollback del customer
    await storage.customers.delete(customer.id);
    throw syncError;
  }

  // ✅ Estrategia 'log': Continúa pero loguea claramente
  logger.warn('Continuing customer creation without provider sync', {
    customerId: customer.id,
    provider: paymentAdapter.provider
  });
  await emitter.emit('customer.created', customer);
  return customer;
}
```

#### Cambios en `customers.syncUser()`

Aplicados los mismos cambios en dos lugares:
1. Al sincronizar customer existente (línea 900+)
2. Al crear nuevo customer en syncUser (línea 963+)

#### Cambios en `payments.process()`

**Antes:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown payment error';
  this.logger.error('Payment processing failed', {
    provider: paymentAdapter.provider,
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
    error: errorMessage
  });
  const failed = await storage.payments.update(paymentId, {
    status: 'failed',
    failureMessage: errorMessage,
    failureCode: 'payment_failed' // ❌ Código hardcodeado
  });
  await emitter.emit('payment.failed', failed);
  return failed;
}
```

**Después:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown payment error';

  logger.error('Payment processing failed', {
    provider: paymentAdapter.provider,
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
    paymentId,
    operation: 'process_payment',
    error: errorMessage,
    errorCode: QZPayErrorCode.PROVIDER_PAYMENT_FAILED // ✅ Código estandarizado
  });

  const failed = await storage.payments.update(paymentId, {
    status: 'failed',
    failureMessage: errorMessage,
    failureCode: QZPayErrorCode.PAYMENT_FAILED // ✅ Código estandarizado
  });

  await emitter.emit('payment.failed', failed);
  return failed; // ✅ Devuelve payment failed (no throw - comportamiento correcto)
}
```

2. **`src/errors/index.ts`**
   - Exporta nueva clase `QZPayProviderSyncError`
   - Exporta constantes `QZPayErrorCode` y `QZPayErrorCodeDescription`

## Comportamiento Nuevo

### Estrategia de Errores de Sincronización

#### Modo 'throw' (Default en producción)
- ✅ Lanza `QZPayProviderSyncError` si falla sincronización con proveedor
- ✅ Hace rollback del registro local (customer eliminado)
- ✅ Usuario debe manejar el error explícitamente
- ✅ Garantiza consistencia entre local y proveedor

#### Modo 'log' (Default en desarrollo)
- ✅ Loguea error pero continúa operación
- ✅ Crea registro local sin vinculación al proveedor
- ✅ Permite testing sin credenciales reales
- ✅ Puede sincronizarse más tarde con `syncUser()`

## Códigos de Error Estandarizados

### Categorías Implementadas

| Categoría | Rango | Ejemplos |
|-----------|-------|----------|
| Validación | 1000-1999 | `invalid_email`, `invalid_amount` |
| Not Found | 2000-2999 | `customer_not_found`, `plan_not_found` |
| Conflictos | 3000-3999 | `duplicate_resource`, `resource_already_exists` |
| Proveedor | 4000-4999 | `provider_sync_failed`, `provider_not_linked` |
| Pagos | 5000-5999 | `payment_failed`, `payment_declined` |
| Suscripciones | 6000-6999 | `subscription_expired`, `renewal_failed` |
| Facturas | 7000-7999 | `invoice_creation_failed` |
| Genéricos | 9000-9999 | `internal_error`, `unknown_error` |

## Logging Estructurado

Todos los errores ahora incluyen contexto estructurado:

```typescript
logger.error('Operation failed', {
  provider: 'stripe',
  customerId: 'cus_123',
  operation: 'create_customer',
  error: 'API timeout',
  errorCode: QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED,
  // ... más contexto relevante
});
```

## Breaking Changes

### API Pública

❌ **NO hay breaking changes en la API pública**

- Todas las funciones mantienen las mismas firmas
- Comportamiento por defecto basado en `livemode`
- Nueva opción `providerSyncErrorStrategy` es opcional

### Comportamiento

✅ **Cambio de comportamiento (configurable)**

**En producción (livemode: true):**
```typescript
// ANTES: Creaba customer localmente aunque fallara provider (silencioso)
const customer = await billing.customers.create(input);

// AHORA: Lanza QZPayProviderSyncError si falla (configurable)
try {
  const customer = await billing.customers.create(input);
} catch (error) {
  if (error instanceof QZPayProviderSyncError) {
    // Manejar error de sincronización
  }
}

// O mantener comportamiento anterior:
const billing = createQZPayBilling({
  // ...
  providerSyncErrorStrategy: 'log' // ← Comportamiento anterior
});
```

## Mejoras de Seguridad

1. ✅ No más errores silenciosos en operaciones críticas
2. ✅ Logging estructurado para auditoría
3. ✅ Códigos de error consistentes para monitoreo
4. ✅ Rollback automático en fallos de sincronización

## Testing

Los tests existentes pasan correctamente:
- ✅ 1438 tests passed
- ✅ Build exitoso (sin errores en billing.ts)
- ⚠️ 29 tests fallan por código no relacionado (qzpayValidateMetadata no existe)

## Próximos Pasos

### Recomendaciones Adicionales

1. **Event Handler Logging** (event-handler.ts línea 207)
   - Reemplazar `console.error` con logger estructurado
   - Requiere cambiar firma de función para aceptar logger

2. **Clases de Error Adicionales**
   - `QZPayAuthenticationError` - Fallos de autenticación
   - `QZPayRateLimitError` - Rate limiting
   - `QZPayTimeoutError` - Timeouts de operaciones
   - `QZPayNetworkError` - Problemas de red

3. **Errores en Subscription Lifecycle**
   - Revisar errores de metadata en subscription-lifecycle.service.ts
   - Estandarizar códigos de error

## Documentación

Ver `src/errors/README.md` para:
- Guía completa de uso
- Ejemplos de código
- Mejores prácticas
- Estrategias de testing
- Guía de migración

## Ejemplo de Uso Completo

```typescript
import {
  createQZPayBilling,
  QZPayProviderSyncError,
  QZPayErrorCode
} from '@qazuor/qzpay-core';

const billing = createQZPayBilling({
  storage: myStorage,
  paymentAdapter: stripeAdapter,
  livemode: true, // Usa 'throw' por defecto
  logger: myLogger,
});

// Customer Creation
try {
  const customer = await billing.customers.create({
    email: 'user@example.com',
    externalId: 'user-123',
  });
  console.log('Customer created:', customer.id);
} catch (error) {
  if (error instanceof QZPayProviderSyncError) {
    console.error(`Failed to sync with ${error.provider}`);
    console.error(`Operation: ${error.operation}`);
    console.error(`Cause: ${error.cause?.message}`);
    // Mostrar error al usuario
  }
}

// Payment Processing
const payment = await billing.payments.process({
  customerId: 'cus_123',
  amount: 1000,
  currency: 'USD',
});

if (payment.status === 'failed') {
  console.error('Payment failed:', payment.failureMessage);
  console.error('Error code:', payment.failureCode);
  // Manejar fallo de pago
} else {
  console.log('Payment successful:', payment.id);
}
```

## Métricas

- **Errores silenciosos eliminados:** 3 (customers.create, syncUser 2x)
- **Códigos de error estandarizados:** 40+
- **Nuevas clases de error:** 1 (QZPayProviderSyncError)
- **Archivos de documentación:** 2 (README.md, CHANGELOG)
- **Líneas de código modificadas:** ~150
- **Nivel de logging mejorado:** Todos los errores ahora estructurados
