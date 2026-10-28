import { describe, expect, it } from "vitest";
import { formatoCalificacion, formatoFecha, formatoNumero } from "./formato";

describe("formatos centralizados (FE-0.5)", () => {
  it("las fechas se formatean en español y en UTC", () => {
    expect(formatoFecha("2024-03-05T00:00:00Z")).toBe("5 mar 2024");
  });

  it("los números usan separador decimal en español", () => {
    expect(formatoNumero(1234.5, 1)).toBe("1234,5");
  });

  it("la calificación muestra medio punto solo cuando hace falta", () => {
    expect(formatoCalificacion(4)).toBe("4");
    expect(formatoCalificacion(4.5)).toBe("4,5");
  });
});
