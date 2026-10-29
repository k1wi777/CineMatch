import { describe, expect, it } from "vitest";
import { accionesDelReceptor, puedeVerResenaReceptor } from "./estado";

describe("accionesDelReceptor", () => {
  it("aceptar y descartar solo mientras la recomendación está abierta o enviada", () => {
    expect(accionesDelReceptor("enviada")).toEqual(["aceptar", "descartar"]);
    expect(accionesDelReceptor("abierta")).toEqual(["aceptar", "descartar"]);
    expect(accionesDelReceptor("aceptada")).toEqual([]);
    expect(accionesDelReceptor("descartada")).toEqual([]);
    expect(accionesDelReceptor("completada")).toEqual([]);
  });
});

describe("puedeVerResenaReceptor", () => {
  it("solo cuando está completada", () => {
    expect(puedeVerResenaReceptor("completada")).toBe(true);
    expect(puedeVerResenaReceptor("aceptada")).toBe(false);
  });
});
