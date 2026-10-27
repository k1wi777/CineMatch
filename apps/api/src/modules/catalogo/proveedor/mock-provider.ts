import { FIXTURES_MOCK } from "./fixtures-mock.js";
import type { ContenidoExterno, MovieProvider, TipoContenido } from "./movie-provider.js";

const TAMANO_PAGINA = 20;

// Proveedor sin red: devuelve siempre los mismos títulos de FIXTURES_MOCK, en el mismo orden.
export function crearMockProvider(fixtures: ContenidoExterno[] = FIXTURES_MOCK): MovieProvider {
  // Copias para que quien consume no pueda alterar los fixtures compartidos.
  const copia = (contenido: ContenidoExterno): ContenidoExterno => ({
    ...contenido,
    generos: [...contenido.generos],
  });

  return {
    fuente: "mock",
    async fetchGenres() {
      return [...new Set(fixtures.flatMap((contenido) => contenido.generos))];
    },

    async fetchPopular(tipo: TipoContenido, page: number) {
      const ordenados = fixtures
        .filter((contenido) => contenido.tipo === tipo)
        .sort((a, b) => (b.popularidadExterna ?? 0) - (a.popularidadExterna ?? 0));
      const inicio = (Math.max(1, Math.floor(page)) - 1) * TAMANO_PAGINA;
      return ordenados.slice(inicio, inicio + TAMANO_PAGINA).map(copia);
    },

    async fetchDetails(tipo: TipoContenido, idExterno: string) {
      const encontrado = fixtures.find(
        (contenido) => contenido.tipo === tipo && contenido.idExterno === idExterno,
      );
      return encontrado ? copia(encontrado) : null;
    },
  };
}
