import cors from "cors";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import type { Logger } from "pino";
import type { ReglasDeNegocio } from "./config/business-rules.js";
import type { OpcionesDeSeguridad } from "./config/security.js";
import { protegerCsrf } from "./middleware/csrf.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { limitadorDeTasa } from "./middleware/rate-limit.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import type { ServicioCorreo } from "./lib/correo.js";
import { crearServicioRecuperacion } from "./modules/auth/auth.recuperacion.js";
import { crearServicioRegistro } from "./modules/auth/auth.registro.js";
import { crearServicioAuth } from "./modules/auth/auth.service.js";
import { createDocsRouter } from "./modules/docs/docs.routes.js";
import { createGenerosRouter } from "./modules/generos/generos.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createInteresesRouter } from "./modules/usuarios/intereses.routes.js";
import { crearServicioIntereses } from "./modules/usuarios/intereses.service.js";
import { createPerfilRouter } from "./modules/usuarios/perfil.routes.js";
import { crearServicioPerfil } from "./modules/usuarios/perfil.service.js";
import { hashToken } from "./lib/session-token.js";
import { EventBus } from "./lib/events.js";
import {
  crearHubNotificaciones,
  createStreamNotificacionesRouter,
  INTERVALOS_STREAM_POR_DEFECTO,
  type HubNotificaciones,
  type IntervalosStream,
} from "./modules/notificaciones/notificaciones.stream.js";
import { createAmistadesRouter } from "./modules/amistades/amistades.routes.js";
import { crearServicioAmistades } from "./modules/amistades/amistades.servicio.js";
import { createAmistadesConsultaRouter } from "./modules/amistades/amistades.consulta.routes.js";
import { createBibliotecaRouter } from "./modules/biblioteca/biblioteca.routes.js";
import { crearServicioEstadoInterno } from "./modules/biblioteca/biblioteca.estado.js";
import { createResenasRouter } from "./modules/resenas/resenas.routes.js";
import { crearServicioResenas } from "./modules/resenas/resenas.servicio.js";
import { createResenasConsultaRouter } from "./modules/resenas/resenas.consulta.routes.js";
import { createRecomendacionesRouter } from "./modules/recomendaciones/recomendaciones.routes.js";
import { createRecomendacionesEstadoRouter } from "./modules/recomendaciones/recomendaciones.estado.routes.js";
import { crearServicioConsultaRecomendaciones } from "./modules/recomendaciones/recomendaciones.consulta.js";
import { crearServicioAcciones } from "./modules/recomendaciones/recomendaciones.acciones.js";
import { crearCompletarRecomendaciones } from "./modules/recomendaciones/recomendaciones.completar.js";
import { crearServicioRecomendaciones } from "./modules/recomendaciones/recomendaciones.servicio.js";
import { createPerfilPublicoRouter } from "./modules/usuarios/perfil-publico.routes.js";
import { crearServicioConsultaResenas } from "./modules/resenas/resenas.consulta.js";
import { crearServicioBiblioteca } from "./modules/biblioteca/biblioteca.servicio.js";
import { createBibliotecaPrivacidadRouter } from "./modules/biblioteca/biblioteca.privacidad.routes.js";
import { crearServicioConsultaAmistades } from "./modules/amistades/amistades.consulta.js";
import { crearServicioCreacion } from "./modules/notificaciones/notificaciones.creacion.js";
import { createCatalogoRouter } from "./modules/catalogo/catalogo.routes.js";
import { crearServicioCatalogo } from "./modules/catalogo/catalogo.consulta.js";
import { createNotificacionesRouter } from "./modules/notificaciones/notificaciones.routes.js";
import { crearServicioConsulta } from "./modules/notificaciones/notificaciones.consulta.js";
import { createAvatarRouter } from "./modules/usuarios/avatar.routes.js";
import { crearServicioAvatar, RUTA_PUBLICA_AVATARES } from "./modules/usuarios/avatar.service.js";

// Carpeta de avatares por defecto: apps/api/uploads/avatars (ignorada por git).
const DIRECTORIO_AVATARES_POR_DEFECTO = fileURLToPath(
  new URL("../uploads/avatars", import.meta.url),
);

export type AppDeps = {
  pool: pg.Pool;
  logger: Logger;
  seguridad: OpcionesDeSeguridad;
  // La documentación OpenAPI y Swagger UI solo se sirven fuera de producción.
  documentacion: boolean;
  reglas: ReglasDeNegocio;
  produccion: boolean;
  // Canal de correo para la recuperación de contraseña: SMTP en producción y desarrollo, falso en pruebas.
  correo: ServicioCorreo;
  // Reloj inyectable: las pruebas lo usan para simular el paso del tiempo (bloqueos, expiración de sesiones).
  reloj?: () => Date;
  // Carpeta donde se guardan los avatares. Las pruebas usan una temporal.
  directorioAvatares?: string;
  // Bus de eventos de dominio. server.ts lo pasa con sus listeners; las pruebas pueden usar el suyo.
  eventos?: EventBus;
  // Hub de conexiones SSE. Las pruebas lo pasan para emitir eventos y observarlos.
  notificaciones?: HubNotificaciones;
  intervalosStream?: Partial<IntervalosStream>;
};

