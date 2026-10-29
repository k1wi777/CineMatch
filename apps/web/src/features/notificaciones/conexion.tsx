"use client";

import { NotificacionSchema, type Notificacion } from "@cinematch/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { useSesion } from "@/features/auth/sesion";
import { useToast } from "@/shared/ui/toast";
import { hrefNotificacion, textoNotificacion } from "./textos";

// Consultas que cambian cuando llega una notificación: avisos, recomendaciones, amistades y sus contadores.
const CLAVES_AFECTADAS = [
  ["notificaciones"],
  ["recomendaciones"],
  ["recomendacion"],
  ["amigos"],
  ["usuarios"],
];

const MAX_IDS_RECORDADOS = 200;
const DURACION_AVISO_MS = 6000;

// Conexión en vivo (FE-8.1): una sola conexión SSE por sesión. Al desmontarse (p. ej. al cerrar sesión) se cierra.
// Si el servidor la rechaza (sesión caducada o demasiadas pestañas), el navegador no reintenta y la app sigue sin ella.
export function ProveedorNotificaciones({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const cliente = useQueryClient();
  const { mostrar } = useToast();
  // Reconectar reenvía lo que se perdió: se recuerdan los ids para no avisar dos veces.
  const vistas = useRef<number[]>([]);
  const usuarioId = sesion.data?.id;

  useEffect(() => {
    if (usuarioId === undefined || typeof EventSource === "undefined") return;

    const conexion = new EventSource("/api/notifications/stream", { withCredentials: true });

    conexion.addEventListener("notification", (evento) => {
      const notificacion = leerNotificacion((evento as MessageEvent<string>).data);
      if (!notificacion || vistas.current.includes(notificacion.id)) return;
      vistas.current = [...vistas.current, notificacion.id].slice(-MAX_IDS_RECORDADOS);

      for (const clave of CLAVES_AFECTADAS) {
        void cliente.invalidateQueries({ queryKey: clave });
      }
      mostrar("info", textoNotificacion(notificacion), {
        accion: { etiqueta: "Ver", href: hrefNotificacion(notificacion) },
        duracionMs: DURACION_AVISO_MS,
      });
    });

    return () => conexion.close();
  }, [usuarioId, cliente, mostrar]);

  return <>{children}</>;
}

function leerNotificacion(datos: string): Notificacion | null {
  try {
    const resultado = NotificacionSchema.safeParse(JSON.parse(datos));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}
