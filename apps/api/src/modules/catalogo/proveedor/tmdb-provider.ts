import { crearLimitador } from "../../../lib/concurrencia.js";
import { ProveedorExternoError } from "../../../lib/errors.js";
import {
  aContenidoExterno,
  nombresDeGeneros,
  type GeneroTmdb,
  type TituloTmdb,
} from "./mapeo-tmdb.js";
import type { MovieProvider, TipoContenido } from "./movie-provider.js";

const BASE_POR_DEFECTO = "https://api.themoviedb.org/3";
const IDIOMA = "es-ES";
const TIMEOUT_POR_DEFECTO_MS = 10_000;
const REINTENTOS_POR_DEFECTO = 3;
const CONCURRENCIA_MAXIMA = 5;
// Espera máxima que aceptamos de Retry-After, para no bloquear una petición durante minutos.
const ESPERA_MAXIMA_RETRY_AFTER_MS = 10_000;

export type OpcionesTmdb = {
  apiKey: string;
  baseUrl?: string;
  // Inyectables para las pruebas: sin red y sin esperas reales.
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  reintentos?: number;
};

const esperarReal = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

// Cliente de TMDB (BE-6.1): timeout, reintentos con backoff ante 429 y 5xx, y máximo 5 peticiones a la vez.
// Ningún error lleva la URL: esa contiene la clave de API.
export function crearTmdbProvider(opciones: OpcionesTmdb): MovieProvider {
  const base = opciones.baseUrl ?? BASE_POR_DEFECTO;
  const fetchFn = opciones.fetch ?? fetch;
  const esperar = opciones.esperar ?? esperarReal;
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
  const reintentos = opciones.reintentos ?? REINTENTOS_POR_DEFECTO;
  const limitar = crearLimitador(CONCURRENCIA_MAXIMA);

  // Nombres de géneros por id, cargados una vez. Si fallan, se reintentan en la siguiente llamada.
  let generosCargados:
    Promise<{ peliculas: Map<number, string>; series: Map<number, string> }> | undefined;

  async function pedir<T>(
    ruta: string,
    parametros: Record<string, string> = {},
  ): Promise<T | null> {
    const query = new URLSearchParams({
      language: IDIOMA,
      api_key: opciones.apiKey,
      ...parametros,
    });
    const url = `${base}${ruta}?${query.toString()}`;

    for (let intento = 0; ; intento++) {
      let res: Response;
      try {
        res = await limitar(() =>
          fetchFn(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { Accept: "application/json" },
          }),
        );
      } catch {
        if (intento >= reintentos) throw new ProveedorExternoError();
        await esperar(500 * 2 ** intento);
        continue;
      }

      if (res.status === 404) return null;

      if (res.status === 429 || res.status >= 500) {
        await res.text().catch(() => undefined);
        if (intento >= reintentos) throw new ProveedorExternoError();
        const retryAfter = Number(res.headers.get("retry-after"));
        const espera =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, ESPERA_MAXIMA_RETRY_AFTER_MS)
            : 500 * 2 ** intento;
        await esperar(espera);
        continue;
      }

      if (!res.ok) {
        await res.text().catch(() => undefined);
        throw new ProveedorExternoError();
      }

      try {
        return (await res.json()) as T;
      } catch {
        throw new ProveedorExternoError();
      }
    }
  }

  function cargarGeneros() {
    generosCargados ??= Promise.all([
      pedir<{ genres?: GeneroTmdb[] }>("/genre/movie/list"),
      pedir<{ genres?: GeneroTmdb[] }>("/genre/tv/list"),
    ])
      .then(([peliculas, series]) => ({
        peliculas: new Map((peliculas?.genres ?? []).map((g) => [g.id, g.name])),
        series: new Map((series?.genres ?? []).map((g) => [g.id, g.name])),
      }))
      .catch((err: unknown) => {
        generosCargados = undefined;
        throw err;
      });
    return generosCargados;
  }

  // Las listas solo traen ids de género: los nombres salen del catálogo cargado.
  async function nombresPorIds(tipo: TipoContenido, ids: number[] = []): Promise<string[]> {
    const mapas = await cargarGeneros();
    const mapa = tipo === "pelicula" ? mapas.peliculas : mapas.series;
    return nombresDeGeneros(
      tipo,
      ids.map((id) => ({ id, name: mapa.get(id) ?? "" })),
    );
  }

  return {
    fuente: "tmdb",
    async fetchGenres() {
      const mapas = await cargarGeneros();
      const nombres = new Set<string>(mapas.peliculas.values());
      for (const nombre of nombresDeGeneros(
        "serie",
        [...mapas.series].map(([id, name]) => ({ id, name })),
      )) {
        nombres.add(nombre);
      }
      return [...nombres];
    },

    async fetchPopular(tipo, page) {
      const ruta = tipo === "pelicula" ? "/movie/popular" : "/tv/popular";
      const datos = await pedir<{ results?: (TituloTmdb & { genre_ids?: number[] })[] }>(ruta, {
        page: String(Math.max(1, Math.floor(page))),
      });
      const titulos = datos?.results ?? [];
      return Promise.all(
        titulos.map(async (titulo) =>
          aContenidoExterno(tipo, titulo, await nombresPorIds(tipo, titulo.genre_ids)),
        ),
      );
    },

    async fetchDetails(tipo, idExterno) {
      // Se valida el id antes de usarlo en la ruta.
      if (!/^\d+$/.test(idExterno)) return null;
      const ruta = tipo === "pelicula" ? `/movie/${idExterno}` : `/tv/${idExterno}`;
      const titulo = await pedir<TituloTmdb>(ruta, { append_to_response: "credits" });
      if (!titulo) return null;
      const generos = nombresDeGeneros(tipo, titulo.genres ?? []);
      return aContenidoExterno(tipo, titulo, generos);
    },
  };
}
