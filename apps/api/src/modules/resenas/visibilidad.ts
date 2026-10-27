// Regla de visibilidad de reseñas (BE-9.4). Es el único sitio que decide quién ve qué.
// Toda consulta de reseñas debe usar estas funciones; nadie evalúa la visibilidad a mano.
//
// Definiciones:
// - Reseña oculta: visible = false (moderación).
// - Espectador: usuario autenticado que consulta. Amigo: amistad aceptada entre autor y espectador.
// - Autor eliminado: sus reseñas siguen contando en promedios y se muestran con el autor anonimizado (BE-13.1).

export type VisibilidadResena = "publica" | "amigos";

// Vista en memoria de una reseña: lo que necesita canViewerSee.
export type ResenaVisible = {
  usuarioId: number;
  visible: boolean;
  visibilidad: VisibilidadResena;
};

// Subconsulta: ¿son amigos (amistad aceptada) el autor de `autor` y el espectador `espectador`?
function sonAmigosSql(autor: string, espectador: string): string {
  return `EXISTS (
    SELECT 1 FROM amistad a
     WHERE a.estado = 'aceptada'
       AND LEAST(a.solicitante_id, a.receptor_id) = LEAST(${autor}, ${espectador})
       AND GREATEST(a.solicitante_id, a.receptor_id) = GREATEST(${autor}, ${espectador}))`;
}

// Fragmento para listar reseñas a un espectador. Parámetros: `alias` y `espectadorParam` los escribe el código, no el usuario.
// El propio autor ve todas las suyas (también las ocultas). Los demás ven solo las no ocultas que les corresponden.
export function visibleReviewsFilter({
  alias,
  espectadorParam,
}: {
  alias: string;
  espectadorParam: string;
}): string {
  return `(${alias}.usuario_id = ${espectadorParam}
    OR (${alias}.visible

        AND (${alias}.visibilidad = 'publica' OR ${sonAmigosSql(`${alias}.usuario_id`, espectadorParam)})))`;
}

// Promedio y conteo públicos (RN4): cuentan todas las reseñas no ocultas, de forma anónima.
export function filtroPromedioPublico(alias: string): string {
  return `(${alias}.visible)`;
}

// Promedio de amigos (RN5): reseñas no ocultas cuyos autores son amigos del espectador.
export function filtroPromedioAmigos({
  alias,
  espectadorParam,
}: {
  alias: string;
  espectadorParam: string;
}): string {
  return `(${alias}.visible AND ${sonAmigosSql(`${alias}.usuario_id`, espectadorParam)})`;
}

// Etiquetas de la comunidad (RN7): solo reseñas públicas y no ocultas.
export function filtroEtiquetasComunidad(alias: string): string {
  return `(${alias}.visible AND ${alias}.visibilidad = 'publica')`;
}

// Misma regla que visibleReviewsFilter, en memoria. `sonAmigos` se calcula fuera (según la amistad vigente).
export function canViewerSee(
  resena: ResenaVisible,
  espectadorId: number,
  sonAmigos: boolean,
): boolean {
  if (resena.usuarioId === espectadorId) return true;
  if (!resena.visible) return false;
  return resena.visibilidad === "publica" || sonAmigos;
}
