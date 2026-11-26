import {
  CatalogoPaginaSchema,
  CatalogoQuerySchema,
  DestacadosSchema,
  TituloFichaSchema,
  TrailerSchema,
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

// Títulos que devuelve el carrusel del inicio.
const LIMITE_DESTACADOS = 6;

registroOpenApi.registrarEsquema("PaginaCatalogo", CatalogoPaginaSchema);
registroOpenApi.registrarEsquema("TituloFicha", TituloFichaSchema);
registroOpenApi.registrarEsquema("Trailer", TrailerSchema);
registroOpenApi.registrarEsquema("Destacados", DestacadosSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/catalog/destacados",
  resumen: "Títulos destacados del inicio, con imagen horizontal (los más populares)",
  respuestas: {
    200: { descripcion: "Lista de destacados.", esquema: "Destacados" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
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
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/catalog/{id}/trailer",
  resumen: "Enlace al tráiler de YouTube (se consulta a la fuente externa como mucho cada 30 días)",
  respuestas: {
    200: { descripcion: "Enlace al tráiler, o null si no hay.", esquema: "Trailer" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "No existe ese título.", esquema: "ErrorResponse" },
    502: { descripcion: "La fuente externa no responde.", esquema: "ErrorResponse" },
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

  // Antes de /catalog/:id, para que «destacados» no se tome por un id.
  router.get("/catalog/destacados", autenticado, async (_req, res) => {
    res.json(DestacadosSchema.parse(await servicio.destacados(LIMITE_DESTACADOS)));
  });

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

  router.get(
    "/catalog/:id/trailer",
    autenticado,
    validate({ params: ParamsTituloSchema }),
    async (_req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsTituloSchema>;
      const trailer = await servicio.obtenerTrailer(id);
      if (!trailer) {
        throw new NotFoundError("El título no existe.");
      }
      res.json(TrailerSchema.parse(trailer));
    },
  );

  return router;
}
