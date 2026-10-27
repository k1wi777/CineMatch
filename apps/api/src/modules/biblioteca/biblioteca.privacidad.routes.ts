import {
  BibliotecaQuerySchema,
  PaginaBibliotecaSchema,
  type BibliotecaQuery,
} from "@cinematch/shared";
import { Router, type Request } from "express";
import type pg from "pg";
import { z } from "zod";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioBiblioteca } from "./biblioteca.servicio.js";

const ParamsUsuarioSchema = z.object({
  id: z.coerce.number().int().positive(),
});

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/{id}/library",
  resumen: "Biblioteca de un usuario: la ve su dueño y sus amigos",
  respuestas: {
    200: { descripcion: "Biblioteca del usuario.", esquema: "PaginaBiblioteca" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    403: { descripcion: "No sois amigos: la biblioteca es privada.", esquema: "ErrorResponse" },
    404: { descripcion: "El usuario no existe.", esquema: "ErrorResponse" },
  },
});

export type DependenciasPrivacidadBiblioteca = {
  pool: pg.Pool;
  servicio: ServicioBiblioteca;
  amigos: { sonAmigos(a: number, b: number): Promise<boolean> };
  servicioAuth: ServicioAuth;
};

// Privacidad de la biblioteca (BE-8.4): el dueño y sus amigos la ven; cualquier otro recibe 403.
export function createBibliotecaPrivacidadRouter(deps: DependenciasPrivacidadBiblioteca): Router {
  const { pool, servicio, amigos, servicioAuth } = deps;
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/users/:id/library",
    autenticado,
    validate({ params: ParamsUsuarioSchema, query: BibliotecaQuerySchema }),
    async (req: Request, res) => {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const { id } = res.locals.input.params as z.infer<typeof ParamsUsuarioSchema>;
      const query = res.locals.input.query as BibliotecaQuery;
      const yo = req.user.id;

      const { rows } = await pool.query(
        "SELECT 1 FROM usuario WHERE id = $1 AND eliminado_en IS NULL",
        [id],
      );
      if (rows.length === 0) {
        throw new NotFoundError("El usuario no existe.");
      }

      const puedeVer = id === yo || (await amigos.sonAmigos(yo, id));
      if (!puedeVer) {
        throw new ForbiddenError("Esta biblioteca solo la ven sus amigos.");
      }

      res.json(PaginaBibliotecaSchema.parse(await servicio.listar(id, query)));
    },
  );

  return router;
}
