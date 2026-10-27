import { AppError, BadRequestError, PayloadTooLargeError } from "./errors.js";

// Errores HTTP que generan Express y body-parser (JSON inválido, cuerpo demasiado grande).
// Solo se traducen los que la librería marca como expuestos al cliente (expose: true).
export function mapearErrorHttp(err: unknown): AppError | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  if (!("status" in err) || typeof err.status !== "number") {
    return undefined;
  }
  if (!("expose" in err) || err.expose !== true) {
    return undefined;
  }
  if (err.status === 413) {
    return new PayloadTooLargeError();
  }
  if (err.status >= 400 && err.status < 500) {
    return new BadRequestError("El cuerpo de la petición no es válido.");
  }
  return undefined;
}
