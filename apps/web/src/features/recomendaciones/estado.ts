import type { RecommendationStatus } from "@cinematch/shared";

// Acciones del receptor según el estado. La API es la que manda: la tabla de transiciones
// solo acepta aceptar y descartar desde «enviada» o «abierta».
export type AccionReceptor = "aceptar" | "descartar";

export function accionesDelReceptor(estado: RecommendationStatus): AccionReceptor[] {
  return estado === "enviada" || estado === "abierta" ? ["aceptar", "descartar"] : [];
}

// La reseña del receptor solo aparece cuando la recomendación está completada.
export function puedeVerResenaReceptor(estado: RecommendationStatus): boolean {
  return estado === "completada";
}
