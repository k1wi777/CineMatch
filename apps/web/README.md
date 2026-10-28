# CineMatch · Web (`apps/web`)

Aplicación Next.js (App Router, TypeScript estricto y Tailwind CSS) que consume la API de `apps/api`.

## Arranque

```bash
pnpm dev          # desde la raíz: API en :4000 y web en :3000
pnpm --filter @cinematch/web dev   # solo la web
```

Variables (ver `.env.example`): `API_URL` (por defecto `http://localhost:4000`), usada por los rewrites.

- `/api/*` y `/uploads/*` se reenvían a la API en el mismo origen: el navegador no necesita CORS.
- `pnpm build` compila la aplicación; `pnpm lint` y `pnpm typecheck` comprueban el código.

## Estructura (feature-first)

```
src/
  app/          rutas de Next.js: layouts, páginas, not-found y errores (en español)
  features/     una carpeta por épica de negocio; una feature no importa de otra
  shared/       código reutilizable: cliente de API, componentes y utilidades
```

Alias: `@/*` apunta a `src/*`.
