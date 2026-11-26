import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import { loadEnv } from "../../src/config/env.js";
import { CRON_COPIA_DIARIA_POR_DEFECTO, iniciarCopiaDiaria } from "../../src/jobs/copia-diaria.js";
import {
  CRON_RECALCULO_COMUNIDAD_POR_DEFECTO,
  iniciarRecalculoComunidad,
} from "../../src/jobs/recalculo-comunidad.js";

const LOGGER = { info: () => undefined, error: () => undefined } as unknown as Logger;
const BASE = { DATABASE_URL: "postgres://usuario:clave@localhost:5432/cinematch" };

describe("recalculo horario del pool de recomendaciones generales (RN15)", () => {
  it("por defecto corre al inicio de cada hora", () => {
    const env = loadEnv(BASE);
    expect(env.COMUNIDAD_RECALCULO_CRON).toBe(CRON_RECALCULO_COMUNIDAD_POR_DEFECTO);
    expect(CRON_RECALCULO_COMUNIDAD_POR_DEFECTO).toBe("0 * * * *");
  });

  it("rechaza una expresión cron inválida", () => {
    expect(() =>
      iniciarRecalculoComunidad({
        expresion: "no es cron",
        recalcular: async () => {},
        logger: LOGGER,
      }),
    ).toThrow("COMUNIDAD_RECALCULO_CRON");
  });

  it("ejecuta el recálculo según la expresión y se detiene al pedirlo", async () => {
    const recalcular = vi.fn(async () => {});
    const detener = iniciarRecalculoComunidad({
      expresion: "* * * * * *",
      recalcular,
      logger: LOGGER,
    });

    await new Promise((resolver) => setTimeout(resolver, 1500));
    detener();
    const llamadas = recalcular.mock.calls.length;
    expect(llamadas).toBeGreaterThanOrEqual(1);

    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(recalcular.mock.calls.length).toBe(llamadas);
  });

  it("un fallo del recálculo se registra y no detiene el job", async () => {
    const errores: unknown[] = [];
    const logger = {
      info: () => undefined,
      error: (...args: unknown[]) => errores.push(args),
    } as unknown as Logger;
    let intentos = 0;
    const detener = iniciarRecalculoComunidad({
      expresion: "* * * * * *",
      recalcular: async () => {
        intentos += 1;
        throw new Error("fallo simulado");
      },
      logger,
    });

    await new Promise((resolver) => setTimeout(resolver, 2200));
    detener();
    expect(intentos).toBeGreaterThanOrEqual(2);
    expect(errores.length).toBeGreaterThanOrEqual(2);
  });
});

describe("copia de seguridad diaria (NF de disponibilidad)", () => {
  it("viene desactivada por defecto y no programa nada", () => {
    const env = loadEnv(BASE);
    expect(env.COPIA_DIARIA_HABILITADA).toBe(false);
    expect(env.COPIA_DIARIA_CRON).toBe(CRON_COPIA_DIARIA_POR_DEFECTO);
    expect(CRON_COPIA_DIARIA_POR_DEFECTO).toBe("0 2 * * *");

    const detener = iniciarCopiaDiaria({
      habilitada: false,
      expresion: "no es cron",
      ejecutar: async () => {},
      logger: LOGGER,
    });
    expect(() => detener()).not.toThrow();
  });

  it("si está activada, rechaza una expresión cron inválida", () => {
    expect(() =>
      iniciarCopiaDiaria({ habilitada: true, expresion: "no es cron", logger: LOGGER }),
    ).toThrow("COPIA_DIARIA_CRON");
  });
});
