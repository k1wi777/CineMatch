"use client";

import { ResenaListaSchema, ResenaSchema, type EscribirResena } from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("resenas");

// Mis reseñas (GET /users/me/reviews): incluye las ocultas por moderación, marcadas.
const PaginaMisResenasSchema = z.object({
  items: z.array(ResenaListaSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export function useMisResenas(page: number) {
  return useQuery({
    queryKey: claves.lista({ mias: true, page }),
    queryFn: () =>
      peticion<z.infer<typeof PaginaMisResenasSchema>>(`/api/users/me/reviews?page=${page}`, {
        esquema: PaginaMisResenasSchema,
      }),
    placeholderData: keepPreviousData,
  });
}

// Crea o edita la reseña del usuario en un título (PUT: 201 si se crea, 200 si se actualiza).
export function useGuardarResena(contenidoId: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: EscribirResena) =>
      peticion<z.infer<typeof ResenaSchema>>(`/api/titles/${contenidoId}/review`, {
        metodo: "PUT",
        cuerpo: datos,
        esquema: ResenaSchema,
      }),
    onSettled: () => invalidarResenas(cliente, contenidoId),
  });
}

export function useEliminarResena() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (resenaId: number) =>
      peticion<void>(`/api/reviews/${resenaId}`, { metodo: "DELETE" }),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claves.todas });
      // Las fichas de título muestran promedios y reseñas: se recargan todas.
      void cliente.invalidateQueries({ queryKey: ["titulo"] });
      void cliente.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

function invalidarResenas(cliente: ReturnType<typeof useQueryClient>, contenidoId: number) {
  void cliente.invalidateQueries({ queryKey: claves.todas });
  void cliente.invalidateQueries({ queryKey: ["titulo", "detalle", contenidoId] });
  void cliente.invalidateQueries({ queryKey: ["usuarios"] });
}
