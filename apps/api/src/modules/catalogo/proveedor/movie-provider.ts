// Contrato del proveedor externo de catálogo (BE-6.1). TMDB y el mock lo implementan igual,
// así el resto del backend no sabe de dónde vienen los títulos.

export type TipoContenido = "pelicula" | "serie";

// Título normalizado, sin nada específico de TMDB. Los géneros son nombres (se unifican por nombre).
export type ContenidoExterno = {
  tipo: TipoContenido;
  idExterno: string;
  titulo: string;
  sinopsis: string | null;
  anio: number | null;
  director: string | null;
  duracion: number | null;
  posterUrl: string | null;
  popularidadExterna: number | null;
  generos: string[];
};

export interface MovieProvider {
  // Nombre de la fuente (columna `fuente`): junto a tipo e id externo identifica un título sin duplicarlo.
  readonly fuente: string;
  // Nombres de géneros de películas y series, sin repetir.
  fetchGenres(): Promise<string[]>;
  // Títulos populares de un tipo, página a página (sin director ni duración: vienen en el detalle).
  fetchPopular(tipo: TipoContenido, page: number): Promise<ContenidoExterno[]>;
  // Ficha completa, o null si el proveedor no conoce ese id.
  fetchDetails(tipo: TipoContenido, idExterno: string): Promise<ContenidoExterno | null>;
}
