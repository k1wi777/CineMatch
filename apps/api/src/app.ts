import express from "express";
import type pg from "pg";
import type { Logger } from "pino";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { createHealthRouter } from "./modules/health/health.routes.js";

export type AppDeps = {
  pool: pg.Pool;
  logger: Logger;
};

// Composición de Express sin abrir puertos: server.ts es quien arranca el proceso.
export function createApp({ pool, logger }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.use("/api", createHealthRouter(pool));
  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
