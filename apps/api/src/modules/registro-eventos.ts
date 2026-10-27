import type { EventBus } from "../lib/events.js";

// Punto de registro de los listeners de cada módulo. Se llama una vez, al arrancar el proceso.
// Cada épica añade aquí sus suscripciones (por ejemplo, BE-5 a notificaciones y BE-10.6 a recomendaciones).
export function registrarListenersDeModulos(eventos: EventBus): void {
  void eventos;
}
