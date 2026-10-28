import { describe, expect, it } from "vitest";
import { siguienteFoco } from "./modal-logica";

describe("siguienteFoco", () => {
  it("avanza y vuelve al principio al llegar al final", () => {
    expect(siguienteFoco(2, 0, false)).toBe(1);
    expect(siguienteFoco(2, 1, false)).toBe(0);
  });

  it("retrocede y va al final desde el principio", () => {
    expect(siguienteFoco(2, 1, true)).toBe(0);
    expect(siguienteFoco(2, 0, true)).toBe(1);
  });

  it("si el foco está fuera del diálogo, Tab entra por el primero", () => {
    expect(siguienteFoco(2, -1, false)).toBe(0);
  });

  it("sin elementos no devuelve ninguno", () => {
    expect(siguienteFoco(0, -1, false)).toBe(-1);
  });
});
