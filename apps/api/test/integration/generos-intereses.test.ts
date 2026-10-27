import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearGenero, crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "intereses@cinematch.test";
const CONTRASENA = "Clave1234";

function login(app: ReturnType<typeof buildTestApp>) {
  return request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGEN)
    .send({ correo: CORREO, contrasena: CONTRASENA });
}

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("catálogo de géneros e intereses (BE-4.1 y BE-4.3)", () => {
  let pool: pg.Pool;
  let accion: number;
  let comedia: number;
  let drama: number;
  let terror: number;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    // Creados fuera de orden alfabético a propósito: la API debe devolverlos ordenados.
    comedia = await crearGenero(pool, "Comedia");
    terror = await crearGenero(pool, "Terror");
    accion = await crearGenero(pool, "Acción");
    drama = await crearGenero(pool, "Drama");
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("GET /api/genres", () => {
    it("es público, devuelve la lista completa ordenada por nombre y es cacheable", async () => {
      const app = buildTestApp(pool);

      const res = await request(app).get("/api/genres");

      expect(res.status).toBe(200);
      expect(res.body.map((g: { nombre: string }) => g.nombre)).toEqual([
        "Acción",
        "Comedia",
        "Drama",
        "Terror",
      ]);
      expect(res.headers["cache-control"]).toContain("max-age=");
      expect(res.headers.etag).toBeDefined();
    });

    it("responde 304 cuando el cliente envía el ETag vigente", async () => {
      const app = buildTestApp(pool);
      const primera = await request(app).get("/api/genres");

      const segunda = await request(app)
        .get("/api/genres")
        .set("If-None-Match", String(primera.headers.etag));

      expect(segunda.status).toBe(304);
    });
  });

  describe("GET y PUT /api/users/me/interests", () => {
    it("exigen sesión (401 sin cookie)", async () => {
      const app = buildTestApp(pool);

      const lectura = await request(app).get("/api/users/me/interests");
      const escritura = await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .send({ generoIds: [accion, comedia, drama] });

      expect(lectura.status).toBe(401);
      expect(lectura.body.error.code).toBe("UNAUTHORIZED");
      expect(escritura.status).toBe(401);
    });

    it("devuelve los intereses del usuario de la sesión", async () => {
      await crearUsuarioConContrasena(pool, "usuario_intereses", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));
      await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [terror, accion, comedia] });

      const res = await request(app).get("/api/users/me/interests").set("Cookie", sesion);

      expect(res.status).toBe(200);
      expect(res.body.map((g: { id: number }) => g.id).sort()).toEqual(
        [accion, comedia, terror].sort(),
      );
    });

    it("sustituye el conjunto completo, no lo acumula", async () => {
      await crearUsuarioConContrasena(pool, "usuario_reemplazo", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));

      await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [accion, comedia, drama] });
      const res = await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [terror, drama, accion] });

      expect(res.status).toBe(200);
      expect(res.body.map((g: { id: number }) => g.id).sort()).toEqual(
        [accion, drama, terror].sort(),
      );
    });

    it("rechaza menos de 3 géneros con 422 y el campo generoIds", async () => {
      await crearUsuarioConContrasena(pool, "usuario_pocos", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));

      const res = await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [accion, comedia] });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("generoIds");
    });

    it("rechaza géneros repetidos con 422", async () => {
      await crearUsuarioConContrasena(pool, "usuario_repetidos", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));

      const res = await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [accion, accion, comedia] });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("generoIds");
    });

    it("rechaza un género inexistente y no cambia los intereses previos", async () => {
      await crearUsuarioConContrasena(pool, "usuario_inexistente", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));
      await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [accion, comedia, drama] });

      const res = await request(app)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ generoIds: [accion, comedia, 999_999] });
      const actuales = await request(app).get("/api/users/me/interests").set("Cookie", sesion);

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("generoIds");
      expect(actuales.body.map((g: { id: number }) => g.id).sort()).toEqual(
        [accion, comedia, drama].sort(),
      );
    });

    it("rechaza el PUT sin Origin válido (CSRF, 403)", async () => {
      await crearUsuarioConContrasena(pool, "usuario_csrf", CORREO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app));

      const res = await request(app)
        .put("/api/users/me/interests")
        .set("Cookie", sesion)
        .send({ generoIds: [accion, comedia, drama] });

      expect(res.status).toBe(403);
    });
  });
});
