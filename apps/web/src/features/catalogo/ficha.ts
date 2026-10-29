"use client";

import {
  EstadisticasTituloSchema,
  ResenasTituloSchema,
  TituloFichaSchema,
  type EstadisticasTitulo,
  type ResenasTitulo,
  type TituloFicha,
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
