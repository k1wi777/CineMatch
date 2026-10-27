import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import { opcionesDeSeguridad } from "../../src/config/security.js";

const BASE = { DATABASE_URL: "postgres://usuario:clave@localhost:5432/cinematch" };

describe("configuración de seguridad (BE-2.4)", () => {
  it("producción aplica límites más estrictos que desarrollo", () => {
    const desarrollo = opcionesDeSeguridad(loadEnv({ ...BASE, NODE_ENV: "development" }));
    const produccion = opcionesDeSeguridad(
      loadEnv({ ...BASE, NODE_ENV: "production", WEB_URL: "https://cinematch.example" }),
    );

    expect(produccion.limites.general.max).toBeLessThan(desarrollo.limites.general.max);
    expect(produccion.limites.auth.max).toBeLessThan(desarrollo.limites.auth.max);
  });

  it("toma el origen de la web de WEB_URL", () => {
    const opciones = opcionesDeSeguridad(
      loadEnv({ ...BASE, WEB_URL: "https://cinematch.example" }),
    );

    expect(opciones.webUrl).toBe("https://cinematch.example");
  });

  it("en producción exige WEB_URL explícita", () => {
    expect(() => loadEnv({ ...BASE, NODE_ENV: "production" })).toThrow("WEB_URL");
  });

  it("TRUST_PROXY es false por defecto y se puede activar", () => {
    expect(opcionesDeSeguridad(loadEnv(BASE)).trustProxy).toBe(false);
    expect(opcionesDeSeguridad(loadEnv({ ...BASE, TRUST_PROXY: "true" })).trustProxy).toBe(true);
  });
});
