"use client";

import { ContadorNoLeidasSchema, PaginaNotificacionesSchema } from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { useSesion } from "@/features/auth/sesion";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("notificaciones");

export type PaginaNotificaciones = z.infer<typeof PaginaNotificacionesSchema>;

// Número de avisos sin leer para la campana. Solo se pide con sesión válida.
export function useContadorNoLeidas() {
  const sesion = useSesion();
  return useQuery({
    queryKey: claves.detalle("contador"),
    queryFn: async () =>
      (
        await peticion<z.infer<typeof ContadorNoLeidasSchema>>("/api/notifications/unread-count", {
          esquema: ContadorNoLeidasSchema,
        })
      ).noLeidas,
    enabled: sesion.data !== undefined,
  });
}

export function useNotificaciones(soloNoLeidas: boolean, page: number) {
  return useQuery<PaginaNotificaciones>({
    queryKey: claves.lista({ soloNoLeidas, page }),
    queryFn: () =>
      peticion<PaginaNotificaciones>(
        `/api/notifications?soloNoLeidas=${soloNoLeidas}&page=${page}`,
        {
          esquema: PaginaNotificacionesSchema,
        },
      ),
    placeholderData: keepPreviousData,
  });
}

// Marca una como leída. Recarga el contador y las listas.
export function useMarcarLeida() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      peticion<void>(`/api/notifications/${id}/read`, { metodo: "PATCH" }),
    onSettled: () => void cliente.invalidateQueries({ queryKey: claves.todas }),
  });
}

export function useMarcarTodas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => peticion<void>("/api/notifications/read-all", { metodo: "POST" }),
    onSettled: () => void cliente.invalidateQueries({ queryKey: claves.todas }),
  });
}
