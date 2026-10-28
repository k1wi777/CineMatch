"use client";

import { UsuarioSesionSchema, type UsuarioSesion } from "@cinematch/shared";
import { useQuery } from "@tanstack/react-query";
import { ApiError, crearClaves, peticion } from "@/shared/api";

export const claves = crearClaves("auth");

// Sesión validada en el cliente con GET /api/auth/me. Mientras carga, nadie debe renderizar contenido protegido.
export function useSesion() {
  return useQuery<UsuarioSesion, ApiError>({
    queryKey: [...claves.todas, "sesion"],
    queryFn: () => peticion("/api/auth/me", { esquema: UsuarioSesionSchema }),
    retry: false,
    staleTime: 60_000,
  });
}

export function esNoAutenticado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
