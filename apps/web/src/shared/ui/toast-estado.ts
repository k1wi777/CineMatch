// Estado de los avisos (toasts) como funciones puras: sin React ni JSX, así se prueban directamente.
export type TipoToast = "exito" | "error" | "info";

// Acción opcional del aviso: un enlace al elemento relacionado (FE-8.3).
export type AccionToast = { etiqueta: string; href: string };

export type Toast = { id: number; tipo: TipoToast; mensaje: string; accion?: AccionToast };

export const MAX_TOASTS_VISIBLES = 4;

export function agregarToast(lista: Toast[], nuevo: Omit<Toast, "id">, id: number): Toast[] {
  return [...lista, { ...nuevo, id }].slice(-MAX_TOASTS_VISIBLES);
}

export function quitarToast(lista: Toast[], id: number): Toast[] {
  return lista.filter((toast) => toast.id !== id);
}
