# Plan de Preparación para Producción - QZPay

## Resumen
Total de tareas: **53 tareas atómicas**
Estimación total: **8-10 sprints**

---

## FASE 1: CRÍTICOS (Bloquean Producción)
**Prioridad: URGENTE | Estimación: 2-3 sprints**

### 1.1 MercadoPago - CardToken API
- [ ] **MP-001**: Crear `CardTokenAdapter` en `packages/mercadopago/src/adapters/card-token.adapter.ts`
- [ ] **MP-002**: Implementar método `create(cardId: string): Promise<string>` que llama a MercadoPago CardToken API
- [ ] **MP-003**: Modificar `payment.adapter.ts:74-91` para usar CardTokenAdapter cuando `input.cardId` existe
- [ ] **MP-004**: Agregar tests para CardToken flow
- [ ] **MP-005**: Actualizar README de mercadopago con ejemplo de Card on File

### 1.2 MercadoPago - Checkout Notification URL
- [ ] **MP-006**: Modificar `checkout.adapter.ts` para aceptar `notificationUrl` en config
- [ ] **MP-007**: Agregar `notification_url` al body de Preference creation
- [ ] **MP-008**: Actualizar tests de checkout adapter
- [ ] **MP-009**: Documentar notification_url en README

### 1.3 Hono - Validación Completa
- [ ] **HONO-001**: Crear schema Zod para `CreateSubscriptionInput` en `packages/hono/src/schemas/`
- [ ] **HONO-002**: Crear schema Zod para `UpdateSubscriptionInput`
- [ ] **HONO-003**: Crear schema Zod para `ValidatePromoCodeInput`
- [ ] **HONO-004**: Crear schema Zod para `CreateEntitlementInput`
- [ ] **HONO-005**: Crear schema Zod para `IncrementLimitInput`
- [ ] **HONO-006**: Agregar `zValidator` a ruta POST `/subscriptions`
- [ ] **HONO-007**: Agregar `zValidator` a ruta PATCH `/subscriptions/:id`
- [ ] **HONO-008**: Agregar `zValidator` a ruta POST `/promo-codes/validate`
- [ ] **HONO-009**: Agregar `zValidator` a ruta POST `/entitlements`
- [ ] **HONO-010**: Agregar `zValidator` a ruta POST `/limits/:key/increment`

### 1.4 Hono - Error Handling Normalizado
- [ ] **HONO-011**: Crear `QZPayHttpError` class con código HTTP y error code
- [ ] **HONO-012**: Crear mapper de errores internos a HTTP status codes (404, 409, 422, 500)
- [ ] **HONO-013**: Modificar `createErrorResponse()` para usar HTTP codes correctos
- [ ] **HONO-014**: Agregar middleware de error handling global
- [ ] **HONO-015**: Actualizar tests para verificar status codes correctos

### 1.5 Core - Logger en Event Emitter
- [ ] **CORE-001**: Agregar `logger?: QZPayLogger` al constructor de `QZPayEventEmitter`
- [ ] **CORE-002**: Reemplazar `console.error` por `this.logger?.error()` en event-emitter.ts:51-52
- [ ] **CORE-003**: Reemplazar `console.warn` por `this.logger?.warn()` en event-emitter.ts:106-112
- [ ] **CORE-004**: Actualizar tests de event emitter

### 1.6 Drizzle - Índices y Constraints
- [ ] **DRIZZLE-001**: Crear migración `0001_add_indexes.sql` con índices para foreign keys
- [ ] **DRIZZLE-002**: Agregar índice en `subscriptions.customer_id`
- [ ] **DRIZZLE-003**: Agregar índice en `payments.customer_id`
- [ ] **DRIZZLE-004**: Agregar índice en `payments.subscription_id`
- [ ] **DRIZZLE-005**: Agregar índice en `invoices.customer_id`
- [ ] **DRIZZLE-006**: Agregar índice en `invoices.subscription_id`
- [ ] **DRIZZLE-007**: Agregar índice compuesto en `subscriptions(customer_id, status)`
- [ ] **DRIZZLE-008**: Agregar índice en `customers.external_id`
- [ ] **DRIZZLE-009**: Agregar índice en `customers.email`

### 1.7 React - Compatibilidad SSR
- [ ] **REACT-001**: Crear hook `useIsomorphicLayoutEffect` que usa `useEffect` en servidor
- [ ] **REACT-002**: Reemplazar `useEffect` por `useIsomorphicLayoutEffect` en ThemeContext.tsx
- [ ] **REACT-003**: Agregar verificación `typeof window !== 'undefined'` antes de acceder a `document`
- [ ] **REACT-004**: Agregar tests de SSR con vitest + happy-dom

