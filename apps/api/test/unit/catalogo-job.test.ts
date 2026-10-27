import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import { iniciarSincronizacionCatalogo } from "../../src/modules/catalogo/sincronizacion.job.js";

const LOGGER = { info: () => undefined, error: () => undefined } as unknown as Parameters<
  typeof iniciarSincronizacionCatalogo
>[0]["logger"];

const RESULTADO = {
  agregados: 0,
  actualizados: 0,
  descartados: 0,
  generosAgregados: 0,
  estado: "ok" as const,
};

describe("job de sincronización del catálogo (BE-6.3)", () => {
  it("viene desactivado por defecto y no programa nada", () => {
    const env = loadEnv({ DATABASE_URL: "postgres://usuario:clave@localhost:5432/cinematch" });

    expect(env.CATALOGO_SYNC_HABILITADA).toBe(false);
    expect(env.CATALOGO_SYNC_CRON).toBe("0 3 * * 0");
    const detener = iniciarSincronizacionCatalogo({
      habilitada: env.CATALOGO_SYNC_HABILITADA,
      expresion: "no es cron",
      ejecutar: async () => RESULTADO,
      logger: LOGGER,
    });
    expect(() => detener()).not.toThrow();
  });

  it("activado con una expresión cron inválida falla al arrancar", () => {
    expect(() =>
      iniciarSincronizacionCatalogo({
        habilitada: true,
        expresion: "no es cron",
        ejecutar: async () => RESULTADO,
        logger: LOGGER,
      }),
    ).toThrow(/CATALOGO_SYNC_CRON/);
  });

  it("activado con una expresión válida se puede detener", () => {
    const detener = iniciarSincronizacionCatalogo({
      habilitada: true,
      expresion: "0 3 * * 0",
      ejecutar: async () => RESULTADO,
      logger: LOGGER,
    });

    expect(() => detener()).not.toThrow();
  });
});
