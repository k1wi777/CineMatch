import type { ErrorResponse } from "@cinematch/shared";
import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    logger.error({ err }, "Error no controlado");
    if (res.headersSent) return;
    const body: ErrorResponse = {
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
    };
    res.status(500).json(body);
  };
}
