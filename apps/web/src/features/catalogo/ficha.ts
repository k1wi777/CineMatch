"use client";

import {
  EstadisticasTituloSchema,
  EstadoActualBibliotecaSchema,
  ResenasTituloSchema,
  TituloFichaSchema,
  type EstadisticasTitulo,
  type EstadoBiblioteca,
  type ResenasTitulo,
  type TituloFicha,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// Estado del título en la biblioteca del usuario. null si no está.
export function useEstadoBiblioteca(id: number) {
  return useQuery<EstadoBiblioteca | null>({
    queryKey: [...claves.detalle(id), "biblioteca"],
    queryFn: async () =>
      (
        await peticion<{ estado: EstadoBiblioteca | null }>(`/api/library/${id}`, {
          esquema: EstadoActualBibliotecaSchema,
        })
      ).estado,
  });
}

// Cambia o quita el estado del título en la biblioteca (null quita el título).
export function useCambiarEstadoBiblioteca(id: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (estado: EstadoBiblioteca | null) =>
      estado === null
        ? peticion<void>(`/api/library/${id}`, { metodo: "DELETE" })
        : peticion<unknown>(`/api/library/${id}`, { metodo: "PUT", cuerpo: { estado } }),
    onSuccess: (_datos, estado) => {
      cliente.setQueryData([...claves.detalle(id), "biblioteca"], estado);
    },
  });
}
