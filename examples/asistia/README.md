# Asistia - Plataforma de Asistentes IA

Ejemplo completo de integración de QZPay para una plataforma SaaS de asistentes IA con modelo de uso.

## Modelo de Negocio

- **Suscripción mensual base**: Planes con límites de uso
- **Uso incluido**: Mensajes, tokens, sesiones según plan
- **Overage**: Cobro automático por uso excedente
- **Add-ons mensuales**: Features especiales recurrentes
- **Servicios únicos**: Configuración de bots, integraciones custom

## Estructura

```
asistia/
├── config.ts           # Configuración de QZPay
├── plans.ts            # Definición de planes y precios
├── usage.ts            # Tracking y cobro de uso
├── services.ts         # Lógica de negocio
├── routes.ts           # API routes (Hono)
├── webhooks.ts         # Manejo de webhooks
└── types.ts            # Tipos específicos
```

## Planes

| Plan | Precio | Mensajes | Tokens | Bots | Integraciones |
|------|--------|----------|--------|------|---------------|
| Starter | $19/mes | 1,000 | 100K | 1 | 2 |
| Growth | $49/mes | 5,000 | 500K | 3 | 5 |
| Business | $149/mes | 20,000 | 2M | 10 | Ilimitadas |
| Enterprise | Custom | Ilimitado | Custom | Ilimitado | Ilimitadas |

## Overage (Uso Excedente)

- **Mensajes extra**: $0.01/mensaje
- **Tokens extra**: $0.002/1K tokens
- **Bots adicionales**: $9.99/mes cada uno

## Add-ons Mensuales

- **Analytics Pro**: $14.99/mes - Dashboard avanzado
- **API Access**: $29.99/mes - Acceso API REST completo
- **White Label**: $49.99/mes - Sin branding de Asistia
- **Priority Support**: $19.99/mes - Soporte 24/7

## Servicios Únicos

- **Bot Setup**: $99 - Configuración inicial de bot
- **Custom Integration**: $299 - Integración personalizada
- **Training Session**: $149 - Sesión de entrenamiento 1:1
- **Data Migration**: $199 - Migración de datos
