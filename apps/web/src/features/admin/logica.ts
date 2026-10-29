import type { EstadoSincronizacion } from "@cinematch/shared";

// Reglas de la pantalla de administración, sin React.

// Una sincronización solo se lanza si no hay otra en curso (la API responde 409 en ese caso).
export function puedeSincronizar(
  estado: EstadoSincronizacion | undefined,
  enviando: boolean,
): boolean {
  if (enviando) return false;
  return estado?.estado !== "en_curso";
}

// Mientras la sincronización corre se consulta su estado cada pocos segundos; al terminar, se deja de consultar.
export function intervaloSondeoMs(estado: EstadoSincronizacion | undefined): number | false {
  return estado?.estado === "en_curso" ? 2000 : false;
}

// La acción sobre una reseña depende de si está visible: una visible se oculta, una oculta se restablece.
export function accionModeracion(visible: boolean): "ocultar" | "restablecer" {
  return visible ? "ocultar" : "restablecer";
}
