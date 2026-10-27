import {
  ActualizarInteresesSchema,
  GeneroSchema,
  type ActualizarIntereses,
} from "@cinematch/shared";
import { Router } from "express";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import { ESQUEMA_LISTA_GENEROS } from "../generos/generos.routes.js";
import type { ServicioIntereses } from "./intereses.service.js";

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/me/interests",
  resumen: "Géneros de interés del usuario de la sesión",
  respuestas: {
    200: { descripcion: "Géneros de interés.", esquema: ESQUEMA_LISTA_GENEROS },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "put",
  ruta: "/api/users/me/interests",
  resumen: "Reemplazar los géneros de interés (mínimo 3, sin repetidos)",
  respuestas: {
    200: { descripcion: "Conjunto guardado.", esquema: ESQUEMA_LISTA_GENEROS },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    422: { descripcion: "Menos de 3 géneros, repetidos o inexistentes.", esquema: "ErrorResponse" },
  },
});

export function createInteresesRouter(
  servicio: ServicioIntereses,
  servicioAuth: ServicioAuth,
): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  // El usuario sale siempre de la sesión, nunca de la URL ni del cuerpo.
  router.get("/users/me/interests", autenticado, async (req, res) => {
    const generos = await servicio.obtener(req.user?.id ?? 0);
    res.json(generos.map((g) => GeneroSchema.parse(g)));
  });

  router.put(
    "/users/me/interests",
    autenticado,
    validate({ body: ActualizarInteresesSchema }),
    async (req, res) => {
      const { generoIds } = res.locals.input.body as ActualizarIntereses;
      const generos = await servicio.reemplazar(req.user?.id ?? 0, generoIds);
      res.json(generos.map((g) => GeneroSchema.parse(g)));
    },
  );

  return router;
}
