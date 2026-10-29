import { describe, expect, it } from "vitest";
import { comentarioVisible, debeMostrarPromedioAmigos } from "./ficha-logica";

describe("debeMostrarPromedioAmigos", () => {
  it("solo con reseñas de amigos y promedio", () => {
    expect(debeMostrarPromedioAmigos({ promedioAmigos: 4, conteoAmigos: 2 })).toBe(true);
    expect(debeMostrarPromedioAmigos({ promedioAmigos: null, conteoAmigos: 0 })).toBe(false);
    expect(debeMostrarPromedioAmigos({ promedioAmigos: null, conteoAmigos: 1 })).toBe(false);
  });
});

describe("comentarioVisible", () => {
  it("un comentario normal siempre se ve", () => {
    expect(comentarioVisible(false, false)).toBe(true);
  });

  it("un spoiler se oculta hasta que se revela", () => {
    expect(comentarioVisible(true, false)).toBe(false);
    expect(comentarioVisible(true, true)).toBe(true);
  });
});
