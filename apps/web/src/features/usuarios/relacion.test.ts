import { describe, expect, it } from "vitest";
import { accionesDeRelacion } from "./relacion";

describe("accionesDeRelacion", () => {
  it("sin relación se puede agregar", () => {
    expect(accionesDeRelacion("ninguna")).toEqual(["agregar"]);
  });

  it("una solicitud enviada se puede cancelar", () => {
    expect(accionesDeRelacion("pendienteEnviada")).toEqual(["cancelar"]);
  });

  it("una solicitud recibida se puede aceptar", () => {
    expect(accionesDeRelacion("pendienteRecibida")).toEqual(["aceptar"]);
  });

  it("los amigos no tienen acción de relación", () => {
    expect(accionesDeRelacion("amigos")).toEqual([]);
  });
});
