import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";
import { createPool } from "../src/lib/db.js";
import { crearProveedorCatalogo } from "../src/modules/catalogo/proveedor/crear-proveedor.js";
import { CANTIDAD_POR_TIPO_POR_DEFECTO } from "../src/modules/catalogo/sincronizacion.job.js";
import { crearServicioSincronizacion } from "../src/modules/catalogo/sincronizacion.js";

// `pnpm seed:catalog` carga el catálogo inicial: entre 500 y 1000 títulos (mitad películas, mitad series).
// Usa TMDB si TMDB_API_KEY está definida; si no, el proveedor de prueba. Es idempotente.
const MIN_TOTAL = 500;
const MAX_TOTAL = 1000;

function cantidadPorTipo(): number {
  const argumento = process.argv.find((arg) => arg.startsWith("--total="));
  if (!argumento) return CANTIDAD_POR_TIPO_POR_DEFECTO;
  const total = Number(argumento.slice("--total=".length));
  if (!Number.isInteger(total) || total < MIN_TOTAL || total > MAX_TOTAL) {
    throw new Error(`--total debe ser un entero entre ${MIN_TOTAL} y ${MAX_TOTAL}.`);
  }
  return Math.floor(total / 2);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV);
  const pool = createPool(env.DATABASE_URL);
  const servicio = crearServicioSincronizacion({
    pool,
    proveedor: crearProveedorCatalogo(env.TMDB_API_KEY),
    logger,
  });

  try {
    const resultado = await servicio.sincronizar(cantidadPorTipo());
    console.log(
      `Catálogo (${resultado.estado}): ${resultado.agregados} nuevos, ` +
        `${resultado.actualizados} actualizados, ${resultado.descartados} descartados, ` +
        `${resultado.generosAgregados} géneros nuevos.`,
    );
    if (resultado.estado === "error") {
      console.error(resultado.error);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
