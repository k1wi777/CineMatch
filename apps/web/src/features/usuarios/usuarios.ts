"use client";

import {
  BusquedaUsuarioItemSchema,
  PerfilPublicoSchema,
  type PerfilPublico,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("usuarios");

const PaginaBusquedaSchema = z.object({
  items: z.array(BusquedaUsuarioItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginaBusqueda = z.infer<typeof PaginaBusquedaSchema>;

// Busca por nombre de usuario. Sin texto no hay consulta.
export function useBusquedaUsuarios(q: string, page: number) {
  return useQuery<PaginaBusqueda>({
    queryKey: claves.lista({ q, page }),
    queryFn: () =>
      peticion<PaginaBusqueda>(`/api/users?q=${encodeURIComponent(q)}&page=${page}`, {
        esquema: PaginaBusquedaSchema,
      }),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function usePerfilPublico(id: number) {
  return useQuery<PerfilPublico>({
    queryKey: claves.detalle(id),
    queryFn: () =>
      peticion<PerfilPublico>(`/api/users/${id}/profile`, { esquema: PerfilPublicoSchema }),
  });
}

export type EntradaAccion =
  { tipo: "agregar"; usuarioId: number } | { tipo: "aceptar" | "cancelar"; amistadId: number };

// Agregar, aceptar o cancelar. Al terminar se recargan las búsquedas y los perfiles para ver la relación nueva.
export function useAccionRelacion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: EntradaAccion) => {
      if (entrada.tipo === "agregar") {
        return peticion<unknown>("/api/friends/requests", {
          metodo: "POST",
          cuerpo: { usuarioId: entrada.usuarioId },
        });
      }
      if (entrada.tipo === "aceptar") {
        return peticion<unknown>(`/api/friends/requests/${entrada.amistadId}/accept`, {
          metodo: "POST",
        });
      }
      return peticion<void>(`/api/friends/requests/${entrada.amistadId}`, { metodo: "DELETE" });
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: claves.todas }),
  });
}

// Retrasa el valor hasta que deja de cambiar durante `ms`, para no pedir una búsqueda por cada tecla.
export function useValorDiferido<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return diferido;
}
