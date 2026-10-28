"use client";

import { GeneroSchema, type Genero } from "@cinematch/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("generos");

// Catálogo de géneros para elegir intereses. Cambia poco, así que se cachea una hora.
export function useGeneros() {
  return useQuery<Genero[]>({
    queryKey: claves.lista(),
    queryFn: () => peticion<Genero[]>("/api/genres", { esquema: z.array(GeneroSchema) }),
    staleTime: 60 * 60_000,
  });
}
