// Estado de los avisos (toasts) como funciones puras: sin React ni JSX, así se prueban directamente.
export type TipoToast = "exito" | "error" | "info";
export type Toast = { id: number; tipo: TipoToast; mensaje: string };

export const MAX_TOASTS_VISIBLES = 4;

export function agregarToast(lista: Toast[], nuevo: Omit<Toast, "id">, id: number): Toast[] {
  return [...lista, { ...nuevo, id }].slice(-MAX_TOASTS_VISIBLES);
}

export function quitarToast(lista: Toast[], id: number): Toast[] {
  return lista.filter((toast) => toast.id !== id);
}
