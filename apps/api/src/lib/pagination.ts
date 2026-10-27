import type { PaginationQuery } from "@cinematch/shared";

// Traduce la paginación de la petición a límite y desplazamiento para SQL.
export function paginar(query: PaginationQuery): { limit: number; offset: number } {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  };
}
