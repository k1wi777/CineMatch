import { createApp } from "./app.js";
import { loadEnv, type Env } from "./config/env.js";
import { opcionesDeSeguridad } from "./config/security.js";
import { reglasDeNegocio } from "./config/business-rules.js";
import { crearCorreoSmtp } from "./lib/correo.js";
import { iniciarLimpieza } from "./jobs/limpieza-sesiones.js";
import { EventBus } from "./lib/events.js";
import { registrarListenersDeModulos } from "./modules/registro-eventos.js";
import { createPool } from "./lib/db.js";
import { createLogger } from "./lib/logger.js";
import { migrateUp } from "./lib/migrations.js";
import { closeSseConnections } from "./lib/sse.js";
import { crearProveedorCatalogo } from "./modules/catalogo/proveedor/crear-proveedor.js";
import { crearServicioSincronizacion } from "./modules/catalogo/sincronizacion.js";
import {
  CANTIDAD_POR_TIPO_POR_DEFECTO,
  iniciarSincronizacionCatalogo,
} from "./modules/catalogo/sincronizacion.job.js";

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

if (env.MIGRATE_ON_START) {
  try {
    await migrateUp(env.DATABASE_URL, logger);
  } catch (err) {
    logger.error({ err }, "Fallo al aplicar migraciones; el proceso no arranca");
    await pool.end();
    process.exit(1);
  }
}

// Los listeners de cada módulo se registran una sola vez, antes de aceptar peticiones.
const eventos = new EventBus(logger);
registrarListenersDeModulos(eventos);

// Limpieza de sesiones y tokens vencidos (BE-3.6): corre al arrancar y cada hora.
const detenerLimpieza = iniciarLimpieza(pool, logger);

// Sincronización periódica del catálogo (BE-6.3): solo si CATALOGO_SYNC_HABILITADA=true.
const sincronizacion = crearServicioSincronizacion({
  pool,
  proveedor: crearProveedorCatalogo(env.TMDB_API_KEY),
  logger,
});
const detenerSincronizacion = iniciarSincronizacionCatalogo({
  habilitada: env.CATALOGO_SYNC_HABILITADA,
  expresion: env.CATALOGO_SYNC_CRON,
  ejecutar: () => sincronizacion.sincronizar(CANTIDAD_POR_TIPO_POR_DEFECTO),
  logger,
});

const app = createApp({
  pool,
  logger,
  eventos,
  seguridad: opcionesDeSeguridad(env),
  documentacion: env.NODE_ENV !== "production",
  reglas: reglasDeNegocio(env),
  produccion: env.NODE_ENV === "production",
  correo: crearCorreoSmtp({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM }),
});
const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "API escuchando");
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Apagando la API");
  detenerLimpieza();
  detenerSincronizacion();

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
