import { describe, expect, it } from "vitest";
import { crearLimitador } from "../../src/lib/concurrencia.js";
import { ProveedorExternoError } from "../../src/lib/errors.js";
import { crearMockProvider } from "../../src/modules/catalogo/proveedor/mock-provider.js";
import { crearTmdbProvider } from "../../src/modules/catalogo/proveedor/tmdb-provider.js";

const CLAVE = "clave-secreta-de-prueba";
const BASE = "https://tmdb.test/3";

function respuesta(estado: number, cuerpo: unknown = {}, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json", ...cabeceras },
  });
}

// Fetch falso: responde según la ruta y cuenta las llamadas.
function fetchFalso(responder: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  const fn = (async (entrada: string | URL | Request) => {
    const url = String(entrada);
    urls.push(url);
    return responder(url);
  }) as unknown as typeof fetch;
  return { fn, urls };
}

const sinEspera = async () => undefined;

describe("cliente TMDB (BE-6.1)", () => {
  it("mapea una película con director, duración, póster, año y géneros", async () => {
    const { fn } = fetchFalso((url) => {
      if (url.includes("/movie/550")) {
        return respuesta(200, {
          id: 550,
          title: "Película de prueba",
          overview: " Sinopsis ",
          release_date: "1999-10-15",
          runtime: 139,
          poster_path: "/abc.jpg",
          popularity: 61.5,
          genres: [{ id: 18, name: "Drama" }],
          credits: {
            crew: [
              { job: "Producer", name: "Otra" },
              { job: "Director", name: "Dir" },
            ],
          },
        });
      }
      return respuesta(404);
    });
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    const contenido = await proveedor.fetchDetails("pelicula", "550");

    expect(contenido).toEqual({
      tipo: "pelicula",
      idExterno: "550",
      titulo: "Película de prueba",
      sinopsis: "Sinopsis",
      anio: 1999,
      director: "Dir",
      duracion: 139,
      posterUrl: "https://image.tmdb.org/t/p/w500/abc.jpg",
      popularidadExterna: 61.5,
      generos: ["Drama"],
    });
  });

  it("mapea una serie con creador, duración del episodio y separa los géneros combinados", async () => {
    const { fn } = fetchFalso(() =>
      respuesta(200, {
        id: 1396,
        name: "Serie de prueba",
        first_air_date: "2008-01-20",
        episode_run_time: [47],
        poster_path: null,
        popularity: 300,
        genres: [
          { id: 10759, name: "Action & Adventure" },
          { id: 18, name: "Drama" },
        ],
        created_by: [{ name: "Creador" }],
      }),
    );
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    const contenido = await proveedor.fetchDetails("serie", "1396");

    expect(contenido).toMatchObject({
      tipo: "serie",
      titulo: "Serie de prueba",
      anio: 2008,
      director: "Creador",
      duracion: 47,
      posterUrl: null,
      generos: ["Acción", "Aventura", "Drama"],
    });
  });

  it("devuelve null si el id no existe (404) y no pide nada con un id mal formado", async () => {
    const { fn, urls } = fetchFalso(() => respuesta(404));
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    expect(await proveedor.fetchDetails("pelicula", "999999")).toBeNull();
    expect(await proveedor.fetchDetails("pelicula", "../../otra-ruta")).toBeNull();
    expect(urls).toHaveLength(1);
  });

  it("reintenta ante 429 y respeta Retry-After", async () => {
    let llamadas = 0;
    const esperas: number[] = [];
    const { fn } = fetchFalso(() => {
      llamadas += 1;
      return llamadas === 1
        ? respuesta(429, {}, { "Retry-After": "2" })
        : respuesta(200, { id: 1, title: "Ok", genres: [] });
    });
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: async (ms) => {
        esperas.push(ms);
      },
    });

    const contenido = await proveedor.fetchDetails("pelicula", "1");

    expect(contenido?.titulo).toBe("Ok");
    expect(llamadas).toBe(2);
    expect(esperas).toEqual([2000]);
  });

  it("ante 5xx reintenta hasta agotar los intentos y luego lanza error de proveedor", async () => {
    const { fn, urls } = fetchFalso(() => respuesta(503));
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
      reintentos: 2,
    });

    await expect(proveedor.fetchDetails("pelicula", "1")).rejects.toBeInstanceOf(
      ProveedorExternoError,
    );
    expect(urls).toHaveLength(3);
  });

  it("ante un error de cliente (400) no reintenta", async () => {
    const { fn, urls } = fetchFalso(() => respuesta(400));
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    await expect(proveedor.fetchDetails("pelicula", "1")).rejects.toBeInstanceOf(
      ProveedorExternoError,
    );
    expect(urls).toHaveLength(1);
  });

  it("aplica timeout: una petición colgada termina con error de proveedor", async () => {
    const colgado = ((_: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, rechazar) => {
        init?.signal?.addEventListener("abort", () => rechazar(init.signal?.reason));
      })) as unknown as typeof fetch;
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: colgado,
      esperar: sinEspera,
      timeoutMs: 20,
      reintentos: 1,
    });

    await expect(proveedor.fetchDetails("pelicula", "1")).rejects.toBeInstanceOf(
      ProveedorExternoError,
    );
  });

  it("el error nunca contiene la clave de API ni la URL", async () => {
    const { fn } = fetchFalso(() => respuesta(500));
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
      reintentos: 0,
    });

    const error = await proveedor.fetchDetails("pelicula", "1").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProveedorExternoError);
    expect(String((error as Error).message)).not.toContain(CLAVE);
    expect(String((error as Error).message)).not.toContain("api_key");
  });

  it("pide siempre en español (es-ES) y con la clave como parámetro", async () => {
    const { fn, urls } = fetchFalso(() => respuesta(404));
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    await proveedor.fetchDetails("serie", "7");

    expect(urls[0]).toContain("language=es-ES");
    expect(urls[0]).toContain(`api_key=${CLAVE}`);
    expect(urls[0]).toContain("/tv/7");
  });

  it("nunca tiene más de 5 peticiones en vuelo a la vez", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const { fn } = fetchFalso(async () => {
      enVuelo += 1;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((resolver) => setTimeout(resolver, 5));
      enVuelo -= 1;
      return respuesta(200, { id: 1, title: "x", genres: [] });
    });
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    const resultados = await Promise.all(
      Array.from({ length: 12 }, (_, i) => proveedor.fetchDetails("pelicula", String(i + 1))),
    );

    expect(resultados).toHaveLength(12);
    expect(maximo).toBeLessThanOrEqual(5);
    expect(maximo).toBeGreaterThan(1);
  });

  it("las listas resuelven los nombres de género a partir de los ids y unifican los nombres", async () => {
    const { fn } = fetchFalso((url) => {
      if (url.includes("/genre/movie/list")) {
        return respuesta(200, {
          genres: [
            { id: 28, name: "Acción" },
            { id: 18, name: "Drama" },
          ],
        });
      }
      if (url.includes("/genre/tv/list")) {
        return respuesta(200, {
          genres: [
            { id: 10759, name: "Action & Adventure" },
            { id: 18, name: "Drama" },
          ],
        });
      }
      if (url.includes("/movie/popular")) {
        return respuesta(200, { results: [{ id: 5, title: "Lista", genre_ids: [28, 18] }] });
      }
      return respuesta(200, { results: [{ id: 6, name: "Serie lista", genre_ids: [10759] }] });
    });
    const proveedor = crearTmdbProvider({
      apiKey: CLAVE,
      baseUrl: BASE,
      fetch: fn,
      esperar: sinEspera,
    });

    const peliculas = await proveedor.fetchPopular("pelicula", 1);
    const series = await proveedor.fetchPopular("serie", 1);
    const generos = await proveedor.fetchGenres();

    expect(peliculas[0]?.generos).toEqual(["Acción", "Drama"]);
    expect(series[0]?.generos).toEqual(["Acción", "Aventura"]);
    expect(generos).toEqual(expect.arrayContaining(["Acción", "Drama", "Aventura"]));
    expect(new Set(generos).size).toBe(generos.length);
  });
});

