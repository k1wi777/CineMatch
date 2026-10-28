"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { crearQueryClient } from "./query-client";
import { registrarManejadorSesion } from "./sesion";

// Provider de consultas. Al perder la sesión limpia toda la caché y lleva al login.
export function ProveedorApi({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [cliente] = useState<QueryClient>(() => crearQueryClient());

  useEffect(() => {
    registrarManejadorSesion(() => {
      cliente.clear();
      router.replace("/login");
    });
  }, [cliente, router]);

  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
