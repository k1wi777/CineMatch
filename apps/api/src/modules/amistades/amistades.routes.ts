import {
  AmistadSchema,
  EnviarSolicitudAmistadSchema,
  type EnviarSolicitudAmistad,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioAmistades } from "./amistades.servicio.js";

const ParamsAmistadSchema = z.object({
  id: z.coerce.number().int().positive(),
});

registroOpenApi.registrarEsquema("Amistad", AmistadSchema);
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/friends/requests",
  resumen: "Enviar una solicitud de amistad",
  respuestas: {
    201: { descripcion: "Solicitud enviada (o reenviada tras un rechazo).", esquema: "Amistad" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "El usuario no existe.", esquema: "ErrorResponse" },
    409: { descripcion: "Ya sois amigos o hay una solicitud pendiente.", esquema: "ErrorResponse" },
    422: { descripcion: "No puedes agregarte a ti mismo.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/friends/requests/{id}/accept",
  resumen: "Aceptar una solicitud recibida",
  respuestas: {
    200: { descripcion: "Amistad aceptada.", esquema: "Amistad" },
    403: {
      descripcion: "Solo quien recibió la solicitud puede aceptarla.",
      esquema: "ErrorResponse",
    },
    409: { descripcion: "La solicitud ya fue respondida.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/friends/requests/{id}/reject",
  resumen: "Rechazar una solicitud recibida",
  respuestas: {
    200: { descripcion: "Solicitud rechazada.", esquema: "Amistad" },
    403: {
      descripcion: "Solo quien recibió la solicitud puede rechazarla.",
      esquema: "ErrorResponse",
    },
    409: { descripcion: "La solicitud ya fue respondida.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/friends/requests/{id}",
  resumen: "Cancelar una solicitud pendiente que enviaste",
  respuestas: {
    204: { descripcion: "Solicitud cancelada." },
    403: {
      descripcion: "Solo quien envió la solicitud puede cancelarla.",
      esquema: "ErrorResponse",
    },
    409: { descripcion: "Solo se cancela una solicitud pendiente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/friends/{id}",
  resumen: "Eliminar una amistad aceptada (cualquiera de las dos partes)",
  respuestas: {
    204: { descripcion: "Amistad eliminada. Las reseñas y recomendaciones se conservan." },
    409: { descripcion: "No es una amistad aceptada.", esquema: "ErrorResponse" },
  },
});

// El remitente o la parte que actúa siempre sale de la sesión, nunca del cuerpo ni de la URL.
function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createAmistadesRouter(
  servicio: ServicioAmistades,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.post(
    "/friends/requests",
    autenticado,
    validate({ body: EnviarSolicitudAmistadSchema }),
    async (req, res) => {
      const { usuarioId } = res.locals.input.body as EnviarSolicitudAmistad;
      const amistad = await servicio.enviarSolicitud(idDeSesion(req), usuarioId);
      res.status(201).json(AmistadSchema.parse(amistad));
    },
  );

  router.post(
    "/friends/requests/:id/accept",
    autenticado,
    validate({ params: ParamsAmistadSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsAmistadSchema>;
      res.json(AmistadSchema.parse(await servicio.aceptar(idDeSesion(req), id)));
    },
  );

  router.post(
    "/friends/requests/:id/reject",
    autenticado,
    validate({ params: ParamsAmistadSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsAmistadSchema>;
      res.json(AmistadSchema.parse(await servicio.rechazar(idDeSesion(req), id)));
    },
  );

  router.delete(
    "/friends/requests/:id",
    autenticado,
    validate({ params: ParamsAmistadSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsAmistadSchema>;
      await servicio.cancelar(idDeSesion(req), id);
      res.status(204).end();
    },
  );

  router.delete(
    "/friends/:id",
    autenticado,
    validate({ params: ParamsAmistadSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsAmistadSchema>;
      await servicio.eliminar(idDeSesion(req), id);
      res.status(204).end();
    },
  );

  return router;
}
