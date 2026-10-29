import { describe, expect, it } from "vitest";
import { textoOrigen, textoPromedio } from "./origen";

describe("textoOrigen", () => {
  it("distingue el ranking de la comunidad del respaldo por popularidad", () => {
    expect(textoOrigen("comunidad")).toBe("Lo más valorado por la comunidad");
    expect(textoOrigen("popularidad")).toBe("Popular ahora");
  });
});

describe("textoPromedio", () => {
  it("formatea con coma decimal y cuenta las calificaciones", () => {
    expect(textoPromedio(4.25, 3)).toBe("4,3 · 3 calificaciones");
  });

  it("sin calificaciones no muestra promedio", () => {
    expect(textoPromedio(null, 0)).toBeNull();
  });
});
