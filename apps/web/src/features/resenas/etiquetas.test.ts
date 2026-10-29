import { describe, expect, it } from "vitest";
import { agregarEtiqueta, sugerirEtiquetas } from "./etiquetas";

describe("agregarEtiqueta", () => {
  it("normaliza: minúsculas, sin tildes y espacios simples", () => {
    expect(agregarEtiqueta([], "  Ciencia   FICCIÓN ").etiquetas).toEqual(["ciencia ficcion"]);
  });

  it("rechaza vacías, largas, repetidas y pasarse del máximo", () => {
    expect(agregarEtiqueta([], "   ").error).toBe("vacia");
    expect(agregarEtiqueta([], "a".repeat(31)).error).toBe("larga");
    expect(agregarEtiqueta(["drama"], "Drama").error).toBe("repetida");
    const cinco = ["a1", "a2", "a3", "a4", "a5"];
    expect(agregarEtiqueta(cinco, "seis").error).toBe("maximo");
  });
});

describe("sugerirEtiquetas", () => {
  it("toma palabras largas y no vacías, sin repetir las elegidas", () => {
    const sugeridas = sugerirEtiquetas("Una película con un final sorprendente y tensión", [
      "tension",
    ]);
    expect(sugeridas).toContain("sorprendente");
    expect(sugeridas).toContain("final");
    expect(sugeridas).not.toContain("tension");
    expect(sugeridas).not.toContain("pelicula");
  });

  it("respeta el límite", () => {
    expect(sugerirEtiquetas("alpha bravo charlie delta echo foxtrot golf", [], 3)).toHaveLength(3);
  });
});
