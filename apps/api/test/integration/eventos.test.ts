import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/lib/events.js";
import { withTransaction } from "../../src/lib/db.js";
import { registrarListenersDeModulos } from "../../src/modules/registro-eventos.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";

const PAYLOAD = { reviewId: 1, userId: 2, contentId: 3 };

async function contarRoles(db: pg.Pool | pg.PoolClient): Promise<number> {
  const { rows } = await db.query<{ total: string }>("SELECT count(*) AS total FROM rol");
  return Number(rows[0]?.total);
}

describe("bus de eventos de dominio (BE-2.5)", () => {
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

  describe("emit: listeners tras el COMMIT", () => {
    it("ejecuta el listener después del COMMIT, cuando el dato ya es visible", async () => {
      const bus = new EventBus({ error: vi.fn() });
      let filasVisibles = -1;
      bus.on("review.created", async () => {
        filasVisibles = await contarRoles(pool);
      });

      await withTransaction(pool, async (tx) => {
        await tx.query("INSERT INTO rol (nombre) VALUES ('usuario')");
        bus.emit(tx, "review.created", PAYLOAD);
      });

      expect(filasVisibles).toBe(1);
    });

    it("no ejecuta el listener si la transacción revierte", async () => {
      const bus = new EventBus({ error: vi.fn() });
      const listener = vi.fn();
      bus.on("review.created", listener);

      await expect(
        withTransaction(pool, async (tx) => {
          bus.emit(tx, "review.created", PAYLOAD);
          throw new Error("revertir");
        }),
      ).rejects.toThrow("revertir");

      expect(listener).not.toHaveBeenCalled();
    });

    it("un error en el listener se registra y no revierte la operación", async () => {
      const logger = { error: vi.fn() };
      const bus = new EventBus(logger);
      bus.on("review.created", () => {
        throw new Error("fallo del listener");
      });

      await withTransaction(pool, async (tx) => {
        await tx.query("INSERT INTO rol (nombre) VALUES ('usuario')");
        bus.emit(tx, "review.created", PAYLOAD);
      });

      expect(await contarRoles(pool)).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ evento: "review.created" }),
        "Listener fallido tras el COMMIT",
      );
    });
  });

  describe("emitInTransaction: listeners dentro de la transacción", () => {
    it("comparte la transacción: sus cambios se confirman junto con los de la operación", async () => {
      const bus = new EventBus({ error: vi.fn() });
      bus.onInTransaction("review.created", async (_payload, tx) => {
        await tx.query("INSERT INTO rol (nombre) VALUES ('administrador')");
      });

      await withTransaction(pool, async (tx) => {
        await tx.query("INSERT INTO rol (nombre) VALUES ('usuario')");
        await bus.emitInTransaction(tx, "review.created", PAYLOAD);
      });

      expect(await contarRoles(pool)).toBe(2);
    });

    it("si un listener falla, se revierte la transacción entera", async () => {
      const bus = new EventBus({ error: vi.fn() });
      bus.onInTransaction("review.created", () => {
        throw new Error("fallo dentro de la transacción");
      });

      await expect(
        withTransaction(pool, async (tx) => {
          await tx.query("INSERT INTO rol (nombre) VALUES ('usuario')");
          await bus.emitInTransaction(tx, "review.created", PAYLOAD);
        }),
      ).rejects.toThrow("fallo dentro de la transacción");

      expect(await contarRoles(pool)).toBe(0);
    });
  });

  describe("separación de modos y orden", () => {
    it("emitInTransaction no ejecuta los listeners de emit, y emit no ejecuta los de transacción", async () => {
      const bus = new EventBus({ error: vi.fn() });
      const tras = vi.fn();
      const enTransaccion = vi.fn();
      bus.on("review.created", tras);
      bus.onInTransaction("review.created", enTransaccion);

      await withTransaction(pool, async (tx) => {
        await bus.emitInTransaction(tx, "review.created", PAYLOAD);
        expect(tras).not.toHaveBeenCalled();
        expect(enTransaccion).toHaveBeenCalledTimes(1);
        bus.emit(tx, "review.created", PAYLOAD);
      });

      expect(tras).toHaveBeenCalledTimes(1);
      expect(enTransaccion).toHaveBeenCalledTimes(1);
    });

    it("ejecuta los listeners en el orden en que se registraron", async () => {
      const bus = new EventBus({ error: vi.fn() });
      const orden: number[] = [];
      bus.on("review.created", () => {
        orden.push(1);
      });
      bus.on("review.created", () => {
        orden.push(2);
      });

      await withTransaction(pool, async (tx) => {
        bus.emit(tx, "review.created", PAYLOAD);
      });

      expect(orden).toEqual([1, 2]);
    });

    it("cada evento recibe solo sus propios listeners", async () => {
      const bus = new EventBus({ error: vi.fn() });
      const listener = vi.fn();
      bus.on("review.hidden", listener);

      await withTransaction(pool, async (tx) => {
        bus.emit(tx, "review.created", PAYLOAD);
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("tipos y arranque", () => {
    it("rechaza en compilación un payload que no corresponde al evento", () => {
      const bus = new EventBus({ error: vi.fn() });
      bus.on("friendship.requested", (payload) => {
        // @ts-expect-error: un evento de amistad no tiene reviewId
        void payload.reviewId;
        void payload.requesterId;
      });
      expect(true).toBe(true);
    });

    it("los listeners de cada módulo se registran al arrancar sin errores", () => {
      const bus = new EventBus({ error: vi.fn() });
      expect(() => registrarListenersDeModulos(bus)).not.toThrow();
    });
  });
});
