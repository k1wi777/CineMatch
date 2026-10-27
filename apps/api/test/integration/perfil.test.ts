import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CORREO_A = "perfil.a@cinematch.test";
const CORREO_B = "perfil.b@cinematch.test";
const CONTRASENA = "Clave1234";
const NUEVA = "Nueva5678";

function login(app: ReturnType<typeof buildTestApp>, correo: string, contrasena = CONTRASENA) {
  return request(app).post("/api/auth/login").set("Origin", ORIGEN).send({ correo, contrasena });
}

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("perfil propio (BE-4.2)", () => {
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

  describe("GET y PATCH /api/users/me", () => {
    it("exige sesión (401 sin cookie)", async () => {
      const app = buildTestApp(pool);

      const res = await request(app).get("/api/users/me");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("devuelve el perfil de la sesión sin contraseña", async () => {
      await crearUsuarioConContrasena(pool, "perfil_a", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app).get("/api/users/me").set("Cookie", sesion);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(Number),
        nombre: "perfil_a",
        username: "perfil_a",
        correo: CORREO_A,
        bio: null,
        avatarUrl: null,
      });
      expect(JSON.stringify(res.body)).not.toContain("contrasena");
    });

    it("actualiza nombre y bio, y quita las etiquetas HTML de la bio", async () => {
      await crearUsuarioConContrasena(pool, "perfil_editable", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ nombre: "  Ana  López ", bio: "Me gustan <b>las</b> películas de culto." });

      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe("Ana López");
      expect(res.body.bio).toBe("Me gustan las películas de culto.");
    });

    it("una bio vacía o null borra la biografía", async () => {
      await crearUsuarioConContrasena(pool, "perfil_bio", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));
      await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ bio: "Hola" });

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ bio: null });

      expect(res.status).toBe(200);
      expect(res.body.bio).toBeNull();
    });

    it("valida nombre, username y bio con 422 y el campo afectado", async () => {
      await crearUsuarioConContrasena(pool, "perfil_valida", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const nombreVacio = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ nombre: "<b></b>" });
      const usernameInvalido = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ username: "ab" });
      const bioLarga = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ bio: "x".repeat(301) });

      expect(nombreVacio.status).toBe(422);
      expect(nombreVacio.body.error.fields).toHaveProperty("nombre");
      expect(usernameInvalido.status).toBe(422);
      expect(usernameInvalido.body.error.fields).toHaveProperty("username");
      expect(bioLarga.status).toBe(422);
      expect(bioLarga.body.error.fields).toHaveProperty("bio");
    });

    it("rechaza un PATCH sin ningún dato con 422", async () => {
      await crearUsuarioConContrasena(pool, "perfil_vacio", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({});

      expect(res.status).toBe(422);
    });

    it("el username es único sin distinguir mayúsculas (409 con el campo)", async () => {
      await crearUsuarioConContrasena(pool, "ocupado", "otro@cinematch.test", CONTRASENA);
      await crearUsuarioConContrasena(pool, "libre_perfil", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ username: "OCUPADO" });

      expect(res.status).toBe(409);
      expect(res.body.error.fields).toHaveProperty("username");
    });

    it("permite cambiar solo la capitalización del propio username", async () => {
      await crearUsuarioConContrasena(pool, "mi_nombre", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ username: "Mi_Nombre" });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe("Mi_Nombre");
    });

    it("nunca modifica el perfil de otro: el id del cuerpo se ignora", async () => {
      const idB = await crearUsuarioConContrasena(pool, "perfil_ajeno", CORREO_B, CONTRASENA);
      await crearUsuarioConContrasena(pool, "perfil_atacante", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .patch("/api/users/me")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ id: idB, nombre: "Intruso" });
      const ajeno = await request(app)
        .get("/api/users/me")
        .set("Cookie", cookieDe(await login(app, CORREO_B)));

      expect(res.status).toBe(200);
      expect(res.body.id).not.toBe(idB);
      expect(res.body.nombre).toBe("Intruso");
      expect(ajeno.body.nombre).toBe("perfil_ajeno");
    });
  });

  describe("PUT /api/users/me/password", () => {
    it("exige la contraseña actual (422 en el campo contrasenaActual)", async () => {
      await crearUsuarioConContrasena(pool, "perfil_clave", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .put("/api/users/me/password")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ contrasenaActual: "incorrecta1", contrasenaNueva: NUEVA });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("contrasenaActual");
    });

    it("aplica la política de contraseñas a la nueva (422 en contrasenaNueva)", async () => {
      await crearUsuarioConContrasena(pool, "perfil_politica", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .put("/api/users/me/password")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ contrasenaActual: CONTRASENA, contrasenaNueva: "solosletras" });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("contrasenaNueva");
    });

    it("cambia la contraseña y cierra las otras sesiones, pero conserva la actual", async () => {
      await crearUsuarioConContrasena(pool, "perfil_sesiones", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const actual = cookieDe(await login(app, CORREO_A));
      const otra = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .put("/api/users/me/password")
        .set("Origin", ORIGEN)
        .set("Cookie", actual)
        .send({ contrasenaActual: CONTRASENA, contrasenaNueva: NUEVA });
      const sesionOtra = await request(app).get("/api/users/me").set("Cookie", otra);
      const sesionActual = await request(app).get("/api/users/me").set("Cookie", actual);

      expect(res.status).toBe(204);
      expect(sesionOtra.status).toBe(401);
      expect(sesionActual.status).toBe(200);
    });

    it("tras el cambio entra con la nueva contraseña y no con la anterior", async () => {
      await crearUsuarioConContrasena(pool, "perfil_nueva", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_A));
      await request(app)
        .put("/api/users/me/password")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .send({ contrasenaActual: CONTRASENA, contrasenaNueva: NUEVA });

      const antigua = await login(app, CORREO_A, CONTRASENA);
      const nueva = await login(app, CORREO_A, NUEVA);

      expect(antigua.status).toBe(401);
      expect(nueva.status).toBe(200);
    });

    it("exige sesión (401 sin cookie)", async () => {
      const app = buildTestApp(pool);

      const res = await request(app)
        .put("/api/users/me/password")
        .set("Origin", ORIGEN)
        .send({ contrasenaActual: CONTRASENA, contrasenaNueva: NUEVA });

      expect(res.status).toBe(401);
    });
  });
});
