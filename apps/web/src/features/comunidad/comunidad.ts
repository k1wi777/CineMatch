"use client";

import {
  PaginaRecomendacionesComunidadSchema,
  type RecomendacionComunidad,
  type TipoContenido,
} from "@cinematch/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("comunidad");

export type PaginaComunidad = z.infer<typeof PaginaRecomendacionesComunidadSchema>;

export type FiltrosComunidad = {
  generoId?: number;
  tipo?: TipoContenido;
  page: number;
  pageSize: number;
};

// Recomendaciones generales (GET /community/recommendations). Ya excluyen lo que la persona vio.
export function useRecomendacionesComunidad(filtros: FiltrosComunidad) {
  const params = new URLSearchParams({
    page: String(filtros.page),
    pageSize: String(filtros.pageSize),
  });
  if (filtros.generoId !== undefined) params.set("generoId", String(filtros.generoId));
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  return useQuery<PaginaComunidad>({
    queryKey: claves.lista(filtros),
    queryFn: () =>
      peticion<PaginaComunidad>(`/api/community/recommendations?${params}`, {
        esquema: PaginaRecomendacionesComunidadSchema,
      }),
    placeholderData: keepPreviousData,
  });
}

export type { RecomendacionComunidad };
