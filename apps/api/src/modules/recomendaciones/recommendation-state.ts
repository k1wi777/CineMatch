import { type RecommendationAction, type RecommendationStatus } from "@cinematch/shared";
import { AppError } from "../../lib/errors.js";

// Máquina de estados de las recomendaciones (BE-10.1). Módulo puro: no toca la base de datos.
// Tabla cerrada: cualquier combinación que no esté aquí lanza InvalidTransitionError.
//
// - Las acciones repetidas en un estado que ya la cumple no cambian nada (`cambia: false`).
// - Una recomendación `descartada` es terminal: no se reabre ni se completa (BE-10.6).
// - Una recomendación `completada` no vuelve atrás.

export type CampoFecha = "fecha_apertura" | "fecha_respuesta" | "fecha_completado";

export type ResultadoTransicion = {
  siguiente: RecommendationStatus;
  // Si la transición cambia el estado (y por tanto debe persistirse y datar `campoFecha`).
  cambia: boolean;
  campoFecha: CampoFecha | null;
};

export class InvalidTransitionError extends AppError {
  constructor(estado: RecommendationStatus, accion: RecommendationAction) {
    super(
      409,
      "INVALID_TRANSITION",
      `No se puede aplicar ${accion} a una recomendación ${estado}.`,
    );
    this.name = "InvalidTransitionError";
  }
}

type Transicion = { siguiente: RecommendationStatus; campoFecha: CampoFecha | null };

// Desde qué estados se permite cada acción, hacia qué estado y con qué fecha.
// Si el estado de partida ya es el destino, la acción es idempotente (se resuelve más abajo).
const TABLA: Record<RecommendationAction, Partial<Record<RecommendationStatus, Transicion>>> = {
  OPEN: {
    enviada: { siguiente: "abierta", campoFecha: "fecha_apertura" },
  },
  ACCEPT: {
    enviada: { siguiente: "aceptada", campoFecha: "fecha_respuesta" },
    abierta: { siguiente: "aceptada", campoFecha: "fecha_respuesta" },
  },
  DISCARD: {
    enviada: { siguiente: "descartada", campoFecha: "fecha_respuesta" },
    abierta: { siguiente: "descartada", campoFecha: "fecha_respuesta" },
  },
  COMPLETE: {
    enviada: { siguiente: "completada", campoFecha: "fecha_completado" },
    abierta: { siguiente: "completada", campoFecha: "fecha_completado" },
    aceptada: { siguiente: "completada", campoFecha: "fecha_completado" },
  },
};

// Estados en los que la acción ya está cumplida: no hay nada que cambiar y no es un error.
const YA_CUMPLIDA: Record<RecommendationAction, RecommendationStatus[]> = {
  OPEN: ["abierta", "aceptada", "completada"],
  ACCEPT: ["aceptada", "completada"],
  DISCARD: ["descartada"],
  COMPLETE: ["completada"],
};

export function transition(
  estadoActual: RecommendationStatus,
  accion: RecommendationAction,
): ResultadoTransicion {
  const transicion = TABLA[accion][estadoActual];
  if (transicion) {
    return { siguiente: transicion.siguiente, cambia: true, campoFecha: transicion.campoFecha };
  }
  if (YA_CUMPLIDA[accion].includes(estadoActual)) {
    return { siguiente: estadoActual, cambia: false, campoFecha: null };
  }
  throw new InvalidTransitionError(estadoActual, accion);
}