### 1.8 NestJS - DTOs y Validación
- [ ] **NESTJS-001**: Crear `CreateCustomerDto` con class-validator decorators
- [ ] **NESTJS-002**: Crear `UpdateCustomerDto`
- [ ] **NESTJS-003**: Crear `CreateSubscriptionDto`
- [ ] **NESTJS-004**: Crear `CreatePaymentDto`
- [ ] **NESTJS-005**: Agregar `ValidationPipe` global en módulo
- [ ] **NESTJS-006**: Actualizar controllers para usar DTOs
- [ ] **NESTJS-007**: Crear `QZPayExceptionFilter` para normalizar errores

---

## FASE 2: ALTA PRIORIDAD
**Prioridad: IMPORTANTE | Estimación: 2 sprints**

### 2.1 Stripe - Invoice Adapter
- [x] **STRIPE-001**: Crear `invoice.adapter.ts` en `packages/stripe/src/adapters/`
- [x] **STRIPE-002**: Implementar `list(customerId)`, `retrieve(id)`, `markPaid(id)`
- [x] **STRIPE-003**: Agregar export en `packages/stripe/src/adapters/index.ts`
- [x] **STRIPE-004**: Agregar tests para invoice adapter
- [x] **STRIPE-005**: Actualizar README con documentación de invoices

### 2.2 MercadoPago - Corregir Documentación
- [ ] **MP-010**: Cambiar método `verifyAndParse` a `constructEvent` en README.md
- [ ] **MP-011**: Agregar alias `verifyAndParse` que llama a `constructEvent` para backwards compatibility
- [ ] **MP-012**: Documentar limitación de Split Payments (v2)

### 2.3 React - Memory Leaks
- [ ] **REACT-005**: Agregar `AbortController` a `useCustomer` hook
- [ ] **REACT-006**: Agregar `AbortController` a `useSubscription` hook
- [ ] **REACT-007**: Agregar `AbortController` a `usePlans` hook
- [ ] **REACT-008**: Agregar `AbortController` a `usePayment` hook
- [ ] **REACT-009**: Agregar cleanup en useEffect de todos los hooks
- [ ] **REACT-010**: Corregir ejemplos incorrectos en README.md

### 2.4 Playground - Seguridad
- [ ] **PLAY-001**: Restringir CORS a `http://localhost:5173` en `server/index.ts:99-106`
- [ ] **PLAY-002**: Agregar variable de entorno `ALLOWED_ORIGINS` para configurar CORS
- [ ] **PLAY-003**: Parametrizar test card data (exp_month, exp_year, cvc) en server

### 2.5 Drizzle - Soft Delete
- [ ] **DRIZZLE-010**: Agregar columna `deleted_at` a todas las tablas principales
- [ ] **DRIZZLE-011**: Modificar queries `findById` para excluir `deleted_at IS NOT NULL`
- [ ] **DRIZZLE-012**: Implementar método `softDelete` en repositories
- [ ] **DRIZZLE-013**: Agregar migración para `deleted_at` columns

---

## FASE 3: DOCUMENTACIÓN
**Prioridad: ALTA | Estimación: 1 sprint**

### 3.1 Corregir Documentación Incorrecta
- [ ] **DOCS-001**: Eliminar ejemplo de `billing.promoCodes.create()` en promo-codes.mdx (no existe)
- [ ] **DOCS-002**: Cambiar `customer.externalIds` a `providerCustomerIds` en customers.mdx
- [ ] **DOCS-003**: Eliminar `webhookTolerance` de webhook-handling.mdx (no existe)
- [ ] **DOCS-004**: Cambiar `promoCode` a `promoCodeId` en subscriptions.mdx (EN y ES)
- [ ] **DOCS-005**: Eliminar `paymentMethodId` de subscriptions.create() ejemplo
- [ ] **DOCS-006**: Eliminar eventos `webhook.processed` y `webhook.duplicate` (no existen)

### 3.2 Agregar Documentación Faltante
- [ ] **DOCS-007**: Documentar `billing.subscriptions.changePlan()` en subscription-lifecycle.mdx
- [ ] **DOCS-008**: Crear guía `metrics.mdx` para MRR, churn, revenue
- [ ] **DOCS-009**: Expandir documentación de `billing.addons.*`
- [ ] **DOCS-010**: Documentar estructura exacta de eventos de webhook
- [ ] **DOCS-011**: Agregar `proration` → `prorationBehavior` corrección

### 3.3 Sincronizar Traducciones
- [ ] **DOCS-012**: Sincronizar cambios de EN a ES en subscriptions.mdx
- [ ] **DOCS-013**: Sincronizar cambios de EN a ES en customers.mdx
- [ ] **DOCS-014**: Sincronizar cambios de EN a ES en webhook-handling.mdx
- [ ] **DOCS-015**: Sincronizar cambios de EN a ES en promo-codes.mdx

---

## FASE 4: MEDIA PRIORIDAD
**Prioridad: MEDIA | Estimación: 2 sprints**

### 4.1 Core - Mejoras de Tipos
- [ ] **CORE-005**: Normalizar metadata a `Record<string, string | number | boolean | null>`
- [ ] **CORE-006**: Crear `QZPayValidationError` class con campo y mensaje
- [ ] **CORE-007**: Crear `QZPayNotFoundError` class con entityType y entityId
- [ ] **CORE-008**: Crear `QZPayConflictError` class
- [ ] **CORE-009**: Usar nuevas clases de error en billing.ts

