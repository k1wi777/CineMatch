import type { RequestHandler } from "express";
import { NOMBRE_COOKIE_SESION } from "../modules/auth/auth.routes.js";
import type { ServicioAuth } from "../modules/auth/auth.service.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { leerCookie } from "../lib/cookies.js";

export type Rol = "usuario" | "administrador";

// Usuario de la petición autenticada. Lo rellena requireAuth y lo leen los controladores y requireRole.
export type UsuarioAutenticado = {
  id: number;
  username: string;
  rol: Rol;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: UsuarioAutenticado;
  }
}

// Exige una sesión vigente. Sin ella responde 401 con el formato de error.
// `tocarActividad: false` valida sin renovar la sesión (para el canal SSE).
export function requireAuth(
  servicio: ServicioAuth,
  { tocarActividad = true }: { tocarActividad?: boolean } = {},
): RequestHandler {
  return async (req, _res, next) => {
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION);
    const usuario = token
      ? await servicio.resolverSesion(token, { tocar: tocarActividad })
      : undefined;
    if (!usuario) {
      next(new UnauthorizedError());
      return;
    }
    req.user = { id: usuario.id, username: usuario.username, rol: usuario.rol };
    next();
  };
}

// Exige que el usuario autenticado tenga uno de los roles indicados. Sin sesión, 401; con otro rol, 403.
export function requireRole(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.rol)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
