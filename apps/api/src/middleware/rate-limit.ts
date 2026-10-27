import { rateLimit } from "express-rate-limit";
import { TooManyRequestsError } from "../lib/errors.js";
import type { OpcionesDeSeguridad } from "../config/security.js";

type Limite = OpcionesDeSeguridad["limites"]["general"];

// Límite de tasa por IP. Al superarlo responde 429 con el formato de error de la API.
export function limitadorDeTasa({ ventanaMs, max }: Limite) {
  return rateLimit({
    windowMs: ventanaMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError());
    },
  });
}
