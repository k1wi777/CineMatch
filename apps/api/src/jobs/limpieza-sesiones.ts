import type pg from "pg";
import type { Logger } from "pino";

// Cada cuánto corre la limpieza en segundo plano. Es una cadencia de operación, no una regla de negocio.
export const LIMPIEZA_INTERVALO_MS = 60 * 60 * 1_000;

const VENCIDO_HACE_MS = 24 * 60 * 60 * 1_000;

export type ResultadoLimpieza = { sesionesEliminadas: number; tokensEliminados: number };

// Elimina las sesiones vencidas y los tokens de recuperación vencidos o usados hace más de 24 h.
// El token vence una hora después de crearse, así que "vencido hace más de 24 h" cubre también a los usados.
export async function ejecutarLimpieza(pool: pg.Pool, ahora: Date): Promise<ResultadoLimpieza> {
  const corte = new Date(ahora.getTime() - VENCIDO_HACE_MS);

  const sesiones = await pool.query("DELETE FROM sesion WHERE expira_en <= $1", [ahora]);
  const tokens = await pool.query("DELETE FROM token_recuperacion WHERE fecha_expiracion < $1", [
    corte,
  ]);

  return {
    sesionesEliminadas: sesiones.rowCount ?? 0,
    tokensEliminados: tokens.rowCount ?? 0,
  };
}

// Programa la limpieza: corre al arrancar y luego cada hora. Devuelve la función para detenerla.
// Un fallo se registra en el log y no detiene el proceso.
export function iniciarLimpieza(
  pool: pg.Pool,
  logger: Logger,
  reloj: () => Date = () => new Date(),
): () => void {
  async function correr(): Promise<void> {
    const inicio = Date.now();
    logger.info({ job: "limpieza-sesiones" }, "Limpieza iniciada");
    try {
      const resultado = await ejecutarLimpieza(pool, reloj());
      logger.info(
        { job: "limpieza-sesiones", duracionMs: Date.now() - inicio, ...resultado },
        "Limpieza terminada",
      );
    } catch (err) {
      logger.error(
        { job: "limpieza-sesiones", err, duracionMs: Date.now() - inicio },
        "Limpieza fallida",
      );
    }
  }

  void correr();
  const temporizador = setInterval(() => void correr(), LIMPIEZA_INTERVALO_MS);
  temporizador.unref();
  return () => clearInterval(temporizador);
}
