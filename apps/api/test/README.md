# Convenciones de pruebas (API)

## Herramientas

- **Vitest** como runner y **Supertest** para peticiones HTTP contra la aplicación Express.
- Ejecutar con `pnpm test:api` desde la raíz, o `pnpm test` en `apps/api`.

## Dónde van las pruebas

- `test/integration/*.test.ts`: pruebas contra Express y PostgreSQL de pruebas.
- Un archivo por módulo o por ruta, con el nombre `<tema>.test.ts`.
- Las pruebas unitarias de reglas puras pueden ir junto a su código como `*.test.ts` bajo `src/`. Hoy el `vitest.config.ts` solo incluye `test/`; ampliarlo cuando haga falta.

## Base de datos de pruebas

- Las pruebas usan `TEST_DATABASE_URL` (base `cinematch_test`), nunca `DATABASE_URL`.
- `assertTestDatabaseUrl` rechaza cualquier base cuyo nombre no termine en `_test`.
- Las pruebas se ejecutan una a una (`fileParallelism: false`), porque comparten la base.
- Cada `describe` que escribe datos llama a `resetDatabase(pool)` en `beforeEach`. Vacía todas las tablas de `public` y deja el esquema intacto.
- Cuando exista el esquema (BE-1), revisar si la tabla de migraciones debe excluirse de `resetDatabase`.

## Escribir una prueba HTTP

```ts
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";

// Patrón: pool de pruebas, reset antes de cada test, app real sin puerto.
```

- Usar `buildTestApp(pool)` para obtener la aplicación.
- Comprobar código de estado y cuerpo; los errores siguen el formato `{ error: { code, message, fields? } }` de `@cinematch/shared`.
- No usar tiempos fijos. Si hace falta esperar, usar temporizadores simulados o esperar a una condición.

## Qué no hacer

- No apuntar las pruebas a la base de desarrollo ni desactivar el guard de `_test`.
- No depender del orden entre archivos de prueba.
- No compartir estado entre tests por variables globales: cada test parte de la base vacía.
