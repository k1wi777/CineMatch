import type { ContenidoExterno, TipoContenido } from "./movie-provider.js";

// Formas mínimas de la respuesta de TMDB que usamos. Cualquier campo puede faltar.
export type GeneroTmdb = { id: number; name: string };

export type TituloTmdb = {
  id: number;
  title?: string; // películas
  name?: string; // series
  overview?: string;
  release_date?: string; // películas
  first_air_date?: string; // series
  poster_path?: string | null;
  popularity?: number;
  genre_ids?: number[];
  genres?: GeneroTmdb[];
  runtime?: number | null; // películas
  episode_run_time?: number[]; // series
  credits?: { crew?: { job?: string; name?: string }[] };
  created_by?: { name?: string }[];
};

export const URL_POSTER_TMDB = "https://image.tmdb.org/t/p/w500";

// En series, TMDB agrupa algunos géneros en uno combinado. Se separan en dos géneros (decisión de BE-6.1).
// Clave: id del género combinado de TV en TMDB.
export const GENEROS_TV_COMBINADOS: Record<number, string[]> = {
  10759: ["Acción", "Aventura"], // Action & Adventure
  10765: ["Ciencia ficción", "Fantasía"], // Sci-Fi & Fantasy
  10768: ["Bélica", "Política"], // War & Politics
};

// Nombres de géneros para un título, separando los combinados de series.
export function nombresDeGeneros(tipo: TipoContenido, generos: GeneroTmdb[]): string[] {
  const nombres: string[] = [];
  for (const genero of generos) {
    const separados = tipo === "serie" ? GENEROS_TV_COMBINADOS[genero.id] : undefined;
    if (separados) {
      nombres.push(...separados);
    } else if (genero.name) {
      nombres.push(genero.name);
    }
  }
  return [...new Set(nombres)];
}

// Año a partir de "YYYY-MM-DD"; null si la fecha falta o no es válida.
export function anioDe(fecha: string | undefined): number | null {
  const anio = Number((fecha ?? "").slice(0, 4));
  return Number.isInteger(anio) && anio > 0 ? anio : null;
}

export function posterDe(posterPath: string | null | undefined): string | null {
  return posterPath ? `${URL_POSTER_TMDB}${posterPath}` : null;
}

// Director de una película (job "Director") o creador de una serie (created_by).
export function directorDe(tipo: TipoContenido, titulo: TituloTmdb): string | null {
  if (tipo === "pelicula") {
    const director = titulo.credits?.crew?.find((persona) => persona.job === "Director");
    return director?.name ?? null;
  }
  return titulo.created_by?.[0]?.name ?? null;
}

// Duración en minutos: runtime en películas, primer episodio en series.
export function duracionDe(tipo: TipoContenido, titulo: TituloTmdb): number | null {
  const minutos = tipo === "pelicula" ? titulo.runtime : titulo.episode_run_time?.[0];
  return typeof minutos === "number" && minutos > 0 ? minutos : null;
}

// Convierte un título de TMDB (lista o detalle) al formato interno.
// `generos` son los nombres ya resueltos, porque las listas solo traen ids.
export function aContenidoExterno(
  tipo: TipoContenido,
  titulo: TituloTmdb,
  generos: string[],
): ContenidoExterno {
  const nombre = tipo === "pelicula" ? titulo.title : titulo.name;
  const fecha = tipo === "pelicula" ? titulo.release_date : titulo.first_air_date;
  return {
    tipo,
    idExterno: String(titulo.id),
    titulo: (nombre ?? "").trim(),
    sinopsis: titulo.overview?.trim() || null,
    anio: anioDe(fecha),
    director: directorDe(tipo, titulo),
    duracion: duracionDe(tipo, titulo),
    posterUrl: posterDe(titulo.poster_path),
    popularidadExterna: typeof titulo.popularity === "number" ? titulo.popularity : null,
    generos,
  };
}