describe("limitador de concurrencia", () => {
  it("no deja pasar más tareas que el máximo a la vez, y todas terminan", async () => {
    const limitar = crearLimitador(2);
    let activas = 0;
    let maximo = 0;
    const tarea = async (valor: number) =>
      limitar(async () => {
        activas += 1;
        maximo = Math.max(maximo, activas);
        await new Promise((resolver) => setTimeout(resolver, 2));
        activas -= 1;
        return valor;
      });

    const resultados = await Promise.all(Array.from({ length: 8 }, (_, i) => tarea(i)));

    expect(resultados).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(maximo).toBe(2);
  });
});

describe("proveedor de prueba (mock)", () => {
  it("devuelve siempre los mismos títulos, separados por tipo y paginados", async () => {
    const mock = crearMockProvider();

    const peliculas = await mock.fetchPopular("pelicula", 1);
    const series = await mock.fetchPopular("serie", 1);
    const otraVez = await mock.fetchPopular("pelicula", 1);

    expect(peliculas.every((c) => c.tipo === "pelicula")).toBe(true);
    expect(series.every((c) => c.tipo === "serie")).toBe(true);
    expect(otraVez).toEqual(peliculas);
    expect(await mock.fetchPopular("pelicula", 99)).toEqual([]);
  });

  it("devuelve la ficha de un título conocido y null para uno desconocido", async () => {
    const mock = crearMockProvider();
    const [primero] = await mock.fetchPopular("serie", 1);

    expect(await mock.fetchDetails("serie", primero?.idExterno ?? "")).toEqual(primero);
    expect(await mock.fetchDetails("serie", "no-existe")).toBeNull();
  });

  it("no deja que quien consume altere los fixtures compartidos", async () => {
    const mock = crearMockProvider();
    const [primero] = await mock.fetchPopular("pelicula", 1);
    primero?.generos.push("Alterado");

    const otraVez = await mock.fetchPopular("pelicula", 1);

    expect(otraVez[0]?.generos).not.toContain("Alterado");
  });
});
