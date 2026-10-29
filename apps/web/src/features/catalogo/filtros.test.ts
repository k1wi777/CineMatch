import { describe, expect, it } from "vitest";
import { alternarGenero, filtrosDesdeParams, queryDeFiltros } from "./filtros";

describe("filtrosDesdeParams", () => {
  it("usa valores por defecto sin parámetros", () => {
    expect(filtrosDesdeParams({})).toEqual({ q: "", tipo: undefined, generoIds: [], page: 1 });
  });

  it("lee los filtros de la URL y descarta valores no válidos", () => {
    const f = filtrosDesdeParams({
      q: "  dune ",
      tipo: "serie",
      generos: "3,abc,-1,3,1",
      page: "2",
    });
    expect(f).toEqual({ q: "dune", tipo: "serie", generoIds: [1, 3], page: 2 });
    expect(filtrosDesdeParams({ tipo: "otra", page: "0" }).tipo).toBeUndefined();
    expect(filtrosDesdeParams({ page: "0" }).page).toBe(1);
  });

  it("toma el primer valor si un parámetro llega repetido", () => {
    expect(filtrosDesdeParams({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("queryDeFiltros", () => {
  it("no escribe los valores por defecto", () => {
    expect(queryDeFiltros({ q: "", generoIds: [], page: 1 })).toBe("/catalogo");
  });

  it("serializa solo lo que está activo y vuelve a leerse igual", () => {
    const f = { q: "dune", tipo: "pelicula" as const, generoIds: [2, 5], page: 3 };
    const url = queryDeFiltros(f);
    expect(url).toBe("/catalogo?q=dune&tipo=pelicula&generos=2%2C5&page=3");
    const params = Object.fromEntries(new URL(url, "http://x").searchParams);
    expect(filtrosDesdeParams(params)).toEqual(f);
  });
});

describe("alternarGenero", () => {
  it("añade y quita géneros manteniendo el orden", () => {
    expect(alternarGenero([1, 5], 3)).toEqual([1, 3, 5]);
    expect(alternarGenero([1, 3, 5], 3)).toEqual([1, 5]);
  });
});
