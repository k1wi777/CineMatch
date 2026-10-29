import type { EstadoBiblioteca, TipoContenido } from "@cinematch/shared";

// Filtros de la biblioteca sin React. El estado es la pestaña activa (todas las pestañas usan la misma consulta).
export type FiltrosBiblioteca = {
  estado: EstadoBiblioteca;
  tipo?: TipoContenido;
  generoIds: number[];
  orden: "fecha" | "titulo";
  dir: "asc" | "desc";
  page: number;
};

export const FILTROS_BIBLIOTECA_POR_DEFECTO: FiltrosBiblioteca = {
  estado: "pendiente",
  tipo: undefined,
  generoIds: [],
  orden: "fecha",
  dir: "desc",
  page: 1,
};

// Query de GET /library. El estado siempre va, el resto solo si cambia el valor por defecto.
export function queryDeFiltrosBiblioteca(filtros: FiltrosBiblioteca): string {
  const params = new URLSearchParams({
    estado: filtros.estado,
    orden: filtros.orden,
    dir: filtros.dir,
    page: String(filtros.page),
  });
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.generoIds.length > 0) params.set("generoIds", filtros.generoIds.join(","));
  return `?${params}`;
}
