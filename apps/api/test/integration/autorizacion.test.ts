import express from "express";
import pino from "pino";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearServicioAuth } from "../../src/modules/auth/auth.service.js";
import { requireAuth, requireRole } from "../../src/middleware/auth.js";
import { createErrorHandler } from "../../src/middleware/error-handler.js";
import { REGLAS_DE_PRUEBA, buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "auth@cinematch.test";
const CONTRASENA = "Clave1234";
const MINUTO = 60_000;

function crearReloj(inicio: string) {
  let ahora = new Date(inicio);
  return {
    reloj: () => ahora,
    avanzar: (ms: number) => {
      ahora = new Date(ahora.getTime() + ms);
    },
  };
}

function cookieDe(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith("cm_session=")) ?? "";
}

// Aplicación mínima con rutas protegidas: prueba los middlewares sin depender de rutas de negocio.
function appProtegida(pool: pg.Pool, reloj: () => Date) {
  const servicio = crearServicioAuth({ pool, reglas: REGLAS_DE_PRUEBA, reloj });
  const app = express();
  app.use(express.json());

  app.get("/perfil", requireAuth(servicio), (req, res) => {
    res.json(req.user);
  });
  app.get("/admin", requireAuth(servicio), requireRole("administrador"), (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/sse-simulado", requireAuth(servicio, { tocarActividad: false }), (_req, res) => {
    res.json({ ok: true });
  });

  app.use(createErrorHandler(pino({ level: "silent" })));
  return app;
}

async function iniciarSesion(
  app: ReturnType<typeof buildTestApp>,
  correo: string,
  contrasena: string,
) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGEN)
    .send({ correo, contrasena });
  return cookieDe(res);
}

describe("requireAuth y requireRole (BE-3.3)", () => {
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

  describe("requireAuth", () => {
    it("sin sesión responde 401 con el formato de error", async () => {
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await request(appProtegida(pool, reloj)).get("/perfil");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: "UNAUTHORIZED", message: "Necesitas iniciar sesión." },
      });
    });

    it("con una cookie inventada responde 401", async () => {
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await request(appProtegida(pool, reloj))
        .get("/perfil")
        .set("Cookie", "cm_session=inventada");

      expect(res.status).toBe(401);
    });

    it("con una sesión válida deja el usuario en req.user", async () => {
      await crearUsuarioConContrasena(pool, "ana_auth", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const cookie = await iniciarSesion(
        buildTestApp(pool, undefined, false, { reloj }),
        CORREO,
        CONTRASENA,
      );

      const res = await request(appProtegida(pool, reloj)).get("/perfil").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: expect.any(Number), username: "ana_auth", rol: "usuario" });
    });

    it("un usuario eliminado pierde el acceso aunque tenga una sesión abierta", async () => {
      const id = await crearUsuarioConContrasena(pool, "ana_borrada", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const cookie = await iniciarSesion(
        buildTestApp(pool, undefined, false, { reloj }),
        CORREO,
        CONTRASENA,
      );
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [id]);

      const res = await request(appProtegida(pool, reloj)).get("/perfil").set("Cookie", cookie);

      expect(res.status).toBe(401);
    });

    it("tocarActividad: false valida la sesión sin renovar la actividad", async () => {
      await crearUsuarioConContrasena(pool, "ana_sin_tocar", CORREO, CONTRASENA);
      const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
      const cookie = await iniciarSesion(
        buildTestApp(pool, undefined, false, { reloj }),
        CORREO,
        CONTRASENA,
      );
      const { rows: antes } = await pool.query<{ ultima: Date }>(
        "SELECT ultima_actividad AS ultima FROM sesion",
      );

      avanzar(5 * MINUTO);
      const res = await request(appProtegida(pool, reloj))
        .get("/sse-simulado")
        .set("Cookie", cookie);
      const { rows: despues } = await pool.query<{ ultima: Date }>(
        "SELECT ultima_actividad AS ultima FROM sesion",
      );

      expect(res.status).toBe(200);
      expect(despues[0]?.ultima.getTime()).toBe(antes[0]?.ultima.getTime());
    });
  });

  describe("requireRole", () => {
    it("un usuario sin el rol administrador recibe 403", async () => {
      await crearUsuarioConContrasena(pool, "ana_normal", CORREO, CONTRASENA);
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const cookie = await iniciarSesion(
        buildTestApp(pool, undefined, false, { reloj }),
        CORREO,
        CONTRASENA,
      );

      const res = await request(appProtegida(pool, reloj)).get("/admin").set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("un administrador accede a la ruta de administración", async () => {
      const id = await crearUsuarioConContrasena(pool, "ana_admin", CORREO, CONTRASENA);
      await pool.query(
        "INSERT INTO rol (nombre) VALUES ('administrador') ON CONFLICT (nombre) DO NOTHING",
      );
      await pool.query(
        "UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = 'administrador') WHERE id = $1",
        [id],
      );
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");
      const cookie = await iniciarSesion(
        buildTestApp(pool, undefined, false, { reloj }),
        CORREO,
        CONTRASENA,
      );

      const res = await request(appProtegida(pool, reloj)).get("/admin").set("Cookie", cookie);

      expect(res.status).toBe(200);
    });

    it("sin sesión, requireRole responde 401 y no 403", async () => {
      const { reloj } = crearReloj("2026-03-01T10:00:00Z");

      const res = await request(appProtegida(pool, reloj)).get("/admin");

      expect(res.status).toBe(401);
    });
  });
});
