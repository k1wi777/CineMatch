import type { EstadoSincronizacion } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import { accionModeracion, intervaloSondeoMs, puedeSincronizar } from "./logica";

const estado = (datos: Partial<EstadoSincronizacion>): EstadoSincronizacion => ({
  estado: "inactiva",
  iniciadaEn: null,
  terminadaEn: null,
  ultimoResumen: null,
  error: null,
  ...datos,
});

describe("puedeSincronizar", () => {
  it("no se lanza mientras hay una sincronización en curso ni mientras se envía", () => {
    expect(puedeSincronizar(estado({ estado: "en_curso" }), false)).toBe(false);
    expect(puedeSincronizar(estado({ estado: "ok" }), true)).toBe(false);
    expect(puedeSincronizar(estado({ estado: "ok" }), false)).toBe(true);
    expect(puedeSincronizar(undefined, false)).toBe(true);
  });
});

describe("intervaloSondeoMs", () => {
  it("consulta el estado solo mientras está en curso", () => {
    expect(intervaloSondeoMs(estado({ estado: "en_curso" }))).toBe(2000);
    expect(intervaloSondeoMs(estado({ estado: "ok" }))).toBe(false);
    expect(intervaloSondeoMs(undefined)).toBe(false);
  });
});

describe("accionModeracion", () => {
  it("una reseña visible se oculta y una oculta se restablece", () => {
    expect(accionModeracion(true)).toBe("ocultar");
    expect(accionModeracion(false)).toBe("restablecer");
  });
});
