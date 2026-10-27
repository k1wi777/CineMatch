import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuario } from "../helpers/fixtures.js";

// Cada test inserta un dato inválido y comprueba el código de error de PostgreSQL.
// Si se elimina la restricción de la migración, el insert pasa y el test falla.
async function expectError(promesa: Promise<unknown>, codigo: string): Promise<void> {
  await expect(promesa).rejects.toMatchObject({ code: codigo });
}

describe("integridad de usuarios, roles y sesiones (BE-1.2)", () => {
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

  it("rechaza un username duplicado con distinta capitalización (23505)", async () => {
    await crearUsuario(pool, "pepe_1");
    await expectError(crearUsuario(pool, "PEPE_1"), "23505");
  });

  it("rechaza un username de menos de 3 caracteres (23514)", async () => {
    await expectError(crearUsuario(pool, "ab"), "23514");
  });

  it("rechaza un username con caracteres no permitidos (23514)", async () => {
    await expectError(crearUsuario(pool, "a-b"), "23514");
  });

  it("rechaza un username de más de 20 caracteres (22001)", async () => {
    await expectError(crearUsuario(pool, "usuario_muy_largo_123"), "22001");
  });

  it("rechaza un correo duplicado sin distinguir mayúsculas (23505)", async () => {
    await crearUsuario(pool, "ana", "ana@test.com");
    await expectError(crearUsuario(pool, "dup", "ANA@test.com"), "23505");
  });

  it("permite varios usuarios sin correo (NULL)", async () => {
    await crearUsuario(pool, "nulo1");
    await crearUsuario(pool, "nulo2");

    const { rows } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM usuario WHERE correo IS NULL",
    );
    expect(rows[0]?.total).toBe("2");
  });

  it("rechaza un nombre de rol duplicado (23505)", async () => {
    await pool.query("INSERT INTO rol (nombre) VALUES ('usuario')");
    await expectError(pool.query("INSERT INTO rol (nombre) VALUES ('usuario')"), "23505");
  });

  it("rechaza una sesión de un usuario que no existe (23503)", async () => {
    await expectError(
      pool.query("INSERT INTO sesion (id, usuario_id) VALUES ($1, 999999)", ["a".repeat(64)]),
      "23503",
    );
  });

  it("rechaza dos sesiones con el mismo id (23505)", async () => {
    const usuario = await crearUsuario(pool, "sesion_user");
    await pool.query("INSERT INTO sesion (id, usuario_id) VALUES ($1, $2)", [
      "b".repeat(64),
      usuario,
    ]);
    await expectError(
      pool.query("INSERT INTO sesion (id, usuario_id) VALUES ($1, $2)", ["b".repeat(64), usuario]),
      "23505",
    );
  });

  it("rechaza un token de recuperación de un usuario que no existe (23503)", async () => {
    await expectError(
      pool.query(
        "INSERT INTO token_recuperacion (id, usuario_id, fecha_expiracion) VALUES ($1, 999999, now())",
        ["c".repeat(64)],
      ),
      "23503",
    );
  });
});
