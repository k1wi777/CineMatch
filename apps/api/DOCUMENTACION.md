# Documentación de la API y reglas de negocio

## OpenAPI

La especificación se genera en tiempo de ejecución a partir del registro `src/lib/openapi.ts` y de los esquemas Zod de `packages/shared`.

- `GET /api/docs.json`: especificación OpenAPI 3.1.
- `GET /api/docs/`: Swagger UI.

Ambas rutas solo existen fuera de producción (`NODE_ENV !== "production"`).

### Convención para registrar un endpoint

Cada módulo registra sus endpoints junto a su ruta, para que la documentación no se quede desfasada:

```ts
import { registroOpenApi } from "../../lib/openapi.js";

registroOpenApi.registrarEsquema("ReciboRecomendacion", ReciboRecomendacionSchema);
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/recommendations",
  resumen: "Enviar una recomendación a un amigo",
  respuestas: {
    201: { descripcion: "Recomendación enviada.", esquema: "ReciboRecomendacion" },
    422: { descripcion: "Los datos no son válidos.", esquema: "ErrorResponse" },
  },
});
```

- Los esquemas que se devuelven o se reciben deben vivir en `packages/shared`, y se registran por nombre.
- Los errores usan siempre el esquema `ErrorResponse`.
- Un endpoint nuevo sin registro no falla, pero no aparece en la documentación: añadirlo forma parte de su issue.

## Reglas de negocio

Los valores están en `src/config/business-rules.ts` y vienen del ERS. Pueden cambiarse por variable de entorno; un valor inválido impide arrancar y el error nombra la variable.

| Variable                      | Por defecto | Uso                                             |
| ----------------------------- | ----------- | ----------------------------------------------- |
| `TAG_MIN_REVIEWS`             | 3           | Etiquetas de la comunidad (RN7)                 |
| `COMMUNITY_MIN_RATINGS`       | 5           | Mínimo de calificaciones para el ranking (RN15) |
| `COMMUNITY_CACHE_TTL_MINUTES` | 60          | Caché del ranking de la comunidad (RN15)        |
| `SESSION_IDLE_MINUTES`        | 30          | Expiración de la sesión por inactividad         |
| `LOGIN_MAX_ATTEMPTS`          | 5           | Intentos fallidos antes del bloqueo             |
| `LOGIN_LOCK_MINUTES`          | 15          | Duración del bloqueo                            |
| `RESET_TOKEN_TTL_MINUTES`     | 60          | Vigencia del enlace de recuperación (RF4)       |

### Convención

- Los servicios importan las reglas con `reglasDeNegocio(env)` desde `config/business-rules`.
- Ningún número de regla se escribe en un servicio.
