# AGENTS.md — CineMatch

Punto de entrada para cualquier agente de IA que trabaje en este repositorio. Solo contiene el contexto necesario para orientarse; el detalle está en los documentos enlazados.

---

## 1. Qué es el proyecto

CineMatch es una aplicación web para llevar un registro de películas y series: catálogo (datos de TMDB), biblioteca personal con estados, reseñas con calificación, amistades, recomendaciones entre amigos, notificaciones y moderación.

Documentación de referencia:

- `README.md`: puesta en marcha, comandos, usuarios de demostración y solución de problemas.
- `docs/compatibilidad-rendimiento.md`: navegadores probados, límites de la verificación y peso del JavaScript.
- `docs/modelo-datos.md`: modelo de datos.

---

## 2. Stack y estructura

- **Monorepo** pnpm (workspaces): `apps/api`, `apps/web`, `packages/shared`.
- **API** (`apps/api`): Node 24, Express 5, PostgreSQL 16 (`pg`), Zod 4, argon2id, migraciones SQL con `node-pg-migrate` (`apps/api/migrations/`), Vitest. Documentación OpenAPI en `/api/docs` (fuera de producción).
- **Web** (`apps/web`): Next.js 16 (App Router, `--webpack`), React 19, Tailwind 4, TanStack Query, react-hook-form con Zod, next-intl (textos en `messages/es.json`), Vitest para unidades y Playwright para E2E. Las funcionalidades están en `src/features/<área>/`; los componentes compartidos en `src/shared/`.
- **Compartido** (`packages/shared`): contratos Zod y enums del dominio, usados por API y web.
- **Infraestructura local**: `docker-compose.yml` levanta PostgreSQL (puerto 5432) y Mailpit (SMTP 1025, interfaz 8025).
- **Puertos**: web 3000, API 4000 (la web hace proxy de `/api` y `/uploads` a la API).
- **Carpetas locales no versionadas**: `backups/` (archivo de datos), `apps/api/.env` y `apps/web/.env.local` (secretos y configuración). No se suben al repositorio.

---

## 3. Comandos principales

Desde la raíz del repositorio:

- `docker compose up -d --wait` — infraestructura local.
- `pnpm migrate:up` y `pnpm seed:demo` — base de datos con datos de demostración.
- `pnpm dev` — API y web en desarrollo.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` — calidad estática.
- `pnpm test` — pruebas unitarias de todo el monorepo (`pnpm test:api` solo la API).
- `pnpm build` — build de producción.
- `pnpm --filter @cinematch/web run test:e2e` — E2E en Chrome, Edge, Firefox y WebKit (`--project=chrome|edge|firefox|webkit`). Necesita la base de datos y el build previo (`pnpm --filter @cinematch/web run build`).

Para parar la infraestructura sin perder datos: `docker compose down` (sin `-v`; `-v` borra el volumen `cinematch_pgdata`).

---

## 4. Reglas de trabajo

- **Ramas:** cada cambio sale de `main` en su propia rama, con un nombre descriptivo (`feat/...`, `fix/...`, `docs/...`).
- **Verificación antes de un PR:** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` y `pnpm test`. Si el cambio toca la interfaz, también las pruebas E2E del navegador afectado.
- **Commits y PRs:** solo cuando el usuario lo pida o lo confirme. No se añaden líneas de coautoría ni atribuciones de IA a los commits ni a las descripciones de los PR.
- **Issues:** las issues se cierran desde el PR con `Closes #N`.
- **Merge:** squash y borrado de la rama, una vez que la verificación pasa.
- **Cambios en la base de datos:** siempre con una migración nueva en `apps/api/migrations/`; no se edita una migración ya aplicada.
- **Datos:** no borrar datos de la base de desarrollo sin confirmación. El archivo de títulos en `backups/` se conserva.
- **Secretos:** nunca subir claves (`TMDB_API_KEY`, `SESSION_SECRET`, etc.) al repositorio ni repetirlas en el chat.
- **Pruebas E2E:** la API de desarrollo limita los intentos de inicio de sesión; se ajusta con `LIMITE_AUTH_DESARROLLO` (la configuración de E2E ya lo sube).

---

## 5. Dónde buscar

| Si necesitas... | Mira en... |
|-----------------|------------|
| Rutas y lógica del servidor | `apps/api/src/modules/` |
| Pantallas y lógica de la web | `apps/web/src/features/` y `apps/web/src/app/` |
| Componentes compartidos | `apps/web/src/shared/ui/` |
| Contratos y tipos comunes | `packages/shared/src/` |
| Migraciones y datos de prueba | `apps/api/migrations/`, `apps/api/seeds/` |
| Pruebas E2E | `apps/web/e2e/` |
| Textos de la interfaz | `apps/web/messages/es.json` |
