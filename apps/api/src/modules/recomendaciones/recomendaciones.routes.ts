import {
  AmigoRecomendableSchema,
  EnviarRecomendacionSchema,
  RecomendacionSchema,
  type EnviarRecomendacion,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioRecomendaciones } from "./recomendaciones.servicio.js";

const ParamsTituloSchema = z.object({ contentId: z.coerce.number().int().positive() });

registroOpenApi.registrarEsquema("Recomendacion", RecomendacionSchema);
registroOpenApi.registrarEsquema("ListaAmigosRecomendables", z.array(AmigoRecomendableSchema));
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/titles/{contentId}/recommend/friends",
  resumen: "Amigos a los que puedes recomendar el título, con géneros en común",
  respuestas: {
    200: { descripcion: "Lista de amigos.", esquema: "ListaAmigosRecomendables" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "El título no existe.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/recommendations",
  resumen: "Recomendar un título a un amigo (no exige reseña previa)",
  respuestas: {
    201: { descripcion: "Recomendación enviada.", esquema: "Recomendacion" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    403: { descripcion: "El destinatario no es tu amigo.", esquema: "ErrorResponse" },
    404: { descripcion: "El título o el usuario no existe.", esquema: "ErrorResponse" },
    409: { descripcion: "Ya la vio o ya se la recomendaste.", esquema: "ErrorResponse" },
    422: {
      descripcion: "Datos no válidos (motivo, reseña, a ti mismo).",
      esquema: "ErrorResponse",
    },
  },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createRecomendacionesRouter(
  servicio: ServicioRecomendaciones,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/titles/:contentId/recommend/friends",
    autenticado,
    validate({ params: ParamsTituloSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      res.json(await servicio.amigosRecomendables(idDeSesion(req), contentId));
    },
  );

  router.post(
    "/recommendations",
    autenticado,
    validate({ body: EnviarRecomendacionSchema }),
    async (req, res) => {
      const datos = res.locals.input.body as EnviarRecomendacion;
      const recomendacion = await servicio.enviar(idDeSesion(req), datos);
      res.status(201).json(RecomendacionSchema.parse(recomendacion));
    },
  );

  return router;
}
