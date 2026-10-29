"use client";

import {
  EstadoActualBibliotecaSchema,
  PaginaBibliotecaSchema,
  type EstadoBiblioteca,
  type PaginaBiblioteca,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crearClaves, peticion } from "@/shared/api";
import type { FiltrosBiblioteca } from "./filtros";
import { queryDeFiltrosBiblioteca } from "./filtros";

export const claves = crearClaves("biblioteca");

// Estado de un título para el usuario de la sesión. null si no está en su biblioteca.
export function useEstadoBiblioteca(contenidoId: number) {
  return useQuery<EstadoBiblioteca | null>({
    queryKey: claves.detalle(contenidoId),
    queryFn: async () =>
      (
        await peticion<{ estado: EstadoBiblioteca | null }>(`/api/library/${contenidoId}`, {
          esquema: EstadoActualBibliotecaSchema,
        })
      ).estado,
  });
}

// Cambia el estado del título (PUT) o lo quita de la biblioteca (DELETE, con null).
export function useCambiarEstadoBiblioteca(contenidoId: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (estado: EstadoBiblioteca | null) =>
      estado === null
        ? peticion<void>(`/api/library/${contenidoId}`, { metodo: "DELETE" })
        : peticion<unknown>(`/api/library/${contenidoId}`, { metodo: "PUT", cuerpo: { estado } }),
    onSuccess: (_datos, estado) => {
      cliente.setQueryData(claves.detalle(contenidoId), estado);
      // Las listas y sus conteos por pestaña cambian con cada estado.
      void cliente.invalidateQueries({ queryKey: claves.lista() });
    },
  });
}

export function useBiblioteca(filtros: FiltrosBiblioteca) {
  return useQuery<PaginaBiblioteca>({
    queryKey: claves.lista(filtros),
    queryFn: () =>
      peticion<PaginaBiblioteca>(`/api/library${queryDeFiltrosBiblioteca(filtros)}`, {
        esquema: PaginaBibliotecaSchema,
      }),
    placeholderData: keepPreviousData,
  });
}
