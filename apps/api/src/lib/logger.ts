import pino, { type Logger } from "pino";
import pretty from "pino-pretty";

// En desarrollo se usa un stream síncrono (no un transport en worker) para que
// los últimos mensajes no se pierdan al cerrar el proceso con process.exit().
export function createLogger(level: string, nodeEnv: string): Logger {
  if (nodeEnv === "development") {
    return pino({ level }, pretty({ colorize: true }));
  }
  return pino({ level });
}
