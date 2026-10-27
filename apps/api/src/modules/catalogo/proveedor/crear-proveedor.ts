import type { MovieProvider } from "./movie-provider.js";
import { crearMockProvider } from "./mock-provider.js";
import { crearTmdbProvider } from "./tmdb-provider.js";

// Con TMDB_API_KEY se usa TMDB; sin ella, el mock. Así todo el catálogo funciona sin clave.
export function crearProveedorCatalogo(tmdbApiKey: string | undefined): MovieProvider {
  return tmdbApiKey ? crearTmdbProvider({ apiKey: tmdbApiKey }) : crearMockProvider();
}
