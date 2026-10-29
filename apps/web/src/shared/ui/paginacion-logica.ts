// Cálculo de páginas sin React: cuántas hay y si una página es válida.
export function paginasTotales(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, tamano)));
}
