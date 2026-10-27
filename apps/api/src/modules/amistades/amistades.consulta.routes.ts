import {
  AmistadListaItemSchema,
  BusquedaUsuariosQuerySchema,
  BusquedaUsuarioItemSchema,
  ContadorSolicitudesSchema,
  PaginationQuerySchema,
  SolicitudListaItemSchema,
  type BusquedaUsuariosQuery,
  type PaginationQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioConsultaAmistades } from "./amistades.consulta.js";

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/friends",
  resumen: "Amigos del usuario de la sesión (paginado)",
  respuestas: {
    200: { descripcion: "Lista de amigos." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/friends/requests/received",
  resumen: "Solicitudes pendientes recibidas (paginado)",
  respuestas: { 200: { descripcion: "Solicitudes recibidas." } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/friends/requests/sent",
  resumen: "Solicitudes pendientes enviadas (paginado)",
  respuestas: { 200: { descripcion: "Solicitudes enviadas." } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/friends/requests/received/count",
  resumen: "Número de solicitudes recibidas pendientes",
  respuestas: { 200: { descripcion: "Contador.", esquema: "ContadorSolicitudes" } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users",
  resumen: "Buscar usuarios por username parcial (sin distinguir mayúsculas)",
  respuestas: {
    200: { descripcion: "Usuarios encontrados con su relación con la sesión." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: {
      descripcion: "La búsqueda está vacía o los parámetros no son válidos.",
      esquema: "ErrorResponse",
    },
  },
});

registroOpenApi.registrarEsquema("ContadorSolicitudes", ContadorSolicitudesSchema);

export function createAmistadesConsultaRouter(
  servicio: ServicioConsultaAmistades,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/friends",
    autenticado,
    validate({ query: PaginationQuerySchema }),
    async (req, res) => {
      const pagina = res.locals.input.query as PaginationQuery;
      const datos = await servicio.listarAmigos(idDeSesion(req), pagina);
      res.json({ ...datos, items: datos.items.map((item) => AmistadListaItemSchema.parse(item)) });
    },
  );

  router.get(
    "/friends/requests/received",
    autenticado,
    validate({ query: PaginationQuerySchema }),
    async (req, res) => {
      const pagina = res.locals.input.query as PaginationQuery;
      const datos = await servicio.listarRecibidas(idDeSesion(req), pagina);
      res.json({
        ...datos,
        items: datos.items.map((item) => SolicitudListaItemSchema.parse(item)),
      });
    },
  );

  router.get(
    "/friends/requests/sent",
    autenticado,
    validate({ query: PaginationQuerySchema }),
    async (req, res) => {
      const pagina = res.locals.input.query as PaginationQuery;
      const datos = await servicio.listarEnviadas(idDeSesion(req), pagina);
      res.json({
        ...datos,
        items: datos.items.map((item) => SolicitudListaItemSchema.parse(item)),
      });
    },
  );

  router.get("/friends/requests/received/count", autenticado, async (req, res) => {
    const pendientes = await servicio.contarRecibidasPendientes(idDeSesion(req));
    res.json(ContadorSolicitudesSchema.parse({ pendientes }));
  });

  router.get(
    "/users",
    autenticado,
    validate({ query: BusquedaUsuariosQuerySchema }),
    async (req, res) => {
      const { q, page, pageSize } = res.locals.input.query as BusquedaUsuariosQuery;
      const datos = await servicio.buscarUsuarios(idDeSesion(req), q, { page, pageSize });
      res.json({
        ...datos,
        items: datos.items.map((item) => BusquedaUsuarioItemSchema.parse(item)),
      });
    },
  );

  return router;
}
