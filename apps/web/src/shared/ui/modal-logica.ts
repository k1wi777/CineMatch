// Foco dentro de un modal, sin React: calcula qué botón recibe el foco al pulsar Tab.
// Devuelve -1 si no hay elementos enfocables.
export function siguienteFoco(total: number, actual: number, retroceder: boolean): number {
  if (total === 0) return -1;
  if (retroceder) return actual <= 0 ? total - 1 : actual - 1;
  return actual >= total - 1 ? 0 : actual + 1;
}
