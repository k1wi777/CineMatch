import {
  ContadorNoLeidasSchema,
  NotificacionesQuerySchema,
  PaginaNotificacionesSchema,
  type NotificacionesQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioConsulta } from "./notificaciones.consulta.js";

const ParamsNotificacionSchema = z.object({
  id: z.coerce.number().int().positive(),
});

registroOpenApi.registrarEsquema("PaginaNotificaciones", PaginaNotificacionesSchema);
registroOpenApi.registrarEsquema("ContadorNoLeidas", ContadorNoLeidasSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/notifications",
  resumen: "Notificaciones del usuario, más recientes primero (?soloNoLeidas=true)",
  respuestas: {
    200: { descripcion: "Página de notificaciones.", esquema: "PaginaNotificaciones" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: { descripcion: "Parámetros de paginación no válidos.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/notifications/unread-count",
  resumen: "Número de notificaciones sin leer",
  respuestas: {
    200: { descripcion: "Contador de no leídas.", esquema: "ContadorNoLeidas" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "patch",
  ruta: "/api/notifications/{id}/read",
  resumen: "Marcar una notificación como leída",
  respuestas: {
    204: { descripcion: "Marcada como leída (repetirlo no cambia nada)." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "No existe o no es del usuario.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/notifications/read-all",
  resumen: "Marcar todas las notificaciones como leídas",
  respuestas: {
    204: { descripcion: "Todas marcadas como leídas." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});

// El usuario siempre sale de la sesión; la URL solo aporta el id de la notificación.
function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createNotificacionesRouter(
  servicio: ServicioConsulta,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/notifications",
    autenticado,
    validate({ query: NotificacionesQuerySchema }),
    async (req, res) => {
      const query = res.locals.input.query as NotificacionesQuery;
      const pagina = await servicio.listar(idDeSesion(req), query);
      res.json(PaginaNotificacionesSchema.parse(pagina));
    },
  );

  router.get("/notifications/unread-count", autenticado, async (req, res) => {
    const contador = await servicio.contarNoLeidas(idDeSesion(req));
    res.json(ContadorNoLeidasSchema.parse(contador));
  });

  router.patch(
    "/notifications/:id/read",
    autenticado,
    validate({ params: ParamsNotificacionSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsNotificacionSchema>;
      await servicio.marcarLeida(idDeSesion(req), id);
      res.status(204).end();
    },
  );

  router.post("/notifications/read-all", autenticado, async (req, res) => {
    await servicio.marcarTodas(idDeSesion(req));
    res.status(204).end();
  });

  return router;
}
