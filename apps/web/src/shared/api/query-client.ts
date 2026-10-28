import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errores";

// Un QueryClient por sesión de navegador: no reintenta errores de cliente (4xx) ni los 401.
export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (fallos, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return fallos < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
