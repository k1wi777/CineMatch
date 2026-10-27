import {
  EstadoSincronizacionSchema,
  ModeracionQuerySchema,
  type ModeracionQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioModeracion } from "./administracion.servicio.js";
import type { SincronizacionAdmin } from "./administracion.servicio.js";

const ParamsResenaSchema = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registrarEsquema("EstadoSincronizacion", EstadoSincronizacionSchema);
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/admin/catalog/sync",
  resumen: "Lanzar la sincronización del catálogo en segundo plano (solo administrador)",
  respuestas: {
    202: { descripcion: "Sincronización iniciada.", esquema: "EstadoSincronizacion" },
    403: { descripcion: "No eres administrador.", esquema: "ErrorResponse" },
    409: { descripcion: "Ya hay una en curso.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/admin/catalog/sync/status",
  resumen: "Estado de la sincronización y último resumen (solo administrador)",
  respuestas: { 200: { descripcion: "Estado.", esquema: "EstadoSincronizacion" } },
});
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/admin/reviews",
  resumen: "Reseñas para moderar, con todas las visibilidades (solo administrador)",
  respuestas: { 200: { descripcion: "Página de reseñas." } },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/admin/reviews/{id}/hide",
  resumen: "Ocultar una reseña (idempotente): notifica al autor y excluye de agregados",
  respuestas: {
    200: { descripcion: "Oculta." },
    404: { descripcion: "No existe.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/admin/reviews/{id}/restore",
  resumen: "Restablecer una reseña oculta (idempotente, sin notificación)",
  respuestas: {
    200: { descripcion: "Restablecida." },
    404: { descripcion: "No existe.", esquema: "ErrorResponse" },
  },
});

function idDeSesion(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.id;
}

export function createAdministracionRouter(
  sincronizacion: SincronizacionAdmin,
  moderacion: ServicioModeracion,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  // Todo el bloque exige sesión y rol administrador.
  router.use("/admin", requireAuth(servicioAuth), requireRole("administrador"));

  router.post("/admin/catalog/sync", (req, res) => {
    const estado = sincronizacion.iniciar(idDeSesion(req));
    res.status(202).json(EstadoSincronizacionSchema.parse(estado));
  });

  router.get("/admin/catalog/sync/status", (_req, res) => {
    res.json(EstadoSincronizacionSchema.parse(sincronizacion.estado()));
  });

  router.get("/admin/reviews", validate({ query: ModeracionQuerySchema }), async (_req, res) => {
    const query = res.locals.input.query as ModeracionQuery;
    res.json(await moderacion.listar(query));
  });

  router.post(
    "/admin/reviews/:id/hide",
    validate({ params: ParamsResenaSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsResenaSchema>;
      await moderacion.ocultar(idDeSesion(req), id);
      res.json({ id, visible: false });
    },
  );

  router.post(
    "/admin/reviews/:id/restore",
    validate({ params: ParamsResenaSchema }),
    async (req, res) => {
      const { id } = res.locals.input.params as z.infer<typeof ParamsResenaSchema>;
      await moderacion.restablecer(idDeSesion(req), id);
      res.json({ id, visible: true });
    },
  );

  return router;
}
