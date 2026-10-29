"use client";

import {
  EstadoSincronizacionSchema,
  ResenaModeracionSchema,
  type EstadoSincronizacion,
  type ModeracionQuery,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";
import { intervaloSondeoMs } from "./logica";

export const claves = crearClaves("admin");

const PaginaModeracionSchema = z.object({
  items: z.array(ResenaModeracionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginaModeracion = z.infer<typeof PaginaModeracionSchema>;

// Estado de la sincronización. Mientras corre se consulta cada dos segundos.
export function useEstadoSincronizacion() {
  return useQuery<EstadoSincronizacion>({
    queryKey: [...claves.todas, "sincronizacion"],
    queryFn: () =>
      peticion<EstadoSincronizacion>("/api/admin/catalog/sync/status", {
        esquema: EstadoSincronizacionSchema,
      }),
    refetchInterval: (consulta) => intervaloSondeoMs(consulta.state.data),
  });
}

// Lanza la sincronización en segundo plano (202). Al terminar se recarga el estado.
export function useIniciarSincronizacion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () =>
      peticion<EstadoSincronizacion>("/api/admin/catalog/sync", {
        metodo: "POST",
        esquema: EstadoSincronizacionSchema,
      }),
    onSuccess: (estado) => cliente.setQueryData([...claves.todas, "sincronizacion"], estado),
  });
}

export function useModeracion(filtros: ModeracionQuery) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "") params.set(clave, String(valor));
  }
  return useQuery<PaginaModeracion>({
    queryKey: claves.lista(filtros),
    queryFn: () =>
      peticion<PaginaModeracion>(`/api/admin/reviews?${params}`, {
        esquema: PaginaModeracionSchema,
      }),
    placeholderData: keepPreviousData,
  });
}

// Oculta (hide) o restablece (restore) una reseña. Recarga la lista y el detalle afectado.
export function useModerarResena() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: "ocultar" | "restablecer" }) =>
      peticion<{ id: number; visible: boolean }>(
        `/api/admin/reviews/${id}/${accion === "ocultar" ? "hide" : "restore"}`,
        { metodo: "POST" },
      ),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claves.lista() });
      // Ocultar o restablecer cambia promedios y ranking de los títulos.
      void cliente.invalidateQueries({ queryKey: ["titulo"] });
      void cliente.invalidateQueries({ queryKey: ["comunidad"] });
    },
  });
}
