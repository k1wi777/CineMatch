import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";

describe("GET /api/health", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("responde 200 con la base de datos disponible", async () => {
    const res = await request(buildTestApp(pool)).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });

  it("responde 503 cuando la base de datos no responde", async () => {
    const unreachable = new pg.Pool({
      connectionString: "postgres://cinematch:cinematch@127.0.0.1:1/cinematch_test",
      connectionTimeoutMillis: 500,
    });

    try {
      const res = await request(buildTestApp(unreachable)).get("/api/health");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "degraded", database: "down" });
    } finally {
      await unreachable.end();
    }
  });
});

describe("rutas desconocidas", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("devuelven el formato de error acordado", async () => {
    const res = await request(buildTestApp(pool)).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Ruta no encontrada" },
    });
  });
});
