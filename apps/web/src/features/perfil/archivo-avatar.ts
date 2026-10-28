// Validación previa del avatar en el cliente. La API vuelve a comprobar tipo y tamaño (415 y 413).
export const TIPOS_AVATAR = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANO_MAXIMO_AVATAR = 2 * 1024 * 1024;

export type ErrorArchivoAvatar = "tipo" | "tamano";

export function errorArchivoAvatar(archivo: {
  type: string;
  size: number;
}): ErrorArchivoAvatar | null {
  if (!(TIPOS_AVATAR as readonly string[]).includes(archivo.type)) return "tipo";
  if (archivo.size > TAMANO_MAXIMO_AVATAR) return "tamano";
  return null;
}
