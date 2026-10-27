# @cinematch/shared

Contratos compartidos entre la API y la web: esquemas Zod, tipos inferidos y enums de dominio.

## Reglas

- **Cada contrato se define una sola vez, aquí.** La API y la web importan desde `@cinematch/shared`; no se copian esquemas ni tipos de dominio en otros paquetes.
- **Solo se importa desde la raíz del paquete** (`@cinematch/shared`). El `exports` del paquete bloquea los archivos internos.
- **Sin dependencias de base de datos, framework ni entorno.** Este paquete solo describe datos.
- **Sin compilación manual.** Se consume como código TypeScript fuente, tanto en desarrollo como en tests.
- **Imports relativos con extensión `.js`** dentro de `src/` (requerido por `moduleResolution: NodeNext`).

## Estructura

```text
src/
├─ index.ts                  API pública: único punto de exportación
├─ contracts/                formatos de respuesta de la API
│  ├─ errors.ts              ErrorResponseSchema: { error: { code, message, fields? } }
│  └─ health.ts              HealthResponseSchema: GET /api/health
└─ domain/                   enums de dominio
   ├─ library.ts             LIBRARY_STATUSES: pendiente, viendo, vista, abandonada
   ├─ notification.ts        NOTIFICATION_TYPES: los 6 tipos de notificación
   ├─ recommendation.ts      RECOMMENDATION_STATUSES y RECOMMENDATION_ACTIONS
   └─ review-visibility.ts   REVIEW_VISIBILITIES: publica, amigos
```

Cada archivo exporta un `const` con los valores, su esquema Zod (`...Schema`) y su tipo (`...`), por ejemplo `LibraryStatusSchema` y `LibraryStatus`.

## Añadir un contrato

1. Crear el archivo en `contracts/` o `domain/`.
2. Reexportarlo desde `src/index.ts`.
3. Importarlo desde `@cinematch/shared` en la API o en la web.

Las transiciones de estado (qué acción produce qué estado) no viven aquí: pertenecen al módulo de cada épica, por ejemplo BE-10.1.
