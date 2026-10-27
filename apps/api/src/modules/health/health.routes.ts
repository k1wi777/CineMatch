import { HealthResponseSchema, type HealthResponse } from "@cinematch/shared";
import { Router } from "express";
import type pg from "pg";
import { checkDatabase } from "../../lib/db.js";
import { registroOpenApi } from "../../lib/openapi.js";

export function createHealthRouter(pool: pg.Pool): Router {
  const router = Router();

  // Documentación OpenAPI del endpoint: se registra junto a la ruta (convención de docs/OpenAPI).
  registroOpenApi.registrarEsquema("HealthResponse", HealthResponseSchema);
  registroOpenApi.registrar({
    metodo: "get",
    ruta: "/api/health",
    resumen: "Estado de la API y de PostgreSQL",
    respuestas: {
      200: { descripcion: "La API y la base de datos responden.", esquema: "HealthResponse" },
      503: { descripcion: "La base de datos no responde.", esquema: "HealthResponse" },
    },
  });

  router.get("/health", async (_req, res) => {
    const databaseUp = await checkDatabase(pool);
    const body: HealthResponse = {
      status: databaseUp ? "ok" : "degraded",
      database: databaseUp ? "up" : "down",
    };
    res.status(databaseUp ? 200 : 503).json(HealthResponseSchema.parse(body));
  });

  return router;
}
