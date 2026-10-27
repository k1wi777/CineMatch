import {
  LoginSchema,
  RegistroRespuestaSchema,
  RegistroSchema,
  RestablecerContrasenaSchema,
  SolicitarRecuperacionSchema,
  UsuarioSesionSchema,
  type LoginRequest,
  type Registro,
  type RestablecerContrasena,
  type SolicitarRecuperacion,
} from "@cinematch/shared";
import { Router, type CookieOptions } from "express";
import { leerCookie } from "../../lib/cookies.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "./auth.service.js";
import type { ServicioRegistro } from "./auth.registro.js";
import type { ServicioRecuperacion } from "./auth.recuperacion.js";

export const NOMBRE_COOKIE_SESION = "cm_session";

// Cookie de sesión: httpOnly, SameSite=Lax, sin Max-Age (se borra al cerrar el navegador).
// Secure solo en producción, donde la API va por HTTPS.
function opcionesCookie(produccion: boolean): CookieOptions {
  return { httpOnly: true, sameSite: "lax", path: "/", secure: produccion };
}

export function createAuthRouter(
  servicio: ServicioAuth,
  opciones: { produccion: boolean; registro: ServicioRegistro; recuperacion: ServicioRecuperacion },
): Router {
  const router = Router();

  // Recuperación de contraseña (BE-3.4). La respuesta de solicitar es igual exista o no el correo.
  registroOpenApi.registrar({
    metodo: "post",
    ruta: "/api/auth/forgot-password",
    resumen: "Pedir un enlace para restablecer la contraseña",
    respuestas: { 202: { descripcion: "Si el correo existe, se envía el enlace." } },
  });
  registroOpenApi.registrar({
    metodo: "post",
    ruta: "/api/auth/reset-password",
    resumen: "Restablecer la contraseña con el enlace recibido",
    respuestas: {
      204: { descripcion: "Contraseña cambiada. Se cierran todas las sesiones." },
      400: { descripcion: "El enlace no es válido, venció o ya se usó.", esquema: "ErrorResponse" },
      422: { descripcion: "La contraseña no cumple la política.", esquema: "ErrorResponse" },
    },
  });

  router.post(
    "/auth/forgot-password",
    validate({ body: SolicitarRecuperacionSchema }),
    async (_req, res) => {
      const { correo } = res.locals.input.body as SolicitarRecuperacion;
      await opciones.recuperacion.solicitar(correo);
      res.status(202).json({
        mensaje: "Si el correo existe, te enviamos un enlace para restablecer tu contraseña.",
      });
    },
  );

  router.post(
    "/auth/reset-password",
    validate({ body: RestablecerContrasenaSchema }),
    async (_req, res) => {
      const { token, contrasena } = res.locals.input.body as RestablecerContrasena;
      await opciones.recuperacion.restablecer(token, contrasena);
      res.status(204).end();
    },
  );

  registroOpenApi.registrarEsquema("UsuarioSesion", UsuarioSesionSchema);
  registroOpenApi.registrarEsquema("LoginRequest", LoginSchema);
  registroOpenApi.registrarEsquema("RegistroRespuesta", RegistroRespuestaSchema);
  registroOpenApi.registrar({
    metodo: "post",
    ruta: "/api/auth/register",
    resumen: "Crear una cuenta (no inicia sesión)",
    respuestas: {
      201: { descripcion: "Cuenta creada.", esquema: "RegistroRespuesta" },
      409: { descripcion: "El correo o el username ya están en uso.", esquema: "ErrorResponse" },
      422: { descripcion: "Algún dato no es válido.", esquema: "ErrorResponse" },
    },
  });
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

  router.post("/auth/register", validate({ body: RegistroSchema }), async (_req, res) => {
    const datos = res.locals.input.body as Registro;
    const creado = await opciones.registro.registrar(datos);
    // No hay cookie: el registro no inicia sesión (BE-3.1).
    res.status(201).json(RegistroRespuestaSchema.parse(creado));
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
