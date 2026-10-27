import {
  PaginaRecomendacionesComunidadSchema,
  RecomendacionesComunidadQuerySchema,
  type RecomendacionesComunidadQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioComunidad } from "./comunidad.servicio.js";

registroOpenApi.registrarEsquema(
  "PaginaRecomendacionesComunidad",
  PaginaRecomendacionesComunidadSchema,
);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/community/recommendations",
  resumen: "Recomendaciones generales de la comunidad, sin amigos, excluyendo lo ya visto",
  respuestas: {
    200: { descripcion: "Página de recomendaciones.", esquema: "PaginaRecomendacionesComunidad" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: { descripcion: "Parámetros no válidos.", esquema: "ErrorResponse" },
  },
});

export function createComunidadRouter(
  servicio: ServicioComunidad,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/community/recommendations",
    autenticado,
    validate({ query: RecomendacionesComunidadQuerySchema }),
    async (req: Request, res) => {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const query = res.locals.input.query as RecomendacionesComunidadQuery;
      res.json(
        PaginaRecomendacionesComunidadSchema.parse(await servicio.recomendar(req.user.id, query)),
      );
    },
  );

  return router;
}
