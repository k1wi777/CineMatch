import { describe, expect, it } from "vitest";
import { FORMULARIO_ELIMINAR } from "./cuenta-campos";

describe("FORMULARIO_ELIMINAR", () => {
  it("acepta la contraseña con ELIMINAR escrito exacto", () => {
    expect(
      FORMULARIO_ELIMINAR.safeParse({ contrasena: "x", confirmacion: "ELIMINAR" }).success,
    ).toBe(true);
  });

  it("rechaza otra confirmación, aunque sea parecida", () => {
    expect(
      FORMULARIO_ELIMINAR.safeParse({ contrasena: "x", confirmacion: "eliminar" }).success,
    ).toBe(false);
    expect(
      FORMULARIO_ELIMINAR.safeParse({ contrasena: "x", confirmacion: "ELIMINAR " }).success,
    ).toBe(false);
  });

  it("exige la contraseña", () => {
    expect(
      FORMULARIO_ELIMINAR.safeParse({ contrasena: "", confirmacion: "ELIMINAR" }).success,
    ).toBe(false);
  });
});
