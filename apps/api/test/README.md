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

## Matriz de restricciones

Las pruebas de `test/integration/integridad-*.test.ts` verifican cada CHECK, UNIQUE, FK e índice del esquema. Cada una inserta un dato inválido y espera el código de error de PostgreSQL. Si se elimina la restricción, el test falla.

| Restricción | Tabla | Código | Prueba |
| --- | --- | --- | --- |
| `usuario_username_formato` (longitud 3–20, `^[A-Za-z0-9_]+$`) | `usuario` | 23514 / 22001 | `integridad-usuarios` |
| `usuario_username_lower_key` (único sin mayúsculas) | `usuario` | 23505 | `integridad-usuarios` |
| `usuario_correo_lower_key` (único parcial sin mayúsculas) | `usuario` | 23505 | `integridad-recomendaciones` (índices) |
| `rol.nombre` UNIQUE | `rol` | 23505 | `integridad-usuarios` |
| PK y FK de `sesion` y `token_recuperacion` | `sesion`, `token_recuperacion` | 23505 / 23503 | `integridad-usuarios` |
| `genero.nombre` UNIQUE | `genero` | 23505 | `integridad-catalogo-social` |
| `contenido` UNIQUE `(fuente, tipo, id_externo)` y enum `tipo` | `contenido` | 23505 / 22P02 | `integridad-catalogo-social` |
| FK y PK de `contenido_genero` e `interes_usuario` | relaciones | 23503 / 23505 | `integridad-catalogo-social` |
| `amistad_no_autoamistad` y `amistad_par_key` | `amistad` | 23514 / 23505 | `integridad-catalogo-social` |
| `resena_calificacion_rango_paso` | `resena` | 23514 | `integridad-catalogo-social` |
| `resena_comentario_longitud` (2000) | `resena` | 23514 | `integridad-catalogo-social` |
| `resena_usuario_contenido_key` | `resena` | 23505 | `integridad-catalogo-social` |
| `etiqueta.texto` UNIQUE y cascada desde `resena` | `etiqueta`, `resena_etiqueta` | 23505 / efecto | `integridad-catalogo-social` |
| `seguimiento` UNIQUE y enum `estado` | `seguimiento` | 23505 / 22P02 | `integridad-catalogo-social` |
| `recomendacion_no_a_uno_mismo` y UNIQUE del emisor, receptor y título | `recomendacion` | 23514 / 23505 | `integridad-recomendaciones` |
| `resena_id` con `ON DELETE SET NULL` | `recomendacion` | efecto | `integridad-recomendaciones` |
| `notificacion_un_solo_origen` | `notificacion` | 23514 | `integridad-recomendaciones` |
| Cascada desde la recomendación, amistad o reseña de origen | `notificacion` | efecto | `integridad-recomendaciones` |
| Índices de búsqueda y de integridad (GIN, parcial, DESC) | varios | definición | `integridad-recomendaciones` |

## Qué no hacer

- No apuntar las pruebas a la base de desarrollo ni desactivar el guard de `_test`.
- No depender del orden entre archivos de prueba.
- No compartir estado entre tests por variables globales: cada test parte de la base vacía.
