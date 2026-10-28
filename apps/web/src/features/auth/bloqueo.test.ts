import { describe, expect, it } from "vitest";
import { destinoTrasLogin, formatoCuentaAtras, segundosRestantes } from "./bloqueo";

describe("segundosRestantes", () => {
  it("cuenta los segundos que faltan, redondeando hacia arriba", () => {
    expect(segundosRestantes(10_000, 0)).toBe(10);
    expect(segundosRestantes(10_001, 0)).toBe(11);
  });

  it("llega a cero y no baja de cero", () => {
    expect(segundosRestantes(5_000, 5_000)).toBe(0);
    expect(segundosRestantes(5_000, 9_000)).toBe(0);
  });
});

describe("formatoCuentaAtras", () => {
  it("muestra minutos y segundos con dos cifras", () => {
    expect(formatoCuentaAtras(899)).toBe("14:59");
    expect(formatoCuentaAtras(5)).toBe("0:05");
    expect(formatoCuentaAtras(0)).toBe("0:00");
  });
});

describe("destinoTrasLogin", () => {
  it("el usuario va al inicio y el administrador al panel", () => {
    expect(destinoTrasLogin("usuario")).toBe("/");
    expect(destinoTrasLogin("administrador")).toBe("/admin");
  });

  it("vuelve a la ruta pedida si es interna", () => {
    expect(destinoTrasLogin("usuario", "/catalogo/12")).toBe("/catalogo/12");
  });

  it("ignora destinos externos o que no son rutas internas", () => {
    expect(destinoTrasLogin("usuario", "https://evil.example")).toBe("/");
    expect(destinoTrasLogin("usuario", "//evil.example")).toBe("/");
    expect(destinoTrasLogin("usuario", "/\\evil.example")).toBe("/");
    expect(destinoTrasLogin("administrador", "evil")).toBe("/admin");
  });

  it("no vuelve a login", () => {
    expect(destinoTrasLogin("usuario", "/login?aviso=x")).toBe("/");
  });
});
