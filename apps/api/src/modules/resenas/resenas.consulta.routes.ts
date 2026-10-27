import { PaginationQuerySchema, type PaginationQuery } from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioConsultaResenas } from "./resenas.consulta.js";

const ParamsTituloSchema = z.object({ contentId: z.coerce.number().int().positive() });
const ParamsUsuarioSchema = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/titles/{contentId}/stats",
  resumen: "Promedios, conteos y etiquetas de la comunidad de un título",
  respuestas: {
    200: { descripcion: "Agregados del título según la regla de visibilidad." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/titles/{contentId}/reviews",
  resumen: "Reseñas con comentario de un título que puedes ver, más tu propia reseña",
  respuestas: {
    200: { descripcion: "Página de reseñas." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/me/reviews",
  resumen: "Todas tus reseñas",
  respuestas: { 200: { descripcion: "Página de tus reseñas." } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/{id}/reviews",
  resumen: "Reseñas de un usuario que puedes ver",
  respuestas: { 200: { descripcion: "Página de reseñas del usuario." } },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createResenasConsultaRouter(
  servicio: ServicioConsultaResenas,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/titles/:contentId/stats",
    autenticado,
    validate({ params: ParamsTituloSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      res.json(await servicio.estadisticas(contentId, idDeSesion(req)));
    },
  );

  router.get(
    "/titles/:contentId/reviews",
    autenticado,
    validate({ params: ParamsTituloSchema, query: PaginationQuerySchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      const pagina = res.locals.input.query as PaginationQuery;
      res.json(await servicio.resenasDeTitulo(contentId, idDeSesion(req), pagina));
    },
  );

  // Va antes que /users/:id/reviews: "me" no es un id numérico.
  router.get(
    "/users/me/reviews",
    autenticado,
    validate({ query: PaginationQuerySchema }),
    async (req, res) => {
      const pagina = res.locals.input.query as PaginationQuery;
      const yo = idDeSesion(req);
      res.json(await servicio.resenasDeUsuario(yo, yo, pagina));
    },
  );

  router.get(
    "/users/:id/reviews",
    autenticado,
    validate({ params: ParamsUsuarioSchema, query: PaginationQuerySchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsUsuarioSchema>;
      const pagina = res.locals.input.query as PaginationQuery;
      res.json(await servicio.resenasDeUsuario(id, idDeSesion(req), pagina));
    },
  );

  return router;
}
