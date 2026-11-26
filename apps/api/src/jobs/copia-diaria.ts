import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import type { Logger } from "pino";

// Copia de seguridad diaria (NF de disponibilidad del ERS). Usa scripts/backup.mjs, que conserva 30 días.
// Desactivada por defecto: solo corre con COPIA_DIARIA_HABILITADA=true.
export const CRON_COPIA_DIARIA_POR_DEFECTO = "0 2 * * *";

const RAIZ_API = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT_COPIA = join(RAIZ_API, "scripts", "backup.mjs");

export type OpcionesCopiaDiaria = {
  habilitada: boolean;
  expresion: string;
  ejecutar?: () => Promise<void>;
  logger: Logger;
};

// Ejecuta el script de copia en un proceso aparte y espera a que termine.
export function ejecutarScriptCopia(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SCRIPT_COPIA], { cwd: RAIZ_API }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`La copia de seguridad falló: ${stderr.trim() || error.message}`));
        return;
      }
      resolve();
    });
  });
}

// Devuelve la función que detiene el job al apagar el servidor.
export function iniciarCopiaDiaria({
  habilitada,
  expresion,
  ejecutar = ejecutarScriptCopia,
  logger,
}: OpcionesCopiaDiaria): () => void {
  if (!habilitada) {
    return () => undefined;
  }
  if (!cron.validate(expresion)) {
    throw new Error("COPIA_DIARIA_CRON no es una expresión cron válida.");
  }

  const tarea = cron.schedule(
    expresion,
    async () => {
      try {
        await ejecutar();
        logger.info("Copia de seguridad diaria terminada");
      } catch (err) {
        logger.error({ err }, "Falló la copia de seguridad diaria");
      }
    },
    { noOverlap: true },
  );

  return () => {
    void tarea.stop();
  };
}
