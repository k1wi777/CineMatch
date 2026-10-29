import {
  BibliotecaQuerySchema,
  EstablecerEstadoSchema,
  EstadoActualBibliotecaSchema,
  PaginaBibliotecaSchema,
  type BibliotecaQuery,
  type EstablecerEstado,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioBiblioteca } from "./biblioteca.servicio.js";

const ParamsContenidoSchema = z.object({
  contentId: z.coerce.number().int().positive(),
});

const SeguimientoSchema = z.object({
  contenidoId: z.number().int(),
  estado: z.enum(["pendiente", "viendo", "vista", "abandonada"]),
  fechaActualizacion: z.string(),
});

registroOpenApi.registrarEsquema("PaginaBiblioteca", PaginaBibliotecaSchema);
registroOpenApi.registrarEsquema("Seguimiento", SeguimientoSchema);
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/library",
  resumen: "Biblioteca del usuario con filtros, orden, paginación y conteos por estado",
  respuestas: {
    200: { descripcion: "Página de la biblioteca.", esquema: "PaginaBiblioteca" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: { descripcion: "Parámetros no válidos.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "put",
  ruta: "/api/library/{contentId}",
  resumen: "Establecer el estado de un título (crea o cambia)",
  respuestas: {
    200: { descripcion: "Estado guardado.", esquema: "Seguimiento" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "El título no existe.", esquema: "ErrorResponse" },
    422: { descripcion: "Estado no válido.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/library/{contentId}",
  resumen: "Quitar un título de la biblioteca (idempotente)",
  respuestas: {
    204: { descripcion: "Quitado, o no estaba." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});

// El usuario siempre sale de la sesión; nunca de la URL ni del cuerpo.
function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createBibliotecaRouter(
  servicio: ServicioBiblioteca,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/library",
    autenticado,
    validate({ query: BibliotecaQuerySchema }),
    async (req, res) => {
      const query = res.locals.input.query as BibliotecaQuery;
      res.json(PaginaBibliotecaSchema.parse(await servicio.listar(idDeSesion(req), query)));
    },
  );

  // Estado del título para la barra de acciones de la ficha. null si no está en la biblioteca.
  router.get(
    "/library/:contentId",
    autenticado,
    validate({ params: ParamsContenidoSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsContenidoSchema>;
      const estado = await servicio.estadoDe(idDeSesion(req), contentId);
      res.json(EstadoActualBibliotecaSchema.parse({ estado }));
    },
  );

  router.put(
    "/library/:contentId",
    autenticado,
    validate({ params: ParamsContenidoSchema, body: EstablecerEstadoSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsContenidoSchema>;
      const { estado } = res.locals.input.body as EstablecerEstado;
      const seguimiento = await servicio.establecerEstado(idDeSesion(req), contentId, estado);
      res.json(SeguimientoSchema.parse(seguimiento));
    },
  );

  router.delete(
    "/library/:contentId",
    autenticado,
    validate({ params: ParamsContenidoSchema }),
    async (req, res) => {
      const { contentId } = res.locals.input.params as z.infer<typeof ParamsContenidoSchema>;
      await servicio.quitar(idDeSesion(req), contentId);
      res.status(204).end();
    },
  );

  return router;
}