// Composición de Express sin abrir puertos: server.ts es quien arranca el proceso.
// El orden importa: primero seguridad y límites, después CSRF, después el cuerpo JSON y las rutas.
export function createApp({
  pool,
  logger,
  seguridad,
  documentacion,
  reglas,
  produccion,
  reloj = () => new Date(),
  correo,
  directorioAvatares = DIRECTORIO_AVATARES_POR_DEFECTO,
  notificaciones = crearHubNotificaciones(),
  intervalosStream,
  eventos = new EventBus(logger),
}: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", seguridad.trustProxy);

  // Completar recomendaciones cuando el receptor califica por primera vez (BE-10.6), dentro de la misma transacción.
  eventos.onInTransaction(
    "review.created",
    crearCompletarRecomendaciones({ creacion: crearServicioCreacion({ emisor: notificaciones }) }),
  );

  app.use(helmet());
  app.use(cors({ origin: seguridad.webUrl, credentials: true }));

  app.use("/api", limitadorDeTasa(seguridad.limites.general));
  app.use("/api/auth", limitadorDeTasa(seguridad.limites.auth));
  app.use("/api", protegerCsrf(seguridad.webUrl));

  app.use(express.json({ limit: seguridad.jsonLimite }));

  // Las rutas se montan antes que la documentación, que las recoge del registro OpenAPI.
  app.use("/api", createHealthRouter(pool));
  const servicioAuth = crearServicioAuth({ pool, reglas, reloj });
  const servicioRegistro = crearServicioRegistro({ pool, reloj });
  const servicioRecuperacion = crearServicioRecuperacion({
    pool,
    reglas,
    reloj,
    servicioCorreo: correo,
    webUrl: seguridad.webUrl,
    logger,
  });
  app.use(
    "/api",
    createAuthRouter(servicioAuth, {
      produccion,
      registro: servicioRegistro,
      recuperacion: servicioRecuperacion,
      alCerrarSesion: (token) => notificaciones.cerrarSesion(hashToken(token)),
    }),
  );
  app.use("/api", createGenerosRouter(pool));
  app.use("/api", createCatalogoRouter(crearServicioCatalogo(pool), servicioAuth));
  // Las notificaciones de amistad usan el mismo hub SSE que el stream, así llegan en vivo.
  app.use(
    "/api",
    createAmistadesRouter(
      crearServicioAmistades({
        pool,
        creacion: crearServicioCreacion({ emisor: notificaciones }),
      }),
      servicioAuth,
    ),
  );
  app.use(
    "/api",
    createAmistadesConsultaRouter(crearServicioConsultaAmistades(pool), servicioAuth),
  );
  app.use("/api", createBibliotecaRouter(crearServicioBiblioteca(pool), servicioAuth));
  app.use(
    "/api",
    createBibliotecaPrivacidadRouter({
      pool,
      servicio: crearServicioBiblioteca(pool),
      amigos: crearServicioConsultaAmistades(pool),
      servicioAuth,
    }),
  );
  app.use(
    "/api",
    createResenasRouter(
      crearServicioResenas({
        pool,
        eventos,
        estado: crearServicioEstadoInterno(pool),
      }),
      servicioAuth,
    ),
  );
  app.use(
    "/api",
    createResenasConsultaRouter(crearServicioConsultaResenas({ pool, reglas }), servicioAuth),
  );
  app.use(
    "/api",
    createRecomendacionesRouter(
      crearServicioRecomendaciones({
        pool,
        eventos,
        creacion: crearServicioCreacion({ emisor: notificaciones }),
        amigos: crearServicioConsultaAmistades(pool),
      }),
      servicioAuth,
    ),
  );
  const creacionRecomendaciones = crearServicioCreacion({ emisor: notificaciones });
  app.use(
    "/api",
    createRecomendacionesEstadoRouter(
      crearServicioConsultaRecomendaciones({ pool }),
      crearServicioAcciones({
        pool,
        creacion: creacionRecomendaciones,
        estado: crearServicioEstadoInterno(pool),
      }),
      servicioAuth,
    ),
  );
  app.use(
    "/api",
    createPerfilPublicoRouter({
      pool,
      resenas: crearServicioConsultaResenas({ pool, reglas }),
      biblioteca: crearServicioBiblioteca(pool),
      amigos: crearServicioConsultaAmistades(pool),
      servicioAuth,
    }),
  );
  app.use("/api", createInteresesRouter(crearServicioIntereses(pool), servicioAuth));
  app.use("/api", createPerfilRouter(crearServicioPerfil(pool), servicioAuth));
  app.use(
    "/api",
    createAvatarRouter(
      crearServicioAvatar({ pool, directorio: directorioAvatares, logger }),
      servicioAuth,
    ),
  );

  app.use(
    "/api",
    createStreamNotificacionesRouter({
      hub: notificaciones,
      pool,
      servicioAuth,
      logger,
      intervalos: { ...INTERVALOS_STREAM_POR_DEFECTO, ...intervalosStream },
    }),
  );
  app.use("/api", createNotificacionesRouter(crearServicioConsulta(pool), servicioAuth));

  // Avatares: archivos con nombre generado por el servidor, siempre con nosniff y caché larga
  // (el nombre cambia en cada subida, así que una versión vieja nunca se confunde con la nueva).
  app.use(
    RUTA_PUBLICA_AVATARES,
    express.static(directorioAvatares, {
      index: false,
      maxAge: "1y",
      immutable: true,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  if (documentacion) {
    app.use("/api", createDocsRouter());
  }

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
