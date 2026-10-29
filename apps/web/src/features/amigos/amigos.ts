"use client";

import {
  AmistadListaItemSchema,
  ContadorSolicitudesSchema,
  SolicitudListaItemSchema,
} from "@cinematch/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("amigos");

// Forma de las listas paginadas de la API: { items, page, pageSize, total }.
function paginaDe<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

const PaginaAmigosSchema = paginaDe(AmistadListaItemSchema);
const PaginaSolicitudesSchema = paginaDe(SolicitudListaItemSchema);

export type PaginaAmigos = z.infer<typeof PaginaAmigosSchema>;
export type PaginaSolicitudes = z.infer<typeof PaginaSolicitudesSchema>;

export function useAmigos(page: number) {
  return useQuery<PaginaAmigos>({
    queryKey: claves.lista({ tipo: "amigos", page }),
    queryFn: () =>
      peticion<PaginaAmigos>(`/api/friends?page=${page}`, { esquema: PaginaAmigosSchema }),
    placeholderData: keepPreviousData,
  });
}

export function useSolicitudes(tipo: "recibidas" | "enviadas", page: number) {
  const ruta =
    tipo === "recibidas" ? "/api/friends/requests/received" : "/api/friends/requests/sent";
  return useQuery<PaginaSolicitudes>({
    queryKey: claves.lista({ tipo, page }),
    queryFn: () =>
      peticion<PaginaSolicitudes>(`${ruta}?page=${page}`, { esquema: PaginaSolicitudesSchema }),
    placeholderData: keepPreviousData,
  });
}

// Solicitudes recibidas pendientes, para el aviso de la navegación.
export function useContadorSolicitudes() {
  return useQuery({
    queryKey: claves.detalle("contador"),
    queryFn: () =>
      peticion<z.infer<typeof ContadorSolicitudesSchema>>("/api/friends/requests/received/count", {
        esquema: ContadorSolicitudesSchema,
      }),
    select: (datos) => datos.pendientes,
  });
}

export type EntradaAccionAmistad =
  | { tipo: "eliminar"; amistadId: number }
  | { tipo: "aceptar" | "rechazar" | "cancelar"; solicitudId: number };

// Eliminar amistad, aceptar, rechazar o cancelar. Recarga las listas, el contador y los perfiles.
export function useAccionAmistad() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: EntradaAccionAmistad) => {
      switch (entrada.tipo) {
        case "eliminar":
          return peticion<void>(`/api/friends/${entrada.amistadId}`, { metodo: "DELETE" });
        case "aceptar":
          return peticion<unknown>(`/api/friends/requests/${entrada.solicitudId}/accept`, {
            metodo: "POST",
          });
        case "rechazar":
          return peticion<unknown>(`/api/friends/requests/${entrada.solicitudId}/reject`, {
            metodo: "POST",
          });
        case "cancelar":
          return peticion<void>(`/api/friends/requests/${entrada.solicitudId}`, {
            metodo: "DELETE",
          });
      }
    },
    onSettled: () => {
      // Claves de usuarios: la relación cambia en búsquedas y perfiles (ver features/usuarios).
      void cliente.invalidateQueries({ queryKey: claves.todas });
      void cliente.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
