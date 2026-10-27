import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { NOMBRE_COOKIE_SESION } from "../auth/auth.routes.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioCuenta } from "./cuenta.servicio.js";

// Eliminar la cuenta exige la contraseña y escribir ELIMINAR: evita borrados por accidente.
const EliminarCuentaSchema = z.object({
  password: z.string().min(1).max(256),
  confirmacion: z.literal("ELIMINAR", { message: "Escribe ELIMINAR para confirmar." }),
});

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/me/data-export",
  resumen: "Exportar en JSON los datos personales de la cuenta (Ley 1581)",
  respuestas: {
    200: { descripcion: "Archivo JSON descargable." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/users/me",
  resumen:
    "Eliminar la cuenta: anonimiza el perfil, conserva las reseñas y borra el resto de datos personales",
  respuestas: {
    204: { descripcion: "Cuenta eliminada. La sesión queda cerrada." },
    403: { descripcion: "Un administrador no puede usar este endpoint.", esquema: "ErrorResponse" },
    422: { descripcion: "Contraseña o confirmación no válidas.", esquema: "ErrorResponse" },
  },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createCuentaRouter(
  servicio: ServicioCuenta,
  servicioAuth: ServicioAuth,
  opciones: { produccion: boolean },
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get("/users/me/data-export", autenticado, async (req, res) => {
    const exportacion = await servicio.exportar(idDeSesion(req));
    res.setHeader("Content-Disposition", 'attachment; filename="cinematch-mis-datos.json"');
    res.json(exportacion);
  });

  router.delete(
    "/users/me",
    autenticado,
    validate({ body: EliminarCuentaSchema }),
    async (req, res) => {
      const { password } = res.locals.input.body as z.infer<typeof EliminarCuentaSchema>;
      await servicio.eliminar(idDeSesion(req), password);
      res.clearCookie(NOMBRE_COOKIE_SESION, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: opciones.produccion,
      });
      res.status(204).end();
    },
  );

  return router;
}
