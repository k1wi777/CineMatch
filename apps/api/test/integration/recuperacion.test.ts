import { createHash } from "node:crypto";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, correoDePrueba } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "rec@cinematch.test";
const CONTRASENA_VIEJA = "Clave1234";
const CONTRASENA_NUEVA = "Nueva5678";
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

function tokenDelEnlace(enlace: string): string {
  const token = new URL(enlace).searchParams.get("token");
  if (!token) throw new Error("El enlace no trae token");
  return token;
}

async function esperarEnvio(correo: { enviados: unknown[] }, cuantos = 1): Promise<void> {
  await vi.waitFor(() => expect(correo.enviados.length).toBeGreaterThanOrEqual(cuantos));
}

function solicitar(app: ReturnType<typeof buildTestApp>, correo: string) {
  return request(app).post("/api/auth/forgot-password").set("Origin", ORIGEN).send({ correo });
}

function restablecer(app: ReturnType<typeof buildTestApp>, token: string, contrasena: string) {
  return request(app)
    .post("/api/auth/reset-password")
    .set("Origin", ORIGEN)
    .send({ token, contrasena });
}

function login(app: ReturnType<typeof buildTestApp>, correo: string, contrasena: string) {
  return request(app).post("/api/auth/login").set("Origin", ORIGEN).send({ correo, contrasena });
}

describe("recuperación de contraseña (BE-3.4)", () => {
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

  it("envía un enlace con token y guarda solo su hash", async () => {
    await crearUsuarioConContrasena(pool, "rec_envio", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });

    const res = await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM token_recuperacion");

    expect(res.status).toBe(202);
    expect(correo.enviados[0]?.destino).toBe(CORREO);
    expect(correo.enviados[0]?.enlace).toMatch(/^http:\/\/localhost:3000\/restablecer\?token=/);
    expect(rows[0]?.id).toBe(createHash("sha256").update(token).digest("hex"));
    expect(rows[0]?.id).not.toBe(token);
  });

  it("responde igual exista o no el correo, y no envía nada si no existe", async () => {
    await crearUsuarioConContrasena(pool, "rec_igual", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });

    const existe = await solicitar(app, CORREO);
    const noExiste = await solicitar(app, "nadie@cinematch.test");
    await esperarEnvio(correo);
    const { rows } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM token_recuperacion",
    );

    expect(existe.status).toBe(202);
    expect(noExiste.status).toBe(202);
    expect(existe.body).toEqual(noExiste.body);
    expect(correo.enviados).toHaveLength(1);
    expect(rows[0]?.total).toBe("1");
  });

  it("restablece la contraseña una sola vez y el enlace no vuelve a servir", async () => {
    await crearUsuarioConContrasena(pool, "rec_una_vez", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });
    await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");

    const primero = await restablecer(app, token, CONTRASENA_NUEVA);
    const segundo = await restablecer(app, token, CONTRASENA_NUEVA);

    expect(primero.status).toBe(204);
    expect(segundo.status).toBe(400);
    expect(segundo.body.error.code).toBe("RESET_TOKEN_USED");
    expect((await login(app, CORREO, CONTRASENA_NUEVA)).status).toBe(200);
    expect((await login(app, CORREO, CONTRASENA_VIEJA)).status).toBe(401);
  });

  it("un enlace vencido muestra su propio error", async () => {
    await crearUsuarioConContrasena(pool, "rec_vencido", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
    const app = buildTestApp(pool, undefined, false, { correo, reloj });
    await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");

    avanzar(61 * MINUTO);
    const res = await restablecer(app, token, CONTRASENA_NUEVA);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_TOKEN_EXPIRED");
  });

  it("solicitar de nuevo invalida el enlace anterior", async () => {
    await crearUsuarioConContrasena(pool, "rec_nuevo", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });

    await solicitar(app, CORREO);
    await esperarEnvio(correo, 1);
    await solicitar(app, CORREO);
    await esperarEnvio(correo, 2);
    const anterior = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");
    const nuevo = tokenDelEnlace(correo.enviados[1]?.enlace ?? "");

    expect((await restablecer(app, anterior, CONTRASENA_NUEVA)).body.error?.code).toBe(
      "RESET_TOKEN_INVALID",
    );
    expect((await restablecer(app, nuevo, CONTRASENA_NUEVA)).status).toBe(204);
  });

  it("un token inventado responde RESET_TOKEN_INVALID", async () => {
    await crearUsuarioConContrasena(pool, "rec_inventado", CORREO, CONTRASENA_VIEJA);
    const app = buildTestApp(pool);

    const res = await restablecer(app, "token-que-nadie-tiene", CONTRASENA_NUEVA);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_TOKEN_INVALID");
  });

  it("restablecer cierra todas las sesiones abiertas", async () => {
    await crearUsuarioConContrasena(pool, "rec_sesiones", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });
    const cookie =
      (await login(app, CORREO, CONTRASENA_VIEJA)).headers["set-cookie"]?.[0]?.split(";")[0] ?? "";
    await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");

    await restablecer(app, token, CONTRASENA_NUEVA);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(me.status).toBe(401);
  });

  it("restablecer desbloquea la cuenta y reinicia los intentos", async () => {
    await crearUsuarioConContrasena(pool, "rec_bloqueo", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });
    for (let intento = 0; intento < 5; intento++) {
      await login(app, CORREO, "clave-mala-123");
    }
    expect((await login(app, CORREO, CONTRASENA_VIEJA)).status).toBe(423);
    await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");

    await restablecer(app, token, CONTRASENA_NUEVA);

    expect((await login(app, CORREO, CONTRASENA_NUEVA)).status).toBe(200);
  });

  it("la nueva contraseña cumple la política de contraseñas", async () => {
    await crearUsuarioConContrasena(pool, "rec_politica", CORREO, CONTRASENA_VIEJA);
    const correo = correoDePrueba();
    const app = buildTestApp(pool, undefined, false, { correo });
    await solicitar(app, CORREO);
    await esperarEnvio(correo);
    const token = tokenDelEnlace(correo.enviados[0]?.enlace ?? "");

    const res = await restablecer(app, token, "corta");

    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty("contrasena");
  });
});
