# Fix: Eliminación de dangerouslySetInnerHTML sin sanitización

**Estado**: ✅ COMPLETADO
**Fecha**: 2026-01-16
**Prioridad**: Alta (Seguridad)

## Problema

Se usaba `dangerouslySetInnerHTML` en múltiples componentes del playground para renderizar traducciones i18n que contenían HTML sin sanitización. Esto representa un riesgo de seguridad XSS (Cross-Site Scripting).

### Archivos Afectados (Original)

1. `/apps/playground/src/features/simulation/SubscriptionsView.tsx` (líneas 588-589, 944-960)
2. `/apps/playground/src/features/simulation/CustomersView.tsx` (líneas 98, 125, 207)
3. `/apps/playground/src/features/catalog/PlansView.tsx` (líneas 134, 254)
4. `/apps/playground/src/features/catalog/PricesView.tsx` (líneas 145, 267)
5. `/apps/playground/src/features/catalog/AddonsView.tsx` (línea 133)
6. `/apps/playground/src/features/setup/SetupView.tsx` (línea 58)

## Análisis

Después de revisar los archivos i18n, encontré que el HTML insertado era **únicamente tags `<strong>`** para énfasis de texto. Esto simplifica la solución.

## Solución Implementada

### Opción Elegida: Componente React Seguro

En lugar de instalar DOMPurify (biblioteca externa), implementé un componente React que:
- Solo permite tags `<strong>` (whitelist approach)
- Convierte todos los demás tags a texto plano
- Previene XSS automáticamente

### Archivos Creados

1. **`/apps/playground/src/hooks/useSafeTranslation.tsx`**
   - `SafeFormattedText`: Componente que renderiza texto con formato seguro
   - `Trans`: Componente helper para traducciones formateadas
   - `useSafeTranslation`: Hook opcional que extiende useTranslation

2. **`/apps/playground/SECURITY.md`**
   - Documentación de seguridad
   - Guía de uso
   - Ejemplos y mejores prácticas

### Archivos Modificados

Todos los archivos que usaban `dangerouslySetInnerHTML` fueron actualizados para usar `SafeFormattedText`:

1. `CustomersView.tsx` - 3 instancias reemplazadas
2. `SubscriptionsView.tsx` - 7 instancias reemplazadas
3. `PlansView.tsx` - 2 instancias reemplazadas
4. `PricesView.tsx` - 2 instancias reemplazadas
5. `AddonsView.tsx` - 1 instancia reemplazada
6. `SetupView.tsx` - 1 instancia reemplazada

## Patrón de Reemplazo

**Antes (INSEGURO):**
```tsx
<p dangerouslySetInnerHTML={{ __html: t('some.key') }} />
```

**Después (SEGURO):**
```tsx
import { SafeFormattedText } from '../../hooks/useSafeTranslation';

<p>
  <SafeFormattedText text={t('some.key')} />
</p>
```

## Características de Seguridad

✅ **Whitelist de Tags**: Solo `<strong>` es convertido a HTML
✅ **XSS Prevention**: Scripts y event handlers son neutralizados
✅ **Sin Dependencias**: No requiere bibliotecas externas
✅ **Type-Safe**: TypeScript completo
✅ **Performance**: Renderizado eficiente con React fragments

## Ejemplo de Protección

```tsx
// Input malicioso
const malicious = "<script>alert('XSS')</script><strong>Safe</strong>";

// Renderizado seguro
<SafeFormattedText text={malicious} />
// Output: <script>alert('XSS')</script><strong>Safe</strong>
// (el script se muestra como texto, no se ejecuta)
```

## Verificación

✅ TypeScript: Sin errores en archivos modificados
✅ Linter: Sin errores de estilo
✅ Búsqueda: 0 instancias de `dangerouslySetInnerHTML` en `/apps/playground/src`

## Mejoras Futuras (Opcionales)

1. **Testing**: Agregar pruebas unitarias cuando se configure vitest/jest
2. **CSP Headers**: Implementar Content Security Policy
3. **i18n Components**: Considerar componentes React en lugar de HTML para formato complejo

## Conclusión

El problema de seguridad ha sido completamente resuelto. Todos los usos de `dangerouslySetInnerHTML` fueron reemplazados por una solución segura y mantenible que previene XSS mientras mantiene la funcionalidad de formato de texto.
