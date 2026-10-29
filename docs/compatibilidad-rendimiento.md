# Compatibilidad y rendimiento de la web (FE-11.4)

Registro de lo que se ha verificado sobre la aplicación web, con las versiones concretas. Se actualiza cuando cambian los navegadores o las dependencias.

## Navegadores

| Navegador                | Versión probada          | Cómo                                    | Resultado                                               |
| ------------------------ | ------------------------ | --------------------------------------- | ------------------------------------------------------- |
| Google Chrome            | 156.0.8078.49            | Instalado en el equipo (canal `chrome`) | Las 5 pruebas E2E y la auditoría de accesibilidad pasan |
| Microsoft Edge           | 156.0.4314.50            | Instalado en el equipo (canal `msedge`) | Las 5 pruebas E2E pasan                                 |
| Firefox                  | 157.0                    | Navegador que trae Playwright 1.64      | Las 5 pruebas E2E pasan                                 |
| WebKit (motor de Safari) | Build de Playwright 1.64 | Navegador que trae Playwright           | Las 5 pruebas E2E pasan                                 |
| Safari                   | —                        | No probado                              | **Pendiente**: solo existe en macOS                     |

Las pruebas se ejecutan con `pnpm --filter @cinematch/web run test:e2e`, con un proyecto por navegador (`--project=chrome|edge|firefox|webkit`).

Límites de esta verificación:

- Se han probado las versiones instaladas en este equipo, no «las dos últimas versiones» de cada navegador. Para cubrir esa parte, basta con repetir la ejecución al actualizar los navegadores.
- WebKit de Playwright es el motor de Safari, pero no es Safari. El comportamiento real de Safari (sobre todo en iOS) necesita comprobación manual en un Mac.

## Incompatibilidades encontradas y corregidas

- **Aviso «Reseña guardada» desaparecía** en Firefox y WebKit tras guardar una reseña. El formulario se volvía a montar al cambiar la clave, y el montaje borraba el aviso. Se quitó la clave. Es un fallo de comportamiento, no de motor, y se detectó con las pruebas E2E.

## Rendimiento

### Peso de JavaScript

Medido sobre el build de producción (`pnpm --filter @cinematch/web run build`), con gzip:

- **Base común** que carga cada página (`rootMainFiles` del build): 4 archivos, 131 kB gzip (440 kB sin comprimir). Incluye el runtime de React y Next, TanStack Query, next-intl y Zod, que se usa en el cliente para validar.
- **Chunks JS totales** del build: 55 archivos, 436 kB gzip. Son las páginas que se cargan solo al visitarlas.
- Los chunks más grandes son el runtime de Next (67 kB), un chunk compartido (66 kB) y otro (63 kB), que corresponden a la base común.

No se ha encontrado una dependencia que sobre. Para bajar más el peso habría que quitar Zod del cliente o cargar la validación solo en los formularios, lo que se deja para una mejora posterior.

### Imágenes

- Pósteres y avatares con `next/image` donde aplica. Los pósteres usan `sizes` por breakpoint y la ficha carga el suyo con prioridad.
- El dominio de TMDB está permitido en `images.remotePatterns`.
- Los **avatares no pasan por el optimizador** de Next (`unoptimized`): ya son WebP de 256×256 generados por la API. Pasarlos por el optimizador respondía 400 en la comprobación de runtime y no aportaba nada.
- En la base de desarrollo no hay pósteres (los 603 títulos usan el cartel tipográfico), así que el camino de TMDB no se ha podido probar con datos reales.

## Cómo reproducir

```bash
pnpm --filter @cinematch/web run build
pnpm --filter @cinematch/web run test:e2e --project=chrome
```

Ver el README (apartado de pruebas E2E y solución de problemas) para los requisitos de la base de datos y del administrador de pruebas.
