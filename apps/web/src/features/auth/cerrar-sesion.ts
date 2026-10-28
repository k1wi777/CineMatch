"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { peticion } from "@/shared/api";

// Cierra la sesión en el servidor, limpia la caché y vuelve al login.
// Se limpia aunque la petición falle: el usuario pidió salir, así que no se le deja dentro.
export function useCerrarSesion() {
  const cliente = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => peticion<void>("/api/auth/logout", { metodo: "POST" }),
    onSettled: () => {
      cliente.clear();
      router.replace("/login");
    },
  });
}
