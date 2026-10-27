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

| Usuario       | Correo                             | Notas                                        |
| ------------- | ---------------------------------- | -------------------------------------------- |
| `demo_ana`    | `demo_ana@demo.cinematch.local`    | Amiga de Luis y Marta. Escribe reseñas.      |
| `demo_luis`   | `demo_luis@demo.cinematch.local`   | Amigo de Ana. Envió una recomendación a Ana. |
| `demo_marta`  | `demo_marta@demo.cinematch.local`  | Amiga de Ana.                                |
| `demo_carlos` | `demo_carlos@demo.cinematch.local` | Tiene una solicitud pendiente hacia Ana.     |

También cargan tres títulos con `fuente = 'demo'`, reseñas, etiquetas, una recomendación, una notificación y estados de biblioteca.

Si `demo_ana` ya existe, los datos de demostración no se vuelven a cargar.

## Idempotencia

Ejecutar los seeds varias veces no duplica datos. Los roles y géneros usan `ON CONFLICT DO NOTHING`, y el administrador y los datos de demostración se omiten si ya existen.
