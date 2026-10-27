# Seguridad base de la API

La configuración está en `src/config/security.ts` y se aplica en `src/app.ts`, en este orden:

1. **Cabeceras** (`helmet`): `nosniff`, `X-Frame-Options`, política de contenido, y sin `X-Powered-By`.
2. **CORS** (`cors`): solo se permite el origen de `WEB_URL`, con credenciales.
3. **Límites de tasa** (`express-rate-limit`): general para `/api` y más estricto para `/api/auth`. Al superarlos responde 429.
4. **CSRF**: las peticiones que cambian estado (`POST`, `PUT`, `PATCH`, `DELETE`) deben traer `Origin`, o `Referer` si falta `Origin`, igual a `WEB_URL`. Si no, responde 403.
5. **Tamaño del cuerpo**: JSON de hasta 100 kB. Si se supera, responde 413.

## Desarrollo y producción

| Ajuste                              | Desarrollo                         | Producción  |
| ----------------------------------- | ---------------------------------- | ----------- |
| Límite general (por minuto)         | 1000                               | 120         |
| Límite de `/api/auth` (cada 15 min) | 100                                | 10          |
| `WEB_URL`                           | Opcional (`http://localhost:3000`) | Obligatoria |

## Variables

- `WEB_URL`: origen de la web para CORS y CSRF.
- `TRUST_PROXY`: `true` solo detrás de un balanceador, para que los límites de tasa usen la IP real del cliente.

## Cookie de sesión

La cookie de sesión se emite en BE-3.2 con `HttpOnly`, `SameSite=Lax` y sin `Max-Age`. Junto con la validación de `Origin`, cubre el CSRF de formularios de otros sitios.
