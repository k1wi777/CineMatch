import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "../helpers/database.js";
import { buildTestApp } from "../helpers/app.js";

describe("documentación OpenAPI en HTTP (BE-2.6)", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("sirve la especificación y Swagger UI en desarrollo", async () => {
    const app = buildTestApp(pool, undefined, true);

    const spec = await request(app).get("/api/docs.json");
    const ui = await request(app).get("/api/docs/");

    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths).toHaveProperty("/api/health");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("swagger");
  });

  it("no sirve la documentación fuera de desarrollo", async () => {
    const app = buildTestApp(pool, undefined, false);

    const spec = await request(app).get("/api/docs.json");
    const ui = await request(app).get("/api/docs/");

    expect(spec.status).toBe(404);
    expect(spec.body.error.code).toBe("NOT_FOUND");
    expect(ui.status).toBe(404);
  });
});
