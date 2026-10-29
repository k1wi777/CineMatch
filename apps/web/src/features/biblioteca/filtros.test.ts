import { describe, expect, it } from "vitest";
import { FILTROS_BIBLIOTECA_POR_DEFECTO, queryDeFiltrosBiblioteca } from "./filtros";

describe("queryDeFiltrosBiblioteca", () => {
  it("incluye estado, orden, dirección y página por defecto", () => {
    const query = queryDeFiltrosBiblioteca(FILTROS_BIBLIOTECA_POR_DEFECTO);
    const params = new URLSearchParams(query);
    expect(params.get("estado")).toBe("pendiente");
    expect(params.get("orden")).toBe("fecha");
    expect(params.get("dir")).toBe("desc");
    expect(params.get("page")).toBe("1");
    expect(params.has("tipo")).toBe(false);
    expect(params.has("generoIds")).toBe(false);
  });

  it("añade tipo y géneros cuando hay filtro", () => {
    const params = new URLSearchParams(
      queryDeFiltrosBiblioteca({
        ...FILTROS_BIBLIOTECA_POR_DEFECTO,
        estado: "vista",
        tipo: "serie",
        generoIds: [2, 5],
        orden: "titulo",
        dir: "asc",
        page: 3,
      }),
    );
    expect(params.get("tipo")).toBe("serie");
    expect(params.get("generoIds")).toBe("2,5");
    expect(params.get("orden")).toBe("titulo");
    expect(params.get("page")).toBe("3");
  });
});
