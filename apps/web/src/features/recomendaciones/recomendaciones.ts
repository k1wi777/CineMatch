"use client";

import {
  AmigoRecomendableSchema,
  RecomendacionSchema,
  type AmigoRecomendable,
  type EnviarRecomendacion,
  type Recomendacion,
} from "@cinematch/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("recomendaciones");

// Amigos a los que se puede recomendar un título, con sus marcas (ya la vio, ya recomendada, fuera de intereses).
export function useAmigosRecomendables(contenidoId: number) {
  return useQuery<AmigoRecomendable[]>({
    queryKey: [...claves.detalle(contenidoId), "amigos"],
    queryFn: () =>
      peticion<AmigoRecomendable[]>(`/api/titles/${contenidoId}/recommend/friends`, {
        esquema: z.array(AmigoRecomendableSchema),
      }),
  });
}

export function useEnviarRecomendacion(contenidoId: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: EnviarRecomendacion) =>
      peticion<Recomendacion>("/api/recommendations", {
        metodo: "POST",
        cuerpo: datos,
        esquema: RecomendacionSchema,
      }),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: [...claves.detalle(contenidoId), "amigos"] });
      void cliente.invalidateQueries({ queryKey: claves.todas });
    },
  });
}
