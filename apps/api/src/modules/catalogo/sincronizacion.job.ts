import cron from "node-cron";
import type { Logger } from "pino";
import type { ResultadoSincronizacion } from "./sincronizacion.js";

export const CRON_SINCRONIZACION_POR_DEFECTO = "0 3 * * 0";
// Títulos por tipo (películas y series) en cada sincronización: 300 + 300 = 600, dentro de 500 a 1000.
export const CANTIDAD_POR_TIPO_POR_DEFECTO = 300;

export type OpcionesJobCatalogo = {
  habilitada: boolean;
  expresion: string;
  // Lo que hace cada ejecución (la sincronización completa).
  ejecutar: () => Promise<ResultadoSincronizacion>;
  logger: Logger;
};

// Job de sincronización periódica (BE-6.3). Desactivado por defecto: solo corre con CATALOGO_SYNC_HABILITADA=true.
// Devuelve la función para detenerlo al apagar el servidor.
export function iniciarSincronizacionCatalogo({
  habilitada,
  expresion,
  ejecutar,
  logger,
}: OpcionesJobCatalogo): () => void {
  if (!habilitada) {
    return () => undefined;
  }
  if (!cron.validate(expresion)) {
    throw new Error("CATALOGO_SYNC_CRON no es una expresión cron válida.");
  }

  const tarea = cron.schedule(
    expresion,
    async () => {
      const resultado = await ejecutar();
      logger.info({ ...resultado }, "Sincronización del catálogo terminada");
    },
    { noOverlap: true },
  );

  return () => {
    void tarea.stop();
  };
}
