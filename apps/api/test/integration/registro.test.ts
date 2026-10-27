import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "../../src/lib/password.js";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearGenero, crearUsuario } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";

async function generosDePrueba(pool: pg.Pool): Promise<number[]> {
  return [
    await crearGenero(pool, "Drama"),
    await crearGenero(pool, "Comedia"),
    await crearGenero(pool, "Acción"),
  ];
}

function datosValidos(generoIds: number[], sobrescribir: Record<string, unknown> = {}) {
  return {
    nombre: "Ana Pérez",
    username: "ana_perez",
    correo: "ana@cinematch.test",
    contrasena: "Clave1234",
    aceptaDatos: true,
    generoIds,
    ...sobrescribir,
  };
}

function registrar(pool: pg.Pool, cuerpo: Record<string, unknown>) {
  return request(buildTestApp(pool)).post("/api/auth/register").set("Origin", ORIGEN).send(cuerpo);
}

describe("registro de cuenta (BE-3.1)", () => {
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

  it("crea la cuenta con rol usuario, aceptación de datos e intereses, y responde 201", async () => {
    const generos = await generosDePrueba(pool);

    const res = await registrar(pool, datosValidos(generos));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      username: "ana_perez",
      nombre: "Ana Pérez",
    });

    const { rows } = await pool.query<{ rol: string; acepta: Date | null; intereses: string }>(
      `SELECT r.nombre AS rol, u.acepta_datos_en AS acepta,
              (SELECT count(*) FROM interes_usuario i WHERE i.usuario_id = u.id) AS intereses
         FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.username = 'ana_perez'`,
    );
    expect(rows[0]?.rol).toBe("usuario");
    expect(rows[0]?.acepta).toBeInstanceOf(Date);
    expect(rows[0]?.intereses).toBe("3");
  });

  it("guarda la contraseña con argon2id y no en claro", async () => {
    const generos = await generosDePrueba(pool);
    await registrar(pool, datosValidos(generos));

    const { rows } = await pool.query<{ contrasena: string }>(
      "SELECT contrasena FROM usuario WHERE username = 'ana_perez'",
    );

    expect(rows[0]?.contrasena).not.toBe("Clave1234");
    expect(rows[0]?.contrasena.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(rows[0]?.contrasena ?? "", "Clave1234")).toBe(true);
  });

  it("no inicia sesión: no devuelve cookie ni crea sesión", async () => {
    const generos = await generosDePrueba(pool);

    const res = await registrar(pool, datosValidos(generos));
    const { rows } = await pool.query<{ total: string }>("SELECT count(*) AS total FROM sesion");

    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(rows[0]?.total).toBe("0");
  });

  it("devuelve 422 con el campo afectado cuando faltan datos o no cumplen las reglas", async () => {
    const generos = await generosDePrueba(pool);

    const sinAceptar = await registrar(pool, datosValidos(generos, { aceptaDatos: false }));
    const pocosGeneros = await registrar(pool, datosValidos(generos.slice(0, 2)));
    const generoInexistente = await registrar(
      pool,
      datosValidos([...generos.slice(0, 2), 999_999]),
    );
    const usernameInvalido = await registrar(pool, datosValidos(generos, { username: "a-b" }));

    expect(sinAceptar.status).toBe(422);
    expect(sinAceptar.body.error.fields).toHaveProperty("aceptaDatos");
    expect(pocosGeneros.status).toBe(422);
    expect(pocosGeneros.body.error.fields).toHaveProperty("generoIds");
    expect(generoInexistente.status).toBe(422);
    expect(generoInexistente.body.error.fields).toHaveProperty("generoIds");
    expect(usernameInvalido.status).toBe(422);
    expect(usernameInvalido.body.error.fields).toHaveProperty("username");
  });

  it("aplica la política de contraseñas: 8 caracteres, una letra y un número", async () => {
    const generos = await generosDePrueba(pool);

    const corta = await registrar(pool, datosValidos(generos, { contrasena: "Ab1" }));
    const sinNumero = await registrar(pool, datosValidos(generos, { contrasena: "sololetras" }));
    const sinLetra = await registrar(pool, datosValidos(generos, { contrasena: "12345678" }));

    expect(corta.body.error.fields).toHaveProperty("contrasena");
    expect(sinNumero.body.error.fields).toHaveProperty("contrasena");
    expect(sinLetra.body.error.fields).toHaveProperty("contrasena");
  });

  it("el correo y el username no se duplican sin distinguir mayúsculas (409 con campo)", async () => {
    const generos = await generosDePrueba(pool);
    await crearUsuario(pool, "ana_perez", "ana@cinematch.test");

    const usernameRepetido = await registrar(
      pool,
      datosValidos(generos, { username: "ANA_PEREZ", correo: "otra@cinematch.test" }),
    );
    const correoRepetido = await registrar(
      pool,
      datosValidos(generos, { username: "otra_ana", correo: "ANA@cinematch.test" }),
    );

    expect(usernameRepetido.status).toBe(409);
    expect(usernameRepetido.body.error.fields).toHaveProperty("username");
    expect(correoRepetido.status).toBe(409);
    expect(correoRepetido.body.error.fields).toHaveProperty("correo");
  });

  it("si la operación falla, no queda ni el usuario ni los intereses (atomicidad)", async () => {
    const generos = await generosDePrueba(pool);
    await crearUsuario(pool, "ocupado", "ocupado@cinematch.test");

    await registrar(
      pool,
      datosValidos(generos, { username: "ocupado", correo: "nuevo@cinematch.test" }),
    );
    const { rows: usuarios } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM usuario WHERE correo = 'nuevo@cinematch.test'",
    );
    const { rows: intereses } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM interes_usuario",
    );

    expect(usuarios[0]?.total).toBe("0");
    expect(intereses[0]?.total).toBe("0");
  });

  it("normaliza el nombre a texto plano", async () => {
    const generos = await generosDePrueba(pool);

    const res = await registrar(pool, datosValidos(generos, { nombre: "<b>Ana</b>  Pérez" }));

    expect(res.body.nombre).toBe("Ana Pérez");
  });
});
