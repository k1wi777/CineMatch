import { GeneroSchema, type Genero } from "@cinematch/shared";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import { registroOpenApi } from "../../lib/openapi.js";

// Catálogo público de géneros (BE-4.1). Lista completa, orden estable y cacheable:
// el navegador revalida con ETag (Express lo calcula al enviar el JSON) y la caché compartida guarda una hora.
const CACHE_CONTROL_GENEROS = "public, max-age=3600";

// Nombre de esquema compartido con los intereses del usuario (lista de géneros).
export const ESQUEMA_LISTA_GENEROS = "ListaGeneros";
registroOpenApi.registrarEsquema(ESQUEMA_LISTA_GENEROS, z.array(GeneroSchema));
registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/genres",
  resumen: "Catálogo completo de géneros (público)",
  respuestas: {
    200: { descripcion: "Lista de géneros ordenada por nombre.", esquema: ESQUEMA_LISTA_GENEROS },
  },
});

export function createGenerosRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/genres", async (_req, res) => {
    const { rows } = await pool.query<Genero>("SELECT id, nombre FROM genero ORDER BY nombre, id");
    res.set("Cache-Control", CACHE_CONTROL_GENEROS);
    res.json(rows.map((fila) => GeneroSchema.parse(fila)));
  });

  return router;
}
