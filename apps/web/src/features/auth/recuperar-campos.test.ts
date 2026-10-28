import { describe, expect, it } from "vitest";
import { FORMULARIO_RESTABLECER } from "./recuperar-campos";

describe("FORMULARIO_RESTABLECER", () => {
  it("acepta una contraseña válida confirmada", () => {
    expect(
      FORMULARIO_RESTABLECER.safeParse({ contrasena: "Nueva1234", confirmacion: "Nueva1234" })
        .success,
    ).toBe(true);
  });

  it("rechaza confirmaciones distintas", () => {
    const resultado = FORMULARIO_RESTABLECER.safeParse({
      contrasena: "Nueva1234",
      confirmacion: "Otra12345",
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["confirmacion"]);
  });

  it("aplica la política de contraseña", () => {
    expect(
      FORMULARIO_RESTABLECER.safeParse({ contrasena: "solo-letras", confirmacion: "solo-letras" })
        .success,
    ).toBe(false);
  });
});
