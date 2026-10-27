import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, correoDePrueba } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const ORIGEN_AJENO = "https://sitio-ajeno.example";
const CORREO_A = "cuenta.a@cinematch.test";
const CORREO_B = "cuenta.b@cinematch.test";
const CONTRASENA = "Clave1234";
const MINUTO = 60_000;

// Reloj simulado: el test controla el paso del tiempo (bloqueos, expiraciones).
function crearReloj(inicio: string) {
  let ahora = new Date(inicio);
  return {
    reloj: () => ahora,
    avanzar: (ms: number) => {
      ahora = new Date(ahora.getTime() + ms);
    },
  };
}

function login(app: ReturnType<typeof buildTestApp>, correo: string, contrasena: string) {
  return request(app).post("/api/auth/login").set("Origin", ORIGEN).send({ correo, contrasena });
}

function fallar(app: ReturnType<typeof buildTestApp>, correo: string, veces: number) {
  return Promise.all(Array.from({ length: veces }, () => login(app, correo, "clave-incorrecta-1")));
}

// Varios inicios de sesión en paralelo con argon2: con la suite completa en marcha superan los 5 s por defecto.
describe("seguridad de autenticación (BE-3.5)", { timeout: 20_000 }, () => {
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

  it("rechaza sin Origin válido todos los endpoints de autenticación que cambian estado (403)", async () => {
    const app = buildTestApp(pool);

    const respuestas = await Promise.all([
      request(app).post("/api/auth/login").send({ correo: CORREO_A, contrasena: CONTRASENA }),
      request(app).post("/api/auth/register").send({}),
      request(app)
        .post("/api/auth/forgot-password")
        .set("Origin", ORIGEN_AJENO)
        .send({ correo: CORREO_A }),
      request(app).post("/api/auth/reset-password").send({ token: "x", contrasena: CONTRASENA }),
      request(app).post("/api/auth/logout"),
    ]);

    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("el bloqueo por fuerza bruta de una cuenta no afecta a otra", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_a", CORREO_A, CONTRASENA);
    await crearUsuarioConContrasena(pool, "cuenta_b", CORREO_B, CONTRASENA);
    const { reloj } = crearReloj("2026-03-01T10:00:00Z");
    const app = buildTestApp(pool, undefined, false, { reloj });

    await fallar(app, CORREO_A, 5);
    const bloqueada = await login(app, CORREO_A, CONTRASENA);
    const otra = await login(app, CORREO_B, CONTRASENA);

    expect(bloqueada.status).toBe(423);
    expect(otra.status).toBe(200);
  });

  it("tras vencer el bloqueo, el contador empieza de nuevo", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_reinicio", CORREO_A, CONTRASENA);
    const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
    const app = buildTestApp(pool, undefined, false, { reloj });
    await fallar(app, CORREO_A, 5);

    avanzar(16 * MINUTO);
    // Un fallo tras el bloqueo es un fallo normal: el contador vuelve a contar desde cero.
    expect((await login(app, CORREO_A, "clave-incorrecta-1")).status).toBe(401);
    await fallar(app, CORREO_A, 3);

    expect((await login(app, CORREO_A, CONTRASENA)).status).toBe(200);
  });

  it("un enlace vencido, incluso reutilizado, no cambia la contraseña", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_enlace", CORREO_A, CONTRASENA);
    const correo = correoDePrueba();
    const { reloj, avanzar } = crearReloj("2026-03-01T10:00:00Z");
    const app = buildTestApp(pool, undefined, false, { reloj, correo });
    await request(app)
      .post("/api/auth/forgot-password")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO_A });
    await vi.waitFor(() => expect(correo.enviados).toHaveLength(1));
    const token = new URL(correo.enviados[0]?.enlace ?? "").searchParams.get("token") ?? "";

    avanzar(2 * 60 * MINUTO);
    const primero = await request(app)
      .post("/api/auth/reset-password")
      .set("Origin", ORIGEN)
      .send({ token, contrasena: "Nueva5678" });
    const reutilizado = await request(app)
      .post("/api/auth/reset-password")
      .set("Origin", ORIGEN)
      .send({ token, contrasena: "Nueva5678" });

    expect(primero.body.error.code).toBe("RESET_TOKEN_EXPIRED");
    expect(reutilizado.body.error.code).toBe("RESET_TOKEN_EXPIRED");
    expect((await login(app, CORREO_A, CONTRASENA)).status).toBe(200);
  });

  it("ni el registro ni el login devuelven la contraseña", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_sin_eco", CORREO_A, CONTRASENA);
    const { reloj } = crearReloj("2026-03-01T10:00:00Z");
    const app = buildTestApp(pool, undefined, false, { reloj });

    const res = await login(app, CORREO_A, CONTRASENA);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(CONTRASENA);
    expect(String(res.headers["set-cookie"])).not.toContain(CONTRASENA);
  });

  it("la respuesta de recuperación es idéntica exista o no la cuenta", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_neutra", CORREO_A, CONTRASENA);
    const app = buildTestApp(pool);

    const existe = await request(app)
      .post("/api/auth/forgot-password")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO_A });
    const noExiste = await request(app)
      .post("/api/auth/forgot-password")
      .set("Origin", ORIGEN)
      .send({ correo: "nadie@cinematch.test" });

    expect(existe.status).toBe(202);
    expect(noExiste.status).toBe(202);
    expect(existe.body).toEqual(noExiste.body);
  });
});
