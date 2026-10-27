import { z } from "zod";

// Texto de usuario que se almacena como texto plano: se quitan las etiquetas HTML y se normalizan
// los espacios y tabulaciones. Los saltos de línea se conservan (los comentarios los usan).
export function textoPlano(valor: string): string {
  return valor
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Escape para mostrar texto dentro de HTML, por ejemplo en correos. React escapa al renderizar en la web.
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Esquema Zod para un texto de usuario: primero se guarda el texto plano y después se valida la longitud,
// para que las etiquetas HTML no cuenten contra el máximo.
export function textoUsuario(maximo: number) {
  return z.string().transform(textoPlano).pipe(z.string().max(maximo));
}
