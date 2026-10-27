import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { afterCommit, type Executor, withTransaction } from "../../src/lib/db.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";

// Repositorio de ejemplo: acepta el pool o una transacción sin cambiar su firma.
async function contarRoles(executor: Executor): Promise<number> {
  const { rows } = await executor.query<{ total: string }>("SELECT count(*) AS total FROM rol");
  return Number(rows[0]?.total);
}

async function insertarRol(executor: Executor, nombre: string): Promise<void> {
  await executor.query("INSERT INTO rol (nombre) VALUES ($1)", [nombre]);
}

describe("withTransaction y afterCommit (BE-2.1)", () => {
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

  it("confirma los cambios cuando la función termina bien", async () => {
    await withTransaction(pool, async (tx) => {
      await insertarRol(tx, "usuario");
      await insertarRol(tx, "administrador");
    });

    expect(await contarRoles(pool)).toBe(2);
  });

  it("revierte todos los cambios y propaga el error si la función falla", async () => {
    await expect(
      withTransaction(pool, async (tx) => {
        await insertarRol(tx, "usuario");
        throw new Error("fallo a mitad de la operación");
      }),
    ).rejects.toThrow("fallo a mitad de la operación");

    expect(await contarRoles(pool)).toBe(0);
  });

  it("ejecuta afterCommit después del COMMIT, cuando los datos ya son visibles desde el pool", async () => {
    let filasVisiblesEnElHook = -1;

    await withTransaction(pool, async (tx) => {
      await insertarRol(tx, "usuario");
      afterCommit(tx, async () => {
        filasVisiblesEnElHook = await contarRoles(pool);
      });
    });

    expect(filasVisiblesEnElHook).toBe(1);
  });

  it("no ejecuta afterCommit si la transacción revierte", async () => {
    const llamadas: string[] = [];

    await expect(
      withTransaction(pool, async (tx) => {
        afterCommit(tx, () => {
          llamadas.push("emitido");
        });
        throw new Error("revertir");
      }),
    ).rejects.toThrow("revertir");

    expect(llamadas).toEqual([]);
  });

  it("ejecuta los hooks en el orden en que se registraron", async () => {
    const orden: number[] = [];

    await withTransaction(pool, async (tx) => {
      afterCommit(tx, () => {
        orden.push(1);
      });
      afterCommit(tx, () => {
        orden.push(2);
      });
    });

    expect(orden).toEqual([1, 2]);
  });

  it("rechaza registrar afterCommit fuera de una transacción", async () => {
    const cliente = await pool.connect();
    try {
      expect(() => afterCommit(cliente, () => undefined)).toThrow(
        "solo puede registrarse dentro de withTransaction",
      );
    } finally {
      cliente.release();
    }
  });

  it("un repositorio funciona igual con el pool y con una transacción", async () => {
    await insertarRol(pool, "usuario");

    await withTransaction(pool, async (tx) => {
      expect(await contarRoles(tx)).toBe(1);
      await insertarRol(tx, "administrador");
    });

    expect(await contarRoles(pool)).toBe(2);
  });
});
