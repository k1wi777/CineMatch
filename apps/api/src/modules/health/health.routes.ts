import { HealthResponseSchema, type HealthResponse } from "@cinematch/shared";
import { Router } from "express";
import type pg from "pg";
import { checkDatabase } from "../../lib/db.js";

export function createHealthRouter(pool: pg.Pool): Router {
  const router = Router();

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
