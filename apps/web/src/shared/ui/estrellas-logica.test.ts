import { describe, expect, it } from "vitest";
import { ajustarCalificacion, calificacionDesdeClic, rellenoEstrella } from "./estrellas-logica";

describe("ajustarCalificacion", () => {
  it("mueve medio punto con las flechas", () => {
    expect(ajustarCalificacion(3, "ArrowRight")).toBe(3.5);
    expect(ajustarCalificacion(3, "ArrowUp")).toBe(3.5);
    expect(ajustarCalificacion(3, "ArrowLeft")).toBe(2.5);
    expect(ajustarCalificacion(3, "ArrowDown")).toBe(2.5);
  });

  it("no sale del rango de 1 a 5", () => {
    expect(ajustarCalificacion(5, "ArrowRight")).toBe(5);
    expect(ajustarCalificacion(1, "ArrowLeft")).toBe(1);
  });

  it("Inicio y Fin van a los extremos", () => {
    expect(ajustarCalificacion(3.5, "Home")).toBe(1);
    expect(ajustarCalificacion(3.5, "End")).toBe(5);
  });

  it("ignora el resto de teclas", () => {
    expect(ajustarCalificacion(2, "a")).toBe(2);
  });
});

describe("calificacionDesdeClic", () => {
  it("la mitad izquierda da medio punto menos", () => {
    expect(calificacionDesdeClic(4, 5, 20)).toBe(3.5);
  });

  it("la mitad derecha da la estrella completa", () => {
    expect(calificacionDesdeClic(4, 15, 20)).toBe(4);
  });

  it("nunca baja de 1 aunque sea media estrella", () => {
    expect(calificacionDesdeClic(1, 1, 20)).toBe(1);
  });
});

describe("rellenoEstrella", () => {
  it("rellena completas, medias y vacías", () => {
    expect(rellenoEstrella(3.5, 0)).toBe(1);
    expect(rellenoEstrella(3.5, 3)).toBe(0.5);
    expect(rellenoEstrella(3.5, 4)).toBe(0);
  });
});
