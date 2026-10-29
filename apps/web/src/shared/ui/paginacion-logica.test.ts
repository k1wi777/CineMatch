import { describe, expect, it } from "vitest";
import { paginasTotales } from "./paginacion-logica";

describe("paginasTotales", () => {
  it("redondea hacia arriba", () => {
    expect(paginasTotales(41, 20)).toBe(3);
    expect(paginasTotales(40, 20)).toBe(2);
  });

  it("siempre hay al menos una página", () => {
    expect(paginasTotales(0, 20)).toBe(1);
  });
});
