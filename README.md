# CineMatch

Plataforma web de reseñas y recomendaciones de películas y series. Permite descubrir títulos, calificarlos y reseñarlos, seguir una biblioteca personal, conectar con amigos y recibir recomendaciones con contexto.


---

## Índice

- [Estado del proyecto](#estado-del-proyecto)
- [Alcance de la Fase 1](#alcance-de-la-fase-1)
- [Stack técnico](#stack-técnico)
- [Arquitectura objetivo](#arquitectura-objetivo)
- [Puesta en marcha](#puesta-en-marcha)
- [Organización del trabajo](#organización-del-trabajo)
- [Documentación](#documentación)

---

## Estado del proyecto

CineMatch está implementado de extremo a extremo: API (backend BE-0 a BE-13) y aplicación web (frontend FE-0 a FE-11). Los flujos cubiertos son registro e inicio de sesión, catálogo y ficha de título, reseñas, biblioteca, amigos, recomendaciones dirigidas y generales, notificaciones en tiempo real y administración (sincronización del catálogo y moderación de reseñas).

El trabajo se gestiona como épicas e issues en [GitHub Issues](https://github.com/k1wi777/CineMatch/issues): épicas `BE-0` a `BE-13` y `FE-0` a `FE-11`. Cada issue hija se entrega en su propia rama y su pull request.

---

## Alcance de la Fase 1

La Fase 1 cubre el producto completo de reseñas y recomendaciones:

- **Cuenta y sesiones:** registro con intereses mínimos, login, logout, recuperación de contraseña y sesiones en servidor.
- **Perfil:** datos personales, intereses, avatar local y eliminación de cuenta con anonimización.
- **Amistades:** búsqueda de usuarios, solicitudes, aceptación, cancelación y eliminación.
- **Catálogo:** películas y series sincronizadas desde TMDB, búsqueda y filtros.
- **Biblioteca personal:** estados `pendiente`, `viendo`, `vista` y `abandonada`.
- **Reseñas:** calificación con medios pasos, comentario, etiquetas, visibilidad pública o solo para amigos y spoilers.
- **Recomendaciones dirigidas:** envío a amigos, motivo, reseña adjunta, aceptación, descarte y cierre al calificar.
- **Recomendaciones de la comunidad:** ranking con arranque en frío y relleno por popularidad.
- **Notificaciones:** persistencia y entrega en tiempo real por SSE.
- **Administración:** sincronización de catálogo y moderación de reseñas.
- **Derechos de datos:** exportación y eliminación conforme a la Ley 1581.

### Fuera de alcance en esta fase

- Fases 2 y 3 del ERS: listas personalizadas y compartidas, temporadas y episodios, recomendaciones personalizadas por historial y afinidad, reportes de usuarios, entre otras.
- Login social, 2FA y verificación de correo.
- CI/CD, despliegue y Kubernetes como parte de la fundación del monorepo.
- "Dónde ver" y títulos similares.

---

## Stack técnico

| Área | Tecnología |
|---|---|
| Monorepo | pnpm workspaces |
| API | Node.js + TypeScript + Express (monolito modular) |
| Base de datos | PostgreSQL 16 + `pg`, SQL parametrizado, sin ORM |
| Web | Next.js App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Datos del servidor | TanStack Query |
| Formularios | React Hook Form + Zod |
| Contratos compartidos | `packages/shared` con esquemas Zod y tipos |
| Autenticación | Sesiones en servidor + cookie `httpOnly`, hash `argon2id` |
| Tiempo real | Server-Sent Events (SSE) |
| Catálogo externo | TMDB |
| Pruebas backend | Vitest + Supertest |
| Pruebas E2E | Playwright |
| Entorno local | Docker Compose: PostgreSQL 16 y Mailpit |

Puertos locales previstos: web `3000`, API `4000`, PostgreSQL `5432`, Mailpit SMTP `1025` y Mailpit UI `8025`.

---

## Arquitectura objetivo

### Estructura del monorepo

```text
cinematch/
├─ apps/
│  ├─ api/src/{lib,middleware,config,modules,jobs}
│  └─ web/src/{app,shared,features}
├─ packages/shared/src
├─ docker-compose.yml
├─ pnpm-workspace.yaml
└─ README.md
```

### Backend

Cada módulo vive en `apps/api/src/modules/<modulo>/` y sigue una cadena explícita:

```text
<modulo>.routes.ts
  → <modulo>.controller.ts
  → <modulo>.service.ts
  → <modulo>.repository.ts (interfaz)
      → postgres-<modulo>.repository.ts (implementación)
```

Cada módulo incluye además `<modulo>.dto.ts`, `<modulo>.errors.ts` e `<modulo>.interfaces.ts`.

Reglas estructurales:

- Un servicio solo accede a su propio repositorio.
- Entre módulos se llaman servicios o se usan eventos de dominio.
- Los repositorios aceptan un `executor`: pool o cliente de transacción.
- Los eventos se emiten después del commit, salvo los que deben formar parte de la misma transacción.
- La base de datos usa `snake_case`; el JSON de la API usa `camelCase`. El mapeo vive en el repositorio.

### Frontend

Organización *feature-first*:

```text
apps/web/src/features/<x>/{api,hooks,components,pages,schemas}
```

Cada feature expone su API pública mediante `index.ts`. Una feature no importa archivos internos de otra.

### Mismo origen

Next.js hace proxy de `/api/*` y `/uploads/*` hacia `http://localhost:4000` mediante `rewrites`. Así la cookie de sesión es de mismo origen y las subidas locales se sirven sin CORS adicional.

### Convenciones transversales

- Todas las rutas del API se montan bajo `/api`.
- Paginación estándar: `?page=1&pageSize=20` (máximo 50); respuesta `{ items, page, pageSize, total }`.
- Errores uniformes:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "…",
      "fields": { "campo": "mensaje" }
    }
  }
  ```

- Reglas de negocio parametrizables por entorno en `config/business-rules`.
- Idioma de la interfaz: español, con textos preparados para i18n.

---

## Puesta en marcha

### Requisitos

- **Node.js 24** (la versión está en `.nvmrc`). Con nvm: `nvm use`.
- **pnpm 12** (fijado en `packageManager` del `package.json`). Con Corepack: `corepack enable`.
- **Docker** con Docker Compose v2, para PostgreSQL 16 y Mailpit.

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/k1wi777/CineMatch.git
cd CineMatch
pnpm install --frozen-lockfile
```

El `--frozen-lockfile` garantiza que se instalan exactamente las versiones del lockfile.

### 2. Variables de entorno

Los archivos `.env` no se versionan. Copia las plantillas:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

- **`apps/api/.env`**: puerto de la API (`API_PORT`, 4000), conexión a la base de datos (`DATABASE_URL`, `TEST_DATABASE_URL`), `SESSION_SECRET`, correo (Mailpit en `localhost:1025`), y las reglas de negocio opcionales. Cambia `SESSION_SECRET` por un valor largo y aleatorio en cualquier entorno compartido.
- **`ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`**: crean el administrador inicial con `pnpm seed`. Define las tres o ninguna. La contraseña debe cumplir la política (mínimo 8 caracteres, con letras y números).
- **`TMDB_API_KEY`**: opcional. Sin ella, el catálogo usa datos de prueba locales. Con ella, `CATALOGO_SYNC_HABILITADA=true` activa la sincronización programada. La clave se guarda solo en `apps/api/.env`.
- **`apps/web/.env.local`**: `API_URL` apunta a la API (por defecto `http://localhost:4000`). La web reenvía `/api/*` y `/uploads/*` a esa dirección, así que el navegador solo ve un origen.

### 3. Infraestructura local

```bash
docker compose up -d --wait
```

- **PostgreSQL 16:** `localhost:5432`, usuario `cinematch`. Bases `cinematch` (desarrollo) y `cinematch_test` (pruebas).
- **Mailpit:** SMTP en `localhost:1025` e interfaz web en http://localhost:8025. Aquí llegan los correos de recuperación de contraseña.

### 4. Base de datos

```bash
pnpm migrate:up          # aplica las migraciones pendientes
pnpm seed                # administrador inicial (si están las variables ADMIN_*)
pnpm seed:demo           # usuarios y datos de demostración (solo desarrollo)
pnpm seed:catalog        # catálogo de prueba (ver apps/api/SEEDS.md)
```

Las migraciones están en `apps/api/migrations/`. Su historial y convención se describen en `apps/api/MIGRATIONS.md`. Los seeds son idempotentes: se pueden repetir sin duplicar datos. Detalles en `apps/api/SEEDS.md`.

### 5. Arrancar la aplicación

```bash
pnpm dev
```

- **API:** http://localhost:4000 (salud en `/api/health`, documentación OpenAPI en `/api/docs` si está habilitada).
- **Web:** http://localhost:3000.

### Usuarios de demostración

Creados por `pnpm seed:demo`, con la misma contraseña:

| Correo | Usuario | Contraseña |
| --- | --- | --- |
| `demo_ana@demo.cinematch.local` | demo_ana | `Demo1234!` |
| `demo_luis@demo.cinematch.local` | demo_luis | `Demo1234!` |
| `demo_marta@demo.cinematch.local` | demo_marta | `Demo1234!` |
| `demo_carlos@demo.cinematch.local` | demo_carlos | `Demo1234!` |

El administrador es el que definiste en `ADMIN_EMAIL`.

### Comandos habituales

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | API y web en desarrollo |
| `pnpm build` | Compila todos los paquetes |
| `pnpm lint` | ESLint en todo el repositorio |
| `pnpm typecheck` | Comprueba tipos en todos los paquetes |
| `pnpm test` | Pruebas de todos los paquetes (la API necesita la base de pruebas) |
| `pnpm test:api` | Solo las pruebas de la API |
| `pnpm format:check` | Comprueba el formato con Prettier |
| `pnpm migrate:up` / `pnpm migrate:down` | Aplica o revierte migraciones |
| `pnpm backup` | Copia de seguridad de la base de datos en `backups/` |

### Parar y reiniciar la infraestructura

- **Parar sin perder datos:** `docker compose stop`.
- **Apagar los contenedores y conservar datos:** `docker compose down`.
- **Empezar de cero, con todos los datos:** `docker compose down -v`. Al volver a levantar, se recrean las bases y hay que volver a migrar y sembrar (paso 4).

### Solución de problemas

- **`pnpm install --frozen-lockfile` falla:** el lockfile no coincide con los `package.json`. Actualiza la rama desde `main`; si persiste, regenera el lockfile con `pnpm install` y comprueba que el cambio sea intencional.
- **Pnpm pide aprobar scripts de compilación:** las dependencias que compilan binarios necesitan estar en `allowBuilds` de `pnpm-workspace.yaml`. Hoy están permitidas las que usa el proyecto.
- **El puerto 3000, 4000, 5432, 1025 u 8025 está ocupado:** cierra el proceso que lo usa, o cambia el puerto en el `.env` correspondiente.
- **Las pruebas de la API dicen que no existe la base `cinematch_test`:** el script que la crea solo se ejecuta con un volumen de Docker vacío. Para recrearla, `docker compose down -v`, luego `docker compose up -d --wait` y `pnpm migrate:up`, o créala a mano en PostgreSQL.
- **Al iniciar sesión dice «demasiados intentos»:** en desarrollo hay un límite de 100 intentos de inicio de sesión cada 15 minutos. Reiniciar la API limpia el contador. El bloqueo de cuenta tras 5 contraseñas erróneas es independiente y dura 15 minutos.
- **Pruebas de la API que fallan de forma intermitente en Windows** (cierre inesperado de un proceso de prueba): vuelve a ejecutarlas. El proyecto ya usa hilos en vez de procesos para Vitest, pero la causa exacta no está confirmada.
- **La web compila con webpack, no con Turbopack:** es intencional. Turbopack no resuelve los imports `.js` de `@cinematch/shared`. Los scripts de la web ya lo tienen configurado.
- **No llegan correos de recuperación:** comprueba que Mailpit está sano (`docker compose ps`) y mira en http://localhost:8025.

---

## Organización del trabajo

El repositorio usa un arnés de trabajo basado en especificaciones (**REI Harness**), documentado en [`AGENTS.md`](AGENTS.md). Cada cambio relevante pasa por planificación, implementación, verificación y revisión antes de fusionarse.

En GitHub:

- Cada **épica** planifica un módulo (`BE-*` o `FE-*`) y agrupa sus hijas.
- Cada **hija** es una issue completa, que se entrega en su propia rama y pull request.
- Las labels `rei`, `rei:epic` y `rei:backlog` identifican los elementos gestionados por el arnés.

---

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas de trabajo del repositorio y del arnés.
- [`apps/api/README.md`](apps/api/README.md): API, arranque, variables, comandos y estructura.
- [`apps/api/SEEDS.md`](apps/api/SEEDS.md): seeds, administrador inicial y datos de demostración.
- [`apps/api/MIGRATIONS.md`](apps/api/MIGRATIONS.md): migraciones y convención de nombres.
- [`apps/api/SEGURIDAD.md`](apps/api/SEGURIDAD.md): revisión de seguridad del backend.
- [`apps/api/DOCUMENTACION.md`](apps/api/DOCUMENTACION.md) y [`apps/api/EVENTOS.md`](apps/api/EVENTOS.md): reglas de negocio y eventos internos.
- [`apps/web/README.md`](apps/web/README.md): aplicación web, estructura por features y convenciones.
- API en desarrollo: http://localhost:4000/api/docs (OpenAPI, fuera de producción).
- [GitHub Issues](https://github.com/k1wi777/CineMatch/issues): backlog, épicas e historial de cambios.

---

---

## Licencia

Por definir.
