"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { esNoAutenticado, useSesion } from "@/features/auth/sesion";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast";

type Rol = "usuario" | "administrador";

// Guard de ruta del cliente. No muestra contenido protegido hasta validar la sesión y el rol.
export function GuardSesion({ requiereRol, children }: { requiereRol?: Rol; children: ReactNode }) {
  const router = useRouter();
  const cliente = useQueryClient();
  const { mostrar } = useToast();
  const { data: sesion, error, isPending } = useSesion();

  const noAutenticado = error !== null && error !== undefined && esNoAutenticado(error);
  const sinRol = sesion !== undefined && requiereRol !== undefined && sesion.rol !== requiereRol;

  useEffect(() => {
    if (noAutenticado) {
      // Sesión caducada: se limpia la caché de consultas y se vuelve a login con un aviso.
      cliente.clear();
      router.replace("/login?aviso=sesion-expirada");
    } else if (sinRol) {
      mostrar("error", "No tienes permiso para ver esa página.");
      router.replace("/");
    }
  }, [noAutenticado, sinRol, cliente, router, mostrar]);

  if (isPending || noAutenticado || sinRol) {
    return (
      <div role="status" aria-label="Comprobando tu sesión" className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
