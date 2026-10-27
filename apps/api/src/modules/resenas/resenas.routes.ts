import { EscribirResenaSchema, ResenaSchema, type EscribirResena } from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioResenas } from "./resenas.servicio.js";

const ParamsTituloSchema = z.object({ contentId: z.coerce.number().int().positive() });
const ParamsResenaSchema = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registrarEsquema("Resena", ResenaSchema);
registroOpenApi.registrar({
  metodo: "put",
  ruta: "/api/titles/{contentId}/review",
  resumen: "Escribir o actualizar la reseña propia de un título",
  respuestas: {
    200: { descripcion: "Reseña actualizada.", esquema: "Resena" },
    201: { descripcion: "Reseña creada.", esquema: "Resena" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "El título no existe.", esquema: "ErrorResponse" },
    422: {
      descripcion: "Calificación, comentario o etiquetas no válidos.",
      esquema: "ErrorResponse",
    },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/reviews/{id}",
  resumen: "Eliminar la propia reseña",
  respuestas: {
    204: { descripcion: "Reseña eliminada. La biblioteca no cambia." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "No existe o no es tuya.", esquema: "ErrorResponse" },
  },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createResenasRouter(servicio: ServicioResenas, servicioAuth: ServicioAuth): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.put(
    "/titles/:contentId/review",
    autenticado,
    validate({ params: ParamsTituloSchema, body: EscribirResenaSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      const datos = res.locals.input.body as EscribirResena;
      const { resena, creada } = await servicio.guardar(idDeSesion(req), contentId, datos);
      res.status(creada ? 201 : 200).json(ResenaSchema.parse(resena));
    },
  );

  router.delete(
    "/reviews/:id",
    autenticado,
    validate({ params: ParamsResenaSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsResenaSchema>;
      await servicio.eliminar(idDeSesion(req), id);
      res.status(204).end();
    },
  );

  return router;
}
