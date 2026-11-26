import cron from "node-cron";
import type { Logger } from "pino";

// Recalcula cada hora el pool de recomendaciones generales (RN15 del ERS), para que las peticiones
// se sirvan desde caché y no esperen al cálculo. Por defecto corre al inicio de cada hora.
export const CRON_RECALCULO_COMUNIDAD_POR_DEFECTO = "0 * * * *";

export type OpcionesRecalculoComunidad = {
  expresion: string;
  recalcular: () => Promise<void>;
  logger: Logger;
};

// Devuelve la función que detiene el job al apagar el servidor.
export function iniciarRecalculoComunidad({
  expresion,
  recalcular,
  logger,
}: OpcionesRecalculoComunidad): () => void {
  if (!cron.validate(expresion)) {
    throw new Error("COMUNIDAD_RECALCULO_CRON no es una expresión cron válida.");
  }

  const tarea = cron.schedule(
    expresion,
    async () => {
      try {
        await recalcular();
        logger.info("Pool de recomendaciones generales recalculado");
      } catch (err) {
        logger.error({ err }, "No se pudo recalcular el pool de recomendaciones generales");
      }
    },
    { noOverlap: true },
  );

  return () => {
    void tarea.stop();
  };
}
