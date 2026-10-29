import { MAX_ETIQUETAS_RESENA, MAX_LONGITUD_ETIQUETA, normalizarEtiqueta } from "@cinematch/shared";

export type ErrorEtiqueta = "vacia" | "larga" | "maximo" | "repetida";

// Añade una etiqueta normalizada (minúsculas, sin tildes, espacios simples) respetando los límites de la API.
export function agregarEtiqueta(
  actuales: string[],
  texto: string,
): { etiquetas: string[]; error?: ErrorEtiqueta } {
  const normal = normalizarEtiqueta(texto);
  if (normal.length === 0) return { etiquetas: actuales, error: "vacia" };
  if (normal.length > MAX_LONGITUD_ETIQUETA) return { etiquetas: actuales, error: "larga" };
  if (actuales.includes(normal)) return { etiquetas: actuales, error: "repetida" };
  if (actuales.length >= MAX_ETIQUETAS_RESENA) return { etiquetas: actuales, error: "maximo" };
  return { etiquetas: [...actuales, normal] };
}

const PALABRAS_VACIAS = new Set([
  "para",
  "pero",
  "como",
  "este",
  "esta",
  "esto",
  "estos",
  "estas",
  "muy",
  "mas",
  "que",
  "con",
  "por",
  "una",
  "uno",
  "unos",
  "unas",
  "del",
  "las",
  "los",
  "sin",
  "sobre",
  "todo",
  "toda",
  "cuando",
  "donde",
  "porque",
  "tambien",
  "tiene",
  "hace",
  "fue",
  "era",
  "son",
  "ser",
  "ella",
  "ellos",
  "pelicula",
  "serie",
]);

// Sugerencias tomadas del comentario: palabras largas y no vacías, sin repetir las ya elegidas.
export function sugerirEtiquetas(comentario: string, elegidas: string[], limite = 5): string[] {
  const yaElegidas = new Set(elegidas);
  const palabras = comentario
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizarEtiqueta)
    .filter(
      (palabra) =>
        palabra.length >= 5 &&
        palabra.length <= MAX_LONGITUD_ETIQUETA &&
        !PALABRAS_VACIAS.has(palabra) &&
        !yaElegidas.has(palabra),
    );
  return [...new Set(palabras)].slice(0, limite);
}
