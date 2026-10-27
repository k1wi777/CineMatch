import {
  CatalogoPaginaSchema,
  CatalogoQuerySchema,
  TituloFichaSchema,
  type CatalogoQuery,
} from "@cinematch/shared";
import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioCatalogo } from "./catalogo.consulta.js";

const ParamsTituloSchema = z.object({
  id: z.coerce.number().int().positive(),
});

registroOpenApi.registrarEsquema("PaginaCatalogo", CatalogoPaginaSchema);
registroOpenApi.registrarEsquema("TituloFicha", TituloFichaSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/catalog",
  resumen: "Catálogo con búsqueda (sin tildes), filtro por tipo y géneros, y paginación",
  respuestas: {
    200: { descripcion: "Página del catálogo, por popularidad.", esquema: "PaginaCatalogo" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: { descripcion: "Parámetros no válidos.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/catalog/{id}",
  resumen: "Ficha base de un título",
  respuestas: {
    200: { descripcion: "Ficha del título.", esquema: "TituloFicha" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "No existe ese título.", esquema: "ErrorResponse" },
  },
});

export function createCatalogoRouter(
  servicio: ServicioCatalogo,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/catalog",
    autenticado,
    validate({ query: CatalogoQuerySchema }),
    async (_req, res) => {
      const query = res.locals.input.query as CatalogoQuery;
      res.json(CatalogoPaginaSchema.parse(await servicio.listar(query)));
    },
  );

  router.get(
    "/catalog/:id",
    autenticado,
    validate({ params: ParamsTituloSchema }),
    async (_req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      const ficha = await servicio.obtenerFicha(id);
      if (!ficha) {
        throw new NotFoundError("El título no existe.");
      }
      res.json(TituloFichaSchema.parse(ficha));
    },
  );

  return router;
}
