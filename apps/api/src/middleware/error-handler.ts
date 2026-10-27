import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    logger.error({ err }, "Error no controlado");
    if (res.headersSent) return;
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
  };
}
