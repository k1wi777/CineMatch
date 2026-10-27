import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ejecutarLimpieza } from "../../src/jobs/limpieza-sesiones.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuario } from "../helpers/fixtures.js";

const AHORA = new Date("2026-03-10T12:00:00Z");
const HORA = 60 * 60 * 1_000;

async function insertarSesion(
  pool: pg.Pool,
  id: string,
  usuario: number,
  expiraEn: Date,
): Promise<void> {
  await pool.query("INSERT INTO sesion (id, usuario_id, expira_en) VALUES ($1, $2, $3)", [
    id,
    usuario,
    expiraEn,
  ]);
}

async function insertarToken(
  pool: pg.Pool,
  id: string,
  usuario: number,
  expiraEn: Date,
): Promise<void> {
  await pool.query(
    "INSERT INTO token_recuperacion (id, usuario_id, fecha_expiracion) VALUES ($1, $2, $3)",
    [id, usuario, expiraEn],
  );
}

describe("limpieza de sesiones y tokens vencidos (BE-3.6)", () => {
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

  it("elimina las sesiones vencidas y conserva las vigentes", async () => {
    const usuario = await crearUsuario(pool, "limpieza_sesion");
    await insertarSesion(pool, "a".repeat(64), usuario, new Date(AHORA.getTime() - HORA));
    await insertarSesion(pool, "b".repeat(64), usuario, new Date(AHORA.getTime() + HORA));

    const resultado = await ejecutarLimpieza(pool, AHORA);
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM sesion");

    expect(resultado.sesionesEliminadas).toBe(1);
    expect(rows.map((r) => r.id)).toEqual(["b".repeat(64)]);
  });

  it("elimina los tokens vencidos hace más de 24 horas y conserva los recientes", async () => {
    const usuario = await crearUsuario(pool, "limpieza_token");
    await insertarToken(pool, "c".repeat(64), usuario, new Date(AHORA.getTime() - 25 * HORA));
    await insertarToken(pool, "d".repeat(64), usuario, new Date(AHORA.getTime() - 2 * HORA));
    await insertarToken(pool, "e".repeat(64), usuario, new Date(AHORA.getTime() + HORA));

    const resultado = await ejecutarLimpieza(pool, AHORA);
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM token_recuperacion");

    expect(resultado.tokensEliminados).toBe(1);
    expect(rows.map((r) => r.id).sort()).toEqual(["d".repeat(64), "e".repeat(64)]);
  });

  it("no hace nada si no hay registros vencidos", async () => {
    const usuario = await crearUsuario(pool, "limpieza_vacia");
    await insertarSesion(pool, "f".repeat(64), usuario, new Date(AHORA.getTime() + HORA));

    const resultado = await ejecutarLimpieza(pool, AHORA);

    expect(resultado).toEqual({ sesionesEliminadas: 0, tokensEliminados: 0 });
  });

  it("registra inicio, fin y resultado en el log", async () => {
    const { iniciarLimpieza } = await import("../../src/jobs/limpieza-sesiones.js");
    const logger = { info: vi.fn(), error: vi.fn() };

    const detener = iniciarLimpieza(pool, logger as never, () => AHORA);
    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith(expect.anything(), "Limpieza terminada"),
    );
    detener();

    expect(logger.info).toHaveBeenCalledWith({ job: "limpieza-sesiones" }, "Limpieza iniciada");
    expect(logger.error).not.toHaveBeenCalled();
  });
});
