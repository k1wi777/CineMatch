// Lee una cookie por nombre de la cabecera Cookie. Devuelve undefined si no existe.
export function leerCookie(cabecera: string | undefined, nombre: string): string | undefined {
  if (!cabecera) {
    return undefined;
  }
  for (const par of cabecera.split(";")) {
    const separador = par.indexOf("=");
    if (separador === -1) continue;
    if (par.slice(0, separador).trim() === nombre) {
      return decodeURIComponent(par.slice(separador + 1).trim());
    }
  }
  return undefined;
}
