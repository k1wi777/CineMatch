import type { RecomendacionComunidad } from "@cinematch/shared";

// Texto que explica de dónde sale cada recomendación: ranking de la comunidad o respaldo por popularidad.
export function textoOrigen(origen: RecomendacionComunidad["origen"]): string {
  return origen === "comunidad" ? "Lo más valorado por la comunidad" : "Popular ahora";
}

// Promedio con una cifra decimal, o null si nadie la ha calificado todavía.
export function textoPromedio(promedio: number | null, calificaciones: number): string | null {
  if (promedio === null || calificaciones === 0) return null;
  return `${promedio.toFixed(1).replace(".", ",")} · ${calificaciones} calificaciones`;
}
