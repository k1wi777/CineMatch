# CineMatch

Plataforma web de reseñas y recomendaciones de películas y series. Permite descubrir títulos, calificarlos y reseñarlos, seguir una biblioteca personal, conectar con amigos y recibir recomendaciones con contexto.

> **Estado:** fase de planificación. Todavía no hay código de aplicación en el repositorio. La primera épica de trabajo es **BE-0 · Fundación del monorepo y entorno local**.

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

CineMatch se encuentra en la **Fase 1 del ERS**: definición y planificación. El repositorio contiene por ahora la documentación del arnés y la planificación; el código se construirá a partir de la épica BE-0.

La planificación se gestiona como **épicas e issues en GitHub**:

- Épicas de backend: `BE-0` a `BE-13`.
- Épicas de frontend: `FE-0` a `FE-11`.
- Orden: todas las épicas de backend relevantes se completan antes de las de frontend, salvo dependencias puntuales.

El backlog vivo está en [GitHub Issues](https://github.com/k1wi777/CineMatch/issues). Las épicas describen módulos; las issues hijas describen entregables adoptables uno a uno.

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

### Entorno local (infraestructura)

Requisitos: Docker Desktop (o Docker Engine con Compose v2).

1. Copia las variables de cada aplicación. Los archivos `.env` no se versionan:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
2. Levanta PostgreSQL 16 y Mailpit, y espera a que estén sanos:
   ```bash
   docker compose up -d --wait
   ```

Servicios locales:

- **PostgreSQL 16:** `localhost:5432`, usuario `cinematch`. Bases `cinematch` (desarrollo) y `cinematch_test` (pruebas).
- **Mailpit:** SMTP en `localhost:1025` e interfaz web en http://localhost:8025.

Operaciones:

- **Detener** sin perder datos: `docker compose stop`.
- **Apagar** los contenedores y conservar datos: `docker compose down`.
- **Resetear** todo, incluidos los datos: `docker compose down -v`. Al volver a levantar, las bases se recrean desde `infra/postgres/init/`.

Las bases y los scripts de `infra/postgres/init/` solo se ejecutan con un volumen vacío, por eso el reset es el único modo de recrearlas.

> La puesta en marcha de API y web se documentará con BE-0.3 y FE-0.1.

Requisitos previstos para el entorno local:

- Node.js LTS
- pnpm
- Docker con Docker Compose

El objetivo de BE-0 es que, tras clonar el repositorio, el entorno completo se levante con dos comandos: uno para los servicios de infraestructura y otro para API y web en desarrollo.

---

## Organización del trabajo

El repositorio usa un arnés de trabajo basado en especificaciones (**REI Harness**), documentado en [`AGENTS.md`](AGENTS.md). Cada cambio relevante pasa por planificación, aprobación, implementación y revisión.

En GitHub:

- Cada **épica** planifica un módulo (`BE-*` o `FE-*`) y agrupa sus hijas.
- Cada **hija** es una issue completa y adoptable de forma independiente.
- Las labels `rei`, `rei:epic` y `rei:backlog` identifican los elementos gestionados por el arnés.
- Las issues no se asignan por defecto; la asignación se decide al adoptar cada una.

La épica inicial es [**BE-0 · Fundación del monorepo y entorno local**](https://github.com/k1wi777/CineMatch/issues/1), de la que dependen todas las demás.

---

## Documentación

- [`AGENTS.md`](AGENTS.md) — reglas de trabajo del repositorio y del arnés.
- [GitHub Issues](https://github.com/k1wi777/CineMatch/issues) — backlog vivo: épicas, hijas, orden y dependencias.
- `CineMatch_Backlog.md` — documento local de planificación detallada (no versionado).
- `.rei/` — estado y documentación local del arnés (no versionado).

---

## Licencia

Por definir.
