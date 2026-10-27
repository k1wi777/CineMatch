import { Router } from "express";
import type pg from "pg";
import { checkDatabase } from "../../lib/db.js";

export function createHealthRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const databaseUp = await checkDatabase(pool);
    res.status(databaseUp ? 200 : 503).json({
      status: databaseUp ? "ok" : "degraded",
      database: databaseUp ? "up" : "down",
    });
  });

  return router;
}