### 4.2 Core - Validación Mejorada
- [ ] **CORE-010**: Mejorar regex de email en validation.utils.ts (RFC 5322 o librería)
- [ ] **CORE-011**: Agregar validación de cantidad negativa en billing.ts
- [ ] **CORE-012**: Agregar validación de currency contra lista válida

### 4.3 Core - Idempotencia
- [ ] **CORE-013**: Crear `ProcessingState` interface para subscription-lifecycle
- [ ] **CORE-014**: Guardar estado ANTES de procesar payment en renewal
- [ ] **CORE-015**: Verificar estado previo antes de re-procesar

### 4.4 Stripe - Mejoras
- [ ] **STRIPE-006**: Agregar validación de `subscription.items.data.length > 0` en update
- [ ] **STRIPE-007**: Documentar límite de 1 item por suscripción en README
- [ ] **STRIPE-008**: Aplicar `toStripeMetadata()` en setup-intent.adapter.ts:25
- [ ] **STRIPE-009**: Validar currency contra lista de Stripe
- [ ] **STRIPE-010**: Agregar comentario documentando límites de metadata Stripe

### 4.5 Hono - Tests
- [ ] **HONO-016**: Agregar tests de error scenarios (404, 422, 409)
- [ ] **HONO-017**: Agregar tests de rate limit breach
- [ ] **HONO-018**: Agregar tests de validation failures
- [ ] **HONO-019**: Agregar tests de concurrencia

### 4.6 React - Tests
- [ ] **REACT-011**: Agregar tests de SSR con happy-dom
- [ ] **REACT-012**: Agregar tests de memory leak detection
- [ ] **REACT-013**: Agregar tests de rapid updates
- [ ] **REACT-014**: Agregar tests de integración entre hooks

---

## FASE 5: BAJA PRIORIDAD (Mejoras UX)
**Prioridad: BAJA | Estimación: 1 sprint**

### 5.1 Playground - UX
- [ ] **PLAY-004**: Reemplazar `confirm()` nativo con Modal de confirmación
- [ ] **PLAY-005**: Agregar toast notifications (sonner o react-toastify)
- [ ] **PLAY-006**: Agregar debounce a botones de acción
- [ ] **PLAY-007**: Implementar Edit Customer modal
- [ ] **PLAY-008**: Agregar Stripe Saved Cards UI (similar a MercadoPago)
- [ ] **PLAY-009**: Corregir dos statements en una línea en SubscriptionsView.tsx:355,448

### 5.2 Playground - i18n
- [ ] **PLAY-010**: Agregar key `payments.oneTime.modalTitle` a simulation.json
- [ ] **PLAY-011**: Agregar key `payments.oneTime.customerLabel` a simulation.json
- [ ] **PLAY-012**: Agregar key `payments.oneTime.amountLabel` a simulation.json
- [ ] **PLAY-013**: Agregar key `subscriptions.modal.promoCodeLabel` a simulation.json
- [ ] **PLAY-014**: Auditar todos los `t()` calls y agregar keys faltantes

### 5.3 Core - Optimizaciones
- [ ] **CORE-016**: Mover `createSavedCardService` stub a documentación clara
- [ ] **CORE-017**: Agregar logging hooks opcionales en EventEmitter

---

## Orden de Ejecución Recomendado

```
Semana 1-2: FASE 1.1-1.4 (MercadoPago + Hono críticos)
Semana 3:   FASE 1.5-1.8 (Core + Drizzle + React + NestJS)
Semana 4:   FASE 2.1-2.3 (Stripe + React memory leaks)
Semana 5:   FASE 2.4-2.5 + FASE 3.1 (Playground + Docs incorrectos)
Semana 6:   FASE 3.2-3.3 (Docs nuevos + traducciones)
Semana 7:   FASE 4.1-4.3 (Core mejoras)
Semana 8:   FASE 4.4-4.6 (Stripe + Tests)
Semana 9:   FASE 5.1-5.3 (UX + i18n + optimizaciones)
```

---

## Métricas de Éxito

- [ ] Build pasa sin errores
- [ ] Typecheck pasa sin errores
- [ ] Lint pasa (o solo warnings menores de complejidad)
- [ ] Tests pasan (500+ tests)
- [ ] Documentación sincronizada con código
- [ ] Playground funciona con Stripe Y MercadoPago
- [ ] Card on File funciona en MercadoPago
- [ ] SSR funciona en React (Next.js compatible)
- [ ] HTTP status codes correctos en Hono

---

## Notas

- Cada tarea debe tener su propio commit con mensaje descriptivo
- Ejecutar `pnpm build && pnpm typecheck && pnpm test` después de cada fase
- Actualizar CHANGELOG.md con cada fase completada
- Considerar release v1.1.0 después de Fase 1-2
- Considerar release v1.2.0 después de todas las fases
