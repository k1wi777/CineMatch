// Filtros del catálogo sin React. Viven en la URL: ?q=&tipo=&generos=1,2&page=2
export type TipoFiltro = "pelicula" | "serie";

export type FiltrosCatalogo = {
  q: string;
  tipo?: TipoFiltro;
  generoIds: number[];
  page: number;
};

type ParamsUrl = Record<string, string | string[] | undefined>;

function unico(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

// Valores que no son válidos se descartan; la página nunca baja de 1.
export function filtrosDesdeParams(params: ParamsUrl): FiltrosCatalogo {
  const tipo = unico(params.tipo);
  const generos = (unico(params.generos) ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const page = Number(unico(params.page));
  return {
    q: (unico(params.q) ?? "").trim().slice(0, 100),
    tipo: tipo === "pelicula" || tipo === "serie" ? tipo : undefined,
    generoIds: [...new Set(generos)].sort((a, b) => a - b),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// Solo aparecen en la URL los filtros que no son los de por defecto.
export function queryDeFiltros(filtros: FiltrosCatalogo): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.generoIds.length > 0) params.set("generos", filtros.generoIds.join(","));
  if (filtros.page > 1) params.set("page", String(filtros.page));
  const texto = params.toString();
  return texto ? `/catalogo?${texto}` : "/catalogo";
}

export function alternarGenero(ids: number[], id: number): number[] {
  return ids.includes(id)
    ? ids.filter((valor) => valor !== id)
    : [...ids, id].sort((a, b) => a - b);
}
