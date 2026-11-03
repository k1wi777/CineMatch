"use client";

import {
  CatalogoPaginaSchema,
  DestacadosSchema,
  type CatalogoItem,
  type Destacado,
  type Region,
} from "@cinematch/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crearClaves, peticion } from "@/shared/api";
import type { FiltrosCatalogo } from "./filtros";

export const claves = crearClaves("catalogo");

export const TAMANO_PAGINA_CATALOGO = 20;

export type PaginaCatalogo = {
  items: CatalogoItem[];
  page: number;
  pageSize: number;
  total: number;
};

// Títulos del carrusel del inicio, del país elegido. Cambian poco: se reutilizan 5 minutos por país.
export function useDestacados(region: Region) {
  return useQuery<Destacado[]>({
    queryKey: ["catalogo", "destacados", region],
    queryFn: () =>
      peticion<Destacado[]>(`/api/catalog/destacados?region=${region}`, {
        esquema: DestacadosSchema,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCatalogo(filtros: FiltrosCatalogo) {
  const params = new URLSearchParams({
    page: String(filtros.page),
    pageSize: String(TAMANO_PAGINA_CATALOGO),
  });
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.generoIds.length > 0) params.set("generoIds", filtros.generoIds.join(","));

  return useQuery<PaginaCatalogo>({
    queryKey: claves.lista(filtros),
    queryFn: () =>
      peticion<PaginaCatalogo>(`/api/catalog?${params}`, { esquema: CatalogoPaginaSchema }),
    placeholderData: keepPreviousData,
  });
}
