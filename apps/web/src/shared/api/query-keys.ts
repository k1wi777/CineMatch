// Claves de caché centralizadas por feature: cada feature exporta las suyas con crearClaves.
// Así invalidar una feature es una sola llamada y no hay cadenas sueltas en los componentes.
export function crearClaves<T extends string>(feature: T) {
  return {
    todas: [feature] as const,
    lista: (filtros?: object) =>
      filtros ? ([feature, "lista", filtros] as const) : ([feature, "lista"] as const),
    detalle: (id: string | number) => [feature, "detalle", id] as const,
  };
}
