# CineMatch · Backend (`apps/api`)

API REST de CineMatch: Express 5, PostgreSQL, Zod y OpenAPI. Los contratos compartidos con la web viven en `packages/shared`.

## Arranque local

Requisitos: Node 24 (ver `.nvmrc`), pnpm (fijado en `packageManager`) y Docker.

```bash
pnpm install
docker compose up -d --wait          # desde la raíz: PostgreSQL y Mailpit
cp apps/api/.env.example apps/api/.env
pnpm migrate:up                      # esquema
pnpm seed                            # roles y administrador inicial (ADMIN_* en .env)
pnpm seed:demo                       # datos de demostración (solo desarrollo)
pnpm dev                             # API en http://localhost:4000
```

- Documentación interactiva (fuera de producción): `http://localhost:4000/api/docs/`.
- Especificación OpenAPI en JSON: `http://localhost:4000/api/docs.json`. Sirve como colección de peticiones (importable en Bruno o Postman).

## Variables de entorno

Las define `apps/api/.env.example` y las valida `src/config/env.ts`. Las más importantes:

| Variable | Para qué |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | Base de datos y base de pruebas (su nombre debe terminar en `_test`). |
| `WEB_URL` | Origen de la web: CORS, CSRF y enlaces de correo. Obligatoria en producción. |
| `TMDB_API_KEY` | Clave de TMDB. Vacía: el catálogo usa el proveedor de prueba. |
| `CATALOGO_SYNC_HABILITADA`, `CATALOGO_SYNC_CRON` | Sincronización periódica del catálogo (desactivada por defecto). |
| `SMTP_*` | Correo saliente (Mailpit en desarrollo). |
| `COMMUNITY_CACHE_TTL_MINUTES`, `SESSION_*`, `LOGIN_*`, `RESET_TOKEN_TTL_MINUTES` | Reglas de negocio ajustables (`src/config/business-rules.ts`). |

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | API con recarga en desarrollo. |
| `pnpm test` | Suite completa: unitarias e integración contra `cinematch_test`. |
| `pnpm migrate:up` / `pnpm migrate:down` | Aplica o revierte migraciones. Ver `MIGRATIONS.md`. |
| `pnpm seed`, `pnpm seed:demo`, `pnpm seed:catalog` | Datos iniciales. Ver `SEEDS.md`. |
| `pnpm backup` | Copia de seguridad de la base en `backups/` (formato custom de `pg_dump`). Conserva 30 días. |

## Estructura

```
src/
  app.ts            composición de Express (sin abrir puertos)
  server.ts         arranque del proceso, migraciones opcionales, apagado ordenado
  config/           validación de entorno, seguridad y reglas de negocio
  lib/              utilidades transversales (errores, base de datos, eventos, SSE, texto)
  middleware/       autenticación, roles, CSRF, límites de tasa, validación, errores
  modules/          un directorio por épica: auth, usuarios, generos, catalogo, amistades,
                    biblioteca, resenas, recomendaciones, notificaciones, comunidad, administracion
migrations/         esquema (node-pg-migrate, SQL)
seeds/              datos iniciales y de demostración
scripts/            utilidades operativas (copia de seguridad)
test/               pruebas: unit/ e integration/ (ver test/README.md)
```

## Documentación técnica

| Tema | Documento |
|---|---|
| Migraciones | `MIGRATIONS.md` |
| Seeds | `SEEDS.md` |
| Transacciones y eventos | `TRANSACCIONES.md`, `EVENTOS.md` |
| Seguridad y revisión (BE-13.2) | `SEGURIDAD.md` |
| Documentación OpenAPI y reglas | `DOCUMENTACION.md` |
| Pruebas y matriz de restricciones | `test/README.md` |

## Operación

- **Copias de seguridad:** `pnpm backup` crea un volcado en `backups/` y borra los de más de 30 días. Programable con el programador del sistema operativo (por ejemplo, una tarea diaria que ejecute `pnpm backup` desde `apps/api`).
- **Restaurar una copia:** `docker exec -i cinematch-postgres pg_restore -U cinematch -d cinematch --clean < backups/<archivo>.dump`.
- **Apagado:** `docker compose down` conserva los datos (volumen `cinematch_pgdata`). No uses `-v` salvo que quieras borrarlos.
- **Logs:** estructurados (pino). No registran correos, nombres ni contraseñas.

## Rendimiento (BE-13.3)

- **Planes de consulta:** la búsqueda de catálogo usa el índice `pg_trgm` sobre `titulo_normalizado` (verificado con `EXPLAIN ANALYZE`). El filtro por tipo sobre el catálogo actual de desarrollo (~600 títulos) hace un escaneo secuencial, que es más barato que el índice a ese tamaño.
- **Carga:** `pnpm carga` levanta la API en proceso con 100 conexiones concurrentes durante 10 s por ruta.

| Ruta | Promedio | p97.5 | Errores |
|---|---|---|---|
| Catálogo (listado) | 422 ms | 676 ms | 0 |
| Catálogo (búsqueda) | 301 ms | 478 ms | 0 |
| Ficha del título | 309 ms | 522 ms | 0 |
| Recomendaciones generales | 644 ms | 5110 ms | 0 |

Todas las medias están por debajo de 2 s. Las recomendaciones generales tienen una cola alta: cada petición filtra hasta 400 candidatos en memoria y hace dos consultas de exclusión e intereses. Queda como mejora pendiente si el volumen crece.
