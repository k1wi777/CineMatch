import {
  FiltrarRecibidasQuerySchema,
  PaginationQuerySchema,
  RecomendacionDetalleSchema,
  type FiltrarRecibidasQuery,
  type PaginationQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioAcciones } from "./recomendaciones.acciones.js";
import type { ServicioConsultaRecomendaciones } from "./recomendaciones.consulta.js";

const ParamsRecomendacionSchema = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registrarEsquema("RecomendacionDetalle", RecomendacionDetalleSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/recommendations/received",
  resumen: "Recomendaciones recibidas, filtrables por estado",
  respuestas: { 200: { descripcion: "Página de recomendaciones recibidas." } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/recommendations/sent",
  resumen: "Recomendaciones enviadas",
  respuestas: { 200: { descripcion: "Página de recomendaciones enviadas." } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/recommendations/{id}",
  resumen:
    "Detalle de una recomendación (emisor o receptor). Abrirla por primera vez la marca como abierta",
  respuestas: {
    200: { descripcion: "Detalle.", esquema: "RecomendacionDetalle" },
    404: { descripcion: "No existe o no eres emisor ni receptor.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/recommendations/{id}/accept",
  resumen: "Aceptar una recomendación recibida",
  respuestas: {
    200: { descripcion: "Aceptada." },
    403: { descripcion: "Solo el receptor puede aceptar.", esquema: "ErrorResponse" },
    409: { descripcion: "Transición no permitida.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/recommendations/{id}/discard",
  resumen: "Descartar una recomendación recibida (no notifica al emisor)",
  respuestas: {
    200: { descripcion: "Descartada." },
    403: { descripcion: "Solo el receptor puede descartar.", esquema: "ErrorResponse" },
    409: { descripcion: "Transición no permitida.", esquema: "ErrorResponse" },
  },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createRecomendacionesEstadoRouter(
  consulta: ServicioConsultaRecomendaciones,
  acciones: ServicioAcciones,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  // Las rutas fijas van antes que /:id para que "received" y "sent" no se tomen como id.
  router.get(
    "/recommendations/received",
    autenticado,
    validate({ query: FiltrarRecibidasQuerySchema }),
    async (req, res) => {
      const query = res.locals.input.query as FiltrarRecibidasQuery;
      res.json(await consulta.recibidas(idDeSesion(req), query));
    },
  );

  router.get(
    "/recommendations/sent",
    autenticado,
    validate({ query: PaginationQuerySchema }),
    async (req, res) => {
      const pagina = res.locals.input.query as PaginationQuery;
      res.json(await consulta.enviadas(idDeSesion(req), pagina));
    },
  );

  router.get(
    "/recommendations/:id",
    autenticado,
    validate({ params: ParamsRecomendacionSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsRecomendacionSchema>;
      res.json(RecomendacionDetalleSchema.parse(await consulta.detalle(idDeSesion(req), id)));
    },
  );

  router.post(
    "/recommendations/:id/accept",
    autenticado,
    validate({ params: ParamsRecomendacionSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsRecomendacionSchema>;
      res.json(await acciones.aceptar(idDeSesion(req), id));
    },
  );

  router.post(
    "/recommendations/:id/discard",
    autenticado,
    validate({ params: ParamsRecomendacionSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsRecomendacionSchema>;
      res.json(await acciones.descartar(idDeSesion(req), id));
    },
  );

  return router;
}
