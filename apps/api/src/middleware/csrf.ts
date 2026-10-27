import type { RequestHandler } from "express";
import { ForbiddenError } from "../lib/errors.js";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

// Origen de la petición: el encabezado Origin, o el origen del Referer si falta Origin.
export function origenDePeticion(
  origin: string | undefined,
  referer: string | undefined,
): string | undefined {
  if (origin) {
    return origin;
  }
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Protección CSRF: las peticiones que cambian estado solo se aceptan desde el origen de la web.
// Junto con SameSite=Lax en la cookie de sesión (BE-3.2), cubre el ataque de formularios de otro sitio.
export function protegerCsrf(webUrl: string): RequestHandler {
  const origenPermitido = new URL(webUrl).origin;

  return (req, _res, next) => {
    if (METODOS_SEGUROS.has(req.method)) {
      next();
      return;
    }

    const origen = origenDePeticion(req.get("origin"), req.get("referer"));
    if (origen !== origenPermitido) {
      next(new ForbiddenError("La petición no viene de un origen permitido."));
      return;
    }
    next();
  };
}
