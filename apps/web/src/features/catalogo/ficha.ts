"use client";

import {
  EstadisticasTituloSchema,
  ResenasTituloSchema,
  TituloFichaSchema,
  TrailerSchema,
  type EstadisticasTitulo,
  type ResenasTitulo,
  type TituloFicha,
  type Trailer,
} from "@cinematch/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("titulo");

export function useFicha(id: number) {
  return useQuery<TituloFicha>({
    queryKey: claves.detalle(id),
    queryFn: () => peticion<TituloFicha>(`/api/catalog/${id}`, { esquema: TituloFichaSchema }),
  });
}

// Tráiler: solo se pide cuando el usuario lo abre (activo). La API lo cachea, así que no hay peticiones repetidas.
export function useTrailer(id: number, activo: boolean) {
  return useQuery<Trailer>({
    queryKey: [...claves.detalle(id), "trailer"],
    queryFn: () => peticion<Trailer>(`/api/catalog/${id}/trailer`, { esquema: TrailerSchema }),
    enabled: activo,
    staleTime: 10 * 60 * 1000,
  });
}

export function useEstadisticas(id: number) {
  return useQuery<EstadisticasTitulo>({
    queryKey: [...claves.detalle(id), "estadisticas"],
    queryFn: () =>
      peticion<EstadisticasTitulo>(`/api/titles/${id}/stats`, {
        esquema: EstadisticasTituloSchema,
      }),
  });
}

export function useResenasTitulo(id: number, page: number) {
  return useQuery<ResenasTitulo>({
    queryKey: [...claves.detalle(id), "resenas", page],
    queryFn: () =>
      peticion<ResenasTitulo>(`/api/titles/${id}/reviews?page=${page}`, {
        esquema: ResenasTituloSchema,
      }),
    placeholderData: keepPreviousData,
  });
}
