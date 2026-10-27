import cors from "cors";
import express from "express";
import helmet from "helmet";
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
    }),
  );
  app.use("/api", createGenerosRouter(pool));
  app.use("/api", createInteresesRouter(crearServicioIntereses(pool), servicioAuth));
  app.use("/api", createPerfilRouter(crearServicioPerfil(pool), servicioAuth));
  if (documentacion) {
    app.use("/api", createDocsRouter());
  }

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
