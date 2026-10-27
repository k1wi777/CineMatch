import { LoginSchema, UsuarioSesionSchema, type LoginRequest } from "@cinematch/shared";
import { Router, type CookieOptions } from "express";
import { leerCookie } from "../../lib/cookies.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "./auth.service.js";

export const NOMBRE_COOKIE_SESION = "cm_session";

// Cookie de sesión: httpOnly, SameSite=Lax, sin Max-Age (se borra al cerrar el navegador).
// Secure solo en producción, donde la API va por HTTPS.
function opcionesCookie(produccion: boolean): CookieOptions {
  return { httpOnly: true, sameSite: "lax", path: "/", secure: produccion };
}

export function createAuthRouter(
  servicio: ServicioAuth,
  opciones: { produccion: boolean },
): Router {
  const router = Router();

  registroOpenApi.registrarEsquema("UsuarioSesion", UsuarioSesionSchema);
  registroOpenApi.registrarEsquema("LoginRequest", LoginSchema);
  registroOpenApi.registrar({
    metodo: "post",
    ruta: "/api/auth/login",
    resumen: "Iniciar sesión",
    respuestas: {
      200: {
        descripcion: "Sesión iniciada. La cookie cm_session queda establecida.",
        esquema: "UsuarioSesion",
      },
      401: { descripcion: "Correo o contraseña incorrectos.", esquema: "ErrorResponse" },
      423: { descripcion: "La cuenta está bloqueada temporalmente.", esquema: "ErrorResponse" },
    },
  });
  registroOpenApi.registrar({
    metodo: "post",
    ruta: "/api/auth/logout",
    resumen: "Cerrar sesión (idempotente)",
    respuestas: { 204: { descripcion: "Sesión cerrada. La cookie se borra." } },
  });
  registroOpenApi.registrar({
    metodo: "get",
    ruta: "/api/auth/me",
    resumen: "Usuario de la sesión actual",
    respuestas: {
      200: { descripcion: "Usuario de la sesión.", esquema: "UsuarioSesion" },
      401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    },
  });

  router.post("/auth/login", validate({ body: LoginSchema }), async (req, res) => {
    const credenciales = res.locals.input.body as LoginRequest;
    const { token, usuario } = await servicio.login(credenciales.correo, credenciales.contrasena, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.cookie(NOMBRE_COOKIE_SESION, token, opcionesCookie(opciones.produccion));
    res.json(UsuarioSesionSchema.parse(usuario));
  });

  router.post("/auth/logout", async (req, res) => {
    await servicio.logout(leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION));
    res.clearCookie(NOMBRE_COOKIE_SESION, opcionesCookie(opciones.produccion));
    res.status(204).end();
  });

  router.get("/auth/me", async (req, res) => {
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION);
    const usuario = token ? await servicio.resolverSesion(token) : undefined;
    if (!usuario) {
      throw new UnauthorizedError();
    }
    res.json(UsuarioSesionSchema.parse(usuario));
  });

  return router;
}
