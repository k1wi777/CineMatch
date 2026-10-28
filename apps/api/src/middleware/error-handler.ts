import type { ErrorResponse } from "@cinematch/shared";
import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { AppError, mapearErrorPostgres } from "../lib/errors.js";
import { mapearErrorHttp } from "../lib/http-errors.js";

// Convierte cualquier error en la respuesta { error: { code, message, fields? } }.
// Nunca devuelve el stack ni detalles internos: esos van solo al log.
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (res.headersSent) return;

    const errorDeDominio =
      err instanceof AppError ? err : (mapearErrorPostgres(err) ?? mapearErrorHttp(err));
    if (errorDeDominio) {
      const body: ErrorResponse = {
        error: {
          code: errorDeDominio.code,
          message: errorDeDominio.message,
          ...(errorDeDominio.fields ? { fields: errorDeDominio.fields } : {}),
        },
      };
      if (errorDeDominio.retryAfterSeconds !== undefined) {
        res.set("Retry-After", String(errorDeDominio.retryAfterSeconds));
      }
      res.status(errorDeDominio.status).json(body);
      return;
    }

    logger.error({ err }, "Error no controlado");
    const body: ErrorResponse = {
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
    };
    res.status(500).json(body);
  };
}
