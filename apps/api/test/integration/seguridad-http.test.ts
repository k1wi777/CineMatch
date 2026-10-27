import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "../helpers/database.js";
import { buildTestApp, SEGURIDAD_DE_PRUEBA } from "../helpers/app.js";

const ORIGEN_WEB = "http://localhost:3000";
const ORIGEN_AJENO = "https://sitio-ajeno.example";

describe("seguridad base de la API (BE-2.4)", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("cabeceras (helmet)", () => {
    it("envía las cabeceras de seguridad y oculta x-powered-by", async () => {
      const res = await request(buildTestApp(pool)).get("/api/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
      expect(res.headers["content-security-policy"]).toBeDefined();
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("CORS", () => {
    it("permite el origen de la web", async () => {
      const res = await request(buildTestApp(pool)).get("/api/health").set("Origin", ORIGEN_WEB);

      expect(res.headers["access-control-allow-origin"]).toBe(ORIGEN_WEB);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("nunca concede CORS a un origen ajeno: el navegador compara la cabecera con su propio origen", async () => {
      const res = await request(buildTestApp(pool)).get("/api/health").set("Origin", ORIGEN_AJENO);

      // La librería cors devuelve siempre el origen configurado; un origen ajeno nunca coincide con él.
      expect(res.headers["access-control-allow-origin"]).not.toBe(ORIGEN_AJENO);
    });
  });

  describe("protección CSRF", () => {
    it("rechaza una petición que cambia estado sin Origin ni Referer (403)", async () => {
      const res = await request(buildTestApp(pool)).post("/api/nada");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rechaza una petición que cambia estado desde otro origen (403)", async () => {
      const res = await request(buildTestApp(pool)).post("/api/nada").set("Origin", ORIGEN_AJENO);

      expect(res.status).toBe(403);
    });

    it("acepta una petición que cambia estado desde el origen permitido", async () => {
      const res = await request(buildTestApp(pool)).post("/api/nada").set("Origin", ORIGEN_WEB);

      expect(res.status).toBe(404);
    });

    it("acepta el origen permitido cuando llega por Referer", async () => {
      const res = await request(buildTestApp(pool))
        .post("/api/nada")
        .set("Referer", `${ORIGEN_WEB}/perfil?tab=1`);

      expect(res.status).toBe(404);
    });

    it("no exige Origin para métodos seguros", async () => {
      const res = await request(buildTestApp(pool)).get("/api/health");

      expect(res.status).toBe(200);
    });
  });

  describe("límite de tamaño del cuerpo", () => {
    it("responde 413 con el formato de error si el JSON supera el límite", async () => {
      const cuerpoGrande = { texto: "x".repeat(200_000) };

      const res = await request(buildTestApp(pool))
        .post("/api/nada")
        .set("Origin", ORIGEN_WEB)
        .send(cuerpoGrande);

      expect(res.status).toBe(413);
      expect(res.body).toEqual({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "La petición supera el tamaño máximo permitido.",
        },
      });
    });
  });

  describe("límites de tasa", () => {
    it("responde 429 cuando se supera el límite general", async () => {
      const app = buildTestApp(pool, {
        ...SEGURIDAD_DE_PRUEBA,
        limites: { ...SEGURIDAD_DE_PRUEBA.limites, general: { ventanaMs: 60_000, max: 2 } },
      });

      await request(app).get("/api/health");
      await request(app).get("/api/health");
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    });

    it("aplica un límite más estricto en /api/auth", async () => {
      const app = buildTestApp(pool, {
        ...SEGURIDAD_DE_PRUEBA,
        limites: { ...SEGURIDAD_DE_PRUEBA.limites, auth: { ventanaMs: 60_000, max: 1 } },
      });

      const primera = await request(app).post("/api/auth/login").set("Origin", ORIGEN_WEB);
      const segunda = await request(app).post("/api/auth/login").set("Origin", ORIGEN_WEB);

      // La primera pasa el límite (aquí responde 401 por credenciales inválidas); la segunda ya no.
      expect(primera.status).not.toBe(429);
      expect(segunda.status).toBe(429);
      expect(segunda.body.error.code).toBe("TOO_MANY_REQUESTS");
    });
  });
});
