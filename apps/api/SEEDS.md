# Seeds de la base de datos

Los seeds cargan los datos que el sistema necesita para arrancar y, opcionalmente, datos de demostración para probar los flujos en local. Están en `apps/api/seeds/`.

## Comandos

Desde la raíz del repositorio, después de `pnpm migrate:up`:

- `pnpm seed`: crea los roles `usuario` y `administrador`, y el administrador inicial si las variables `ADMIN_*` están definidas.
- `pnpm seed:demo`: hace lo mismo y además carga los datos de demostración. Se rechaza si `NODE_ENV=production`.

Ambos comandos usan `DATABASE_URL` de `apps/api/.env`.

## Administrador inicial

Define estas variables en `apps/api/.env`:

| Variable         | Descripción                                           |
| ---------------- | ----------------------------------------------------- |
| `ADMIN_EMAIL`    | Correo del administrador. Se usa para iniciar sesión. |
| `ADMIN_USERNAME` | Username público del administrador.                   |
| `ADMIN_PASSWORD` | Contraseña. Se guarda con hash `argon2id`.            |

- Si las tres están vacías, no se crea administrador.
- Si solo algunas están definidas, el seed falla y nombra las que faltan.
- Si ya existe un usuario con ese correo o username (sin distinguir mayúsculas), se omite.

## Datos de demostración

Solo para desarrollo. Los usuarios comparten la contraseña `Demo1234!`.

| Usuario  | Correo             | Notas                                        |
| -------- | ------------------ | -------------------------------------------- |
| `Ana`    | `ana@gmail.com`    | Amiga de Luis y Marta. Escribe reseñas.      |
| `Luis`   | `luis@gmail.com`   | Amigo de Ana. Envió una recomendación a Ana. |
| `Marta`  | `marta@gmail.com`  | Amiga de Ana.                                |
| `Carlos` | `carlos@gmail.com` | Tiene una solicitud pendiente hacia Ana.     |

También cargan tres títulos con `fuente = 'demo'`, reseñas, etiquetas, una recomendación, una notificación y estados de biblioteca.

Si `Ana` ya existe, los datos de demostración no se vuelven a cargar.

## Idempotencia

Ejecutar los seeds varias veces no duplica datos. Los roles y géneros usan `ON CONFLICT DO NOTHING`, y el administrador y los datos de demostración se omiten si ya existen.

## Catálogo inicial (`pnpm seed:catalog`)

Carga entre 500 y 1000 títulos populares (mitad películas, mitad series) con sus géneros.

- Con `TMDB_API_KEY` definida usa TMDB; sin ella usa el proveedor de prueba, que no necesita red.
- Es idempotente: repetirlo actualiza los títulos sin duplicarlos.
- `--total=N` ajusta el total (entero entre 500 y 1000). Por defecto son 600.

## Sincronización periódica

Desactivada por defecto. Con `CATALOGO_SYNC_HABILITADA=true` se ejecuta según `CATALOGO_SYNC_CRON` (por defecto, cada domingo a las 03:00 UTC). Si el proveedor falla, la ejecución queda registrada como error y el catálogo existente se conserva.

## Datos de demostración ampliados (`pnpm seed:demo-rico`)

Carga perfiles con uso real para presentaciones: 15 usuarios con intereses, 308 reseñas (calificación, comentario, spoilers y etiquetas), 287 títulos en biblioteca, 60 recomendaciones entre amigos en distintos estados, 60 amistades y 175 notificaciones coherentes entre sí. Los títulos son reales del catálogo de TMDB, con póster.

- Orden: `pnpm migrate:up`, luego `pnpm seed` y `pnpm seed:catalog` (necesario: los títulos deben existir en el catálogo), y por último `pnpm seed:demo-rico`. No ejecutar `seed:demo` antes: crea a Ana, Luis, Marta y Carlos con otra contraseña.
- Reutiliza usuarios existentes y no reemplaza datos.
- Es idempotente: si ya se cargó (existe el usuario `Camilo_Pacheco`), no hace nada.
- Contraseña de los usuarios creados: `Demo12345678!`. Solo para desarrollo; `NODE_ENV=production` lo rechaza.
