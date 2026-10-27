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
import {
  crearHubNotificaciones,
  createStreamNotificacionesRouter,
  INTERVALOS_STREAM_POR_DEFECTO,
  type HubNotificaciones,
  type IntervalosStream,
} from "./modules/notificaciones/notificaciones.stream.js";
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
}: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", seguridad.trustProxy);

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
