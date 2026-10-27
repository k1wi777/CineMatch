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

## Revisión de seguridad del backend (BE-13.2)

Checklist del ERS revisado sobre el código de `main`.

| Punto                           | Resultado                                                                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash de contraseñas             | argon2id en `src/lib/password.ts`. Las contraseñas de cuentas eliminadas se reemplazan por un hash aleatorio.                                                                                                                                         |
| Consultas parametrizadas        | Todas las consultas usan `$n`. Lo que se interpola en SQL son literales del código (orden, dirección, filtros de visibilidad), nunca entrada del cliente.                                                                                             |
| Sanitización de texto           | Comentarios, nombres, biblioteca y motivos quitan etiquetas HTML al guardarse. El correo escapa el HTML del enlace.                                                                                                                                   |
| Autorización por recurso        | Reseñas: solo el autor puede editar o eliminar. Amistades: solo las partes, y solo el receptor responde. Recomendaciones: solo emisor y receptor; terceros reciben 404. Biblioteca y perfil: id desde la sesión. Administración: rol `administrador`. |
| Cabeceras (`helmet`)            | Activas en toda la API. El manejador de avatares añade `X-Content-Type-Options: nosniff`.                                                                                                                                                             |
| Límites de tasa                 | General y de autenticación, con límites distintos en desarrollo y producción.                                                                                                                                                                         |
| CSRF                            | Toda petición que cambia estado exige `Origin` o `Referer` del front.                                                                                                                                                                                 |
| Cookie de sesión                | `HttpOnly`, `SameSite=Lax`, `Secure` en producción.                                                                                                                                                                                                   |
| Visibilidad de reseñas (BE-9.4) | Todas las lecturas que muestran contenido de reseñas usan `visibleReviewsFilter` o `canViewerSee`. Las demás consultas son agregados anónimos sobre `visible`, la biblioteca propia o la moderación de administración.                                |
| Datos personales en logs        | Los registros usan identificadores, nunca correo, nombre ni contraseña.                                                                                                                                                                               |

### Hallazgos

1. **Avatares y CORP.** `helmet` aplica `Cross-Origin-Resource-Policy: same-origin`. Las imágenes solo se ven si el front las pide por su proxy (`/uploads/*`), tal como indica BE-4.4.
2. **Reenvío de solicitudes rechazadas.** No hay límite de frecuencia. Pendiente de decidir (BE-7.1).
3. **Cambio de contraseña.** La contraseña actual incorrecta no cuenta para el bloqueo de inicio de sesión. Quien tenga una sesión abierta podría probar contraseñas, limitado solo por el límite general (BE-4.2).
4. **Autor eliminado.** Sus reseñas siguen visibles con el autor anonimizado, como exige BE-13.1. Esto cambia la regla de BE-9.4, que antes las ocultaba.
5. **Búsqueda de usuarios.** `LIKE` sobre `lower(username)` no usa índice para coincidencias en medio del texto (BE-7.5).

Los hallazgos 2 y 3 quedan para decisión de producto; el 1 y el 5 son trabajo de frontend y rendimiento.
