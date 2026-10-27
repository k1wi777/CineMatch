import {
  ActualizarPerfilSchema,
  CambiarContrasenaSchema,
  PerfilSchema,
  type ActualizarPerfil,
  type CambiarContrasena,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { leerCookie } from "../../lib/cookies.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { hashToken } from "../../lib/session-token.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { NOMBRE_COOKIE_SESION } from "../auth/auth.routes.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioPerfil } from "./perfil.service.js";

registroOpenApi.registrarEsquema("Perfil", PerfilSchema);
registroOpenApi.registrarEsquema("ActualizarPerfil", ActualizarPerfilSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/me",
  resumen: "Perfil del usuario de la sesión",
  respuestas: {
    200: { descripcion: "Perfil propio.", esquema: "Perfil" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "patch",
  ruta: "/api/users/me",
  resumen: "Actualizar nombre, username o bio del perfil propio",
  respuestas: {
    200: { descripcion: "Perfil actualizado.", esquema: "Perfil" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    409: { descripcion: "El username ya está en uso.", esquema: "ErrorResponse" },
    422: { descripcion: "Algún dato no es válido.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "put",
  ruta: "/api/users/me/password",
  resumen: "Cambiar la contraseña y cerrar las demás sesiones",
  respuestas: {
    204: { descripcion: "Contraseña cambiada. Las otras sesiones quedan cerradas." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: {
      descripcion: "La contraseña actual no coincide o la nueva no cumple la política.",
      esquema: "ErrorResponse",
    },
  },
});

// El id sale siempre de la sesión: la petición nunca dice de qué usuario es el perfil.
function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createPerfilRouter(servicio: ServicioPerfil, servicioAuth: ServicioAuth): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get("/users/me", autenticado, async (req, res) => {
    const perfil = await servicio.obtener(idDeSesion(req));
    if (!perfil) {
      throw new UnauthorizedError();
    }
    res.json(PerfilSchema.parse(perfil));
  });

  router.patch(
    "/users/me",
    autenticado,
    validate({ body: ActualizarPerfilSchema }),
    async (req, res) => {
      const cambios = res.locals.input.body as ActualizarPerfil;
      const perfil = await servicio.actualizar(idDeSesion(req), cambios);
      if (!perfil) {
        throw new UnauthorizedError();
      }
      res.json(PerfilSchema.parse(perfil));
    },
  );

  router.put(
    "/users/me/password",
    autenticado,
    validate({ body: CambiarContrasenaSchema }),
    async (req, res) => {
      const { contrasenaActual, contrasenaNueva } = res.locals.input.body as CambiarContrasena;
      const sesionActual = hashToken(leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION) ?? "");
      await servicio.cambiarContrasena(
        idDeSesion(req),
        sesionActual,
        contrasenaActual,
        contrasenaNueva,
      );
      res.status(204).end();
    },
  );

  return router;
}
