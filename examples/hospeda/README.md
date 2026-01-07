# Hospeda - Portal Turístico

Ejemplo completo de integración de QZPay para un portal turístico donde propietarios publican alojamientos.

## Modelo de Negocio

- **Suscripción mensual base**: Planes para publicar alojamientos
- **Add-ons mensuales**: Servicios premium recurrentes (destacar en búsquedas, más fotos, etc.)
- **Pagos únicos**: Servicios especiales (sesión de fotos profesional, verificación premium, etc.)

## Estructura

```
hospeda/
├── config.ts           # Configuración de QZPay
├── plans.ts            # Definición de planes y precios
├── services.ts         # Lógica de negocio de billing
├── routes.ts           # API routes (Hono)
├── webhooks.ts         # Manejo de webhooks
└── types.ts            # Tipos específicos de Hospeda
```

## Planes

| Plan | Precio | Alojamientos | Fotos/Aloj | Destacado |
|------|--------|--------------|------------|-----------|
| Básico | $9.99/mes | 1 | 5 | No |
| Profesional | $29.99/mes | 5 | 15 | Sí |
| Agencia | $99.99/mes | Ilimitados | Ilimitadas | Sí + Badge |

## Add-ons Mensuales

- **Destacar Plus**: $4.99/mes - Aparece primero en búsquedas
- **Galería Extended**: $2.99/mes - +10 fotos por alojamiento
- **Estadísticas Pro**: $7.99/mes - Analytics detallado
- **Verificado**: $9.99/mes - Badge de verificado

## Servicios Únicos

- **Sesión de Fotos**: $149 - Fotógrafo profesional
- **Video Tour**: $299 - Video profesional del alojamiento
- **Setup Premium**: $49 - Configuración asistida del perfil
