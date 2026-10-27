import { createHash } from "node:crypto";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, REGLAS_DE_PRUEBA } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "ana@cinematch.test";
const CONTRASENA = "Clave1234";
const MINUTO = 60_000;

// Reloj simulado: el test controla el paso del tiempo.
function crearReloj(inicio: string) {
  let ahora = new Date(inicio);
  return {
    reloj: () => ahora,
    avanzar: (ms: number) => {
      ahora = new Date(ahora.getTime() + ms);
    },
  };
}

function cookieDe(res: request.Response): string | undefined {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith("cm_session="));
}

function valorDeCookie(res: request.Response): string {
  const valor = cookieDe(res)?.split(";")[0]?.slice("cm_session=".length);
  if (!valor) throw new Error("La respuesta no trae la cookie cm_session");
  return decodeURIComponent(valor);
}

function login(app: ReturnType<typeof buildTestApp>, correo = CORREO, contrasena = CONTRASENA) {
  return request(app).post("/api/auth/login").set("Origin", ORIGEN).send({ correo, contrasena });
}

describe("inicio de sesión, sesiones y cookie (BE-3.2)", () => {
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

  describe("login", () => {
    it("inicia sesión con credenciales correctas y devuelve el usuario", async () => {
      await crearUsuarioConContrasena(pool, "ana_login", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await login(buildTestApp(pool, undefined, false, { reloj }));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(Number),
        username: "ana_login",
        nombre: "ana_login",
        rol: "usuario",
      });
    });

    it("la cookie es httpOnly, SameSite=Lax, Path=/ y sin Max-Age; Secure solo en producción", async () => {
      await crearUsuarioConContrasena(pool, "ana_cookie", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const desarrollo = await login(buildTestApp(pool, undefined, false, { reloj }));
      const produccion = await login(
        buildTestApp(pool, undefined, false, { reloj, produccion: true }),
      );

      expect(cookieDe(desarrollo)).toMatch(/HttpOnly/);
      expect(cookieDe(desarrollo)).toMatch(/SameSite=Lax/);
      expect(cookieDe(desarrollo)).toMatch(/Path=\//);
      expect(cookieDe(desarrollo)).not.toMatch(/Max-Age|Expires/);
      expect(cookieDe(desarrollo)).not.toMatch(/Secure/);
      expect(cookieDe(produccion)).toMatch(/Secure/);
    });

    it("la base guarda el hash del token, nunca el token en claro", async () => {
      await crearUsuarioConContrasena(pool, "ana_hash", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await login(buildTestApp(pool, undefined, false, { reloj }));
      const token = valorDeCookie(res);
      const { rows } = await pool.query<{ id: string }>("SELECT id FROM sesion");

      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(createHash("sha256").update(token).digest("hex"));
      expect(rows[0]?.id).not.toBe(token);
    });

    it("cada login crea una sesión nueva", async () => {
      await crearUsuarioConContrasena(pool, "ana_nueva", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });

      const primera = valorDeCookie(await login(app));
      const segunda = valorDeCookie(await login(app));
      const { rows } = await pool.query<{ total: string }>("SELECT count(*) AS total FROM sesion");

      expect(primera).not.toBe(segunda);
      expect(rows[0]?.total).toBe("2");
    });

    it("correo inexistente y contraseña errónea responden igual", async () => {
      await crearUsuarioConContrasena(pool, "ana_igual", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });

      const contrasenaErronea = await login(app, CORREO, "otra-clave-99");
      const correoInexistente = await login(app, "nadie@cinematch.test", CONTRASENA);

      expect(contrasenaErronea.status).toBe(401);
      expect(correoInexistente.status).toBe(401);
      expect(contrasenaErronea.body).toEqual(correoInexistente.body);
      expect(contrasenaErronea.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("5 fallos bloquean la cuenta 15 minutos, incluso con la contraseña correcta", async () => {
      await crearUsuarioConContrasena(pool, "ana_bloqueo", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });

      for (let intento = 1; intento <= 5; intento++) {
        const res = await login(app, CORREO, "clave-mala-123");
        expect(res.status).toBe(401);
      }

      expect((await login(app)).status).toBe(423);
      avanzar(14 * MINUTO);
      expect((await login(app)).status).toBe(423);
      avanzar(2 * MINUTO);
      const despues = await login(app);
      expect(despues.status).toBe(200);
    });

    it("cuatro fallos no bloquean la cuenta", async () => {
      await crearUsuarioConContrasena(pool, "ana_cuatro", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });

      for (let intento = 1; intento <= 4; intento++) {
        await login(app, CORREO, "clave-mala-123");
      }

      expect((await login(app)).status).toBe(200);
    });

    it("un usuario eliminado se trata como credenciales inválidas", async () => {
      const id = await crearUsuarioConContrasena(pool, "ana_eliminada", CORREO, CONTRASENA);
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [id]);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await login(buildTestApp(pool, undefined, false, { reloj }));

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("valida el formato del correo antes de buscar al usuario (422)", async () => {
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await login(buildTestApp(pool, undefined, false, { reloj }), "no-es-correo");

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("correo");
    });
  });

  describe("GET /auth/me y expiración de la sesión", () => {
    it("devuelve el usuario con una sesión válida y 401 sin cookie", async () => {
      await crearUsuarioConContrasena(pool, "ana_me", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });
      const cookie = cookieDe(await login(app)) ?? "";

      const conSesion = await request(app).get("/api/auth/me").set("Cookie", cookie);
      const sinSesion = await request(app).get("/api/auth/me");

      expect(conSesion.status).toBe(200);
      expect(conSesion.body.username).toBe("ana_me");
      expect(sinSesion.status).toBe(401);
      expect(sinSesion.body.error.code).toBe("UNAUTHORIZED");
    });

    it("la sesión expira a los 30 minutos sin actividad", async () => {
      await crearUsuarioConContrasena(pool, "ana_inactiva", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });
      const cookie = cookieDe(await login(app)) ?? "";

      avanzar(31 * MINUTO);
      const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

      expect(res.status).toBe(401);
    });

    it("la actividad mantiene viva la sesión dentro del límite de inactividad", async () => {
      await crearUsuarioConContrasena(pool, "ana_activa", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });
      const cookie = cookieDe(await login(app)) ?? "";

      for (let vuelta = 0; vuelta < 3; vuelta++) {
        avanzar(20 * MINUTO);
        expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
      }
    });

    it("el tope absoluto corta la sesión aunque haya actividad", async () => {
      await crearUsuarioConContrasena(pool, "ana_absoluta", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const reglas = { ...REGLAS_DE_PRUEBA, SESSION_ABSOLUTE_DAYS: 1 };
      const app = buildTestApp(pool, undefined, false, { reloj, reglas });
      const cookie = cookieDe(await login(app)) ?? "";

      let ultimo = 0;
      for (let minutos = 0; minutos < 26 * 60; minutos += 20) {
        avanzar(20 * MINUTO);
        ultimo = (await request(app).get("/api/auth/me").set("Cookie", cookie)).status;
      }

      expect(ultimo).toBe(401);
    });

    it("solo actualiza la última actividad si pasó más de 60 segundos", async () => {
      await crearUsuarioConContrasena(pool, "ana_touch", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });
      const cookie = cookieDe(await login(app)) ?? "";
      const { rows: inicial } = await pool.query<{ ultima: Date }>(
        "SELECT ultima_actividad AS ultima FROM sesion",
      );

      avanzar(30_000);
      await request(app).get("/api/auth/me").set("Cookie", cookie);
      const { rows: tras30 } = await pool.query<{ ultima: Date }>(
        "SELECT ultima_actividad AS ultima FROM sesion",
      );

      avanzar(31_000);
      await request(app).get("/api/auth/me").set("Cookie", cookie);
      const { rows: tras61 } = await pool.query<{ ultima: Date }>(
        "SELECT ultima_actividad AS ultima FROM sesion",
      );

      expect(tras30[0]?.ultima.getTime()).toBe(inicial[0]?.ultima.getTime());
      expect(tras61[0]?.ultima.getTime()).toBeGreaterThan(inicial[0]?.ultima.getTime() ?? 0);
    });
  });

  describe("logout", () => {
    it("cierra la sesión, borra la cookie y es idempotente", async () => {
      await crearUsuarioConContrasena(pool, "ana_logout", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const app = buildTestApp(pool, undefined, false, { reloj });
      const cookie = cookieDe(await login(app)) ?? "";

      const primero = await request(app)
        .post("/api/auth/logout")
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);
      const segundo = await request(app)
        .post("/api/auth/logout")
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);
      const me = await request(app).get("/api/auth/me").set("Cookie", cookie);

      expect(primero.status).toBe(204);
      expect(segundo.status).toBe(204);
      expect(cookieDe(primero)).toMatch(/cm_session=;/);
      expect(me.status).toBe(401);
    });
  });
});
