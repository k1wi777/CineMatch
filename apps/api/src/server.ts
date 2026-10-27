import { createApp } from "./app.js";
import { loadEnv, type Env } from "./config/env.js";
import { createPool } from "./lib/db.js";
import { createLogger } from "./lib/logger.js";
import { closeSseConnections } from "./lib/sse.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV);
const pool = createPool(env.DATABASE_URL);
pool.on("error", (err) => logger.error({ err }, "Error en el pool de PostgreSQL"));

const app = createApp({ pool, logger });
const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "API escuchando");
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Apagando la API");

  const forceExit = setTimeout(() => {
    logger.error("Apagado forzado: se superó el tiempo máximo");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // Deja de aceptar peticiones, cierra las conexiones abiertas y las SSE.
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
    closeSseConnections();
  });

  try {
    await pool.end();
    logger.info("Apagado completo");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error al cerrar el pool de PostgreSQL");
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
