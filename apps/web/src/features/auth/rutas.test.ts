import { describe, expect, it } from "vitest";
import { decidirAcceso, esRutaPublica } from "./rutas";

describe("guards de ruta de la web (FE-0.4)", () => {
  it("sin cookie, una ruta protegida va a login recordando a dónde quería ir", () => {
    expect(decidirAcceso("/biblioteca", false)).toEqual({
      accion: "login",
      siguiente: "/biblioteca",
    });
  });

  it("con cookie, la ruta protegida se deja pasar: la validación la hace el cliente", () => {
    expect(decidirAcceso("/biblioteca", true)).toEqual({ accion: "continuar" });
  });

  it("las rutas públicas nunca redirigen", () => {
    expect(decidirAcceso("/login", false)).toEqual({ accion: "continuar" });
    expect(decidirAcceso("/recuperar", false)).toEqual({ accion: "continuar" });
    expect(esRutaPublica("/login/algo")).toBe(true);
  });

  it("una ruta que solo empieza igual no es pública", () => {
    expect(esRutaPublica("/loginx")).toBe(false);
    expect(decidirAcceso("/loginx", false)).toEqual({ accion: "login", siguiente: "/loginx" });
  });
});
