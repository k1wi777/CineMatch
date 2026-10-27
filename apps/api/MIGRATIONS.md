# Migraciones de base de datos

Las migraciones usan [`node-pg-migrate`](https://salsita.github.io/node-pg-migrate/) y viven en `apps/api/migrations/`.

## Comandos

Desde la raíz del repositorio:

- `pnpm migrate:up`: aplica todas las migraciones pendientes.
- `pnpm migrate:down`: revierte la última migración aplicada.
- `pnpm migrate:create <nombre>`: crea un archivo nuevo en `migrations/`.

Las migraciones usan `DATABASE_URL` de `apps/api/.env`. Las pruebas usan `TEST_DATABASE_URL` (ver BE-1.7).

## Arranque automático

Con `MIGRATE_ON_START=true` en `apps/api/.env`, la API aplica las migraciones pendientes antes de escuchar. Si alguna falla, el proceso termina con código 1. Por defecto está desactivado.

## Convención de nombres

- Archivo: `<timestamp>_<nombre-en-kebab-case>.sql`, por ejemplo `1793073985780_crear-usuarios.sql`. El timestamp lo genera `migrate:create`, así que el orden es cronológico.
- Un archivo por cambio de esquema cohesionado (por ejemplo, un archivo por épica de BE-1).
- Nunca editar una migración que ya se haya aplicado en otro entorno: crear una nueva.

## Formato

Cada archivo SQL tiene dos secciones. Las dos son obligatorias para que `migrate:down` sea posible:

```sql
-- Up Migration
CREATE TABLE ejemplo (id integer PRIMARY KEY);

-- Down Migration
DROP TABLE ejemplo;
```

## Orden

Las migraciones se aplican en orden de nombre. `node-pg-migrate` comprueba el orden antes de ejecutar y, si una migración anterior falta en el historial, se detiene con error.
