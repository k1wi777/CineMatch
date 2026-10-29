"use client";

import {
  RecomendacionDetalleSchema,
  RecomendacionListaItemSchema,
  type RecomendacionDetalle,
  type RecommendationStatus,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("recomendaciones");

export const PaginaRecomendacionesSchema = z.object({
  items: z.array(RecomendacionListaItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginaRecomendaciones = z.infer<typeof PaginaRecomendacionesSchema>;

export function useRecibidas(estado: RecommendationStatus | undefined, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (estado) params.set("estado", estado);
  return useQuery<PaginaRecomendaciones>({
    queryKey: claves.lista({ tipo: "recibidas", estado, page }),
    queryFn: () =>
      peticion<PaginaRecomendaciones>(`/api/recommendations/received?${params}`, {
        esquema: PaginaRecomendacionesSchema,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useEnviadas(page: number) {
  return useQuery<PaginaRecomendaciones>({
    queryKey: claves.lista({ tipo: "enviadas", page }),
    queryFn: () =>
      peticion<PaginaRecomendaciones>(`/api/recommendations/sent?page=${page}`, {
        esquema: PaginaRecomendacionesSchema,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRecomendacion(id: number) {
  return useQuery<RecomendacionDetalle>({
    queryKey: ["recomendacion", "detalle", id],
    queryFn: () =>
      peticion<RecomendacionDetalle>(`/api/recommendations/${id}`, {
        esquema: RecomendacionDetalleSchema,
      }),
  });
}

// Aceptar (pasa a pendientes en la biblioteca) o descartar. Recarga la bandeja y el detalle.
export function useAccionRecomendacion(id: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (accion: "aceptar" | "descartar") =>
      peticion<unknown>(
        `/api/recommendations/${id}/${accion === "aceptar" ? "accept" : "discard"}`,
        {
          metodo: "POST",
        },
      ),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claves.todas });
      void cliente.invalidateQueries({ queryKey: ["recomendacion"] });
      void cliente.invalidateQueries({ queryKey: ["biblioteca"] });
    },
  });
}

// Las recibidas más recientes, para la página de inicio: las primeras seis.
export function useRecibidasRecientes(cantidad: number) {
  return useQuery<PaginaRecomendaciones>({
    queryKey: claves.lista({ tipo: "recientes", cantidad }),
    queryFn: () =>
      peticion<PaginaRecomendaciones>(`/api/recommendations/received?page=1&pageSize=${cantidad}`, {
        esquema: PaginaRecomendacionesSchema,
      }),
  });
}
