import { describe, expect, it } from "vitest";
import {
  elegirTrailerYoutube,
  type VideoTmdb,
} from "../../src/modules/catalogo/proveedor/mapeo-tmdb.js";
import { crearTmdbProvider } from "../../src/modules/catalogo/proveedor/tmdb-provider.js";

const CLAVE = "clave-secreta-de-prueba";
const BASE = "https://tmdb.test/3";
const sinEspera = async () => undefined;

function respuesta(cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("tráiler: elección del enlace (mapeo de TMDB)", () => {
  it("elige el oficial de YouTube y descarta otros sitios, tipos y claves no válidas", () => {
    const videos: VideoTmdb[] = [
      { site: "Vimeo", type: "Trailer", key: "vimeo123" },
      { site: "YouTube", type: "Teaser", key: "teaser123" },
      { site: "YouTube", type: "Trailer", key: "normal123", official: false },
      { site: "YouTube", type: "Trailer", key: "oficial12", official: true },
      { site: "YouTube", type: "Trailer", key: "no valida!" },
    ];

    expect(elegirTrailerYoutube(videos)).toBe("https://www.youtube.com/watch?v=oficial12");
  });

  it("usa el primero válido si ninguno es oficial, y null si no hay ninguno", () => {
    expect(elegirTrailerYoutube([{ site: "YouTube", type: "Trailer", key: "primero12" }])).toBe(
      "https://www.youtube.com/watch?v=primero12",
    );
    expect(elegirTrailerYoutube([])).toBeNull();
    expect(elegirTrailerYoutube([{ site: "YouTube", type: "Clip", key: "clip1234" }])).toBeNull();
  });
});

describe("tráiler: consulta a TMDB", () => {
  it("pide primero en español y, si no hay tráiler, en inglés", async () => {
    const urls: string[] = [];
    const fn = (async (entrada: string | URL | Request) => {
      const url = String(entrada);
      urls.push(url);
      return url.includes("language=en-US")
        ? respuesta({ results: [{ site: "YouTube", type: "Trailer", key: "ingles123" }] })
        : respuesta({ results: [] });
    }) as unknown as typeof fetch;
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    const enlace = await proveedor.fetchTrailer("pelicula", "550");

    expect(enlace).toBe("https://www.youtube.com/watch?v=ingles123");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("/movie/550/videos");
    expect(urls[1]).toContain("/movie/550/videos");
  });

  it("no hace ninguna petición si el id externo no es numérico", async () => {
    let llamadas = 0;
    const fn = (async () => {
      llamadas += 1;
      return respuesta({ results: [] });
    }) as unknown as typeof fetch;
    const proveedor = crearTmdbProvider({ apiKey: CLAVE, baseUrl: BASE, fetch: fn });

    expect(await proveedor.fetchTrailer("serie", "../etc")).toBeNull();
    expect(llamadas).toBe(0);
  });
});
