import cors from "cors";
import express from "express";
import helmet from "helmet";
import type pg from "pg";
import type { Logger } from "pino";
import type { OpcionesDeSeguridad } from "./config/security.js";
import { protegerCsrf } from "./middleware/csrf.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { limitadorDeTasa } from "./middleware/rate-limit.js";
import { createDocsRouter } from "./modules/docs/docs.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";

export type AppDeps = {
  pool: pg.Pool;
  logger: Logger;
  seguridad: OpcionesDeSeguridad;
  // La documentación OpenAPI y Swagger UI solo se sirven fuera de producción.
  documentacion: boolean;
};

// Composición de Express sin abrir puertos: server.ts es quien arranca el proceso.
// El orden importa: primero seguridad y límites, después CSRF, después el cuerpo JSON y las rutas.
export function createApp({ pool, logger, seguridad, documentacion }: AppDeps) {
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
  if (documentacion) {
    app.use("/api", createDocsRouter());
  }

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
