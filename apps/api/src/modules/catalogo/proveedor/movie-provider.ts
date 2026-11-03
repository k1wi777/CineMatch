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
  // Imagen horizontal del título (para el carrusel del inicio). Opcional: el mock no la tiene.
  fondoUrl?: string | null;
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
  // Enlace de YouTube al tráiler, o null si no hay. Solo se guarda el enlace; el video no se descarga.
  fetchTrailer(tipo: TipoContenido, idExterno: string): Promise<string | null>;
  // URL de la imagen del logotipo del título (el nombre como imagen), o null si no hay. Prefiere español e inglés.
  fetchLogo(tipo: TipoContenido, idExterno: string): Promise<string | null>;
  // Nombres del reparto principal, en orden de importancia (vacío si no hay o no se conoce).
  fetchCast(tipo: TipoContenido, idExterno: string): Promise<string[]>;
  // Búsqueda por texto en la fuente externa (películas y series). Se usa cuando el catálogo local no tiene el título.
  search(texto: string): Promise<ContenidoExterno[]>;
  // URLs de fondos del título para la galería (vacío si no hay).
  fetchGallery(tipo: TipoContenido, idExterno: string): Promise<string[]>;
  // Puntuación media de la fuente (0 a 10), o null si no la tiene. Opcional.
  fetchPuntuacion?(tipo: TipoContenido, idExterno: string): Promise<number | null>;
  // Títulos más populares de una región (con streaming allí), de más a menos popular. Opcional.
  fetchPopularEnRegion?(region: string): Promise<ContenidoExterno[]>;
}
